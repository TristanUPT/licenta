import { useState, useEffect } from 'react'
import { useEducationStore } from '@/store/educationStore'

const STORAGE_KEY = 'soundlab-kb-hint-dismissed'

const SHORTCUTS = [
  { key: 'Space', ro: 'Play / Pause',         en: 'Play / Pause' },
  { key: 'S',     ro: 'Stop',                  en: 'Stop' },
  { key: 'L',     ro: 'Toggle loop',           en: 'Toggle loop' },
  { key: 'I',     ro: 'Set loop in',           en: 'Set loop in' },
  { key: 'O',     ro: 'Set loop out',          en: 'Set loop out' },
  { key: 'B',     ro: 'A/B bypass',            en: 'A/B bypass' },
]

export function KeyboardHint() {
  const language = useEducationStore((s) => s.language)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  const title  = language === 'ro' ? 'Scurtături tastatură' : 'Keyboard shortcuts'
  const closeL = language === 'ro' ? 'Am înțeles' : 'Got it'

  return (
    <div className="fixed bottom-20 right-4 z-50 w-64 rounded-xl border border-zinc-700 bg-zinc-900 p-4 shadow-2xl sm:right-6">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
          {title}
        </span>
        <button
          onClick={dismiss}
          className="text-zinc-500 transition hover:text-zinc-200"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      <ul className="space-y-1.5">
        {SHORTCUTS.map((s) => (
          <li key={s.key} className="flex items-center justify-between">
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] text-zinc-200">
              {s.key}
            </span>
            <span className="text-[11px] text-zinc-400">{s[language]}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={dismiss}
        className="mt-3 w-full rounded-md bg-purple-600/20 py-1.5 text-[11px] font-medium text-purple-300 transition hover:bg-purple-600/30"
      >
        {closeL}
      </button>
    </div>
  )
}
