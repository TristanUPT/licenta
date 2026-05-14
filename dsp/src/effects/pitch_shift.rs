//! Granular pitch shifter — two 50 %-overlap Hann-windowed grains.
//!
//! Architecture
//! ────────────
//! • A ring buffer is written at the audio rate (1 sample/tick).
//! • Two grain read-heads each advance at `pitch_ratio` samples/tick,
//!   which is different from the write-head rate of 1 sample/tick.
//! • Each grain has an independent *phase counter* (0 … GRAIN_SIZE−1)
//!   that drives the Hann window; when the counter wraps, the grain
//!   resets to GRAIN_SIZE samples behind the current write position.
//! • The two grains are initialised GRAIN_SIZE/2 apart in phase, so
//!   one grain is always near its window peak while the other fades in
//!   or out — guaranteeing a constant-power overlap-add sum of ≈ 1.
//!
//! Why `dist += 1 − pitch_ratio`
//! ─────────────────────────────
//! `dist` is the fractional distance of the read-head *behind* the
//! write-head.  Each tick the write-head advances by 1 and the read-
//! head advances by `pitch_ratio`, so the gap changes by (1 − ratio):
//!   • ratio > 1 (pitch up): dist shrinks → read-head catches write-head → faster playback
//!   • ratio < 1 (pitch dn): dist grows  → read-head falls behind       → slower playback
//!
//! Parameters
//! ──────────
//!   PARAM_SEMITONES  −12 … +12   (default 0)
//!   PARAM_DRY_WET    0 … 1       (default 1)

use super::Effect;
use crate::utils::math::{flush_denormal, smoothing_alpha};

pub const PARAM_SEMITONES: u32 = 0;
pub const PARAM_DRY_WET:   u32 = 1;

const BUF_SIZE:  usize = 8192;
const BUF_MASK:  usize = BUF_SIZE - 1;
const GRAIN_SIZE: usize = 2048;
const HALF_GRAIN: usize = GRAIN_SIZE / 2;

/// Pre-computed 2048-point Hann window: w[i] = sin²(π·i/(N−1)).
/// w[0] = w[N−1] = 0 so grains always start and end at silence.
struct HannTable([f32; GRAIN_SIZE]);

impl HannTable {
    fn new() -> Self {
        let mut t = [0.0_f32; GRAIN_SIZE];
        for (i, v) in t.iter_mut().enumerate() {
            let x = core::f32::consts::PI * i as f32 / (GRAIN_SIZE - 1) as f32;
            *v = x.sin() * x.sin();
        }
        t[0] = 0.0;
        t[GRAIN_SIZE - 1] = 0.0;
        Self(t)
    }

    #[inline]
    fn get(&self, phase: usize) -> f32 {
        self.0[phase & (GRAIN_SIZE - 1)]
    }
}

pub struct PitchShift {
    #[allow(dead_code)]
    sample_rate: f32,

    ring:      [f32; BUF_SIZE],
    write_pos: usize,

    /// Phase counter for each grain (0 … GRAIN_SIZE−1).
    /// Advances by 1 per sample regardless of pitch ratio.
    grain_phase: [usize; 2],
    /// Fractional distance of each grain's read-head behind the write-head.
    /// Updated by `1 − pitch_ratio` each sample; reset to GRAIN_SIZE on
    /// grain wrap (when phase rolls over).
    grain_dist: [f32; 2],

    hann: HannTable,

    target_semitones:    f32,
    smoothed_semitones:  f32,
    target_dry_wet:      f32,
    smoothed_dry_wet:    f32,
    smoother_alpha:      f32,
}

impl PitchShift {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate,
            ring:        [0.0; BUF_SIZE],
            write_pos:   0,
            // Grain 1 starts at phase 0, grain 2 is HALF_GRAIN ahead.
            grain_phase: [0, HALF_GRAIN],
            // Both grains initially read from GRAIN_SIZE samples behind.
            grain_dist:  [GRAIN_SIZE as f32, GRAIN_SIZE as f32],
            hann:        HannTable::new(),
            target_semitones:   0.0,
            smoothed_semitones: 0.0,
            target_dry_wet:     1.0,
            smoothed_dry_wet:   1.0,
            smoother_alpha: smoothing_alpha(0.008, sample_rate),
        }
    }

    /// Linearly-interpolated read from the ring buffer.
    /// `dist` is distance behind the current write position (> 0).
    #[inline]
    fn read_ring(&self, dist: f32) -> f32 {
        let d   = dist.max(1.0).min((BUF_SIZE - 2) as f32);
        let i0  = d as usize;
        let fr  = d - i0 as f32;
        let wp  = self.write_pos;
        let s0  = self.ring[(wp + BUF_SIZE - 1 - i0) & BUF_MASK];
        let s1  = self.ring[(wp + BUF_SIZE - 2 - i0) & BUF_MASK];
        s0 + fr * (s1 - s0)
    }
}

