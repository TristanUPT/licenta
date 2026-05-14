//! De-esser: frequency-selective compressor targeting sibilant sounds.
//!
//! Algorithm (wideband mode):
//!   1. Copy the input through a sidechain HPF at `freq_hz` to isolate sibilance.
//!   2. Detect the sidechain level with an envelope follower.
//!   3. When the sidechain level exceeds `threshold_db`, compute a gain reduction
//!      (soft-knee, ratio-based) and apply it to the FULL input signal.
//!
//! LISTEN mode routes the sidechain signal to the output — useful for dialling
//! in the frequency and threshold.

use super::Effect;
use crate::utils::envelope::EnvelopeFollower;
use crate::utils::filters::{highpass, Biquad, BiquadCoeffs};
use crate::utils::math::{db_to_lin, flush_denormal, lin_to_db, smoothing_alpha};

pub const PARAM_THRESHOLD_DB: u32 = 0; // -60–0 dB,  default -30
pub const PARAM_FREQ_HZ: u32      = 1; // 2000–16 000 Hz, default 7000
pub const PARAM_RATIO: u32        = 2; // 2–20,      default 6
pub const PARAM_RELEASE_MS: u32   = 3; // 5–200 ms,  default 40
pub const PARAM_LISTEN: u32       = 4; // 0/1 boolean, default 0
pub const PARAM_DRY_WET: u32      = 5; // 0–1,       default 1

/// Attack is fixed at 1 ms for a snappy response typical of de-essers.
const ATTACK_MS: f32 = 1.0;
/// Knee width around threshold.
const KNEE_DB: f32 = 6.0;
const SMOOTH_TIME_SEC: f32 = 0.005;

pub struct DeEsser {
    sample_rate: f32,

    threshold_db: f32,
    ratio: f32,
    listen: bool,

    target_dry_wet: f32,
    smoothed_dry_wet: f32,
    smoother_alpha: f32,

    sidechain: Biquad,
    envelope: EnvelopeFollower,

    /// Cached sidechain frequency — only rebuild coefficients when it changes.
    last_freq: f32,

    /// Gain smoother to prevent clicks (1 ms one-pole).
    gain_state: f32,
    gain_alpha: f32,
}

impl DeEsser {
    pub fn new(sample_rate: f32) -> Self {
        let default_freq = 7000.0;
        let mut sidechain = Biquad::new(BiquadCoeffs::PASSTHROUGH);
        sidechain.set_coeffs(highpass(default_freq, 0.707, sample_rate));

        Self {
            sample_rate,
            threshold_db: -30.0,
            ratio: 6.0,
            listen: false,
            target_dry_wet: 1.0,
            smoothed_dry_wet: 1.0,
            smoother_alpha: smoothing_alpha(SMOOTH_TIME_SEC, sample_rate),
            sidechain,
            envelope: EnvelopeFollower::new(sample_rate, ATTACK_MS, 40.0),
            last_freq: default_freq,
            gain_state: 1.0,
            gain_alpha: smoothing_alpha(0.001, sample_rate),
        }
    }
}

impl Effect for DeEsser {
    fn process(&mut self, input: &[f32], output: &mut [f32]) {
        let n = input.len().min(output.len());
        let alpha = self.smoother_alpha;

        for i in 0..n {
            self.smoothed_dry_wet += alpha * (self.target_dry_wet - self.smoothed_dry_wet);

            // Sidechain: filter the input to isolate sibilance.
            let sc = flush_denormal(self.sidechain.process_sample(input[i]));

            if self.listen {
                // LISTEN mode: output the sidechain directly so the engineer
                // can hear exactly what the de-esser is responding to.
                output[i] = sc;
                continue;
            }

            // Envelope-follow the sidechain signal.
            let sc_level = self.envelope.process_sample(sc);
            let sc_db = lin_to_db(sc_level);

            // Soft-knee gain computer (same algorithm as the compressor).
            let t = self.threshold_db;
            let r = self.ratio;
            let w = KNEE_DB;
            let x_db = sc_db;

            let gain_reduction_db = if x_db <= t - w / 2.0 {
                0.0
            } else if x_db >= t + w / 2.0 {
                (t + (x_db - t) / r) - x_db
            } else {
                let delta = x_db - (t - w / 2.0);
                let extra = delta * delta / (2.0 * w);
                extra * (1.0 / r - 1.0)
            };

            let target_gain = db_to_lin(gain_reduction_db); // ≤ 1.0

            // Smooth the gain to avoid clicks.
            self.gain_state += self.gain_alpha * (target_gain - self.gain_state);

            let wet = self.smoothed_dry_wet;
            output[i] = (1.0 - wet) * input[i] + wet * (input[i] * self.gain_state);
        }
    }

