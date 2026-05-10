import { useEffect, useRef } from 'react'
import { getContext, getNode, getStatus, subscribe } from '@/audio/engine'

const W = 600
const H = 180
const FFT_SIZE = 2048
const BIN_COUNT = FFT_SIZE / 2      // 1024
const F_MIN = 20
const F_MAX = 20_000
const SAMPLE_RATE = 48_000

// ── Colormap: zinc-950 → violet-800 → violet-600 → cyan-500 → near-white ──

const COLORMAP_STOPS = [
  { v: 0.00, r: 9,   g: 9,   b: 11  },
  { v: 0.12, r: 46,  g: 10,  b: 100 },
  { v: 0.32, r: 109, g: 40,  b: 217 },
  { v: 0.55, r: 124, g: 58,  b: 237 },
  { v: 0.72, r: 6,   g: 182, b: 212 },
  { v: 0.88, r: 34,  g: 211, b: 238 },
  { v: 1.00, r: 236, g: 252, b: 255 },
]

const COLORMAP = (() => {
  const lut = new Uint8Array(256 * 4)
  const stops = COLORMAP_STOPS
  for (let i = 0; i < 256; i++) {
    const v = i / 255
    let lo = stops[0], hi = stops[stops.length - 1]
    for (let s = 0; s < stops.length - 1; s++) {
      const a = stops[s], b = stops[s + 1]
      if (a && b && v >= a.v && v <= b.v) { lo = a; hi = b; break }
    }
    const t = hi.v === lo.v ? 0 : (v - lo.v) / (hi.v - lo.v)
    lut[i * 4]     = Math.round(lo.r + t * (hi.r - lo.r))
    lut[i * 4 + 1] = Math.round(lo.g + t * (hi.g - lo.g))
    lut[i * 4 + 2] = Math.round(lo.b + t * (hi.b - lo.b))
    lut[i * 4 + 3] = 255
  }
  return lut
})()

// Pre-compute per-pixel-row → FFT bin mapping (log-frequency scale).
const PIXEL_TO_BIN = (() => {
  const map = new Uint16Array(H)
  const logMin = Math.log10(F_MIN)
  const logMax = Math.log10(F_MAX)
  for (let y = 0; y < H; y++) {
    // y=0 = top = high freq; y=H-1 = bottom = low freq
    const frac = (H - 1 - y) / (H - 1)
    const freq = Math.pow(10, logMin + frac * (logMax - logMin))
    const bin = Math.round(freq / (SAMPLE_RATE / 2) * BIN_COUNT)
    map[y] = Math.max(0, Math.min(BIN_COUNT - 1, bin))
  }
  return map
})()

export function Spectrogram() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let analyser: AnalyserNode | null = null
    let rafId = 0
    let column: ImageData | null = null
    let fftData: Uint8Array<ArrayBuffer> | null = null

    function attach() {
      if (analyser) return
      if (!canvas) return
      if (getStatus().status !== 'running') return
      const ctx = getContext()
      const node = getNode()
      if (!ctx || !node) return

      analyser = ctx.createAnalyser()
      analyser.fftSize = FFT_SIZE
      analyser.smoothingTimeConstant = 0.6
      analyser.minDecibels = -90
      analyser.maxDecibels = -10
      node.connect(analyser)
      fftData = new Uint8Array(analyser.frequencyBinCount)

      const ctx2d = canvas.getContext('2d')
      if (!ctx2d) return
      ctx2d.fillStyle = '#09090b'
      ctx2d.fillRect(0, 0, W, H)
      column = ctx2d.createImageData(1, H)

      startDraw(ctx2d, canvas)
    }

    function startDraw(ctx2d: CanvasRenderingContext2D, cvs: HTMLCanvasElement) {
      function draw() {
        if (!analyser || !fftData || !column) return

        analyser.getByteFrequencyData(fftData)

        // Shift existing canvas 1px left.
        ctx2d.drawImage(cvs, -1, 0)

        // Build the new rightmost column.
        const colData = column.data
        for (let y = 0; y < H; y++) {
          const bin = PIXEL_TO_BIN[y] ?? 0
          const amp = fftData[bin] ?? 0
          const base = amp * 4
          colData[y * 4]     = COLORMAP[base]     ?? 0
          colData[y * 4 + 1] = COLORMAP[base + 1] ?? 0
          colData[y * 4 + 2] = COLORMAP[base + 2] ?? 0
          colData[y * 4 + 3] = 255
        }
        ctx2d.putImageData(column, W - 1, 0)

        rafId = requestAnimationFrame(draw)
      }
      rafId = requestAnimationFrame(draw)
    }

    attach()
    const off = subscribe(() => attach())

    return () => {
      off()
      cancelAnimationFrame(rafId)
      analyser?.disconnect()
      analyser = null
    }
  }, [])

  return (
    <div className="overflow-hidden rounded-md bg-zinc-950">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="h-auto w-full"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  )
}
