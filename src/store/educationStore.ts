import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

export type EducationMode = 'beginner' | 'advanced'
export type EducationLanguage = 'ro' | 'en'

interface EducationState {
  mode: EducationMode
  language: EducationLanguage
  /** Show / hide the contextual feedback InfoPanel. */
  feedbackVisible: boolean

  setMode: (mode: EducationMode) => void
  setLanguage: (language: EducationLanguage) => void
  toggleFeedback: () => void
}

export const useEducationStore = create<EducationState>()(
  devtools(
    persist(
      (set) => ({
        mode: 'beginner',
        language: 'ro',
        feedbackVisible: true,

        setMode: (mode) => set({ mode }, undefined, 'edu/setMode'),
        setLanguage: (language) => set({ language }, undefined, 'edu/setLanguage'),
        toggleFeedback: () => set((s) => ({ feedbackVisible: !s.feedbackVisible }), undefined, 'edu/toggleFeedback'),
      }),
      { name: 'soundlab-education' },
    ),
    { name: 'educationStore' },
  ),
)
