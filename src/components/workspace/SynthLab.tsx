import { useEffect, useMemo, useRef, useState } from 'react'
import {
  useSynthStore, SYNTH_PARAM, OSC_TYPES, FILTER_TYPES,
  ARP_MODES, ARP_DIVISIONS, type ArpMode, type SavedPatch,
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

// ─── Oscilloscope ─────────────────────────────────────────────────────────────

function SynthScope() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const analyser = getAnalyser()
    const canvas   = canvasRef.current
    if (!analyser || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const N   = analyser.fftSize          // 2048
    const buf = new Float32Array(N)
    let rafId = 0

    function draw() {
      rafId = requestAnimationFrame(draw)
      analyser!.getFloatTimeDomainData(buf)

      const W = canvas!.width
      const H = canvas!.height

      ctx!.fillStyle = '#18181b'          // zinc-900
      ctx!.fillRect(0, 0, W, H)

      // Center grid line
      ctx!.strokeStyle = '#3f3f46'        // zinc-700
      ctx!.lineWidth = 1
      ctx!.beginPath()
      ctx!.moveTo(0, H / 2)
      ctx!.lineTo(W, H / 2)
      ctx!.stroke()

      // Waveform — maps [-1, 1] to [5 %, 95 %] of height
      ctx!.strokeStyle = '#a855f7'        // purple-500
      ctx!.lineWidth = 1.5
      ctx!.beginPath()
      const step = W / N
      for (let i = 0; i < N; i++) {
        const y = (0.5 - buf[i] * 0.45) * H
        if (i === 0) ctx!.moveTo(0, y)
        else         ctx!.lineTo(i * step, y)
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
      height={80}
      className="w-full rounded-lg"
    />
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
  const setOctaveShift   = useSynthStore((s) => s.setOctaveShift)
  const noteOn           = useSynthStore((s) => s.noteOn)
  const noteOff          = useSynthStore((s) => s.noteOff)
  const noteOffAll       = useSynthStore((s) => s.noteOffAll)
  const savedPatches     = useSynthStore((s) => s.savedPatches)
  const savePatch        = useSynthStore((s) => s.savePatch)
  const deleteSavedPatch = useSynthStore((s) => s.deleteSavedPatch)
  const monoMode         = useSynthStore((s) => s.monoMode)
  const setMonoMode      = useSynthStore((s) => s.setMonoMode)

  // ── WebMIDI ──
  const { devices: midiDevices, supported: midiSupported, permissionDenied: midiDenied } = useMidi({
    onNoteOn:  (midi) => { if (active) handleNoteOn(midi) },
    onNoteOff: (midi) => { if (active) handleNoteOff(midi) },
  })

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
  const arpGate       = useSynthStore((s) => s.arpGate)
  const setArpGate    = useSynthStore((s) => s.setArpGate)

  // ── Chord mode ──
  const [patchName, setPatchName] = useState('')
  const [chordEnabled, setChordEnabled] = useState(false)
  const [chordType,    setChordType]    = useState('maj')
  const chordEnabledRef = useRef(chordEnabled)
  chordEnabledRef.current = chordEnabled
  const chordTypeRef = useRef(chordType)
  chordTypeRef.current = chordType

  // ── Visual state ──
  const [activeNote, setActiveNote] = useState<number | null>(null)
  const [arpQueuedNotes, setArpQueuedNotes] = useState<Set<number>>(new Set())
  const [tapFlash, setTapFlash] = useState(false)
  const [pitchBend, setPitchBend] = useState(0)  // cents, ±200

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
  const arpGateRef     = useRef(arpGate)
  arpGateRef.current   = arpGate
  const gateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tapTimesRef    = useRef<number[]>([])

  // ── Piano layout ──
  const effectiveStartMidi = START_MIDI_BASE + octaveShift * 12
  const pianoKeys = useMemo(() => buildKeys(effectiveStartMidi), [effectiveStartMidi])
  const whiteKeys = useMemo(() => pianoKeys.filter((k) => !k.isBlack), [pianoKeys])
  const blackKeys = useMemo(() => pianoKeys.filter((k) => k.isBlack), [pianoKeys])

  function syncArpDisplay() {
    setArpQueuedNotes(new Set(arpNotesRef.current))
  }

  // ── Note-on / note-off helpers (arp-aware, called from piano + keyboard) ──
  const noteOnRef     = useRef(noteOn)
  noteOnRef.current   = noteOn
  const noteOffRef    = useRef(noteOff)
  noteOffRef.current  = noteOff
  const noteOffAllRef = useRef(noteOffAll)
  noteOffAllRef.current = noteOffAll

  // Chord-aware wrappers — reads refs so they're safe to call from effects/closures.
  const chordNoteOnRef  = useRef<(root: number) => void>(null!)
  const chordNoteOffRef = useRef<(root: number) => void>(null!)
  chordNoteOnRef.current = (root: number) => {
    if (!chordEnabledRef.current) {
      noteOnRef.current(root, midiToFreq(root))
      return
    }
    const intervals = CHORD_TYPES[chordTypeRef.current]?.intervals ?? [0]
    for (const interval of intervals) {
      const m = root + interval
      if (m >= 0 && m <= 127) noteOnRef.current(m, midiToFreq(m))
    }
  }
  chordNoteOffRef.current = (root: number) => {
    if (!chordEnabledRef.current) {
      noteOffRef.current(root)
      return
    }
    const intervals = CHORD_TYPES[chordTypeRef.current]?.intervals ?? [0]
    for (const interval of intervals) {
      const m = root + interval
      if (m >= 0 && m <= 127) noteOffRef.current(m)
    }
  }

  function handleNoteOn(midi: number) {
    if (!active) return
    if (arpEnabledRef.current) {
      arpNotesRef.current.add(midi)
      syncArpDisplay()
      arpSeqRef.current = buildArpSeq(arpNotesRef.current, arpModeRef.current, arpOctavesRef.current)
      if (arpNotesRef.current.size === 1) arpStepRef.current = 0
    } else {
      chordNoteOnRef.current(midi)
      setActiveNote(midi)
      activeNoteRef.current = midi
    }
  }

  function handleNoteOff(midi: number) {
    if (!active) return
    if (arpEnabledRef.current) {
      arpNotesRef.current.delete(midi)
      syncArpDisplay()
      arpSeqRef.current = buildArpSeq(arpNotesRef.current, arpModeRef.current, arpOctavesRef.current)
      if (arpNotesRef.current.size === 0) {
        noteOffAllRef.current()
        setActiveNote(null)
        activeNoteRef.current = null
        arpStepRef.current = 0
      }
    } else {
      if (activeNoteRef.current === midi) {
        chordNoteOffRef.current(midi)
        setActiveNote(null)
        activeNoteRef.current = null
      }
    }
  }

  // ── Keyboard shortcuts ──
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
        arpNotesRef.current.add(midi)
        syncArpDisplay()
        arpSeqRef.current = buildArpSeq(arpNotesRef.current, arpModeRef.current, arpOctavesRef.current)
        if (arpNotesRef.current.size === 1) arpStepRef.current = 0
      } else {
        chordNoteOnRef.current(midi)
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
        syncArpDisplay()
        arpSeqRef.current = buildArpSeq(arpNotesRef.current, arpModeRef.current, arpOctavesRef.current)
        if (arpNotesRef.current.size === 0) {
          noteOffAllRef.current()
          setActiveNote(null)
          activeNoteRef.current = null
          arpStepRef.current = 0
        }
      } else {
        if (heldKeys.current.size === 0) {
          chordNoteOffRef.current(midi)
          setActiveNote(null)
          activeNoteRef.current = null
        } else if (activeNoteRef.current === midi) {
          // Retrigger last held key (mono legato)
          const codes = [...heldKeys.current]
          const lastOffset = KEY_OFFSETS[codes[codes.length - 1] ?? '']
          if (lastOffset !== undefined) {
            const lastMidi = effectiveStartRef.current + lastOffset
            chordNoteOnRef.current(lastMidi)
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
      noteOffAllRef.current()
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
        noteOffAllRef.current()
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
        if (gateTimeoutRef.current !== null) {
          clearTimeout(gateTimeoutRef.current)
          gateTimeoutRef.current = null
        }
        chordNoteOnRef.current(midi)
        setActiveNote(midi)
        activeNoteRef.current = midi
        if (arpGateRef.current < 0.99) {
          const gateMidi = midi   // capture for the timeout closure
          gateTimeoutRef.current = setTimeout(() => {
            chordNoteOffRef.current(gateMidi)
            gateTimeoutRef.current = null
          }, intervalMs * arpGateRef.current)
        }
      }
      arpStepRef.current++
    }, intervalMs)

    return () => {
      clearInterval(id)
      if (gateTimeoutRef.current !== null) {
        clearTimeout(gateTimeoutRef.current)
        gateTimeoutRef.current = null
      }
      noteOffAllRef.current()
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
      syncArpDisplay()
      arpSeqRef.current = buildArpSeq(arpNotesRef.current, arpModeRef.current, arpOctavesRef.current)
      arpStepRef.current = 0
    } else {
      arpNotesRef.current.clear()
      syncArpDisplay()
      arpSeqRef.current = []
      noteOffAllRef.current()
    }
    setArpEnabled(v)
  }

  function handleOctaveShift(n: number) {
    // Clear arp notes to avoid stuck notes when octave changes mid-play
    arpNotesRef.current.clear()
    syncArpDisplay()
    arpSeqRef.current = []
    heldKeys.current.clear()
    noteOffAllRef.current()
    setActiveNote(null)
    activeNoteRef.current = null
    setOctaveShift(n)
  }

  function handleMonoToggle(v: boolean) {
    // Silence everything when switching modes to avoid stuck notes.
    noteOffAllRef.current()
    setActiveNote(null)
    activeNoteRef.current = null
    if (arpEnabledRef.current) {
      arpNotesRef.current.clear()
      syncArpDisplay()
      arpSeqRef.current = []
    }
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
      tapTimesRef.current = [now]
      setTapFlash(true); setTimeout(() => setTapFlash(false), 100)
      return
    }
    times.push(now)
    if (times.length > 8) times.splice(0, times.length - 8)
    if (times.length >= 2) {
      let total = 0
      for (let i = 1; i < times.length; i++) total += times[i]! - times[i - 1]!
      const bpm = Math.round(60_000 / (total / (times.length - 1)))
      setArpBpm(Math.min(300, Math.max(40, bpm)))
    }
    setTapFlash(true)
    setTimeout(() => setTapFlash(false), 100)
  }

  function loadPatch(p: Patch) {
    setOscType(p.oscType);    setDetune(p.detuneCents)
    setAttack(p.attackMs);   setDecay(p.decayMs);  setSustain(p.sustain);  setRelease(p.releaseMs)
    setFilterType(p.filterType); setCutoff(p.cutoffHz); setResonance(p.resonance)
    setLfoRate(p.lfoRate);   setLfoDepth(p.lfoDepth); setGain(p.gainDb)
  }

  function loadSavedPatch(p: SavedPatch) {
    setOscType(p.oscType);    setDetune(p.detuneCents)
    setAttack(p.attackMs);   setDecay(p.decayMs);  setSustain(p.sustain);  setRelease(p.releaseMs)
    setFilterType(p.filterType); setCutoff(p.cutoffHz); setResonance(p.resonance)
    setLfoRate(p.lfoRate);   setLfoDepth(p.lfoDepth); setGain(p.gainDb)
  }

  function handleSavePatch() {
    if (!patchName.trim()) return
    savePatch(patchName)
    setPatchName('')
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
          {/* MIDI status */}
          {midiSupported === true && (
            <div className="flex items-center gap-1 text-[10px]">
              {midiDenied ? (
                <span className="text-zinc-600" title="MIDI permission denied">MIDI ✗</span>
              ) : midiDevices.length > 0 ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="max-w-[7rem] truncate text-zinc-400" title={midiDevices.map((d) => d.name).join(', ')}>
                    {midiDevices.length === 1
                      ? midiDevices[0]!.name
                      : `${midiDevices.length} MIDI`}
                  </span>
                </>
              ) : (
                <span className="text-zinc-700">No MIDI</span>
              )}
            </div>
          )}

          {/* Mono / Poly toggle */}
          <button
            onClick={() => handleMonoToggle(!monoMode)}
            disabled={!active}
            title={monoMode
              ? (ro ? 'Trece la mod polifonic (8 voci)' : 'Switch to polyphonic mode (8 voices)')
              : (ro ? 'Trece la mod monofonic (1 voce)' : 'Switch to monophonic mode (1 voice)')}
            className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition disabled:opacity-40 ${
              monoMode
                ? 'bg-amber-600 text-white hover:bg-amber-500'
                : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
            }`}
          >
            {monoMode ? 'MONO' : 'POLY'}
          </button>

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
      <div className="mb-4 space-y-1.5">
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
          <span className="shrink-0 pr-1 text-[9px] uppercase tracking-wider text-zinc-600">
            {ro ? 'Fabr:' : 'Factory:'}
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

        {/* User patches row */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
          <span className="shrink-0 pr-1 text-[9px] uppercase tracking-wider text-zinc-600">
            {ro ? 'Salvate:' : 'Saved:'}
          </span>
          {savedPatches.map((p) => (
            <span key={p.id} className="flex shrink-0 items-center overflow-hidden rounded-md bg-indigo-900/40 text-[10px]">
              <button
                onClick={() => loadSavedPatch(p)}
                className="px-2.5 py-1 font-medium text-indigo-300 transition hover:text-indigo-100"
              >{p.name}</button>
              <button
                onClick={() => deleteSavedPatch(p.id)}
                title={ro ? 'Șterge patch' : 'Delete patch'}
                className="px-1.5 py-1 text-indigo-600 transition hover:text-red-400"
              >×</button>
            </span>
          ))}
          {/* Save current state */}
          <input
            type="text"
            value={patchName}
            onChange={(e) => setPatchName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSavePatch() }}
            placeholder={ro ? 'Nume patch…' : 'Patch name…'}
            className="w-24 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-[10px] text-zinc-300 placeholder-zinc-600 focus:border-indigo-500 focus:outline-none"
          />
          <button
            onClick={handleSavePatch}
            disabled={!patchName.trim()}
            title={ro ? 'Salvează starea curentă ca patch' : 'Save current state as patch'}
            className="shrink-0 rounded-md bg-indigo-700 px-2.5 py-1 text-[10px] font-semibold text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {ro ? 'Salvează' : 'Save'}
          </button>
        </div>
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

      {/* Oscilloscope */}
      {active && (
        <div className="mt-4">
          <SynthScope />
        </div>
      )}

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
            <button
              onClick={handleTapTempo}
              className={`rounded px-2 py-0.5 text-[10px] font-semibold transition ${
                tapFlash ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300'
              }`}
            >Tap</button>
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

          {/* Gate */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] uppercase tracking-wider text-zinc-600">
              {ro ? 'Poartă' : 'Gate'}
            </span>
            <input
              type="range" min={0.1} max={1.0} step={0.01}
              value={arpGate}
              onChange={(e) => setArpGate(Number(e.target.value))}
              className="w-16 cursor-pointer accent-purple-500"
            />
            <span className="w-7 font-mono text-[10px] text-zinc-400">
              {Math.round(arpGate * 100)}%
            </span>
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

      {/* ── Chord mode ── */}
      <div className={`mt-3 rounded-xl border px-3 py-2.5 transition-colors ${
        chordEnabled
          ? 'border-indigo-500/40 bg-indigo-500/5'
          : 'border-zinc-800 bg-zinc-900/40'
      }`}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            onClick={() => setChordEnabled(!chordEnabled)}
            disabled={!active}
            aria-pressed={chordEnabled}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition disabled:opacity-40 ${
              chordEnabled
                ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${chordEnabled ? 'bg-white' : 'bg-zinc-600'}`} />
            CHORD
          </button>
          <div className="flex flex-wrap items-center gap-1">
            {Object.entries(CHORD_TYPES).map(([key, ct]) => (
              <button
                key={key}
                onClick={() => setChordType(key)}
                className={`rounded px-2 py-0.5 text-[10px] font-semibold transition ${
                  chordType === key
                    ? 'bg-indigo-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {ro ? ct.labelRo : ct.label}
              </button>
            ))}
          </div>
          {chordEnabled && (
            <span className="text-[9px] text-indigo-400/70">
              {(CHORD_TYPES[chordType]?.intervals ?? []).map((i) => {
                const names = ['R', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7']
                return names[i] ?? i
              }).join(' – ')}
            </span>
          )}
        </div>
      </div>

      {/* Pitch wheel + Piano keyboard */}
      <div className="mt-4 flex items-stretch gap-2">

        {/* Pitch bend wheel — vertical, springs to centre on release */}
        {active && (
          <div className="flex shrink-0 flex-col items-center gap-1">
            <span className="text-[9px] uppercase tracking-wider text-zinc-500">PB</span>
            <input
              type="range" min={-200} max={200} step={1}
              value={pitchBend}
              onChange={(e) => handlePitchBend(Number(e.target.value))}
              onMouseUp={() => handlePitchBend(0)}
              onTouchEnd={() => handlePitchBend(0)}
              className="h-14 w-3 cursor-grab appearance-none rounded-full bg-zinc-700 accent-purple-500"
              style={{ writingMode: 'vertical-lr', direction: 'rtl' } as React.CSSProperties}
            />
            <span className="w-8 text-center font-mono text-[9px] text-zinc-500">
              {pitchBend === 0 ? '±0' : `${pitchBend > 0 ? '+' : ''}${(pitchBend / 100).toFixed(1)}`}
            </span>
          </div>
        )}

        {/* Piano keyboard */}
        <div className="relative h-20 flex-1 select-none overflow-hidden rounded-lg border border-zinc-700">
        {whiteKeys.map((key, idx) => {
          const width  = 100 / whiteKeys.length
          const isC    = key.midi % 12 === 0
          const queued = arpEnabled && arpQueuedNotes.has(key.midi)
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
          const queued = arpEnabled && arpQueuedNotes.has(key.midi)
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
        </div>{/* /piano keyboard */}
      </div>{/* /pitch-wheel + keyboard row */}

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
