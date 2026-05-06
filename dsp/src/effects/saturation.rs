//! Memoryless waveshaping saturation with post-LP filter (anti-aliasing).
//!
//! Drive boosts the input into the shaper, the shape is selectable
//! (tanh / soft-clip / hard-clip / asymmetric tube), and a configurable
//! lowpass after the shaper rolls off the worst of the harmonics.
//! Auto level compensation keeps perceived loudness roughly constant.

use super::Effect;
use crate::utils::filters::{lowpass, Biquad, BiquadCoeffs};
use crate::utils::math::{db_to_lin, smoothing_alpha};

pub const PARAM_DRIVE_DB: u32 = 0;
pub const PARAM_TYPE: u32 = 1;        // 0=tanh, 1=soft, 2=hard, 3=tube
pub const PARAM_TONE_HZ: u32 = 2;
pub const PARAM_DRY_WET: u32 = 3;

const SMOOTH_TIME_SEC: f32 = 0.005;

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
enum SatType {
    Tanh,
    SoftClip,
    HardClip,
    Tube,
}

impl SatType {
    fn from_f32(v: f32) -> Self {
        match v.round() as i32 {
            1 => SatType::SoftClip,
            2 => SatType::HardClip,
            3 => SatType::Tube,
            _ => SatType::Tanh,
        }
    }
}

#[inline]
fn shape(x: f32, t: SatType) -> f32 {
    match t {
        SatType::Tanh => x.tanh(),
        SatType::SoftClip => {
            // Polynomial soft clip — cubic.
            let c = x.clamp(-1.5, 1.5);
            c - (c * c * c) / 3.375  // /(1.5^3) → reaches 1.0 at x=1.5
        }
        SatType::HardClip => x.clamp(-1.0, 1.0),
        SatType::Tube => {
            // Asymmetric soft clip — different positive vs negative behaviour
            // (rough analog of a tube's even-harmonics character).
            if x >= 0.0 {
                x.tanh() // softer
            } else {
                -((-x).tanh()).powf(0.85)
            }
        }
    }
}

pub struct Saturation {
    sample_rate: f32,
    target_drive_lin: f32,
    smoothed_drive_lin: f32,
    sat_type: SatType,
    tone: Biquad,
    target_dry_wet: f32,
    smoothed_dry_wet: f32,
    smoother_alpha: f32,
}

impl Saturation {
    pub fn new(sample_rate: f32) -> Self {
        let mut s = Self {
            sample_rate,
            target_drive_lin: 1.0,
            smoothed_drive_lin: 1.0,
            sat_type: SatType::Tanh,
            tone: Biquad::new(BiquadCoeffs::PASSTHROUGH),
            target_dry_wet: 1.0,
            smoothed_dry_wet: 1.0,
            smoother_alpha: smoothing_alpha(SMOOTH_TIME_SEC, sample_rate),
        };
        s.set_tone_hz(8_000.0);
        s
    }

    fn set_tone_hz(&mut self, hz: f32) {
        self.tone.set_coeffs(lowpass(hz.clamp(500.0, 18_000.0), 0.707, self.sample_rate));
    }
}

impl Effect for Saturation {
    fn process(&mut self, input: &[f32], output: &mut [f32]) {
        let n = input.len().min(output.len());
        let alpha = self.smoother_alpha;
        for i in 0..n {
            self.smoothed_drive_lin += alpha * (self.target_drive_lin - self.smoothed_drive_lin);
            self.smoothed_dry_wet += alpha * (self.target_dry_wet - self.smoothed_dry_wet);

            let drive = self.smoothed_drive_lin;
            // Approximate level-comp (output is louder when driven harder; this
            // empirical curve keeps perceived level roughly stable).
            let comp = 1.0 / (1.0 + 0.5 * (drive - 1.0).max(0.0));

            let pre = input[i] * drive;
            let shaped = shape(pre, self.sat_type) * comp;
            let toned = self.tone.process_sample(shaped);

            let dry = input[i];
            output[i] = dry * (1.0 - self.smoothed_dry_wet) + toned * self.smoothed_dry_wet;
        }
    }

    fn set_param(&mut self, param_id: u32, value: f32) {
        match param_id {
            PARAM_DRIVE_DB => {
                let db = value.clamp(0.0, 30.0);
                self.target_drive_lin = db_to_lin(db);
            }
            PARAM_TYPE => self.sat_type = SatType::from_f32(value),
            PARAM_TONE_HZ => self.set_tone_hz(value),
            PARAM_DRY_WET => self.target_dry_wet = value.clamp(0.0, 1.0),
            _ => {}
        }
    }

    fn reset(&mut self) {
        self.tone.reset();
        self.smoothed_drive_lin = self.target_drive_lin;
        self.smoothed_dry_wet = self.target_dry_wet;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use core::f32::consts::PI;

    #[test]
    fn dry_wet_zero_passes_through() {
        let sr = 48_000.0;
        let mut sat = Saturation::new(sr);
        sat.set_param(PARAM_DRIVE_DB, 24.0);
        sat.set_param(PARAM_DRY_WET, 0.0);
        sat.reset();

        let mut input = vec![0.0_f32; 1024];
        for i in 0..1024 {
            input[i] = 0.5 * (2.0 * PI * 440.0 * i as f32 / sr).sin();
        }
        let mut output = vec![0.0_f32; 1024];
        sat.process(&input, &mut output);
        for i in 200..input.len() {
            assert!((output[i] - input[i]).abs() < 1e-5);
        }
    }

    #[test]
    fn hard_clip_clamps() {
        let sr = 48_000.0;
        let mut sat = Saturation::new(sr);
        sat.set_param(PARAM_DRIVE_DB, 12.0);
        sat.set_param(PARAM_TYPE, 2.0);
        sat.set_param(PARAM_TONE_HZ, 18_000.0); // basically off
        sat.set_param(PARAM_DRY_WET, 1.0);
        sat.reset();

        let input = vec![0.9_f32; 256];
        let mut output = vec![0.0_f32; 256];
        sat.process(&input, &mut output);
        // Hard clip + level comp should cap output below 1.0.
        for &s in &output[100..] {
            assert!(s.abs() < 1.05, "output too hot: {}", s);
        }
    }
}
