import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

export type EducationMode = 'beginner' | 'advanced'
export type EducationLanguage = 'ro' | 'en'

interface EducationState {
  mode: EducationMode
  language: EducationLanguage
  /** Show / hide the contextual feedback InfoPanel. */
  feedbackVisible: boolean
  /** Indices of lessons the user has read/completed. */
  completedLessons: number[]

  setMode: (mode: EducationMode) => void
  setLanguage: (language: EducationLanguage) => void
  toggleFeedback: () => void
  markLessonComplete: (index: number) => void
}

export const useEducationStore = create<EducationState>()(
  devtools(
    persist(
      (set) => ({
        mode: 'beginner',
        language: 'ro',
        feedbackVisible: true,
        completedLessons: [],

        setMode: (mode) => set({ mode }, undefined, 'edu/setMode'),
        setLanguage: (language) => set({ language }, undefined, 'edu/setLanguage'),
        toggleFeedback: () => set((s) => ({ feedbackVisible: !s.feedbackVisible }), undefined, 'edu/toggleFeedback'),
        markLessonComplete: (index) => set((s) => ({
          completedLessons: s.completedLessons.includes(index)
            ? s.completedLessons
            : [...s.completedLessons, index],
        }), undefined, 'edu/markLessonComplete'),
      }),
      { name: 'resolab-education' },
    ),
    { name: 'educationStore' },
  ),
)
