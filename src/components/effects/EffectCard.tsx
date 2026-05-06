import { type ReactNode } from 'react'
import { useEffectsStore } from '@/store/effectsStore'
import { EFFECT_DEFINITIONS, type EffectInstance } from '@/types/effects'

interface EffectCardProps {
  instance: EffectInstance
  children: ReactNode
}

export function EffectCard({ instance, children }: EffectCardProps) {
  const setBypass = useEffectsStore((s) => s.setBypass)
  const removeEffect = useEffectsStore((s) => s.removeEffect)
  const definition = EFFECT_DEFINITIONS[instance.type]

  return (
    <div
      className={`rounded-xl border bg-zinc-900 p-4 transition ${
        instance.bypassed
          ? 'border-zinc-800 opacity-50'
          : 'border-zinc-700 shadow-md shadow-purple-500/5'
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            data-drag-handle
            className="cursor-grab select-none text-base leading-none text-zinc-600 hover:text-zinc-400"
            title="Drag to reorder"
            aria-hidden
          >
            ⠿
          </span>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">{definition.label}</h3>
            <p className="text-[11px] text-zinc-500">{definition.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
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
