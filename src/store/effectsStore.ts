import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import {
  EFFECT_DEFINITIONS,
  type EffectInstance,
  type EffectType,
} from '@/types/effects'
import * as engine from '@/audio/engine'

interface EffectsState {
  effects: EffectInstance[]
  /** Monotonic id counter. */
  nextId: number
  /** Global bypass — passes signal through unprocessed, preserving per-effect bypass states. */
  globalBypass: boolean

  addEffect: (type: EffectType) => EffectInstance
  removeEffect: (id: number) => void
  setParam: (id: number, paramId: number, value: number) => void
  setBypass: (id: number, bypassed: boolean) => void
  setGlobalBypass: (bypassed: boolean) => void
  reorder: (fromIndex: number, toIndex: number) => void
  clear: () => void
}

function paramDefaults(type: EffectType): Record<number, number> {
  const def = EFFECT_DEFINITIONS[type]
  const out: Record<number, number> = {}
  for (const p of def.params) out[p.id] = p.default
  return out
}

export const useEffectsStore = create<EffectsState>()(
  devtools(
    (set, get) => ({
      effects: [],
      nextId: 1,
      globalBypass: false,

      addEffect: (type) => {
        const id = get().nextId
        const params = paramDefaults(type)
        const instance: EffectInstance = { id, type, bypassed: false, params }

        // Push to the worklet first; if engine isn't running this throws and
        // we don't pollute the store.
        engine.addEffect(type, id)
        for (const [paramId, value] of Object.entries(params)) {
          engine.setParam(id, Number(paramId), value)
        }

        set(
          (s) => ({ effects: [...s.effects, instance], nextId: s.nextId + 1 }),
          undefined,
          'effects/add',
        )
        return instance
      },

      removeEffect: (id) => {
        engine.removeEffect(id)
        set(
          (s) => ({ effects: s.effects.filter((e) => e.id !== id) }),
          undefined,
          'effects/remove',
        )
      },

      setParam: (id, paramId, value) => {
        engine.setParam(id, paramId, value)
        set(
          (s) => ({
            effects: s.effects.map((e) =>
              e.id === id ? { ...e, params: { ...e.params, [paramId]: value } } : e,
            ),
          }),
          undefined,
          'effects/setParam',
        )
      },

      setBypass: (id, bypassed) => {
        engine.setBypass(id, bypassed)
        set(
          (s) => ({
            effects: s.effects.map((e) => (e.id === id ? { ...e, bypassed } : e)),
          }),
          undefined,
          'effects/setBypass',
        )
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
        set({ effects }, undefined, 'effects/reorder')
      },

      clear: () => {
        for (const e of get().effects) engine.removeEffect(e.id)
        set({ effects: [] }, undefined, 'effects/clear')
      },
    }),
    { name: 'effectsStore' },
  ),
)
