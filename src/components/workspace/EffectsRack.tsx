import { useRef, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { useEffectsStore } from '@/store/effectsStore'
import { usePresetStore } from '@/store/presetStore'
import { useEducationStore } from '@/store/educationStore'
import { EFFECT_DEFINITIONS, EffectType, type EffectInstance } from '@/types/effects'
import { FACTORY_PRESETS, type Preset } from '@/presets/factoryPresets'
import { getStatus } from '@/audio/engine'
import { PresetManager } from '@/components/workspace/PresetManager'
import { Gain } from '@/components/effects/Gain'
import { Compressor } from '@/components/effects/Compressor'
import { ParametricEQ } from '@/components/effects/ParametricEQ'
import { Gate } from '@/components/effects/Gate'
import { Limiter } from '@/components/effects/Limiter'
import { Delay } from '@/components/effects/Delay'
import { Reverb } from '@/components/effects/Reverb'
import { Saturation } from '@/components/effects/Saturation'
import { Chorus } from '@/components/effects/Chorus'
import { Flanger } from '@/components/effects/Flanger'
import { PitchShift } from '@/components/effects/PitchShift'
import { Phaser } from '@/components/effects/Phaser'
import { TransientShaper } from '@/components/effects/TransientShaper'
import { DeEsser } from '@/components/effects/DeEsser'
import { Expander } from '@/components/effects/Expander'
import { NoiseReduction } from '@/components/effects/NoiseReduction'

function renderEffect(instance: EffectInstance) {
  switch (instance.type) {
    case EffectType.Gain:            return <Gain instance={instance} />
    case EffectType.Compressor:      return <Compressor instance={instance} />
    case EffectType.ParametricEq:    return <ParametricEQ instance={instance} />
    case EffectType.Gate:            return <Gate instance={instance} />
    case EffectType.Limiter:         return <Limiter instance={instance} />
    case EffectType.Delay:           return <Delay instance={instance} />
    case EffectType.Reverb:          return <Reverb instance={instance} />
    case EffectType.Saturation:      return <Saturation instance={instance} />
    case EffectType.Chorus:          return <Chorus instance={instance} />
    case EffectType.Flanger:         return <Flanger instance={instance} />
    case EffectType.PitchShift:      return <PitchShift instance={instance} />
    case EffectType.Phaser:          return <Phaser instance={instance} />
    case EffectType.TransientShaper: return <TransientShaper instance={instance} />
    case EffectType.DeEsser:         return <DeEsser instance={instance} />
    case EffectType.Expander:        return <Expander instance={instance} />
    case EffectType.NoiseReduction:  return <NoiseReduction instance={instance} />
    default:                         return null
  }
}

const ALL_TYPES = Object.values(EFFECT_DEFINITIONS)
type Tab = 'chain' | 'presets'

export function EffectsRack() {
  const effects         = useEffectsStore((s) => s.effects)
  const addEffect       = useEffectsStore((s) => s.addEffect)
  const setParam        = useEffectsStore((s) => s.setParam)
  const setBypass       = useEffectsStore((s) => s.setBypass)
  const clearEffects    = useEffectsStore((s) => s.clear)
  const reorder         = useEffectsStore((s) => s.reorder)
  const globalBypass    = useEffectsStore((s) => s.globalBypass)
  const setGlobalBypass = useEffectsStore((s) => s.setGlobalBypass)
  const canUndo         = useEffectsStore((s) => s.canUndo)
  const clearActivePreset = usePresetStore((s) => s.setActivePresetId)
  const activePresetId  = usePresetStore((s) => s.activePresetId)
  const userPresets     = usePresetStore((s) => s.userPresets)
  const language        = useEducationStore((s) => s.language)
  const ro = language === 'ro'

  const [tab, setTab]     = useState<Tab>('chain')
  const [open, setOpen]   = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dragIndexRef       = useRef<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const lastPointerDownRef = useRef<EventTarget | null>(null)

  function handleDragStart(e: React.DragEvent, i: number) {
    const target = lastPointerDownRef.current as Element | null
    if (!target?.closest?.('[data-drag-handle]')) { e.preventDefault(); return }
    dragIndexRef.current = i
  }
  function handleDragOver(e: React.DragEvent, i: number) {
    e.preventDefault()
    if (dragIndexRef.current !== null && dragIndexRef.current !== i) setOverIndex(i)
  }
  function handleDrop(i: number) {
    const from = dragIndexRef.current
    if (from !== null && from !== i) { reorder(from, i); clearActivePreset(null) }
    dragIndexRef.current = null; setOverIndex(null)
  }
  function handleDragEnd() { dragIndexRef.current = null; setOverIndex(null) }

  function handleAdd(type: EffectType) {
    setError(null)
    try {
      if (getStatus().status !== 'running') {
        setError(ro
          ? 'Pornește engine-ul mai întâi (încarcă un fișier sau pornește Synth Lab).'
          : 'Start the engine first (load a file or start Synth Lab).')
        return
      }
      addEffect(type)
      clearActivePreset(null)
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  function loadPreset(preset: Preset) {
    setError(null)
    if (getStatus().status !== 'running') {
      setError(ro ? 'Pornește engine-ul mai întâi.' : 'Start the engine first.')
      return
    }
    try {
      clearEffects()
      for (const pe of preset.effects) {
        const instance = addEffect(pe.type)
        for (const [id, value] of Object.entries(pe.params)) setParam(instance.id, Number(id), value)
        if (pe.bypassed) setBypass(instance.id, true)
      }
      clearActivePreset(preset.id)
      setTab('chain')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const allPresets = [...FACTORY_PRESETS, ...userPresets]
  const hasEffects = effects.length > 0

  return (
    <div>
      {/* ── Tab bar ────────────────────────────────────────── */}
      <div className="mb-3 flex items-center justify-between border-b border-zinc-800 pb-0">
        <div className="flex items-center">
          {(['chain', 'presets'] as Tab[]).map((t) => (
            <button
              key={t}
              data-tour={t === 'presets' ? 'presets' : undefined}
              onClick={() => setTab(t)}
              className={`px-4 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-widest transition ${
                tab === t
                  ? 'border-b-2 border-purple-500 text-zinc-200'
                  : 'border-b-2 border-transparent text-zinc-600 hover:text-zinc-400'
              }`}
            >
              {t === 'chain'
                ? (ro ? 'Lanț efecte' : 'Effects Chain')
                : (ro ? 'Preseturi' : 'Presets')}
            </button>
          ))}
        </div>

        {/* Toolbar actions */}
        <div className="flex items-center gap-2 pb-1.5">
          {tab === 'chain' && (
            <>
              {canUndo() && (
                <span className="text-[9px] text-zinc-700" title={ro ? 'Ctrl+Z undo' : 'Ctrl+Z to undo'}>Ctrl+Z</span>
              )}
              {hasEffects && (
                <button
                  onClick={() => setGlobalBypass(!globalBypass)}
                  aria-pressed={globalBypass}
                  className={`flex items-center gap-1 rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider transition ${
                    globalBypass
                      ? 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-600/30'
                      : 'text-zinc-600 hover:text-zinc-400'
                  }`}
                >
                  <span className={`h-1 w-1 rounded-full ${globalBypass ? 'bg-amber-400' : 'bg-zinc-700'}`} />
                  {globalBypass ? (ro ? 'Original' : 'Original') : (ro ? 'Procesat' : 'Processed')}
                </button>
              )}
              {/* Add effect popover */}
              <Popover.Root open={open} onOpenChange={setOpen}>
                <Popover.Trigger asChild>
                  <button data-tour="add-effect" className="rounded border border-zinc-800 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 transition hover:border-zinc-700 hover:text-zinc-300">
                    {ro ? '+ Efect' : '+ Add Effect'}
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content
                    align="end"
                    sideOffset={6}
                    collisionPadding={12}
                    avoidCollisions
                    className="z-50 flex w-60 flex-col overflow-hidden rounded border border-zinc-800 bg-zinc-900 shadow-xl"
                    style={{ maxHeight: 'min(var(--radix-popover-content-available-height, 60vh), 60vh)' }}
                  >
                    <div className="shrink-0 border-b border-zinc-800 px-3 py-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                        {ro ? 'Adaugă efect' : 'Add effect'}
                      </p>
                    </div>
                    <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1" style={{ scrollbarGutter: 'stable' }}>
                      {ALL_TYPES.map((def) => (
                        <li key={def.type}>
                          <button
                            onClick={() => handleAdd(def.type)}
                            className="w-full rounded px-3 py-1.5 text-left transition hover:bg-zinc-800"
                          >
                            <div className="text-xs font-medium text-zinc-200">{def.label}</div>
                            <div className="text-[10px] text-zinc-600">{def.description}</div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            </>
          )}

          {tab === 'presets' && (
            <PresetManager />
          )}
        </div>
      </div>

      {error && (
        <p className="mb-2 rounded border border-red-800/40 bg-red-900/20 px-3 py-1.5 text-[11px] text-red-300">
          {error}
        </p>
      )}

      {/* ── Effects Chain tab ───────────────────────────────── */}
      {tab === 'chain' && (
        !hasEffects ? (
          /* Empty chain — signal flow */
          <div className="flex items-center gap-2 py-6">
            <span style={{ background: '#1a1a2e', border: '1px solid #7c3aed', borderRadius: 20, padding: '4px 12px', color: '#c4b5fd', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              INPUT
            </span>
            <div className="flex-1" style={{ borderTop: '1.5px dashed rgba(124,58,237,0.3)' }} />
            <div className="rounded-lg px-6 py-4 text-center" style={{ border: '1px dashed rgba(124,58,237,0.25)', background: 'rgba(124,58,237,0.03)', boxShadow: '0 0 20px rgba(124,58,237,0.1)' }}>
              <div className="mb-1 flex items-center justify-center">
                <span style={{ fontSize: 18, color: 'rgba(124,58,237,0.4)', lineHeight: 1 }}>+</span>
              </div>
              <p className="text-[11px] font-medium text-zinc-600">
                {ro ? 'Adaugă primul tău efect' : 'Add your first effect'}
              </p>
              <p className="mt-0.5 text-[10px] text-zinc-700">
                {ro ? 'Click pe butonul „+ Efect" din dreapta sus' : "Click '+ Add Effect' above"}
              </p>
            </div>
            <div className="flex-1" style={{ borderTop: '1.5px dashed rgba(124,58,237,0.3)' }} />
            <span style={{ background: '#1a1a2e', border: '1px solid #7c3aed', borderRadius: 20, padding: '4px 12px', color: '#c4b5fd', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              OUTPUT
            </span>
          </div>
        ) : (
          /* Populated chain */
          <div className={`transition-opacity duration-150 ${globalBypass ? 'opacity-40' : ''}`}>
            {/* IN label */}
            <div className="mb-1.5 flex items-center gap-2">
              <span style={{ background: '#1a1a2e', border: '1px solid #7c3aed', borderRadius: 20, padding: '4px 12px', color: '#c4b5fd', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                INPUT
              </span>
              <div className="flex-1" style={{ borderTop: '1.5px dashed rgba(124,58,237,0.3)' }} />
            </div>

            {/* Effect cards */}
            <div className="space-y-0.5">
              {effects.map((instance, i) => (
                <div
                  key={instance.id}
                  draggable
                  onPointerDown={(e) => { lastPointerDownRef.current = e.target }}
                  onDragStart={(e) => handleDragStart(e, i)}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDrop={() => handleDrop(i)}
                  onDragEnd={handleDragEnd}
                  className={`transition-all duration-100 ${
                    overIndex === i && dragIndexRef.current !== i
                      ? 'ring-1 ring-purple-500 ring-offset-1 ring-offset-zinc-950'
                      : ''
                  }`}
                >
                  {renderEffect(instance)}
                </div>
              ))}
            </div>

            {/* OUT label */}
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1" style={{ borderTop: '1.5px dashed rgba(124,58,237,0.3)' }} />
              <span style={{ background: '#1a1a2e', border: '1px solid #7c3aed', borderRadius: 20, padding: '4px 12px', color: '#c4b5fd', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                OUTPUT
              </span>
            </div>
          </div>
        )
      )}

      {/* ── Presets tab ─────────────────────────────────────── */}
      {tab === 'presets' && (
        <div className="space-y-0.5">
          {allPresets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => loadPreset(preset)}
              className={`flex w-full items-center justify-between rounded px-3 py-2 text-left transition ${
                activePresetId === preset.id
                  ? 'bg-purple-600/15 ring-1 ring-purple-500/20'
                  : 'hover:bg-zinc-800/60'
              }`}
            >
              <div className="min-w-0">
                <p className={`truncate text-[11px] font-medium ${activePresetId === preset.id ? 'text-purple-300' : 'text-zinc-300'}`}>
                  {preset.name[language]}
                </p>
                {preset.description[language] && (
                  <p className="truncate text-[10px] text-zinc-600">{preset.description[language]}</p>
                )}
              </div>
              {activePresetId === preset.id && (
                <svg className="ml-2 h-3 w-3 shrink-0 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
