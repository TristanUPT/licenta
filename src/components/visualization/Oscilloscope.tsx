import { useEffect, useRef } from 'react'
import { getSharedAnalyser } from '@/audio/analyzerNode'
import { subscribe } from '@/audio/engine'

const SAMPLE_RATE = 48_000
const FFT_SIZE    = 2048
// How many samples to display — shows ~21 ms at 48 kHz
const VIEW_SAMPLES = 1024

export function Oscilloscope() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number | null>(null)
  const dataRef   = useRef<Float32Array>(new Float32Array(FFT_SIZE))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1

    function resize() {
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      canvas.width  = Math.floor(rect.width  * dpr)
      canvas.height = Math.floor(rect.height * dpr)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    function draw() {
      rafRef.current = requestAnimationFrame(draw)
      const ctx2d = canvas?.getContext('2d')
      if (!ctx2d || !canvas) return

      const analyser = getSharedAnalyser()
      if (analyser) {
        analyser.getFloatTimeDomainData(dataRef.current as Float32Array<ArrayBuffer>)
      }

      const w = canvas.width
      const h = canvas.height

      const isLight = document.documentElement.classList.contains('light')
      ctx2d.clearRect(0, 0, w, h)
      ctx2d.fillStyle = isLight ? '#f8f7fc' : '#09090b'
      ctx2d.fillRect(0, 0, w, h)

      // Grid: centre line + ±0.5 amplitude lines
      ctx2d.save()
      ctx2d.strokeStyle = isLight ? '#dddae8' : '#27272a'
      ctx2d.lineWidth = 1
      for (const amp of [-1, -0.5, 0, 0.5, 1]) {
        const y = ((1 - amp) / 2) * h
        ctx2d.beginPath()
        ctx2d.moveTo(0, y)
        ctx2d.lineTo(w, y)
        ctx2d.stroke()
      }

      // Time grid every ~5 ms
      const samplesPerMs = SAMPLE_RATE / 1000
      const totalMs = VIEW_SAMPLES / samplesPerMs
      const msStep  = totalMs > 20 ? 5 : 2
      ctx2d.fillStyle = isLight ? '#8a8aaa' : '#52525b'
      ctx2d.font = `${9 * dpr}px monospace`
      for (let ms = 0; ms <= totalMs; ms += msStep) {
        const x = (ms / totalMs) * w
        ctx2d.beginPath()
        ctx2d.moveTo(x, 0)
        ctx2d.lineTo(x, h)
        ctx2d.stroke()
        if (ms > 0) ctx2d.fillText(`${ms}ms`, x + 2 * dpr, (9 + 2) * dpr)
      }

      // Amplitude labels
      for (const [label, amp] of [['+1', 1], ['+0.5', 0.5], ['0', 0], ['-0.5', -0.5], ['-1', -1]] as [string, number][]) {
        const y = ((1 - amp) / 2) * h
        ctx2d.fillText(label, 2 * dpr, y - 2 * dpr)
      }
      ctx2d.restore()

      // Find zero-crossing for trigger stability
      let startIdx = 0
      const data = dataRef.current
      for (let i = 1; i < FFT_SIZE - VIEW_SAMPLES; i++) {
        if ((data[i - 1] ?? 0) < 0 && (data[i] ?? 0) >= 0) {
          startIdx = i
          break
        }
      }

      // Draw waveform
      ctx2d.save()
      ctx2d.strokeStyle = '#a855f7'
      ctx2d.lineWidth = 1.5 * dpr
      ctx2d.shadowColor = '#a855f780'
      ctx2d.shadowBlur = 4 * dpr
      ctx2d.beginPath()

      for (let i = 0; i < VIEW_SAMPLES; i++) {
        const sample = data[startIdx + i] ?? 0
        const x = (i / (VIEW_SAMPLES - 1)) * w
        const y = ((1 - sample) / 2) * h
        if (i === 0) ctx2d.moveTo(x, y)
        else ctx2d.lineTo(x, y)
      }
      ctx2d.stroke()
      ctx2d.restore()
    }

    draw()
    const off = subscribe(() => {})
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      off()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-md"
      style={{ height: 180 }}
    />
  )
}
