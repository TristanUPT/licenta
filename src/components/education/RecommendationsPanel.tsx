import { useEffect, useMemo, useRef, useState } from 'react'
import { useEffectsStore } from '@/store/effectsStore'
import { useAnalysisStore } from '@/store/analysisStore'
import { useAudioStore } from '@/store/audioStore'
import { useEducationStore } from '@/store/educationStore'
import { useSignalSuggestionsStore } from '@/store/signalSuggestionsStore'
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

// Spectral rules are tied to what is playing at a moment; those get accumulated
// with a timestamp. Everything else (chain / level suggestions) stays live.
const SPECTRAL_PREFIX = 'spectral:'

// Below this gap the first and last detections are treated as the same instant.
const INTERVAL_THRESHOLD_SEC = 1.0

interface StableMetrics {
  bands: FrequencyBands
  rms: number    // mean RMS over window
  peak: number   // max peak seen over window
  ts: number     // playback position (seconds) at the snapshot
  playing: boolean
}

function fmtClock(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function RecommendationsPanel() {
  const effects   = useEffectsStore((s) => s.effects)
  const addEffect = useEffectsStore((s) => s.addEffect)
  const language  = useEducationStore((s) => s.language)
  const mode      = useEducationStore((s) => s.mode)

  const audioBuffer = useAudioStore((s) => s.audioBuffer)

  const observations = useSignalSuggestionsStore((s) => s.observations)
  const record       = useSignalSuggestionsStore((s) => s.record)
  const ignore       = useSignalSuggestionsStore((s) => s.ignore)
  const ignoreAll    = useSignalSuggestionsStore((s) => s.ignoreAll)
  const resetObs     = useSignalSuggestionsStore((s) => s.reset)

  // Read live values via refs inside the rAF loop — no re-renders on every tick.
  const masterRms  = useAnalysisStore((s) => s.masterRms)
  const masterPeak = useAnalysisStore((s) => s.masterPeak)
  const rmsRef     = useRef(masterRms)
  rmsRef.current   = masterRms
  const peakRef    = useRef(masterPeak)
  peakRef.current  = masterPeak

  // Latest effects, read inside the recording effect without re-subscribing it.
  const effectsRef = useRef(effects)
  effectsRef.current = effects

  const [visible, setVisible]   = useState(true)
  const [metrics, setMetrics]   = useState<StableMetrics | null>(null)
  const [addError, setAddError] = useState<string | null>(null)

  // Reset the accumulated observations whenever the buffer changes — a new file
  // or a chop edit both invalidate the previous timeline.
  useEffect(() => {
    resetObs()
  }, [audioBuffer, resetObs])

  // Single rAF loop — accumulates bands + RMS (mean) + peak (max-hold) over
  // FRAMES_PER_UPDATE frames, then commits one stable snapshot together with the
  // current playback position. This prevents momentary spikes from toggling
  // recommendations on and off rapidly.
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
          const audio = useAudioStore.getState()
          setMetrics({
            bands,
            rms: rmsSum / FRAMES_PER_UPDATE,
            peak: peakMax,
            ts: audio.playbackPosition,
            playing: audio.isPlaying,
          })
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

  // Persist spectral detections with their playback timestamp. Runs only when a
  // fresh snapshot arrives during playback.
  useEffect(() => {
    if (!metrics || !metrics.playing) return
    const recs = computeRecommendations(
      effectsRef.current, metrics.bands, metrics.rms, metrics.peak,
    )
    for (const r of recs) {
      if (r.id.startsWith(SPECTRAL_PREFIX)) record(r, metrics.ts)
    }
  }, [metrics, record])

  // Live suggestions = everything that is not a time-localized spectral detection.
  const liveRecs = useMemo(
    () => recommendations.filter((r) => !r.id.startsWith(SPECTRAL_PREFIX)),
    [recommendations],
  )

  const total = liveRecs.length + observations.length
  if (effects.length === 0 && observations.length === 0) return null

  const ro = language === 'ro'
  const heading   = ro ? 'Sugestii semnal' : 'Signal Suggestions'
  const emptyText = ro
    ? 'Nicio sugestie pentru configurația curentă — semnalul sună bine!'
    : 'No suggestions for the current configuration — signal sounds good!'
  const addLabel     = ro ? 'Adaugă' : 'Add'
  const obsHeading   = ro ? 'Observații pe parcurs' : 'Observations over time'
  const ignoreTitle  = ro ? 'Ignoră această observație' : 'Dismiss this observation'
  const ignoreAllTxt = ro ? 'Ignoră toate' : 'Dismiss all'
  const analysisNote = ro
    ? 'Analiză actualizată la ~3 s · observațiile se acumulează în timpul redării'
    : 'Analysis updated every ~3 s · observations accumulate during playback'

  function occurrenceLabel(firstTs: number, lastTs: number): string {
    if (lastTs - firstTs >= INTERVAL_THRESHOLD_SEC) {
      return ro
        ? `între ${fmtClock(firstTs)} și ${fmtClock(lastTs)}`
        : `between ${fmtClock(firstTs)} and ${fmtClock(lastTs)}`
    }
    return ro ? `la ${fmtClock(firstTs)}` : `at ${fmtClock(firstTs)}`
  }

  function handleAdd(rec: Recommendation) {
    if (rec.effectType === undefined) return
    setAddError(null)
    try {
      if (getStatus().status !== 'running') {
        setAddError(ro ? 'Engine-ul nu rulează.' : 'Engine is not running.')
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
          {total > 0 && (
            <span className="ml-2 rounded-full bg-purple-600/30 px-2 py-0.5 text-[10px] font-medium tracking-wide text-purple-200">
              {total}
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

          {/* Live chain / level suggestions */}
          {liveRecs.map((rec) => (
            <div
              key={rec.id}
              className={`rounded-md border px-3 py-2 text-xs leading-relaxed ${SEV_STYLE[rec.severity]}`}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${SEV_BADGE[rec.severity].cls}`}>
                  {SEV_BADGE[rec.severity][language]}
                </span>
                {rec.effectType !== undefined && (
                  <button
                    onClick={() => handleAdd(rec)}
                    className="rounded-md bg-purple-600/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-purple-300 transition hover:bg-purple-600/40"
                  >
                    + {addLabel}
                  </button>
                )}
              </div>
              <p>{pickRecommendation(rec, language, mode)}</p>
            </div>
          ))}

          {/* Accumulated, timestamped signal observations */}
          {observations.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {obsHeading}
                </span>
                {observations.length > 2 && (
                  <button
                    onClick={ignoreAll}
                    className="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
                  >
                    {ignoreAllTxt}
                  </button>
                )}
              </div>
              {observations.map((obs) => (
                <div
                  key={obs.id}
                  className={`rounded-md border px-3 py-2 text-xs leading-relaxed ${SEV_STYLE[obs.severity]}`}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      <span className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${SEV_BADGE[obs.severity].cls}`}>
                        {SEV_BADGE[obs.severity][language]}
                      </span>
                      <span className="font-mono text-[10px] tabular-nums text-zinc-400">
                        {occurrenceLabel(obs.firstTs, obs.lastTs)}
                      </span>
                    </span>
                    <button
                      onClick={() => ignore(obs.id)}
                      title={ignoreTitle}
                      aria-label={ignoreTitle}
                      className="rounded p-0.5 text-zinc-600 transition hover:bg-zinc-800 hover:text-zinc-300"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p>{obs[language][mode]}</p>
                </div>
              ))}
            </div>
          )}

          {total === 0 && (
            <p className="rounded-md border border-dashed border-zinc-800 px-3 py-3 text-xs text-zinc-500">
              {emptyText}
            </p>
          )}

          <p className="pt-1 text-[10px] text-zinc-700">{analysisNote}</p>
        </div>
      )}
    </section>
  )
}
