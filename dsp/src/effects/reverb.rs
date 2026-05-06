//! Schroeder-style reverb: 4 lowpass-feedback comb filters in parallel,
//! followed by 2 allpass filters in series. Predelay implemented with a
//! separate delay line.
//!
//! Reference comb / allpass lengths from the classic Freeverb tuning,
//! scaled to our sample rate.

use super::Effect;
use crate::utils::delay_line::DelayLine;
use crate::utils::math::smoothing_alpha;

pub const PARAM_ROOM_SIZE: u32 = 0;
pub const PARAM_DAMPING: u32 = 1;
pub const PARAM_PRE_DELAY_MS: u32 = 2;
pub const PARAM_DRY_WET: u32 = 3;

// Stereo Freeverb tuning (left channel) at 44.1 kHz — we scale to current sr.
const COMB_LENGTHS_44K: [usize; 4] = [1116, 1188, 1277, 1356];
const ALLPASS_LENGTHS_44K: [usize; 2] = [556, 441];
const SMOOTH_TIME_SEC: f32 = 0.02;

struct Comb {
    delay: DelayLine,
    length: usize,
    /// One-pole LP for damping (in feedback path).
    lp_state: f32,
}

impl Comb {
    fn new(length: usize) -> Self {
        Self {
            delay: DelayLine::new(length + 4),
            length,
            lp_state: 0.0,
        }
    }
    fn reset(&mut self) {
        self.delay.reset();
        self.lp_state = 0.0;
    }
    #[inline]
    fn process(&mut self, input: f32, feedback: f32, damp: f32) -> f32 {
        let out = self.delay.read_int(self.length - 1);
        // Lowpass in the feedback loop (damping).
        self.lp_state = (1.0 - damp) * out + damp * self.lp_state;
        let to_write = input + self.lp_state * feedback;
        self.delay.write(to_write);
        out
    }
}

struct Allpass {
    delay: DelayLine,
    length: usize,
}

impl Allpass {
    fn new(length: usize) -> Self {
        Self { delay: DelayLine::new(length + 4), length }
    }
    fn reset(&mut self) { self.delay.reset(); }
    #[inline]
    fn process(&mut self, input: f32) -> f32 {
        // Schroeder allpass with gain = 0.5
        let buf = self.delay.read_int(self.length - 1);
        let out = -input + buf;
        self.delay.write(input + buf * 0.5);
        out
    }
}

pub struct Reverb {
    combs: [Comb; 4],
    allpasses: [Allpass; 2],
    predelay: DelayLine,
    target_predelay_samples: f32,
    smoothed_predelay_samples: f32,
    target_room_size: f32,
    smoothed_room_size: f32,
    target_damping: f32,
    smoothed_damping: f32,
    target_dry_wet: f32,
    smoothed_dry_wet: f32,
    smoother_alpha: f32,
}

fn scale_len(len_44k: usize, sample_rate: f32) -> usize {
    ((len_44k as f32) * (sample_rate / 44_100.0)) as usize
}

impl Reverb {
    pub fn new(sample_rate: f32) -> Self {
        let combs = [
            Comb::new(scale_len(COMB_LENGTHS_44K[0], sample_rate)),
            Comb::new(scale_len(COMB_LENGTHS_44K[1], sample_rate)),
            Comb::new(scale_len(COMB_LENGTHS_44K[2], sample_rate)),
            Comb::new(scale_len(COMB_LENGTHS_44K[3], sample_rate)),
        ];
        let allpasses = [
            Allpass::new(scale_len(ALLPASS_LENGTHS_44K[0], sample_rate)),
            Allpass::new(scale_len(ALLPASS_LENGTHS_44K[1], sample_rate)),
        ];
        let predelay_capacity = (sample_rate * 0.2) as usize; // up to 200 ms

        Self {
            combs,
            allpasses,
            predelay: DelayLine::new(predelay_capacity),
            target_predelay_samples: 0.0,
            smoothed_predelay_samples: 0.0,
            target_room_size: 0.84,    // ≈ medium room
            smoothed_room_size: 0.84,
            target_damping: 0.4,
            smoothed_damping: 0.4,
            target_dry_wet: 0.3,
            smoothed_dry_wet: 0.3,
            smoother_alpha: smoothing_alpha(SMOOTH_TIME_SEC, sample_rate),
        }
    }
}

