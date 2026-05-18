//! 2-pole resonant State Variable Filter — supports LP, BP, and HP outputs.

#[derive(Copy, Clone, PartialEq, Eq)]
pub enum FilterType { Low = 0, Band = 1, High = 2 }

impl FilterType {
    pub fn from_u32(v: u32) -> Self {
        match v {
            1 => FilterType::Band,
            2 => FilterType::High,
            _ => FilterType::Low,
        }
    }
}

pub struct SvfFilter {
    sample_rate: f32,
    f_coef:      f32,   // 2 * sin(π * fc / SR)
    q_coef:      f32,   // 1/Q
    low:         f32,
    band:        f32,
    pub filter_type: FilterType,
}

impl SvfFilter {
    pub fn new(sample_rate: f32) -> Self {
        let mut f = Self {
            sample_rate,
            f_coef:      0.0,
            q_coef:      1.0,
            low:         0.0,
            band:        0.0,
            filter_type: FilterType::Low,
        };
        f.set_cutoff(8_000.0);
        f.set_resonance(0.0);
        f
    }

    pub fn set_cutoff(&mut self, hz: f32) {
        let fc = hz.clamp(20.0, self.sample_rate * 0.49);
        self.f_coef = 2.0 * (core::f32::consts::PI * fc / self.sample_rate).sin();
    }

    pub fn set_resonance(&mut self, r: f32) {
        // r = 0 → Q ≈ 0.707 (flat); r = 0.95 → high resonance / self-osc territory
        let q = 0.7071 + r.clamp(0.0, 0.95) * 9.29;
        self.q_coef = 1.0 / q;
    }

    pub fn set_filter_type(&mut self, t: FilterType) {
        self.filter_type = t;
    }

    #[inline]
    pub fn process_sample(&mut self, x: f32) -> f32 {
        let high = x - self.low - self.q_coef * self.band;
        self.band += self.f_coef * high;
        self.low  += self.f_coef * self.band;
        match self.filter_type {
            FilterType::Low  => self.low,
            FilterType::Band => self.band,
            FilterType::High => high,
        }
    }

    pub fn reset(&mut self) {
        self.low  = 0.0;
        self.band = 0.0;
    }
}
