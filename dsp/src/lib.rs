use wasm_bindgen::prelude::*;

/// Simple gain processor to verify WASM works
#[wasm_bindgen]
pub fn apply_gain(samples: &mut [f32], gain: f32) {
    for sample in samples.iter_mut() {
        *sample *= gain;
    }
}

/// Returns the RMS level of a buffer
#[wasm_bindgen]
pub fn calculate_rms(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }
    let sum: f32 = samples.iter().map(|&s| s * s).sum();
    (sum / samples.len() as f32).sqrt()
}

/// Returns the peak level of a buffer
#[wasm_bindgen]
pub fn calculate_peak(samples: &[f32]) -> f32 {
    samples.iter().map(|s| s.abs()).fold(0.0_f32, f32::max)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_apply_gain() {
        let mut buf = vec![0.5, -0.5, 1.0, -1.0];
        apply_gain(&mut buf, 0.5);
        assert!((buf[0] - 0.25).abs() < 1e-5);
        assert!((buf[1] - (-0.25)).abs() < 1e-5);
    }

    #[test]
    fn test_rms_silence() {
        let buf = vec![0.0; 128];
        assert!((calculate_rms(&buf)).abs() < 1e-5);
    }

    #[test]
    fn test_peak() {
        let buf = vec![0.1, -0.8, 0.5, 0.3];
        assert!((calculate_peak(&buf) - 0.8).abs() < 1e-5);
    }
}
