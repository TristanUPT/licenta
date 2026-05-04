import { useEffect, useState } from 'react'
import { getStatus, subscribe, type EngineStatus } from '@/audio/engine'
import { useAudioStore } from '@/store/audioStore'
import { FileDropZone } from '@/components/workspace/FileDropZone'
import { TransportBar } from '@/components/workspace/TransportBar'
import { WaveformView } from '@/components/visualization/WaveformView'
import { EffectsRack } from '@/components/workspace/EffectsRack'

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

function App() {
  const [status, setStatus] = useState<EngineStatus>(getStatus().status)
  useEffect(() => subscribe((s) => setStatus(s)), [])

  const currentFile = useAudioStore((s) => s.currentFile)

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-bold tracking-tight">
            Sound<span className="text-purple-500">Lab</span>
          </h1>
          <span className="text-xs text-zinc-500">Mini-DAW Educațional</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
          <span className="text-zinc-400">engine: {STATUS_LABEL[status]}</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-6 py-8">
        {currentFile ? (
          <>
            <WaveformView />
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
