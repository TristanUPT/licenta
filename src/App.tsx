import { useEffect, useState } from 'react'
import * as Switch from '@radix-ui/react-switch'
import { getStatus, subscribe, type EngineStatus } from '@/audio/engine'
import { useAudioStore } from '@/store/audioStore'
import { useEducationStore } from '@/store/educationStore'
import { usePresetStore } from '@/store/presetStore'
import { useUiStore } from '@/store/uiStore'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { KeyboardHint } from '@/components/workspace/KeyboardHint'
import { FileDropZone } from '@/components/workspace/FileDropZone'
import { TransportBar } from '@/components/workspace/TransportBar'
import { WaveformView } from '@/components/visualization/WaveformView'
import { VisualizerPanel } from '@/components/visualization/VisualizerPanel'
import { EffectsRack } from '@/components/workspace/EffectsRack'
import { InfoPanel } from '@/components/education/InfoPanel'
import { RecommendationsPanel } from '@/components/education/RecommendationsPanel'

const STATUS_DOT: Record<EngineStatus, string> = {
  idle: 'bg-zinc-500',
  starting: 'bg-amber-400',
  running: 'bg-emerald-500',
  error: 'bg-red-500',
}

interface PanelToggleProps {
  label: string
  active: boolean
  onClick: () => void
}

function PanelToggle({ label, active, onClick }: PanelToggleProps) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition ${
        active ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'
      }`}
    >
      {label}
    </button>
  )
}

function App() {
  const [status, setStatus] = useState<EngineStatus>(getStatus().status)
  useEffect(() => subscribe((s) => setStatus(s)), [])

  useKeyboardShortcuts()

  const loadUserPresets = usePresetStore((s) => s.loadUserPresetsFromDB)
  useEffect(() => { void loadUserPresets() }, [loadUserPresets])

  const currentFile = useAudioStore((s) => s.currentFile)
  const mode        = useEducationStore((s) => s.mode)
  const language    = useEducationStore((s) => s.language)
  const setMode     = useEducationStore((s) => s.setMode)
  const setLanguage = useEducationStore((s) => s.setLanguage)

  const showWaveform   = useUiStore((s) => s.showWaveform)
  const showVisualizer = useUiStore((s) => s.showVisualizer)
  const showEducation  = useUiStore((s) => s.showEducation)
  const toggleWaveform   = useUiStore((s) => s.toggleWaveform)
  const toggleVisualizer = useUiStore((s) => s.toggleVisualizer)
  const toggleEducation  = useUiStore((s) => s.toggleEducation)

  const waveLabel = language === 'ro' ? 'Waveform' : 'Waveform'
  const vizLabel  = language === 'ro' ? 'Vizualizări' : 'Visualizers'
  const eduLabel  = language === 'ro' ? 'Educație' : 'Education'

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-4 py-2 sm:px-6 sm:py-3">
        {/* Top row: logo + engine status */}
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2 sm:gap-3">
            <h1 className="text-lg font-bold tracking-tight sm:text-xl">
              Sound<span className="text-purple-500">Lab</span>
            </h1>
            <span className="hidden text-xs text-zinc-500 sm:inline">Mini-DAW Educațional</span>
          </div>

          <div className="flex items-center gap-3 text-xs sm:gap-5">
            {/* Panel toggles — hidden on small screens */}
            {currentFile && (
              <div className="hidden items-center gap-1 rounded-md border border-zinc-800 p-0.5 sm:flex">
                <PanelToggle label={waveLabel}  active={showWaveform}   onClick={toggleWaveform} />
                <PanelToggle label={vizLabel}   active={showVisualizer} onClick={toggleVisualizer} />
                <PanelToggle label={eduLabel}   active={showEducation}  onClick={toggleEducation} />
              </div>
            )}

            {/* Mode toggle */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="hidden text-zinc-500 sm:inline">Mode</span>
              <Switch.Root
                checked={mode === 'advanced'}
                onCheckedChange={(c) => setMode(c ? 'advanced' : 'beginner')}
                aria-label="Toggle beginner / advanced mode"
                className="relative h-5 w-10 cursor-pointer rounded-full bg-zinc-800 transition data-[state=checked]:bg-purple-600"
              >
                <Switch.Thumb className="block h-4 w-4 translate-x-0.5 rounded-full bg-zinc-200 shadow transition-transform will-change-transform data-[state=checked]:translate-x-[22px]" />
              </Switch.Root>
              <span className="w-14 text-zinc-300 sm:w-16">
                {mode === 'beginner' ? 'Beg.' : 'Adv.'}
                <span className="hidden sm:inline">
                  {mode === 'beginner' ? 'inner' : 'anced'}
                </span>
              </span>
            </div>

            {/* Language toggle */}
            <div className="flex items-center gap-1 rounded-md border border-zinc-800 p-0.5">
              <button
                onClick={() => setLanguage('ro')}
                className={`px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider transition ${
                  language === 'ro' ? 'rounded bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >RO</button>
              <button
                onClick={() => setLanguage('en')}
                className={`px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider transition ${
                  language === 'en' ? 'rounded bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >EN</button>
            </div>

            {/* Engine status dot */}
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
          </div>
        </div>

        {/* Panel toggles on mobile — second row */}
        {currentFile && (
          <div className="mt-2 flex items-center gap-1 rounded-md border border-zinc-800 p-0.5 sm:hidden">
            <PanelToggle label={waveLabel}  active={showWaveform}   onClick={toggleWaveform} />
            <PanelToggle label={vizLabel}   active={showVisualizer} onClick={toggleVisualizer} />
            <PanelToggle label={eduLabel}   active={showEducation}  onClick={toggleEducation} />
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-3 py-4 sm:space-y-6 sm:px-6 sm:py-8">
        {currentFile ? (
          <>
            {showWaveform   && <WaveformView />}
            {showVisualizer && <VisualizerPanel />}
            {showEducation  && <InfoPanel />}
            {showEducation  && <RecommendationsPanel />}
            <EffectsRack />
          </>
        ) : (
          <FileDropZone />
        )}
      </main>

      <KeyboardHint />

      <footer className="border-t border-zinc-800 px-3 py-2 sm:px-6 sm:py-3">
        <div className="mx-auto max-w-5xl">
          <TransportBar />
        </div>
      </footer>
    </div>
  )
}

export default App
