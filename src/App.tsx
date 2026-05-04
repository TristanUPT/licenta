import { useEffect, useRef, useState } from 'react'
import {
  start, stop, getContext, getNode, getStatus, subscribe, subscribeStats,
  type EngineStatus, type EngineStats,
} from '@/audio/engine'

const STATUS_COLORS: Record<EngineStatus, string> = {
  idle: 'bg-zinc-500',
  starting: 'bg-amber-400',
  running: 'bg-emerald-500',
  error: 'bg-red-500',
}

function App() {
  const [status, setStatusState] = useState<EngineStatus>(getStatus().status)
  const [error, setError] = useState<string | undefined>(getStatus().error)
  const [stats, setStats] = useState<EngineStats | null>(null)
  const [testing, setTesting] = useState(false)
  const oscRef = useRef<OscillatorNode | null>(null)

  useEffect(() => subscribe((s, e) => {
    setStatusState(s)
    setError(e)
  }), [])

  useEffect(() => subscribeStats(setStats), [])

  async function handleStart() {
    try {
      await start()
    } catch (e) {
      console.error(e)
    }
  }

  async function handleStop() {
    await stop()
  }

  async function handlePassthrough() {
    const ctx = getContext()
    const node = getNode()
    if (!ctx || !node || status !== 'running') return

    setTesting(true)
    console.log('[main] AudioContext state:', ctx.state, 'sampleRate:', ctx.sampleRate)

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 440
    const gain = ctx.createGain()
    gain.gain.value = 0.2

    // Explicit connections, not chained.
    osc.connect(gain)
    gain.connect(node)
    node.connect(ctx.destination)

    osc.start()
    oscRef.current = osc
    osc.stop(ctx.currentTime + 1.0)
    osc.onended = () => {
      try {
        osc.disconnect()
        gain.disconnect()
        node.disconnect()
      } catch { /* already disconnected */ }
      oscRef.current = null
      setTesting(false)
      console.log('[main] passthrough test ended')
    }
  }

  /** Bypass the worklet entirely — connects oscillator directly to destination. */
  async function handleDirectTest() {
    const ctx = getContext()
    if (!ctx) return
    setTesting(true)
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 440
    const gain = ctx.createGain()
    gain.gain.value = 0.2
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 1.0)
    osc.onended = () => {
      try { osc.disconnect(); gain.disconnect() } catch { /* nop */ }
      setTesting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 text-zinc-100">
      <div className="mb-8 text-center">
        <h1 className="text-5xl font-bold tracking-tight">
          Sound<span className="text-purple-500">Lab</span>
        </h1>
        <p className="mt-2 text-sm text-zinc-400">Faza 1 — Audio Engine Foundation</p>
      </div>

      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className={`h-3 w-3 rounded-full ${STATUS_COLORS[status]}`} />
          <span className="text-sm font-medium capitalize text-zinc-200">
            {status}
          </span>
          {error && (
            <span className="ml-auto truncate text-xs text-red-400" title={error}>
              {error}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleStart}
            disabled={status === 'starting' || status === 'running'}
            className="rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Start Engine
          </button>
          <button
            onClick={handleStop}
            disabled={status !== 'running'}
            className="rounded-lg bg-zinc-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Stop
          </button>
        </div>

        <div className="my-5 h-px bg-zinc-800" />

        <div className="space-y-2">
          <button
            onClick={handlePassthrough}
            disabled={status !== 'running' || testing}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-100 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {testing ? 'Playing…' : 'Test prin Worklet (440 Hz, 1 sec)'}
          </button>
          <button
            onClick={handleDirectTest}
            disabled={status !== 'running' || testing}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs font-medium text-zinc-400 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Test direct (bypass worklet) — control
          </button>
        </div>

        {stats && (
          <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs">
            <div className="mb-1 text-zinc-500">Worklet stats</div>
            <div className="text-zinc-300">blocks: {stats.blocksProcessed}</div>
            <div className="text-zinc-300">input RMS: {stats.inputRms.toFixed(5)}</div>
            <div className="text-zinc-300">output RMS: {stats.outputRms.toFixed(5)}</div>
          </div>
        )}
      </div>

      <p className="mt-8 max-w-md text-center text-xs leading-relaxed text-zinc-500">
        Pornește engine-ul și apasă „Test prin Worklet". Dacă input/output RMS &gt; 0
        atunci audio curge prin WASM. Dacă auzi sinusoida → tot pipeline-ul funcționează.
        Dacă RMS = 0 sau nu auzi nimic, deschide DevTools Console pentru log-uri.
      </p>
    </div>
  )
}

export default App
