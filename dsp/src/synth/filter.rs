//! Simple 2-pole resonant low-pass filter (State Variable Filter).
//! Efficient and self-oscillating at high resonance values.

pub struct SvfLp {
    sample_rate: f32,
    f_coef:      f32,   // 2 * sin(π * fc / SR)
    q_coef:      f32,   // 1/Q
    low:         f32,
    band:        f32,
}

impl SvfLp {
    pub fn new(sample_rate: f32) -> Self {
        let mut f = Self {
            sample_rate,
            f_coef: 0.0,
            q_coef: 1.0,
            low:    0.0,
            band:   0.0,
        };
        f.set_cutoff(8_000.0);
        f.set_resonance(0.0);
        f
    }

    pub fn set_cutoff(&mut self, hz: f32) {
        let fc = hz.clamp(20.0, self.sample_rate * 0.49);
        // Approximation: f = 2 * sin(π * fc / SR). More accurate than naive.
        self.f_coef = 2.0 * (core::f32::consts::PI * fc / self.sample_rate).sin();
    }

    pub fn set_resonance(&mut self, r: f32) {
        // r = 0 (no resonance) → Q = 0.7071; r = 1 → Q = 0.1 (self-osc)
        let q = 0.7071 + r.clamp(0.0, 1.0) * 9.29;
        self.q_coef = 1.0 / q;
    }

    #[inline]
    pub fn process_sample(&mut self, x: f32) -> f32 {
        let high = x - self.low - self.q_coef * self.band;
        self.band += self.f_coef * high;
        self.low  += self.f_coef * self.band;
        self.low
    }

    pub fn reset(&mut self) {
        self.low = 0.0;
        self.band = 0.0;
    }
}
