import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface PresetState {
  /** ID of the last loaded preset, or null if the chain was modified manually. */
  activePresetId: string | null
  setActivePresetId: (id: string | null) => void
}

export const usePresetStore = create<PresetState>()(
  devtools(
    (set) => ({
      activePresetId: null,
      setActivePresetId: (id) => set({ activePresetId: id }, undefined, 'preset/setActive'),
    }),
    { name: 'presetStore' },
  ),
)
