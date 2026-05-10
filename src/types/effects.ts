/**
 * Effect type identifiers must match Rust's `effects::EffectType`.
 */
export const EffectType = {
  Gain: 0,
  Compressor: 1,
  ParametricEq: 2,
  Gate: 3,
  Limiter: 4,
  Delay: 5,
  Reverb: 6,
  Saturation: 7,
} as const

export type EffectType = (typeof EffectType)[keyof typeof EffectType]

export interface ParamSchema {
  id: number
  label: string
  description: string
  min: number
  max: number
  default: number
  unit?: string
  scale?: 'linear' | 'log' | 'boolean' | 'enum'
  step?: number
  format?: (v: number) => string
  /** Discrete options for `scale === 'enum'`. */
  options?: { value: number; label: string }[]
}

export interface EffectDefinition {
  type: EffectType
  label: string
  description: string
  params: ParamSchema[]
}

export interface EffectInstance {
  id: number
  type: EffectType
  bypassed: boolean
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
      description: 'Blend processed (wet) with original (dry).',
      min: 0,
      max: 1,
      default: 1,
      format: (v) => `${Math.round(v * 100)}%`,
    },
  ],
}

// ─── Compressor ──────────────────────────────────────────────────────────

export const COMPRESSOR_PARAM = {
  THRESHOLD_DB: 0,
  RATIO: 1,
  ATTACK_MS: 2,
  RELEASE_MS: 3,
  KNEE_DB: 4,
  MAKEUP_DB: 5,
  SIDECHAIN_HPF_HZ: 6,
  DRY_WET: 7,
} as const

export const COMPRESSOR_DEFINITION: EffectDefinition = {
  type: EffectType.Compressor,
  label: 'Compressor',
  description: 'Reduces dynamic range above threshold. Soft knee + sidechain HPF.',
  params: [
    {
      id: COMPRESSOR_PARAM.THRESHOLD_DB,
      label: 'Threshold',
      description: 'Level above which the compressor reduces gain.',
      min: -60, max: 0, default: -18, unit: 'dB',
      format: (v) => v.toFixed(1),
    },
    {
      id: COMPRESSOR_PARAM.RATIO,
      label: 'Ratio',
      description: 'How much to reduce above threshold. 4:1 is a good general value.',
      min: 1, max: 20, default: 4,
      format: (v) => `${v.toFixed(1)}:1`,
    },
    {
      id: COMPRESSOR_PARAM.ATTACK_MS,
      label: 'Attack',
      description: 'How quickly compression engages. Fast = catches transients.',
      min: 0.1, max: 200, default: 10, unit: 'ms', scale: 'log',
      format: (v) => v < 10 ? v.toFixed(1) : v.toFixed(0),
    },
    {
      id: COMPRESSOR_PARAM.RELEASE_MS,
      label: 'Release',
      description: 'How quickly compression releases after the level drops.',
      min: 5, max: 1000, default: 100, unit: 'ms', scale: 'log',
      format: (v) => v.toFixed(0),
    },
    {
      id: COMPRESSOR_PARAM.KNEE_DB,
      label: 'Knee',
      description: 'Soft knee width — smoother transition into compression.',
      min: 0, max: 24, default: 6, unit: 'dB',
      format: (v) => v.toFixed(1),
    },
    {
      id: COMPRESSOR_PARAM.MAKEUP_DB,
      label: 'Makeup',
      description: 'Post-compression gain to restore loudness.',
      min: 0, max: 24, default: 0, unit: 'dB',
      format: (v) => `+${v.toFixed(1)}`,
    },
    {
      id: COMPRESSOR_PARAM.SIDECHAIN_HPF_HZ,
      label: 'SC HPF',
      description: 'Side-chain highpass — stops bass from triggering compression.',
      min: 20, max: 1000, default: 80, unit: 'Hz', scale: 'log',
      format: (v) => v < 1000 ? `${v.toFixed(0)}` : `${(v / 1000).toFixed(1)}k`,
    },
    {
      id: COMPRESSOR_PARAM.DRY_WET,
      label: 'Mix',
      description: 'Blend compressed (wet) with uncompressed (dry).',
      min: 0, max: 1, default: 1,
      format: (v) => `${Math.round(v * 100)}%`,
    },
  ],
}

// ─── Parametric EQ ───────────────────────────────────────────────────────
// Param layout matches Rust's eq::band_param(): 5 params per band, 4 bands.

