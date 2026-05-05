//! Parametric EQ — 4 cascaded biquad bands. Each band can be peaking,
//! low/high shelf, high/low pass, or notch.
//!
//! Coefficients are recomputed on `set_param`; `process` is just biquad cascade.

use super::Effect;
use crate::utils::filters::{
    high_shelf, highpass, low_shelf, lowpass, notch, peaking, Biquad, BiquadCoeffs,
};

const NUM_BANDS: usize = 4;

/// Filter shape for a band. Numbers are sent over the worklet boundary as f32
/// (cast to/from u32 internally) — keep stable.
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
#[repr(u32)]
pub enum BandType {
    Bell = 0,
    LowShelf = 1,
    HighShelf = 2,
    HighPass = 3,
    LowPass = 4,
    Notch = 5,
}

impl BandType {
    fn from_f32(v: f32) -> Self {
        match v.round() as i32 {
            1 => BandType::LowShelf,
            2 => BandType::HighShelf,
            3 => BandType::HighPass,
            4 => BandType::LowPass,
            5 => BandType::Notch,
            _ => BandType::Bell,
        }
    }
}

/// Per-band parameter offsets within the contiguous flat param space.
pub const PARAMS_PER_BAND: u32 = 5;
pub const BAND_PARAM_TYPE: u32 = 0;
pub const BAND_PARAM_FREQ: u32 = 1;
pub const BAND_PARAM_GAIN: u32 = 2;
pub const BAND_PARAM_Q: u32 = 3;
pub const BAND_PARAM_ENABLED: u32 = 4;

/// Compute the param id for `band_index` (0-based) and `local_offset`.
#[inline]
pub const fn band_param(band_index: u32, local: u32) -> u32 {
    band_index * PARAMS_PER_BAND + local
}

#[derive(Copy, Clone, Debug)]
struct Band {
    enabled: bool,
    band_type: BandType,
    freq_hz: f32,
    q: f32,
    gain_db: f32,
    biquad: Biquad,
}

impl Band {
    fn new(default_freq: f32) -> Self {
        Self {
            enabled: false,
            band_type: BandType::Bell,
            freq_hz: default_freq,
            q: 1.0,
            gain_db: 0.0,
            biquad: Biquad::new(BiquadCoeffs::PASSTHROUGH),
        }
    }

    fn recompute(&mut self, sr: f32) {
        let coeffs = match self.band_type {
            BandType::Bell => peaking(self.freq_hz, self.q, self.gain_db, sr),
            BandType::LowShelf => low_shelf(self.freq_hz, self.q, self.gain_db, sr),
            BandType::HighShelf => high_shelf(self.freq_hz, self.q, self.gain_db, sr),
            BandType::HighPass => highpass(self.freq_hz, self.q, sr),
            BandType::LowPass => lowpass(self.freq_hz, self.q, sr),
            BandType::Notch => notch(self.freq_hz, self.q, sr),
        };
        self.biquad.set_coeffs(coeffs);
    }
}

pub struct ParametricEq {
    sample_rate: f32,
    bands: [Band; NUM_BANDS],
}

impl ParametricEq {
    pub fn new(sample_rate: f32) -> Self {
        let bands = [
            Band::new(80.0),    // band 0 — typical low cleanup
            Band::new(250.0),   // band 1 — low mids
            Band::new(2_500.0), // band 2 — presence
            Band::new(8_000.0), // band 3 — air
        ];
        Self { sample_rate, bands }
    }
}

impl Effect for ParametricEq {
    fn process(&mut self, input: &[f32], output: &mut [f32]) {
        let n = input.len().min(output.len());
        for i in 0..n {
            let mut x = input[i];
            for band in &mut self.bands {
                if band.enabled {
                    x = band.biquad.process_sample(x);
                }
            }
            output[i] = x;
        }
    }

    fn set_param(&mut self, param_id: u32, value: f32) {
        let band_idx = (param_id / PARAMS_PER_BAND) as usize;
        if band_idx >= NUM_BANDS {
            return;
        }
        let local = param_id % PARAMS_PER_BAND;
        let band = &mut self.bands[band_idx];
        match local {
            BAND_PARAM_TYPE => {
                band.band_type = BandType::from_f32(value);
                band.recompute(self.sample_rate);
            }
            BAND_PARAM_FREQ => {
                band.freq_hz = value.clamp(20.0, 20_000.0);
                band.recompute(self.sample_rate);
            }
            BAND_PARAM_GAIN => {
                band.gain_db = value.clamp(-24.0, 24.0);
                band.recompute(self.sample_rate);
            }
            BAND_PARAM_Q => {
                band.q = value.clamp(0.1, 18.0);
                band.recompute(self.sample_rate);
            }
            BAND_PARAM_ENABLED => {
                band.enabled = value >= 0.5;
            }
            _ => {}
        }
    }

    fn reset(&mut self) {
        for band in &mut self.bands {
            band.biquad.reset();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use core::f32::consts::PI;

    fn rms_db(buf: &[f32]) -> f32 {
        let s: f64 = buf.iter().map(|x| (*x as f64) * (*x as f64)).sum();
        let r = (s / buf.len() as f64).sqrt() as f32;
        20.0 * r.log10()
    }

    #[test]
    fn enabled_bell_boosts_at_center() {
        let sr = 48_000.0;
        let mut eq = ParametricEq::new(sr);
        // Enable band 2 (centred at 2.5 kHz default), set type=bell, freq=1k, gain=12, Q=1.
        eq.set_param(band_param(2, BAND_PARAM_FREQ), 1000.0);
        eq.set_param(band_param(2, BAND_PARAM_GAIN), 12.0);
        eq.set_param(band_param(2, BAND_PARAM_Q), 1.0);
        eq.set_param(band_param(2, BAND_PARAM_ENABLED), 1.0);

        let n = (sr * 0.5) as usize;
        let mut input = vec![0.0_f32; n];
        let mut output = vec![0.0_f32; n];
        for i in 0..n {
            input[i] = (2.0 * PI * 1000.0 * i as f32 / sr).sin();
        }
        eq.process(&input, &mut output);
        // Reference: 0 dB sine RMS = -3.01 dB. After +12 dB → ~+9 dB.
        let tail = &output[(0.4 * sr as f32) as usize..];
        let r = rms_db(tail);
        assert!((r - 9.0).abs() < 1.0, "expected ~9 dB RMS, got {} dB", r);
    }

    #[test]
    fn disabled_band_passes_through() {
        let sr = 48_000.0;
        let mut eq = ParametricEq::new(sr);
        // Set extreme gain but leave band disabled.
        eq.set_param(band_param(0, BAND_PARAM_GAIN), 24.0);
        // band 0 is disabled by default — leave so.

        let n = 1024;
        let mut input = vec![0.0_f32; n];
        let mut output = vec![0.0_f32; n];
        for i in 0..n {
            input[i] = (2.0 * PI * 100.0 * i as f32 / sr).sin();
        }
        eq.process(&input, &mut output);
        let r_in = rms_db(&input[200..]);
        let r_out = rms_db(&output[200..]);
        assert!((r_in - r_out).abs() < 0.1, "expected passthrough, in={} out={}", r_in, r_out);
    }
}
