import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSynthStore, OSC_TYPES, FILTER_TYPES } from '@/store/synthStore'
import { useEducationStore } from '@/store/educationStore'

// ─── MIDI helpers ─────────────────────────────────────────────────────────────

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

function midiToName(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const octave = Math.floor(midi / 12) - 1
  return `${names[midi % 12] ?? ''}${octave}`
}

// ─── Piano layout ─────────────────────────────────────────────────────────────

const KEY_COUNT = 25  // 2 octaves + 1

interface PianoKey { midi: number; isBlack: boolean }

function buildKeys(startMidi: number): PianoKey[] {
  return Array.from({ length: KEY_COUNT }, (_, i) => {
    const midi       = startMidi + i
    const noteInOct  = midi % 12
    const isBlack    = [1, 3, 6, 8, 10].includes(noteInOct)
    return { midi, isBlack }
  })
}

// Keyboard: offsets from the effective start MIDI (code → semitone offset)
const KEY_OFFSETS: Record<string, number> = {
  'KeyA': 0,  'KeyW': 1,  'KeyS': 2,  'KeyE': 3,  'KeyD': 4,
  'KeyF': 5,  'KeyT': 6,  'KeyG': 7,  'KeyY': 8,  'KeyH': 9,
  'KeyU': 10, 'KeyJ': 11, 'KeyK': 12, 'KeyO': 13, 'KeyL': 14,
  'KeyP': 15, 'Semicolon': 16,
}

// ─── Synth patches ────────────────────────────────────────────────────────────

interface Patch {
  name: string; nameRo: string
  oscType: number; detuneCents: number
  attackMs: number; decayMs: number; sustain: number; releaseMs: number
  filterType: number; cutoffHz: number; resonance: number
  lfoRate: number; lfoDepth: number
  gainDb: number
}

