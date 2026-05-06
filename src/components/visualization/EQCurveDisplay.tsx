/**
 * Interactive EQ frequency-response display.
 *
 * Interaction per node:
 *   - Drag X  → frequency  (all band types)
 *   - Drag Y  → gain       (Bell, LowShelf, HighShelf only)
 *   - Scroll  → Q          (all band types)
 *
 * HPF / LPF bands render a shaded "blocked" region on the cut side.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  EQ_BAND_PARAM,
  EQ_BAND_TYPE,
  EQ_BANDS,
  eqParamId,
  type EffectInstance,
} from '@/types/effects'
import {
  biquadMagnitude,
  highPass,
  highShelf,
  lowPass,
  lowShelf,
  notch,
  peaking,
} from '@/utils/biquad'

// ── ViewBox constants ──────────────────────────────────────────────────────────

const W = 800
const H = 180
const F_MIN = 20
const F_MAX = 20_000
const DB_RANGE = 24         // ± dB shown on the Y axis
const N = 300               // frequency grid resolution
const NODE_R = 7            // node radius in viewBox units

const BAND_COLORS: readonly string[] = ['#a855f7', '#22d3ee', '#10b981', '#f59e0b']

// Band types that expose a gain parameter on the Y axis
const HAS_GAIN_Y = new Set([
  EQ_BAND_TYPE.Bell,
  EQ_BAND_TYPE.LowShelf,
  EQ_BAND_TYPE.HighShelf,
])

// ── Coordinate helpers ────────────────────────────────────────────────────────

function freqToX(f: number): number {
  const lo = Math.log10(F_MIN), hi = Math.log10(F_MAX)
  return Math.max(0, Math.min(W, ((Math.log10(Math.max(f, F_MIN)) - lo) / (hi - lo)) * W))
}

function xToFreq(x: number): number {
  const lo = Math.log10(F_MIN), hi = Math.log10(F_MAX)
  return 10 ** (lo + Math.max(0, Math.min(1, x / W)) * (hi - lo))
}

function dbToY(db: number): number {
  return H - Math.max(0, Math.min(1, (db + DB_RANGE) / (2 * DB_RANGE))) * H
}

function yToDb(y: number): number {
  return (1 - Math.max(0, Math.min(1, y / H))) * 2 * DB_RANGE - DB_RANGE
}

/** Convert a browser pointer position to SVG viewBox coordinates. */
function toSvg(clientX: number, clientY: number, el: SVGSVGElement) {
  const r = el.getBoundingClientRect()
  return {
    x: ((clientX - r.left) / r.width) * W,
    y: ((clientY - r.top) / r.height) * H,
  }
}

// ── Biquad helpers ────────────────────────────────────────────────────────────

function coeffs(type: number, freq: number, q: number, gain: number, sr: number) {
  switch (Math.round(type)) {
    case EQ_BAND_TYPE.LowShelf:  return lowShelf(freq, q, gain, sr)
    case EQ_BAND_TYPE.HighShelf: return highShelf(freq, q, gain, sr)
    case EQ_BAND_TYPE.HighPass:  return highPass(freq, q, sr)
    case EQ_BAND_TYPE.LowPass:   return lowPass(freq, q, sr)
    case EQ_BAND_TYPE.Notch:     return notch(freq, q, sr)
    default:                     return peaking(freq, q, gain, sr)
  }
}

// Pre-computed log-spaced frequency sample grid (constant across renders).
const FREQ_GRID = Array.from({ length: N }, (_, i) => {
  const lo = Math.log10(F_MIN), hi = Math.log10(F_MAX)
  return 10 ** (lo + (i / (N - 1)) * (hi - lo))
})

