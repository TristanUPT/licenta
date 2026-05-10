import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { useEffectsStore } from '@/store/effectsStore'
import { usePresetStore } from '@/store/presetStore'
import { useEducationStore } from '@/store/educationStore'
import { FACTORY_PRESETS, type Preset } from '@/presets/factoryPresets'
import { getStatus } from '@/audio/engine'

export function PresetManager() {
  const addEffect       = useEffectsStore((s) => s.addEffect)
  const setParam        = useEffectsStore((s) => s.setParam)
  const clear           = useEffectsStore((s) => s.clear)
  const activePresetId  = usePresetStore((s) => s.activePresetId)
  const setActivePreset = usePresetStore((s) => s.setActivePresetId)
  const language        = useEducationStore((s) => s.language)

  const [open, setOpen]   = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activePreset = FACTORY_PRESETS.find((p) => p.id === activePresetId)

  function handleLoad(preset: Preset) {
    setError(null)
    if (getStatus().status !== 'running') {
      setError(
        language === 'ro'
          ? 'Pornește engine-ul mai întâi (drag un fișier audio).'
          : 'Start the engine first (drag an audio file).',
      )
      return
    }
    try {
      clear()
      for (const pe of preset.effects) {
        const instance = addEffect(pe.type)
        for (const [rawId, value] of Object.entries(pe.params)) {
          setParam(instance.id, Number(rawId), value)
        }
      }
      setActivePreset(preset.id)
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const triggerLabel = language === 'ro' ? 'Preseturi' : 'Presets'
  const activeLabel  = activePreset?.name[language]

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition ${
            activePreset
              ? 'bg-purple-600/20 text-purple-300 ring-1 ring-purple-500/40 hover:bg-purple-600/30'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
          }`}
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10M4 18h6" />
          </svg>
          {activeLabel ?? triggerLabel}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          avoidCollisions
          className="z-50 flex w-80 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl"
          style={{ maxHeight: 'min(var(--radix-popover-content-available-height, 60vh), 60vh)' }}
        >
          <div className="shrink-0 border-b border-zinc-800 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {language === 'ro' ? 'Preseturi fabrică' : 'Factory presets'}
            </p>
          </div>

          {error && (
            <p className="shrink-0 border-b border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
              {error}
            </p>
          )}

          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-2">
            {FACTORY_PRESETS.map((preset) => {
              const isActive = preset.id === activePresetId
              return (
                <li key={preset.id}>
                  <button
                    onClick={() => handleLoad(preset)}
                    className={`w-full rounded-md px-3 py-2 text-left transition ${
                      isActive
                        ? 'bg-purple-600/20 ring-1 ring-purple-500/30'
                        : 'hover:bg-zinc-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-zinc-100">
                        {preset.name[language]}
                      </span>
                      {isActive && (
                        <svg className="h-3.5 w-3.5 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">
                      {preset.description[language]}
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
