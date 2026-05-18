import { useRef, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { useEffectsStore } from '@/store/effectsStore'
import { usePresetStore } from '@/store/presetStore'
import { useEducationStore } from '@/store/educationStore'
import { FACTORY_PRESETS, type Preset } from '@/presets/factoryPresets'
import { putUserPreset } from '@/audio/db'
import { getStatus } from '@/audio/engine'
import type { EducationLanguage, EducationMode } from '@/store/educationStore'

export function PresetManager() {
  const effects            = useEffectsStore((s) => s.effects)
  const addEffect          = useEffectsStore((s) => s.addEffect)
  const setParam           = useEffectsStore((s) => s.setParam)
  const setBypass          = useEffectsStore((s) => s.setBypass)
  const clear              = useEffectsStore((s) => s.clear)
  const activePresetId     = usePresetStore((s) => s.activePresetId)
  const setActivePreset    = usePresetStore((s) => s.setActivePresetId)
  const userPresets        = usePresetStore((s) => s.userPresets)
  const saveCurrentPreset  = usePresetStore((s) => s.saveCurrentAsUserPreset)
  const deleteUserPreset   = usePresetStore((s) => s.deleteUserPreset)
  const language           = useEducationStore((s) => s.language)

  const [open, setOpen]         = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [saving, setSaving]     = useState(false)
  const [saveName, setSaveName] = useState('')
  const nameInputRef            = useRef<HTMLInputElement>(null)
  const importInputRef          = useRef<HTMLInputElement>(null)

  const mode = useEducationStore((s) => s.mode)

  const activePreset = [...FACTORY_PRESETS, ...userPresets].find(
    (p) => p.id === activePresetId,
  )

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
        if (pe.bypassed) setBypass(instance.id, true)
      }
      setActivePreset(preset.id)
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleSave() {
    const name = saveName.trim()
    if (!name) return
    setError(null)
    try {
      await saveCurrentPreset(name, effects)
      setSaving(false)
      setSaveName('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await deleteUserPreset(id)
    } catch {
      // silently ignore
    }
  }

  function handleExportChain() {
    if (effects.length === 0) return
    const preset: Preset = {
      id: `export:${Date.now()}`,
      category: 'user',
      name: { ro: activePreset?.name.ro ?? 'Export', en: activePreset?.name.en ?? 'Export' },
      description: { ro: '', en: '' },
      effects: effects.map((e) => ({ type: e.type, bypassed: e.bypassed, params: { ...e.params } })),
    }
    const json = JSON.stringify(preset, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${(preset.name.en).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.soundlab.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setError(null)
    try {
      const text = await file.text()
      const raw = JSON.parse(text) as Record<string, unknown>
      if (!Array.isArray(raw['effects'])) throw new Error('Invalid preset file.')
      const imported: Preset = {
        id: `user:${Date.now()}`,
        category: 'user',
        name: typeof raw['name'] === 'object' && raw['name'] !== null
          ? raw['name'] as { ro: string; en: string }
          : { ro: file.name.replace(/\.soundlab\.json$/, ''), en: file.name.replace(/\.soundlab\.json$/, '') },
        description: { ro: '', en: '' },
        effects: (raw['effects'] as Preset['effects']).map((ef) => ({
          type: ef.type,
          bypassed: ef.bypassed ?? false,
          params: ef.params ?? {},
        })),
      }
      await putUserPreset(imported)
      setActivePreset(imported.id)
      // Force reload from DB so the UI reflects the import.
      const { loadUserPresetsFromDB } = usePresetStore.getState()
      await loadUserPresetsFromDB()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.')
    }
  }

  const exportLabel  = language === 'ro' ? 'Exportă chain' : 'Export chain'
  const importLabel  = language === 'ro' ? 'Importă preset' : 'Import preset'
  const triggerLabel = language === 'ro' ? 'Preseturi' : 'Presets'
  const activeLabel  = activePreset?.name[language]

  const saveLabel    = language === 'ro' ? 'Salvează chain-ul curent' : 'Save current chain'
  const saveConfirm  = language === 'ro' ? 'Salvează' : 'Save'
  const saveCancel   = language === 'ro' ? 'Anulează' : 'Cancel'
  const namePlaceholder = language === 'ro' ? 'Nume preset…' : 'Preset name…'
  const factoryTitle = language === 'ro' ? 'Preseturi fabrică' : 'Factory presets'
  const userTitle    = language === 'ro' ? 'Preseturile tale' : 'Your presets'
  const emptyUser    = language === 'ro'
    ? 'Niciun preset salvat încă.'
    : 'No saved presets yet.'

  return (
    <Popover.Root
      open={open}
      onOpenChange={(v) => { setOpen(v); if (!v) { setSaving(false); setSaveName('') } }}
    >
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
          style={{ maxHeight: 'min(var(--radix-popover-content-available-height, 70vh), 70vh)' }}
        >
          {/* Error banner */}
          {error && (
            <p className="shrink-0 border-b border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
              {error}
            </p>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {/* ── Factory presets ── */}
            <div className="border-b border-zinc-800 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {factoryTitle}
              </p>
            </div>
            <ul className="space-y-1 p-2">
              {FACTORY_PRESETS.map((preset) => (
                <PresetRow
                  key={preset.id}
                  preset={preset}
                  language={language}
                  mode={mode}
                  isActive={preset.id === activePresetId}
                  onLoad={() => handleLoad(preset)}
                />
              ))}
            </ul>

            {/* ── User presets ── */}
            <div className="border-y border-zinc-800 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {userTitle}
              </p>
            </div>
            <ul className="space-y-1 p-2">
              {userPresets.length === 0 ? (
                <li className="px-2 py-2 text-[11px] text-zinc-600">{emptyUser}</li>
              ) : (
                userPresets.map((preset) => (
                  <PresetRow
                    key={preset.id}
                    preset={preset}
                    language={language}
                    mode={mode}
                    isActive={preset.id === activePresetId}
                    onLoad={() => handleLoad(preset)}
                    onDelete={(e) => handleDelete(preset.id, e)}
                  />
                ))
              )}
            </ul>
          </div>

          {/* ── Export / Import ── */}
          <div className="shrink-0 flex items-center gap-1.5 border-t border-zinc-800 px-2 py-2">
            <button
              onClick={handleExportChain}
              disabled={effects.length === 0}
              title={exportLabel}
              className="flex flex-1 items-center justify-center gap-1 rounded-md border border-zinc-700 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 transition hover:border-purple-500/50 hover:text-purple-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {exportLabel}
            </button>
            <button
              onClick={() => importInputRef.current?.click()}
              title={importLabel}
              className="flex flex-1 items-center justify-center gap-1 rounded-md border border-zinc-700 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 transition hover:border-purple-500/50 hover:text-purple-300"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12" />
              </svg>
              {importLabel}
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".json,.soundlab.json"
              className="hidden"
              onChange={(e) => void handleImportFile(e)}
            />
          </div>

          {/* ── Save current chain ── */}
          <div className="shrink-0 border-t border-zinc-800 p-2">
            {saving ? (
              <div className="flex items-center gap-1.5">
                <input
                  ref={nameInputRef}
                  autoFocus
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleSave(); if (e.key === 'Escape') { setSaving(false); setSaveName('') } }}
                  placeholder={namePlaceholder}
                  className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-[11px] text-zinc-100 placeholder:text-zinc-600 focus:border-purple-500 focus:outline-none"
                />
                <button
                  onClick={() => void handleSave()}
                  disabled={!saveName.trim()}
                  className="rounded-md bg-purple-600 px-2.5 py-1.5 text-[11px] font-medium text-white transition hover:bg-purple-500 disabled:opacity-40"
                >
                  {saveConfirm}
                </button>
                <button
                  onClick={() => { setSaving(false); setSaveName('') }}
                  className="rounded-md px-2 py-1.5 text-[11px] text-zinc-400 transition hover:text-zinc-200"
                >
                  {saveCancel}
                </button>
              </div>
            ) : (
              <button
                onClick={() => { if (effects.length > 0) setSaving(true) }}
                disabled={effects.length === 0}
                className="w-full rounded-md border border-dashed border-zinc-700 py-1.5 text-[11px] text-zinc-500 transition hover:border-purple-500/50 hover:text-purple-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                + {saveLabel}
              </button>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

// ─── Sub-component ────────────────────────────────────────────────────────────

interface PresetRowProps {
  preset: Preset
  language: EducationLanguage
  mode: EducationMode
  isActive: boolean
  onLoad: () => void
  onDelete?: (e: React.MouseEvent) => void
}

function PresetRow({ preset, language, mode, isActive, onLoad, onDelete }: PresetRowProps) {
  const [showRationale, setShowRationale] = useState(false)
  const hasRationale = !!preset.rationale

  const whyLabel = language === 'ro' ? 'De ce funcționează?' : 'Why does it work?'

  return (
    <li>
      <div className={`group rounded-md transition ${isActive ? 'bg-purple-600/20 ring-1 ring-purple-500/30' : 'hover:bg-zinc-800'}`}>
        <button
          onClick={onLoad}
          className="w-full px-3 py-2 text-left"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-zinc-100">
              {preset.name[language]}
            </span>
            <div className="flex shrink-0 items-center gap-1">
              {isActive && (
                <svg className="h-3.5 w-3.5 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
              {onDelete && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={onDelete}
                  onKeyDown={(e) => e.key === 'Enter' && onDelete(e as unknown as React.MouseEvent)}
                  className="flex h-4 w-4 items-center justify-center rounded text-zinc-600 opacity-0 transition hover:bg-red-500/20 hover:text-red-400 group-hover:opacity-100"
                  aria-label="Delete preset"
                >
                  ×
                </span>
              )}
            </div>
          </div>
          {preset.description[language] && (
            <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">
              {preset.description[language]}
            </p>
          )}
        </button>

        {/* "Why does it work?" toggle — factory presets only */}
        {hasRationale && (
          <div className="px-3 pb-2">
            <button
              onClick={(e) => { e.stopPropagation(); setShowRationale((v) => !v) }}
              className="flex items-center gap-1 text-[10px] text-purple-400 transition hover:text-purple-300"
            >
              <svg
                className={`h-2.5 w-2.5 transition-transform ${showRationale ? 'rotate-90' : ''}`}
                fill="currentColor"
                viewBox="0 0 8 8"
              >
                <polygon points="0,0 8,4 0,8" />
              </svg>
              {whyLabel}
            </button>
            {showRationale && preset.rationale && (
              <p className="mt-1.5 rounded-lg bg-purple-500/10 px-2.5 py-2 text-[11px] leading-relaxed text-purple-200">
                {preset.rationale[language][mode]}
              </p>
            )}
          </div>
        )}
      </div>
    </li>
  )
}
