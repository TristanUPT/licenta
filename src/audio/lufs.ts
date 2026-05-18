/**
 * Integrated loudness (LUFS) per ITU-R BS.1770-4.
 * K-weighting: Stage 1 = high-shelf +4 dB pre-filter, Stage 2 = HP 38 Hz.
 * Gating: 400 ms blocks, 75% overlap, absolute -70 LUFS then relative -10 LU.
 */

interface BiquadCoeffs {
  b0: number; b1: number; b2: number
  a1: number; a2: number
}

function kWeightingCoeffs(sampleRate: number): [BiquadCoeffs, BiquadCoeffs] {
  const S1_F0 = 1681.974450955533
  const S1_G  = 3.999843853973347
  const S1_Q  = 0.7071752369554196
  const S2_F0 = 38.13547087602444
  const S2_Q  = 0.5003270373238773

  function hs(f0: number, G: number, Q: number): BiquadCoeffs {
    const K    = Math.tan(Math.PI * f0 / sampleRate)
    const Vh   = Math.pow(10, G / 20)
    const norm = 1 / (1 + K / Q + K * K)
    return {
      b0: (Vh + Math.sqrt(2 * Vh) * K + K * K) * norm,
      b1: 2 * (K * K - Vh) * norm,
      b2: (Vh - Math.sqrt(2 * Vh) * K + K * K) * norm,
      a1: 2 * (K * K - 1) * norm,
      a2: (1 - K / Q + K * K) * norm,
    }
  }

  function hp(f0: number, Q: number): BiquadCoeffs {
    const K    = Math.tan(Math.PI * f0 / sampleRate)
    const norm = 1 / (1 + K / Q + K * K)
    return {
      b0: norm,
      b1: -2 * norm,
      b2: norm,
      a1: 2 * (K * K - 1) * norm,
      a2: (1 - K / Q + K * K) * norm,
    }
  }

  return [hs(S1_F0, S1_G, S1_Q), hp(S2_F0, S2_Q)]
}

function applyBiquad(input: Float32Array, c: BiquadCoeffs): Float32Array {
  const out = new Float32Array(input.length)
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  for (let i = 0; i < input.length; i++) {
    const x = input[i] ?? 0
    const y = c.b0 * x + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2
    out[i] = y
    x2 = x1; x1 = x
    y2 = y1; y1 = y
  }
  return out
}

export function computeIntegratedLufs(buffer: AudioBuffer): number {
  const { sampleRate, numberOfChannels, length } = buffer
  const [s1, s2] = kWeightingCoeffs(sampleRate)

  // Sum channels to mono
  const mono = new Float32Array(length)
  for (let c = 0; c < numberOfChannels; c++) {
    const ch = buffer.getChannelData(c)
    for (let i = 0; i < length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      mono[i] += ch[i]!
    }
  }
  if (numberOfChannels > 1) {
    for (let i = 0; i < length; i++) mono[i] /= numberOfChannels
  }

  // K-weighting: stage 1 then stage 2
  const filtered = applyBiquad(applyBiquad(mono, s1), s2)

  // 400 ms blocks, 100 ms hop (75% overlap)
  const blockLen = Math.round(0.4 * sampleRate)
  const hopLen   = Math.round(0.1 * sampleRate)
  const blocks: number[] = []

  for (let start = 0; start + blockLen <= length; start += hopLen) {
    let sum = 0
    for (let i = start; i < start + blockLen; i++) {
      const s = filtered[i] ?? 0
      sum += s * s
    }
    blocks.push(sum / blockLen)
  }

  if (blocks.length === 0) return -Infinity

  // Absolute gate: blocks below -70 LUFS removed
  // -70 LUFS → mean square = 10^((-70 + 0.691) / 10)
  const ABS_GATE = Math.pow(10, (-70 + 0.691) / 10)
  const g1 = blocks.filter((b) => b >= ABS_GATE)
  if (g1.length === 0) return -Infinity

  // Relative gate: blocks below (mean − 10 LU) removed
  const mean1    = g1.reduce((a, b) => a + b, 0) / g1.length
  const REL_GATE = mean1 * Math.pow(10, -10 / 10)
  const g2       = g1.filter((b) => b >= REL_GATE)
  if (g2.length === 0) return -Infinity

  const mean2 = g2.reduce((a, b) => a + b, 0) / g2.length
  return -0.691 + 10 * Math.log10(mean2)
}