export const EQ_BANDS = 4
export const EQ_PARAMS_PER_BAND = 5
export const EQ_BAND_PARAM = {
  TYPE: 0,
  FREQ: 1,
  GAIN: 2,
  Q: 3,
  ENABLED: 4,
} as const

export function eqParamId(bandIndex: number, local: number): number {
  return bandIndex * EQ_PARAMS_PER_BAND + local
}

export const EQ_BAND_TYPE = {
  Bell: 0,
  LowShelf: 1,
  HighShelf: 2,
  HighPass: 3,
  LowPass: 4,
  Notch: 5,
} as const

const EQ_TYPE_OPTIONS = [
  { value: EQ_BAND_TYPE.Bell, label: 'Bell' },
  { value: EQ_BAND_TYPE.LowShelf, label: 'Lo Shelf' },
  { value: EQ_BAND_TYPE.HighShelf, label: 'Hi Shelf' },
  { value: EQ_BAND_TYPE.HighPass, label: 'HPF' },
  { value: EQ_BAND_TYPE.LowPass, label: 'LPF' },
  { value: EQ_BAND_TYPE.Notch, label: 'Notch' },
]

const DEFAULT_BAND_FREQ = [80, 250, 2_500, 8_000]

function makeBandParams(bandIndex: number): ParamSchema[] {
  const id = (local: number) => eqParamId(bandIndex, local)
  return [
    {
      id: id(EQ_BAND_PARAM.TYPE),
      label: `B${bandIndex + 1} Type`,
      description: 'Filter shape for this band.',
      min: 0, max: 5, default: EQ_BAND_TYPE.Bell, scale: 'enum',
      options: EQ_TYPE_OPTIONS,
    },
    {
      id: id(EQ_BAND_PARAM.FREQ),
      label: `Freq`,
      description: 'Centre / cutoff frequency.',
      min: 20, max: 20_000, default: DEFAULT_BAND_FREQ[bandIndex] ?? 1_000,
      unit: 'Hz', scale: 'log',
      format: (v) => v < 1_000 ? `${v.toFixed(0)}` : `${(v / 1_000).toFixed(2)}k`,
    },
    {
      id: id(EQ_BAND_PARAM.GAIN),
      label: 'Gain',
      description: 'Boost or cut at the centre frequency (bell / shelf only).',
      min: -24, max: 24, default: 0, unit: 'dB',
      format: (v) => v >= 0 ? `+${v.toFixed(1)}` : v.toFixed(1),
    },
    {
      id: id(EQ_BAND_PARAM.Q),
      label: 'Q',
      description: 'Bandwidth — higher Q = narrower band.',
      min: 0.1, max: 18, default: 1, scale: 'log',
      format: (v) => v.toFixed(2),
    },
    {
      id: id(EQ_BAND_PARAM.ENABLED),
      label: `B${bandIndex + 1}`,
      description: 'Enable / disable this band.',
      min: 0, max: 1, default: 0, scale: 'boolean',
      format: (v) => v >= 0.5 ? 'on' : 'off',
    },
  ]
}

// Low Cut (HPF) — param IDs after the 4 bands: 4 × 5 = 20
export const EQ_LOW_CUT_PARAM = {
  ENABLED: 20,
  FREQ: 21,
  SLOPE: 22,  // 1 = 12 dB/oct, 2 = 24 dB/oct
} as const

const LOW_CUT_SLOPE_OPTIONS = [
  { value: 1, label: '12' },
  { value: 2, label: '24' },
]

export const EQ_DEFINITION: EffectDefinition = {
  type: EffectType.ParametricEq,
  label: 'Parametric EQ',
  description: '4-band equaliser with Low Cut. Each band can be bell, shelf, pass, or notch.',
  params: [
    ...[0, 1, 2, 3].flatMap(makeBandParams),
    {
      id: EQ_LOW_CUT_PARAM.ENABLED,
      label: 'Low Cut',
      description: 'Enable / disable the Low Cut (high-pass) filter.',
      min: 0, max: 1, default: 0, scale: 'boolean' as const,
      format: (v: number) => v >= 0.5 ? 'on' : 'off',
    },
    {
      id: EQ_LOW_CUT_PARAM.FREQ,
      label: 'LC Freq',
      description: 'Low Cut cutoff frequency — attenuates everything below this.',
      min: 20, max: 600, default: 80, unit: 'Hz', scale: 'log' as const,
      format: (v: number) => `${v.toFixed(0)}`,
    },
    {
      id: EQ_LOW_CUT_PARAM.SLOPE,
      label: 'LC Slope',
      description: 'Filter slope in dB/octave. 12 = gentle, 24 = steep.',
      min: 1, max: 2, default: 1, scale: 'enum' as const,
      options: LOW_CUT_SLOPE_OPTIONS,
    },
  ],
}

