//! Phaser: series of first-order all-pass stages modulated by an LFO.
//!
//! The LFO sweeps the all-pass cutoff frequency, creating moving phase-shift
//! notches when the processed signal is mixed back with the dry signal.
//! A feedback path from the last stage back to the input deepens the notches.
//!
//! All parameters are smoothed with a 5 ms one-pole filter.

use super::Effect;
use crate::utils::math::{flush_denormal, smoothing_alpha};
use core::f32::consts::{PI, TAU};

pub const PARAM_RATE: u32      = 0; // LFO Hz, 0.05–5.0, default 0.5
pub const PARAM_DEPTH: u32     = 1; // 0–1, default 0.7
pub const PARAM_CENTER_HZ: u32 = 2; // 100–4000 Hz, default 1200
pub const PARAM_FEEDBACK: u32  = 3; // -0.95–0.95, default 0.5
pub const PARAM_STAGES: u32    = 4; // 2, 4, 6, 8 (float), default 4
pub const PARAM_DRY_WET: u32   = 5; // 0–1, default 0.5

const MAX_STAGES: usize = 8;
const SMOOTH_TIME_SEC: f32 = 0.005;

/// First-order all-pass: H(z) = (a + z⁻¹) / (1 + a·z⁻¹)
/// where a = (tan(π·fc/sr) − 1) / (tan(π·fc/sr) + 1)
#[derive(Default, Clone, Copy)]
struct AllpassStage {
    x_prev: f32,
    y_prev: f32,
}

impl AllpassStage {
    #[inline]
    fn process(&mut self, x: f32, coeff: f32) -> f32 {
        let y = coeff * x + self.x_prev - coeff * self.y_prev;
        self.x_prev = x;
        self.y_prev = flush_denormal(y);
        y
    }

    fn reset(&mut self) {
        self.x_prev = 0.0;
        self.y_prev = 0.0;
    }
}

pub struct Phaser {
    sample_rate: f32,
    stages: [AllpassStage; MAX_STAGES],
    lfo_phase: f32,
    last_stage_out: f32,

    target_rate: f32,
    smoothed_rate: f32,
    target_depth: f32,
    smoothed_depth: f32,
    target_center: f32,
    smoothed_center: f32,
    target_feedback: f32,
    smoothed_feedback: f32,
    target_stages: f32,
    target_dry_wet: f32,
    smoothed_dry_wet: f32,

    smoother_alpha: f32,
}

impl Phaser {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate,
            stages: [AllpassStage::default(); MAX_STAGES],
            lfo_phase: 0.0,
            last_stage_out: 0.0,

            target_rate: 0.5,
            smoothed_rate: 0.5,
            target_depth: 0.7,
            smoothed_depth: 0.7,
            target_center: 1200.0,
            smoothed_center: 1200.0,
            target_feedback: 0.5,
            smoothed_feedback: 0.5,
            target_stages: 4.0,
            target_dry_wet: 0.5,
            smoothed_dry_wet: 0.5,

            smoother_alpha: smoothing_alpha(SMOOTH_TIME_SEC, sample_rate),
        }
    }
}

