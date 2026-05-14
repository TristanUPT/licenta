import { useRef, useState } from 'react'
import { useAudioStore } from '@/store/audioStore'
import { useEducationStore } from '@/store/educationStore'
import { decodeFile, UnsupportedAudioFormatError } from '@/audio/file-loader'
import { start as startEngine, getContext, getStatus } from '@/audio/engine'

const DEMO_SAMPLES = [
  { id: 'voice',  label: 'Voice',   file: 'voice.wav',  desc: { ro: 'voce sintetică', en: 'synthetic voice' } },
  { id: 'guitar', label: 'Guitar',  file: 'guitar.wav', desc: { ro: 'chitară sintetică', en: 'synthetic guitar' } },
  { id: 'drums',  label: 'Drums',   file: 'drums.wav',  desc: { ro: 'drum loop 120 BPM', en: 'drum loop 120 BPM' } },
  { id: 'bass',   label: 'Bass',    file: 'bass.wav',   desc: { ro: 'linie de bas', en: 'bass line' } },
  { id: 'sweep',  label: 'Sweep',   file: 'sweep.wav',  desc: { ro: 'sweep 20Hz–20kHz', en: '20Hz–20kHz sweep' } },
]

export function FileDropZone() {
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const setLoading = useAudioStore((s) => s.setLoading)
  const setError   = useAudioStore((s) => s.setError)
  const setFile    = useAudioStore((s) => s.setFile)
  const loading    = useAudioStore((s) => s.loading)
  const error      = useAudioStore((s) => s.error)
  const language   = useEducationStore((s) => s.language)

  async function handleFile(file: File) {
    setError(null)
    setLoading(true)
    try {
      if (getStatus().status !== 'running') await startEngine()
      const ctx = getContext()
      if (!ctx) throw new Error('AudioContext not available')

      const audioBuffer = await decodeFile(file, ctx)
      setFile(
        {
          name: file.name,
          size: file.size,
          duration: audioBuffer.duration,
          sampleRate: audioBuffer.sampleRate,
          numberOfChannels: audioBuffer.numberOfChannels,
        },
        audioBuffer,
      )
    } catch (err) {
      const msg = err instanceof UnsupportedAudioFormatError
        ? `Format nesuportat: ${file.name}`
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
        {
          name: sample.file,
          size: arrayBuffer.byteLength,
          duration: audioBuffer.duration,
          sampleRate: audioBuffer.sampleRate,
          numberOfChannels: audioBuffer.numberOfChannels,
        },
        audioBuffer,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(true)
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(false)
  }
  async function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files[0]
    if (file) await handleFile(file)
  }
  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) await handleFile(file)
    e.target.value = ''
  }

  const demoLabel = language === 'ro' ? 'sau încearcă un sample demo' : 'or try a demo sample'

  return (
    <div className="space-y-4">
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition ${
          dragActive
            ? 'border-purple-500 bg-purple-500/5'
            : 'border-zinc-700 bg-zinc-900 hover:border-zinc-600 hover:bg-zinc-900/80'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,.wav,.mp3,.ogg,.flac,.m4a,.aac"
          className="hidden"
          onChange={onChange}
        />
        {loading ? (
          <>
            <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
            <p className="text-sm text-zinc-400">
              {language === 'ro' ? 'Se decodează…' : 'Decoding…'}
            </p>
          </>
        ) : (
          <>
            <svg className="mb-3 h-12 w-12 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            <p className="text-base font-medium text-zinc-200">
              {language === 'ro' ? 'Drag & drop un fișier audio' : 'Drag & drop an audio file'}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {language === 'ro'
                ? 'sau click pentru a selecta · WAV, MP3, OGG, FLAC, M4A, AAC'
                : 'or click to select · WAV, MP3, OGG, FLAC, M4A, AAC'}
            </p>
            {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
          </>
        )}
      </div>

      {/* Demo samples */}
      <div>
        <p className="mb-2 text-center text-xs text-zinc-500">{demoLabel}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {DEMO_SAMPLES.map((s) => (
            <button
              key={s.id}
              onClick={() => void handleDemo(s)}
              disabled={loading}
              className="flex flex-col items-center rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-left transition hover:border-purple-500/40 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="text-sm font-medium text-zinc-200">{s.label}</span>
              <span className="text-[10px] text-zinc-500">{s.desc[language]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
