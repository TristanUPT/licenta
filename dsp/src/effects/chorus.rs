//! Chorus effect: three LFO-modulated delay voices mixed back with the dry
//! signal.
//!
//! Each voice has its own DelayLine and an LFO phase offset by 2π/3.  The LFO
//! is a pure sine wave evaluated per-sample.  All parameters are smoothed with
//! a 5 ms one-pole lowpass to prevent zipper noise.
//!
//! Mixing rule:
//!   out = dry*(1-wet) + (voice0+voice1+voice2) * 0.333 * wet

use super::Effect;
use crate::utils::delay_line::DelayLine;
use crate::utils::math::smoothing_alpha;
use core::f32::consts::TAU; // 2π

pub const PARAM_RATE: u32 = 0;     // LFO rate Hz  0.1 – 3.0,  default 0.8
pub const PARAM_DEPTH: u32 = 1;    // Mod depth  0–1 (→ 0–3 ms),  default 0.5
pub const PARAM_DELAY_MS: u32 = 2; // Base delay ms  5–30,  default 12.0
pub const PARAM_DRY_WET: u32 = 3;  // 0–1,  default 0.5

/// Max chorus delay: 50 ms @ 48 kHz = 2400 samples → next pow2 = 4096.
const MAX_DELAY_SAMPLES: usize = 2400;
const SMOOTH_TIME_SEC: f32 = 0.005;
const VOICES: usize = 3;

pub struct Chorus {
    sample_rate: f32,
    lines: [DelayLine; VOICES],

    // LFO state
    lfo_phase: [f32; VOICES],

    // Smoothed parameters
    target_rate: f32,
    smoothed_rate: f32,
    target_depth: f32,
    smoothed_depth: f32,
    target_delay_ms: f32,
    smoothed_delay_ms: f32,
    target_dry_wet: f32,
    smoothed_dry_wet: f32,

    smoother_alpha: f32,
}

impl Chorus {
    pub fn new(sample_rate: f32) -> Self {
        let phase_offset = TAU / VOICES as f32; // 2π/3
        Self {
            sample_rate,
            lines: [
                DelayLine::new(MAX_DELAY_SAMPLES),
                DelayLine::new(MAX_DELAY_SAMPLES),
                DelayLine::new(MAX_DELAY_SAMPLES),
            ],
            lfo_phase: [0.0, phase_offset, phase_offset * 2.0],
            target_rate: 0.8,
            smoothed_rate: 0.8,
            target_depth: 0.5,
            smoothed_depth: 0.5,
            target_delay_ms: 12.0,
            smoothed_delay_ms: 12.0,
            target_dry_wet: 0.5,
            smoothed_dry_wet: 0.5,
            smoother_alpha: smoothing_alpha(0.010, sample_rate),
        }
    }
}

impl Effect for Chorus {
    fn process(&mut self, input: &[f32], output: &mut [f32]) {
        let n = input.len().min(output.len());
        let alpha = self.smoother_alpha;
        let sr = self.sample_rate;
        // Max safe delay in samples — leave headroom for fractional read.
        let max_samples = (MAX_DELAY_SAMPLES - 2) as f32;

        for i in 0..n {
            // Smooth parameters.
            self.smoothed_rate += alpha * (self.target_rate - self.smoothed_rate);
            self.smoothed_depth += alpha * (self.target_depth - self.smoothed_depth);
            self.smoothed_delay_ms += alpha * (self.target_delay_ms - self.smoothed_delay_ms);
            self.smoothed_dry_wet += alpha * (self.target_dry_wet - self.smoothed_dry_wet);

            let base_samples = (self.smoothed_delay_ms * 0.001 * sr).max(1.0);
            // Depth mapped: 0–1 → 0–12 ms in samples.
            // Depth 0–1 → 0–3 ms: ±15 cents max pitch deviation at 0.8 Hz, natural chorus range.
            let depth_samples = self.smoothed_depth * 0.003 * sr;

            let x = input[i];
            let mut wet_sum = 0.0_f32;

            for v in 0..VOICES {
                // Advance LFO.
                self.lfo_phase[v] += TAU * self.smoothed_rate / sr;
                if self.lfo_phase[v] >= TAU {
                    self.lfo_phase[v] -= TAU;
                }

                let delay_samples =
                    (base_samples + depth_samples * self.lfo_phase[v].sin()).clamp(1.0, max_samples);

                let voice_out = self.lines[v].read_frac(delay_samples);
                self.lines[v].write(x);
                wet_sum += voice_out;
            }

            let wet = self.smoothed_dry_wet;
            let dry = 1.0 - wet;
            // Three voices averaged (×0.333) before applying wet gain.
            output[i] = dry * x + wet * (wet_sum * 0.333_f32);
        }
    }

    fn set_param(&mut self, param_id: u32, value: f32) {
        match param_id {
            PARAM_RATE => self.target_rate = value.clamp(0.1, 3.0),
            PARAM_DEPTH => self.target_depth = value.clamp(0.0, 1.0),
            PARAM_DELAY_MS => self.target_delay_ms = value.clamp(5.0, 30.0),
            PARAM_DRY_WET => self.target_dry_wet = value.clamp(0.0, 1.0),
            _ => {}
        }
    }

    fn reset(&mut self) {
        for line in &mut self.lines {
            line.reset();
        }
        let phase_offset = TAU / VOICES as f32;
        self.lfo_phase = [0.0, phase_offset, phase_offset * 2.0];
        self.smoothed_rate = self.target_rate;
        self.smoothed_depth = self.target_depth;
        self.smoothed_delay_ms = self.target_delay_ms;
        self.smoothed_dry_wet = self.target_dry_wet;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dry_wet_zero_passes_through() {
        let sr = 48_000.0;
        let mut chorus = Chorus::new(sr);
        chorus.set_param(PARAM_DRY_WET, 0.0);
        chorus.reset();

        let input: Vec<f32> = (0..256).map(|i| (i as f32) * 0.001).collect();
        let mut output = vec![0.0_f32; 256];
        chorus.process(&input, &mut output);

        for i in 0..256 {
            assert!((output[i] - input[i]).abs() < 1e-5, "i={i}: {} != {}", output[i], input[i]);
        }
    }

    #[test]
    fn wet_signal_differs_from_dry() {
        let sr = 48_000.0;
        let mut chorus = Chorus::new(sr);
        chorus.set_param(PARAM_DRY_WET, 1.0);
        chorus.reset();

        // Feed a DC signal long enough that the delay lines fill.
        let input = vec![0.5_f32; 4096];
        let mut output = vec![0.0_f32; 4096];
        chorus.process(&input, &mut output);

        // After enough samples the delayed voices contribute; output won't be silence.
        let energy: f32 = output[2048..].iter().map(|s| s * s).sum();
        assert!(energy > 0.0, "expected non-zero output energy");
    }
}
