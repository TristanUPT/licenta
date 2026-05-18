import { useEffect, useMemo, useRef, useState } from 'react'
import {
  useSynthStore, OSC_TYPES, FILTER_TYPES,
  ARP_MODES, ARP_DIVISIONS, type ArpMode,
} from '@/store/synthStore'
import { useEducationStore } from '@/store/educationStore'

// ─── MIDI helpers ─────────────────────────────────────────────────────────────

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

function midiToName(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  return `${names[midi % 12] ?? ''}${Math.floor(midi / 12) - 1}`
}

// ─── Piano layout ─────────────────────────────────────────────────────────────

const KEY_COUNT = 25

interface PianoKey { midi: number; isBlack: boolean }

function buildKeys(startMidi: number): PianoKey[] {
  return Array.from({ length: KEY_COUNT }, (_, i) => {
    const midi = startMidi + i
    return { midi, isBlack: [1, 3, 6, 8, 10].includes(midi % 12) }
  })
}

// Keyboard layout: offset from effective start MIDI
const KEY_OFFSETS: Record<string, number> = {
  'KeyA': 0,  'KeyW': 1,  'KeyS': 2,  'KeyE': 3,  'KeyD': 4,
  'KeyF': 5,  'KeyT': 6,  'KeyG': 7,  'KeyY': 8,  'KeyH': 9,
  'KeyU': 10, 'KeyJ': 11, 'KeyK': 12, 'KeyO': 13, 'KeyL': 14,
  'KeyP': 15, 'Semicolon': 16,
}

// ─── Arpeggiator helpers ──────────────────────────────────────────────────────

function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
  return arr
}

function buildArpSeq(notes: Set<number>, mode: ArpMode, octaves: number): number[] {
  if (notes.size === 0) return []
  const sorted = [...notes].sort((a, b) => a - b)
  const expanded: number[] = []
  for (let o = 0; o < octaves; o++) {
    expanded.push(...sorted.map((n) => n + o * 12))
  }
  switch (mode) {
    case 'up':     return expanded
    case 'down':   return [...expanded].reverse()
    case 'updown':
      if (expanded.length <= 1) return expanded
      return [...expanded, ...[...expanded].reverse().slice(1, -1)]
    case 'random': return shuffleArray([...expanded])
  }
}

// ─── Synth patches ────────────────────────────────────────────────────────────

interface Patch {
  name: string; nameRo: string
  oscType: number; detuneCents: number
  attackMs: number; decayMs: number; sustain: number; releaseMs: number
  filterType: number; cutoffHz: number; resonance: number
  lfoRate: number; lfoDepth: number; gainDb: number
}

const PATCHES: Patch[] = [
  { name: 'Init',    nameRo: 'Init',   oscType: 1, detuneCents: 0,  attackMs: 10,  decayMs: 200, sustain: 0.7, releaseMs: 400,  filterType: 0, cutoffHz: 4000, resonance: 0.0, lfoRate: 2,   lfoDepth: 0,    gainDb: -6 },
  { name: 'Pluck',   nameRo: 'Pluck',  oscType: 1, detuneCents: 5,  attackMs: 2,   decayMs: 150, sustain: 0.0, releaseMs: 120,  filterType: 0, cutoffHz: 3000, resonance: 0.3, lfoRate: 2,   lfoDepth: 0,    gainDb: -6 },
  { name: 'Pad',     nameRo: 'Pad',    oscType: 0, detuneCents: 8,  attackMs: 500, decayMs: 300, sustain: 0.8, releaseMs: 1500, filterType: 0, cutoffHz: 2000, resonance: 0.1, lfoRate: 0.5, lfoDepth: 0.3,  gainDb: -8 },
  { name: 'Lead',    nameRo: 'Lead',   oscType: 2, detuneCents: 0,  attackMs: 5,   decayMs: 100, sustain: 0.8, releaseMs: 200,  filterType: 0, cutoffHz: 6000, resonance: 0.5, lfoRate: 5,   lfoDepth: 0.2,  gainDb: -6 },
  { name: 'Bass',    nameRo: 'Bass',   oscType: 1, detuneCents: 3,  attackMs: 5,   decayMs: 250, sustain: 0.6, releaseMs: 150,  filterType: 0, cutoffHz: 800,  resonance: 0.4, lfoRate: 2,   lfoDepth: 0,    gainDb: -4 },
  { name: 'Strings', nameRo: 'Corzi',  oscType: 1, detuneCents: 12, attackMs: 200, decayMs: 400, sustain: 0.7, releaseMs: 800,  filterType: 0, cutoffHz: 3500, resonance: 0.2, lfoRate: 3,   lfoDepth: 0.15, gainDb: -7 },
]

