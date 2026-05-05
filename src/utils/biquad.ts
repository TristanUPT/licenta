/**
 * RBJ Audio EQ Cookbook coefficients — TypeScript port of `dsp/src/utils/filters.rs`.
 * Used purely for *display* (the EQ curve). The audio path uses the Rust version.
 */

export interface BiquadCoeffs {
  b0: number
  b1: number
  b2: number
  a1: number
  a2: number
}

const PASSTHROUGH: BiquadCoeffs = { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 }

function omega(freq: number, sampleRate: number): number {
  const f = Math.max(1, Math.min(sampleRate * 0.5 - 1, freq))
  return (2 * Math.PI * f) / sampleRate
}

function normalize(b0: number, b1: number, b2: number, a0: number, a1: number, a2: number): BiquadCoeffs {
  const inv = 1 / a0
  return { b0: b0 * inv, b1: b1 * inv, b2: b2 * inv, a1: a1 * inv, a2: a2 * inv }
}

export function peaking(freq: number, q: number, gainDb: number, sampleRate: number): BiquadCoeffs {
  const a = 10 ** (gainDb / 40)
  const w0 = omega(freq, sampleRate)
  const cosw = Math.cos(w0)
  const alpha = Math.sin(w0) / (2 * Math.max(q, 1e-3))
  return normalize(
    1 + alpha * a,
    -2 * cosw,
    1 - alpha * a,
    1 + alpha / a,
    -2 * cosw,
    1 - alpha / a,
  )
}

export function lowShelf(freq: number, q: number, gainDb: number, sampleRate: number): BiquadCoeffs {
  const a = 10 ** (gainDb / 40)
  const w0 = omega(freq, sampleRate)
  const cosw = Math.cos(w0)
  const sinw = Math.sin(w0)
  const alpha = sinw / (2 * Math.max(q, 1e-3))
  const twoSqrtA = 2 * Math.sqrt(a) * alpha
  return normalize(
    a * ((a + 1) - (a - 1) * cosw + twoSqrtA),
    2 * a * ((a - 1) - (a + 1) * cosw),
    a * ((a + 1) - (a - 1) * cosw - twoSqrtA),
    (a + 1) + (a - 1) * cosw + twoSqrtA,
    -2 * ((a - 1) + (a + 1) * cosw),
    (a + 1) + (a - 1) * cosw - twoSqrtA,
  )
}

export function highShelf(freq: number, q: number, gainDb: number, sampleRate: number): BiquadCoeffs {
  const a = 10 ** (gainDb / 40)
  const w0 = omega(freq, sampleRate)
  const cosw = Math.cos(w0)
  const sinw = Math.sin(w0)
  const alpha = sinw / (2 * Math.max(q, 1e-3))
  const twoSqrtA = 2 * Math.sqrt(a) * alpha
  return normalize(
    a * ((a + 1) + (a - 1) * cosw + twoSqrtA),
    -2 * a * ((a - 1) + (a + 1) * cosw),
    a * ((a + 1) + (a - 1) * cosw - twoSqrtA),
    (a + 1) - (a - 1) * cosw + twoSqrtA,
    2 * ((a - 1) - (a + 1) * cosw),
    (a + 1) - (a - 1) * cosw - twoSqrtA,
  )
}

export function highPass(freq: number, q: number, sampleRate: number): BiquadCoeffs {
  const w0 = omega(freq, sampleRate)
  const cosw = Math.cos(w0)
  const alpha = Math.sin(w0) / (2 * Math.max(q, 1e-3))
  return normalize(
    (1 + cosw) / 2,
    -(1 + cosw),
    (1 + cosw) / 2,
    1 + alpha,
    -2 * cosw,
    1 - alpha,
  )
}

export function lowPass(freq: number, q: number, sampleRate: number): BiquadCoeffs {
  const w0 = omega(freq, sampleRate)
  const cosw = Math.cos(w0)
  const alpha = Math.sin(w0) / (2 * Math.max(q, 1e-3))
  return normalize(
    (1 - cosw) / 2,
    1 - cosw,
    (1 - cosw) / 2,
    1 + alpha,
    -2 * cosw,
    1 - alpha,
  )
}

export function notch(freq: number, q: number, sampleRate: number): BiquadCoeffs {
  const w0 = omega(freq, sampleRate)
  const cosw = Math.cos(w0)
  const alpha = Math.sin(w0) / (2 * Math.max(q, 1e-3))
  return normalize(
    1,
    -2 * cosw,
    1,
    1 + alpha,
    -2 * cosw,
    1 - alpha,
  )
}

/** Magnitude (linear) of the biquad's transfer function at frequency `freq`. */
export function biquadMagnitude(c: BiquadCoeffs, freq: number, sampleRate: number): number {
  const w = omega(freq, sampleRate)
  const cosw = Math.cos(w)
  const sinw = Math.sin(w)
  const cos2w = Math.cos(2 * w)
  const sin2w = Math.sin(2 * w)

  const numRe = c.b0 + c.b1 * cosw + c.b2 * cos2w
  const numIm = -(c.b1 * sinw + c.b2 * sin2w)
  const denRe = 1 + c.a1 * cosw + c.a2 * cos2w
  const denIm = -(c.a1 * sinw + c.a2 * sin2w)

  const numMagSq = numRe * numRe + numIm * numIm
  const denMagSq = denRe * denRe + denIm * denIm
  return Math.sqrt(numMagSq / Math.max(denMagSq, 1e-30))
}

export const BIQUAD_PASSTHROUGH = PASSTHROUGH
