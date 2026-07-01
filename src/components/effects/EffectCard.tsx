import { type ReactNode } from 'react'
import { useEffectsStore } from '@/store/effectsStore'
import { useEducationStore } from '@/store/educationStore'
import { EFFECT_DEFINITIONS, EffectType, type EffectInstance } from '@/types/effects'
import { EFFECT_DOCS, pickTitle } from '@/education/effectDescriptions'

interface EffectCardProps {
  instance: EffectInstance
  children: ReactNode
}

const EFFECT_COLOR: Record<EffectType, string> = {
  [EffectType.Gain]:            'border-l-zinc-500',
  [EffectType.Compressor]:      'border-l-amber-600',
  [EffectType.ParametricEq]:    'border-l-emerald-600',
  [EffectType.Gate]:            'border-l-amber-600',
  [EffectType.Limiter]:         'border-l-amber-600',
  [EffectType.Delay]:           'border-l-sky-600',
  [EffectType.Reverb]:          'border-l-sky-600',
  [EffectType.Saturation]:      'border-l-rose-600',
  [EffectType.Chorus]:          'border-l-violet-600',
  [EffectType.Flanger]:         'border-l-violet-600',
  [EffectType.PitchShift]:      'border-l-purple-600',
  [EffectType.Phaser]:          'border-l-violet-600',
  [EffectType.TransientShaper]: 'border-l-amber-600',
  [EffectType.DeEsser]:         'border-l-amber-600',
  [EffectType.Expander]:        'border-l-amber-600',
  [EffectType.NoiseReduction]:  'border-l-teal-600',
}

export function EffectCard({ instance, children }: EffectCardProps) {
  const setBypass    = useEffectsStore((s) => s.setBypass)
  const removeEffect = useEffectsStore((s) => s.removeEffect)
  const language     = useEducationStore((s) => s.language)

  const definition = EFFECT_DEFINITIONS[instance.type]
  const docs       = EFFECT_DOCS[instance.type]
  const title      = docs ? pickTitle(docs.title, language) : definition.label

  return (
    <div
      className={`rounded border border-l-2 bg-zinc-900 transition-opacity ${EFFECT_COLOR[instance.type]} ${
        instance.bypassed ? 'border-zinc-800 opacity-40' : 'border-zinc-800'
      }`}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 px-2 py-1.5">
        <span
          data-drag-handle
          className="cursor-grab select-none text-sm leading-none text-zinc-700 hover:text-zinc-500"
          title={language === 'ro' ? 'Trage pentru reordonare' : 'Drag to reorder'}
          aria-hidden
        >
          ⠿
        </span>
        <span className="min-w-0 truncate text-xs font-semibold text-zinc-300">{title}</span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button
            onClick={() => setBypass(instance.id, !instance.bypassed)}
            aria-pressed={instance.bypassed}
            title={instance.bypassed
              ? (language === 'ro' ? 'Reactivează' : 'Enable')
              : (language === 'ro' ? 'Bypass' : 'Bypass')}
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider transition ${
              instance.bypassed
                ? 'text-zinc-600 hover:text-zinc-400'
                : 'text-emerald-500 hover:text-emerald-400'
            }`}
          >
            <span className={`h-1 w-1 rounded-full ${instance.bypassed ? 'bg-zinc-700' : 'bg-emerald-500'}`} />
            {instance.bypassed ? 'off' : 'on'}
          </button>
          <button
            onClick={() => removeEffect(instance.id)}
            title={language === 'ro' ? 'Șterge efectul (Ctrl+Z undo)' : 'Remove effect (Ctrl+Z to undo)'}
            className="rounded px-1.5 py-0.5 text-[11px] text-zinc-700 transition hover:text-red-400"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex min-w-0 flex-wrap items-start gap-4 border-t border-zinc-800/50 px-3 pb-2.5 pt-2">
        {children}
      </div>
    </div>
  )
}
