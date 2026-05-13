import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { EffectInstance } from '@/types/effects'
import type { Preset } from '@/presets/factoryPresets'
import { getUserPresets, putUserPreset, removeUserPreset } from '@/audio/db'

interface PresetState {
  /** ID of the last loaded preset, or null if the chain was modified manually. */
  activePresetId: string | null
  /** User-created presets loaded from IndexedDB. */
  userPresets: Preset[]
  /** True while the initial DB load is in progress. */
  userPresetsLoaded: boolean

  setActivePresetId: (id: string | null) => void
  loadUserPresetsFromDB: () => Promise<void>
  saveCurrentAsUserPreset: (
    name: string,
    effects: EffectInstance[],
  ) => Promise<Preset>
  deleteUserPreset: (id: string) => Promise<void>
}

function buildPresetFromChain(name: string, effects: EffectInstance[]): Preset {
  return {
    id: `user:${Date.now()}`,
    category: 'user',
    name: { ro: name, en: name },
    description: { ro: '', en: '' },
    effects: effects.map((e) => ({
      type: e.type,
      bypassed: e.bypassed,
      params: { ...e.params },
    })),
  }
}

export const usePresetStore = create<PresetState>()(
  devtools(
    (set) => ({
      activePresetId: null,
      userPresets: [],
      userPresetsLoaded: false,

      setActivePresetId: (id) =>
        set({ activePresetId: id }, undefined, 'preset/setActive'),

      loadUserPresetsFromDB: async () => {
        try {
          const presets = await getUserPresets()
          set({ userPresets: presets, userPresetsLoaded: true }, undefined, 'preset/loadFromDB')
        } catch {
          set({ userPresetsLoaded: true }, undefined, 'preset/loadFromDB')
        }
      },

      saveCurrentAsUserPreset: async (name, effects) => {
        const preset = buildPresetFromChain(name, effects)
        await putUserPreset(preset)
        set(
          (s) => ({ userPresets: [...s.userPresets, preset], activePresetId: preset.id }),
          undefined,
          'preset/saveUser',
        )
        return preset
      },

      deleteUserPreset: async (id) => {
        await removeUserPreset(id)
        set(
          (s) => ({
            userPresets: s.userPresets.filter((p) => p.id !== id),
            activePresetId: s.activePresetId === id ? null : s.activePresetId,
          }),
          undefined,
          'preset/deleteUser',
        )
      },
    }),
    { name: 'presetStore' },
  ),
)
