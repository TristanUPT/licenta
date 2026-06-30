import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface UiState {
  showWaveform:   boolean
  showVisualizer: boolean
  showEducation:  boolean
  showLessons:    boolean
  theme: 'dark' | 'light'

  toggleWaveform:   () => void
  toggleVisualizer: () => void
  toggleEducation:  () => void
  toggleLessons:    () => void
  setTheme: (t: 'dark' | 'light') => void
}

export const useUiStore = create<UiState>()(
  devtools(
    persist(
      (set) => ({
        showWaveform:   true,
        showVisualizer: true,
        showEducation:  true,
        showLessons:    false,
        theme:          'dark',

        toggleWaveform:   () => set((s) => ({ showWaveform:   !s.showWaveform   }), undefined, 'ui/toggleWaveform'),
        toggleVisualizer: () => set((s) => ({ showVisualizer: !s.showVisualizer }), undefined, 'ui/toggleVisualizer'),
        toggleEducation:  () => set((s) => ({ showEducation:  !s.showEducation  }), undefined, 'ui/toggleEducation'),
        toggleLessons:    () => set((s) => ({ showLessons:    !s.showLessons    }), undefined, 'ui/toggleLessons'),
        setTheme: (t) => set({ theme: t }, undefined, 'ui/setTheme'),
      }),
      {
        name: 'resolab-ui',
        partialize: (s) => ({
          showWaveform:   s.showWaveform,
          showVisualizer: s.showVisualizer,
          showEducation:  s.showEducation,
          showLessons:    s.showLessons,
          theme:          s.theme,
        }),
      },
    ),
    { name: 'uiStore' },
  ),
)