function fmtFreq(f: number) {
  return f >= 1000 ? `${(f / 1000).toFixed(f >= 10_000 ? 0 : 1)}k` : f.toFixed(0)
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface EQCurveDisplayProps {
  instance: EffectInstance
  sampleRate?: number
  /** Called when the user interacts with the display (drag / scroll). */
  onParamChange?: (paramId: number, value: number) => void
}

interface DragState {
  bandIdx: number
  hasGain: boolean   // whether Y drag should update gain
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EQCurveDisplay({
  instance,
  sampleRate = 48_000,
  onParamChange,
}: EQCurveDisplayProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  // Stable refs — kept current without causing re-renders inside event handlers.
  const paramsRef = useRef(instance.params)
  paramsRef.current = instance.params
  const cbRef = useRef(onParamChange)
  cbRef.current = onParamChange

  const [drag, setDrag]       = useState<DragState | null>(null)
  const [hovered, setHovered] = useState<number | null>(null)
  const hoveredRef = useRef<number | null>(null)
  hoveredRef.current = hovered

  // ── Geometry computation ────────────────────────────────────────────────────

  const geo = useMemo(() => {
    const totLin = new Float32Array(N).fill(1)
    const bandPaths: { color: string; d: string }[] = []
    const cutRects:  { color: string; x: number; w: number }[] = []
    const nodes: {
      bandIdx: number; x: number; y: number
      color: string; hasGain: boolean
    }[] = []

    for (let b = 0; b < EQ_BANDS; b++) {
      const p = instance.params
      if ((p[eqParamId(b, EQ_BAND_PARAM.ENABLED)] ?? 0) < 0.5) continue

      const type  = p[eqParamId(b, EQ_BAND_PARAM.TYPE)]  ?? EQ_BAND_TYPE.Bell
      const freq  = p[eqParamId(b, EQ_BAND_PARAM.FREQ)]  ?? 1_000
      const q     = p[eqParamId(b, EQ_BAND_PARAM.Q)]     ?? 1
      const gain  = p[eqParamId(b, EQ_BAND_PARAM.GAIN)]  ?? 0
      const color = BAND_COLORS[b] ?? '#a855f7'
      const typeR = Math.round(type)
      const c     = coeffs(typeR, freq, q, gain, sampleRate)
      const hasG  = HAS_GAIN_Y.has(typeR)

      // Per-band magnitude curve
      let d = ''
      for (let i = 0; i < N; i++) {
        const f   = FREQ_GRID[i] as number
        const mag = biquadMagnitude(c, f, sampleRate)
        totLin[i] = (totLin[i] as number) * mag
        const db  = 20 * Math.log10(Math.max(mag, 1e-9))
        const sx  = freqToX(f), sy = dbToY(db)
        d += i === 0 ? `M ${sx.toFixed(1)} ${sy.toFixed(1)}`
                     : ` L ${sx.toFixed(1)} ${sy.toFixed(1)}`
      }
      bandPaths.push({ color, d })

      // Shaded blocked region for HPF / LPF
      const cx = freqToX(freq)
      if (typeR === EQ_BAND_TYPE.HighPass) cutRects.push({ color, x: 0, w: cx })
      if (typeR === EQ_BAND_TYPE.LowPass)  cutRects.push({ color, x: cx, w: W - cx })

      // Node position: Notch sits at the 0-dB line; all others at the biquad
      // magnitude evaluated at the band's own center/cutoff frequency.
      const nodeX = freqToX(freq)
      const nodeY = typeR === EQ_BAND_TYPE.Notch
        ? dbToY(0)
        : dbToY(20 * Math.log10(Math.max(biquadMagnitude(c, freq, sampleRate), 1e-9)))

      nodes.push({ bandIdx: b, x: nodeX, y: nodeY, color, hasGain: hasG })
    }

    // Total (summed) curve
    let totalPath = ''
    for (let i = 0; i < N; i++) {
      const db = 20 * Math.log10(Math.max(totLin[i] as number, 1e-9))
      const sx = freqToX(FREQ_GRID[i] as number), sy = dbToY(db)
      totalPath += i === 0 ? `M ${sx.toFixed(1)} ${sy.toFixed(1)}`
                           : ` L ${sx.toFixed(1)} ${sy.toFixed(1)}`
    }

    return { bandPaths, cutRects, nodes, totalPath }
  }, [instance.params, sampleRate])

  // ── Drag ───────────────────────────────────────────────────────────────────

  function onNodeDown(e: React.PointerEvent, bandIdx: number, hasGain: boolean) {
    e.stopPropagation()
    svgRef.current?.setPointerCapture(e.pointerId)
    setDrag({ bandIdx, hasGain })
    setHovered(bandIdx)
  }

  function onSvgMove(e: React.PointerEvent) {
    if (!drag || !svgRef.current) return
    const { x, y } = toSvg(e.clientX, e.clientY, svgRef.current)

    const newFreq = Math.max(F_MIN, Math.min(F_MAX, xToFreq(x)))
    cbRef.current?.(eqParamId(drag.bandIdx, EQ_BAND_PARAM.FREQ), newFreq)

    if (drag.hasGain) {
      const newGain = Math.max(-DB_RANGE, Math.min(DB_RANGE, yToDb(y)))
      cbRef.current?.(eqParamId(drag.bandIdx, EQ_BAND_PARAM.GAIN), newGain)
    }
  }

  function onSvgUp(e: React.PointerEvent) {
    svgRef.current?.releasePointerCapture(e.pointerId)
    setDrag(null)
  }

  // ── Scroll → Q (needs non-passive listener to call preventDefault) ──────────

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      const b = hoveredRef.current
      if (b === null) return
      e.preventDefault()
      const qId  = eqParamId(b, EQ_BAND_PARAM.Q)
      const cur  = paramsRef.current[qId] ?? 1
      // Scroll down → higher Q (narrower); scroll up → lower Q (wider)
      const factor = e.deltaY > 0 ? 1.12 : 1 / 1.12
      cbRef.current?.(qId, Math.max(0.1, Math.min(18, cur * factor)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // ── Grid geometry ──────────────────────────────────────────────────────────

  const zeroY     = dbToY(0)
  const VLIGHT    = [50, 200, 500, 2_000, 5_000]
  const VDARK     = [100, 1_000, 10_000]
  const HLABEL    = [-12, 12]    // dB lines with labels

  // Active-drag info for the tooltip label
  const dragBandIdx = drag?.bandIdx
  const dragNode    = dragBandIdx != null
    ? geo.nodes.find(n => n.bandIdx === dragBandIdx) ?? null
    : null
  const dragFreq = dragBandIdx != null
    ? (instance.params[eqParamId(dragBandIdx, EQ_BAND_PARAM.FREQ)] ?? 1_000)
    : 0
  const dragGain = dragBandIdx != null
    ? (instance.params[eqParamId(dragBandIdx, EQ_BAND_PARAM.GAIN)] ?? 0)
    : 0

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      preserveAspectRatio="none"
      className={`rounded-md bg-zinc-950 select-none ${drag ? 'cursor-grabbing' : ''}`}
      role="img"
      aria-label="Interactive EQ frequency response"
      onPointerMove={onSvgMove}
      onPointerUp={onSvgUp}
      onPointerLeave={onSvgUp}
    >
      {/* ── Grid ── */}
      {VLIGHT.map(f => (
        <line key={`vl${f}`}
          x1={freqToX(f)} x2={freqToX(f)} y1={0} y2={H}
          stroke="#27272a" strokeWidth="0.5" />
      ))}
      {VDARK.map(f => (
        <line key={`vd${f}`}
          x1={freqToX(f)} x2={freqToX(f)} y1={0} y2={H}
          stroke="#3f3f46" strokeWidth="1" />
      ))}
      {HLABEL.map(db => (
        <line key={`hl${db}`}
          x1={0} x2={W} y1={dbToY(db)} y2={dbToY(db)}
          stroke="#27272a" strokeWidth="0.5" />
      ))}
      {/* 0 dB reference line */}
      <line x1={0} x2={W} y1={zeroY} y2={zeroY} stroke="#3f3f46" strokeWidth="1" />

      {/* ── HPF / LPF cut regions ── */}
      {geo.cutRects.map((r, i) => (
        <rect key={`cut${i}`}
          x={r.x} y={0} width={r.w} height={H}
          fill={r.color} fillOpacity="0.07" />
      ))}

      {/* ── Per-band ghost curves ── */}
      {geo.bandPaths.map(({ color, d }, i) => (
        <path key={`bp${i}`}
          d={d} fill="none"
          stroke={color} strokeOpacity="0.4" strokeWidth="1.5" />
      ))}

      {/* ── Total magnitude curve ── */}
      <path d={geo.totalPath} fill="none" stroke="#fafafa" strokeWidth="2" />

      {/* ── Interactive nodes ── */}
      {geo.nodes.map(({ bandIdx, x, y, color, hasGain }) => {
        const isActive  = drag?.bandIdx === bandIdx
        const isHovered = hovered === bandIdx
        const r = isActive || isHovered ? NODE_R + 2 : NODE_R
        return (
          <g key={`n${bandIdx}`}>
            {/* Outer Q-hint ring, visible on hover / drag */}
            {(isActive || isHovered) && (
              <circle cx={x} cy={y} r={r + 9}
                fill="none" stroke={color}
                strokeOpacity="0.2" strokeWidth="1.5" />
            )}
            <circle
              cx={x} cy={y} r={r}
              fill={color}
              stroke="#050505" strokeWidth="1.5"
              cursor={isActive ? 'grabbing' : 'grab'}
              onPointerDown={e => onNodeDown(e, bandIdx, hasGain)}
              onPointerEnter={() => { if (!drag) setHovered(bandIdx) }}
              onPointerLeave={() => { if (!drag) setHovered(null) }}
            />
          </g>
        )
      })}

      {/* ── Drag tooltip ── */}
      {dragNode && (
        <text
          x={Math.min(dragNode.x + 12, W - 130)}
          y={Math.max(dragNode.y - 10, 14)}
          fontSize="11"
          fill={dragNode.color}
          style={{ pointerEvents: 'none' }}
        >
          {fmtFreq(dragFreq)} Hz
          {drag?.hasGain
            ? ` / ${dragGain >= 0 ? '+' : ''}${dragGain.toFixed(1)} dB`
            : ''}
        </text>
      )}

      {/* ── Frequency axis labels ── */}
      {([100, 500, 1_000, 5_000, 10_000] as const).map(f => (
        <text key={`fl${f}`}
          x={freqToX(f)} y={H - 3}
          fontSize="8" fill="#52525b" textAnchor="middle">
          {fmtFreq(f)}
        </text>
      ))}

      {/* ── dB axis labels ── */}
      <text x={4} y={dbToY(12) + 3}  fontSize="8" fill="#52525b">+12</text>
      <text x={4} y={zeroY + 3}      fontSize="8" fill="#71717a">0</text>
      <text x={4} y={dbToY(-12) + 3} fontSize="8" fill="#52525b">-12</text>
    </svg>
  )
}
