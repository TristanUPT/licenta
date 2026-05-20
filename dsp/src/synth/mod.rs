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
pub const SYNTH_PARAM_PITCH_BEND:   u32 = 12;  // semitones, range ±12
pub const SYNTH_PARAM_MONO_MODE:    u32 = 13;  // 0 = polyphonic, 1 = monophonic

const MAX_VOICES: usize = 8;
// Sentinel passed to note_off() to silence every active voice at once.
const NOTE_OFF_ALL: u32 = 255;

struct Voice {
    osc:       Oscillator,
    osc2:      Oscillator,
    adsr:      Adsr,
    filt:      SvfFilter,
    base_freq: f32,
    midi:      u8,
    age:       u32,
}

pub struct PolyEngine {
    sample_rate:          f32,
    voices:               Vec<Voice>,
    age_counter:          u32,
    // Shared timbral params
    osc_type:             OscType,
    detune_ratio:         f32,
    gain_lin:             f32,
    lfo_phase:            f32,
    lfo_phase_inc:        f32,
    lfo_depth:            f32,
    base_cutoff:          f32,
    resonance:            f32,
    filter_type:          FilterType,
    pitch_bend_semitones: f32,
    mono_mode:            bool,
    // Stored ADSR params — applied to voices on note_on
    attack_ms:            f32,
    decay_ms:             f32,
    sustain:              f32,
    release_ms:           f32,
}

impl PolyEngine {
    pub fn new(sample_rate: f32) -> Self {
        let voices = (0..MAX_VOICES)
            .map(|_| Voice {
                osc:       Oscillator::new(sample_rate),
                osc2:      Oscillator::new(sample_rate),
                adsr:      Adsr::new(sample_rate),
                filt:      SvfFilter::new(sample_rate),
                base_freq: 440.0,
                midi:      255,
                age:       0,
            })
            .collect();

        Self {
            sample_rate,
            voices,
            age_counter:          0,
            osc_type:             OscType::Saw,
            detune_ratio:         1.0,
            gain_lin:             db_to_lin(-6.0),
            lfo_phase:            0.0,
            lfo_phase_inc:        2.0 / sample_rate,
            lfo_depth:            0.0,
            base_cutoff:          4_000.0,
            resonance:            0.0,
            filter_type:          FilterType::Low,
            pitch_bend_semitones: 0.0,
            mono_mode:            false,
            attack_ms:            10.0,
            decay_ms:             200.0,
            sustain:              0.7,
            release_ms:           400.0,
        }
    }

    pub fn note_on(&mut self, midi: u32, freq_hz: f32) {
        let midi_u8 = midi as u8;
        let bend    = 2f32.powf(self.pitch_bend_semitones / 12.0);

        if self.mono_mode {
            // Mono: always use slot 0. Release all other active voices immediately.
            for v in self.voices[1..].iter_mut() {
                if v.adsr.is_active() { v.adsr.note_off(); }
            }
            let v = &mut self.voices[0];
            v.base_freq = freq_hz;
            v.osc.set_frequency((freq_hz / self.detune_ratio) * bend);
            v.osc.reset_phase();
            v.osc2.set_frequency((freq_hz * self.detune_ratio) * bend);
            v.adsr.set_attack_ms(self.attack_ms);
            v.adsr.set_decay_ms(self.decay_ms);
            v.adsr.set_sustain(self.sustain);
            v.adsr.set_release_ms(self.release_ms);
            v.adsr.note_on();
            v.filt.set_cutoff(self.base_cutoff);
            v.filt.set_resonance(self.resonance);
            v.filt.set_filter_type(self.filter_type);
            v.midi = midi_u8;
            self.age_counter += 1;
            v.age = self.age_counter;
            return;
        }

        // Poly: retrigger in-place if this MIDI note is already sounding.
        for v in &mut self.voices {
            if v.midi == midi_u8 && v.adsr.is_active() {
                v.base_freq = freq_hz;
                v.osc.set_frequency((freq_hz / self.detune_ratio) * bend);
                v.osc.reset_phase();
                v.osc2.set_frequency((freq_hz * self.detune_ratio) * bend);
                v.adsr.note_on();
                self.age_counter += 1;
                v.age = self.age_counter;
                return;
            }
        }

        // Find a free voice, or steal the oldest active one.
        let slot = if let Some(i) = self.voices.iter().position(|v| !v.adsr.is_active()) {
            i
        } else {
            self.voices.iter().enumerate()
                .min_by_key(|(_, v)| v.age)
                .map(|(i, _)| i)
                .unwrap_or(0)
        };

        let v = &mut self.voices[slot];
        v.base_freq = freq_hz;
        v.osc.set_frequency((freq_hz / self.detune_ratio) * bend);
        v.osc.reset_phase();
        v.osc2.set_frequency((freq_hz * self.detune_ratio) * bend);
        v.adsr.set_attack_ms(self.attack_ms);
        v.adsr.set_decay_ms(self.decay_ms);
        v.adsr.set_sustain(self.sustain);
        v.adsr.set_release_ms(self.release_ms);
        v.adsr.note_on();
        v.filt.set_cutoff(self.base_cutoff);
        v.filt.set_resonance(self.resonance);
        v.filt.set_filter_type(self.filter_type);
        v.midi = midi_u8;
        self.age_counter += 1;
        v.age = self.age_counter;
    }