// ─── Gate ────────────────────────────────────────────────────────────────

export const GATE_PARAM = {
  THRESHOLD_DB: 0,
  ATTACK_MS: 1,
  HOLD_MS: 2,
  RELEASE_MS: 3,
  RANGE_DB: 4,
  HYSTERESIS_DB: 5,
  DRY_WET: 6,
} as const

export const GATE_DEFINITION: EffectDefinition = {
  type: EffectType.Gate,
  label: 'Noise Gate',
  description: 'Attenuates the signal below a threshold — silences noise between phrases.',
  params: [
    { id: GATE_PARAM.THRESHOLD_DB, label: 'Threshold', description: 'Open level.', min: -80, max: 0, default: -40, unit: 'dB', format: (v) => v.toFixed(1) },
    { id: GATE_PARAM.ATTACK_MS, label: 'Attack', description: 'Open speed.', min: 0.01, max: 50, default: 2, unit: 'ms', scale: 'log', format: (v) => v < 1 ? v.toFixed(2) : v.toFixed(1) },
    { id: GATE_PARAM.HOLD_MS, label: 'Hold', description: 'Time held open after the signal drops.', min: 0, max: 500, default: 20, unit: 'ms', format: (v) => v.toFixed(0) },
    { id: GATE_PARAM.RELEASE_MS, label: 'Release', description: 'Close speed after hold.', min: 5, max: 500, default: 80, unit: 'ms', scale: 'log', format: (v) => v.toFixed(0) },
    { id: GATE_PARAM.RANGE_DB, label: 'Range', description: 'Attenuation when closed.', min: -90, max: 0, default: -60, unit: 'dB', format: (v) => v.toFixed(1) },
    { id: GATE_PARAM.HYSTERESIS_DB, label: 'Hyst', description: 'Open / close gap.', min: 0, max: 10, default: 3, unit: 'dB', format: (v) => v.toFixed(1) },
    { id: GATE_PARAM.DRY_WET, label: 'Mix', description: 'Wet/dry blend.', min: 0, max: 1, default: 1, format: (v) => `${Math.round(v * 100)}%` },
  ],
}

// ─── Limiter ─────────────────────────────────────────────────────────────

export const LIMITER_PARAM = {
  CEILING_DB: 0,
  RELEASE_MS: 1,
  DRY_WET: 2,
} as const

export const LIMITER_DEFINITION: EffectDefinition = {
  type: EffectType.Limiter,
  label: 'Limiter',
  description: 'Hard ceiling on output peaks with 5 ms lookahead.',
  params: [
    { id: LIMITER_PARAM.CEILING_DB, label: 'Ceiling', description: 'Maximum output level.', min: -12, max: 0, default: -1, unit: 'dB', format: (v) => v.toFixed(1) },
    { id: LIMITER_PARAM.RELEASE_MS, label: 'Release', description: 'Recovery time.', min: 1, max: 500, default: 50, unit: 'ms', scale: 'log', format: (v) => v.toFixed(0) },
    { id: LIMITER_PARAM.DRY_WET, label: 'Mix', description: 'Wet/dry blend.', min: 0, max: 1, default: 1, format: (v) => `${Math.round(v * 100)}%` },
  ],
}

// ─── Delay ───────────────────────────────────────────────────────────────

export const DELAY_PARAM = {
  TIME_MS: 0,
  FEEDBACK: 1,
  TONE_HZ: 2,
  DRY_WET: 3,
} as const