const PATCHES: Patch[] = [
  { name: 'Init',    nameRo: 'Init',    oscType: 1, detuneCents: 0,  attackMs: 10,  decayMs: 200, sustain: 0.7, releaseMs: 400,  filterType: 0, cutoffHz: 4000, resonance: 0.0, lfoRate: 2,   lfoDepth: 0,    gainDb: -6 },
  { name: 'Pluck',   nameRo: 'Pluck',   oscType: 1, detuneCents: 5,  attackMs: 2,   decayMs: 150, sustain: 0.0, releaseMs: 120,  filterType: 0, cutoffHz: 3000, resonance: 0.3, lfoRate: 2,   lfoDepth: 0,    gainDb: -6 },
  { name: 'Pad',     nameRo: 'Pad',     oscType: 0, detuneCents: 8,  attackMs: 500, decayMs: 300, sustain: 0.8, releaseMs: 1500, filterType: 0, cutoffHz: 2000, resonance: 0.1, lfoRate: 0.5, lfoDepth: 0.3,  gainDb: -8 },
  { name: 'Lead',    nameRo: 'Lead',    oscType: 2, detuneCents: 0,  attackMs: 5,   decayMs: 100, sustain: 0.8, releaseMs: 200,  filterType: 0, cutoffHz: 6000, resonance: 0.5, lfoRate: 5,   lfoDepth: 0.2,  gainDb: -6 },
  { name: 'Bass',    nameRo: 'Bass',    oscType: 1, detuneCents: 3,  attackMs: 5,   decayMs: 250, sustain: 0.6, releaseMs: 150,  filterType: 0, cutoffHz: 800,  resonance: 0.4, lfoRate: 2,   lfoDepth: 0,    gainDb: -4 },
  { name: 'Strings', nameRo: 'Corzi',   oscType: 1, detuneCents: 12, attackMs: 200, decayMs: 400, sustain: 0.7, releaseMs: 800,  filterType: 0, cutoffHz: 3500, resonance: 0.2, lfoRate: 3,   lfoDepth: 0.15, gainDb: -7 },
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

  const [activeNote, setActiveNote] = useState<number | null>(null)
  const heldKeys = useRef<Set<string>>(new Set())
  const activeNoteRef = useRef<number | null>(null)
  // Use a ref so keyboard handlers always see the current octave without re-registering
  const effectiveStartRef = useRef(START_MIDI_BASE + octaveShift * 12)
  effectiveStartRef.current = START_MIDI_BASE + octaveShift * 12

  const effectiveStartMidi = START_MIDI_BASE + octaveShift * 12

  const pianoKeys = useMemo(() => buildKeys(effectiveStartMidi), [effectiveStartMidi])
  const whiteKeys = useMemo(() => pianoKeys.filter((k) => !k.isBlack), [pianoKeys])
  const blackKeys = useMemo(() => pianoKeys.filter((k) => k.isBlack), [pianoKeys])

  const triggerNoteOn = useCallback((midi: number) => {
    if (!active) return
    noteOn(midiToFreq(midi))
    setActiveNote(midi)
    activeNoteRef.current = midi
  }, [active, noteOn])

  const triggerNoteOff = useCallback(() => {
    if (!active) return
    noteOff()
    setActiveNote(null)
    activeNoteRef.current = null
  }, [active, noteOff])

  // Keyboard shortcuts
  useEffect(() => {
    if (!active) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat || e.target instanceof HTMLInputElement) return
      const offset = KEY_OFFSETS[e.code]
      if (offset !== undefined) {
        const midi = effectiveStartRef.current + offset
        if (!heldKeys.current.has(e.code)) {
          heldKeys.current.add(e.code)
          triggerNoteOn(midi)
        }
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      const offset = KEY_OFFSETS[e.code]
      if (offset !== undefined) {
        heldKeys.current.delete(e.code)
        const midi = effectiveStartRef.current + offset
        if (heldKeys.current.size === 0) {
          triggerNoteOff()
        } else if (activeNoteRef.current === midi) {
          const codes = [...heldKeys.current]
          const lastOffset = KEY_OFFSETS[codes[codes.length - 1] ?? '']
          if (lastOffset !== undefined) triggerNoteOn(effectiveStartRef.current + lastOffset)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [active, triggerNoteOn, triggerNoteOff])

  // Load a preset patch
  function loadPatch(p: Patch) {
    setOscType(p.oscType)
    setDetune(p.detuneCents)
    setAttack(p.attackMs)
    setDecay(p.decayMs)
    setSustain(p.sustain)
    setRelease(p.releaseMs)
    setFilterType(p.filterType)
    setCutoff(p.cutoffHz)
    setResonance(p.resonance)
    setLfoRate(p.lfoRate)
    setLfoDepth(p.lfoDepth)
    setGain(p.gainDb)
  }

  // Compute left offset (%) of a black key relative to white key grid
  function blackKeyLeft(midi: number): number {
    const noteInOct  = midi % 12
    const OFFSETS: Record<number, number> = { 1: 0.65, 3: 1.65, 6: 3.65, 8: 4.65, 10: 5.65 }
    const octaveOffset = Math.floor((midi - effectiveStartMidi) / 12) * 7
    return (octaveOffset + (OFFSETS[noteInOct] ?? 0)) / whiteKeys.length * 100
  }

  const startOctave = Math.floor(effectiveStartMidi / 12) - 1
  const endOctave   = Math.floor((effectiveStartMidi + KEY_COUNT - 1) / 12) - 1

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">

      {/* ── Header ── */}
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
          <div className="flex items-center gap-1">
            <button
              onClick={() => setOctaveShift(Math.max(-2, octaveShift - 1))}
              disabled={octaveShift <= -2}
              className="rounded px-1.5 py-0.5 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30"
              title={ro ? 'Octavă jos' : 'Octave down'}
            >◂</button>
            <span className="min-w-[3rem] text-center font-mono text-[10px] text-zinc-400">
              C{startOctave}–C{endOctave}
            </span>
            <button
              onClick={() => setOctaveShift(Math.min(2, octaveShift + 1))}
              disabled={octaveShift >= 2}
              className="rounded px-1.5 py-0.5 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30"
              title={ro ? 'Octavă sus' : 'Octave up'}
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

      {/* ── Patch strip ── */}
      <div className="mb-4 flex items-center gap-1 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
        <span className="shrink-0 text-[9px] uppercase tracking-wider text-zinc-600 pr-1">
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

      {/* ── Controls ── */}
      <div className="flex flex-wrap gap-5">

        {/* Oscillator + Detune */}
        <div className="flex flex-col gap-2">
          <p className="text-[9px] uppercase tracking-wider text-zinc-500">
            {ro ? 'Oscilator' : 'Oscillator'}
          </p>
          <div className="flex gap-1 flex-wrap">
            {OSC_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => setOscType(t.id)}
                className={`rounded px-2 py-1 text-[10px] font-semibold transition ${
                  oscType === t.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex gap-3 mt-1">
            <Slider
              label={ro ? 'Detune' : 'Detune'}
              value={detuneCents} min={0} max={50}
              format={(v) => v < 1 ? 'off' : `${v.toFixed(0)}¢`}
              onChange={setDetune}
            />
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
          <p className="text-[9px] uppercase tracking-wider text-zinc-500">
            {ro ? 'Filtru' : 'Filter'}
          </p>
          <div className="flex gap-1 mb-1">
            {FILTER_TYPES.map((ft) => (
              <button
                key={ft.id}
                onClick={() => setFilterType(ft.id)}
                className={`rounded px-2.5 py-1 text-[10px] font-semibold transition ${
                  filterType === ft.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {ft.label}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <Slider
              label={ro ? 'Frec' : 'Freq'}
              value={cutoffHz} min={80} max={18000} log
              format={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v.toFixed(0)}`}
              onChange={setCutoff}
            />
            <Slider
              label="Res"
              value={resonance} min={0} max={0.95}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={setResonance}
            />
          </div>
        </div>

        {/* LFO */}
        <div className="flex flex-col gap-2">
          <p className="text-[9px] uppercase tracking-wider text-zinc-500">LFO → Filt</p>
          <div className="flex gap-3">
            <Slider
              label={ro ? 'Rată' : 'Rate'}
              value={lfoRate} min={0.1} max={20} log
              format={(v) => `${v.toFixed(1)}Hz`}
              onChange={setLfoRate}
            />
            <Slider
              label={ro ? 'Adânc' : 'Depth'}
              value={lfoDepth} min={0} max={1}
              format={(v) => v < 0.01 ? 'off' : `${Math.round(v * 100)}%`}
              onChange={setLfoDepth}
            />
          </div>
        </div>

        {/* Gain */}
        <div className="flex flex-col gap-2">
          <p className="text-[9px] uppercase tracking-wider text-zinc-500">Gain</p>
          <div className="flex gap-3">
            <Slider
              label="Vol"
              value={gainDb} min={-24} max={6}
              format={(v) => `${v.toFixed(1)}dB`}
              onChange={setGain}
            />
          </div>
        </div>
      </div>

      {/* ── Piano keyboard ── */}
      <div className="relative mt-5 h-20 w-full select-none overflow-hidden rounded-lg border border-zinc-700">
        {whiteKeys.map((key, idx) => {
          const width = 100 / whiteKeys.length
          const isC = key.midi % 12 === 0
          return (
            <div
              key={key.midi}
              style={{ left: `${idx * width}%`, width: `${width}%` }}
              className={`absolute inset-y-0 cursor-pointer border-r border-zinc-600 transition-colors ${
                activeNote === key.midi ? 'bg-purple-400' : 'bg-zinc-200 hover:bg-zinc-100'
              }`}
              onMouseDown={() => triggerNoteOn(key.midi)}
              onMouseUp={triggerNoteOff}
              onMouseLeave={() => { if (activeNote === key.midi) triggerNoteOff() }}
              onTouchStart={(e) => { e.preventDefault(); triggerNoteOn(key.midi) }}
              onTouchEnd={triggerNoteOff}
            >
              {isC && (
                <span className="absolute bottom-1 left-0 right-0 text-center font-mono text-[8px] text-zinc-500 leading-none pointer-events-none">
                  {midiToName(key.midi)}
                </span>
              )}
            </div>
          )
        })}
        {blackKeys.map((key) => {
          const left  = blackKeyLeft(key.midi)
          const width = (100 / whiteKeys.length) * 0.6
          return (
            <div
              key={key.midi}
              style={{ left: `${left}%`, width: `${width}%` }}
              className={`absolute top-0 z-10 h-[58%] cursor-pointer rounded-b-sm transition-colors ${
                activeNote === key.midi ? 'bg-purple-500' : 'bg-zinc-900 hover:bg-zinc-700'
              }`}
              onMouseDown={(e) => { e.stopPropagation(); triggerNoteOn(key.midi) }}
              onMouseUp={triggerNoteOff}
              onMouseLeave={() => { if (activeNote === key.midi) triggerNoteOff() }}
              onTouchStart={(e) => { e.preventDefault(); triggerNoteOn(key.midi) }}
              onTouchEnd={triggerNoteOff}
            />
          )
        })}
      </div>

      {active && (
        <p className="mt-2 text-[10px] text-zinc-600">
          {ro
            ? 'Apasă taste A–; pentru a cânta · Click pe claviatură · Sunetul trece prin lanțul de efecte'
            : 'Press keys A–; to play · Click keyboard · Sound routes through the effects chain'}
        </p>
      )}
    </section>
  )
}
