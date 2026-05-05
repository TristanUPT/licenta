//! Feed-forward dynamic range compressor.
//!
//! Pipeline:
//!   sidechain → envelope follower → gain computer → makeup → dry/wet mix
//!
//! Soft-knee implementation follows DAFX (Reiss & McPherson, ch. 6) — the
//! classical formula:
//!
//!   for x_db near threshold T with knee width W:
//!     - x_db <= T - W/2  →  no reduction
//!     - x_db >= T + W/2  →  full ratio reduction
//!     - in between        →  parabolic interpolation
//!
//! Gain reduction is exposed via `last_gain_reduction_db()` for metering.

use super::Effect;
use crate::utils::envelope::EnvelopeFollower;
use crate::utils::filters::{highpass, Biquad, BiquadCoeffs};
use crate::utils::math::{db_to_lin, lin_to_db, smoothing_alpha};

pub const PARAM_THRESHOLD_DB: u32 = 0;
pub const PARAM_RATIO: u32 = 1;
pub const PARAM_ATTACK_MS: u32 = 2;
pub const PARAM_RELEASE_MS: u32 = 3;
pub const PARAM_KNEE_DB: u32 = 4;
pub const PARAM_MAKEUP_DB: u32 = 5;
pub const PARAM_SIDECHAIN_HPF_HZ: u32 = 6;
pub const PARAM_DRY_WET: u32 = 7;

const SMOOTH_TIME_SEC: f32 = 0.005;

pub struct Compressor {
    sample_rate: f32,

    // Targets (set from messages)
    threshold_db: f32,
    ratio: f32,
    knee_db: f32,
    target_makeup_lin: f32,
    target_dry_wet: f32,

    // Smoothed runtime values
    smoothed_makeup_lin: f32,
    smoothed_dry_wet: f32,
    smoother_alpha: f32,

    envelope: EnvelopeFollower,
    sidechain: Biquad,

    /// Last gain reduction in dB (signed, negative when reducing).
    /// Updated each block; main thread can read for metering (Phase 4).
    last_gr_db: f32,
}

impl Compressor {
    pub fn new(sample_rate: f32) -> Self {
        let mut sidechain = Biquad::new(BiquadCoeffs::PASSTHROUGH);
        // Default sidechain HPF at 80 Hz, Q≈0.707.
        sidechain.set_coeffs(highpass(80.0, 0.707, sample_rate));

        Self {
            sample_rate,
            threshold_db: -18.0,
            ratio: 4.0,
            knee_db: 6.0,
            target_makeup_lin: 1.0,
            target_dry_wet: 1.0,
            smoothed_makeup_lin: 1.0,
            smoothed_dry_wet: 1.0,
            smoother_alpha: smoothing_alpha(SMOOTH_TIME_SEC, sample_rate),
            envelope: EnvelopeFollower::new(sample_rate, 10.0, 100.0),
            sidechain,
            last_gr_db: 0.0,
        }
    }

    pub fn last_gain_reduction_db(&self) -> f32 {
        self.last_gr_db
    }

    /// Compute the per-sample gain reduction (in dB, ≤ 0).
    /// `level_db` is the current envelope value in dB.
    fn gain_reduction_db(&self, level_db: f32) -> f32 {
        let t = self.threshold_db;
        let w = self.knee_db.max(0.0);
        let r = self.ratio.max(1.0);

        let above = level_db - t;
        if w > 0.0 && above > -w * 0.5 && above < w * 0.5 {
            // Soft knee: quadratic interpolation.
            let x = above + w * 0.5;
            // dB output offset relative to input (negative = reduction).
            -(1.0 - 1.0 / r) * (x * x) / (2.0 * w)
        } else if level_db > t {
            // Above the knee: full ratio reduction.
            -(level_db - t) * (1.0 - 1.0 / r)
        } else {
            0.0
        }
    }
}

impl Effect for Compressor {
    fn process(&mut self, input: &[f32], output: &mut [f32]) {
        let n = input.len().min(output.len());
        let alpha = self.smoother_alpha;
        let mut block_min_gr = 0.0_f32;

        for i in 0..n {
            // Sidechain detection signal (HPF removes rumble triggering).
            let sc = self.sidechain.process_sample(input[i]);
            let env = self.envelope.process_sample(sc);
            let env_db = lin_to_db(env);
            let gr_db = self.gain_reduction_db(env_db);
            let gr_lin = db_to_lin(gr_db);

            // Smooth makeup + dry/wet.
            self.smoothed_makeup_lin += alpha * (self.target_makeup_lin - self.smoothed_makeup_lin);
            self.smoothed_dry_wet += alpha * (self.target_dry_wet - self.smoothed_dry_wet);

            let dry = input[i];
            let wet = dry * gr_lin * self.smoothed_makeup_lin;
            output[i] = dry * (1.0 - self.smoothed_dry_wet) + wet * self.smoothed_dry_wet;

            if gr_db < block_min_gr {
                block_min_gr = gr_db;
            }
        }
        self.last_gr_db = block_min_gr;
    }