    fn set_param(&mut self, param_id: u32, value: f32) {
        match param_id {
            PARAM_THRESHOLD_DB => self.threshold_db = value.clamp(-60.0, 0.0),
            PARAM_FREQ_HZ => {
                let freq = value.clamp(2000.0, 16000.0);
                if (freq - self.last_freq).abs() > 0.5 {
                    self.sidechain.set_coeffs(highpass(freq, 0.707, self.sample_rate));
                    self.last_freq = freq;
                }
            }
            PARAM_RATIO => self.ratio = value.clamp(2.0, 20.0),
            PARAM_RELEASE_MS => {
                self.envelope = EnvelopeFollower::new(self.sample_rate, ATTACK_MS, value.clamp(5.0, 200.0));
            }
            PARAM_LISTEN  => self.listen = value >= 0.5,
            PARAM_DRY_WET => self.target_dry_wet = value.clamp(0.0, 1.0),
            _ => {}
        }
    }

    fn reset(&mut self) {
        self.sidechain.reset();
        self.envelope = EnvelopeFollower::new(self.sample_rate, ATTACK_MS, 40.0);
        self.gain_state = 1.0;
        self.smoothed_dry_wet = self.target_dry_wet;
    }

    fn get_meter(&self, meter_id: u32) -> f32 {
        // meter 0 = current gain reduction in dB (negative when reducing).
        if meter_id == 0 {
            lin_to_db(self.gain_state)
        } else {
            0.0
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn no_reduction_below_threshold() {
        let sr = 48_000.0;
        let mut de = DeEsser::new(sr);
        de.set_param(PARAM_THRESHOLD_DB, 0.0); // threshold at 0 dBFS
        de.set_param(PARAM_DRY_WET, 1.0);
        de.reset();

        // Low-level signal — should not trigger.
        let input = vec![0.01_f32; 4096];
        let mut output = vec![0.0_f32; 4096];
        de.process(&input, &mut output);

        // Output should be essentially identical to input.
        let max_diff: f32 = input.iter().zip(output.iter()).map(|(a, b)| (a - b).abs()).fold(0.0, f32::max);
        assert!(max_diff < 0.01, "unexpected gain reduction: max_diff={max_diff}");
    }

    #[test]
    fn reduction_above_threshold() {
        let sr = 48_000.0;
        let mut de = DeEsser::new(sr);
        de.set_param(PARAM_THRESHOLD_DB, -40.0); // very sensitive
        de.set_param(PARAM_FREQ_HZ, 1000.0);     // HPF at 1 kHz
        de.set_param(PARAM_DRY_WET, 1.0);
        de.reset();

        // Loud 5 kHz sine — above HPF cutoff and above threshold.
        let input: Vec<f32> = (0..8192)
            .map(|i| ((2.0 * core::f32::consts::PI * 5000.0 * i as f32) / sr).sin() * 0.9)
            .collect();
        let mut output = vec![0.0_f32; 8192];
        de.process(&input, &mut output);

        // After settling, output should be quieter than input.
        let in_rms: f32 = (input[4096..].iter().map(|s| s * s).sum::<f32>() / 4096.0).sqrt();
        let out_rms: f32 = (output[4096..].iter().map(|s| s * s).sum::<f32>() / 4096.0).sqrt();
        assert!(out_rms < in_rms * 0.9, "expected gain reduction, in_rms={in_rms:.4} out_rms={out_rms:.4}");
    }

    #[test]
    fn no_nan_or_inf() {
        let sr = 48_000.0;
        let mut de = DeEsser::new(sr);
        let input: Vec<f32> = (0..8192).map(|i| ((i as f32) * 0.01).sin()).collect();
        let mut output = vec![0.0_f32; 8192];
        de.process(&input, &mut output);
        for &s in &output {
            assert!(s.is_finite(), "NaN or Inf in de-esser output");
        }
    }
}
