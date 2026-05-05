//! Audio effects.
//!
//! Each effect implements the `Effect` trait. Param IDs are private to the
//! effect — they are u32 constants exported alongside each implementation.
//! The main thread keeps a parallel TS table; no string keys cross the
//! WASM boundary.

pub mod compressor;
pub mod eq;
pub mod gain;

/// Stable identifiers for effect types. Must match `EffectType` enum on the
/// TypeScript side (`src/types/effects.ts`).
#[repr(u32)]
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum EffectType {
    Gain = 0,
    Compressor = 1,
    ParametricEq = 2,
}

impl EffectType {
    pub fn from_u32(v: u32) -> Option<Self> {
        match v {
            0 => Some(EffectType::Gain),
            1 => Some(EffectType::Compressor),
            2 => Some(EffectType::ParametricEq),
            _ => None,
        }
    }
}

/// Audio effect interface. Implementations must NOT allocate inside `process`.
pub trait Effect {
    /// Process one block. `input` and `output` are equal-length mono buffers.
    fn process(&mut self, input: &[f32], output: &mut [f32]);
    /// Update a parameter. Effect-defined `param_id` space.
    fn set_param(&mut self, param_id: u32, value: f32);
    /// Reset internal state (envelopes, delay buffers, smoothers).
    fn reset(&mut self);
}

/// Construct a fresh effect instance for a given type.
pub fn build(effect_type: EffectType, sample_rate: f32) -> Box<dyn Effect> {
    match effect_type {
        EffectType::Gain => Box::new(gain::Gain::new(sample_rate)),
        EffectType::Compressor => Box::new(compressor::Compressor::new(sample_rate)),
        EffectType::ParametricEq => Box::new(eq::ParametricEq::new(sample_rate)),
    }
}
