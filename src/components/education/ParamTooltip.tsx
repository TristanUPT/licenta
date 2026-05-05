import { type ReactNode } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { useEducationStore } from '@/store/educationStore'
import { getParamDocs, pickText, pickTitle } from '@/education/effectDescriptions'
import type { EffectType } from '@/types/effects'

interface ParamTooltipProps {
  effectType: EffectType
  paramId: number
  children: ReactNode
}

/**
 * Wraps any control with a hover/focus tooltip showing the bilingual,
 * mode-aware description for `[effectType, paramId]`. If no docs exist,
 * the children are rendered without a tooltip.
 */
export function ParamTooltip({ effectType, paramId, children }: ParamTooltipProps) {
  const language = useEducationStore((s) => s.language)
  const mode = useEducationStore((s) => s.mode)
  const docs = getParamDocs(effectType, paramId)
  if (!docs) return <>{children}</>

  const title = pickTitle(docs.title, language)
  const body = pickText(docs.body, language, mode)

  return (
    <Tooltip.Provider delayDuration={300} skipDelayDuration={150}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={8}
            collisionPadding={12}
            className="z-50 max-w-xs rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-xs leading-relaxed text-zinc-200 shadow-xl data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in"
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="font-semibold uppercase tracking-wider text-purple-400">
                {title}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                {mode === 'beginner' ? '· basic' : '· advanced'}
              </span>
            </div>
            <p className="text-zinc-300">{body}</p>
            <Tooltip.Arrow className="fill-zinc-700" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
