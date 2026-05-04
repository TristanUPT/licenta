//! Audio math primitives. All `#[inline]`-friendly, branchless where possible.

#[inline]
pub fn db_to_lin(db: f32) -> f32 {
    // 10^(db/20) — used everywhere we convert dB knobs to linear gain.
    10f32.powf(db * 0.05)
}

#[inline]
pub fn lin_to_db(lin: f32) -> f32 {
    // log10(|x|) * 20. Floor at -120 dB so silence doesn't go to -inf.
    if lin.abs() < 1e-6 {
        -120.0
    } else {
        20.0 * lin.abs().log10()
    }
}

/// One-pole lowpass smoothing factor for a given time constant in seconds.
/// Use as `state += alpha * (target - state)` per sample.
#[inline]
pub fn smoothing_alpha(time_const_sec: f32, sample_rate: f32) -> f32 {
    // alpha = 1 - exp(-1 / (tau * fs))
    1.0 - (-1.0 / (time_const_sec.max(1e-6) * sample_rate)).exp()
}

/// Flush denormal floats to zero — they tank performance on x86 / WASM SIMD.
#[inline]
pub fn flush_denormal(x: f32) -> f32 {
    if x.abs() < 1e-15 { 0.0 } else { x }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn approx_eq(a: f32, b: f32) {
        assert!((a - b).abs() < 1e-4, "{} != {}", a, b);
    }

    #[test]
    fn db_to_lin_roundtrip() {
        approx_eq(db_to_lin(0.0), 1.0);
        approx_eq(db_to_lin(6.0206), 2.0);
        approx_eq(db_to_lin(-6.0206), 0.5);
    }

    #[test]
    fn lin_to_db_known_values() {
        approx_eq(lin_to_db(1.0), 0.0);
        approx_eq(lin_to_db(2.0), 6.0206);
        approx_eq(lin_to_db(0.5), -6.0206);
    }

    #[test]
    fn smoothing_alpha_in_range() {
        let a = smoothing_alpha(0.01, 48_000.0);
        assert!(a > 0.0 && a < 1.0);
    }

    #[test]
    fn flush_denormal_kills_tiny_values() {
        assert_eq!(flush_denormal(1e-20), 0.0);
        assert_eq!(flush_denormal(0.5), 0.5);
    }
}
