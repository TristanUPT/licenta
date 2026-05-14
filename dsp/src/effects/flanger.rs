//! Flanger effect: single LFO-modulated short delay with feedback.
//!
//! The classic comb-filtering "jet" sound comes from mixing the dry signal
//! with a very short (0–5 ms modulated around a 2 ms base) delayed copy plus
//! a feedback path that recirculates the delayed output.
//!
//! Pipeline per sample:
//!   1. Read delayed sample.
//!   2. Write (input + feedback * delayed) to the delay line.
//!   3. Output = dry*(1-wet) + delayed*wet.
//!
//! All parameters are smoothed with a 5 ms one-pole lowpass.

use super::Effect;
use crate::utils::delay_line::DelayLine;
use crate::utils::math::smoothing_alpha;
use core::f32::consts::TAU;

pub const PARAM_RATE: u32 = 0;     // LFO Hz  0.05 – 5.0,  default 0.5
pub const PARAM_DEPTH: u32 = 1;    // 0–1 (→ 0–5 ms),  default 0.7
pub const PARAM_FEEDBACK: u32 = 2; // -0.95 – 0.95,  default 0.5
pub const PARAM_DRY_WET: u32 = 3;  // 0–1,  default 0.5

/// Max delay: 15 ms @ 48 kHz = 720 samples → next pow2 = 1024.
const MAX_DELAY_SAMPLES: usize = 720;
const BASE_DELAY_MS: f32 = 2.0;
const SMOOTH_TIME_SEC: f32 = 0.005;

pub struct Flanger {
    sample_rate: f32,
    line: DelayLine,
    lfo_phase: f32,

    target_rate: f32,
    smoothed_rate: f32,
    target_depth: f32,
    smoothed_depth: f32,
    target_feedback: f32,
    smoothed_feedback: f32,
    target_dry_wet: f32,
    smoothed_dry_wet: f32,

    smoother_alpha: f32,
}

impl Flanger {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate,
            line: DelayLine::new(MAX_DELAY_SAMPLES),
            lfo_phase: 0.0,
            target_rate: 0.5,
            smoothed_rate: 0.5,
            target_depth: 0.7,
            smoothed_depth: 0.7,
            target_feedback: 0.5,
            smoothed_feedback: 0.5,
            target_dry_wet: 0.5,
            smoothed_dry_wet: 0.5,
            smoother_alpha: smoothing_alpha(SMOOTH_TIME_SEC, sample_rate),
        }
    }
}

impl Effect for Flanger {
    fn process(&mut self, input: &[f32], output: &mut [f32]) {
        let n = input.len().min(output.len());
        let alpha = self.smoother_alpha;
        let sr = self.sample_rate;
        let max_samples = (MAX_DELAY_SAMPLES - 2) as f32;

        let base_samples = BASE_DELAY_MS * 0.001 * sr;

        for i in 0..n {
            // Smooth parameters.
            self.smoothed_rate += alpha * (self.target_rate - self.smoothed_rate);
            self.smoothed_depth += alpha * (self.target_depth - self.smoothed_depth);
            self.smoothed_feedback += alpha * (self.target_feedback - self.smoothed_feedback);
            self.smoothed_dry_wet += alpha * (self.target_dry_wet - self.smoothed_dry_wet);

            // Advance LFO.
            self.lfo_phase += TAU * self.smoothed_rate / sr;
            if self.lfo_phase >= TAU {
                self.lfo_phase -= TAU;
            }

            // Depth: 0–1 → 0–5 ms in samples.
            let depth_samples = self.smoothed_depth * 0.005 * sr;
            let delay_samples =
                (base_samples + depth_samples * self.lfo_phase.sin()).clamp(1.0, max_samples);

            let delayed = self.line.read_frac(delay_samples);
            // Write back with feedback.
            let write_val = input[i] + self.smoothed_feedback * delayed;
            self.line.write(write_val);

            let wet = self.smoothed_dry_wet;
            output[i] = (1.0 - wet) * input[i] + wet * delayed;
        }
    }

    fn set_param(&mut self, param_id: u32, value: f32) {
        match param_id {
            PARAM_RATE => self.target_rate = value.clamp(0.05, 5.0),
            PARAM_DEPTH => self.target_depth = value.clamp(0.0, 1.0),
            PARAM_FEEDBACK => self.target_feedback = value.clamp(-0.95, 0.95),
            PARAM_DRY_WET => self.target_dry_wet = value.clamp(0.0, 1.0),
            _ => {}
        }
    }

    fn reset(&mut self) {
        self.line.reset();
        self.lfo_phase = 0.0;
        self.smoothed_rate = self.target_rate;
        self.smoothed_depth = self.target_depth;
        self.smoothed_feedback = self.target_feedback;
        self.smoothed_dry_wet = self.target_dry_wet;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dry_wet_zero_passes_through() {
        let sr = 48_000.0;
        let mut flanger = Flanger::new(sr);
        flanger.set_param(PARAM_DRY_WET, 0.0);
        flanger.reset();

        let input: Vec<f32> = (0..256).map(|i| (i as f32) * 0.001).collect();
        let mut output = vec![0.0_f32; 256];
        flanger.process(&input, &mut output);

        for i in 0..256 {
            assert!(
                (output[i] - input[i]).abs() < 1e-5,
                "i={i}: {} != {}",
                output[i],
                input[i]
            );
        }
    }

    #[test]
    fn output_is_not_silence_with_wet() {
        let sr = 48_000.0;
        let mut flanger = Flanger::new(sr);
        flanger.set_param(PARAM_DRY_WET, 1.0);
        flanger.set_param(PARAM_FEEDBACK, 0.0);
        flanger.reset();

        let input = vec![0.5_f32; 4096];
        let mut output = vec![0.0_f32; 4096];
        flanger.process(&input, &mut output);

        let energy: f32 = output[1024..].iter().map(|s| s * s).sum();
        assert!(energy > 0.0, "expected non-zero wet output");
    }
}
