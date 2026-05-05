import { useEffect, useRef } from 'react'
import { useAnalysisStore } from '@/store/analysisStore'

interface GainReductionMeterProps {
  effectId: number
  meterId?: number
  /** Maximum reduction shown (negative dB). */
  maxReductionDb?: number
  width?: number
  height?: number
}

const COLOR_BG = '#0f0f12'
const COLOR_BAR = '#22d3ee'
const COLOR_BORDER = '#3f3f46'

/**
 * Single-bar meter showing the absolute value of an effect's primary meter
 * (e.g. compressor gain reduction). Top of the bar = no reduction; bar grows
 * downward as reduction deepens.
 */
export function GainReductionMeter({
  effectId,
  meterId = 0,
  maxReductionDb = 18,
  width = 28,
  height = 90,
}: GainReductionMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const stateRef = useRef({ db: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)

    function draw() {
      const value = useAnalysisStore.getState().perEffect[effectId]?.[meterId] ?? 0
      // Reduction is negative; clamp to [-maxReductionDb, 0].
      const reduction = Math.max(-maxReductionDb, Math.min(0, value))
      // Smooth (faster on growing reduction, slower on release for visual feedback).
      const target = reduction
      const cur = stateRef.current.db
      const a = target < cur ? 0.6 : 0.15
      stateRef.current.db = cur + a * (target - cur)

      const t = -stateRef.current.db / maxReductionDb // 0..1
      ctx.fillStyle = COLOR_BG
      ctx.fillRect(0, 0, width, height)
      ctx.fillStyle = COLOR_BAR
      ctx.fillRect(2, 0, width - 4, t * height)

      // Tick marks every 3 dB
      ctx.fillStyle = COLOR_BORDER
      for (let db = 0; db >= -maxReductionDb; db -= 3) {
        const y = (-db / maxReductionDb) * height
        ctx.fillRect(0, y, 2, 1)
        ctx.fillRect(width - 2, y, 2, 1)
      }

      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [effectId, meterId, maxReductionDb, width, height])

  return (
    <div className="flex flex-col items-center gap-1">
      <canvas
        ref={canvasRef}
        className="rounded-md border border-zinc-800"
        aria-label="Gain reduction"
      />
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">GR</span>
    </div>
  )
}
