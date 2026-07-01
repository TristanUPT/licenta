import { useEffect, useRef } from 'react'
import AudioMotionAnalyzer from 'audiomotion-analyzer'
import { getContext, getNode, getStatus, subscribe } from '@/audio/engine'

// ── Frequency axis helpers ────────────────────────────────────────────────────

const LOG_MIN = Math.log10(20)
const LOG_MAX = Math.log10(20000)

const AXIS_TICKS: { freq: number; label: string }[] = [
  { freq: 20,    label: '20' },
  { freq: 50,    label: '50' },
  { freq: 100,   label: '100' },
  { freq: 200,   label: '200' },
  { freq: 500,   label: '500' },
  { freq: 1000,  label: '1k' },
  { freq: 2000,  label: '2k' },
  { freq: 5000,  label: '5k' },
  { freq: 10000, label: '10k' },
  { freq: 20000, label: '20k' },
]

function drawAxis(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1
  const logicalW = canvas.offsetWidth
  if (logicalW === 0) return

  canvas.width  = Math.round(logicalW * dpr)
  canvas.height = Math.round(14 * dpr)
  canvas.style.width  = `${logicalW}px`
  canvas.style.height = '14px'

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, logicalW, 14)
  ctx.font = '9px ui-monospace,monospace'
  ctx.fillStyle = '#52525b'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const MIN_GAP = 5
  let lastRight = -Infinity

  for (const { freq, label } of AXIS_TICKS) {
    const x = ((Math.log10(freq) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * logicalW
    const tw = ctx.measureText(label).width
    const leftEdge = x - tw / 2
    if (leftEdge >= lastRight + MIN_GAP) {
      ctx.fillText(label, x, 7)
      lastRight = leftEdge + tw
    }
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SpectrumAnalyzer() {
  const containerRef = useRef<HTMLDivElement>(null)
  const analyzerRef  = useRef<AudioMotionAnalyzer | null>(null)
  const axisRef      = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    function tryAttach() {
      if (analyzerRef.current) return
      if (!containerRef.current) return
      if (getStatus().status !== 'running') return
      const ctx = getContext()
      const node = getNode()
      if (!ctx || !node) return

      const analyzer = new AudioMotionAnalyzer(containerRef.current, {
        audioCtx: ctx,
        source: node,
        connectSpeakers: false,
        height: 180,
        mode: 4,
        showScaleX: false,
        showScaleY: false,
        showPeaks: true,
        smoothing: 0.7,
        gradient: 'classic',
        bgAlpha: 0,
        overlay: true,
        showBgColor: false,
        weightingFilter: 'D',
        minDecibels: -85,
        maxDecibels: -20,
        ledBars: false,
        lumiBars: false,
        radial: false,
        reflexRatio: 0.05,
        reflexAlpha: 0.2,
      })
      analyzer.registerGradient('resolab', {
        bgColor: '#0a0a0a',
        colorStops: [
          { pos: 0,   color: '#a855f7' },
          { pos: 0.5, color: '#7c3aed' },
          { pos: 1,   color: '#22d3ee' },
        ],
      })
      analyzer.setOptions({ gradient: 'resolab' })
      analyzerRef.current = analyzer
    }

    tryAttach()
    const off = subscribe(() => tryAttach())
    return () => {
      off()
      analyzerRef.current?.destroy()
      analyzerRef.current = null
    }
  }, [])

  useEffect(() => {
    const canvas = axisRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => drawAxis(canvas))
    ro.observe(canvas)
    drawAxis(canvas)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-2">
      <div ref={containerRef} className="overflow-hidden rounded-md" />
      <canvas ref={axisRef} className="w-full" />
      <p className="mt-0.5 text-center text-[10px] uppercase tracking-wider text-zinc-600">
        Spectrum (1/6 oct.)
      </p>
    </div>
  )
}
