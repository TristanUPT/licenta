//! Audio effects.
//!
//! Each effect implements the `Effect` trait. Param IDs are private to the
//! effect — they are u32 constants exported alongside each implementation.

pub mod chorus;
pub mod compressor;
pub mod de_esser;
pub mod delay;
pub mod eq;
pub mod flanger;
pub mod gain;
pub mod gate;
pub mod limiter;
pub mod phaser;
pub mod pitch_shift;
pub mod reverb;
pub mod saturation;
pub mod transient_shaper;

#[repr(u32)]
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum EffectType {
    Gain = 0,
    Compressor = 1,
    ParametricEq = 2,
    Gate = 3,
    Limiter = 4,
    Delay = 5,
    Reverb = 6,
    Saturation = 7,
    Chorus = 8,
    Flanger = 9,
    PitchShift = 10,
    Phaser = 11,
    TransientShaper = 12,
    DeEsser = 13,
}

impl EffectType {
    pub fn from_u32(v: u32) -> Option<Self> {
        match v {
            0  => Some(EffectType::Gain),
            1  => Some(EffectType::Compressor),
            2  => Some(EffectType::ParametricEq),
            3  => Some(EffectType::Gate),
            4  => Some(EffectType::Limiter),
            5  => Some(EffectType::Delay),
            6  => Some(EffectType::Reverb),
            7  => Some(EffectType::Saturation),
            8  => Some(EffectType::Chorus),
            9  => Some(EffectType::Flanger),
            10 => Some(EffectType::PitchShift),
            11 => Some(EffectType::Phaser),
            12 => Some(EffectType::TransientShaper),
            13 => Some(EffectType::DeEsser),
            _  => None,
        }
    }
}

pub trait Effect {
    fn process(&mut self, input: &[f32], output: &mut [f32]);
    fn set_param(&mut self, param_id: u32, value: f32);
    fn reset(&mut self);
    fn get_meter(&self, _meter_id: u32) -> f32 { 0.0 }
}

pub fn build(effect_type: EffectType, sample_rate: f32) -> Box<dyn Effect> {
    match effect_type {
        EffectType::Gain            => Box::new(gain::Gain::new(sample_rate)),
        EffectType::Compressor      => Box::new(compressor::Compressor::new(sample_rate)),
        EffectType::ParametricEq    => Box::new(eq::ParametricEq::new(sample_rate)),
        EffectType::Gate            => Box::new(gate::Gate::new(sample_rate)),
        EffectType::Limiter         => Box::new(limiter::Limiter::new(sample_rate)),
        EffectType::Delay           => Box::new(delay::Delay::new(sample_rate)),
        EffectType::Reverb          => Box::new(reverb::Reverb::new(sample_rate)),
        EffectType::Saturation      => Box::new(saturation::Saturation::new(sample_rate)),
        EffectType::Chorus          => Box::new(chorus::Chorus::new(sample_rate)),
        EffectType::Flanger         => Box::new(flanger::Flanger::new(sample_rate)),
        EffectType::PitchShift      => Box::new(pitch_shift::PitchShift::new(sample_rate)),
        EffectType::Phaser          => Box::new(phaser::Phaser::new(sample_rate)),
        EffectType::TransientShaper => Box::new(transient_shaper::TransientShaper::new(sample_rate)),
        EffectType::DeEsser         => Box::new(de_esser::DeEsser::new(sample_rate)),
    }
}
