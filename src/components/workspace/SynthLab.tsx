import { useCallback, useEffect, useRef, useState } from 'react'
import { useSynthStore, OSC_TYPES } from '@/store/synthStore'
import { useEducationStore } from '@/store/educationStore'

// ─── MIDI note to frequency ───────────────────────────────────────────────

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

// Piano keyboard layout: C4 = midi 60. Two octaves starting from C3 (48).
const START_MIDI = 48  // C3
const KEY_COUNT  = 25  // 2 octaves + 1

// Build the key list: {midi, isBlack, label}
interface PianoKey { midi: number; isBlack: boolean; label: string }

function buildKeys(): PianoKey[] {
  const keys: PianoKey[] = []
  for (let i = 0; i < KEY_COUNT; i++) {
    const midi   = START_MIDI + i
    const noteInOct = i % 12
    const isBlack   = [1, 3, 6, 8, 10].includes(noteInOct)
    const names     = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    const octave    = Math.floor(midi / 12) - 1
    const label     = `${names[noteInOct] ?? ''}${octave}`
    keys.push({ midi, isBlack, label })
  }
  return keys
}

const PIANO_KEYS = buildKeys()

// Keyboard shortcuts: two rows, C3 onwards
const KEY_BINDINGS: Record<string, number> = {
  'KeyA': 48, 'KeyW': 49, 'KeyS': 50, 'KeyE': 51, 'KeyD': 52,
  'KeyF': 53, 'KeyT': 54, 'KeyG': 55, 'KeyY': 56, 'KeyH': 57,
  'KeyU': 58, 'KeyJ': 59, 'KeyK': 60, 'KeyO': 61, 'KeyL': 62,
  'KeyP': 63, 'Semicolon': 64,
}

// ─── Knob-style slider ────────────────────────────────────────────────────

interface SliderProps {
  label: string; value: number; min: number; max: number
  format?: (v: number) => string; onChange: (v: number) => void; log?: boolean
}

function Slider({ label, value, min, max, format, onChange, log }: SliderProps) {
  const toLinear = (v: number) => log ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min)
  const toValue  = (t: number) => log ? min * Math.pow(max / min, t) : min + t * (max - min)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(toValue(Number(e.target.value)))
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[9px] uppercase tracking-wider text-zinc-500">{label}</span>
      <input
        type="range" min={0} max={1} step={0.001}
        value={toLinear(value)}
        onChange={handleChange}
        className="h-20 w-3 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-purple-500"
        style={{ writingMode: 'vertical-lr', direction: 'rtl' } as React.CSSProperties}
      />
      <span className="w-10 text-center font-mono text-[9px] text-zinc-400">
        {format ? format(value) : value.toFixed(1)}
      </span>
    </div>
  )
}

// ─── SynthLab component ───────────────────────────────────────────────────

