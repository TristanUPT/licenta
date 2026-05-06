//! Single-tap echo / delay with filtered feedback.
//!
//! Pipeline per sample:
//!   1. Read echo from the delay line at `time_ms` ago.
//!   2. Pass that echo through a one-pole LP "tone" filter for warmth.
//!   3. Mix `input + tone(echo) * feedback` and write to the delay line.
//!   4. Output = `dry * (1 - mix) + tone(echo) * mix`.

use super::Effect;
use crate::utils::delay_line::DelayLine;
use crate::utils::math::smoothing_alpha;

pub const PARAM_TIME_MS: u32 = 0;
pub const PARAM_FEEDBACK: u32 = 1;
pub const PARAM_TONE_HZ: u32 = 2;
pub const PARAM_DRY_WET: u32 = 3;

const MAX_TIME_SEC: f32 = 2.0;
const SMOOTH_TIME_SEC: f32 = 0.005;

pub struct Delay {
    sample_rate: f32,

    delay: DelayLine,
    /// Smoothed delay length in samples.
    target_delay_samples: f32,
    smoothed_delay_samples: f32,

    target_feedback: f32,
    smoothed_feedback: f32,

    target_dry_wet: f32,
    smoothed_dry_wet: f32,

    /// One-pole LP state for the feedback path ("tone" knob).
    lp_state: f32,
    lp_coef: f32,

    smoother_alpha: f32,
}

impl Delay {
    pub fn new(sample_rate: f32) -> Self {
        let max_samples = (MAX_TIME_SEC * sample_rate) as usize;
        let mut d = Self {
            sample_rate,
            delay: DelayLine::new(max_samples),
            target_delay_samples: 0.25 * sample_rate,
            smoothed_delay_samples: 0.25 * sample_rate,
            target_feedback: 0.35,
            smoothed_feedback: 0.35,
            target_dry_wet: 0.5,
            smoothed_dry_wet: 0.5,
            lp_state: 0.0,
            lp_coef: 0.0,
            smoother_alpha: smoothing_alpha(SMOOTH_TIME_SEC, sample_rate),
        };
        d.set_tone_hz(6_000.0);
        d
    }

    fn set_tone_hz(&mut self, hz: f32) {
        // One-pole LP coefficient: y = (1 - a) * x + a * y_prev,
        //   a = exp(-2π * f / fs).
        let a = (-2.0 * core::f32::consts::PI * hz.max(20.0) / self.sample_rate).exp();
        self.lp_coef = a;
    }
}

impl Effect for Delay {
    fn process(&mut self, input: &[f32], output: &mut [f32]) {
        let n = input.len().min(output.len());
        let alpha = self.smoother_alpha;
        let max = (self.delay.capacity() - 2) as f32;

        for i in 0..n {
            self.smoothed_delay_samples += alpha * (self.target_delay_samples - self.smoothed_delay_samples);
            self.smoothed_feedback += alpha * (self.target_feedback - self.smoothed_feedback);
            self.smoothed_dry_wet += alpha * (self.target_dry_wet - self.smoothed_dry_wet);

            let d = self.smoothed_delay_samples.clamp(1.0, max);
            let echo = self.delay.read_frac(d);
            // Tone shaping in the feedback loop.
            self.lp_state = (1.0 - self.lp_coef) * echo + self.lp_coef * self.lp_state;
            let toned = self.lp_state;

            let to_write = input[i] + toned * self.smoothed_feedback;
            self.delay.write(to_write);

            let dry = input[i];
            let wet = toned;
            output[i] = dry * (1.0 - self.smoothed_dry_wet) + wet * self.smoothed_dry_wet;
        }
    }

    fn set_param(&mut self, param_id: u32, value: f32) {
        match param_id {
            PARAM_TIME_MS => {
                let ms = value.clamp(1.0, MAX_TIME_SEC * 1000.0);
                self.target_delay_samples = ms * 0.001 * self.sample_rate;
            }
            PARAM_FEEDBACK => self.target_feedback = value.clamp(0.0, 0.95),
            PARAM_TONE_HZ => self.set_tone_hz(value.clamp(200.0, 18_000.0)),
            PARAM_DRY_WET => self.target_dry_wet = value.clamp(0.0, 1.0),
            _ => {}
        }
    }

    fn reset(&mut self) {
        self.delay.reset();
        self.lp_state = 0.0;
        self.smoothed_delay_samples = self.target_delay_samples;
        self.smoothed_feedback = self.target_feedback;
        self.smoothed_dry_wet = self.target_dry_wet;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn impulse_appears_after_delay() {
        let sr = 48_000.0;
        let mut delay = Delay::new(sr);
        delay.set_param(PARAM_TIME_MS, 100.0);
        delay.set_param(PARAM_FEEDBACK, 0.0);
        delay.set_param(PARAM_DRY_WET, 1.0);
        delay.set_param(PARAM_TONE_HZ, 18_000.0); // close to passthrough
        delay.reset();

        let n = ((sr * 0.25) as usize).max(8);
        let mut input = vec![0.0_f32; n];
        input[0] = 1.0;
        let mut output = vec![0.0_f32; n];
        delay.process(&input, &mut output);

        // Find peak in output ignoring the dry impulse at sample 0 (dry/wet=1
        // so dry contribution is 0). Expect peak ~100 ms in.
        let target = (0.1 * sr) as usize;
        let win = 200;
        let lo = target.saturating_sub(win);
        let hi = (target + win).min(n);
        let local_peak = output[lo..hi].iter().map(|s| s.abs()).fold(0.0_f32, f32::max);
        assert!(local_peak > 0.5, "expected echo, got peak {}", local_peak);
    }

    #[test]
    fn dry_wet_zero_yields_dry() {
        let sr = 48_000.0;
        let mut delay = Delay::new(sr);
        delay.set_param(PARAM_DRY_WET, 0.0);
        delay.set_param(PARAM_FEEDBACK, 0.5);
        delay.reset();

        let mut input = vec![0.7_f32; 1024];
        input[100] = 0.9;
        let mut output = vec![0.0_f32; 1024];
        delay.process(&input, &mut output);

        // Output should match input (dry only).
        for i in 0..input.len() {
            assert!((output[i] - input[i]).abs() < 1e-5);
        }
    }
}
