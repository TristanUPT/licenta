import { useEffect, useMemo, useRef, useState } from 'react'
import {
  useSynthStore, SYNTH_PARAM, OSC_TYPES, FILTER_TYPES,
  ARP_MODES, ARP_DIVISIONS, FACTORY_SYNTH_PATCHES, type ArpMode, type SavedPatch,
} from '@/store/synthStore'
import { useEducationStore } from '@/store/educationStore'
import { useMidi } from '@/hooks/useMidi'
import { getAnalyser, synthSetParam } from '@/audio/engine'

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

// ─── Chord mode ───────────────────────────────────────────────────────────────

interface ChordType { label: string; labelRo: string; intervals: number[] }

const CHORD_TYPES: Record<string, ChordType> = {
  'maj':  { label: 'Maj',  labelRo: 'Maj',  intervals: [0, 4, 7]     },
  'min':  { label: 'Min',  labelRo: 'Min',  intervals: [0, 3, 7]     },
  '7':    { label: '7',    labelRo: '7',    intervals: [0, 4, 7, 10] },
  'maj7': { label: 'M7',   labelRo: 'M7',   intervals: [0, 4, 7, 11] },
  'min7': { label: 'm7',   labelRo: 'm7',   intervals: [0, 3, 7, 10] },
  'sus4': { label: 'Sus4', labelRo: 'Sus4', intervals: [0, 5, 7]     },
  'dim':  { label: 'Dim',  labelRo: 'Dim',  intervals: [0, 3, 6]     },
  'aug':  { label: 'Aug',  labelRo: 'Aug',  intervals: [0, 4, 8]     },
}

// ─── Waveform SVG icons ───────────────────────────────────────────────────────

const OSC_SVG: Record<number, React.ReactNode> = {
  0: (
    <svg viewBox="0 0 24 10" width="24" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M 0 5 C 3 5 3 1 6 5 C 9 9 9 5 12 5 C 15 5 15 1 18 5 C 21 9 21 5 24 5" />
    </svg>
  ),
  1: (
    <svg viewBox="0 0 24 10" width="24" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M 0 8 L 10 2 L 10 8 L 20 2 L 20 8" />
    </svg>
  ),
  2: (
    <svg viewBox="0 0 24 10" width="24" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M 0 8 L 0 2 L 8 2 L 8 8 L 16 8 L 16 2 L 24 2" />
    </svg>
  ),
  3: (
    <svg viewBox="0 0 24 10" width="24" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M 0 8 L 6 2 L 12 8 L 18 2 L 24 8" />
    </svg>
  ),
  4: (
    <svg viewBox="0 0 24 10" width="24" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M 0 5 L 2 3 L 4 8 L 6 2 L 8 7 L 10 4 L 12 6 L 14 2 L 16 8 L 18 4 L 20 7 L 22 3 L 24 5" />
    </svg>
  ),
}

// ─── ADSR shape visualiser ────────────────────────────────────────────────────

function AdsrShape({ attackMs, decayMs, sustain, releaseMs }: {
  attackMs: number; decayMs: number; sustain: number; releaseMs: number
}) {
  const W = 120; const H = 40; const PAD = 4
  const inner = W - PAD * 2
  const total = Math.log(attackMs + 1) + Math.log(decayMs + 1) + Math.log(releaseMs + 1) + 20
  const a = (Math.log(attackMs + 1) / total) * inner
  const d = (Math.log(decayMs  + 1) / total) * inner
  const r = (Math.log(releaseMs + 1) / total) * inner
  const s = inner - a - d - r

  const top = PAD; const bot = H - PAD
  const sLevel = bot - sustain * (bot - top)

  const x0 = PAD
  const x1 = x0 + a
  const x2 = x1 + d
  const x3 = x2 + s
  const x4 = x3 + r

  const d_attr = `M${x0},${bot} L${x1},${top} L${x2},${sLevel} L${x3},${sLevel} L${x4},${bot}`

  return (
    <svg width={W} height={H} className="shrink-0 opacity-80">
      <path d={d_attr} fill="none" stroke="var(--accent-light)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <line x1={x1} y1={top} x2={x1} y2={bot} stroke="#3f3f5a" strokeWidth={0.5} strokeDasharray="2,2" />
      <line x1={x2} y1={sLevel} x2={x2} y2={bot} stroke="#3f3f5a" strokeWidth={0.5} strokeDasharray="2,2" />
      <line x1={x3} y1={sLevel} x2={x3} y2={bot} stroke="#3f3f5a" strokeWidth={0.5} strokeDasharray="2,2" />
    </svg>
  )
}

// ─── Vertical slider / fader ──────────────────────────────────────────────────

interface SliderProps {
  label: string; value: number; min: number; max: number
  format?: (v: number) => string; onChange: (v: number) => void; log?: boolean
}

