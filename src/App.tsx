import { useEffect, useState } from 'react'
import * as Switch from '@radix-ui/react-switch'
import { getStatus, subscribe, type EngineStatus } from '@/audio/engine'
import { useAudioStore } from '@/store/audioStore'
import { useEducationStore } from '@/store/educationStore'
import { usePresetStore } from '@/store/presetStore'
import { useUiStore } from '@/store/uiStore'
import { FileDropZone } from '@/components/workspace/FileDropZone'
import { TransportBar } from '@/components/workspace/TransportBar'
import { WaveformView } from '@/components/visualization/WaveformView'
import { VisualizerPanel } from '@/components/visualization/VisualizerPanel'
import { EffectsRack } from '@/components/workspace/EffectsRack'
import { InfoPanel } from '@/components/education/InfoPanel'
import { RecommendationsPanel } from '@/components/education/RecommendationsPanel'

const STATUS_LABEL: Record<EngineStatus, string> = {
  idle: 'idle',
  starting: 'starting',
  running: 'running',
  error: 'error',
}
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
        active
          ? 'bg-zinc-700 text-zinc-200'
          : 'text-zinc-600 hover:text-zinc-400'
      }`}
    >
      {label}
    </button>
  )
}

function App() {
  const [status, setStatus] = useState<EngineStatus>(getStatus().status)
  useEffect(() => subscribe((s) => setStatus(s)), [])

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
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-bold tracking-tight">
            Sound<span className="text-purple-500">Lab</span>
          </h1>
          <span className="text-xs text-zinc-500">Mini-DAW Educațional</span>
        </div>
        <div className="flex items-center gap-5 text-xs">
          {/* Panel visibility toggles — only shown when a file is loaded */}
          {currentFile && (
            <div className="flex items-center gap-1 rounded-md border border-zinc-800 p-0.5">
              <PanelToggle label={waveLabel}  active={showWaveform}   onClick={toggleWaveform} />
              <PanelToggle label={vizLabel}   active={showVisualizer} onClick={toggleVisualizer} />
              <PanelToggle label={eduLabel}   active={showEducation}  onClick={toggleEducation} />
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Mode</span>
            <Switch.Root
              checked={mode === 'advanced'}
              onCheckedChange={(c) => setMode(c ? 'advanced' : 'beginner')}
              aria-label="Toggle beginner / advanced mode"
              className="relative h-5 w-10 cursor-pointer rounded-full bg-zinc-800 transition data-[state=checked]:bg-purple-600"
            >
              <Switch.Thumb className="block h-4 w-4 translate-x-0.5 rounded-full bg-zinc-200 shadow transition-transform will-change-transform data-[state=checked]:translate-x-[22px]" />
            </Switch.Root>
            <span className="w-16 text-zinc-300">{mode === 'beginner' ? 'Beginner' : 'Advanced'}</span>
          </div>

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

          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
            <span className="text-zinc-400">engine: {STATUS_LABEL[status]}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-6 py-8">
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

      <footer className="border-t border-zinc-800 px-6 py-3">
        <div className="mx-auto max-w-5xl">
          <TransportBar />
        </div>
      </footer>
    </div>
  )
}

export default App
