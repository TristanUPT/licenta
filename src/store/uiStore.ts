import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface UiState {
  showWaveform:   boolean
  showVisualizer: boolean
  showEducation:  boolean
  showLessons:    boolean
  showSynthLab:   boolean

  toggleWaveform:   () => void
  toggleVisualizer: () => void
  toggleEducation:  () => void
  toggleLessons:    () => void
  toggleSynthLab:   () => void
}

export const useUiStore = create<UiState>()(
  devtools(
    persist(
      (set) => ({
        showWaveform:   true,
        showVisualizer: true,
        showEducation:  true,
        showLessons:    false,
        showSynthLab:   false,

        toggleWaveform:   () => set((s) => ({ showWaveform:   !s.showWaveform   }), undefined, 'ui/toggleWaveform'),
        toggleVisualizer: () => set((s) => ({ showVisualizer: !s.showVisualizer }), undefined, 'ui/toggleVisualizer'),
        toggleEducation:  () => set((s) => ({ showEducation:  !s.showEducation  }), undefined, 'ui/toggleEducation'),
        toggleLessons:    () => set((s) => ({ showLessons:    !s.showLessons    }), undefined, 'ui/toggleLessons'),
        toggleSynthLab:   () => set((s) => ({ showSynthLab:   !s.showSynthLab   }), undefined, 'ui/toggleSynthLab'),
      }),
      {
        name: 'soundlab-ui',
        partialize: (s) => ({
          showWaveform:   s.showWaveform,
          showVisualizer: s.showVisualizer,
          showEducation:  s.showEducation,
          showLessons:    s.showLessons,
          showSynthLab:   s.showSynthLab,
        }),
      },
    ),
    { name: 'uiStore' },
  ),
)
