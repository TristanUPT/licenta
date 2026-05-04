import { useRef, useState } from 'react'
import { useAudioStore } from '@/store/audioStore'
import { decodeFile, UnsupportedAudioFormatError } from '@/audio/file-loader'
import { start as startEngine, getContext, getStatus } from '@/audio/engine'

export function FileDropZone() {
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const setLoading = useAudioStore((s) => s.setLoading)
  const setError = useAudioStore((s) => s.setError)
  const setFile = useAudioStore((s) => s.setFile)
  const loading = useAudioStore((s) => s.loading)
  const error = useAudioStore((s) => s.error)

  async function handleFile(file: File) {
    setError(null)
    setLoading(true)
    try {
      // Engine start must run inside a user gesture so the AudioContext
      // is created/resumed properly.
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
    e.target.value = '' // allow re-selecting the same file
  }

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={`flex h-72 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition ${
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
          <p className="text-sm text-zinc-400">Se decodează…</p>
        </>
      ) : (
        <>
          <svg className="mb-3 h-12 w-12 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          <p className="text-base font-medium text-zinc-200">Drag & drop un fișier audio</p>
          <p className="mt-1 text-xs text-zinc-500">sau click pentru a selecta · WAV, MP3, OGG, FLAC, M4A, AAC</p>
          {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        </>
      )}
    </div>
  )
}
