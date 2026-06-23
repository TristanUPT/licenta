import { useEffect, useRef, useState } from 'react'
import * as Switch from '@radix-ui/react-switch'
import { getStatus, subscribe, type EngineStatus } from '@/audio/engine'
import { start as startEngine, getContext } from '@/audio/engine'
import { useAudioStore } from '@/store/audioStore'
import { useEducationStore } from '@/store/educationStore'
import { usePresetStore } from '@/store/presetStore'
import { useUiStore } from '@/store/uiStore'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { KeyboardHint } from '@/components/workspace/KeyboardHint'
import { OnboardingTutorial } from '@/components/workspace/OnboardingTutorial'
import { SettingsPanel } from '@/components/workspace/SettingsPanel'
import { BrowserSidebar } from '@/components/workspace/BrowserSidebar'
import { InspectorSidebar } from '@/components/workspace/InspectorSidebar'
import { TransportBar } from '@/components/workspace/TransportBar'
import { WaveformView } from '@/components/visualization/WaveformView'
import { EffectsRack } from '@/components/workspace/EffectsRack'
import { SynthLab } from '@/components/workspace/SynthLab'
import { decodeFile } from '@/audio/file-loader'

const STATUS_DOT: Record<EngineStatus, string> = {
  idle: 'bg-zinc-600',
  starting: 'bg-amber-400 animate-pulse',
  running: 'bg-emerald-500',
  error: 'bg-red-500',
}

