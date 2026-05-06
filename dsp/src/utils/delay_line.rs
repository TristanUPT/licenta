//! Power-of-two circular delay line with linear-interpolated fractional reads.
//!
//! Used by the Delay effect, Limiter lookahead and Reverb's comb/allpass.
//! Pre-allocated; never resized at audio rate.

pub struct DelayLine {
    buf: Vec<f32>,
    /// Power-of-two length; reads/writes mask with `len - 1`.
    mask: usize,
    write_idx: usize,
}

impl DelayLine {
    /// Create a delay line big enough to hold `min_samples`. The actual capacity
    /// is rounded up to the next power of two.
    pub fn new(min_samples: usize) -> Self {
        let len = min_samples.max(2).next_power_of_two();
        Self {
            buf: vec![0.0; len],
            mask: len - 1,
            write_idx: 0,
        }
    }

    pub fn capacity(&self) -> usize {
        self.buf.len()
    }

    pub fn reset(&mut self) {
        for s in &mut self.buf {
            *s = 0.0;
        }
        self.write_idx = 0;
    }

    /// Write a sample at the current write position, then advance.
    #[inline]
    pub fn write(&mut self, sample: f32) {
        self.buf[self.write_idx] = sample;
        self.write_idx = (self.write_idx + 1) & self.mask;
    }

    /// Read the sample written `delay_samples` ago (integer offset).
    /// Reads beyond capacity wrap silently — caller is responsible for clamp.
    #[inline]
    pub fn read_int(&self, delay_samples: usize) -> f32 {
        let idx = (self.write_idx + self.buf.len() - 1 - (delay_samples & self.mask)) & self.mask;
        self.buf[idx]
    }

    /// Read with a fractional delay using linear interpolation.
    #[inline]
    pub fn read_frac(&self, delay_samples: f32) -> f32 {
        let d = delay_samples.max(0.0).min((self.buf.len() - 1) as f32);
        let i0 = d.floor() as usize;
        let frac = d - i0 as f32;
        let s0 = self.read_int(i0);
        let s1 = self.read_int(i0 + 1);
        s0 + frac * (s1 - s0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn capacity_rounds_up_to_pow2() {
        let dl = DelayLine::new(100);
        assert_eq!(dl.capacity(), 128);
        let dl = DelayLine::new(128);
        assert_eq!(dl.capacity(), 128);
        let dl = DelayLine::new(129);
        assert_eq!(dl.capacity(), 256);
    }

    #[test]
    fn write_read_roundtrip() {
        let mut dl = DelayLine::new(16);
        dl.write(1.0);
        dl.write(2.0);
        dl.write(3.0);
        // Most recent sample = 3.0 (offset 0), then 2.0 (offset 1), then 1.0 (offset 2).
        assert_eq!(dl.read_int(0), 3.0);
        assert_eq!(dl.read_int(1), 2.0);
        assert_eq!(dl.read_int(2), 1.0);
    }

    #[test]
    fn fractional_read_interpolates() {
        let mut dl = DelayLine::new(16);
        dl.write(0.0);
        dl.write(2.0);
        dl.write(4.0);
        // Offset 0.5 between latest (4.0) and one back (2.0) → 3.0.
        let v = dl.read_frac(0.5);
        assert!((v - 3.0).abs() < 1e-5);
    }

    #[test]
    fn reset_clears_buffer() {
        let mut dl = DelayLine::new(8);
        dl.write(0.5);
        dl.write(0.3);
        dl.reset();
        assert_eq!(dl.read_int(0), 0.0);
        assert_eq!(dl.read_int(1), 0.0);
    }
}
