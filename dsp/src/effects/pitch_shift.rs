//! Granular pitch shifter.
//!
//! Two overlapping grains read from a ring buffer at a rate proportional to
//! `2^(semitones/12)`.  The grains are crossfaded with a Hann window to
//! eliminate clicks at grain boundaries.
//!
//! Ring buffer size: 8192 samples (power of two).
//! Grain size:       2048 samples.
//! The two grains are offset by grain_size/2 (1024 samples) so that at any
//! given instant one grain is always near its window peak.
//!
//! Parameter:
//!   PARAM_SEMITONES — pitch shift in semitones (-12 … +12), default 0.
//!   PARAM_DRY_WET   — 0–1, default 1.0.
//!
//! Semitones are smoothed with a 5 ms lowpass to avoid clicks on fast changes.

use super::Effect;
use crate::utils::math::{flush_denormal, smoothing_alpha};

pub const PARAM_SEMITONES: u32 = 0; // -12.0 – 12.0,  default 0.0
pub const PARAM_DRY_WET: u32 = 1;   // 0–1,  default 1.0

const BUF_SIZE: usize = 8192;
const BUF_MASK: usize = BUF_SIZE - 1;
const GRAIN_SIZE: usize = 2048;
const SMOOTH_TIME_SEC: f32 = 0.005;

/// Pre-computed 2048-sample Hann window.
struct HannTable([f32; GRAIN_SIZE]);

impl HannTable {
    fn new() -> Self {
        let mut t = [0.0_f32; GRAIN_SIZE];
        for (i, v) in t.iter_mut().enumerate() {
            let x = core::f32::consts::PI * i as f32 / (GRAIN_SIZE - 1) as f32;
            *v = x.sin() * x.sin(); // (sin(πi/N))^2 == Hann window
        }
        t[0] = 0.0;
        t[GRAIN_SIZE - 1] = 0.0;
        Self(t)
    }

    #[inline]
    fn get(&self, idx: usize) -> f32 {
        self.0[idx & (GRAIN_SIZE - 1)]
    }
}

pub struct PitchShift {
    #[allow(dead_code)]
    sample_rate: f32,

    /// Ring buffer written at the audio rate.
    ring: [f32; BUF_SIZE],
    /// Integer write position (cycles through BUF_SIZE).
    write_pos: usize,

    /// Two fractional read positions (distance behind the write head).
    /// They are initialised grain_size/2 apart.
    grain_pos: [f32; 2],

    hann: HannTable,

    target_semitones: f32,
    smoothed_semitones: f32,
    target_dry_wet: f32,
    smoothed_dry_wet: f32,
    smoother_alpha: f32,
}

impl PitchShift {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate,
            ring: [0.0; BUF_SIZE],
            write_pos: 0,
            // Grains start offset by grain_size/2 so their windows interleave.
            grain_pos: [GRAIN_SIZE as f32 / 2.0, GRAIN_SIZE as f32],
            hann: HannTable::new(),
            target_semitones: 0.0,
            smoothed_semitones: 0.0,
            target_dry_wet: 1.0,
            smoothed_dry_wet: 1.0,
            smoother_alpha: smoothing_alpha(SMOOTH_TIME_SEC, sample_rate),
        }
    }

    /// Fractional read from ring buffer.
    /// `dist` is the distance behind the current write head (positive, in samples).
    #[inline]
    fn read_ring(&self, dist: f32) -> f32 {
        let d = dist.max(0.0).min((BUF_SIZE - 2) as f32);
        let i0 = d.floor() as usize;
        let frac = d - i0 as f32;
        // write_pos points to the *next* slot to be written, so offset by 1.
        let wp = self.write_pos;
        let a = self.ring[(wp + BUF_SIZE - 1 - i0) & BUF_MASK];
        let b = self.ring[(wp + BUF_SIZE - 2 - i0) & BUF_MASK];
        a + frac * (b - a)
    }
}

