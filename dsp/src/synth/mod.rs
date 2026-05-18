pub mod adsr;
pub mod filter;
pub mod oscillator;

use adsr::Adsr;
use filter::SvfLp;
use oscillator::{Oscillator, OscType};
use crate::utils::math::{db_to_lin, flush_denormal};

pub const SYNTH_PARAM_OSC_TYPE:   u32 = 0;
pub const SYNTH_PARAM_ATTACK_MS:  u32 = 1;
pub const SYNTH_PARAM_DECAY_MS:   u32 = 2;
pub const SYNTH_PARAM_SUSTAIN:    u32 = 3;
pub const SYNTH_PARAM_RELEASE_MS: u32 = 4;
pub const SYNTH_PARAM_CUTOFF_HZ:  u32 = 5;
pub const SYNTH_PARAM_RESONANCE:  u32 = 6;
pub const SYNTH_PARAM_GAIN_DB:    u32 = 7;

pub struct SynthEngine {
    sample_rate: f32,
    osc:  Oscillator,
    adsr: Adsr,
    filt: SvfLp,
    osc_type: OscType,
    gain_lin: f32,
}

impl SynthEngine {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate,
            osc:      Oscillator::new(sample_rate),
            adsr:     Adsr::new(sample_rate),
            filt:     SvfLp::new(sample_rate),
            osc_type: OscType::Saw,
            gain_lin: 1.0,
        }
    }

    pub fn note_on(&mut self, freq_hz: f32) {
        self.osc.set_frequency(freq_hz);
        self.osc.reset_phase();
        self.adsr.note_on();
    }

    pub fn note_off(&mut self) {
        self.adsr.note_off();
    }

    pub fn is_active(&self) -> bool {
        self.adsr.is_active()
    }

    pub fn set_param(&mut self, id: u32, value: f32) {
        match id {
            SYNTH_PARAM_OSC_TYPE   => self.osc_type = OscType::from_u32(value as u32),
            SYNTH_PARAM_ATTACK_MS  => self.adsr.set_attack_ms(value.clamp(1.0, 5000.0)),
            SYNTH_PARAM_DECAY_MS   => self.adsr.set_decay_ms(value.clamp(1.0, 5000.0)),
            SYNTH_PARAM_SUSTAIN    => self.adsr.set_sustain(value.clamp(0.0, 1.0)),
            SYNTH_PARAM_RELEASE_MS => self.adsr.set_release_ms(value.clamp(1.0, 5000.0)),
            SYNTH_PARAM_CUTOFF_HZ  => self.filt.set_cutoff(value.clamp(20.0, 20_000.0)),
            SYNTH_PARAM_RESONANCE  => self.filt.set_resonance(value.clamp(0.0, 0.95)),
            SYNTH_PARAM_GAIN_DB    => self.gain_lin = db_to_lin(value.clamp(-24.0, 6.0)),
            _ => {}
        }
    }

    pub fn process(&mut self, output: &mut [f32]) {
        for s in output.iter_mut() {
            let env = self.adsr.next_sample();
            let osc_sample = self.osc.next_sample(self.osc_type);
            let filtered   = self.filt.process_sample(osc_sample * env * self.gain_lin);
            *s = flush_denormal(filtered);
        }
    }
}

// ─── WASM exports ────────────────────────────────────────────────────────────

#[unsafe(no_mangle)]
pub extern "C" fn create_synth(sample_rate: f32) -> *mut SynthEngine {
    let synth = Box::new(SynthEngine::new(sample_rate));
    Box::into_raw(synth)
}

/// # Safety
/// `ptr` must be a valid pointer returned by `create_synth`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn synth_note_on(ptr: *mut SynthEngine, freq_hz: f32) {
    if ptr.is_null() { return; }
    (*ptr).note_on(freq_hz);
}

/// # Safety
/// `ptr` must be a valid pointer returned by `create_synth`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn synth_note_off(ptr: *mut SynthEngine) {
    if ptr.is_null() { return; }
    (*ptr).note_off();
}

/// # Safety
/// `ptr` and `output_ptr` must be valid.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn synth_process(ptr: *mut SynthEngine, output_ptr: *mut f32, frames: u32) {
    if ptr.is_null() || output_ptr.is_null() { return; }
    let output = core::slice::from_raw_parts_mut(output_ptr, frames as usize);
    (*ptr).process(output);
}

/// # Safety
/// `ptr` must be valid.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn synth_set_param(ptr: *mut SynthEngine, id: u32, value: f32) {
    if ptr.is_null() { return; }
    (*ptr).set_param(id, value);
}

/// # Safety
/// `ptr` must be valid and will be freed.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn destroy_synth(ptr: *mut SynthEngine) {
    if !ptr.is_null() {
        drop(Box::from_raw(ptr));
    }
}
