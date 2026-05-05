/**
 * Wires worklet stats messages into the global analysisStore.
 * Imported once from `main.tsx`.
 */

import { subscribeStats } from './engine'
import { useAnalysisStore } from '@/store/analysisStore'

let unsubscribe: (() => void) | null = null

export function initAnalysisBridge(): void {
  if (unsubscribe) return
  unsubscribe = subscribeStats((stats) => {
    const store = useAnalysisStore.getState()
    store.setMaster(stats.outputRms, stats.outputPeak)
    for (const m of stats.effectMeters) {
      store.setEffectMeter(m.id, 0, m.value)
    }
  })
}