function Slider({ label, value, min, max, format, onChange, log }: SliderProps) {
  const [hovered, setHovered] = useState(false)

  const toLinear = (v: number) =>
    log ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min)
  const toValue = (t: number) =>
    log ? min * Math.pow(max / min, t) : min + t * (max - min)

  const pct = Math.max(0, Math.min(1, toLinear(value)))
  const displayValue = format ? format(value) : value.toFixed(1)

  return (
    <div
      className="relative flex flex-col items-center gap-1"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Hover tooltip */}
      {hovered && (
        <div className="pointer-events-none absolute z-20 whitespace-nowrap rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono text-[9px]"
          style={{ bottom: '108px', color: 'var(--text-accent)' }}
        >
          {displayValue}
        </div>
      )}
      <span className="synth-card-label mb-0">{label}</span>
      {/* Track + fill + thumb */}
      <div className="relative flex items-center justify-center" style={{ height: 80, width: 14 }}>
        {/* Filled portion (below thumb = lower values) */}
        <div
          className="pointer-events-none absolute rounded-sm"
          style={{
            width: 3,
            bottom: 0,
            height: `${pct * 80}px`,
            background: 'var(--accent)',
            opacity: 0.7,
            left: 'calc(50% - 1.5px)',
          }}
        />
        <input
          type="range"
          min={0} max={1} step={0.001}
          value={pct}
          onChange={(e) => onChange(toValue(Number(e.target.value)))}
          className="synth-fader"
        />
      </div>
      <span className="font-mono text-[9px]" style={{ color: 'var(--text-accent)' }}>
        {displayValue}
      </span>
    </div>
  )
}

// ─── Oscilloscope ─────────────────────────────────────────────────────────────

function SynthScope() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const analyser = getAnalyser()
    const canvas   = canvasRef.current
    if (!analyser || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const N   = analyser.fftSize
    const buf = new Float32Array(N)
    let rafId = 0

    function draw() {
      rafId = requestAnimationFrame(draw)
      analyser!.getFloatTimeDomainData(buf)
      const W = canvas!.width; const H = canvas!.height
      ctx!.fillStyle = '#0d0d1a'
      ctx!.fillRect(0, 0, W, H)
      ctx!.strokeStyle = '#1e1e2e'
      ctx!.lineWidth = 1
      ctx!.beginPath(); ctx!.moveTo(0, H / 2); ctx!.lineTo(W, H / 2); ctx!.stroke()
      ctx!.strokeStyle = 'var(--accent-light)'
      ctx!.lineWidth = 1.5
      ctx!.beginPath()
      const step = W / N
      for (let i = 0; i < N; i++) {
        const y = (0.5 - buf[i] * 0.45) * H
        if (i === 0) ctx!.moveTo(0, y); else ctx!.lineTo(i * step, y)
      }
      ctx!.stroke()
    }

    draw()
    return () => cancelAnimationFrame(rafId)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={1024}
      height={64}
      className="w-full rounded"
      style={{ background: '#0d0d1a' }}
    />
  )
}

// ─── SynthLab ─────────────────────────────────────────────────────────────────

const START_MIDI_BASE = 48

