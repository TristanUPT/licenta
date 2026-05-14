//! Downward expander: makes signals below threshold progressively quieter.
//!
//! Acts as a softer gate — instead of binary on/off, it applies a gain
//! proportional to how far the signal is below the threshold.
//!
//! For every 1 dB the signal falls below threshold, the output falls by
//! `ratio` dB. Range caps the maximum attenuation.
//!
//! gain_reduction_db = clamp((ratio − 1) · (level_db − threshold_db), range_db, 0)

use super::Effect;
use crate::utils::envelope::EnvelopeFollower;
use crate::utils::math::{db_to_lin, flush_denormal, lin_to_db, smoothing_alpha};

pub const PARAM_THRESHOLD_DB: u32 = 0; // -80–0 dB,   default -40
pub const PARAM_RATIO: u32        = 1; // 1–10,        default 2
pub const PARAM_ATTACK_MS: u32    = 2; // 0.1–100 ms,  default 5
pub const PARAM_RELEASE_MS: u32   = 3; // 5–500 ms,    default 100
pub const PARAM_RANGE_DB: u32     = 4; // -90–0 dB,    default -60
pub const PARAM_DRY_WET: u32      = 5; // 0–1,         default 1

const SMOOTH_TIME_SEC: f32 = 0.005;

pub struct Expander {
    sample_rate: f32,

    threshold_db: f32,
    ratio: f32,
    range_db: f32,
    attack_ms: f32,
    release_ms: f32,

    target_dry_wet: f32,
    smoothed_dry_wet: f32,
    smoother_alpha: f32,

    envelope: EnvelopeFollower,

    gain_state: f32,
    gain_alpha: f32,
}

impl Expander {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate,
            threshold_db: -40.0,
            ratio: 2.0,
            range_db: -60.0,
            attack_ms: 5.0,
            release_ms: 100.0,
            target_dry_wet: 1.0,
            smoothed_dry_wet: 1.0,
            smoother_alpha: smoothing_alpha(SMOOTH_TIME_SEC, sample_rate),
            envelope: EnvelopeFollower::new(sample_rate, 5.0, 100.0),
            gain_state: 1.0,
            gain_alpha: smoothing_alpha(0.002, sample_rate),
        }
    }
}

impl Effect for Expander {
    fn process(&mut self, input: &[f32], output: &mut [f32]) {
        let n = input.len().min(output.len());
        let alpha = self.smoother_alpha;

        for i in 0..n {
            self.smoothed_dry_wet += alpha * (self.target_dry_wet - self.smoothed_dry_wet);

            let level = self.envelope.process_sample(input[i]);
            let level_db = lin_to_db(level);

            let gain_reduction_db = if level_db < self.threshold_db {
                // Downward expansion: each dB below threshold → ratio dB drop.
                let reduction = (self.ratio - 1.0) * (level_db - self.threshold_db);
                reduction.max(self.range_db) // clamp to range
            } else {
                0.0
            };

            let target_gain = db_to_lin(gain_reduction_db);
            self.gain_state += self.gain_alpha * (target_gain - self.gain_state);
            self.gain_state = flush_denormal(self.gain_state);

            let wet = self.smoothed_dry_wet;
            output[i] = (1.0 - wet) * input[i] + wet * (input[i] * self.gain_state);
        }
    }

    fn set_param(&mut self, param_id: u32, value: f32) {
        match param_id {
            PARAM_THRESHOLD_DB => self.threshold_db = value.clamp(-80.0, 0.0),
            PARAM_RATIO        => self.ratio        = value.clamp(1.0, 10.0),
            PARAM_ATTACK_MS    => {
                self.attack_ms = value.clamp(0.1, 100.0);
                self.envelope = EnvelopeFollower::new(self.sample_rate, self.attack_ms, self.release_ms);
            }
            PARAM_RELEASE_MS   => {
                self.release_ms = value.clamp(5.0, 500.0);
                self.envelope = EnvelopeFollower::new(self.sample_rate, self.attack_ms, self.release_ms);
            }
            PARAM_RANGE_DB     => self.range_db    = value.clamp(-90.0, 0.0),
            PARAM_DRY_WET      => self.target_dry_wet = value.clamp(0.0, 1.0),
            _ => {}
        }
    }

    fn reset(&mut self) {
        self.envelope.reset();
        self.gain_state = 1.0;
        self.smoothed_dry_wet = self.target_dry_wet;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loud_signal_passes_through() {
        let sr = 48_000.0;
        let mut exp = Expander::new(sr);
        exp.set_param(PARAM_THRESHOLD_DB, -60.0); // very low threshold
        exp.set_param(PARAM_DRY_WET, 1.0);
        exp.reset();

        let input = vec![0.5_f32; 8192];
        let mut output = vec![0.0_f32; 8192];
        exp.process(&input, &mut output);

        // Signal well above threshold → should pass through with minimal attenuation.
        let diff: f32 = output[4096..]
            .iter()
            .zip(input[4096..].iter())
            .map(|(o, i)| (o - i).abs())
            .fold(0.0, f32::max);
        assert!(diff < 0.01, "expected passthrough, max_diff={diff}");
    }

    #[test]
    fn quiet_signal_is_attenuated() {
        let sr = 48_000.0;
        let mut exp = Expander::new(sr);
        exp.set_param(PARAM_THRESHOLD_DB, -6.0);  // threshold at –6 dBFS
        exp.set_param(PARAM_RATIO, 3.0);
        exp.set_param(PARAM_DRY_WET, 1.0);
        exp.reset();

        // Input at –30 dBFS ≈ 0.032 linear.
        let input = vec![0.032_f32; 8192];
        let mut output = vec![0.0_f32; 8192];
        exp.process(&input, &mut output);

        let out_rms: f32 = (output[4096..].iter().map(|s| s * s).sum::<f32>() / 4096.0).sqrt();
        assert!(out_rms < 0.032, "expected attenuation below threshold");
    }

    #[test]
    fn no_nan_or_inf() {
        let sr = 48_000.0;
        let mut exp = Expander::new(sr);
        let input: Vec<f32> = (0..8192).map(|i| ((i as f32) * 0.01).sin() * 0.1).collect();
        let mut output = vec![0.0_f32; 8192];
        exp.process(&input, &mut output);
        for &s in &output {
            assert!(s.is_finite(), "NaN or Inf in expander output");
        }
    }
}