impl Effect for Reverb {
    fn process(&mut self, input: &[f32], output: &mut [f32]) {
        let n = input.len().min(output.len());
        let alpha = self.smoother_alpha;

        for i in 0..n {
            self.smoothed_predelay_samples += alpha * (self.target_predelay_samples - self.smoothed_predelay_samples);
            self.smoothed_room_size += alpha * (self.target_room_size - self.smoothed_room_size);
            self.smoothed_damping += alpha * (self.target_damping - self.smoothed_damping);
            self.smoothed_dry_wet += alpha * (self.target_dry_wet - self.smoothed_dry_wet);

            // Predelay (read first, write last so we don't read what we just wrote).
            let pd_samples = self.smoothed_predelay_samples.clamp(0.0, (self.predelay.capacity() - 2) as f32);
            let pre = self.predelay.read_frac(pd_samples);
            self.predelay.write(input[i]);

            // Comb filters in parallel (sum), each with LP-damped feedback.
            let mut comb_sum = 0.0;
            for c in &mut self.combs {
                comb_sum += c.process(pre, self.smoothed_room_size, self.smoothed_damping);
            }
            let mut allpassed = comb_sum * 0.25;
            for ap in &mut self.allpasses {
                allpassed = ap.process(allpassed);
            }

            let dry = input[i];
            let wet = allpassed;
            output[i] = dry * (1.0 - self.smoothed_dry_wet) + wet * self.smoothed_dry_wet;
        }
    }

    fn set_param(&mut self, param_id: u32, value: f32) {
        match param_id {
            PARAM_ROOM_SIZE => {
                // Map 0..1 → comb feedback ∈ [0.5, 0.97].
                let v = value.clamp(0.0, 1.0);
                self.target_room_size = 0.5 + v * 0.47;
            }
            PARAM_DAMPING => self.target_damping = value.clamp(0.0, 0.95),
            PARAM_PRE_DELAY_MS => {
                let ms = value.clamp(0.0, 200.0);
                self.target_predelay_samples = ms * 0.001 * 48_000.0; // approximate; sample_rate is fixed in our pipeline
            }
            PARAM_DRY_WET => self.target_dry_wet = value.clamp(0.0, 1.0),
            _ => {}
        }
    }

    fn reset(&mut self) {
        for c in &mut self.combs { c.reset(); }
        for ap in &mut self.allpasses { ap.reset(); }
        self.predelay.reset();
        self.smoothed_predelay_samples = self.target_predelay_samples;
        self.smoothed_room_size = self.target_room_size;
        self.smoothed_damping = self.target_damping;
        self.smoothed_dry_wet = self.target_dry_wet;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn silence_in_silence_out() {
        let mut rev = Reverb::new(48_000.0);
        rev.reset();
        let input = vec![0.0_f32; 4096];
        let mut output = vec![0.0_f32; 4096];
        rev.process(&input, &mut output);
        let max = output.iter().map(|s| s.abs()).fold(0.0_f32, f32::max);
        assert!(max < 1e-6, "reverb leaked self-noise: {}", max);
    }

    #[test]
    fn impulse_response_decays() {
        let mut rev = Reverb::new(48_000.0);
        rev.set_param(PARAM_ROOM_SIZE, 0.7);
        rev.set_param(PARAM_DAMPING, 0.4);
        rev.set_param(PARAM_DRY_WET, 1.0);
        rev.reset();
        let mut input = vec![0.0_f32; 96_000]; // 2 seconds
        input[0] = 1.0;
        let mut output = vec![0.0_f32; 96_000];
        rev.process(&input, &mut output);

        // Energy should NOT be zero soon after the impulse.
        let early_rms = (output[100..2000].iter().map(|s| s * s).sum::<f32>() / 1900.0).sqrt();
        // Energy after ≈ 1 s should be lower than early.
        let late_rms = (output[48_000..50_000].iter().map(|s| s * s).sum::<f32>() / 2000.0).sqrt();
        assert!(early_rms > 0.0001, "no reverb after impulse: {}", early_rms);
        assert!(late_rms < early_rms, "reverb not decaying: early {} vs late {}", early_rms, late_rms);
    }
}