export const DELAY_DEFINITION: EffectDefinition = {
  type: EffectType.Delay,
  label: 'Delay',
  description: 'Echo with filtered feedback for warmth.',
  params: [
    { id: DELAY_PARAM.TIME_MS, label: 'Time', description: 'Echo time.', min: 1, max: 2000, default: 250, unit: 'ms', scale: 'log', format: (v) => v.toFixed(0) },
    { id: DELAY_PARAM.FEEDBACK, label: 'Feedback', description: 'How many repeats.', min: 0, max: 0.95, default: 0.35, format: (v) => `${Math.round(v * 100)}%` },
    { id: DELAY_PARAM.TONE_HZ, label: 'Tone', description: 'LP cutoff in feedback.', min: 200, max: 18_000, default: 6_000, unit: 'Hz', scale: 'log', format: (v) => v < 1_000 ? `${v.toFixed(0)}` : `${(v / 1_000).toFixed(1)}k` },
    { id: DELAY_PARAM.DRY_WET, label: 'Mix', description: 'Wet/dry blend.', min: 0, max: 1, default: 0.4, format: (v) => `${Math.round(v * 100)}%` },
  ],
}

// ─── Reverb ──────────────────────────────────────────────────────────────

export const REVERB_PARAM = {
  ROOM_SIZE: 0,
  DAMPING: 1,
  PRE_DELAY_MS: 2,
  DRY_WET: 3,
} as const

export const REVERB_DEFINITION: EffectDefinition = {
  type: EffectType.Reverb,
  label: 'Reverb',
  description: 'Schroeder-style algorithmic reverb (4 comb + 2 allpass).',
  params: [
    { id: REVERB_PARAM.ROOM_SIZE, label: 'Size', description: 'Apparent room size.', min: 0, max: 1, default: 0.7, format: (v) => `${Math.round(v * 100)}%` },
    { id: REVERB_PARAM.DAMPING, label: 'Damping', description: 'High-frequency absorption.', min: 0, max: 0.95, default: 0.4, format: (v) => `${Math.round(v * 100)}%` },
    { id: REVERB_PARAM.PRE_DELAY_MS, label: 'PreDelay', description: 'Delay before reverb starts.', min: 0, max: 200, default: 20, unit: 'ms', format: (v) => v.toFixed(0) },
    { id: REVERB_PARAM.DRY_WET, label: 'Mix', description: 'Wet/dry blend.', min: 0, max: 1, default: 0.3, format: (v) => `${Math.round(v * 100)}%` },
  ],
}

// ─── Saturation ──────────────────────────────────────────────────────────

export const SATURATION_PARAM = {
  DRIVE_DB: 0,
  TYPE: 1,
  TONE_HZ: 2,
  DRY_WET: 3,
} as const

const SAT_TYPE_OPTIONS = [
  { value: 0, label: 'Tanh' },
  { value: 1, label: 'Soft' },
  { value: 2, label: 'Hard' },
  { value: 3, label: 'Tube' },
]

export const SATURATION_DEFINITION: EffectDefinition = {
  type: EffectType.Saturation,
  label: 'Saturation',
  description: 'Waveshaping distortion — adds harmonics. Drive + character + tone.',
  params: [
    { id: SATURATION_PARAM.DRIVE_DB, label: 'Drive', description: 'Pre-shaper gain.', min: 0, max: 30, default: 6, unit: 'dB', format: (v) => `+${v.toFixed(1)}` },
    { id: SATURATION_PARAM.TYPE, label: 'Type', description: 'Shaping curve.', min: 0, max: 3, default: 0, scale: 'enum', options: SAT_TYPE_OPTIONS },
    { id: SATURATION_PARAM.TONE_HZ, label: 'Tone', description: 'Post-shaper LP cutoff.', min: 500, max: 18_000, default: 8_000, unit: 'Hz', scale: 'log', format: (v) => v < 1_000 ? `${v.toFixed(0)}` : `${(v / 1_000).toFixed(1)}k` },
    { id: SATURATION_PARAM.DRY_WET, label: 'Mix', description: 'Wet/dry blend.', min: 0, max: 1, default: 1, format: (v) => `${Math.round(v * 100)}%` },
  ],
}

export const EFFECT_DEFINITIONS: Record<EffectType, EffectDefinition> = {
  [EffectType.Gain]: GAIN_DEFINITION,
  [EffectType.Compressor]: COMPRESSOR_DEFINITION,
  [EffectType.ParametricEq]: EQ_DEFINITION,
  [EffectType.Gate]: GATE_DEFINITION,
  [EffectType.Limiter]: LIMITER_DEFINITION,
  [EffectType.Delay]: DELAY_DEFINITION,
  [EffectType.Reverb]: REVERB_DEFINITION,
  [EffectType.Saturation]: SATURATION_DEFINITION,
}
