/**
 * Effect type identifiers must match Rust's `effects::EffectType`.
 */
export const EffectType = {
  Gain: 0,
  // Reserved for Phase 3b / 6:
  // Compressor: 1,
  // ParametricEq: 2,
} as const

export type EffectType = (typeof EffectType)[keyof typeof EffectType]

/** Per-effect parameter schema. Param IDs match the Rust constants. */
export interface ParamSchema {
  id: number
  label: string
  description: string
  /** Inclusive range. */
  min: number
  max: number
  default: number
  unit?: string
  /** Mapping for the knob position 0..1 ↔ value (default linear). */
  scale?: 'linear' | 'log' | 'boolean'
  /** Step for keyboard / numeric input (default = (max-min)/100). */
  step?: number
  format?: (v: number) => string
}

export interface EffectDefinition {
  type: EffectType
  /** Display label shown in EffectCard / Add menu. */
  label: string
  /** Short description for tooltips / Add menu. */
  description: string
  params: ParamSchema[]
}

/** A live effect on the chain (one per `EffectCard`). */
export interface EffectInstance {
  /** Stable across reorder; matches the u32 used in the worklet. */
  id: number
  type: EffectType
  bypassed: boolean
  /** paramId → value */
  params: Record<number, number>
}

// ─── Gain ────────────────────────────────────────────────────────────────

export const GAIN_PARAM = {
  GAIN_DB: 0,
  PHASE_INVERT: 1,
  DRY_WET: 2,
} as const

export const GAIN_DEFINITION: EffectDefinition = {
  type: EffectType.Gain,
  label: 'Gain',
  description: 'Linear amplifier with phase invert and wet/dry mix.',
  params: [
    {
      id: GAIN_PARAM.GAIN_DB,
      label: 'Gain',
      description: 'Volume change in dB. 0 dB = unity, ±6 dB ≈ ×2 / ÷2.',
      min: -24,
      max: 24,
      default: 0,
      unit: 'dB',
      format: (v) => (v >= 0 ? `+${v.toFixed(1)}` : v.toFixed(1)),
    },
    {
      id: GAIN_PARAM.PHASE_INVERT,
      label: 'Phase',
      description: 'Invert signal polarity (180°).',
      min: 0,
      max: 1,
      default: 0,
      scale: 'boolean',
      format: (v) => (v >= 0.5 ? 'inv' : 'norm'),
    },
    {
      id: GAIN_PARAM.DRY_WET,
      label: 'Mix',
      description: 'Blend processed (wet) with original (dry). 100 % = full wet.',
      min: 0,
      max: 1,
      default: 1,
      format: (v) => `${Math.round(v * 100)}%`,
    },
  ],
}

export const EFFECT_DEFINITIONS: Record<EffectType, EffectDefinition> = {
  [EffectType.Gain]: GAIN_DEFINITION,
}