export function SynthLab() {
  const ro = useEducationStore((s) => s.language) === 'ro'

  const active      = useSynthStore((s) => s.active)
  const oscType     = useSynthStore((s) => s.oscType)
  const attackMs    = useSynthStore((s) => s.attackMs)
  const decayMs     = useSynthStore((s) => s.decayMs)
  const sustain     = useSynthStore((s) => s.sustain)
  const releaseMs   = useSynthStore((s) => s.releaseMs)
  const cutoffHz    = useSynthStore((s) => s.cutoffHz)
  const resonance   = useSynthStore((s) => s.resonance)
  const gainDb      = useSynthStore((s) => s.gainDb)

  const startSynth  = useSynthStore((s) => s.startSynth)
  const stopSynth   = useSynthStore((s) => s.stopSynth)
  const setOscType  = useSynthStore((s) => s.setOscType)
  const setAttack   = useSynthStore((s) => s.setAttack)
  const setDecay    = useSynthStore((s) => s.setDecay)
  const setSustain  = useSynthStore((s) => s.setSustain)
  const setRelease  = useSynthStore((s) => s.setRelease)
  const setCutoff   = useSynthStore((s) => s.setCutoff)
  const setResonance = useSynthStore((s) => s.setResonance)
  const setGain      = useSynthStore((s) => s.setGain)
  const noteOn       = useSynthStore((s) => s.noteOn)
  const noteOff      = useSynthStore((s) => s.noteOff)

  const [activeNote, setActiveNote] = useState<number | null>(null)
  const heldKeys = useRef<Set<string>>(new Set())

  const triggerNoteOn = useCallback((midi: number) => {
    if (!active) return
    noteOn(midiToFreq(midi))
    setActiveNote(midi)
  }, [active, noteOn])

  const triggerNoteOff = useCallback(() => {
    if (!active) return
    noteOff()
    setActiveNote(null)
  }, [active, noteOff])

  // Keyboard shortcuts
  useEffect(() => {
    if (!active) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat || e.target instanceof HTMLInputElement) return
      const midi = KEY_BINDINGS[e.code]
      if (midi !== undefined && !heldKeys.current.has(e.code)) {
        heldKeys.current.add(e.code)
        triggerNoteOn(midi)
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (KEY_BINDINGS[e.code] !== undefined) {
        heldKeys.current.delete(e.code)
        if (heldKeys.current.size === 0) triggerNoteOff()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [active, triggerNoteOn, triggerNoteOff])

  // Compute white key layout for rendering
  const whiteKeys = PIANO_KEYS.filter((k) => !k.isBlack)
  const blackKeys = PIANO_KEYS.filter((k) => k.isBlack)

  // Get left offset of black key relative to white keys
  function blackKeyLeft(midi: number): number {
    const noteInOct = midi % 12
    const OFFSETS: Record<number, number> = { 1: 0.65, 3: 1.65, 6: 3.65, 8: 4.65, 10: 5.65 }
    const octaveOffset = Math.floor((midi - START_MIDI) / 12) * 7
    return (octaveOffset + (OFFSETS[noteInOct] ?? 0)) / whiteKeys.length * 100
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-300">
          {ro ? 'Synth Lab' : 'Synth Lab'}
        </h2>
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

      <div className="flex flex-wrap gap-6">
        {/* Oscillator */}
        <div className="flex flex-col gap-2">
          <p className="text-[9px] uppercase tracking-wider text-zinc-500">
            {ro ? 'Oscilator' : 'Oscillator'}
          </p>
          <div className="flex gap-1">
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
        </div>

        {/* ADSR */}
        <div className="flex flex-col gap-2">
          <p className="text-[9px] uppercase tracking-wider text-zinc-500">ADSR</p>
          <div className="flex gap-3">
            <Slider label="A" value={attackMs} min={1} max={2000} log format={(v) => `${v.toFixed(0)}ms`} onChange={setAttack} />
            <Slider label="D" value={decayMs} min={1} max={2000} log format={(v) => `${v.toFixed(0)}ms`} onChange={setDecay} />
            <Slider label="S" value={sustain} min={0} max={1} format={(v) => `${Math.round(v * 100)}%`} onChange={setSustain} />
            <Slider label="R" value={releaseMs} min={1} max={5000} log format={(v) => `${v.toFixed(0)}ms`} onChange={setRelease} />
          </div>
        </div>

        {/* Filter */}
        <div className="flex flex-col gap-2">
          <p className="text-[9px] uppercase tracking-wider text-zinc-500">
            {ro ? 'Filtru LP' : 'LP Filter'}
          </p>
          <div className="flex gap-3">
            <Slider label={ro ? 'Frec' : 'Freq'} value={cutoffHz} min={80} max={18000} log format={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : `${v.toFixed(0)}`} onChange={setCutoff} />
            <Slider label="Res" value={resonance} min={0} max={0.95} format={(v) => `${Math.round(v * 100)}%`} onChange={setResonance} />
          </div>
        </div>

        {/* Gain */}
        <div className="flex flex-col gap-2">
          <p className="text-[9px] uppercase tracking-wider text-zinc-500">Gain</p>
          <div className="flex gap-3">
            <Slider label="Vol" value={gainDb} min={-24} max={6} format={(v) => `${v.toFixed(1)}dB`} onChange={setGain} />
          </div>
        </div>
      </div>

      {/* Piano keyboard */}
      <div className="relative mt-5 h-20 w-full select-none overflow-hidden rounded-lg border border-zinc-700">
        {/* White keys */}
        {whiteKeys.map((key) => {
          const idx = whiteKeys.indexOf(key)
          const width = 100 / whiteKeys.length
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
            />
          )
        })}
        {/* Black keys */}
        {blackKeys.map((key) => {
          const left = blackKeyLeft(key.midi)
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
            : 'Press keys A–; to play · Click keyboard · Sound routes through effects chain'}
        </p>
      )}
    </section>
  )
}
