import { useId, useRef, useState, useCallback } from 'react'
import { KnobHeadless, KnobHeadlessLabel } from 'react-knob-headless'
import type { ParamSchema } from '@/types/effects'

const ARC_START_DEG = -135
const ARC_END_DEG = 135
const KNOB_SIZE = 56

interface KnobProps {
  schema: ParamSchema
  value: number
  onChange: (value: number) => void
}

function valueTo01(value: number, min: number, max: number, scale: ParamSchema['scale']): number {
  if (scale === 'log') {
    const lmin = Math.log10(Math.max(min, 1e-6))
    const lmax = Math.log10(Math.max(max, 1e-6))
    return (Math.log10(Math.max(value, 1e-6)) - lmin) / (lmax - lmin)
  }
  return (value - min) / (max - min)
}

function valueFrom01(t: number, min: number, max: number, scale: ParamSchema['scale']): number {
  if (scale === 'log') {
    const lmin = Math.log10(Math.max(min, 1e-6))
    const lmax = Math.log10(Math.max(max, 1e-6))
    return 10 ** (lmin + t * (lmax - lmin))
  }
  return min + t * (max - min)
}

function describeArc(t: number): string {
  // SVG arc from ARC_START_DEG to ARC_START_DEG + t*(ARC_END_DEG-ARC_START_DEG).
  const start = (ARC_START_DEG * Math.PI) / 180
  const end = ((ARC_START_DEG + t * (ARC_END_DEG - ARC_START_DEG)) * Math.PI) / 180
  const r = 22
  const cx = 28
  const cy = 28
  const x0 = cx + r * Math.cos(start)
  const y0 = cy + r * Math.sin(start)
  const x1 = cx + r * Math.cos(end)
  const y1 = cy + r * Math.sin(end)
  const large = end - start > Math.PI ? 1 : 0
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`
}

export function Knob({ schema, value, onChange }: KnobProps) {
  const knobId = useId()
  const labelId = useId()
  const [hovered, setHovered] = useState(false)
  const knobRef = useRef<HTMLDivElement>(null)

  const { min, max, scale, format } = schema
  const t = Math.max(0, Math.min(1, valueTo01(value, min, max, scale)))

  const display = format ? format(value) : value.toFixed(2)

  const valueRawDisplayFn = useCallback((v: number) => {
    return format ? format(v) : v.toFixed(2)
  }, [format])

  const valueRawRoundFn = useCallback((v: number) => {
    if (scale === 'boolean') return v >= 0.5 ? 1 : 0
    return v
  }, [scale])

  return (
    <div
      className="flex flex-col items-center gap-1"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <KnobHeadlessLabel
        id={labelId}
        className="select-none text-xs uppercase tracking-wide text-zinc-400"
      >
        {schema.label}
      </KnobHeadlessLabel>
      <KnobHeadless
        ref={knobRef}
        id={knobId}
        aria-labelledby={labelId}
        valueRaw={value}
        valueMin={min}
        valueMax={max}
        valueRawDisplayFn={valueRawDisplayFn}
        valueRawRoundFn={valueRawRoundFn}
        dragSensitivity={scale === 'boolean' ? 0.05 : 0.005}
        mapTo01={(v) => valueTo01(v, min, max, scale)}
        mapFrom01={(t01) => valueFrom01(t01, min, max, scale)}
        onValueRawChange={onChange}
        includeIntoTabOrder
      >
        <div className="relative" style={{ width: KNOB_SIZE, height: KNOB_SIZE }}>
          <svg viewBox="0 0 56 56" width={KNOB_SIZE} height={KNOB_SIZE}>
            {/* Background arc */}
            <path
              d={describeArc(1)}
              stroke="rgb(63 63 70)"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
            {/* Active arc */}
            <path
              d={describeArc(t)}
              stroke={hovered ? 'rgb(192 132 252)' : 'rgb(168 85 247)'}
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
            {/* Knob body */}
            <circle cx="28" cy="28" r="14" fill="rgb(24 24 27)" stroke="rgb(63 63 70)" strokeWidth="1" />
            {/* Indicator */}
            <line
              x1="28"
              y1="28"
              x2={28 + 12 * Math.cos(((ARC_START_DEG + t * (ARC_END_DEG - ARC_START_DEG)) * Math.PI) / 180)}
              y2={28 + 12 * Math.sin(((ARC_START_DEG + t * (ARC_END_DEG - ARC_START_DEG)) * Math.PI) / 180)}
              stroke="rgb(244 244 245)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </KnobHeadless>
      <div className="font-mono text-[11px] tabular-nums text-zinc-200">
        {display}
        {schema.unit && schema.scale !== 'boolean' && <span className="text-zinc-500"> {schema.unit}</span>}
      </div>
    </div>
  )
}
