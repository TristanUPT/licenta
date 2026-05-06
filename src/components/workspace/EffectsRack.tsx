import { useRef, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { useEffectsStore } from '@/store/effectsStore'
import { EFFECT_DEFINITIONS, EffectType, type EffectInstance } from '@/types/effects'
import { getStatus } from '@/audio/engine'
import { Gain } from '@/components/effects/Gain'
import { Compressor } from '@/components/effects/Compressor'
import { ParametricEQ } from '@/components/effects/ParametricEQ'
import { Gate } from '@/components/effects/Gate'
import { Limiter } from '@/components/effects/Limiter'
import { Delay } from '@/components/effects/Delay'
import { Reverb } from '@/components/effects/Reverb'
import { Saturation } from '@/components/effects/Saturation'

function renderEffect(instance: EffectInstance) {
  switch (instance.type) {
    case EffectType.Gain:         return <Gain instance={instance} />
    case EffectType.Compressor:   return <Compressor instance={instance} />
    case EffectType.ParametricEq: return <ParametricEQ instance={instance} />
    case EffectType.Gate:         return <Gate instance={instance} />
    case EffectType.Limiter:      return <Limiter instance={instance} />
    case EffectType.Delay:        return <Delay instance={instance} />
    case EffectType.Reverb:       return <Reverb instance={instance} />
    case EffectType.Saturation:   return <Saturation instance={instance} />
    default:                      return null
  }
}

const ALL_TYPES = Object.values(EFFECT_DEFINITIONS)

export function EffectsRack() {
  const effects = useEffectsStore((s) => s.effects)
  const addEffect = useEffectsStore((s) => s.addEffect)
  const reorder = useEffectsStore((s) => s.reorder)

  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Drag-to-reorder state.
  const dragIndexRef = useRef<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  // Tracks where pointerdown occurred so we can restrict drag to the handle.
  const lastPointerDownRef = useRef<EventTarget | null>(null)

  function handleDragStart(e: React.DragEvent, i: number) {
    const target = lastPointerDownRef.current as Element | null
    if (!target?.closest?.('[data-drag-handle]')) {
      e.preventDefault()
      return
    }
    dragIndexRef.current = i
  }

  function handleDragOver(e: React.DragEvent, i: number) {
    e.preventDefault()
    if (dragIndexRef.current !== null && dragIndexRef.current !== i) {
      setOverIndex(i)
    }
  }

  function handleDrop(i: number) {
    const from = dragIndexRef.current
    if (from !== null && from !== i) reorder(from, i)
    dragIndexRef.current = null
    setOverIndex(null)
  }

  function handleDragEnd() {
    dragIndexRef.current = null
    setOverIndex(null)
  }

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
              collisionPadding={12}
              avoidCollisions
              className="z-50 flex w-72 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl"
              style={{
                maxHeight: 'min(var(--radix-popover-content-available-height, 60vh), 60vh)',
              }}
            >
              <div className="shrink-0 border-b border-zinc-800 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Add effect
                </p>
              </div>
              <ul
                className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-2"
                style={{ scrollbarGutter: 'stable' }}
              >
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
          {effects.map((instance, i) => (
            <div
              key={instance.id}
              draggable
              onPointerDown={(e) => { lastPointerDownRef.current = e.target }}
              onDragStart={(e) => handleDragStart(e, i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={() => handleDrop(i)}
              onDragEnd={handleDragEnd}
              className={`rounded-xl transition-all duration-150 ${
                overIndex === i && dragIndexRef.current !== i
                  ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-zinc-950'
                  : ''
              }`}
            >
              {renderEffect(instance)}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
