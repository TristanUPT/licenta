import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import * as engine from '@/audio/engine'
import { start as startEngine, getStatus } from '@/audio/engine'

// Param IDs must match Rust synth/mod.rs constants.
export const SYNTH_PARAM = {
  OSC_TYPE:     0,
  ATTACK_MS:    1,
  DECAY_MS:     2,
  SUSTAIN:      3,
  RELEASE_MS:   4,
  CUTOFF_HZ:    5,
  RESONANCE:    6,
  GAIN_DB:      7,
  FILTER_TYPE:  8,
  DETUNE_CENTS: 9,
  LFO_RATE:     10,
  LFO_DEPTH:    11,
  PITCH_BEND:   12,  // semitones ±12
  MONO_MODE:    13,  // 0 = poly, 1 = mono
  OSC2_TYPE:    14,  // same values as OSC_TYPE
  FILTER_ENV:   15,  // octaves ±4, scales ADSR onto cutoff
} as const

export const OSC_TYPES = [
  { id: 0, label: 'Sine' },
  { id: 1, label: 'Saw' },
  { id: 2, label: 'Square' },
  { id: 3, label: 'Triangle' },
  { id: 4, label: 'Noise' },
] as const

export const FILTER_TYPES = [
  { id: 0, label: 'LP' },
  { id: 1, label: 'BP' },
  { id: 2, label: 'HP' },
] as const

export type ArpMode = 'up' | 'down' | 'updown' | 'random'

export interface SavedPatch {
  id: string
  name: string
  oscType: number; osc2Type: number; detuneCents: number
  attackMs: number; decayMs: number; sustain: number; releaseMs: number
  filterType: number; cutoffHz: number; resonance: number; filterEnvAmount: number
  lfoRate: number; lfoDepth: number; gainDb: number
}

// oscType: 0=Sine 1=Saw 2=Square 3=Triangle 4=Noise
// filterType: 0=LP 1=BP 2=HP
export const FACTORY_SYNTH_PATCHES: SavedPatch[] = [
  { id: 'factory:init',       name: 'Init',         oscType: 1, osc2Type: 1, detuneCents: 0,  attackMs: 10,   decayMs: 200,  sustain: 0.7, releaseMs: 400,  filterType: 0, cutoffHz: 4000,  resonance: 0.0,  filterEnvAmount: 0.0, lfoRate: 2.0, lfoDepth: 0.0, gainDb: -6  },
  { id: 'factory:pad',        name: 'Warm Pad',      oscType: 0, osc2Type: 3, detuneCents: 8,  attackMs: 600,  decayMs: 400,  sustain: 0.8, releaseMs: 1200, filterType: 0, cutoffHz: 1200,  resonance: 0.15, filterEnvAmount: 0.5, lfoRate: 0.4, lfoDepth: 0.3, gainDb: -8  },
  { id: 'factory:bass',       name: 'Sub Bass',      oscType: 2, osc2Type: 1, detuneCents: 0,  attackMs: 8,    decayMs: 120,  sustain: 0.6, releaseMs: 80,   filterType: 0, cutoffHz: 350,   resonance: 0.4,  filterEnvAmount: 1.5, lfoRate: 2.0, lfoDepth: 0.0, gainDb: -4  },
  { id: 'factory:lead',       name: 'Lead Saw',      oscType: 1, osc2Type: 1, detuneCents: 5,  attackMs: 15,   decayMs: 180,  sustain: 0.65,releaseMs: 200,  filterType: 0, cutoffHz: 3200,  resonance: 0.35, filterEnvAmount: 0.0, lfoRate: 5.5, lfoDepth: 0.2, gainDb: -7  },
  { id: 'factory:pluck',      name: 'Pluck',         oscType: 1, osc2Type: 2, detuneCents: 0,  attackMs: 5,    decayMs: 350,  sustain: 0.0, releaseMs: 150,  filterType: 0, cutoffHz: 2800,  resonance: 0.55, filterEnvAmount: 2.0, lfoRate: 2.0, lfoDepth: 0.0, gainDb: -6  },
  { id: 'factory:keys',       name: 'Keys',          oscType: 3, osc2Type: 0, detuneCents: 3,  attackMs: 10,   decayMs: 500,  sustain: 0.4, releaseMs: 600,  filterType: 0, cutoffHz: 5000,  resonance: 0.1,  filterEnvAmount: 1.0, lfoRate: 2.0, lfoDepth: 0.0, gainDb: -7  },
  { id: 'factory:strings',    name: 'Strings',       oscType: 1, osc2Type: 3, detuneCents: 12, attackMs: 300,  decayMs: 200,  sustain: 0.75,releaseMs: 800,  filterType: 0, cutoffHz: 2000,  resonance: 0.1,  filterEnvAmount: 0.3, lfoRate: 5.0, lfoDepth: 0.15,gainDb: -9  },
  { id: 'factory:organ',      name: 'Organ',         oscType: 0, osc2Type: 2, detuneCents: 0,  attackMs: 10,   decayMs: 10,   sustain: 1.0, releaseMs: 30,   filterType: 0, cutoffHz: 8000,  resonance: 0.0,  filterEnvAmount: 0.0, lfoRate: 6.5, lfoDepth: 0.1, gainDb: -6  },
  { id: 'factory:wobble',     name: 'Wobble Bass',   oscType: 2, osc2Type: 2, detuneCents: 0,  attackMs: 10,   decayMs: 200,  sustain: 0.7, releaseMs: 150,  filterType: 0, cutoffHz: 600,   resonance: 0.7,  filterEnvAmount: 0.0, lfoRate: 2.0, lfoDepth: 0.8, gainDb: -5  },
  { id: 'factory:noise-sweep',name: 'Noise Sweep',   oscType: 4, osc2Type: 4, detuneCents: 0,  attackMs: 800,  decayMs: 600,  sustain: 0.0, releaseMs: 400,  filterType: 0, cutoffHz: 800,   resonance: 0.6,  filterEnvAmount: 0.0, lfoRate: 0.2, lfoDepth: 0.9, gainDb: -10 },
  { id: 'factory:bright-lead',name: 'Bright Lead',   oscType: 2, osc2Type: 1, detuneCents: 2,  attackMs: 5,    decayMs: 100,  sustain: 0.55,releaseMs: 120,  filterType: 0, cutoffHz: 6000,  resonance: 0.3,  filterEnvAmount: 0.5, lfoRate: 4.0, lfoDepth: 0.1, gainDb: -7  },
  { id: 'factory:soft-bell',  name: 'Soft Bell',     oscType: 0, osc2Type: 3, detuneCents: 0,  attackMs: 5,    decayMs: 1200, sustain: 0.0, releaseMs: 800,  filterType: 2, cutoffHz: 4000,  resonance: 0.2,  filterEnvAmount: 2.5, lfoRate: 2.0, lfoDepth: 0.0, gainDb: -8  },
]

