import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import * as engine from '@/audio/engine'
import { start as startEngine, getStatus } from '@/audio/engine'

// Param IDs must match Rust synth/mod.rs constants.
export const SYNTH_PARAM = {
  OSC_TYPE:   0,
  ATTACK_MS:  1,
  DECAY_MS:   2,
  SUSTAIN:    3,
  RELEASE_MS: 4,
  CUTOFF_HZ:  5,
  RESONANCE:  6,
  GAIN_DB:    7,
} as const

export const OSC_TYPES = [
  { id: 0, label: 'Sine' },
  { id: 1, label: 'Saw' },
  { id: 2, label: 'Square' },
  { id: 3, label: 'Triangle' },
  { id: 4, label: 'Noise' },
] as const

interface SynthState {
  active: boolean        // synth engine running in worklet
  oscType:    number
  attackMs:   number
  decayMs:    number
  sustain:    number
  releaseMs:  number
  cutoffHz:   number
  resonance:  number
  gainDb:     number

  startSynth: () => Promise<void>
  stopSynth:  () => void
  setOscType:   (v: number) => void
  setAttack:    (ms: number) => void
  setDecay:     (ms: number) => void
  setSustain:   (v: number) => void
  setRelease:   (ms: number) => void
  setCutoff:    (hz: number) => void
  setResonance: (v: number) => void
  setGain:      (db: number) => void
  noteOn:  (freqHz: number) => void
  noteOff: () => void
}

function setParamIfActive(paramId: number, value: number) {
  try { engine.synthSetParam(paramId, value) } catch { /* engine not ready */ }
}

export const useSynthStore = create<SynthState>()(
  devtools(
    persist(
      (set, get) => ({
        active:    false,
        oscType:   1,       // Saw
        attackMs:  10,
        decayMs:   200,
        sustain:   0.7,
        releaseMs: 400,
        cutoffHz:  4000,
        resonance: 0.0,
        gainDb:    -6,

        startSynth: async () => {
          if (getStatus().status !== 'running') await startEngine()
          engine.synthCreate()
          // Push current params to worklet
          const s = get()
          setParamIfActive(SYNTH_PARAM.OSC_TYPE,   s.oscType)
          setParamIfActive(SYNTH_PARAM.ATTACK_MS,  s.attackMs)
          setParamIfActive(SYNTH_PARAM.DECAY_MS,   s.decayMs)
          setParamIfActive(SYNTH_PARAM.SUSTAIN,    s.sustain)
          setParamIfActive(SYNTH_PARAM.RELEASE_MS, s.releaseMs)
          setParamIfActive(SYNTH_PARAM.CUTOFF_HZ,  s.cutoffHz)
          setParamIfActive(SYNTH_PARAM.RESONANCE,  s.resonance)
          setParamIfActive(SYNTH_PARAM.GAIN_DB,    s.gainDb)
          set({ active: true }, undefined, 'synth/start')
        },

        stopSynth: () => {
          try { engine.synthDestroy() } catch { /* */ }
          set({ active: false }, undefined, 'synth/stop')
        },

        setOscType: (v) => {
          set({ oscType: v }, undefined, 'synth/oscType')
          setParamIfActive(SYNTH_PARAM.OSC_TYPE, v)
        },
        setAttack: (ms) => {
          set({ attackMs: ms }, undefined, 'synth/attack')
          setParamIfActive(SYNTH_PARAM.ATTACK_MS, ms)
        },
        setDecay: (ms) => {
          set({ decayMs: ms }, undefined, 'synth/decay')
          setParamIfActive(SYNTH_PARAM.DECAY_MS, ms)
        },
        setSustain: (v) => {
          set({ sustain: v }, undefined, 'synth/sustain')
          setParamIfActive(SYNTH_PARAM.SUSTAIN, v)
        },
        setRelease: (ms) => {
          set({ releaseMs: ms }, undefined, 'synth/release')
          setParamIfActive(SYNTH_PARAM.RELEASE_MS, ms)
        },
        setCutoff: (hz) => {
          set({ cutoffHz: hz }, undefined, 'synth/cutoff')
          setParamIfActive(SYNTH_PARAM.CUTOFF_HZ, hz)
        },
        setResonance: (v) => {
          set({ resonance: v }, undefined, 'synth/resonance')
          setParamIfActive(SYNTH_PARAM.RESONANCE, v)
        },
        setGain: (db) => {
          set({ gainDb: db }, undefined, 'synth/gain')
          setParamIfActive(SYNTH_PARAM.GAIN_DB, db)
        },

        noteOn: (freqHz) => {
          try { engine.synthNoteOn(freqHz) } catch { /* */ }
        },
        noteOff: () => {
          try { engine.synthNoteOff() } catch { /* */ }
        },
      }),
      {
        name: 'synthStore',
        partialize: (s) => ({
          oscType: s.oscType, attackMs: s.attackMs, decayMs: s.decayMs,
          sustain: s.sustain, releaseMs: s.releaseMs, cutoffHz: s.cutoffHz,
          resonance: s.resonance, gainDb: s.gainDb,
        }),
      },
    ),
    { name: 'synthStore' },
  ),
)