interface PanelBtnProps { label: string; active: boolean; onClick: () => void }
function PanelBtn({ label, active, onClick }: PanelBtnProps) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition ${
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
  const setFile     = useAudioStore((s) => s.setFile)
  const setLoading  = useAudioStore((s) => s.setLoading)
  const setError    = useAudioStore((s) => s.setError)
  const mode        = useEducationStore((s) => s.mode)
  const language    = useEducationStore((s) => s.language)
  const setMode     = useEducationStore((s) => s.setMode)
  const setLanguage = useEducationStore((s) => s.setLanguage)

  const showWaveform   = useUiStore((s) => s.showWaveform)
  const showVisualizer = useUiStore((s) => s.showVisualizer)
  const showEducation  = useUiStore((s) => s.showEducation)
  const showLessons    = useUiStore((s) => s.showLessons)
  const showSynthLab   = useUiStore((s) => s.showSynthLab)
  const toggleWaveform   = useUiStore((s) => s.toggleWaveform)
  const toggleVisualizer = useUiStore((s) => s.toggleVisualizer)
  const toggleEducation  = useUiStore((s) => s.toggleEducation)
  const toggleLessons    = useUiStore((s) => s.toggleLessons)
  const toggleSynthLab   = useUiStore((s) => s.toggleSynthLab)

  /* ── Central drop zone (when no file loaded) ── */
  const [dragActive, setDragActive] = useState(false)
  const centerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleDroppedFile(file: File) {
    setError(null); setLoading(true)
    try {
      if (getStatus().status !== 'running') await startEngine()
      const ctx = getContext()
      if (!ctx) throw new Error('AudioContext unavailable')
      const audioBuffer = await decodeFile(file, ctx)
      setFile(
        { name: file.name, size: file.size, duration: audioBuffer.duration, sampleRate: audioBuffer.sampleRate, numberOfChannels: audioBuffer.numberOfChannels },
        audioBuffer,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setLoading(false) }
  }

  function onDragOver(e: React.DragEvent) { e.preventDefault(); setDragActive(true) }
  function onDragLeave(e: React.DragEvent) { e.preventDefault(); setDragActive(false) }
  async function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragActive(false)
    const file = e.dataTransfer.files[0]
    if (file) await handleDroppedFile(file)
  }

  const ro = language === 'ro'

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-zinc-800 px-3">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-bold tracking-tight">
            Reso<span className="text-purple-400">Lab</span>
          </h1>
          <span className="hidden text-[10px] text-zinc-600 sm:inline">Mini-DAW Educațional</span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Panel toggles */}
          <div className="hidden items-center divide-x divide-zinc-800 rounded border border-zinc-800 sm:flex">
            {currentFile && (
              <>
                <PanelBtn label="Wave"                  active={showWaveform}   onClick={toggleWaveform} />
                <PanelBtn label="Viz"                   active={showVisualizer} onClick={toggleVisualizer} />
                <PanelBtn label={ro ? 'Edu' : 'Edu'}   active={showEducation}  onClick={toggleEducation} />
                <PanelBtn label={ro ? 'Lecții' : 'Lessons'} active={showLessons} onClick={toggleLessons} />
              </>
            )}
            <PanelBtn label="Synth" active={showSynthLab} onClick={toggleSynthLab} />
          </div>

          <div className="mx-1 hidden h-4 w-px bg-zinc-800 sm:block" />

          {/* Beginner/Advanced */}
          <div className="flex items-center gap-1.5">
            <Switch.Root
              checked={mode === 'advanced'}
              onCheckedChange={(c) => setMode(c ? 'advanced' : 'beginner')}
              aria-label="Toggle beginner / advanced mode"
              className="relative h-4 w-8 cursor-pointer rounded-full bg-zinc-800 transition data-[state=checked]:bg-purple-600"
            >
              <Switch.Thumb className="block h-3 w-3 translate-x-0.5 rounded-full bg-zinc-300 shadow transition-transform will-change-transform data-[state=checked]:translate-x-[18px]" />
            </Switch.Root>
            <span className="hidden text-[10px] text-zinc-500 sm:inline">
              {mode === 'beginner' ? 'Beginner' : 'Advanced'}
            </span>
          </div>

          {/* Language */}
          <div className="flex items-center divide-x divide-zinc-800 rounded border border-zinc-800">
            <button onClick={() => setLanguage('ro')} className={`px-2 py-0.5 text-[10px] font-semibold uppercase transition ${language === 'ro' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'}`}>RO</button>
            <button onClick={() => setLanguage('en')} className={`px-2 py-0.5 text-[10px] font-semibold uppercase transition ${language === 'en' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'}`}>EN</button>
          </div>

          <SettingsPanel />
          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} title={`Engine: ${status}`} />
        </div>
      </header>

      {/* ── Three-column workspace ──────────────────────────── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* Left sidebar: browser */}
        <BrowserSidebar />

        {/* Center: waveform + effects */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">

          {/* Waveform region */}
          <div
            data-tour="dropzone"
            ref={centerRef}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`relative shrink-0 border-b border-zinc-800 transition ${
              dragActive ? 'bg-purple-500/5' : ''
            } ${currentFile && showWaveform ? '' : currentFile ? 'hidden' : ''}`}
          >
            {currentFile && showWaveform && <WaveformView />}
          </div>

          {/* Empty state — drop zone when no file */}
          {!currentFile && (
            <div
              data-tour="dropzone"
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex shrink-0 cursor-pointer flex-col items-center justify-center border-b border-zinc-800 py-12 transition ${
                dragActive ? 'bg-purple-500/5' : 'bg-zinc-950 hover:bg-zinc-900/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.wav,.mp3,.ogg,.flac,.m4a,.aac"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (f) await handleDroppedFile(f)
                  e.target.value = ''
                }}
              />
              <svg className={`mb-3 h-8 w-8 transition ${dragActive ? 'text-purple-400' : 'text-zinc-700'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              <p className="text-sm font-medium text-zinc-400">
                {ro ? 'Niciun fișier încărcat' : 'No file loaded'}
              </p>
              <p className="mt-1 text-[11px] text-zinc-600">
                {dragActive
                  ? (ro ? 'Eliberează pentru a încărca' : 'Release to load')
                  : (ro ? 'Click sau trage un fișier audio aici' : 'Click or drop an audio file here')}
              </p>
              <p className="mt-0.5 text-[10px] text-zinc-700">WAV · MP3 · OGG · FLAC · M4A · AAC</p>
            </div>
          )}

          {/* Synth + Effects — single scrollable region */}
          <div className="flex-1 overflow-y-auto">
            {showSynthLab && (
              <div className="border-b border-zinc-800">
                <SynthLab />
              </div>
            )}
            <div className="p-3">
              <EffectsRack />
            </div>
          </div>
        </main>

        {/* Right sidebar: inspector + master */}
        <InspectorSidebar />
      </div>

      {/* ── Transport ──────────────────────────────────────── */}
      <footer data-tour="transport" className="shrink-0 border-t border-zinc-800">
        <TransportBar />
      </footer>

      <OnboardingTutorial />
      <KeyboardHint />
    </div>
  )
}

export default App
