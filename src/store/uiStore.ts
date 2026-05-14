import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface UiState {
  showWaveform:   boolean
  showVisualizer: boolean
  showEducation:  boolean
  showLessons:    boolean

  toggleWaveform:   () => void
  toggleVisualizer: () => void
  toggleEducation:  () => void
  toggleLessons:    () => void
}

export const useUiStore = create<UiState>()(
  devtools(
    persist(
      (set) => ({
        showWaveform:   true,
        showVisualizer: true,
        showEducation:  true,
        showLessons:    false,

        toggleWaveform:   () => set((s) => ({ showWaveform:   !s.showWaveform   }), undefined, 'ui/toggleWaveform'),
        toggleVisualizer: () => set((s) => ({ showVisualizer: !s.showVisualizer }), undefined, 'ui/toggleVisualizer'),
        toggleEducation:  () => set((s) => ({ showEducation:  !s.showEducation  }), undefined, 'ui/toggleEducation'),
        toggleLessons:    () => set((s) => ({ showLessons:    !s.showLessons    }), undefined, 'ui/toggleLessons'),
      }),
      {
        name: 'soundlab-ui',
        partialize: (s) => ({
          showWaveform:   s.showWaveform,
          showVisualizer: s.showVisualizer,
          showEducation:  s.showEducation,
          showLessons:    s.showLessons,
        }),
      },
    ),
    { name: 'uiStore' },
  ),
)
