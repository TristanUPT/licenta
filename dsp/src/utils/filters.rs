//! Biquad filters using RBJ Audio EQ Cookbook coefficients.
//!
//! All filters share the same `Biquad` runtime — only the coefficient
//! computation differs. We use **Direct Form II Transposed** which has the
//! best numerical behaviour for f32 audio.
//!
//! Reference: https://www.w3.org/TR/audio-eq-cookbook/

use core::f32::consts::PI;

/// Stored as a normalized biquad: y[n] = b0*x + b1*x[-1] + b2*x[-2] - a1*y[-1] - a2*y[-2]
#[derive(Copy, Clone, Debug, Default, PartialEq)]
pub struct BiquadCoeffs {
    pub b0: f32,
    pub b1: f32,
    pub b2: f32,
    pub a1: f32,
    pub a2: f32,
}

impl BiquadCoeffs {
    pub const PASSTHROUGH: Self = Self { b0: 1.0, b1: 0.0, b2: 0.0, a1: 0.0, a2: 0.0 };
}

#[derive(Copy, Clone, Debug, Default)]
pub struct Biquad {
    pub coeffs: BiquadCoeffs,
    /// State variables (Direct Form II Transposed).
    z1: f32,
    z2: f32,
}

impl Biquad {
    pub fn new(coeffs: BiquadCoeffs) -> Self {
        Self { coeffs, z1: 0.0, z2: 0.0 }
    }

    pub fn passthrough() -> Self {
        Self { coeffs: BiquadCoeffs::PASSTHROUGH, z1: 0.0, z2: 0.0 }
    }

    pub fn reset(&mut self) {
        self.z1 = 0.0;
        self.z2 = 0.0;
    }

    pub fn set_coeffs(&mut self, c: BiquadCoeffs) {
        self.coeffs = c;
        // Note: do NOT reset state here — state continues smoothly through
        // coefficient changes, which is exactly what we want for live tweaking.
    }

    #[inline]
    pub fn process_sample(&mut self, x: f32) -> f32 {
        let c = &self.coeffs;
        // DF II Transposed:
        //   y    = b0*x + z1
        //   z1   = b1*x - a1*y + z2
        //   z2   = b2*x - a2*y
        let y = c.b0 * x + self.z1;
        self.z1 = c.b1 * x - c.a1 * y + self.z2;
        self.z2 = c.b2 * x - c.a2 * y;
        y
    }

    pub fn process(&mut self, input: &[f32], output: &mut [f32]) {
        let n = input.len().min(output.len());
        for i in 0..n {
            output[i] = self.process_sample(input[i]);
        }
    }
}

// ──────────────────────────────────────────────────────────────────────────
//  RBJ cookbook coefficients
// ──────────────────────────────────────────────────────────────────────────

fn omega(freq: f32, sample_rate: f32) -> f32 {
    2.0 * PI * (freq.clamp(1.0, sample_rate * 0.5 - 1.0)) / sample_rate
}

/// Peaking (bell) filter.
pub fn peaking(freq: f32, q: f32, gain_db: f32, sample_rate: f32) -> BiquadCoeffs {
    let a = 10f32.powf(gain_db / 40.0);
    let w0 = omega(freq, sample_rate);
    let cos_w0 = w0.cos();
    let alpha = w0.sin() / (2.0 * q.max(1e-3));

    let b0 = 1.0 + alpha * a;
    let b1 = -2.0 * cos_w0;
    let b2 = 1.0 - alpha * a;
    let a0 = 1.0 + alpha / a;
    let a1 = -2.0 * cos_w0;
    let a2 = 1.0 - alpha / a;
    normalize(b0, b1, b2, a0, a1, a2)
}

pub fn low_shelf(freq: f32, q: f32, gain_db: f32, sample_rate: f32) -> BiquadCoeffs {
    let a = 10f32.powf(gain_db / 40.0);
    let w0 = omega(freq, sample_rate);
    let cos_w0 = w0.cos();
    let sin_w0 = w0.sin();
    let alpha = sin_w0 / (2.0 * q.max(1e-3));
    let two_sqrt_a_alpha = 2.0 * a.sqrt() * alpha;

    let b0 = a * ((a + 1.0) - (a - 1.0) * cos_w0 + two_sqrt_a_alpha);
    let b1 = 2.0 * a * ((a - 1.0) - (a + 1.0) * cos_w0);
    let b2 = a * ((a + 1.0) - (a - 1.0) * cos_w0 - two_sqrt_a_alpha);
    let a0 = (a + 1.0) + (a - 1.0) * cos_w0 + two_sqrt_a_alpha;
    let a1 = -2.0 * ((a - 1.0) + (a + 1.0) * cos_w0);
    let a2 = (a + 1.0) + (a - 1.0) * cos_w0 - two_sqrt_a_alpha;
    normalize(b0, b1, b2, a0, a1, a2)
}

