import { create } from 'zustand'

interface AnalysisState {
  /** Master output RMS (0..1 linear). */
  masterRms: number
  /** Master output peak (0..1 linear). */
  masterPeak: number
  /** Decaying peak hold (linear). */
  peakHold: number
  peakHoldExpiresAt: number
  /** Latching clip indicator — set true when peak >= 1.0, reset manually. */
  clipped: boolean

  /** Per-effect meter values (id → { meter_id → value }). */
  perEffect: Record<number, Record<number, number>>

  setMaster: (rms: number, peak: number) => void
  setEffectMeter: (id: number, meterId: number, value: number) => void
  clearEffect: (id: number) => void
  resetMaster: () => void
  clearClip: () => void
}

const PEAK_HOLD_MS = 1500

export const useAnalysisStore = create<AnalysisState>()((set, get) => ({
  masterRms: 0,
  masterPeak: 0,
  peakHold: 0,
  peakHoldExpiresAt: 0,
  clipped: false,
  perEffect: {},

  setMaster: (rms, peak) => {
    const now = performance.now()
    const cur = get()
    let { peakHold, peakHoldExpiresAt } = cur
    if (peak >= peakHold || now >= peakHoldExpiresAt) {
      peakHold = peak
      peakHoldExpiresAt = now + PEAK_HOLD_MS
    }
    const clipped = cur.clipped || peak >= 1.0
    set({ masterRms: rms, masterPeak: peak, peakHold, peakHoldExpiresAt, clipped })
  },

  setEffectMeter: (id, meterId, value) => set((s) => ({
    perEffect: {
      ...s.perEffect,
      [id]: { ...(s.perEffect[id] ?? {}), [meterId]: value },
    },
  })),

  clearEffect: (id) => set((s) => {
    if (!(id in s.perEffect)) return s
    const next = { ...s.perEffect }
    delete next[id]
    return { perEffect: next }
  }),

  resetMaster: () => set({ masterRms: 0, masterPeak: 0, peakHold: 0, peakHoldExpiresAt: 0, clipped: false }),
  clearClip: () => set({ clipped: false }),
}))
