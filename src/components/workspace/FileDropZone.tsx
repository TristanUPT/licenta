import { useRef, useState } from 'react'
import { useAudioStore } from '@/store/audioStore'
import { useEducationStore } from '@/store/educationStore'
import { decodeFile, UnsupportedAudioFormatError } from '@/audio/file-loader'
import { start as startEngine, getContext, getStatus } from '@/audio/engine'
import * as transport from '@/audio/transport'

const DEMO_SAMPLES = [
  { id: 'voice',       label: 'Voice',     file: 'voice.wav' },
  { id: 'guitar',      label: 'Guitar',    file: 'guitar.wav' },
  { id: 'guitar-dist', label: 'Gtr Dist',  file: 'guitar-dist.wav' },
  { id: 'drums',       label: 'Drums',     file: 'drums.wav' },
  { id: 'bass',        label: 'Bass',      file: 'bass.wav' },
  { id: 'sweep',       label: 'Sweep',     file: 'sweep.wav' },
]

export function FileDropZone() {
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const setLoading  = useAudioStore((s) => s.setLoading)
  const setError    = useAudioStore((s) => s.setError)
  const setFile     = useAudioStore((s) => s.setFile)
  const clearFile   = useAudioStore((s) => s.clearFile)
  const loading     = useAudioStore((s) => s.loading)
  const error       = useAudioStore((s) => s.error)
  const currentFile = useAudioStore((s) => s.currentFile)
  const language    = useEducationStore((s) => s.language)

  async function handleFile(file: File) {
    setError(null)
    setLoading(true)
    try {
      if (getStatus().status !== 'running') await startEngine()
      const ctx = getContext()
      if (!ctx) throw new Error('AudioContext not available')
      const audioBuffer = await decodeFile(file, ctx)
      setFile(
        { name: file.name, size: file.size, duration: audioBuffer.duration, sampleRate: audioBuffer.sampleRate, numberOfChannels: audioBuffer.numberOfChannels },
        audioBuffer,
      )
    } catch (err) {
      const msg = err instanceof UnsupportedAudioFormatError
        ? (language === 'ro' ? `Format nesuportat: ${file.name}` : `Unsupported format: ${file.name}`)
        : err instanceof Error ? err.message : String(err)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleDemo(sample: typeof DEMO_SAMPLES[number]) {
    setError(null)
    setLoading(true)
    try {
      if (getStatus().status !== 'running') await startEngine()
      const ctx = getContext()
      if (!ctx) throw new Error('AudioContext not available')
      const resp = await fetch(`/samples/${sample.file}`)
      if (!resp.ok) throw new Error(`Could not load ${sample.file}`)
      const arrayBuffer = await resp.arrayBuffer()
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
      setFile(
        { name: sample.file, size: arrayBuffer.byteLength, duration: audioBuffer.duration, sampleRate: audioBuffer.sampleRate, numberOfChannels: audioBuffer.numberOfChannels },
        audioBuffer,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  function onDragOver(e: React.DragEvent) { e.preventDefault(); setDragActive(true) }
  function onDragLeave(e: React.DragEvent) { e.preventDefault(); setDragActive(false) }
  async function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragActive(false)
    const file = e.dataTransfer.files[0]
    if (file) await handleFile(file)
  }
  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) await handleFile(file)
    e.target.value = ''
  }

  /* ── File loaded: compact info strip ──────────────────── */
  if (currentFile) {
    return (
      <div className="flex h-8 items-center gap-2 px-3">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
        <span className="min-w-0 truncate text-[11px] font-medium text-zinc-300">{currentFile.name}</span>
        <span className="shrink-0 text-[10px] text-zinc-600">
          {currentFile.sampleRate / 1000}kHz · {currentFile.numberOfChannels === 1 ? 'mono' : 'stereo'} · {currentFile.duration.toFixed(1)}s
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => inputRef.current?.click()}
            className="text-[10px] text-zinc-600 transition hover:text-zinc-300"
          >
            {language === 'ro' ? 'Schimbă' : 'Change'}
          </button>
          <button
            onClick={() => { transport.stop(); clearFile() }}
            aria-label="Close file"
            className="text-[10px] text-zinc-700 transition hover:text-red-400"
          >✕</button>
        </div>
        <input ref={inputRef} type="file" accept="audio/*,.wav,.mp3,.ogg,.flac,.m4a,.aac" className="hidden" onChange={onChange} />
      </div>
    )
  }

  /* ── No file: drop zone + sample list ─────────────────── */
  return (
    <div>
      {/* Drop strip */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`flex h-9 items-center gap-2 px-3 transition ${
          dragActive ? 'bg-purple-500/10' : ''
        }`}
      >
        {loading ? (
          <div className="h-3 w-3 shrink-0 animate-spin rounded-full border border-purple-500 border-t-transparent" />
        ) : (
          <svg className="h-3.5 w-3.5 shrink-0 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
        )}
        <span className={`text-[11px] ${dragActive ? 'text-purple-300' : 'text-zinc-500'}`}>
          {loading
            ? (language === 'ro' ? 'Se decodează…' : 'Decoding…')
            : dragActive
            ? (language === 'ro' ? 'Eliberează pentru a încărca' : 'Release to load')
            : (language === 'ro' ? 'Trage un fișier audio · WAV MP3 OGG FLAC M4A' : 'Drop an audio file · WAV MP3 OGG FLAC M4A')}
        </span>
        {error && <span className="text-[10px] text-red-400">{error}</span>}
        <button
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="ml-auto rounded border border-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500 transition hover:border-zinc-700 hover:text-zinc-300 disabled:opacity-40"
        >
          {language === 'ro' ? 'Deschide' : 'Browse'}
        </button>
        <input ref={inputRef} type="file" accept="audio/*,.wav,.mp3,.ogg,.flac,.m4a,.aac" className="hidden" onChange={onChange} />
      </div>

      {/* Sample list */}
      <div className="flex items-center gap-0.5 border-t border-zinc-800/60 px-3 py-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <span className="shrink-0 text-[10px] text-zinc-700 mr-1">
          {language === 'ro' ? 'Demo:' : 'Demo:'}
        </span>
        {DEMO_SAMPLES.map((s) => (
          <button
            key={s.id}
            onClick={() => void handleDemo(s)}
            disabled={loading}
            className="shrink-0 rounded px-2 py-0.5 text-[10px] text-zinc-600 transition hover:bg-zinc-800 hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
