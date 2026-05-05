//! Asymmetric one-pole envelope follower.
//!
//! Used by compressors / gates / level meters. Tracks the magnitude of an
//! incoming signal with separate exponential time constants for attack
//! (rising) and release (falling).

#[derive(Copy, Clone, Debug)]
pub struct EnvelopeFollower {
    sample_rate: f32,
    attack_coef: f32,
    release_coef: f32,
    state: f32,
}

impl EnvelopeFollower {
    pub fn new(sample_rate: f32, attack_ms: f32, release_ms: f32) -> Self {
        let mut env = Self {
            sample_rate,
            attack_coef: 0.0,
            release_coef: 0.0,
            state: 0.0,
        };
        env.set_attack_ms(attack_ms);
        env.set_release_ms(release_ms);
        env
    }

    fn coef_from_ms(ms: f32, sample_rate: f32) -> f32 {
        // Standard analog-modeled one-pole: coef = exp(-1 / (tau_samples)).
        // For tau in ms: tau_samples = ms/1000 * sample_rate.
        let tau_samples = (ms.max(0.01) * 0.001) * sample_rate;
        (-1.0 / tau_samples).exp()
    }

    pub fn set_attack_ms(&mut self, ms: f32) {
        self.attack_coef = Self::coef_from_ms(ms, self.sample_rate);
    }

    pub fn set_release_ms(&mut self, ms: f32) {
        self.release_coef = Self::coef_from_ms(ms, self.sample_rate);
    }

    pub fn reset(&mut self) {
        self.state = 0.0;
    }

    pub fn current(&self) -> f32 {
        self.state
    }

    /// Process one sample. Returns the envelope (always >= 0).
    /// `input` is the raw signal — we take its absolute value internally
    /// (peak detector). For RMS-style detection, square outside and sqrt.
    #[inline]
    pub fn process_sample(&mut self, input: f32) -> f32 {
        let abs = input.abs();
        let coef = if abs > self.state { self.attack_coef } else { self.release_coef };
        self.state = abs + coef * (self.state - abs);
        self.state
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rise_fall_basic() {
        let mut env = EnvelopeFollower::new(48_000.0, 1.0, 100.0);
        // Pulse at 1.0 for 1000 samples (~21 ms = 21 attack-time-constants).
        for _ in 0..1000 {
            env.process_sample(1.0);
        }
        let after_rise = env.current();
        assert!(after_rise > 0.9999, "expected ~1.0 after rise, got {}", after_rise);

        for _ in 0..200 {
            env.process_sample(0.0);
        }
        let after_short_release = env.current();
        // 200 samples ≈ 4 ms, release time constant 100 ms, so still well
        // above 0.9 — that's the asymmetric behaviour we want.
        assert!(after_short_release > 0.9, "release too fast: {}", after_short_release);
    }

    #[test]
    fn attack_faster_than_release() {
        let mut env = EnvelopeFollower::new(48_000.0, 0.1, 100.0);
        // Spike of 1.0
        env.process_sample(1.0);
        let after_one = env.current();
        // 0.1 ms attack ≈ 4.8 samples → 1 sample is partial but already huge
        assert!(after_one > 0.1);
    }
}