// ─── Vertical slider ──────────────────────────────────────────────────────────

interface SliderProps {
  label: string; value: number; min: number; max: number
  format?: (v: number) => string; onChange: (v: number) => void; log?: boolean
}

function Slider({ label, value, min, max, format, onChange, log }: SliderProps) {
  const toLinear = (v: number) =>
    log ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min)
  const toValue = (t: number) =>
    log ? min * Math.pow(max / min, t) : min + t * (max - min)
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[9px] uppercase tracking-wider text-zinc-500">{label}</span>
      <input
        type="range" min={0} max={1} step={0.001}
        value={toLinear(value)}
        onChange={(e) => onChange(toValue(Number(e.target.value)))}
        className="h-20 w-3 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-purple-500"
        style={{ writingMode: 'vertical-lr', direction: 'rtl' } as React.CSSProperties}
      />
      <span className="w-12 text-center font-mono text-[9px] text-zinc-400">
        {format ? format(value) : value.toFixed(1)}
      </span>
    </div>
  )
}

// ─── SynthLab ─────────────────────────────────────────────────────────────────

const START_MIDI_BASE = 48  // C3 at octaveShift = 0

export function SynthLab() {
  const ro = useEducationStore((s) => s.language) === 'ro'

  // ── Synth params ──
  const active        = useSynthStore((s) => s.active)
  const oscType       = useSynthStore((s) => s.oscType)
  const detuneCents   = useSynthStore((s) => s.detuneCents)
  const attackMs      = useSynthStore((s) => s.attackMs)
  const decayMs       = useSynthStore((s) => s.decayMs)
  const sustain       = useSynthStore((s) => s.sustain)
  const releaseMs     = useSynthStore((s) => s.releaseMs)
  const filterType    = useSynthStore((s) => s.filterType)
  const cutoffHz      = useSynthStore((s) => s.cutoffHz)
  const resonance     = useSynthStore((s) => s.resonance)
  const lfoRate       = useSynthStore((s) => s.lfoRate)
  const lfoDepth      = useSynthStore((s) => s.lfoDepth)
  const gainDb        = useSynthStore((s) => s.gainDb)
  const octaveShift   = useSynthStore((s) => s.octaveShift)

  const startSynth    = useSynthStore((s) => s.startSynth)
  const stopSynth     = useSynthStore((s) => s.stopSynth)
  const setOscType    = useSynthStore((s) => s.setOscType)
  const setDetune     = useSynthStore((s) => s.setDetune)
  const setAttack     = useSynthStore((s) => s.setAttack)
  const setDecay      = useSynthStore((s) => s.setDecay)
  const setSustain    = useSynthStore((s) => s.setSustain)
  const setRelease    = useSynthStore((s) => s.setRelease)
  const setFilterType = useSynthStore((s) => s.setFilterType)
  const setCutoff     = useSynthStore((s) => s.setCutoff)
  const setResonance  = useSynthStore((s) => s.setResonance)
  const setLfoRate    = useSynthStore((s) => s.setLfoRate)
  const setLfoDepth   = useSynthStore((s) => s.setLfoDepth)
  const setGain       = useSynthStore((s) => s.setGain)
  const setOctaveShift = useSynthStore((s) => s.setOctaveShift)
  const noteOn        = useSynthStore((s) => s.noteOn)
  const noteOff       = useSynthStore((s) => s.noteOff)

  // ── Arp params ──
  const arpEnabled   = useSynthStore((s) => s.arpEnabled)
  const arpMode      = useSynthStore((s) => s.arpMode)
  const arpBpm       = useSynthStore((s) => s.arpBpm)
  const arpDivision  = useSynthStore((s) => s.arpDivision)
  const arpOctaves   = useSynthStore((s) => s.arpOctaves)
  const setArpEnabled  = useSynthStore((s) => s.setArpEnabled)
  const setArpMode     = useSynthStore((s) => s.setArpMode)
  const setArpBpm      = useSynthStore((s) => s.setArpBpm)
  const setArpDivision = useSynthStore((s) => s.setArpDivision)
  const setArpOctaves  = useSynthStore((s) => s.setArpOctaves)

  // ── Visual state ──
  const [activeNote, setActiveNote] = useState<number | null>(null)

  // ── Stable refs (keyboard handler reads these without re-registering) ──
  const effectiveStartRef = useRef(START_MIDI_BASE + octaveShift * 12)
  effectiveStartRef.current = START_MIDI_BASE + octaveShift * 12

  const arpEnabledRef = useRef(arpEnabled)
  arpEnabledRef.current = arpEnabled
  const arpModeRef = useRef(arpMode)
  arpModeRef.current = arpMode
  const arpOctavesRef = useRef(arpOctaves)
  arpOctavesRef.current = arpOctaves

  const activeNoteRef  = useRef<number | null>(null)
  const heldKeys       = useRef<Set<string>>(new Set())
  const arpNotesRef    = useRef<Set<number>>(new Set())
  const arpStepRef     = useRef(0)
  const arpSeqRef      = useRef<number[]>([])

  // ── Piano layout ──
  const effectiveStartMidi = START_MIDI_BASE + octaveShift * 12
  const pianoKeys = useMemo(() => buildKeys(effectiveStartMidi), [effectiveStartMidi])
  const whiteKeys = useMemo(() => pianoKeys.filter((k) => !k.isBlack), [pianoKeys])
  const blackKeys = useMemo(() => pianoKeys.filter((k) => k.isBlack), [pianoKeys])

  // ── Note-on / note-off helpers (arp-aware, called from piano + keyboard) ──
  const noteOnRef  = useRef(noteOn)
  noteOnRef.current = noteOn
  const noteOffRef = useRef(noteOff)
  noteOffRef.current = noteOff

  function handleNoteOn(midi: number) {
    if (!active) return
    if (arpEnabledRef.current) {
      arpNotesRef.current.add(midi)
      arpSeqRef.current = buildArpSeq(arpNotesRef.current, arpModeRef.current, arpOctavesRef.current)
      if (arpNotesRef.current.size === 1) arpStepRef.current = 0
    } else {
      noteOnRef.current(midiToFreq(midi))
      setActiveNote(midi)
      activeNoteRef.current = midi
    }
  }

  function handleNoteOff(midi: number) {
    if (!active) return
    if (arpEnabledRef.current) {
      arpNotesRef.current.delete(midi)
      arpSeqRef.current = buildArpSeq(arpNotesRef.current, arpModeRef.current, arpOctavesRef.current)
      if (arpNotesRef.current.size === 0) {
        noteOffRef.current()
        setActiveNote(null)
        activeNoteRef.current = null
        arpStepRef.current = 0
      }
    } else {
      if (activeNoteRef.current === midi) {
        noteOffRef.current()
        setActiveNote(null)
        activeNoteRef.current = null
      }
    }
  }

  // ── Keyboard shortcuts ──
  useEffect(() => {
    if (!active) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat || e.target instanceof HTMLInputElement) return
      const offset = KEY_OFFSETS[e.code]
      if (offset === undefined) return
      if (heldKeys.current.has(e.code)) return
      heldKeys.current.add(e.code)
      const midi = effectiveStartRef.current + offset

      if (arpEnabledRef.current) {
        arpNotesRef.current.add(midi)
        arpSeqRef.current = buildArpSeq(arpNotesRef.current, arpModeRef.current, arpOctavesRef.current)
        if (arpNotesRef.current.size === 1) arpStepRef.current = 0
      } else {
        noteOnRef.current(midiToFreq(midi))
        setActiveNote(midi)
        activeNoteRef.current = midi
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      const offset = KEY_OFFSETS[e.code]
      if (offset === undefined) return
      heldKeys.current.delete(e.code)
      const midi = effectiveStartRef.current + offset

      if (arpEnabledRef.current) {
        arpNotesRef.current.delete(midi)
        arpSeqRef.current = buildArpSeq(arpNotesRef.current, arpModeRef.current, arpOctavesRef.current)
        if (arpNotesRef.current.size === 0) {
          noteOffRef.current()
          setActiveNote(null)
          activeNoteRef.current = null
          arpStepRef.current = 0
        }
      } else {
        if (heldKeys.current.size === 0) {
          noteOffRef.current()
          setActiveNote(null)
          activeNoteRef.current = null
        } else if (activeNoteRef.current === midi) {
          // Retrigger last held key
          const codes = [...heldKeys.current]
          const lastOffset = KEY_OFFSETS[codes[codes.length - 1] ?? '']
          if (lastOffset !== undefined) {
            const lastMidi = effectiveStartRef.current + lastOffset
            noteOnRef.current(midiToFreq(lastMidi))
            setActiveNote(lastMidi)
            activeNoteRef.current = lastMidi
          }
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [active])

  // ── Arpeggiator timer ──
  useEffect(() => {
    if (!arpEnabled || !active) {
      // Ensure silence when arp is off
      noteOffRef.current()
      setActiveNote(null)
      activeNoteRef.current = null
      return
    }

    // (Re-)initialize sequence when arp settings change
    arpSeqRef.current = buildArpSeq(arpNotesRef.current, arpMode, arpOctaves)
    arpStepRef.current = 0

    const intervalMs = (60_000 / arpBpm) / (arpDivision / 4)

    const id = setInterval(() => {
      const seq = arpSeqRef.current
      if (seq.length === 0) {
        noteOffRef.current()
        setActiveNote(null)
        activeNoteRef.current = null
        return
      }

      // Wrap step; reshuffle for random at cycle boundary
      if (arpStepRef.current >= seq.length) {
        arpStepRef.current = 0
        if (arpModeRef.current === 'random') {
          arpSeqRef.current = shuffleArray([...seq])
        }
      }

      const midi = arpSeqRef.current[arpStepRef.current]
      if (midi !== undefined) {
        noteOnRef.current(midiToFreq(midi))
        setActiveNote(midi)
        activeNoteRef.current = midi
      }
      arpStepRef.current++
    }, intervalMs)

    return () => {
      clearInterval(id)
      noteOffRef.current()
      setActiveNote(null)
      activeNoteRef.current = null
    }
  }, [arpEnabled, active, arpBpm, arpDivision, arpMode, arpOctaves])

  // ── Helpers ──
  function handleArpToggle(v: boolean) {
    if (v) {
      // Seed arp from keys currently held on keyboard
      arpNotesRef.current.clear()
      for (const code of heldKeys.current) {
        const offset = KEY_OFFSETS[code]
        if (offset !== undefined) arpNotesRef.current.add(effectiveStartRef.current + offset)
      }
      arpSeqRef.current = buildArpSeq(arpNotesRef.current, arpModeRef.current, arpOctavesRef.current)
      arpStepRef.current = 0
    } else {
      arpNotesRef.current.clear()
      arpSeqRef.current = []
    }
    setArpEnabled(v)
  }

  function handleOctaveShift(n: number) {
    // Clear arp notes to avoid stuck notes when octave changes mid-play
    arpNotesRef.current.clear()
    arpSeqRef.current = []
    heldKeys.current.clear()
    noteOffRef.current()
    setActiveNote(null)
    activeNoteRef.current = null
    setOctaveShift(n)
  }

  function loadPatch(p: Patch) {
    setOscType(p.oscType);    setDetune(p.detuneCents)
    setAttack(p.attackMs);   setDecay(p.decayMs);  setSustain(p.sustain);  setRelease(p.releaseMs)
    setFilterType(p.filterType); setCutoff(p.cutoffHz); setResonance(p.resonance)
    setLfoRate(p.lfoRate);   setLfoDepth(p.lfoDepth); setGain(p.gainDb)
  }

  function blackKeyLeft(midi: number): number {
    const noteInOct = midi % 12
    const OFFSETS: Record<number, number> = { 1: 0.65, 3: 1.65, 6: 3.65, 8: 4.65, 10: 5.65 }
    const octaveOffset = Math.floor((midi - effectiveStartMidi) / 12) * 7
    return (octaveOffset + (OFFSETS[noteInOct] ?? 0)) / whiteKeys.length * 100
  }

  const startOctave = Math.floor(effectiveStartMidi / 12) - 1
  const endOctave   = Math.floor((effectiveStartMidi + KEY_COUNT - 1) / 12) - 1

  // ── Render ──
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">

      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-zinc-300">Synth Lab</h2>
          {activeNote !== null && (
            <span className="font-mono text-xs font-semibold text-purple-400">
              {midiToName(activeNote)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Octave selector */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => handleOctaveShift(Math.max(-2, octaveShift - 1))}
              disabled={octaveShift <= -2}
              title={ro ? 'Octavă jos' : 'Octave down'}
              className="rounded px-1.5 py-0.5 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30"
            >◂</button>
            <span className="min-w-[3.2rem] text-center font-mono text-[10px] text-zinc-400">
              C{startOctave}–C{endOctave}
            </span>
            <button
              onClick={() => handleOctaveShift(Math.min(2, octaveShift + 1))}
              disabled={octaveShift >= 2}
              title={ro ? 'Octavă sus' : 'Octave up'}
              className="rounded px-1.5 py-0.5 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30"
            >▸</button>
          </div>
          {/* Start / Stop */}
          <button
            onClick={() => { active ? stopSynth() : void startSynth() }}
            className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
              active
                ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
            }`}
          >
            {active ? (ro ? 'Activ' : 'Active') : (ro ? 'Pornire' : 'Start')}
          </button>
        </div>
      </div>

      {/* Patch strip */}
      <div className="mb-4 flex items-center gap-1 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
        <span className="shrink-0 pr-1 text-[9px] uppercase tracking-wider text-zinc-600">
          {ro ? 'Preset:' : 'Patch:'}
        </span>
        {PATCHES.map((p) => (
          <button
            key={p.name}
            onClick={() => loadPatch(p)}
            className="shrink-0 rounded-md bg-zinc-800 px-2.5 py-1 text-[10px] font-medium text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-100"
          >
            {ro ? p.nameRo : p.name}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-5">

        {/* Oscillator + Detune */}
        <div className="flex flex-col gap-2">
          <p className="text-[9px] uppercase tracking-wider text-zinc-500">
            {ro ? 'Oscilator' : 'Oscillator'}
          </p>
          <div className="flex flex-wrap gap-1">
            {OSC_TYPES.map((t) => (
              <button key={t.id} onClick={() => setOscType(t.id)}
                className={`rounded px-2 py-1 text-[10px] font-semibold transition ${
                  oscType === t.id ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >{t.label}</button>
            ))}
          </div>
          <div className="flex gap-3 mt-1">
            <Slider label="Detune" value={detuneCents} min={0} max={50}
              format={(v) => v < 1 ? 'off' : `${v.toFixed(0)}¢`} onChange={setDetune} />
          </div>
        </div>

        {/* ADSR */}
        <div className="flex flex-col gap-2">
          <p className="text-[9px] uppercase tracking-wider text-zinc-500">ADSR</p>
          <div className="flex gap-3">
            <Slider label="A" value={attackMs}  min={1}   max={2000} log format={(v) => `${v.toFixed(0)}ms`} onChange={setAttack}  />
            <Slider label="D" value={decayMs}   min={1}   max={2000} log format={(v) => `${v.toFixed(0)}ms`} onChange={setDecay}   />
            <Slider label="S" value={sustain}   min={0}   max={1}        format={(v) => `${Math.round(v * 100)}%`} onChange={setSustain} />
            <Slider label="R" value={releaseMs} min={1}   max={5000} log format={(v) => `${v.toFixed(0)}ms`} onChange={setRelease} />
          </div>
        </div>

        {/* Filter */}
        <div className="flex flex-col gap-2">
          <p className="text-[9px] uppercase tracking-wider text-zinc-500">{ro ? 'Filtru' : 'Filter'}</p>
          <div className="flex gap-1 mb-1">
            {FILTER_TYPES.map((ft) => (
              <button key={ft.id} onClick={() => setFilterType(ft.id)}
                className={`rounded px-2.5 py-1 text-[10px] font-semibold transition ${
                  filterType === ft.id ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >{ft.label}</button>
            ))}
          </div>
          <div className="flex gap-3">
            <Slider label={ro ? 'Frec' : 'Freq'} value={cutoffHz} min={80} max={18000} log
              format={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v.toFixed(0)}`} onChange={setCutoff} />
            <Slider label="Res" value={resonance} min={0} max={0.95}
              format={(v) => `${Math.round(v * 100)}%`} onChange={setResonance} />
          </div>
        </div>

        {/* LFO */}
        <div className="flex flex-col gap-2">
          <p className="text-[9px] uppercase tracking-wider text-zinc-500">LFO → Filt</p>
          <div className="flex gap-3">
            <Slider label={ro ? 'Rată' : 'Rate'} value={lfoRate} min={0.1} max={20} log
              format={(v) => `${v.toFixed(1)}Hz`} onChange={setLfoRate} />
            <Slider label={ro ? 'Adânc' : 'Depth'} value={lfoDepth} min={0} max={1}
              format={(v) => v < 0.01 ? 'off' : `${Math.round(v * 100)}%`} onChange={setLfoDepth} />
          </div>
        </div>

        {/* Gain */}
        <div className="flex flex-col gap-2">
          <p className="text-[9px] uppercase tracking-wider text-zinc-500">Gain</p>
          <Slider label="Vol" value={gainDb} min={-24} max={6}
            format={(v) => `${v.toFixed(1)}dB`} onChange={setGain} />
        </div>
      </div>

      {/* ── Arpeggiator ── */}
      <div className={`mt-4 rounded-xl border px-3 py-2.5 transition-colors ${
        arpEnabled
          ? 'border-purple-500/40 bg-purple-500/5'
          : 'border-zinc-800 bg-zinc-900/40'
      }`}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">

          {/* Toggle + label */}
          <button
            onClick={() => handleArpToggle(!arpEnabled)}
            disabled={!active}
            aria-pressed={arpEnabled}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition disabled:opacity-40 ${
              arpEnabled
                ? 'bg-purple-600 text-white hover:bg-purple-500'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${arpEnabled ? 'bg-white animate-pulse' : 'bg-zinc-600'}`} />
            ARP
          </button>

          {/* Mode */}
          <div className="flex items-center gap-1">
            <span className="text-[9px] uppercase tracking-wider text-zinc-600 mr-0.5">
              {ro ? 'Mod' : 'Mode'}
            </span>
            {ARP_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setArpMode(m.id)}
                className={`rounded px-2 py-0.5 text-[10px] font-semibold transition ${
                  arpMode === m.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {ro ? m.labelRo : m.label}
              </button>
            ))}
          </div>

          {/* BPM */}
          <div className="flex items-center gap-1">
            <span className="text-[9px] uppercase tracking-wider text-zinc-600">BPM</span>
            <button
              onClick={() => setArpBpm(Math.max(40, arpBpm - (arpBpm > 100 ? 5 : 1)))}
              className="rounded px-1.5 py-0.5 text-[10px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            >−</button>
            <input
              type="number" min={40} max={300} value={arpBpm}
              onChange={(e) => {
                const v = Number(e.target.value)
                if (v >= 40 && v <= 300) setArpBpm(v)
              }}
              className="w-10 rounded bg-zinc-800 text-center font-mono text-[10px] text-zinc-200 [appearance:textfield] focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
            <button
              onClick={() => setArpBpm(Math.min(300, arpBpm + (arpBpm >= 100 ? 5 : 1)))}
              className="rounded px-1.5 py-0.5 text-[10px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            >+</button>
          </div>

          {/* Division */}
          <div className="flex items-center gap-1">
            <span className="text-[9px] uppercase tracking-wider text-zinc-600 mr-0.5">
              {ro ? 'Div' : 'Div'}
            </span>
            {ARP_DIVISIONS.map((d) => (
              <button
                key={d.value}
                onClick={() => setArpDivision(d.value)}
                className={`rounded px-2 py-0.5 text-[10px] font-mono font-semibold transition ${
                  arpDivision === d.value
                    ? 'bg-purple-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Octave range */}
          <div className="flex items-center gap-1">
            <span className="text-[9px] uppercase tracking-wider text-zinc-600 mr-0.5">Oct</span>
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                onClick={() => setArpOctaves(n)}
                className={`rounded px-2 py-0.5 text-[10px] font-semibold transition ${
                  arpOctaves === n
                    ? 'bg-purple-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {arpEnabled && (
          <p className="mt-1.5 text-[9px] text-zinc-600">
            {ro
              ? 'Ține apăsate taste / clicuri pe claviatură — arpegiorul le va parcurge în buclă'
              : 'Hold keys or click piano keys — the arpeggiator will loop through them'}
          </p>
        )}
      </div>

      {/* Piano keyboard */}
      <div className="relative mt-4 h-20 w-full select-none overflow-hidden rounded-lg border border-zinc-700">
        {whiteKeys.map((key, idx) => {
          const width  = 100 / whiteKeys.length
          const isC    = key.midi % 12 === 0
          const queued = arpEnabled && arpNotesRef.current.has(key.midi)
          return (
            <div
              key={key.midi}
              style={{ left: `${idx * width}%`, width: `${width}%` }}
              className={`absolute inset-y-0 cursor-pointer border-r border-zinc-600 transition-colors ${
                activeNote === key.midi
                  ? 'bg-purple-400'
                  : queued
                  ? 'bg-purple-200'
                  : 'bg-zinc-200 hover:bg-zinc-100'
              }`}
              onMouseDown={() => handleNoteOn(key.midi)}
              onMouseUp={() => handleNoteOff(key.midi)}
              onMouseLeave={() => handleNoteOff(key.midi)}
              onTouchStart={(e) => { e.preventDefault(); handleNoteOn(key.midi) }}
              onTouchEnd={() => handleNoteOff(key.midi)}
            >
              {isC && (
                <span className="pointer-events-none absolute bottom-1 left-0 right-0 text-center font-mono text-[8px] leading-none text-zinc-500">
                  {midiToName(key.midi)}
                </span>
              )}
            </div>
          )
        })}
        {blackKeys.map((key) => {
          const left  = blackKeyLeft(key.midi)
          const width = (100 / whiteKeys.length) * 0.6
          const queued = arpEnabled && arpNotesRef.current.has(key.midi)
          return (
            <div
              key={key.midi}
              style={{ left: `${left}%`, width: `${width}%` }}
              className={`absolute top-0 z-10 h-[58%] cursor-pointer rounded-b-sm transition-colors ${
                activeNote === key.midi
                  ? 'bg-purple-500'
                  : queued
                  ? 'bg-purple-700'
                  : 'bg-zinc-900 hover:bg-zinc-700'
              }`}
              onMouseDown={(e) => { e.stopPropagation(); handleNoteOn(key.midi) }}
              onMouseUp={() => handleNoteOff(key.midi)}
              onMouseLeave={() => handleNoteOff(key.midi)}
              onTouchStart={(e) => { e.preventDefault(); handleNoteOn(key.midi) }}
              onTouchEnd={() => handleNoteOff(key.midi)}
            />
          )
        })}
      </div>

      {active && !arpEnabled && (
        <p className="mt-2 text-[10px] text-zinc-600">
          {ro
            ? 'Apasă taste A–; pentru a cânta · Click pe claviatură · Sunetul trece prin lanțul de efecte'
            : 'Press keys A–; to play · Click keyboard · Sound routes through the effects chain'}
        </p>
      )}
    </section>
  )
}
