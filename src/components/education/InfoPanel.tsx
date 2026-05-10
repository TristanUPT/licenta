import { useEffect, useMemo, useState } from 'react'
import { useEffectsStore } from '@/store/effectsStore'
import { useEducationStore } from '@/store/educationStore'
import { analyzeAll, pickFeedback, type FeedbackEntry, type FeedbackSeverity } from '@/education/dynamicFeedback'
import type { EffectInstance } from '@/types/effects'

const FEEDBACK_DEBOUNCE_MS = 600

const SEVERITY_STYLE: Record<FeedbackSeverity, string> = {
  info: 'border-zinc-700 bg-zinc-900/60 text-zinc-300',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  critical: 'border-red-500/50 bg-red-500/10 text-red-200',
}
const SEVERITY_BADGE: Record<FeedbackSeverity, { ro: string; en: string; cls: string }> = {
  info: { ro: 'info', en: 'info', cls: 'bg-zinc-700 text-zinc-200' },
  warning: { ro: 'atenție', en: 'warning', cls: 'bg-amber-500/30 text-amber-100' },
  critical: { ro: 'critic', en: 'critical', cls: 'bg-red-500/30 text-red-100' },
}

export function InfoPanel() {
  const liveEffects = useEffectsStore((s) => s.effects)
  const language = useEducationStore((s) => s.language)
  const mode = useEducationStore((s) => s.mode)
  const feedbackVisible = useEducationStore((s) => s.feedbackVisible)
  const toggleFeedback = useEducationStore((s) => s.toggleFeedback)

  // Debounce the effects snapshot used for analysis so that rapid parameter
  // changes during EQ dragging don't cause the feedback to flicker or pop in
  // mid-gesture. The display updates 600 ms after the last param change.
  const [stableEffects, setStableEffects] = useState<EffectInstance[]>(liveEffects)
  useEffect(() => {
    const id = setTimeout(() => setStableEffects(liveEffects), FEEDBACK_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [liveEffects])

  const entries: FeedbackEntry[] = useMemo(() => analyzeAll(stableEffects), [stableEffects])

  if (liveEffects.length === 0) return null

  const heading = language === 'ro' ? 'Feedback contextual' : 'Contextual feedback'
  const emptyText = language === 'ro'
    ? 'Lanțul curent arată ok — nu sunt observații. Tweak-uiește valorile extreme ca să vezi cum reacționează.'
    : "The current chain looks fine — no observations. Push some values to extremes to see how it reacts."

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40">
      <button
        onClick={toggleFeedback}
        className="flex w-full items-center justify-between rounded-t-xl px-4 py-2 text-left transition hover:bg-zinc-900/80"
        aria-expanded={feedbackVisible}
      >
        <span className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
          {heading}
          {entries.length > 0 && (
            <span className="ml-2 rounded-full bg-purple-600/30 px-2 py-0.5 text-[10px] font-medium tracking-wide text-purple-200">
              {entries.length}
            </span>
          )}
        </span>
        <svg
          className={`h-4 w-4 text-zinc-500 transition-transform ${feedbackVisible ? '' : '-rotate-90'}`}
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {feedbackVisible && (
        <div className="space-y-2 p-3 pt-0">
          {entries.length === 0 ? (
            <p className="rounded-md border border-dashed border-zinc-800 px-3 py-3 text-xs text-zinc-500">
              {emptyText}
            </p>
          ) : entries.map((entry) => (
            <div
              key={entry.id}
              className={`rounded-md border px-3 py-2 text-xs leading-relaxed ${SEVERITY_STYLE[entry.severity]}`}
            >
              <div className="mb-1 flex items-center gap-2">
                <span className={`rounded-sm px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${SEVERITY_BADGE[entry.severity].cls}`}>
                  {SEVERITY_BADGE[entry.severity][language]}
                </span>
              </div>
              <p>{pickFeedback(entry, language, mode)}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
