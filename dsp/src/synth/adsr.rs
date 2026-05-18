//! ADSR envelope generator.

#[derive(Copy, Clone, PartialEq, Eq)]
enum Stage { Idle, Attack, Decay, Sustain, Release }

pub struct Adsr {
    sample_rate: f32,
    attack_coef:  f32,
    decay_coef:   f32,
    sustain:      f32,
    release_coef: f32,
    stage:        Stage,
    value:        f32,
}

fn coef_from_ms(ms: f32, sr: f32) -> f32 {
    let tau = (ms.max(1.0) * 0.001) * sr;
    (-1.0_f32 / tau).exp()
}

impl Adsr {
    pub fn new(sample_rate: f32) -> Self {
        let mut adsr = Self {
            sample_rate,
            attack_coef:  0.0,
            decay_coef:   0.0,
            sustain:      0.7,
            release_coef: 0.0,
            stage:        Stage::Idle,
            value:        0.0,
        };
        adsr.set_attack_ms(10.0);
        adsr.set_decay_ms(100.0);
        adsr.set_release_ms(200.0);
        adsr
    }

    pub fn set_attack_ms(&mut self, ms: f32) {
        self.attack_coef = coef_from_ms(ms, self.sample_rate);
    }
    pub fn set_decay_ms(&mut self, ms: f32) {
        self.decay_coef = coef_from_ms(ms, self.sample_rate);
    }
    pub fn set_sustain(&mut self, level: f32) {
        self.sustain = level.clamp(0.0, 1.0);
    }
    pub fn set_release_ms(&mut self, ms: f32) {
        self.release_coef = coef_from_ms(ms, self.sample_rate);
    }

    pub fn note_on(&mut self) {
        self.stage = Stage::Attack;
    }

    pub fn note_off(&mut self) {
        if self.stage != Stage::Idle {
            self.stage = Stage::Release;
        }
    }

    pub fn is_active(&self) -> bool {
        self.stage != Stage::Idle
    }

    #[inline]
    pub fn next_sample(&mut self) -> f32 {
        const SNAP: f32 = 1e-3;
        match self.stage {
            Stage::Idle => {}

            Stage::Attack => {
                // Exponential approach to 1.0 from current value.
                self.value = 1.0 + self.attack_coef * (self.value - 1.0);
                if 1.0 - self.value < SNAP {
                    self.value = 1.0;
                    self.stage = Stage::Decay;
                }
            }

            Stage::Decay => {
                self.value = self.sustain + self.decay_coef * (self.value - self.sustain);
                if (self.value - self.sustain).abs() < SNAP * 0.1 {
                    self.value = self.sustain;
                    self.stage = Stage::Sustain;
                }
            }

            Stage::Sustain => {
                self.value = self.sustain;
            }

            Stage::Release => {
                self.value = self.release_coef * self.value;
                if self.value < 1e-5 {
                    self.value = 0.0;
                    self.stage = Stage::Idle;
                }
            }
        }
        self.value
    }
}