pub fn high_shelf(freq: f32, q: f32, gain_db: f32, sample_rate: f32) -> BiquadCoeffs {
    let a = 10f32.powf(gain_db / 40.0);
    let w0 = omega(freq, sample_rate);
    let cos_w0 = w0.cos();
    let sin_w0 = w0.sin();
    let alpha = sin_w0 / (2.0 * q.max(1e-3));
    let two_sqrt_a_alpha = 2.0 * a.sqrt() * alpha;

    let b0 = a * ((a + 1.0) + (a - 1.0) * cos_w0 + two_sqrt_a_alpha);
    let b1 = -2.0 * a * ((a - 1.0) + (a + 1.0) * cos_w0);
    let b2 = a * ((a + 1.0) + (a - 1.0) * cos_w0 - two_sqrt_a_alpha);
    let a0 = (a + 1.0) - (a - 1.0) * cos_w0 + two_sqrt_a_alpha;
    let a1 = 2.0 * ((a - 1.0) - (a + 1.0) * cos_w0);
    let a2 = (a + 1.0) - (a - 1.0) * cos_w0 - two_sqrt_a_alpha;
    normalize(b0, b1, b2, a0, a1, a2)
}

pub fn highpass(freq: f32, q: f32, sample_rate: f32) -> BiquadCoeffs {
    let w0 = omega(freq, sample_rate);
    let cos_w0 = w0.cos();
    let alpha = w0.sin() / (2.0 * q.max(1e-3));

    let b0 = (1.0 + cos_w0) / 2.0;
    let b1 = -(1.0 + cos_w0);
    let b2 = (1.0 + cos_w0) / 2.0;
    let a0 = 1.0 + alpha;
    let a1 = -2.0 * cos_w0;
    let a2 = 1.0 - alpha;
    normalize(b0, b1, b2, a0, a1, a2)
}

pub fn lowpass(freq: f32, q: f32, sample_rate: f32) -> BiquadCoeffs {
    let w0 = omega(freq, sample_rate);
    let cos_w0 = w0.cos();
    let alpha = w0.sin() / (2.0 * q.max(1e-3));

    let b0 = (1.0 - cos_w0) / 2.0;
    let b1 = 1.0 - cos_w0;
    let b2 = (1.0 - cos_w0) / 2.0;
    let a0 = 1.0 + alpha;
    let a1 = -2.0 * cos_w0;
    let a2 = 1.0 - alpha;
    normalize(b0, b1, b2, a0, a1, a2)
}

pub fn notch(freq: f32, q: f32, sample_rate: f32) -> BiquadCoeffs {
    let w0 = omega(freq, sample_rate);
    let cos_w0 = w0.cos();
    let alpha = w0.sin() / (2.0 * q.max(1e-3));

    let b0 = 1.0;
    let b1 = -2.0 * cos_w0;
    let b2 = 1.0;
    let a0 = 1.0 + alpha;
    let a1 = -2.0 * cos_w0;
    let a2 = 1.0 - alpha;
    normalize(b0, b1, b2, a0, a1, a2)
}

#[inline]
fn normalize(b0: f32, b1: f32, b2: f32, a0: f32, a1: f32, a2: f32) -> BiquadCoeffs {
    let inv_a0 = 1.0 / a0;
    BiquadCoeffs {
        b0: b0 * inv_a0,
        b1: b1 * inv_a0,
        b2: b2 * inv_a0,
        a1: a1 * inv_a0,
        a2: a2 * inv_a0,
    }
}

// ──────────────────────────────────────────────────────────────────────────
//  Tests — verify the magnitude response at a single frequency.
// ──────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    /// Run a sine through the filter and return the steady-state RMS in dB.
    fn measure_db(coeffs: BiquadCoeffs, sine_hz: f32, sr: f32) -> f32 {
        let mut bq = Biquad::new(coeffs);
        let n = (sr * 0.5) as usize; // 0.5 s — long enough to settle
        let mut last_window_sumsq = 0.0f64;
        let window = (sr * 0.1) as usize;
        for i in 0..n {
            let x = (2.0 * PI * sine_hz * i as f32 / sr).sin();
            let y = bq.process_sample(x);
            if i >= n - window {
                last_window_sumsq += (y as f64) * (y as f64);
            }
        }
        let rms = (last_window_sumsq / window as f64).sqrt() as f32;
        20.0 * rms.log10() - 20.0 * (1.0 / 2f32.sqrt()).log10()
    }

    #[test]
    fn passthrough_doesnt_change_signal() {
        let mut bq = Biquad::passthrough();
        for x in [-0.5, 0.0, 0.5, 1.0] {
            assert!((bq.process_sample(x) - x).abs() < 1e-6);
        }
    }

    #[test]
    fn peaking_boosts_at_center_freq() {
        // +12 dB bell @ 1 kHz, Q=1, fs=48k.
        let coeffs = peaking(1000.0, 1.0, 12.0, 48000.0);
        let gain = measure_db(coeffs, 1000.0, 48000.0);
        // Allow some tolerance (+/- 0.5 dB).
        assert!((gain - 12.0).abs() < 0.5, "expected ~12 dB, got {} dB", gain);
    }

    #[test]
    fn highpass_attenuates_below_cutoff() {
        // HPF @ 1 kHz, Q=0.707. At 100 Hz we expect ~ -40 dB attenuation.
        let coeffs = highpass(1000.0, 0.707, 48000.0);
        let gain = measure_db(coeffs, 100.0, 48000.0);
        assert!(gain < -30.0, "expected strong attenuation, got {} dB", gain);
    }

    #[test]
    fn lowpass_passes_below_cutoff() {
        // LPF @ 5 kHz, Q=0.707. At 500 Hz we expect ~0 dB.
        let coeffs = lowpass(5000.0, 0.707, 48000.0);
        let gain = measure_db(coeffs, 500.0, 48000.0);
        assert!(gain.abs() < 1.0, "expected ~0 dB at 500 Hz, got {} dB", gain);
    }
}
