//! Linear gain stage with optional phase inversion and dry/wet blend.
//!
//! Although gain is mathematically just a multiply, this implementation
//! demonstrates the patterns reused by every other effect:
//!   - Parameters are smoothed (one-pole) to avoid zipper noise.
//!   - Coefficients are recomputed only on `set_param`, never per sample.

use super::Effect;
use crate::utils::math::{db_to_lin, smoothing_alpha};

/// Param IDs (kept in sync with the TS `GainParams` table).
pub const PARAM_GAIN_DB: u32 = 0;
pub const PARAM_PHASE_INVERT: u32 = 1;  // 0 = off, ≥0.5 = on
pub const PARAM_DRY_WET: u32 = 2;       // 0..1

const SMOOTH_TIME_SEC: f32 = 0.003;     // 3 ms — fast & click-free for typical changes

pub struct Gain {
    /// Target linear gain after dB conversion + phase invert sign.
    target_gain: f32,
    /// Smoothed gain (the value actually applied per sample).
    smoothed_gain: f32,
    /// Smoothed dry/wet (0 = dry, 1 = wet).
    target_dry_wet: f32,
    smoothed_dry_wet: f32,

    phase_invert: bool,
    /// One-pole smoothing factor.
    alpha: f32,
}

impl Gain {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            target_gain: 1.0,
            smoothed_gain: 1.0,
            target_dry_wet: 1.0,
            smoothed_dry_wet: 1.0,
            phase_invert: false,
            alpha: smoothing_alpha(SMOOTH_TIME_SEC, sample_rate),
        }
    }

}

impl Effect for Gain {
    fn process(&mut self, input: &[f32], output: &mut [f32]) {
        let n = input.len().min(output.len());
        let alpha = self.alpha;
        for i in 0..n {
            self.smoothed_gain += alpha * (self.target_gain - self.smoothed_gain);
            self.smoothed_dry_wet += alpha * (self.target_dry_wet - self.smoothed_dry_wet);
            let dry = input[i];
            let wet = dry * self.smoothed_gain;
            output[i] = dry * (1.0 - self.smoothed_dry_wet) + wet * self.smoothed_dry_wet;
        }
    }

    fn set_param(&mut self, param_id: u32, value: f32) {
        match param_id {
            PARAM_GAIN_DB => {
                let db = value.clamp(-60.0, 24.0);
                // We don't store gain_db — recompute target from current sign.
                let lin = db_to_lin(db);
                self.target_gain = if self.phase_invert { -lin } else { lin };
            }
            PARAM_PHASE_INVERT => {
                self.phase_invert = value >= 0.5;
                // Re-apply sign without changing magnitude.
                let mag = self.target_gain.abs();
                self.target_gain = if self.phase_invert { -mag } else { mag };
            }
            PARAM_DRY_WET => {
                self.target_dry_wet = value.clamp(0.0, 1.0);
            }
            _ => {}
        }
    }

    fn reset(&mut self) {
        self.smoothed_gain = self.target_gain;
        self.smoothed_dry_wet = self.target_dry_wet;
    }

    // Helper just for the test below, doesn't need to be in the trait.
}

// Avoid unused warning on the constants when the test module is excluded.
#[allow(dead_code)]
impl Gain {
    fn _ignore() {
        let _ = (PARAM_GAIN_DB, PARAM_PHASE_INVERT, PARAM_DRY_WET);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rms(buf: &[f32]) -> f32 {
        if buf.is_empty() { return 0.0 }
        let s: f32 = buf.iter().map(|x| x * x).sum();
        (s / buf.len() as f32).sqrt()
    }

    #[test]
    fn unity_gain_passes_through_after_settling() {
        let mut g = Gain::new(48_000.0);
        // Start at unity (default), force settled.
        g.reset();
        let input: Vec<f32> = (0..256).map(|i| (i as f32 * 0.01).sin()).collect();
        let mut output = vec![0.0_f32; 256];
        g.process(&input, &mut output);
        // After ~10ms ramp, output should match input closely. Use the tail.
        let tail_in = &input[200..];
        let tail_out = &output[200..];
        let r_in = rms(tail_in);
        let r_out = rms(tail_out);
        assert!((r_in - r_out).abs() < 1e-3, "rms diff: in={} out={}", r_in, r_out);
    }

    #[test]
    fn minus_six_db_halves_amplitude() {
        let mut g = Gain::new(48_000.0);
        g.set_param(PARAM_GAIN_DB, -6.0206);
        g.reset();
        let input = vec![1.0_f32; 1024];
        let mut output = vec![0.0_f32; 1024];
        g.process(&input, &mut output);
        // Tail (settled).
        let tail_avg = output[800..].iter().sum::<f32>() / 224.0;
        assert!((tail_avg - 0.5).abs() < 1e-3, "expected ~0.5, got {}", tail_avg);
    }

    #[test]
    fn phase_invert_negates_signal() {
        let mut g = Gain::new(48_000.0);
        g.set_param(PARAM_PHASE_INVERT, 1.0);
        g.reset();
        let input = vec![0.5_f32; 512];
        let mut output = vec![0.0_f32; 512];
        g.process(&input, &mut output);
        let tail_avg = output[400..].iter().sum::<f32>() / 112.0;
        assert!((tail_avg - (-0.5)).abs() < 1e-3, "expected ~-0.5, got {}", tail_avg);
    }

    #[test]
    fn dry_wet_zero_means_dry() {
        let mut g = Gain::new(48_000.0);
        g.set_param(PARAM_GAIN_DB, -24.0); // strong cut, but bypassed by dry/wet=0
        g.set_param(PARAM_DRY_WET, 0.0);
        g.reset();
        let input = vec![1.0_f32; 256];
        let mut output = vec![0.0_f32; 256];
        g.process(&input, &mut output);
        let tail_avg = output[200..].iter().sum::<f32>() / 56.0;
        assert!((tail_avg - 1.0).abs() < 1e-3, "expected ~1.0, got {}", tail_avg);
    }
}