    pub fn note_off(&mut self, midi: u32) {
        if midi == NOTE_OFF_ALL {
            for v in &mut self.voices {
                if v.adsr.is_active() { v.adsr.note_off(); }
            }
            return;
        }
        let midi_u8 = midi as u8;
        if self.mono_mode {
            // In mono mode only slot 0 is used; only release it if it matches.
            let v = &mut self.voices[0];
            if v.midi == midi_u8 && v.adsr.is_active() { v.adsr.note_off(); }
            return;
        }
        for v in &mut self.voices {
            if v.midi == midi_u8 && v.adsr.is_active() { v.adsr.note_off(); }
        }
    }

    pub fn set_param(&mut self, id: u32, value: f32) {
        match id {
            SYNTH_PARAM_OSC_TYPE => {
                self.osc_type = OscType::from_u32(value as u32);
            }
            SYNTH_PARAM_ATTACK_MS => {
                self.attack_ms = value.clamp(1.0, 5000.0);
                for v in &mut self.voices { v.adsr.set_attack_ms(self.attack_ms); }
            }
            SYNTH_PARAM_DECAY_MS => {
                self.decay_ms = value.clamp(1.0, 5000.0);
                for v in &mut self.voices { v.adsr.set_decay_ms(self.decay_ms); }
            }
            SYNTH_PARAM_SUSTAIN => {
                self.sustain = value.clamp(0.0, 1.0);
                for v in &mut self.voices { v.adsr.set_sustain(self.sustain); }
            }
            SYNTH_PARAM_RELEASE_MS => {
                self.release_ms = value.clamp(1.0, 5000.0);
                for v in &mut self.voices { v.adsr.set_release_ms(self.release_ms); }
            }
            SYNTH_PARAM_CUTOFF_HZ => {
                self.base_cutoff = value.clamp(20.0, 20_000.0);
                for v in &mut self.voices { v.filt.set_cutoff(self.base_cutoff); }
            }
            SYNTH_PARAM_RESONANCE => {
                self.resonance = value.clamp(0.0, 0.95);
                for v in &mut self.voices { v.filt.set_resonance(self.resonance); }
            }
            SYNTH_PARAM_GAIN_DB => {
                self.gain_lin = db_to_lin(value.clamp(-24.0, 6.0));
            }
            SYNTH_PARAM_FILTER_TYPE => {
                self.filter_type = FilterType::from_u32(value as u32);
                for v in &mut self.voices { v.filt.set_filter_type(self.filter_type); }
            }
            SYNTH_PARAM_DETUNE_CENTS => {
                let cents = value.clamp(0.0, 50.0);
                self.detune_ratio = 2f32.powf(cents / 2400.0);
                let bend = 2f32.powf(self.pitch_bend_semitones / 12.0);
                for v in &mut self.voices {
                    if v.adsr.is_active() {
                        v.osc.set_frequency((v.base_freq / self.detune_ratio) * bend);
                        v.osc2.set_frequency((v.base_freq * self.detune_ratio) * bend);
                    }
                }
            }
            SYNTH_PARAM_LFO_RATE => {
                self.lfo_phase_inc = value.clamp(0.01, 20.0) / self.sample_rate;
            }
            SYNTH_PARAM_LFO_DEPTH => {
                self.lfo_depth = value.clamp(0.0, 1.0);
            }
            SYNTH_PARAM_PITCH_BEND => {
                self.pitch_bend_semitones = value.clamp(-12.0, 12.0);
                let bend = 2f32.powf(self.pitch_bend_semitones / 12.0);
                for v in &mut self.voices {
                    if v.adsr.is_active() {
                        v.osc.set_frequency((v.base_freq / self.detune_ratio) * bend);
                        v.osc2.set_frequency((v.base_freq * self.detune_ratio) * bend);
                    }
                }
            }
            SYNTH_PARAM_MONO_MODE => {
                self.mono_mode = value >= 0.5;
                // When switching to mono, silence voices 1..7 immediately.
                if self.mono_mode {
                    for v in self.voices[1..].iter_mut() {
                        if v.adsr.is_active() { v.adsr.note_off(); }
                    }
                }
            }
            _ => {}
        }
    }