export const ARP_MODES: { id: ArpMode; label: string; labelRo: string }[] = [
  { id: 'up',     label: 'Up',   labelRo: 'Sus'  },
  { id: 'down',   label: 'Dn',   labelRo: 'Jos'  },
  { id: 'updown', label: '↕',    labelRo: '↕'    },
  { id: 'random', label: 'Rnd',  labelRo: 'Rnd'  },
]

export const ARP_DIVISIONS: { value: number; label: string }[] = [
  { value: 4,  label: '1/4'  },
  { value: 8,  label: '1/8'  },
  { value: 16, label: '1/16' },
  { value: 32, label: '1/32' },
]

interface SynthState {
  active: boolean
  // Oscillator
  oscType:      number
  osc2Type:     number
  detuneCents:  number
  // ADSR
  attackMs:     number
  decayMs:      number
  sustain:      number
  releaseMs:    number
  // Filter
  filterType:      number
  cutoffHz:        number
  resonance:       number
  filterEnvAmount: number
  // LFO
  lfoRate:      number
  lfoDepth:     number
  // Output
  gainDb:       number
  // Frontend-only octave shift
  octaveShift:  number
  // Arpeggiator
  arpEnabled:   boolean
  arpMode:      ArpMode
  arpBpm:       number
  arpDivision:  number   // 4 = quarter, 8 = eighth, 16 = sixteenth, 32 = thirty-second
  arpOctaves:   number   // 1 | 2 | 3
  arpGate:      number   // 0.1–1.0, note length as fraction of step interval
  monoMode:     boolean
  // User-saved patches
  savedPatches:    SavedPatch[]
  savePatch:       (name: string) => void
  deleteSavedPatch:(id: string) => void

