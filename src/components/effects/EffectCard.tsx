import { type ReactNode } from 'react'
import { useEffectsStore } from '@/store/effectsStore'
import { useEducationStore } from '@/store/educationStore'
import { EFFECT_DEFINITIONS, EffectType, type EffectInstance } from '@/types/effects'
import { EFFECT_DOCS, pickText, pickTitle } from '@/education/effectDescriptions'

interface EffectCardProps {
  instance: EffectInstance
  children: ReactNode
}

// Each category gets a distinct accent colour shown as a left border.
const EFFECT_COLOR: Record<EffectType, string> = {
  [EffectType.Gain]:            'border-l-purple-500',
  [EffectType.Compressor]:      'border-l-amber-500',
  [EffectType.ParametricEq]:    'border-l-emerald-500',
  [EffectType.Gate]:            'border-l-amber-500',
  [EffectType.Limiter]:         'border-l-amber-500',
  [EffectType.Delay]:           'border-l-sky-500',
  [EffectType.Reverb]:          'border-l-sky-500',
  [EffectType.Saturation]:      'border-l-rose-500',
  [EffectType.Chorus]:          'border-l-violet-500',
  [EffectType.Flanger]:         'border-l-violet-500',
  [EffectType.PitchShift]:      'border-l-purple-500',
  [EffectType.Phaser]:          'border-l-violet-500',
  [EffectType.TransientShaper]: 'border-l-amber-500',
}

export function EffectCard({ instance, children }: EffectCardProps) {
  const setBypass    = useEffectsStore((s) => s.setBypass)
  const removeEffect = useEffectsStore((s) => s.removeEffect)
  const language     = useEducationStore((s) => s.language)
  const mode         = useEducationStore((s) => s.mode)

  const definition = EFFECT_DEFINITIONS[instance.type]
  const docs       = EFFECT_DOCS[instance.type]
  const title   = docs ? pickTitle(docs.title, language) : definition.label
  const summary = docs ? pickText(docs.summary, language, mode) : definition.description

  const accentColor = EFFECT_COLOR[instance.type]

  return (
    <div
      className={`rounded-xl border border-l-2 bg-zinc-900 p-4 transition ${accentColor} ${
        instance.bypassed
          ? 'border-zinc-800 opacity-50'
          : 'border-zinc-700 shadow-md shadow-purple-500/5'
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span
            data-drag-handle
            className="mt-0.5 cursor-grab select-none text-base leading-none text-zinc-600 hover:text-zinc-400"
            title="Drag to reorder"
            aria-hidden
          >
            ⠿
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
            <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">{summary}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => setBypass(instance.id, !instance.bypassed)}
            aria-pressed={instance.bypassed}
            title={instance.bypassed ? 'Re-enable effect' : 'Bypass'}
            className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition ${
              instance.bypassed
                ? 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
                : 'bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30'
            }`}
          >
            {instance.bypassed ? 'off' : 'on'}
          </button>
          <button
            onClick={() => removeEffect(instance.id)}
            title="Remove effect"
            className="rounded-md px-2 py-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-red-400"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-start gap-5 px-1">{children}</div>
    </div>
  )
}
