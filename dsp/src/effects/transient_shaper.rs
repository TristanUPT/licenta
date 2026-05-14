//! Transient shaper: independently controls the attack and sustain portions.
//!
//! Two envelope followers with different time constants detect the signal envelope:
//!   - Fast (E1): 1 ms attack, 30 ms release  → captures transients
//!   - Slow (E2): 10 ms attack, 150 ms release → captures sustained body
//!
//! Transient portion ≈ (E1 − E2) / E1  (clamped to [0, 1])
//! Sustain  portion ≈ 1 − transient
//!
//! The output gain in dB is a weighted mix of the attack and sustain gain
//! parameters, then smoothed (1 ms one-pole) to prevent clicks.

use super::Effect;
use crate::utils::math::{db_to_lin, flush_denormal, smoothing_alpha};

pub const PARAM_ATTACK_GAIN_DB: u32  = 0; // -12–+12 dB, default 6
pub const PARAM_SUSTAIN_GAIN_DB: u32 = 1; // -12–+12 dB, default 0
pub const PARAM_SENSITIVITY: u32     = 2; // 0–1, default 0.5
pub const PARAM_DRY_WET: u32         = 3; // 0–1, default 1

const SMOOTH_TIME_SEC: f32 = 0.005;
const GAIN_SMOOTH_SEC: f32 = 0.001;

pub struct TransientShaper {
    sample_rate: f32,

    env_fast: f32,
    env_slow: f32,
    gain_state: f32,

    target_attack_db: f32,
    smoothed_attack_db: f32,
    target_sustain_db: f32,
    smoothed_sustain_db: f32,
    target_sensitivity: f32,
    smoothed_sensitivity: f32,
    target_dry_wet: f32,
    smoothed_dry_wet: f32,

    param_alpha: f32,
    gain_alpha: f32,
}

impl TransientShaper {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate,
            env_fast: 0.0,
            env_slow: 0.0,
            gain_state: 1.0,

            target_attack_db: 6.0,
            smoothed_attack_db: 6.0,
            target_sustain_db: 0.0,
            smoothed_sustain_db: 0.0,
            target_sensitivity: 0.5,
            smoothed_sensitivity: 0.5,
            target_dry_wet: 1.0,
            smoothed_dry_wet: 1.0,

            param_alpha: smoothing_alpha(SMOOTH_TIME_SEC, sample_rate),
            gain_alpha: smoothing_alpha(GAIN_SMOOTH_SEC, sample_rate),
        }
    }
}

impl Effect for TransientShaper {
    fn process(&mut self, input: &[f32], output: &mut [f32]) {
        let n = input.len().min(output.len());
        let alpha = self.param_alpha;
        let sr = self.sample_rate;

        for i in 0..n {
            self.smoothed_attack_db   += alpha * (self.target_attack_db   - self.smoothed_attack_db);
            self.smoothed_sustain_db  += alpha * (self.target_sustain_db  - self.smoothed_sustain_db);
            self.smoothed_sensitivity += alpha * (self.target_sensitivity - self.smoothed_sensitivity);
            self.smoothed_dry_wet     += alpha * (self.target_dry_wet     - self.smoothed_dry_wet);

            // Sensitivity 0–1 → time-constant scale 10×–0.1× (inverted so higher = faster)
            let sens = self.smoothed_sensitivity.clamp(0.0, 1.0);
            let time_scale = 10.0_f32.powf(1.0 - 2.0 * sens); // 10 at 0, 0.1 at 1

            let fast_atk = smoothing_alpha(0.001 * time_scale, sr);
            let fast_rel = smoothing_alpha(0.030 * time_scale, sr);
            let slow_atk = smoothing_alpha(0.010 * time_scale, sr);
            let slow_rel = smoothing_alpha(0.150 * time_scale, sr);

            let abs_in = input[i].abs();

            if abs_in > self.env_fast {
                self.env_fast += fast_atk * (abs_in - self.env_fast);
            } else {
                self.env_fast += fast_rel * (abs_in - self.env_fast);
            }
            self.env_fast = flush_denormal(self.env_fast);

            if abs_in > self.env_slow {
                self.env_slow += slow_atk * (abs_in - self.env_slow);
            } else {
                self.env_slow += slow_rel * (abs_in - self.env_slow);
            }
            self.env_slow = flush_denormal(self.env_slow);

            // Decompose into transient / sustain fractions (sum to 1).
            let total = self.env_fast.max(1e-9);
            let transient_f = ((self.env_fast - self.env_slow) / total).clamp(0.0, 1.0);
            let sustain_f   = 1.0 - transient_f;

            // Weighted gain.
            let gain_db = self.smoothed_attack_db  * transient_f
                        + self.smoothed_sustain_db * sustain_f;
            let target_gain = db_to_lin(gain_db);

            // Smooth the gain to avoid clicks.
            self.gain_state += self.gain_alpha * (target_gain - self.gain_state);

            let wet = self.smoothed_dry_wet;
            let processed = input[i] * self.gain_state;
            output[i] = (1.0 - wet) * input[i] + wet * processed;
        }
    }

    fn set_param(&mut self, param_id: u32, value: f32) {
        match param_id {
            PARAM_ATTACK_GAIN_DB  => self.target_attack_db  = value.clamp(-12.0, 12.0),
            PARAM_SUSTAIN_GAIN_DB => self.target_sustain_db = value.clamp(-12.0, 12.0),
            PARAM_SENSITIVITY     => self.target_sensitivity = value.clamp(0.0, 1.0),
            PARAM_DRY_WET         => self.target_dry_wet    = value.clamp(0.0, 1.0),
            _ => {}
        }
    }

    fn reset(&mut self) {
        self.env_fast = 0.0;
        self.env_slow = 0.0;
        self.gain_state = 1.0;
        self.smoothed_attack_db   = self.target_attack_db;
        self.smoothed_sustain_db  = self.target_sustain_db;
        self.smoothed_sensitivity = self.target_sensitivity;
        self.smoothed_dry_wet     = self.target_dry_wet;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unity_gain_at_zero_db() {
        let sr = 48_000.0;
        let mut ts = TransientShaper::new(sr);
        ts.set_param(PARAM_ATTACK_GAIN_DB, 0.0);
        ts.set_param(PARAM_SUSTAIN_GAIN_DB, 0.0);
        ts.set_param(PARAM_DRY_WET, 1.0);
        ts.reset();

        let input = vec![0.5_f32; 8192];
        let mut output = vec![0.0_f32; 8192];
        ts.process(&input, &mut output);

        // After settling, output ≈ input * db_to_lin(0) = input.
        for &s in &output[4096..] {
            assert!((s - 0.5).abs() < 1e-3, "expected ~0.5, got {s}");
        }
    }

    #[test]
    fn no_nan_or_inf() {
        let sr = 48_000.0;
        let mut ts = TransientShaper::new(sr);
        ts.set_param(PARAM_ATTACK_GAIN_DB, 12.0);
        ts.set_param(PARAM_SUSTAIN_GAIN_DB, -12.0);

        let input: Vec<f32> = (0..8192).map(|i| ((i as f32) * 0.1).sin() * 0.9).collect();
        let mut output = vec![0.0_f32; 8192];
        ts.process(&input, &mut output);

        for &s in &output {
            assert!(s.is_finite(), "NaN or Inf in transient shaper output");
        }
    }
}
