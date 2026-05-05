import { useEffect, useRef } from 'react'
import { useAnalysisStore } from '@/store/analysisStore'

interface LevelMeterProps {
  /** Total height in px (component is vertical). */
  height?: number
  /** Total width in px. */
  width?: number
  /** Min dB shown at the bottom of the scale. */
  minDb?: number
}

const COLOR_BG = '#0f0f12'
const COLOR_RMS = '#a855f7'
const COLOR_PEAK_HOT = '#22d3ee'
const COLOR_CLIP = '#ef4444'

function linToDb(lin: number): number {
  return lin > 1e-6 ? 20 * Math.log10(lin) : -120
}

function dbToY(db: number, minDb: number, height: number): number {
  // Map [-60, 0] to [height, 0]
  const t = Math.max(0, Math.min(1, (db - minDb) / (0 - minDb)))
  return height - t * height
}

/** Two-bar level meter: peak (cyan) + RMS (purple) + peak hold + clip indicator. */
export function LevelMeter({ height = 160, width = 28, minDb = -60 }: LevelMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  // Smoothed peak/rms in dB for visual decay (avoid jittery bars).
  const stateRef = useRef({ peakDb: -120, rmsDb: -120, holdDb: -120 })

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
      const s = useAnalysisStore.getState()
      const targetPeakDb = linToDb(s.masterPeak)
      const targetRmsDb = linToDb(s.masterRms)
      const targetHoldDb = linToDb(s.peakHold)

      // Asymmetric smoothing (fast attack on rise, slower fall).
      const a = 0.4   // rise blend
      const r = 0.06  // fall blend
      const st = stateRef.current
      st.peakDb = targetPeakDb > st.peakDb
        ? st.peakDb + a * (targetPeakDb - st.peakDb)
        : st.peakDb + r * (targetPeakDb - st.peakDb)
      st.rmsDb = targetRmsDb > st.rmsDb
        ? st.rmsDb + a * (targetRmsDb - st.rmsDb)
        : st.rmsDb + r * (targetRmsDb - st.rmsDb)
      st.holdDb = targetHoldDb > st.holdDb
        ? targetHoldDb
        : st.holdDb + r * (targetHoldDb - st.holdDb)

      ctx.fillStyle = COLOR_BG
      ctx.fillRect(0, 0, width, height)

      const peakY = dbToY(st.peakDb, minDb, height)
      const rmsY = dbToY(st.rmsDb, minDb, height)
      const holdY = dbToY(st.holdDb, minDb, height)

      // Peak bar
      const peakColor = st.peakDb > -0.1 ? COLOR_CLIP : COLOR_PEAK_HOT
      ctx.fillStyle = peakColor
      ctx.fillRect(2, peakY, width - 4, height - peakY)

      // RMS bar (slightly inset)
      ctx.fillStyle = COLOR_RMS
      ctx.fillRect(6, rmsY, width - 12, height - rmsY)

      // Peak hold line
      ctx.fillStyle = '#fafafa'
      ctx.fillRect(2, holdY - 1, width - 4, 2)

      // Tick marks every 6 dB
      ctx.fillStyle = '#3f3f46'
      for (let db = 0; db >= minDb; db -= 6) {
        const y = dbToY(db, minDb, height)
        ctx.fillRect(0, y, 2, 1)
        ctx.fillRect(width - 2, y, 2, 1)
      }

      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [height, width, minDb])

  return (
    <canvas
      ref={canvasRef}
      className="rounded-md border border-zinc-800"
      aria-label="Output level meter"
    />
  )
}