impl Effect for Phaser {
    fn process(&mut self, input: &[f32], output: &mut [f32]) {
        let n = input.len().min(output.len());
        let sr = self.sample_rate;
        let alpha = self.smoother_alpha;
        let num_stages = (self.target_stages.round() as usize).clamp(2, MAX_STAGES);

        for i in 0..n {
            self.smoothed_rate     += alpha * (self.target_rate     - self.smoothed_rate);
            self.smoothed_depth    += alpha * (self.target_depth    - self.smoothed_depth);
            self.smoothed_center   += alpha * (self.target_center   - self.smoothed_center);
            self.smoothed_feedback += alpha * (self.target_feedback - self.smoothed_feedback);
            self.smoothed_dry_wet  += alpha * (self.target_dry_wet  - self.smoothed_dry_wet);

            // Advance LFO.
            self.lfo_phase += TAU * self.smoothed_rate / sr;
            if self.lfo_phase >= TAU {
                self.lfo_phase -= TAU;
            }

            // Modulate cutoff: center ± depth*center (log-scale feels more musical).
            let lfo = self.lfo_phase.sin();
            let fc = (self.smoothed_center
                * (1.0 + self.smoothed_depth * 0.9 * lfo))
                .clamp(20.0, sr * 0.49);

            let t = (PI * fc / sr).tan();
            let coeff = (t - 1.0) / (t + 1.0);

            // Apply feedback from last stage.
            let x_fb = flush_denormal(input[i] + self.smoothed_feedback * self.last_stage_out);

            // Cascade N all-pass stages.
            let mut sig = x_fb;
            for stage in self.stages[..num_stages].iter_mut() {
                sig = stage.process(sig, coeff);
            }
            self.last_stage_out = flush_denormal(sig);

            let wet = self.smoothed_dry_wet;
            output[i] = (1.0 - wet) * input[i] + wet * sig;
        }
    }

    fn set_param(&mut self, param_id: u32, value: f32) {
        match param_id {
            PARAM_RATE      => self.target_rate     = value.clamp(0.05, 5.0),
            PARAM_DEPTH     => self.target_depth    = value.clamp(0.0, 1.0),
            PARAM_CENTER_HZ => self.target_center   = value.clamp(100.0, 4000.0),
            PARAM_FEEDBACK  => self.target_feedback = value.clamp(-0.95, 0.95),
            PARAM_STAGES    => self.target_stages   = value.clamp(2.0, 8.0),
            PARAM_DRY_WET   => self.target_dry_wet  = value.clamp(0.0, 1.0),
            _ => {}
        }
    }

    fn reset(&mut self) {
        for s in self.stages.iter_mut() {
            s.reset();
        }
        self.lfo_phase = 0.0;
        self.last_stage_out = 0.0;
        self.smoothed_rate     = self.target_rate;
        self.smoothed_depth    = self.target_depth;
        self.smoothed_center   = self.target_center;
        self.smoothed_feedback = self.target_feedback;
        self.smoothed_dry_wet  = self.target_dry_wet;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dry_wet_zero_passes_through() {
        let sr = 48_000.0;
        let mut ph = Phaser::new(sr);
        ph.set_param(PARAM_DRY_WET, 0.0);
        ph.reset();

        let input: Vec<f32> = (0..256).map(|i| (i as f32) * 0.001).collect();
        let mut output = vec![0.0_f32; 256];
        ph.process(&input, &mut output);

        for i in 0..256 {
            assert!(
                (output[i] - input[i]).abs() < 1e-4,
                "i={i}: output={} input={}",
                output[i],
                input[i]
            );
        }
    }

    #[test]
    fn wet_signal_is_not_silence() {
        let sr = 48_000.0;
        let mut ph = Phaser::new(sr);
        ph.set_param(PARAM_DRY_WET, 1.0);
        ph.set_param(PARAM_FEEDBACK, 0.0);
        ph.reset();

        let input = vec![0.5_f32; 4096];
        let mut output = vec![0.0_f32; 4096];
        ph.process(&input, &mut output);

        let energy: f32 = output[128..].iter().map(|s| s * s).sum();
        assert!(energy > 0.0, "expected non-zero wet output");
    }

    #[test]
    fn no_nan_or_inf() {
        let sr = 48_000.0;
        let mut ph = Phaser::new(sr);
        ph.set_param(PARAM_FEEDBACK, 0.9);
        ph.set_param(PARAM_STAGES, 8.0);

        let input: Vec<f32> = (0..8192).map(|i| ((i as f32) * 0.01).sin() * 0.8).collect();
        let mut output = vec![0.0_f32; 8192];
        ph.process(&input, &mut output);

        for &s in &output {
            assert!(s.is_finite(), "NaN or Inf in phaser output");
        }
    }
}
