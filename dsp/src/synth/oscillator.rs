//! Band-limited oscillator using phase accumulation.
//! Saw/square/triangle use PolyBLEP correction for alias reduction.

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
#[repr(u32)]
pub enum OscType {
    Sine     = 0,
    Saw      = 1,
    Square   = 2,
    Triangle = 3,
    Noise    = 4,
}

impl OscType {
    pub fn from_u32(v: u32) -> Self {
        match v {
            1 => OscType::Saw,
            2 => OscType::Square,
            3 => OscType::Triangle,
            4 => OscType::Noise,
            _ => OscType::Sine,
        }
    }
}

pub struct Oscillator {
    sample_rate: f32,
    phase:       f32,   // 0..1
    phase_inc:   f32,
    noise_state: u32,   // LCG state
}

// Single-sample PolyBLEP residual — corrects phase discontinuities.
#[inline]
fn poly_blep(t: f32, dt: f32) -> f32 {
    if t < dt {
        let x = t / dt;
        2.0 * x - x * x - 1.0
    } else if t > 1.0 - dt {
        let x = (t - 1.0) / dt;
        x * x + 2.0 * x + 1.0
    } else {
        0.0
    }
}

impl Oscillator {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate,
            phase: 0.0,
            phase_inc: 0.0,
            noise_state: 0x1234_5678,
        }
    }

    pub fn set_frequency(&mut self, hz: f32) {
        self.phase_inc = (hz / self.sample_rate).clamp(0.0, 0.5);
    }

    /// Reset phase to 0 (for hard sync on note-on).
    pub fn reset_phase(&mut self) {
        self.phase = 0.0;
    }

    #[inline]
    pub fn next_sample(&mut self, osc_type: OscType) -> f32 {
        let p = self.phase;
        let dt = self.phase_inc;

        let sample = match osc_type {
            OscType::Sine => (core::f32::consts::TAU * p).sin(),

            OscType::Saw => {
                let naive = 2.0 * p - 1.0;
                naive - poly_blep(p, dt)
            }

            OscType::Square => {
                let naive = if p < 0.5 { 1.0_f32 } else { -1.0_f32 };
                naive + poly_blep(p, dt) - poly_blep((p + 0.5) % 1.0, dt)
            }

            OscType::Triangle => {
                // Direct piecewise — continuous, minimal aliasing at low-mid freqs.
                if p < 0.5 { 4.0 * p - 1.0 } else { 3.0 - 4.0 * p }
            }

            OscType::Noise => {
                // 32-bit LCG (Park-Miller variant)
                self.noise_state = self.noise_state.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
                // Map u32 to -1..1
                (self.noise_state as i32) as f32 / 2_147_483_648.0
            }
        };

        // Advance phase
        self.phase += dt;
        if self.phase >= 1.0 {
            self.phase -= 1.0;
        }

        sample
    }
}
