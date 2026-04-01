import { useState, useEffect } from 'react'
import init, { apply_gain, calculate_rms, calculate_peak } from '../dsp/pkg/soundlab_dsp'

function App() {
  const [wasmReady, setWasmReady] = useState(false)
  const [results, setResults] = useState<{ rms: number; peak: number; rmsAfter: number } | null>(null)

  useEffect(() => {
    init().then(() => setWasmReady(true))
  }, [])

  function testWasm() {
    const samples = new Float32Array(128)
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin((2 * Math.PI * 440 * i) / 48000)
    }

    const rms = calculate_rms(samples)
    const peak = calculate_peak(samples)

    apply_gain(samples, 0.5)
    const rmsAfter = calculate_rms(samples)

    setResults({ rms, peak, rmsAfter })
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-100">
      <h1 className="mb-2 text-5xl font-bold tracking-tight">
        Sound<span className="text-purple-500">Lab</span>
      </h1>
      <p className="mb-8 text-zinc-400">Mini-DAW Educațional</p>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className={`h-3 w-3 rounded-full ${wasmReady ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-zinc-400">
            WASM Engine: {wasmReady ? 'Ready' : 'Loading...'}
          </span>
        </div>

        <button
          onClick={testWasm}
          disabled={!wasmReady}
          className="rounded-lg bg-purple-600 px-6 py-3 font-medium text-white transition-colors hover:bg-purple-500 disabled:opacity-50"
        >
          Test DSP Engine
        </button>

        {results && (
          <div className="mt-6 space-y-2 text-left text-sm">
            <p className="text-zinc-400">
              Input RMS: <span className="font-mono text-zinc-100">{results.rms.toFixed(4)}</span>
            </p>
            <p className="text-zinc-400">
              Input Peak: <span className="font-mono text-zinc-100">{results.peak.toFixed(4)}</span>
            </p>
            <p className="text-zinc-400">
              After -6dB gain, RMS: <span className="font-mono text-zinc-100">{results.rmsAfter.toFixed(4)}</span>
            </p>
            <p className="mt-3 text-xs text-zinc-500">
              440Hz sine → Rust WASM → gain applied ✓
            </p>
          </div>
        )}
      </div>

      <p className="mt-8 text-xs text-zinc-600">
        React + TypeScript + Vite + Rust/WASM + TailwindCSS
      </p>
    </div>
  )
}

export default App