export function SynthLab() {
  const ro = useEducationStore((s) => s.language) === 'ro'

  const active        = useSynthStore((s) => s.active)
  const oscType       = useSynthStore((s) => s.oscType)
  const osc2Type      = useSynthStore((s) => s.osc2Type)
  const detuneCents   = useSynthStore((s) => s.detuneCents)
  const attackMs      = useSynthStore((s) => s.attackMs)
  const decayMs       = useSynthStore((s) => s.decayMs)
  const sustain       = useSynthStore((s) => s.sustain)
  const releaseMs     = useSynthStore((s) => s.releaseMs)
  const filterType       = useSynthStore((s) => s.filterType)
  const cutoffHz         = useSynthStore((s) => s.cutoffHz)
  const resonance        = useSynthStore((s) => s.resonance)
  const filterEnvAmount  = useSynthStore((s) => s.filterEnvAmount)
  const lfoRate       = useSynthStore((s) => s.lfoRate)
  const lfoDepth      = useSynthStore((s) => s.lfoDepth)
  const gainDb        = useSynthStore((s) => s.gainDb)
  const octaveShift   = useSynthStore((s) => s.octaveShift)

  const startSynth    = useSynthStore((s) => s.startSynth)
  const stopSynth     = useSynthStore((s) => s.stopSynth)
  const setOscType    = useSynthStore((s) => s.setOscType)
  const setOsc2Type   = useSynthStore((s) => s.setOsc2Type)
  const setDetune     = useSynthStore((s) => s.setDetune)
  const setAttack     = useSynthStore((s) => s.setAttack)
  const setDecay      = useSynthStore((s) => s.setDecay)
  const setSustain    = useSynthStore((s) => s.setSustain)
  const setRelease    = useSynthStore((s) => s.setRelease)
  const setFilterType      = useSynthStore((s) => s.setFilterType)
  const setCutoff          = useSynthStore((s) => s.setCutoff)
  const setResonance       = useSynthStore((s) => s.setResonance)
  const setFilterEnvAmount = useSynthStore((s) => s.setFilterEnvAmount)
  const setLfoRate    = useSynthStore((s) => s.setLfoRate)
  const setLfoDepth   = useSynthStore((s) => s.setLfoDepth)
  const setGain       = useSynthStore((s) => s.setGain)
  const setOctaveShift   = useSynthStore((s) => s.setOctaveShift)
  const noteOn           = useSynthStore((s) => s.noteOn)
  const noteOff          = useSynthStore((s) => s.noteOff)
  const noteOffAll       = useSynthStore((s) => s.noteOffAll)
  const savedPatches     = useSynthStore((s) => s.savedPatches)
  const savePatch        = useSynthStore((s) => s.savePatch)
  const deleteSavedPatch = useSynthStore((s) => s.deleteSavedPatch)
  const monoMode         = useSynthStore((s) => s.monoMode)
  const setMonoMode      = useSynthStore((s) => s.setMonoMode)

  const { devices: midiDevices, supported: midiSupported, permissionDenied: midiDenied } = useMidi({
    onNoteOn:  (midi) => { if (active) handleNoteOn(midi) },
    onNoteOff: (midi) => { if (active) handleNoteOff(midi) },
  })

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
  const arpGate       = useSynthStore((s) => s.arpGate)
  const setArpGate    = useSynthStore((s) => s.setArpGate)

  const [patchName, setPatchName] = useState('')
  const [chordEnabled, setChordEnabled] = useState(false)
  const [chordType,    setChordType]    = useState('maj')
  const chordEnabledRef = useRef(chordEnabled)
  chordEnabledRef.current = chordEnabled
  const chordTypeRef = useRef(chordType)
  chordTypeRef.current = chordType

  const [activeNote, setActiveNote] = useState<number | null>(null)
  const [arpQueuedNotes, setArpQueuedNotes] = useState<Set<number>>(new Set())
  const [tapFlash, setTapFlash] = useState(false)
  const [pitchBend, setPitchBend] = useState(0)

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
  const arpGateRef     = useRef(arpGate)
  arpGateRef.current   = arpGate
  const gateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tapTimesRef    = useRef<number[]>([])

  const effectiveStartMidi = START_MIDI_BASE + octaveShift * 12
  const pianoKeys = useMemo(() => buildKeys(effectiveStartMidi), [effectiveStartMidi])
  const whiteKeys = useMemo(() => pianoKeys.filter((k) => !k.isBlack), [pianoKeys])
  const blackKeys = useMemo(() => pianoKeys.filter((k) => k.isBlack), [pianoKeys])

  function syncArpDisplay() { setArpQueuedNotes(new Set(arpNotesRef.current)) }

  const noteOnRef     = useRef(noteOn); noteOnRef.current   = noteOn
  const noteOffRef    = useRef(noteOff); noteOffRef.current  = noteOff
  const noteOffAllRef = useRef(noteOffAll); noteOffAllRef.current = noteOffAll

  const chordNoteOnRef  = useRef<(root: number) => void>(null!)
  const chordNoteOffRef = useRef<(root: number) => void>(null!)
  chordNoteOnRef.current = (root: number) => {
    if (!chordEnabledRef.current) { noteOnRef.current(root, midiToFreq(root)); return }
    const intervals = CHORD_TYPES[chordTypeRef.current]?.intervals ?? [0]
    for (const interval of intervals) {
      const m = root + interval
      if (m >= 0 && m <= 127) noteOnRef.current(m, midiToFreq(m))
    }
  }
  chordNoteOffRef.current = (root: number) => {
    if (!chordEnabledRef.current) { noteOffRef.current(root); return }
    const intervals = CHORD_TYPES[chordTypeRef.current]?.intervals ?? [0]
    for (const interval of intervals) {
      const m = root + interval
      if (m >= 0 && m <= 127) noteOffRef.current(m)
    }
  }

  function handleNoteOn(midi: number) {
    if (!active) return
    if (arpEnabledRef.current) {
      arpNotesRef.current.add(midi); syncArpDisplay()
      arpSeqRef.current = buildArpSeq(arpNotesRef.current, arpModeRef.current, arpOctavesRef.current)
      if (arpNotesRef.current.size === 1) arpStepRef.current = 0
    } else {
      chordNoteOnRef.current(midi); setActiveNote(midi); activeNoteRef.current = midi
    }
  }

  function handleNoteOff(midi: number) {
    if (!active) return
    if (arpEnabledRef.current) {
      arpNotesRef.current.delete(midi); syncArpDisplay()
      arpSeqRef.current = buildArpSeq(arpNotesRef.current, arpModeRef.current, arpOctavesRef.current)
      if (arpNotesRef.current.size === 0) {
        noteOffAllRef.current(); setActiveNote(null); activeNoteRef.current = null; arpStepRef.current = 0
      }
    } else {
      if (activeNoteRef.current === midi) {
        chordNoteOffRef.current(midi); setActiveNote(null); activeNoteRef.current = null
      }
    }
  }

  useEffect(() => {
    if (!active) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat) return
      const tgt = e.target as HTMLElement
      if (tgt.tagName === 'TEXTAREA' || tgt.isContentEditable) return
      if (tgt.tagName === 'INPUT' && (tgt as HTMLInputElement).type !== 'range') return
      const offset = KEY_OFFSETS[e.code]
      if (offset === undefined) return
      if (heldKeys.current.has(e.code)) return
      heldKeys.current.add(e.code)
      const midi = effectiveStartRef.current + offset
      if (arpEnabledRef.current) {
        arpNotesRef.current.add(midi); syncArpDisplay()
        arpSeqRef.current = buildArpSeq(arpNotesRef.current, arpModeRef.current, arpOctavesRef.current)
        if (arpNotesRef.current.size === 1) arpStepRef.current = 0
      } else {
        chordNoteOnRef.current(midi); setActiveNote(midi); activeNoteRef.current = midi
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      const offset = KEY_OFFSETS[e.code]
      if (offset === undefined) return
      heldKeys.current.delete(e.code)
      const midi = effectiveStartRef.current + offset
      if (arpEnabledRef.current) {
        arpNotesRef.current.delete(midi); syncArpDisplay()
        arpSeqRef.current = buildArpSeq(arpNotesRef.current, arpModeRef.current, arpOctavesRef.current)
        if (arpNotesRef.current.size === 0) {
          noteOffAllRef.current(); setActiveNote(null); activeNoteRef.current = null; arpStepRef.current = 0
        }
      } else {
        if (heldKeys.current.size === 0) {
          chordNoteOffRef.current(midi); setActiveNote(null); activeNoteRef.current = null
        } else if (activeNoteRef.current === midi) {
          const codes = [...heldKeys.current]
          const lastOffset = KEY_OFFSETS[codes[codes.length - 1] ?? '']
          if (lastOffset !== undefined) {
            const lastMidi = effectiveStartRef.current + lastOffset
            chordNoteOnRef.current(lastMidi); setActiveNote(lastMidi); activeNoteRef.current = lastMidi
          }
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp) }
  }, [active])

  useEffect(() => {
    if (!arpEnabled || !active) {
      noteOffAllRef.current(); setActiveNote(null); activeNoteRef.current = null; return
    }
    arpSeqRef.current = buildArpSeq(arpNotesRef.current, arpMode, arpOctaves)
    arpStepRef.current = 0
    const intervalMs = (60_000 / arpBpm) / (arpDivision / 4)
    const id = setInterval(() => {
      const seq = arpSeqRef.current
      if (seq.length === 0) { noteOffAllRef.current(); setActiveNote(null); activeNoteRef.current = null; return }
      if (arpStepRef.current >= seq.length) {
        arpStepRef.current = 0
        if (arpModeRef.current === 'random') arpSeqRef.current = shuffleArray([...seq])
      }
      const midi = arpSeqRef.current[arpStepRef.current]
      if (midi !== undefined) {
        if (gateTimeoutRef.current !== null) { clearTimeout(gateTimeoutRef.current); gateTimeoutRef.current = null }
        chordNoteOnRef.current(midi); setActiveNote(midi); activeNoteRef.current = midi
        if (arpGateRef.current < 0.99) {
          const gateMidi = midi
          gateTimeoutRef.current = setTimeout(() => { chordNoteOffRef.current(gateMidi); gateTimeoutRef.current = null }, intervalMs * arpGateRef.current)
        }
      }
      arpStepRef.current++
    }, intervalMs)
    return () => {
      clearInterval(id)
      if (gateTimeoutRef.current !== null) { clearTimeout(gateTimeoutRef.current); gateTimeoutRef.current = null }
      noteOffAllRef.current(); setActiveNote(null); activeNoteRef.current = null
    }
  }, [arpEnabled, active, arpBpm, arpDivision, arpMode, arpOctaves])

  function handleArpToggle(v: boolean) {
    if (v) {
      arpNotesRef.current.clear()
      for (const code of heldKeys.current) {
        const offset = KEY_OFFSETS[code]
        if (offset !== undefined) arpNotesRef.current.add(effectiveStartRef.current + offset)
      }
      syncArpDisplay()
      arpSeqRef.current = buildArpSeq(arpNotesRef.current, arpModeRef.current, arpOctavesRef.current)
      arpStepRef.current = 0
    } else {
      arpNotesRef.current.clear(); syncArpDisplay(); arpSeqRef.current = []; noteOffAllRef.current()
    }
    setArpEnabled(v)
  }

  function handleOctaveShift(n: number) {
    arpNotesRef.current.clear(); syncArpDisplay(); arpSeqRef.current = []
    heldKeys.current.clear(); noteOffAllRef.current()
    setActiveNote(null); activeNoteRef.current = null; setOctaveShift(n)
  }

  function handleMonoToggle(v: boolean) {
    noteOffAllRef.current(); setActiveNote(null); activeNoteRef.current = null
    if (arpEnabledRef.current) { arpNotesRef.current.clear(); syncArpDisplay(); arpSeqRef.current = [] }
    setMonoMode(v)
  }

  function handlePitchBend(cents: number) {
    setPitchBend(cents)
    try { synthSetParam(SYNTH_PARAM.PITCH_BEND, cents / 100) } catch { /* engine not ready */ }
  }

  function handleTapTempo() {
    const now = performance.now()
    const times = tapTimesRef.current
    if (times.length > 0 && now - times[times.length - 1]! > 3000) {
      tapTimesRef.current = [now]; setTapFlash(true); setTimeout(() => setTapFlash(false), 100); return
    }
    times.push(now)
    if (times.length > 8) times.splice(0, times.length - 8)
    if (times.length >= 2) {
      let total = 0
      for (let i = 1; i < times.length; i++) total += times[i]! - times[i - 1]!
      setArpBpm(Math.min(300, Math.max(40, Math.round(60_000 / (total / (times.length - 1))))))
    }
    setTapFlash(true); setTimeout(() => setTapFlash(false), 100)
  }

  function loadPatch(p: SavedPatch) {
    setOscType(p.oscType);     setOsc2Type(p.osc2Type ?? p.oscType); setDetune(p.detuneCents)
    setAttack(p.attackMs);     setDecay(p.decayMs);  setSustain(p.sustain);  setRelease(p.releaseMs)
    setFilterType(p.filterType); setCutoff(p.cutoffHz); setResonance(p.resonance)
    setFilterEnvAmount(p.filterEnvAmount ?? 0)
    setLfoRate(p.lfoRate);     setLfoDepth(p.lfoDepth); setGain(p.gainDb)
  }

  function handleSavePatch() {
    if (!patchName.trim()) return; savePatch(patchName); setPatchName('')
  }

  function blackKeyLeft(midi: number): number {
    const noteInOct = midi % 12
    const OFFSETS: Record<number, number> = { 1: 0.65, 3: 1.65, 6: 3.65, 8: 4.65, 10: 5.65 }
    const octaveOffset = Math.floor((midi - effectiveStartMidi) / 12) * 7
    return (octaveOffset + (OFFSETS[noteInOct] ?? 0)) / whiteKeys.length * 100
  }

  const startOctave = Math.floor(effectiveStartMidi / 12) - 1
  const endOctave   = Math.floor((effectiveStartMidi + KEY_COUNT - 1) / 12) - 1

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <section
      className="border-b border-zinc-800 p-4"
      style={{ background: 'var(--bg-elevated)' }}
    >

      {/* ── Header ── */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
            SYNTH LAB
          </h2>
          {activeNote !== null && (
            <span className="font-mono text-xs font-semibold" style={{ color: 'var(--accent-light)' }}>
              {midiToName(activeNote)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Octave */}
          <div className="flex items-center gap-0.5">
            <button onClick={() => handleOctaveShift(Math.max(-2, octaveShift - 1))} disabled={octaveShift <= -2}
              className="rounded px-1.5 py-0.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30">◂</button>
            <span className="min-w-[3.2rem] text-center font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
              C{startOctave}–C{endOctave}
            </span>
            <button onClick={() => handleOctaveShift(Math.min(2, octaveShift + 1))} disabled={octaveShift >= 2}
              className="rounded px-1.5 py-0.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30">▸</button>
          </div>
          {/* MIDI */}
          {midiSupported === true && (
            <div className="flex items-center gap-1 text-[10px]">
              {midiDenied ? (
                <span style={{ color: 'var(--text-muted)' }}>MIDI ✗</span>
              ) : midiDevices.length > 0 ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="max-w-[7rem] truncate" style={{ color: 'var(--text-muted)' }}>
                    {midiDevices.length === 1 ? midiDevices[0]!.name : `${midiDevices.length} MIDI`}
                  </span>
                </>
              ) : (
                <span style={{ color: 'var(--border-subtle)' }}>No MIDI</span>
              )}
            </div>
          )}
          {/* Mono/Poly */}
          <button
            onClick={() => handleMonoToggle(!monoMode)} disabled={!active}
            className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider disabled:opacity-40 ${
              monoMode ? 'bg-amber-600 text-white hover:bg-amber-500' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
            }`}
          >{monoMode ? 'MONO' : 'POLY'}</button>
          {/* Start/Stop */}
          <button
            onClick={() => { active ? stopSynth() : void startSynth() }}
            className={`rounded-md px-3 py-1 text-xs font-semibold ${
              active ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
            }`}
          >{active ? (ro ? 'Activ' : 'Active') : (ro ? 'Pornire' : 'Start')}</button>
        </div>
      </div>

      {/* ── Factory presets ── */}
      <div className="mb-3 space-y-1.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
          <span className="synth-card-label shrink-0 pr-1">{ro ? 'Factory:' : 'Factory:'}</span>
          {FACTORY_SYNTH_PATCHES.map((p) => (
            <button key={p.id} onClick={() => loadPatch(p)} className="preset-chip shrink-0">{p.name}</button>
          ))}
        </div>
        {/* User patches */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
          <span className="synth-card-label shrink-0 pr-1">{ro ? 'Salvate:' : 'Saved:'}</span>
          {savedPatches.map((p) => (
            <span key={p.id} className="flex shrink-0 items-center overflow-hidden" style={{ borderRadius: 20, background: '#1a1a2e', border: '1px solid #2d2d4e' }}>
              <button onClick={() => loadPatch(p)} className="px-3 py-1 text-[11px] font-medium" style={{ color: 'var(--accent-light)' }}>{p.name}</button>
              <button onClick={() => deleteSavedPatch(p.id)} className="px-1.5 py-1 text-[11px]" style={{ color: '#6d28d9' }}>×</button>
            </span>
          ))}
          <input
            type="text" value={patchName}
            onChange={(e) => setPatchName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSavePatch() }}
            placeholder={ro ? 'Nume patch…' : 'Patch name…'}
            className="w-24 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-[10px] text-zinc-300 placeholder-zinc-600 focus:border-indigo-500 focus:outline-none"
          />
          <button onClick={handleSavePatch} disabled={!patchName.trim()}
            className="shrink-0 rounded-full px-3 py-1 text-[10px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: 'var(--accent)' }}>
            {ro ? 'Salvează' : 'Save'}
          </button>
        </div>
      </div>

      {/* ── Controls grid ── */}
      <div className="flex flex-wrap gap-3">

        {/* OSC 1 */}
        <div className="synth-card flex flex-col gap-2">
          <p className="synth-card-label">{ro ? 'Oscilator 1' : 'Oscillator 1'}</p>
          <div className="flex flex-wrap gap-1.5">
            {OSC_TYPES.map((t) => (
              <button key={t.id} onClick={() => setOscType(t.id)}
                className={`osc-btn ${oscType === t.id ? 'active' : ''}`}>
                {OSC_SVG[t.id]}
                <span>{t.label}</span>
              </button>
            ))}
          </div>
          <div className="mt-1 flex gap-3">
            <Slider label="Detune" value={detuneCents} min={0} max={50}
              format={(v) => v < 1 ? 'off' : `${v.toFixed(0)}¢`} onChange={setDetune} />
          </div>
        </div>

        {/* OSC 2 */}
        <div className="synth-card flex flex-col gap-2">
          <p className="synth-card-label">{ro ? 'Oscilator 2' : 'Oscillator 2'}</p>
          <div className="flex flex-wrap gap-1.5">
            {OSC_TYPES.map((t) => (
              <button key={t.id} onClick={() => setOsc2Type(t.id)}
                className={`osc-btn ${osc2Type === t.id ? 'active' : ''}`}>
                {OSC_SVG[t.id]}
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ADSR */}
        <div className="synth-card flex flex-col gap-2">
          <p className="synth-card-label">ADSR</p>
          <AdsrShape attackMs={attackMs} decayMs={decayMs} sustain={sustain} releaseMs={releaseMs} />
          <div className="flex gap-3">
            <Slider label="A" value={attackMs}  min={1}   max={2000} log format={(v) => `${v.toFixed(0)}ms`} onChange={setAttack}  />
            <Slider label="D" value={decayMs}   min={1}   max={2000} log format={(v) => `${v.toFixed(0)}ms`} onChange={setDecay}   />
            <Slider label="S" value={sustain}   min={0}   max={1}        format={(v) => `${Math.round(v * 100)}%`} onChange={setSustain} />
            <Slider label="R" value={releaseMs} min={1}   max={5000} log format={(v) => `${v.toFixed(0)}ms`} onChange={setRelease} />
          </div>
        </div>

        {/* Filter */}
        <div className="synth-card flex flex-col gap-2">
          <p className="synth-card-label">{ro ? 'Filtru' : 'Filter'}</p>
          <div className="flex gap-1 mb-1">
            {FILTER_TYPES.map((ft) => (
              <button key={ft.id} onClick={() => setFilterType(ft.id)}
                className={`rounded-md px-2.5 py-1 text-[10px] font-semibold transition ${
                  filterType === ft.id
                    ? 'text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                style={filterType === ft.id ? { background: 'var(--accent)', border: '1px solid var(--accent)' } : { background: '#1e1e2e', border: '1px solid #333' }}
              >{ft.label}</button>
            ))}
          </div>
          <div className="flex gap-3">
            <Slider label={ro ? 'Frec' : 'Freq'} value={cutoffHz} min={80} max={18000} log
              format={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v.toFixed(0)}`} onChange={setCutoff} />
            <Slider label="Res" value={resonance} min={0} max={0.95}
              format={(v) => `${Math.round(v * 100)}%`} onChange={setResonance} />
            <Slider label="Env" value={filterEnvAmount} min={-4} max={4}
              format={(v) => v === 0 ? 'off' : `${v > 0 ? '+' : ''}${v.toFixed(1)}oct`} onChange={setFilterEnvAmount} />
          </div>
        </div>

        {/* LFO */}
        <div className="synth-card flex flex-col gap-2">
          <p className="synth-card-label">LFO → Filter</p>
          <div className="flex gap-3">
            <Slider label={ro ? 'Rată' : 'Rate'} value={lfoRate} min={0.1} max={20} log
              format={(v) => `${v.toFixed(1)}Hz`} onChange={setLfoRate} />
            <Slider label={ro ? 'Adânc' : 'Depth'} value={lfoDepth} min={0} max={1}
              format={(v) => v < 0.01 ? 'off' : `${Math.round(v * 100)}%`} onChange={setLfoDepth} />
          </div>
        </div>

        {/* Gain */}
        <div className="synth-card flex flex-col gap-2">
          <p className="synth-card-label">Gain</p>
          <Slider label="Vol" value={gainDb} min={-24} max={6}
            format={(v) => `${v.toFixed(1)}dB`} onChange={setGain} />
        </div>
      </div>

      {/* ── Oscilloscope ── */}
      {active && (
        <div className="mt-3">
          <SynthScope />
        </div>
      )}

      {/* ── Arpeggiator ── */}
      <div className={`arp-section mt-3 ${!arpEnabled ? 'opacity-90' : ''}`}
        style={arpEnabled ? {} : { borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">

          {/* Toggle */}
          <button
            onClick={() => handleArpToggle(!arpEnabled)} disabled={!active}
            aria-pressed={arpEnabled}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider disabled:opacity-40"
            style={arpEnabled
              ? { background: 'var(--accent)', color: 'white' }
              : { background: '#1e1e2e', border: '1px solid #333', color: 'var(--text-muted)' }}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${arpEnabled ? 'bg-white animate-pulse' : 'bg-zinc-600'}`} />
            ARP
          </button>

          {/* Mode */}
          <div className="flex items-center gap-1">
            <span className="synth-card-label mr-0.5">{ro ? 'Mod' : 'Mode'}</span>
            {ARP_MODES.map((m) => (
              <button key={m.id} onClick={() => setArpMode(m.id)}
                className="preset-chip"
                style={arpMode === m.id ? { background: 'var(--accent-dark)', borderColor: 'var(--accent)', color: '#e9d5ff' } : {}}
              >{ro ? m.labelRo : m.label}</button>
            ))}
          </div>

          {/* BPM */}
          <div className="flex items-center gap-1">
            <span className="synth-card-label">BPM</span>
            <button onClick={() => setArpBpm(Math.max(40, arpBpm - (arpBpm > 100 ? 5 : 1)))}
              className="rounded px-1.5 py-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>−</button>
            <input
              type="number" min={40} max={300} value={arpBpm}
              onChange={(e) => { const v = Number(e.target.value); if (v >= 40 && v <= 300) setArpBpm(v) }}
              className="bpm-display"
            />
            <button onClick={() => setArpBpm(Math.min(300, arpBpm + (arpBpm >= 100 ? 5 : 1)))}
              className="rounded px-1.5 py-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>+</button>
            <button onClick={handleTapTempo}
              className="rounded-md px-2 py-0.5 text-[10px] font-semibold"
              style={tapFlash
                ? { background: 'var(--accent)', color: 'white' }
                : { background: '#1e1e2e', border: '1px solid #333', color: 'var(--text-muted)' }}
            >Tap</button>
          </div>

          {/* Division */}
          <div className="flex items-center gap-1">
            <span className="synth-card-label mr-0.5">{ro ? 'Div' : 'Div'}</span>
            {ARP_DIVISIONS.map((d) => (
              <button key={d.value} onClick={() => setArpDivision(d.value)}
                className="rounded px-2 py-0.5 font-mono text-[10px] font-semibold"
                style={arpDivision === d.value
                  ? { background: 'var(--accent)', color: 'white' }
                  : { background: '#1e1e2e', border: '1px solid #333', color: 'var(--text-muted)' }}
              >{d.label}</button>
            ))}
          </div>

          {/* Octave range */}
          <div className="flex items-center gap-1">
            <span className="synth-card-label mr-0.5">Oct</span>
            {[1, 2, 3].map((n) => (
              <button key={n} onClick={() => setArpOctaves(n)}
                className="rounded px-2 py-0.5 text-[10px] font-semibold"
                style={arpOctaves === n
                  ? { background: 'var(--accent)', color: 'white' }
                  : { background: '#1e1e2e', border: '1px solid #333', color: 'var(--text-muted)' }}
              >{n}</button>
            ))}
          </div>

          {/* Gate */}
          <div className="flex items-center gap-1.5">
            <span className="synth-card-label">{ro ? 'Poartă' : 'Gate'}</span>
            <input type="range" min={0.1} max={1.0} step={0.01} value={arpGate}
              onChange={(e) => setArpGate(Number(e.target.value))}
              className="gate-slider" />
            <span className="w-7 font-mono text-[10px]" style={{ color: 'var(--text-accent)' }}>
              {Math.round(arpGate * 100)}%
            </span>
          </div>
        </div>

        {arpEnabled && (
          <p className="mt-1.5 text-[9px]" style={{ color: 'var(--text-muted)' }}>
            {ro
              ? 'Ține apăsate taste / clicuri pe claviatură — arpegiorul le va parcurge în buclă'
              : 'Hold keys or click piano keys — the arpeggiator will loop through them'}
          </p>
        )}
      </div>

      {/* ── Chord mode ── */}
      <div className="arp-section mt-2"
        style={chordEnabled ? {} : { borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            onClick={() => setChordEnabled(!chordEnabled)} disabled={!active}
            aria-pressed={chordEnabled}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider disabled:opacity-40"
            style={chordEnabled
              ? { background: '#4338ca', color: 'white' }
              : { background: '#1e1e2e', border: '1px solid #333', color: 'var(--text-muted)' }}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${chordEnabled ? 'bg-white' : 'bg-zinc-600'}`} />
            CHORD
          </button>
          <div className="flex flex-wrap items-center gap-1">
            {Object.entries(CHORD_TYPES).map(([key, ct]) => (
              <button key={key} onClick={() => setChordType(key)}
                className="preset-chip"
                style={chordType === key ? { background: '#312e81', borderColor: '#4338ca', color: '#c7d2fe' } : {}}
              >{ro ? ct.labelRo : ct.label}</button>
            ))}
          </div>
          {chordEnabled && (
            <span className="text-[9px]" style={{ color: 'var(--text-accent)', opacity: 0.7 }}>
              {(CHORD_TYPES[chordType]?.intervals ?? []).map((i) => {
                const names = ['R', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7']
                return names[i] ?? i
              }).join(' – ')}
            </span>
          )}
        </div>
      </div>

      {/* ── Pitch wheel + Piano ── */}
      <div className="mt-3 flex items-stretch gap-2">

        {/* Pitch bend */}
        {active && (
          <div className="flex shrink-0 flex-col items-center gap-1">
            <span className="synth-card-label">PB</span>
            <input
              type="range" min={-200} max={200} step={1} value={pitchBend}
              onChange={(e) => handlePitchBend(Number(e.target.value))}
              onMouseUp={() => handlePitchBend(0)}
              onTouchEnd={() => handlePitchBend(0)}
              className="pitch-fader"
            />
            <span className="w-8 text-center font-mono text-[9px]" style={{ color: 'var(--text-muted)' }}>
              {pitchBend === 0 ? '±0' : `${pitchBend > 0 ? '+' : ''}${(pitchBend / 100).toFixed(1)}`}
            </span>
          </div>
        )}

        {/* Piano keyboard */}
        <div className="relative h-20 flex-1 select-none overflow-hidden rounded border border-zinc-700">
          {whiteKeys.map((key, idx) => {
            const width  = 100 / whiteKeys.length
            const isC    = key.midi % 12 === 0
            const queued = arpEnabled && arpQueuedNotes.has(key.midi)
            return (
              <div
                key={key.midi}
                style={{ left: `${idx * width}%`, width: `${width}%` }}
                className={`piano-white-key absolute inset-y-0 cursor-pointer border-r border-zinc-400/40 ${
                  activeNote === key.midi ? 'active' : queued ? 'queued' : ''
                }`}
                onMouseDown={() => handleNoteOn(key.midi)}
                onMouseUp={() => handleNoteOff(key.midi)}
                onMouseLeave={() => handleNoteOff(key.midi)}
                onTouchStart={(e) => { e.preventDefault(); handleNoteOn(key.midi) }}
                onTouchEnd={() => handleNoteOff(key.midi)}
              >
                {isC && (
                  <span className="pointer-events-none absolute bottom-1 left-0 right-0 text-center font-mono text-[7px] leading-none"
                    style={{ color: '#9ca3af' }}>
                    {midiToName(key.midi)}
                  </span>
                )}
              </div>
            )
          })}
          {blackKeys.map((key) => {
            const left  = blackKeyLeft(key.midi)
            const width = (100 / whiteKeys.length) * 0.6
            const queued = arpEnabled && arpQueuedNotes.has(key.midi)
            return (
              <div
                key={key.midi}
                style={{ left: `${left}%`, width: `${width}%` }}
                className={`piano-black-key absolute top-0 z-10 h-[58%] cursor-pointer ${
                  activeNote === key.midi ? 'active' : queued ? 'queued' : ''
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
      </div>

      {active && !arpEnabled && (
        <p className="mt-2 text-[9px]" style={{ color: 'var(--text-muted)' }}>
          {ro
            ? 'Apasă taste A–; pentru a cânta · Click pe claviatură · Sunetul trece prin lanțul de efecte'
            : 'Press keys A–; to play · Click keyboard · Sound routes through the effects chain'}
        </p>
      )}
    </section>
  )
}
