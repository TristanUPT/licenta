import { useEffect, useMemo, useRef, useState } from 'react'
import { useEffectsStore } from '@/store/effectsStore'
import { useAnalysisStore } from '@/store/analysisStore'
import { useEducationStore } from '@/store/educationStore'
import { getSharedAnalyser, computeBands } from '@/audio/analyzerNode'
import type { FrequencyBands } from '@/audio/analyzerNode'
import {
  computeRecommendations,
  pickRecommendation,
  type Recommendation,
  type RecSeverity,
} from '@/education/recommendations'
import { getStatus } from '@/audio/engine'

const SEV_STYLE: Record<RecSeverity, string> = {
  info:       'border-zinc-700 bg-zinc-900/60 text-zinc-300',
  suggestion: 'border-purple-500/40 bg-purple-500/10 text-purple-100',
  warning:    'border-amber-500/40 bg-amber-500/10 text-amber-200',
}

const SEV_BADGE: Record<RecSeverity, { ro: string; en: string; cls: string }> = {
  info:       { ro: 'info',      en: 'info',       cls: 'bg-zinc-700 text-zinc-200' },
  suggestion: { ro: 'sugestie',  en: 'suggestion', cls: 'bg-purple-500/30 text-purple-100' },
  warning:    { ro: 'atenție',   en: 'warning',    cls: 'bg-amber-500/30 text-amber-100' },
}

// One snapshot every ~3 s (180 frames at 60 fps).
// Longer window → rules only fire when condition is sustained, not momentary.
const FRAMES_PER_UPDATE = 180

interface StableMetrics {
  bands: FrequencyBands
  rms: number   // mean RMS over window
  peak: number  // max peak seen over window
}

export function RecommendationsPanel() {
  const effects   = useEffectsStore((s) => s.effects)
  const addEffect = useEffectsStore((s) => s.addEffect)
  const language  = useEducationStore((s) => s.language)
  const mode      = useEducationStore((s) => s.mode)

  // Read live values via refs inside the rAF loop — no re-renders on every tick.
  const masterRms  = useAnalysisStore((s) => s.masterRms)
  const masterPeak = useAnalysisStore((s) => s.masterPeak)
  const rmsRef     = useRef(masterRms)
  rmsRef.current   = masterRms
  const peakRef    = useRef(masterPeak)
  peakRef.current  = masterPeak

  const [visible, setVisible]     = useState(true)
  const [metrics, setMetrics]     = useState<StableMetrics | null>(null)
  const [addError, setAddError]   = useState<string | null>(null)

  // Single rAF loop — accumulates bands + RMS (mean) + peak (max-hold) over
  // FRAMES_PER_UPDATE frames, then commits one stable snapshot. This prevents
  // momentary spikes from toggling recommendations on and off rapidly.
  useEffect(() => {
    let rafId: number
    let frameCount = 0
    let fftData: Uint8Array<ArrayBuffer> | null = null

    const bandAcc: FrequencyBands = {
      subBass: 0, bass: 0, lowMids: 0, mids: 0,
      upperMids: 0, presence: 0, air: 0,
    }
    let rmsSum  = 0
    let peakMax = 0

    function loop() {
      const analyser = getSharedAnalyser()
      if (analyser) {
        if (!fftData || fftData.length !== analyser.frequencyBinCount) {
          fftData = new Uint8Array(analyser.frequencyBinCount)
        }
        analyser.getByteFrequencyData(fftData)

        const b = computeBands(fftData)
        for (const k of Object.keys(bandAcc) as (keyof FrequencyBands)[]) {
          bandAcc[k] += b[k]
        }
        rmsSum  += rmsRef.current
        peakMax  = Math.max(peakMax, peakRef.current)
        frameCount++

        if (frameCount >= FRAMES_PER_UPDATE) {
          const bands = {} as FrequencyBands
          for (const k of Object.keys(bandAcc) as (keyof FrequencyBands)[]) {
            bands[k]   = bandAcc[k] / FRAMES_PER_UPDATE
            bandAcc[k] = 0
          }
          setMetrics({ bands, rms: rmsSum / FRAMES_PER_UPDATE, peak: peakMax })
          rmsSum     = 0
          peakMax    = 0
          frameCount = 0
        }
      }
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [])

  const recommendations = useMemo(
    () => computeRecommendations(
      effects,
      metrics?.bands ?? null,
      metrics?.rms   ?? 0,
      metrics?.peak  ?? 0,
    ),
    // Recompute only when the stable 3-second snapshot changes or the chain changes.
    [effects, metrics],
  )

  if (effects.length === 0) return null

  const heading   = language === 'ro' ? 'Recomandări' : 'Recommendations'
  const emptyText = language === 'ro'
    ? 'Nicio recomandare pentru configurația curentă. Semnalul sună bine!'
    : 'No recommendations for the current configuration. The signal sounds good!'
  const addLabel  = language === 'ro' ? 'Adaugă' : 'Add'

  function handleAdd(rec: Recommendation) {
    if (rec.effectType === undefined) return
    setAddError(null)
    try {
      if (getStatus().status !== 'running') {
        setAddError(language === 'ro' ? 'Engine-ul nu rulează.' : 'Engine is not running.')
        return
      }
      addEffect(rec.effectType)
    } catch (e) {
      setAddError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40">
      <button
        onClick={() => setVisible((v) => !v)}
        className="flex w-full items-center justify-between rounded-t-xl px-4 py-2 text-left transition hover:bg-zinc-900/80"
        aria-expanded={visible}
      >
        <span className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
          {heading}
          {recommendations.length > 0 && (
            <span className="ml-2 rounded-full bg-purple-600/30 px-2 py-0.5 text-[10px] font-medium tracking-wide text-purple-200">
              {recommendations.length}
            </span>
          )}
        </span>
        <svg
          className={`h-4 w-4 text-zinc-500 transition-transform ${visible ? '' : '-rotate-90'}`}
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {visible && (
        <div className="space-y-2 p-3 pt-0">
          {addError && (
            <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {addError}
            </p>
          )}
          {recommendations.length === 0 ? (
            <p className="rounded-md border border-dashed border-zinc-800 px-3 py-3 text-xs text-zinc-500">
              {emptyText}
            </p>
          ) : (
            recommendations.map((rec) => (
              <div
                key={rec.id}
                className={`rounded-md border px-3 py-2 text-xs leading-relaxed ${SEV_STYLE[rec.severity]}`}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className={`rounded-sm px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${SEV_BADGE[rec.severity].cls}`}>
                    {SEV_BADGE[rec.severity][language]}
                  </span>
                  {rec.effectType !== undefined && (
                    <button
                      onClick={() => handleAdd(rec)}
                      className="rounded px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider bg-purple-600/20 text-purple-300 transition hover:bg-purple-600/40"
                    >
                      + {addLabel}
                    </button>
                  )}
                </div>
                <p>{pickRecommendation(rec, language, mode)}</p>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  )
}
