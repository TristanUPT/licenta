pub mod adsr;
pub mod filter;
pub mod oscillator;

use adsr::Adsr;
use filter::{SvfFilter, FilterType};
use oscillator::{Oscillator, OscType};
use crate::utils::math::{db_to_lin, flush_denormal};

pub const SYNTH_PARAM_OSC_TYPE:     u32 = 0;
pub const SYNTH_PARAM_ATTACK_MS:    u32 = 1;
pub const SYNTH_PARAM_DECAY_MS:     u32 = 2;
pub const SYNTH_PARAM_SUSTAIN:      u32 = 3;
pub const SYNTH_PARAM_RELEASE_MS:   u32 = 4;
pub const SYNTH_PARAM_CUTOFF_HZ:    u32 = 5;
pub const SYNTH_PARAM_RESONANCE:    u32 = 6;
pub const SYNTH_PARAM_GAIN_DB:      u32 = 7;
pub const SYNTH_PARAM_FILTER_TYPE:  u32 = 8;
pub const SYNTH_PARAM_DETUNE_CENTS: u32 = 9;
pub const SYNTH_PARAM_LFO_RATE:     u32 = 10;
pub const SYNTH_PARAM_LFO_DEPTH:    u32 = 11;

pub struct SynthEngine {
    sample_rate: f32,
    osc:         Oscillator,
    osc2:        Oscillator,   // second oscillator for detune / unison
    adsr:        Adsr,
    filt:        SvfFilter,
    osc_type:    OscType,
    gain_lin:    f32,
    // Detune: osc1 plays freq/ratio, osc2 plays freq*ratio (symmetric)
    detune_ratio: f32,
    base_freq:    f32,
    // LFO for filter cutoff modulation
    lfo_phase:     f32,
    lfo_phase_inc: f32,
    lfo_depth:     f32,
    base_cutoff:   f32,
}

impl SynthEngine {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate,
            osc:           Oscillator::new(sample_rate),
            osc2:          Oscillator::new(sample_rate),
            adsr:          Adsr::new(sample_rate),
            filt:          SvfFilter::new(sample_rate),
            osc_type:      OscType::Saw,
            gain_lin:      1.0,
            detune_ratio:  1.0,
            base_freq:     440.0,
            lfo_phase:     0.0,
            lfo_phase_inc: 2.0 / sample_rate,   // 2 Hz default
            lfo_depth:     0.0,
            base_cutoff:   8_000.0,
        }
    }

    pub fn note_on(&mut self, freq_hz: f32) {
        self.base_freq = freq_hz;
        self.osc.set_frequency(freq_hz / self.detune_ratio);
        self.osc.reset_phase();
        // osc2 phase intentionally NOT reset → phase offset produces chorus thickening
        self.osc2.set_frequency(freq_hz * self.detune_ratio);
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
            SYNTH_PARAM_CUTOFF_HZ  => {
                self.base_cutoff = value.clamp(20.0, 20_000.0);
                self.filt.set_cutoff(self.base_cutoff);
            }
            SYNTH_PARAM_RESONANCE  => self.filt.set_resonance(value.clamp(0.0, 0.95)),
            SYNTH_PARAM_GAIN_DB    => self.gain_lin = db_to_lin(value.clamp(-24.0, 6.0)),
            SYNTH_PARAM_FILTER_TYPE => {
                self.filt.set_filter_type(FilterType::from_u32(value as u32));
            }
            SYNTH_PARAM_DETUNE_CENTS => {
                let cents = value.clamp(0.0, 50.0);
                // 2^(cents/2400) gives symmetric detuning: osc1 low, osc2 high
                self.detune_ratio = 2f32.powf(cents / 2400.0);
                self.osc.set_frequency(self.base_freq / self.detune_ratio);
                self.osc2.set_frequency(self.base_freq * self.detune_ratio);
            }
            SYNTH_PARAM_LFO_RATE => {
                self.lfo_phase_inc = value.clamp(0.01, 20.0) / self.sample_rate;
            }
            SYNTH_PARAM_LFO_DEPTH => {
                self.lfo_depth = value.clamp(0.0, 1.0);
            }
            _ => {}
        }
    }

    pub fn process(&mut self, output: &mut [f32]) {
        for s in output.iter_mut() {
            // Advance LFO phase
            self.lfo_phase += self.lfo_phase_inc;
            if self.lfo_phase >= 1.0 { self.lfo_phase -= 1.0; }

            // Apply LFO to filter cutoff (skip expensive math when depth is near zero)
            if self.lfo_depth > 1e-4 {
                let lfo_val = (core::f32::consts::TAU * self.lfo_phase).sin();
                // ±1 octave at full depth
                let mod_cutoff = (self.base_cutoff * 2f32.powf(self.lfo_depth * lfo_val))
                    .clamp(20.0, 20_000.0);
                self.filt.set_cutoff(mod_cutoff);
            }

            let env   = self.adsr.next_sample();
            let osc1  = self.osc.next_sample(self.osc_type);
            let osc2  = self.osc2.next_sample(self.osc_type);
            let mixed = (osc1 + osc2) * 0.5;
            let out   = self.filt.process_sample(mixed * env * self.gain_lin);
            *s = flush_denormal(out);
        }
    }
}

// ─── WASM exports ────────────────────────────────────────────────────────────

#[unsafe(no_mangle)]
pub extern "C" fn create_synth(sample_rate: f32) -> *mut SynthEngine {
    Box::into_raw(Box::new(SynthEngine::new(sample_rate)))
}

/// # Safety
/// `ptr` must be a valid pointer returned by `create_synth`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn synth_note_on(ptr: *mut SynthEngine, freq_hz: f32) {
    if ptr.is_null() { return; }
    unsafe { (*ptr).note_on(freq_hz) };
}

/// # Safety
/// `ptr` must be a valid pointer returned by `create_synth`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn synth_note_off(ptr: *mut SynthEngine) {
    if ptr.is_null() { return; }
    unsafe { (*ptr).note_off() };
}

/// # Safety
/// `ptr` and `output_ptr` must be valid.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn synth_process(ptr: *mut SynthEngine, output_ptr: *mut f32, frames: u32) {
    if ptr.is_null() || output_ptr.is_null() { return; }
    let output = unsafe { core::slice::from_raw_parts_mut(output_ptr, frames as usize) };
    unsafe { (*ptr).process(output) };
}

/// # Safety
/// `ptr` must be valid.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn synth_set_param(ptr: *mut SynthEngine, id: u32, value: f32) {
    if ptr.is_null() { return; }
    unsafe { (*ptr).set_param(id, value) };
}

/// # Safety
/// `ptr` must be valid and will be freed.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn destroy_synth(ptr: *mut SynthEngine) {
    if !ptr.is_null() {
        drop(unsafe { Box::from_raw(ptr) });
    }
}
