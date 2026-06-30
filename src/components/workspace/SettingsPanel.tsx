import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useEducationStore } from '@/store/educationStore'
import { usePresetStore } from '@/store/presetStore'
import { useEffectsStore } from '@/store/effectsStore'
import { useUiStore } from '@/store/uiStore'
import { useAudioStore } from '@/store/audioStore'
import * as transport from '@/audio/transport'

const ONBOARDING_KEY = 'resolab-onboarding-done'

export function SettingsPanel() {
  const [open, setOpen] = useState(false)
  const [confirmClear, setConfirmClear] = useState<'presets' | 'chain' | null>(null)

  const language    = useEducationStore((s) => s.language)
  const mode        = useEducationStore((s) => s.mode)
  const setLanguage = useEducationStore((s) => s.setLanguage)
  const setMode     = useEducationStore((s) => s.setMode)

  const userPresets      = usePresetStore((s) => s.userPresets)
  const deleteUserPreset = usePresetStore((s) => s.deleteUserPreset)
  const setActivePreset  = usePresetStore((s) => s.setActivePresetId)

  const clearChain = useEffectsStore((s) => s.clear)

  const clearFile  = useAudioStore((s) => s.clearFile)

  const showWaveform      = useUiStore((s) => s.showWaveform)
  const showVisualizer    = useUiStore((s) => s.showVisualizer)
  const showEducation     = useUiStore((s) => s.showEducation)
  const showLessons       = useUiStore((s) => s.showLessons)
  const theme             = useUiStore((s) => s.theme)
  const toggleVisualizer  = useUiStore((s) => s.toggleVisualizer)
  const toggleEducation   = useUiStore((s) => s.toggleEducation)
  const toggleLessons     = useUiStore((s) => s.toggleLessons)
  const toggleWaveform    = useUiStore((s) => s.toggleWaveform)
  const setTheme          = useUiStore((s) => s.setTheme)

  const ro = language === 'ro'

  async function handleClearPresets() {
    for (const p of userPresets) await deleteUserPreset(p.id)
    setActivePreset(null)
    setConfirmClear(null)
  }

  function handleClearChain() {
    clearChain()
    setActivePreset(null)
    setConfirmClear(null)
  }

  function handleResetOnboarding() {
    localStorage.removeItem(ONBOARDING_KEY)
    setOpen(false)
    window.location.reload()
  }

  function handleResetAll() {
    transport.stop()
    clearFile()
    clearChain()
    setActivePreset(null)
    localStorage.clear()
    window.location.reload()
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          title={ro ? 'Setări' : 'Settings'}
          aria-label={ro ? 'Setări' : 'Settings'}
          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
          <Dialog.Title className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
            {ro ? 'Setări' : 'Settings'}
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            {ro ? 'Preferințe aplicație ResoLab' : 'ResoLab application preferences'}
          </Dialog.Description>

          <div className="mt-4 space-y-5">

            {/* ── Theme ── */}
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {ro ? 'Temă' : 'Theme'}
              </p>
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="flex w-full items-center justify-between rounded-lg border border-zinc-700 px-3 py-2 text-xs transition hover:border-zinc-600"
                aria-label={ro ? 'Comută tema' : 'Toggle theme'}
              >
                <span className="flex items-center gap-2 text-zinc-300">
                  <span>{theme === 'dark' ? '🌙' : '☀️'}</span>
                  <span>{theme === 'dark' ? (ro ? 'Mod întunecat' : 'Dark mode') : (ro ? 'Mod luminos' : 'Light mode')}</span>
                </span>
                {/* Animated toggle */}
                <span
                  className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${
                    theme === 'light' ? 'bg-purple-600' : 'bg-zinc-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform duration-200 ${
                      theme === 'light' ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </span>
              </button>
            </div>

            {/* ── Language ── */}
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {ro ? 'Limbă' : 'Language'}
              </p>
              <div className="flex gap-2">
                {(['ro', 'en'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    className={`flex-1 rounded-lg border py-2 text-xs font-semibold uppercase transition ${
                      language === lang
                        ? 'border-purple-500/60 bg-purple-600/20 text-purple-200'
                        : 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                    }`}
                  >
                    {lang === 'ro' ? '🇷🇴 Română' : '🇬🇧 English'}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Mode ── */}
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {ro ? 'Nivel explicații' : 'Explanation level'}
              </p>
              <div className="flex gap-2">
                {(['beginner', 'advanced'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition ${
                      mode === m
                        ? 'border-purple-500/60 bg-purple-600/20 text-purple-200'
                        : 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                    }`}
                  >
                    {m === 'beginner'
                      ? (ro ? 'Începător' : 'Beginner')
                      : (ro ? 'Avansat' : 'Advanced')}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Panel visibility ── */}
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {ro ? 'Panouri vizibile' : 'Visible panels'}
              </p>
              <div className="space-y-1">
                {[
                  { label: ro ? 'Waveform' : 'Waveform',       active: showWaveform,   toggle: toggleWaveform },
                  { label: ro ? 'Vizualizări' : 'Visualizers', active: showVisualizer, toggle: toggleVisualizer },
                  { label: ro ? 'Educație' : 'Education',      active: showEducation,  toggle: toggleEducation },
                  { label: ro ? 'Lecții' : 'Lessons',          active: showLessons,    toggle: toggleLessons },
                ].map(({ label, active, toggle }) => (
                  <button
                    key={label}
                    onClick={toggle}
                    className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs transition hover:bg-zinc-800"
                  >
                    <span className={active ? 'text-zinc-200' : 'text-zinc-500'}>{label}</span>
                    <span className={`h-2 w-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
                  </button>
                ))}
              </div>
            </div>

            {/* ── Reset actions ── */}
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {ro ? 'Resetare' : 'Reset'}
              </p>
              <div className="space-y-1.5">

                {/* Replay onboarding */}
                <button
                  onClick={handleResetOnboarding}
                  className="w-full rounded-md border border-zinc-700 px-3 py-1.5 text-left text-xs text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
                >
                  {ro ? 'Reafișează tutorialul de onboarding' : 'Replay the onboarding tutorial'}
                </button>

                {/* Clear chain */}
                {confirmClear === 'chain' ? (
                  <div className="flex gap-1.5">
                    <button onClick={handleClearChain} className="flex-1 rounded-md bg-red-600/80 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-500">
                      {ro ? 'Confirmă' : 'Confirm'}
                    </button>
                    <button onClick={() => setConfirmClear(null)} className="flex-1 rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200">
                      {ro ? 'Anulează' : 'Cancel'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmClear('chain')}
                    className="w-full rounded-md border border-zinc-700 px-3 py-1.5 text-left text-xs text-zinc-400 transition hover:border-red-500/50 hover:text-red-400"
                  >
                    {ro ? 'Șterge lanțul de efecte curent' : 'Clear the current effects chain'}
                  </button>
                )}

                {/* Clear user presets */}
                {userPresets.length > 0 && (
                  confirmClear === 'presets' ? (
                    <div className="flex gap-1.5">
                      <button onClick={() => void handleClearPresets()} className="flex-1 rounded-md bg-red-600/80 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-500">
                        {ro ? 'Confirmă' : 'Confirm'}
                      </button>
                      <button onClick={() => setConfirmClear(null)} className="flex-1 rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200">
                        {ro ? 'Anulează' : 'Cancel'}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmClear('presets')}
                      className="w-full rounded-md border border-zinc-700 px-3 py-1.5 text-left text-xs text-zinc-400 transition hover:border-red-500/50 hover:text-red-400"
                    >
                      {ro ? `Șterge toate preseturile salvate (${userPresets.length})` : `Delete all saved presets (${userPresets.length})`}
                    </button>
                  )
                )}

                {/* Full reset */}
                <button
                  onClick={handleResetAll}
                  className="w-full rounded-md border border-red-900/50 px-3 py-1.5 text-left text-xs text-red-500/70 transition hover:border-red-500/60 hover:text-red-400"
                >
                  {ro ? 'Resetează totul și reîncarcă pagina' : 'Reset everything and reload page'}
                </button>
              </div>
            </div>

          </div>

          <Dialog.Close asChild>
            <button
              className="absolute right-4 top-4 text-zinc-500 transition hover:text-zinc-200"
              aria-label="Close"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
