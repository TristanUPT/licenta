import { useMemo } from 'react'
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

interface EQCurveDisplayProps {
  instance: EffectInstance
  /** Audio sample rate — keep in sync with `engine.ts`. */
  sampleRate?: number
  width?: number
  height?: number
}

const F_MIN = 20
const F_MAX = 20_000
const DB_RANGE = 24      // ± dB shown on the y axis
const NUM_POINTS = 256

const BAND_COLORS = ['#a855f7', '#22d3ee', '#10b981', '#f59e0b']

function bandCoeffs(typeValue: number, freq: number, q: number, gainDb: number, sr: number) {
  switch (Math.round(typeValue)) {
    case EQ_BAND_TYPE.LowShelf: return lowShelf(freq, q, gainDb, sr)
    case EQ_BAND_TYPE.HighShelf: return highShelf(freq, q, gainDb, sr)
    case EQ_BAND_TYPE.HighPass: return highPass(freq, q, sr)
    case EQ_BAND_TYPE.LowPass: return lowPass(freq, q, sr)
    case EQ_BAND_TYPE.Notch: return notch(freq, q, sr)
    default: return peaking(freq, q, gainDb, sr)
  }
}

function freqToX(freq: number, width: number): number {
  const lo = Math.log10(F_MIN)
  const hi = Math.log10(F_MAX)
  const t = (Math.log10(freq) - lo) / (hi - lo)
  return Math.max(0, Math.min(1, t)) * width
}

function dbToY(db: number, height: number): number {
  const t = (db + DB_RANGE) / (2 * DB_RANGE) // 0 at -24 dB, 1 at +24 dB
  return height - Math.max(0, Math.min(1, t)) * height
}

/** Draw the magnitude response of all enabled bands. */
export function EQCurveDisplay({
  instance,
  sampleRate = 48_000,
  width = 800,
  height = 140,
}: EQCurveDisplayProps) {
  const { totalPath, perBand, bandMarkers } = useMemo(() => {
    // Pre-compute the freq sample grid once.
    const freqs: number[] = new Array(NUM_POINTS)
    const lo = Math.log10(F_MIN)
    const hi = Math.log10(F_MAX)
    for (let i = 0; i < NUM_POINTS; i++) {
      freqs[i] = 10 ** (lo + (i / (NUM_POINTS - 1)) * (hi - lo))
    }

    const totalLin: number[] = new Array(NUM_POINTS).fill(1)
    const perBandPath: { color: string; d: string }[] = []
    const markers: { x: number; y: number; color: string }[] = []

    for (let b = 0; b < EQ_BANDS; b++) {
      const enabled = (instance.params[eqParamId(b, EQ_BAND_PARAM.ENABLED)] ?? 0) >= 0.5
      if (!enabled) continue
      const typeValue = instance.params[eqParamId(b, EQ_BAND_PARAM.TYPE)] ?? 0
      const freq = instance.params[eqParamId(b, EQ_BAND_PARAM.FREQ)] ?? 1_000
      const q = instance.params[eqParamId(b, EQ_BAND_PARAM.Q)] ?? 1
      const gainDb = instance.params[eqParamId(b, EQ_BAND_PARAM.GAIN)] ?? 0
      const c = bandCoeffs(typeValue, freq, q, gainDb, sampleRate)
      const color = BAND_COLORS[b] ?? '#a855f7'

      let path = ''
      for (let i = 0; i < NUM_POINTS; i++) {
        const mag = biquadMagnitude(c, freqs[i], sampleRate)
        totalLin[i] *= mag
        const db = 20 * Math.log10(Math.max(mag, 1e-6))
        const x = freqToX(freqs[i], width)
        const y = dbToY(db, height)
        path += i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`
      }
      perBandPath.push({ color, d: path })
      markers.push({
        x: freqToX(freq, width),
        y: dbToY(gainDb, height),
        color,
      })
    }

    let totalPath = ''
    for (let i = 0; i < NUM_POINTS; i++) {
      const db = 20 * Math.log10(Math.max(totalLin[i], 1e-6))
      const x = freqToX(freqs[i], width)
      const y = dbToY(db, height)
      totalPath += i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`
    }
    return { totalPath, perBand: perBandPath, bandMarkers: markers }
  }, [instance.params, sampleRate, width, height])

  // Decade grid lines (100, 1k, 10k) + 0 dB line.
  const gridLines = [100, 1_000, 10_000].map((f) => freqToX(f, width))
  const zeroDbY = dbToY(0, height)

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      className="rounded-md bg-zinc-950"
      role="img"
      aria-label="EQ frequency response"
    >
      {/* Grid */}
      {gridLines.map((x, i) => (
        <line key={`vg${i}`} x1={x} x2={x} y1={0} y2={height} stroke="#27272a" strokeWidth="1" />
      ))}
      <line x1={0} x2={width} y1={zeroDbY} y2={zeroDbY} stroke="#3f3f46" strokeWidth="1" />

      {/* Per-band ghost curves */}
      {perBand.map((p, i) => (
        <path
          key={`b${i}`}
          d={p.d}
          fill="none"
          stroke={p.color}
          strokeOpacity="0.35"
          strokeWidth="1"
        />
      ))}

      {/* Total magnitude */}
      <path d={totalPath} fill="none" stroke="#fafafa" strokeWidth="2" />

      {/* Markers (for bell/shelf with gain) */}
      {bandMarkers.map((m, i) => (
        <circle
          key={`m${i}`}
          cx={m.x}
          cy={m.y}
          r="4"
          fill={m.color}
          stroke="#0a0a0a"
          strokeWidth="1.5"
        />
      ))}

      {/* Frequency labels */}
      <text x={freqToX(100, width)} y={height - 4} fontSize="9" fill="#52525b" textAnchor="middle">100</text>
      <text x={freqToX(1_000, width)} y={height - 4} fontSize="9" fill="#52525b" textAnchor="middle">1k</text>
      <text x={freqToX(10_000, width)} y={height - 4} fontSize="9" fill="#52525b" textAnchor="middle">10k</text>
    </svg>
  )
}
