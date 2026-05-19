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
  detuneCents:  number
  // ADSR
  attackMs:     number
  decayMs:      number
  sustain:      number
  releaseMs:    number
  // Filter
  filterType:   number
  cutoffHz:     number
  resonance:    number
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

  startSynth: () => Promise<void>
  stopSynth:  () => void
  setOscType:     (v: number) => void
  setDetune:      (cents: number) => void
  setAttack:      (ms: number) => void
  setDecay:       (ms: number) => void
  setSustain:     (v: number) => void
  setRelease:     (ms: number) => void
  setFilterType:  (v: number) => void
  setCutoff:      (hz: number) => void
  setResonance:   (v: number) => void
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
  noteOn:  (freqHz: number) => void
  noteOff: () => void
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
        detuneCents:  0,
        attackMs:     10,
        decayMs:      200,
        sustain:      0.7,
        releaseMs:    400,
        filterType:   0,
        cutoffHz:     4000,
        resonance:    0.0,
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

        startSynth: async () => {
          if (getStatus().status !== 'running') await startEngine()
          engine.synthCreate()
          const s = get()
          send(SYNTH_PARAM.OSC_TYPE,     s.oscType)
          send(SYNTH_PARAM.ATTACK_MS,    s.attackMs)
          send(SYNTH_PARAM.DECAY_MS,     s.decayMs)
          send(SYNTH_PARAM.SUSTAIN,      s.sustain)
          send(SYNTH_PARAM.RELEASE_MS,   s.releaseMs)
          send(SYNTH_PARAM.FILTER_TYPE,  s.filterType)
          send(SYNTH_PARAM.CUTOFF_HZ,    s.cutoffHz)
          send(SYNTH_PARAM.RESONANCE,    s.resonance)
          send(SYNTH_PARAM.LFO_RATE,     s.lfoRate)
          send(SYNTH_PARAM.LFO_DEPTH,    s.lfoDepth)
          send(SYNTH_PARAM.GAIN_DB,      s.gainDb)
          send(SYNTH_PARAM.DETUNE_CENTS, s.detuneCents)
          set({ active: true }, undefined, 'synth/start')
        },

        stopSynth: () => {
          try { engine.synthDestroy() } catch { /* */ }
          set({ active: false, arpEnabled: false }, undefined, 'synth/stop')
        },

        setOscType:    (v)  => { set({ oscType: v },           undefined, 'synth/oscType');    send(SYNTH_PARAM.OSC_TYPE,     v)  },
        setDetune:     (c)  => { set({ detuneCents: c },       undefined, 'synth/detune');     send(SYNTH_PARAM.DETUNE_CENTS, c)  },
        setAttack:     (ms) => { set({ attackMs: ms },         undefined, 'synth/attack');     send(SYNTH_PARAM.ATTACK_MS,    ms) },
        setDecay:      (ms) => { set({ decayMs: ms },          undefined, 'synth/decay');      send(SYNTH_PARAM.DECAY_MS,     ms) },
        setSustain:    (v)  => { set({ sustain: v },           undefined, 'synth/sustain');    send(SYNTH_PARAM.SUSTAIN,      v)  },
        setRelease:    (ms) => { set({ releaseMs: ms },        undefined, 'synth/release');    send(SYNTH_PARAM.RELEASE_MS,   ms) },
        setFilterType: (v)  => { set({ filterType: v },        undefined, 'synth/filterType'); send(SYNTH_PARAM.FILTER_TYPE,  v)  },
        setCutoff:     (hz) => { set({ cutoffHz: hz },         undefined, 'synth/cutoff');     send(SYNTH_PARAM.CUTOFF_HZ,    hz) },
        setResonance:  (v)  => { set({ resonance: v },         undefined, 'synth/resonance');  send(SYNTH_PARAM.RESONANCE,    v)  },
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

        noteOn:  (freqHz) => { try { engine.synthNoteOn(freqHz) } catch { /* */ } },
        noteOff: ()       => { try { engine.synthNoteOff()      } catch { /* */ } },
      }),
      {
        name: 'synthStore',
        partialize: (s) => ({
          oscType: s.oscType, detuneCents: s.detuneCents,
          attackMs: s.attackMs, decayMs: s.decayMs, sustain: s.sustain, releaseMs: s.releaseMs,
          filterType: s.filterType, cutoffHz: s.cutoffHz, resonance: s.resonance,
          lfoRate: s.lfoRate, lfoDepth: s.lfoDepth, gainDb: s.gainDb,
          octaveShift: s.octaveShift,
          arpMode: s.arpMode, arpBpm: s.arpBpm, arpDivision: s.arpDivision, arpOctaves: s.arpOctaves, arpGate: s.arpGate,
        }),
      },
    ),
    { name: 'synthStore' },
  ),
)