  startSynth: () => Promise<void>
  stopSynth:  () => void
  setOscType:     (v: number) => void
  setOsc2Type:    (v: number) => void
  setDetune:      (cents: number) => void
  setAttack:      (ms: number) => void
  setDecay:       (ms: number) => void
  setSustain:     (v: number) => void
  setRelease:     (ms: number) => void
  setFilterType:      (v: number) => void
  setCutoff:          (hz: number) => void
  setResonance:       (v: number) => void
  setFilterEnvAmount: (v: number) => void
  setLfoRate:     (hz: number) => void
  setLfoDepth:    (v: number) => void
  setGain:        (db: number) => void
  setOctaveShift: (n: number) => void
  setArpEnabled:  (v: boolean) => void
  setArpMode:     (m: ArpMode) => void
  setArpBpm:      (bpm: number) => void
  setArpDivision: (d: number) => void
  setArpOctaves:  (n: number) => void
  setArpGate:     (g: number) => void
  setMonoMode:    (v: boolean) => void
  noteOn:     (midi: number, freqHz: number) => void
  noteOff:    (midi: number) => void
  noteOffAll: () => void
}

function send(paramId: number, value: number) {
  try { engine.synthSetParam(paramId, value) } catch { /* engine not ready */ }
}

export const useSynthStore = create<SynthState>()(
  devtools(
    persist(
      (set, get) => ({
        active:       false,
        oscType:      1,
        osc2Type:     1,
        detuneCents:  0,
        attackMs:     10,
        decayMs:      200,
        sustain:      0.7,
        releaseMs:    400,
        filterType:      0,
        cutoffHz:        4000,
        resonance:       0.0,
        filterEnvAmount: 0.0,
        lfoRate:      2.0,
        lfoDepth:     0.0,
        gainDb:       -6,
        octaveShift:  0,
        arpEnabled:   false,
        arpMode:      'up',
        arpBpm:       120,
        arpDivision:  8,
        arpOctaves:   1,
        arpGate:      0.8,
        monoMode:     false,

        startSynth: async () => {
          if (getStatus().status !== 'running') await startEngine()
          engine.synthCreate()
          const s = get()
          send(SYNTH_PARAM.OSC_TYPE,     s.oscType)
          send(SYNTH_PARAM.OSC2_TYPE,    s.osc2Type)
          send(SYNTH_PARAM.ATTACK_MS,    s.attackMs)
          send(SYNTH_PARAM.DECAY_MS,     s.decayMs)
          send(SYNTH_PARAM.SUSTAIN,      s.sustain)
          send(SYNTH_PARAM.RELEASE_MS,   s.releaseMs)
          send(SYNTH_PARAM.FILTER_TYPE,  s.filterType)
          send(SYNTH_PARAM.CUTOFF_HZ,    s.cutoffHz)
          send(SYNTH_PARAM.RESONANCE,    s.resonance)
          send(SYNTH_PARAM.FILTER_ENV,   s.filterEnvAmount)
          send(SYNTH_PARAM.LFO_RATE,     s.lfoRate)
          send(SYNTH_PARAM.LFO_DEPTH,    s.lfoDepth)
          send(SYNTH_PARAM.GAIN_DB,      s.gainDb)
          send(SYNTH_PARAM.DETUNE_CENTS, s.detuneCents)
          send(SYNTH_PARAM.MONO_MODE,    s.monoMode ? 1 : 0)
          set({ active: true }, undefined, 'synth/start')
        },

        stopSynth: () => {
          try { engine.synthDestroy() } catch { /* */ }
          set({ active: false, arpEnabled: false }, undefined, 'synth/stop')
        },

        setOscType:    (v)  => { set({ oscType: v },            undefined, 'synth/oscType');    send(SYNTH_PARAM.OSC_TYPE,     v)  },
        setOsc2Type:   (v)  => { set({ osc2Type: v },          undefined, 'synth/osc2Type');   send(SYNTH_PARAM.OSC2_TYPE,    v)  },
        setDetune:     (c)  => { set({ detuneCents: c },       undefined, 'synth/detune');     send(SYNTH_PARAM.DETUNE_CENTS, c)  },
        setAttack:     (ms) => { set({ attackMs: ms },         undefined, 'synth/attack');     send(SYNTH_PARAM.ATTACK_MS,    ms) },
        setDecay:      (ms) => { set({ decayMs: ms },          undefined, 'synth/decay');      send(SYNTH_PARAM.DECAY_MS,     ms) },
        setSustain:    (v)  => { set({ sustain: v },           undefined, 'synth/sustain');    send(SYNTH_PARAM.SUSTAIN,      v)  },
        setRelease:    (ms) => { set({ releaseMs: ms },        undefined, 'synth/release');    send(SYNTH_PARAM.RELEASE_MS,   ms) },
        setFilterType: (v)  => { set({ filterType: v },        undefined, 'synth/filterType'); send(SYNTH_PARAM.FILTER_TYPE,  v)  },
        setCutoff:     (hz) => { set({ cutoffHz: hz },         undefined, 'synth/cutoff');     send(SYNTH_PARAM.CUTOFF_HZ,    hz) },
        setResonance:      (v)  => { set({ resonance: v },         undefined, 'synth/resonance');      send(SYNTH_PARAM.RESONANCE,    v)  },
        setFilterEnvAmount:(v)  => { set({ filterEnvAmount: v }, undefined, 'synth/filterEnv');        send(SYNTH_PARAM.FILTER_ENV,   v)  },
        setLfoRate:    (hz) => { set({ lfoRate: hz },          undefined, 'synth/lfoRate');    send(SYNTH_PARAM.LFO_RATE,     hz) },
        setLfoDepth:   (v)  => { set({ lfoDepth: v },          undefined, 'synth/lfoDepth');   send(SYNTH_PARAM.LFO_DEPTH,    v)  },
        setGain:       (db) => { set({ gainDb: db },           undefined, 'synth/gain');       send(SYNTH_PARAM.GAIN_DB,      db) },
        setOctaveShift:(n)  => { set({ octaveShift: n },       undefined, 'synth/octave')                                         },
        setArpEnabled: (v)  => { set({ arpEnabled: v },        undefined, 'synth/arpEnabled')                                     },
        setArpMode:    (m)  => { set({ arpMode: m },           undefined, 'synth/arpMode')                                        },
        setArpBpm:     (b)  => { set({ arpBpm: b },            undefined, 'synth/arpBpm')                                         },
        setArpDivision:(d)  => { set({ arpDivision: d },       undefined, 'synth/arpDiv')                                         },
        setArpOctaves: (n)  => { set({ arpOctaves: n },        undefined, 'synth/arpOct')                                         },
        setArpGate:    (g)  => { set({ arpGate: g },           undefined, 'synth/arpGate')                                        },
        setMonoMode:   (v)  => { set({ monoMode: v },          undefined, 'synth/monoMode'); send(SYNTH_PARAM.MONO_MODE, v ? 1 : 0) },

        savedPatches: [],
        savePatch: (name) => {
          const s = get()
          const patch: SavedPatch = {
            id: `user:${Date.now()}`,
            name: name.trim() || 'Untitled',
            oscType: s.oscType, osc2Type: s.osc2Type, detuneCents: s.detuneCents,
            attackMs: s.attackMs, decayMs: s.decayMs, sustain: s.sustain, releaseMs: s.releaseMs,
            filterType: s.filterType, cutoffHz: s.cutoffHz, resonance: s.resonance, filterEnvAmount: s.filterEnvAmount,
            lfoRate: s.lfoRate, lfoDepth: s.lfoDepth, gainDb: s.gainDb,
          }
          set((prev) => ({ savedPatches: [...prev.savedPatches, patch] }), undefined, 'synth/savePatch')
        },
        deleteSavedPatch: (id) =>
          set((prev) => ({ savedPatches: prev.savedPatches.filter((p) => p.id !== id) }), undefined, 'synth/deletePatch'),

        noteOn:     (midi, freq) => { try { engine.synthNoteOn(midi, freq)  } catch { /* */ } },
        noteOff:    (midi)       => { try { engine.synthNoteOff(midi)       } catch { /* */ } },
        noteOffAll: ()           => { try { engine.synthNoteOff(255)        } catch { /* */ } },
      }),
      {
        name: 'synthStore',
        partialize: (s) => ({
          oscType: s.oscType, osc2Type: s.osc2Type, detuneCents: s.detuneCents,
          attackMs: s.attackMs, decayMs: s.decayMs, sustain: s.sustain, releaseMs: s.releaseMs,
          filterType: s.filterType, cutoffHz: s.cutoffHz, resonance: s.resonance, filterEnvAmount: s.filterEnvAmount,
          lfoRate: s.lfoRate, lfoDepth: s.lfoDepth, gainDb: s.gainDb,
          octaveShift: s.octaveShift,
          arpMode: s.arpMode, arpBpm: s.arpBpm, arpDivision: s.arpDivision, arpOctaves: s.arpOctaves, arpGate: s.arpGate,
          monoMode: s.monoMode,
          savedPatches: s.savedPatches,
        }),
      },
    ),
    { name: 'synthStore' },
  ),
)
