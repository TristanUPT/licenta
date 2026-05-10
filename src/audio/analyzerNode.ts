import { getContext, getNode, subscribe } from './engine'

const FFT_SIZE = 2048
const SAMPLE_RATE = 48_000
const BIN_COUNT = FFT_SIZE / 2

export interface FrequencyBands {
  subBass: number    // 20–80 Hz
  bass: number       // 80–250 Hz
  lowMids: number    // 250–500 Hz
  mids: number       // 500–2000 Hz
  upperMids: number  // 2000–4000 Hz
  presence: number   // 4000–8000 Hz
  air: number        // 8000–20000 Hz
}

type BandKey = keyof FrequencyBands

const BAND_RANGES: [BandKey, number, number][] = [
  ['subBass',   20,    80],
  ['bass',      80,    250],
  ['lowMids',   250,   500],
  ['mids',      500,   2000],
  ['upperMids', 2000,  4000],
  ['presence',  4000,  8000],
  ['air',       8000,  20000],
]

function freqToBin(hz: number): number {
  return Math.min(BIN_COUNT - 1, Math.round(hz / (SAMPLE_RATE / 2) * BIN_COUNT))
}

const BAND_BINS = BAND_RANGES.map(([key, fLo, fHi]) => ({
  key,
  lo: freqToBin(fLo),
  hi: freqToBin(fHi),
}))

let _analyser: AnalyserNode | null = null

function tryAttach() {
  if (_analyser) return
  const ctx = getContext()
  const engineNode = getNode()
  if (!ctx || !engineNode) return
  _analyser = ctx.createAnalyser()
  _analyser.fftSize = FFT_SIZE
  _analyser.smoothingTimeConstant = 0.85
  _analyser.minDecibels = -90
  _analyser.maxDecibels = -10
  engineNode.connect(_analyser)
}

subscribe(() => tryAttach())

export function getSharedAnalyser(): AnalyserNode | null {
  tryAttach()
  return _analyser
}

export function computeBands(fftData: Uint8Array<ArrayBufferLike>): FrequencyBands {
  const result = {} as FrequencyBands
  for (const { key, lo, hi } of BAND_BINS) {
    let sum = 0
    const count = hi - lo + 1
    for (let b = lo; b <= hi; b++) {
      sum += fftData[b] ?? 0
    }
    result[key] = count > 0 ? sum / count / 255 : 0
  }
  return result
}