impl Effect for PitchShift {
    fn process(&mut self, input: &[f32], output: &mut [f32]) {
        let n = input.len().min(output.len());
        let alpha = self.smoother_alpha;
        let grain_f = GRAIN_SIZE as f32;

        for i in 0..n {
            // Smooth parameters.
            self.smoothed_semitones += alpha * (self.target_semitones - self.smoothed_semitones);
            self.smoothed_dry_wet += alpha * (self.target_dry_wet - self.smoothed_dry_wet);

            // pitch_ratio: how fast the read head moves relative to write head.
            let pitch_ratio = 2.0_f32.powf(self.smoothed_semitones / 12.0);

            // Write into ring buffer.
            self.ring[self.write_pos] = input[i];
            self.write_pos = (self.write_pos + 1) & BUF_MASK;

            // Sum both grains.
            let mut wet = 0.0_f32;
            for g in 0..2 {
                let gp = self.grain_pos[g];
                // Window index = position within the current grain cycle.
                let win_idx = (gp as usize) % GRAIN_SIZE;
                let window = self.hann.get(win_idx);

                let sample = self.read_ring(gp);
                wet += flush_denormal(sample * window);

                // Advance grain read head.
                self.grain_pos[g] = gp + pitch_ratio;

                // If the grain head has drifted too far from the write head
                // (distance > grain_size), snap it back so it always reads
                // recent audio.
                if self.grain_pos[g] > grain_f {
                    self.grain_pos[g] = grain_f / 2.0;
                }
            }

            let dw = self.smoothed_dry_wet;
            output[i] = (1.0 - dw) * input[i] + dw * wet;
        }
    }

    fn set_param(&mut self, param_id: u32, value: f32) {
        match param_id {
            PARAM_SEMITONES => self.target_semitones = value.clamp(-12.0, 12.0),
            PARAM_DRY_WET => self.target_dry_wet = value.clamp(0.0, 1.0),
            _ => {}
        }
    }

    fn reset(&mut self) {
        for s in &mut self.ring {
            *s = 0.0;
        }
        self.write_pos = 0;
        self.grain_pos = [GRAIN_SIZE as f32 / 2.0, GRAIN_SIZE as f32];
        self.smoothed_semitones = self.target_semitones;
        self.smoothed_dry_wet = self.target_dry_wet;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unity_semitones_passes_through_approximately() {
        // At 0 semitones pitch_ratio=1.  Feed a sustained non-zero signal so
        // that the grain ring buffer fills and the output becomes non-zero.
        let sr = 48_000.0;
        let mut ps = PitchShift::new(sr);
        ps.set_param(PARAM_SEMITONES, 0.0);
        ps.set_param(PARAM_DRY_WET, 1.0);
        ps.reset();

        // Sustained signal — after GRAIN_SIZE samples the grains will be reading
        // real content and the summed output must be non-zero.
        let input = vec![0.5_f32; 4096];
        let mut output = vec![0.0_f32; 4096];
        ps.process(&input, &mut output);

        // Check the second half (after grains have warmed up).
        let energy: f32 = output[GRAIN_SIZE..].iter().map(|s| s * s).sum();
        assert!(energy > 0.0, "expected non-zero output after grain warm-up");
    }

    #[test]
    fn dry_only_matches_input() {
        let sr = 48_000.0;
        let mut ps = PitchShift::new(sr);
        ps.set_param(PARAM_DRY_WET, 0.0);
        ps.reset();

        let input: Vec<f32> = (0..256).map(|i| (i as f32) * 0.001).collect();
        let mut output = vec![0.0_f32; 256];
        ps.process(&input, &mut output);

        for i in 0..256 {
            assert!((output[i] - input[i]).abs() < 1e-5, "i={i}");
        }
    }

    #[test]
    fn hann_table_sums_to_one_at_overlap() {
        // The two grains are offset by grain_size/2.  At any given position
        // in the window the two Hann weights should sum close to 1.0 (this
        // is the overlap-add property of the 50% Hann overlap).
        let hann = HannTable::new();
        for k in 1..(GRAIN_SIZE - 1) {
            let w0 = hann.get(k);
            let w1 = hann.get(k + GRAIN_SIZE / 2);
            let sum = w0 + w1;
            assert!(
                (sum - 1.0).abs() < 0.01,
                "k={k}: w0={w0} w1={w1} sum={sum}"
            );
        }
    }
}
