import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import {
  EFFECT_DEFINITIONS,
  type EffectInstance,
  type EffectType,
} from '@/types/effects'
import * as engine from '@/audio/engine'

const MAX_HISTORY = 30

interface EffectsState {
  effects: EffectInstance[]
  /** Monotonic id counter. */
  nextId: number
  /** Global bypass — passes signal through unprocessed, preserving per-effect bypass states. */
  globalBypass: boolean

  /** Undo/redo history of effects snapshots. */
  _history: EffectInstance[][]
  _historyIndex: number

  addEffect: (type: EffectType) => EffectInstance
  removeEffect: (id: number) => void
  setParam: (id: number, paramId: number, value: number) => void
  setBypass: (id: number, bypassed: boolean) => void
  setGlobalBypass: (bypassed: boolean) => void
  reorder: (fromIndex: number, toIndex: number) => void
  clear: () => void

  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
}

function paramDefaults(type: EffectType): Record<number, number> {
  const def = EFFECT_DEFINITIONS[type]
  const out: Record<number, number> = {}
  for (const p of def.params) out[p.id] = p.default
  return out
}

function cloneEffects(effects: EffectInstance[]): EffectInstance[] {
  return effects.map((e) => ({ ...e, params: { ...e.params } }))
}

export const useEffectsStore = create<EffectsState>()(
  devtools(
    (set, get) => ({
      effects: [],
      nextId: 1,
      globalBypass: false,
      _history: [],
      _historyIndex: -1,

      addEffect: (type) => {
        const id = get().nextId
        const params = paramDefaults(type)
        const instance: EffectInstance = { id, type, bypassed: false, params }

        engine.addEffect(type, id)
        for (const [paramId, value] of Object.entries(params)) {
          engine.setParam(id, Number(paramId), value)
        }

        set((s) => {
          const newEffects = [...s.effects, instance]
          const { history, index } = pushHistory(s._history, s._historyIndex, cloneEffects(newEffects))
          return { effects: newEffects, nextId: s.nextId + 1, _history: history, _historyIndex: index }
        }, undefined, 'effects/add')
        return instance
      },

      removeEffect: (id) => {
        engine.removeEffect(id)
        set((s) => {
          const newEffects = s.effects.filter((e) => e.id !== id)
          const { history, index } = pushHistory(s._history, s._historyIndex, cloneEffects(newEffects))
          return { effects: newEffects, _history: history, _historyIndex: index }
        }, undefined, 'effects/remove')
      },

      setParam: (id, paramId, value) => {
        engine.setParam(id, paramId, value)
        set((s) => ({
          effects: s.effects.map((e) =>
            e.id === id ? { ...e, params: { ...e.params, [paramId]: value } } : e,
          ),
        }), undefined, 'effects/setParam')
      },

      setBypass: (id, bypassed) => {
        engine.setBypass(id, bypassed)
        set((s) => {
          const newEffects = s.effects.map((e) => (e.id === id ? { ...e, bypassed } : e))
          const { history, index } = pushHistory(s._history, s._historyIndex, cloneEffects(newEffects))
          return { effects: newEffects, _history: history, _historyIndex: index }
        }, undefined, 'effects/setBypass')
      },

      setGlobalBypass: (bypassed) => {
        engine.setGlobalBypass(bypassed)
        set({ globalBypass: bypassed }, undefined, 'effects/setGlobalBypass')
      },

      reorder: (fromIndex, toIndex) => {
        const effects = get().effects.slice()
        const [moved] = effects.splice(fromIndex, 1)
        effects.splice(toIndex, 0, moved)
        engine.reorderEffects(effects.map((e) => e.id))
        set((s) => {
          const { history, index } = pushHistory(s._history, s._historyIndex, cloneEffects(effects))
          return { effects, _history: history, _historyIndex: index }
        }, undefined, 'effects/reorder')
      },

      clear: () => {
        for (const e of get().effects) engine.removeEffect(e.id)
        set((s) => {
          const { history, index } = pushHistory(s._history, s._historyIndex, [])
          return { effects: [], _history: history, _historyIndex: index }
        }, undefined, 'effects/clear')
      },

      undo: () => {
        const { _history, _historyIndex } = get()
        if (_historyIndex <= 0) return
        const newIndex = _historyIndex - 1
        const snapshot = _history[newIndex]!
        _applySnapshot(snapshot)
        set({ effects: cloneEffects(snapshot), _historyIndex: newIndex }, undefined, 'effects/undo')
      },

      redo: () => {
        const { _history, _historyIndex } = get()
        if (_historyIndex >= _history.length - 1) return
        const newIndex = _historyIndex + 1
        const snapshot = _history[newIndex]!
        _applySnapshot(snapshot)
        set({ effects: cloneEffects(snapshot), _historyIndex: newIndex }, undefined, 'effects/redo')
      },

      canUndo: () => get()._historyIndex > 0,
      canRedo: () => get()._historyIndex < get()._history.length - 1,
    }),
    { name: 'effectsStore' },
  ),
)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pushHistory(
  history: EffectInstance[][],
  index: number,
  snapshot: EffectInstance[],
): { history: EffectInstance[][]; index: number } {
  const truncated = history.slice(0, index + 1)
  truncated.push(snapshot)
  if (truncated.length > MAX_HISTORY) truncated.shift()
  return { history: truncated, index: truncated.length - 1 }
}

function _applySnapshot(snapshot: EffectInstance[]) {
  const current = useEffectsStore.getState().effects
  const currentIds = new Set(current.map((e) => e.id))
  const snapshotIds = new Set(snapshot.map((e) => e.id))

  // Remove effects not in snapshot.
  for (const e of current) {
    if (!snapshotIds.has(e.id)) engine.removeEffect(e.id)
  }

  // Add effects not in current.
  for (const e of snapshot) {
    if (!currentIds.has(e.id)) {
      engine.addEffect(e.type, e.id)
      for (const [paramId, value] of Object.entries(e.params)) {
        engine.setParam(e.id, Number(paramId), value)
      }
      engine.setBypass(e.id, e.bypassed)
    } else {
      // Sync params for existing effects.
      const cur = current.find((c) => c.id === e.id)!
      for (const [paramId, value] of Object.entries(e.params)) {
        if (cur.params[Number(paramId)] !== value) {
          engine.setParam(e.id, Number(paramId), value)
        }
      }
      if (cur.bypassed !== e.bypassed) engine.setBypass(e.id, e.bypassed)
    }
  }

  // Re-apply order.
  engine.reorderEffects(snapshot.map((e) => e.id))
}