impl Effect for PitchShift {
    fn process(&mut self, input: &[f32], output: &mut [f32]) {
        let n     = input.len().min(output.len());
        let alpha = self.smoother_alpha;

        for i in 0..n {
            // ── Smooth parameters ───────────────────────────────────────
            self.smoothed_semitones += alpha * (self.target_semitones - self.smoothed_semitones);
            self.smoothed_dry_wet   += alpha * (self.target_dry_wet   - self.smoothed_dry_wet);

            let pitch_ratio = 2.0_f32.powf(self.smoothed_semitones / 12.0);
            // Change in dist per sample: write-head advances 1, read-head
            // advances pitch_ratio, so gap changes by (1 − pitch_ratio).
            let dist_delta = 1.0 - pitch_ratio;

            // ── Write to ring buffer ─────────────────────────────────────
            self.ring[self.write_pos] = input[i];
            self.write_pos = (self.write_pos + 1) & BUF_MASK;

            // ── Accumulate both grains ───────────────────────────────────
            let mut wet = 0.0_f32;
            for g in 0..2 {
                let phase = self.grain_phase[g];
                let dist  = self.grain_dist[g];

                let window = self.hann.get(phase);
                let sample = self.read_ring(dist);
                wet += flush_denormal(sample * window);

                // Advance grain state.
                let next_phase = phase + 1;
                let next_dist  = dist + dist_delta;

                if next_phase >= GRAIN_SIZE {
                    // Grain complete: restart phase, reset dist to GRAIN_SIZE.
                    self.grain_phase[g] = 0;
                    self.grain_dist[g]  = GRAIN_SIZE as f32;
                } else {
                    self.grain_phase[g] = next_phase;
                    // Clamp dist to valid buffer range.
                    self.grain_dist[g]  = next_dist
                        .max(1.0)
                        .min((BUF_SIZE / 2) as f32);
                }
            }

            // ── Mix dry + wet ────────────────────────────────────────────
            let dw = self.smoothed_dry_wet;
            output[i] = (1.0 - dw) * input[i] + dw * wet;
        }
    }

    fn set_param(&mut self, param_id: u32, value: f32) {
        match param_id {
            PARAM_SEMITONES => self.target_semitones = value.clamp(-12.0, 12.0),
            PARAM_DRY_WET   => self.target_dry_wet   = value.clamp(0.0, 1.0),
            _ => {}
        }
    }

    fn reset(&mut self) {
        for s in &mut self.ring { *s = 0.0; }
        self.write_pos   = 0;
        self.grain_phase = [0, HALF_GRAIN];
        self.grain_dist  = [GRAIN_SIZE as f32, GRAIN_SIZE as f32];
        self.smoothed_semitones = self.target_semitones;
        self.smoothed_dry_wet   = self.target_dry_wet;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hann_overlap_add_sums_to_one() {
        // Two grains at 50 % overlap must give a flat power envelope.
        let hann = HannTable::new();
        for k in 1..(GRAIN_SIZE - 1) {
            let w0 = hann.get(k);
            let w1 = hann.get(k + HALF_GRAIN);
            let sum = w0 + w1;
            assert!(
                (sum - 1.0).abs() < 0.01,
                "k={k}: w0={w0:.4} w1={w1:.4} sum={sum:.4}"
            );
        }
    }

    #[test]
    fn dry_only_passes_through() {
        let mut ps = PitchShift::new(48_000.0);
        ps.set_param(PARAM_DRY_WET, 0.0);
        ps.reset();
        let input: Vec<f32>  = (0..256).map(|i| i as f32 * 0.001).collect();
        let mut out = vec![0.0_f32; 256];
        ps.process(&input, &mut out);
        for i in 0..256 {
            assert!((out[i] - input[i]).abs() < 1e-5, "i={i}");
        }
    }

    #[test]
    fn wet_output_nonzero_after_warmup() {
        let mut ps = PitchShift::new(48_000.0);
        ps.set_param(PARAM_SEMITONES, 7.0);
        ps.set_param(PARAM_DRY_WET, 1.0);
        ps.reset();
        let input = vec![0.5_f32; 4096];
        let mut out = vec![0.0_f32; 4096];
        ps.process(&input, &mut out);
        let energy: f32 = out[GRAIN_SIZE..].iter().map(|s| s * s).sum();
        assert!(energy > 0.0);
    }

    #[test]
    fn unity_shift_approximately_passes_through() {
        // At 0 semitones, wet output should be close to input amplitude.
        let mut ps = PitchShift::new(48_000.0);
        ps.set_param(PARAM_SEMITONES, 0.0);
        ps.set_param(PARAM_DRY_WET, 1.0);
        ps.reset();
        let input = vec![0.5_f32; 8192];
        let mut out = vec![0.0_f32; 8192];
        ps.process(&input, &mut out);
        // After two full grains the output should be near the input amplitude.
        let avg: f32 = out[GRAIN_SIZE * 2..].iter().copied().sum::<f32>()
            / (8192 - GRAIN_SIZE * 2) as f32;
        assert!(avg > 0.3 && avg < 0.7, "avg={avg}");
    }
}