    fn set_param(&mut self, param_id: u32, value: f32) {
        match param_id {
            PARAM_THRESHOLD_DB => {
                self.threshold_db = value.clamp(-60.0, 0.0);
            }
            PARAM_RATIO => {
                self.ratio = value.clamp(1.0, 20.0);
            }
            PARAM_ATTACK_MS => {
                let ms = value.clamp(0.1, 200.0);
                self.envelope.set_attack_ms(ms);
            }
            PARAM_RELEASE_MS => {
                let ms = value.clamp(5.0, 1000.0);
                self.envelope.set_release_ms(ms);
            }
            PARAM_KNEE_DB => {
                self.knee_db = value.clamp(0.0, 24.0);
            }
            PARAM_MAKEUP_DB => {
                let db = value.clamp(0.0, 24.0);
                self.target_makeup_lin = db_to_lin(db);
            }
            PARAM_SIDECHAIN_HPF_HZ => {
                let f = value.clamp(20.0, 1000.0);
                self.sidechain.set_coeffs(highpass(f, 0.707, self.sample_rate));
            }
            PARAM_DRY_WET => {
                self.target_dry_wet = value.clamp(0.0, 1.0);
            }
            _ => {}
        }
    }

    fn reset(&mut self) {
        self.envelope.reset();
        self.sidechain.reset();
        self.smoothed_makeup_lin = self.target_makeup_lin;
        self.smoothed_dry_wet = self.target_dry_wet;
        self.last_gr_db = 0.0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use core::f32::consts::PI;

    /// Generate a sine, run it through the compressor, return output peak.
    fn run_sine(comp: &mut Compressor, hz: f32, amp: f32, secs: f32, sr: f32) -> Vec<f32> {
        let n = (sr * secs) as usize;
        let mut input = vec![0.0_f32; n];
        let mut output = vec![0.0_f32; n];
        for i in 0..n {
            input[i] = amp * (2.0 * PI * hz * i as f32 / sr).sin();
        }
        comp.process(&input, &mut output);
        output
    }

    #[test]
    fn compressor_attenuates_above_threshold() {
        let sr = 48_000.0;
        let mut comp = Compressor::new(sr);
        comp.set_param(PARAM_THRESHOLD_DB, -12.0);
        comp.set_param(PARAM_RATIO, 4.0);
        comp.set_param(PARAM_ATTACK_MS, 1.0);
        comp.set_param(PARAM_RELEASE_MS, 50.0);
        comp.set_param(PARAM_KNEE_DB, 0.0);
        comp.set_param(PARAM_MAKEUP_DB, 0.0);
        comp.set_param(PARAM_DRY_WET, 1.0);
        comp.reset();

        // Hot 1 kHz sine at -3 dBFS  → input ≈ 0.708 amplitude.
        let out = run_sine(&mut comp, 1000.0, 0.708, 0.5, sr);
        // Steady-state peak in last 100 ms.
        let tail = &out[(0.4 * sr as f32) as usize..];
        let peak = tail.iter().map(|s| s.abs()).fold(0.0_f32, f32::max);
        // Input was -3 dBFS. With T=-12, R=4, expected output:
        //   -3 dB > -12 dB by 9 dB → reduction = 9 * (1 - 1/4) = 6.75 dB.
        //   Output ≈ -3 - 6.75 = -9.75 dB ≈ 0.325 amplitude.
        let peak_db = 20.0 * peak.log10();
        assert!(
            (peak_db - (-9.75)).abs() < 1.5,
            "expected ~-9.75 dB, got {} dB",
            peak_db
        );
    }

    #[test]
    fn compressor_below_threshold_passes_through() {
        let sr = 48_000.0;
        let mut comp = Compressor::new(sr);
        comp.set_param(PARAM_THRESHOLD_DB, -12.0);
        comp.set_param(PARAM_RATIO, 8.0);
        comp.set_param(PARAM_KNEE_DB, 0.0);
        comp.set_param(PARAM_MAKEUP_DB, 0.0);
        comp.set_param(PARAM_DRY_WET, 1.0);
        comp.reset();

        // -24 dBFS sine, well below threshold.
        let out = run_sine(&mut comp, 1000.0, 0.063, 0.3, sr);
        let tail = &out[(0.2 * sr as f32) as usize..];
        let peak = tail.iter().map(|s| s.abs()).fold(0.0_f32, f32::max);
        let peak_db = 20.0 * peak.log10();
        assert!(
            (peak_db - (-24.0)).abs() < 1.0,
            "expected ~-24 dB (passthrough), got {} dB",
            peak_db
        );
    }

    #[test]
    fn dry_wet_zero_bypasses_processing() {
        let sr = 48_000.0;
        let mut comp = Compressor::new(sr);
        comp.set_param(PARAM_THRESHOLD_DB, -40.0);
        comp.set_param(PARAM_RATIO, 20.0);
        comp.set_param(PARAM_DRY_WET, 0.0);
        comp.reset();
        let out = run_sine(&mut comp, 1000.0, 0.5, 0.3, sr);
        let tail = &out[(0.2 * sr as f32) as usize..];
        let peak = tail.iter().map(|s| s.abs()).fold(0.0_f32, f32::max);
        // dry/wet = 0 → fully dry, peak ~0.5
        assert!((peak - 0.5).abs() < 0.05, "expected ~0.5 dry, got {}", peak);
    }
}