    pub fn process(&mut self, output: &mut [f32]) {
        for s in output.iter_mut() {
            self.lfo_phase += self.lfo_phase_inc;
            if self.lfo_phase >= 1.0 { self.lfo_phase -= 1.0; }

            let lfo_sin = if self.lfo_depth > 1e-4 {
                (core::f32::consts::TAU * self.lfo_phase).sin()
            } else {
                0.0
            };

            let mut mix = 0.0f32;

            for v in &mut self.voices {
                if !v.adsr.is_active() { continue; }

                if self.lfo_depth > 1e-4 {
                    let mod_cutoff = (self.base_cutoff * 2f32.powf(self.lfo_depth * lfo_sin))
                        .clamp(20.0, 20_000.0);
                    v.filt.set_cutoff(mod_cutoff);
                }

                let env  = v.adsr.next_sample();
                let osc1 = v.osc.next_sample(self.osc_type);
                let osc2 = v.osc2.next_sample(self.osc_type);
                mix += v.filt.process_sample((osc1 + osc2) * 0.5 * env);
            }

            *s = flush_denormal(mix * self.gain_lin);
        }
    }
}

// ─── WASM exports ────────────────────────────────────────────────────────────

#[unsafe(no_mangle)]
pub extern "C" fn create_synth(sample_rate: f32) -> *mut PolyEngine {
    Box::into_raw(Box::new(PolyEngine::new(sample_rate)))
}

/// # Safety
/// `ptr` must be a valid pointer returned by `create_synth`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn synth_note_on(ptr: *mut PolyEngine, midi: u32, freq_hz: f32) {
    if ptr.is_null() { return; }
    unsafe { (*ptr).note_on(midi, freq_hz) };
}

/// # Safety
/// `ptr` must be a valid pointer returned by `create_synth`.
/// Pass `midi = 255` to silence all active voices.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn synth_note_off(ptr: *mut PolyEngine, midi: u32) {
    if ptr.is_null() { return; }
    unsafe { (*ptr).note_off(midi) };
}

/// # Safety
/// `ptr` and `output_ptr` must be valid.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn synth_process(ptr: *mut PolyEngine, output_ptr: *mut f32, frames: u32) {
    if ptr.is_null() || output_ptr.is_null() { return; }
    let output = unsafe { core::slice::from_raw_parts_mut(output_ptr, frames as usize) };
    unsafe { (*ptr).process(output) };
}

/// # Safety
/// `ptr` must be valid.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn synth_set_param(ptr: *mut PolyEngine, id: u32, value: f32) {
    if ptr.is_null() { return; }
    unsafe { (*ptr).set_param(id, value) };
}

/// # Safety
/// `ptr` must be valid and will be freed.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn destroy_synth(ptr: *mut PolyEngine) {
    if !ptr.is_null() {
        drop(unsafe { Box::from_raw(ptr) });
    }
}
