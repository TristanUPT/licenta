import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { useEffectsStore } from '@/store/effectsStore'
import { EFFECT_DEFINITIONS, EffectType, type EffectInstance } from '@/types/effects'
import { getStatus } from '@/audio/engine'
import { Gain } from '@/components/effects/Gain'
import { Compressor } from '@/components/effects/Compressor'
import { ParametricEQ } from '@/components/effects/ParametricEQ'

function renderEffect(instance: EffectInstance) {
  switch (instance.type) {
    case EffectType.Gain:
      return <Gain key={instance.id} instance={instance} />
    case EffectType.Compressor:
      return <Compressor key={instance.id} instance={instance} />
    case EffectType.ParametricEq:
      return <ParametricEQ key={instance.id} instance={instance} />
    default:
      return null
  }
}

const ALL_TYPES = Object.values(EFFECT_DEFINITIONS)

export function EffectsRack() {
  const effects = useEffectsStore((s) => s.effects)
  const addEffect = useEffectsStore((s) => s.addEffect)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleAdd(type: EffectType) {
    setError(null)
    try {
      if (getStatus().status !== 'running') {
        setError('Pornește engine-ul (drag un fișier audio mai întâi).')
        return
      }
      addEffect(type)
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Effects chain
        </h2>
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger asChild>
            <button className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-purple-500">
              + Add effect
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="end"
              sideOffset={6}
              className="z-50 w-72 rounded-xl border border-zinc-800 bg-zinc-900 p-2 shadow-xl"
            >
              <ul className="space-y-1">
                {ALL_TYPES.map((def) => (
                  <li key={def.type}>
                    <button
                      onClick={() => handleAdd(def.type)}
                      className="w-full rounded-md px-3 py-2 text-left transition hover:bg-zinc-800"
                    >
                      <div className="text-sm font-medium text-zinc-100">{def.label}</div>
                      <div className="text-xs text-zinc-500">{def.description}</div>
                    </button>
                  </li>
                ))}
              </ul>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>

      {error && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      {effects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-6 text-center text-xs text-zinc-500">
          Niciun efect activ. Adaugă unul pentru a începe să modifici sunetul.
        </div>
      ) : (
        <div className="space-y-3">
          {effects.map(renderEffect)}
        </div>
      )}
    </section>
  )
}
