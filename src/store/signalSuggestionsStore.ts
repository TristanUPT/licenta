import { create } from 'zustand'
import type { Recommendation, RecSeverity } from '@/education/recommendations'

/**
 * Accumulated, timestamped signal observations gathered during playback.
 *
 * The spectral rules in `recommendations.ts` react to the current analysis
 * window, so a problem that appears for a moment used to vanish as playback
 * advanced. Here each detection is instead recorded with the playback time at
 * which it was seen. Consecutive detections of the same rule extend a single
 * entry into an interval instead of piling up duplicates, and the user can
 * dismiss entries individually or all at once for the current file.
 */

export interface SignalObservation {
  id: string
  severity: RecSeverity
  /** Playback time (seconds) of the first detection. */
  firstTs: number
  /** Playback time (seconds) of the most recent detection. */
  lastTs: number
  ro: { beginner: string; advanced: string }
  en: { beginner: string; advanced: string }
}

interface SignalSuggestionsState {
  observations: SignalObservation[]
  /** Rule ids dismissed for the current file; they won't be recorded again. */
  ignored: string[]

  record: (rec: Recommendation, ts: number) => void
  ignore: (id: string) => void
  ignoreAll: () => void
  reset: () => void
}

export const useSignalSuggestionsStore = create<SignalSuggestionsState>()((set) => ({
  observations: [],
  ignored: [],

  record: (rec, ts) =>
    set((s) => {
      if (s.ignored.includes(rec.id)) return s

      const existing = s.observations.find((o) => o.id === rec.id)
      if (existing) {
        // Same problem seen again → extend the interval, keep the entry single.
        if (ts <= existing.lastTs) return s
        return {
          observations: s.observations.map((o) =>
            o.id === rec.id ? { ...o, lastTs: ts } : o,
          ),
        }
      }

      const observation: SignalObservation = {
        id: rec.id,
        severity: rec.severity,
        firstTs: ts,
        lastTs: ts,
        ro: rec.ro,
        en: rec.en,
      }
      // Keep chronological order by first appearance.
      const next = [...s.observations, observation].sort((a, b) => a.firstTs - b.firstTs)
      return { observations: next }
    }),

  ignore: (id) =>
    set((s) => ({
      observations: s.observations.filter((o) => o.id !== id),
      ignored: s.ignored.includes(id) ? s.ignored : [...s.ignored, id],
    })),

  ignoreAll: () =>
    set((s) => ({
      observations: [],
      ignored: [...new Set([...s.ignored, ...s.observations.map((o) => o.id)])],
    })),

  reset: () => set({ observations: [], ignored: [] }),
}))
