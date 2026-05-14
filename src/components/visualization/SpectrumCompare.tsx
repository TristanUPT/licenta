import { useCallback, useEffect, useRef, useState } from 'react'
import { getContext, getNode, getStatus, subscribe } from '@/audio/engine'
import { useEducationStore } from '@/store/educationStore'

const FFT_SIZE = 2048
const MIN_DB = -90
const MAX_DB = -10
const FREQ_MIN = 20
const FREQ_MAX = 20000

function freqToX(freq: number, width: number): number {
  return (Math.log10(freq / FREQ_MIN) / Math.log10(FREQ_MAX / FREQ_MIN)) * width
}

function dbToY(db: number, height: number): number {
  const t = (db - MAX_DB) / (MIN_DB - MAX_DB)
  return t * height
}

export function SpectrumCompare() {
  const language = useEducationStore((s) => s.language)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const dataRef = useRef<Float32Array>(new Float32Array(FFT_SIZE / 2 + 1))
  const [snapshot, setSnapshot] = useState<Float32Array | null>(null)
  const snapshotRef = useRef<Float32Array | null>(null)

  // Keep ref in sync with state so the draw loop can read it without re-subscribing.
  useEffect(() => { snapshotRef.current = snapshot }, [snapshot])

  const takeSnapshot = useCallback(() => {
    setSnapshot(new Float32Array(dataRef.current))
  }, [])

  const clearSnapshot = useCallback(() => {
    setSnapshot(null)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1

    function resize() {
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.floor(rect.width * dpr)
      canvas.height = Math.floor(rect.height * dpr)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    function drawSpectrum(
      ctx2d: CanvasRenderingContext2D,
      w: number,
      h: number,
      data: Float32Array,
      style: string,
      filled: boolean,
      alpha: number,
    ) {
      ctx2d.save()
      ctx2d.globalAlpha = alpha
      ctx2d.strokeStyle = style
      ctx2d.fillStyle = style
      ctx2d.lineWidth = 1.5 * dpr
      ctx2d.beginPath()

      const binCount = data.length
      // Nyquist freq = sampleRate / 2 (assume 48000)
      const nyquist = 24000

      let first = true
      for (let i = 1; i < binCount; i++) {
        const freq = (i / binCount) * nyquist
        if (freq < FREQ_MIN || freq > FREQ_MAX) continue
        const x = freqToX(freq, w) * dpr
        const y = dbToY(data[i]!, h) * dpr
        if (first) { ctx2d.moveTo(x, y); first = false }
        else ctx2d.lineTo(x, y)
      }

      if (filled) {
        ctx2d.lineTo(w * dpr, h * dpr)
        ctx2d.lineTo(0, h * dpr)
        ctx2d.closePath()
        ctx2d.globalAlpha = alpha * 0.25
        ctx2d.fill()
        ctx2d.globalAlpha = alpha
        ctx2d.beginPath()
        first = true
        for (let i = 1; i < binCount; i++) {
          const freq = (i / binCount) * nyquist
          if (freq < FREQ_MIN || freq > FREQ_MAX) continue
          const x = freqToX(freq, w) * dpr
          const y = dbToY(data[i]!, h) * dpr
          if (first) { ctx2d.moveTo(x, y); first = false }
          else ctx2d.lineTo(x, y)
        }
      }

      ctx2d.stroke()
      ctx2d.restore()
    }

    function drawGrid(ctx2d: CanvasRenderingContext2D, w: number, h: number) {
      ctx2d.save()
      ctx2d.strokeStyle = '#27272a'
      ctx2d.fillStyle = '#52525b'
      ctx2d.font = `${9 * dpr}px monospace`
      ctx2d.lineWidth = 1

      // Frequency grid lines.
      for (const freq of [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]) {
        const x = freqToX(freq, w) * dpr
        ctx2d.beginPath()
        ctx2d.moveTo(x, 0)
        ctx2d.lineTo(x, h * dpr)
        ctx2d.stroke()
        const label = freq >= 1000 ? `${freq / 1000}k` : `${freq}`
        ctx2d.fillText(label, x + 2 * dpr, (h - 2) * dpr)
      }

      // dB grid lines.
      for (let db = MIN_DB; db <= MAX_DB; db += 10) {
        const y = dbToY(db, h) * dpr
        ctx2d.beginPath()
        ctx2d.moveTo(0, y)
        ctx2d.lineTo(w * dpr, y)
        ctx2d.stroke()
        ctx2d.fillText(`${db}`, 2 * dpr, y - 2 * dpr)
      }

      ctx2d.restore()
    }

    function draw() {
      const analyser = analyserRef.current
      const ctx2d = canvas?.getContext('2d')
      if (!ctx2d || !canvas) { rafRef.current = requestAnimationFrame(draw); return }

      const w = canvas.width / dpr
      const h = canvas.height / dpr

      if (analyser) {
        analyser.getFloatFrequencyData(dataRef.current as Float32Array<ArrayBuffer>)
      }

      ctx2d.clearRect(0, 0, canvas.width, canvas.height)
      ctx2d.fillStyle = '#09090b'
      ctx2d.fillRect(0, 0, canvas.width, canvas.height)

      drawGrid(ctx2d, w, h)

      const snap = snapshotRef.current
      if (snap) {
        drawSpectrum(ctx2d, w, h, snap, '#22d3ee', false, 0.7)
      }

      if (analyser) {
        drawSpectrum(ctx2d, w, h, dataRef.current, '#a855f7', true, 0.9)
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    function tryAttach() {
      if (analyserRef.current) return
      if (getStatus().status !== 'running') return
      const ctx = getContext()
      const node = getNode()
      if (!ctx || !node) return

      const analyser = ctx.createAnalyser()
      analyser.fftSize = FFT_SIZE
      analyser.smoothingTimeConstant = 0.75
      analyser.minDecibels = MIN_DB
      analyser.maxDecibels = MAX_DB
      node.connect(analyser)
      analyserRef.current = analyser
      dataRef.current = new Float32Array(analyser.frequencyBinCount)
    }

    tryAttach()
    const off = subscribe(() => tryAttach())
    rafRef.current = requestAnimationFrame(draw)

    return () => {
      off()
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      analyserRef.current?.disconnect()
      analyserRef.current = null
      ro.disconnect()
    }
  }, [])

  const snapLabel    = language === 'ro' ? 'Îngheață' : 'Freeze'
  const clearLabel   = language === 'ro' ? 'Șterge' : 'Clear'
  const liveLabel    = language === 'ro' ? 'Live (violet)' : 'Live (purple)'
  const frozenLabel  = language === 'ro' ? 'Snapshot (cyan)' : 'Snapshot (cyan)'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-3 text-[10px] text-zinc-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-4 rounded bg-purple-500" />
            {liveLabel}
          </span>
          {snapshot && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-4 rounded bg-cyan-400" />
              {frozenLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {snapshot && (
            <button
              onClick={clearSnapshot}
              className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-200"
            >
              {clearLabel}
            </button>
          )}
          <button
            onClick={takeSnapshot}
            className="rounded bg-cyan-600/20 px-2 py-0.5 text-[10px] font-medium text-cyan-300 transition hover:bg-cyan-600/30"
          >
            {snapLabel}
          </button>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="h-[180px] w-full rounded-md border border-zinc-800"
        aria-label="Spectrum comparison"
      />
    </div>
  )
}
