import { useEffect, useState } from 'react'
import { useAudioStore } from '@/store/audioStore'
import { useEffectsStore } from '@/store/effectsStore'
import * as transport from '@/audio/transport'
import { renderAndDownload } from '@/audio/export'
import { LevelMeter } from '@/components/visualization/LevelMeter'

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  const ms = Math.floor((sec - Math.floor(sec)) * 100)
  return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
}

export function TransportBar() {
  const audioBuffer = useAudioStore((s) => s.audioBuffer)
  const currentFile = useAudioStore((s) => s.currentFile)
  const isPlaying = useAudioStore((s) => s.isPlaying)
  const effects = useEffectsStore((s) => s.effects)
  const [exporting, setExporting] = useState(false)
  const isLooping = useAudioStore((s) => s.isLooping)
  const loopStart = useAudioStore((s) => s.loopStart)
  const loopEnd = useAudioStore((s) => s.loopEnd)
  const playbackPosition = useAudioStore((s) => s.playbackPosition)
  const setPlaying = useAudioStore((s) => s.setPlaying)
  const toggleLoop = useAudioStore((s) => s.toggleLoop)
  const clearFile = useAudioStore((s) => s.clearFile)
  const setPlaybackPosition = useAudioStore((s) => s.setPlaybackPosition)

  useEffect(() => {
    const off1 = transport.onEnded(() => setPlaying(false))
    const off2 = transport.onPosition((p) => setPlaybackPosition(p))
    return () => { off1(); off2() }
  }, [setPlaying, setPlaybackPosition])

  useEffect(() => {
    transport.setLoopRegion(loopStart, loopEnd, isLooping)
  }, [loopStart, loopEnd, isLooping])

  function handlePlayPause() {
    if (!audioBuffer) return
    if (isPlaying) {
      transport.stop()
      setPlaying(false)
    } else {
      transport.play(audioBuffer, {
        offset: isLooping ? loopStart : playbackPosition,
        loop: isLooping,
        loopStart,
        loopEnd,
      })
      setPlaying(true)
    }
  }

  function handleStop() {
    transport.stop()
    setPlaying(false)
    setPlaybackPosition(0)
  }

  const duration = audioBuffer?.duration ?? 0

  async function handleExport() {
    if (!audioBuffer || !currentFile || exporting) return
    setExporting(true)
    try {
      await renderAndDownload(audioBuffer, effects, currentFile.name)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 sm:px-4 sm:py-3">
      {/* Row 1: meter + transport controls + time */}
      <div className="flex items-center gap-2 sm:gap-4">
        <LevelMeter height={40} width={16} />

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={handlePlayPause}
            disabled={!audioBuffer}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-600 text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-30 sm:h-10 sm:w-10"
          >
            {isPlaying ? (
              <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
            ) : (
              <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>
          <button
            onClick={handleStop}
            disabled={!audioBuffer}
            aria-label="Stop"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800 text-zinc-200 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-30 sm:h-10 sm:w-10"
          >
            <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
          </button>
          <button
            onClick={toggleLoop}
            disabled={!audioBuffer}
            aria-label="Loop"
            aria-pressed={isLooping}
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-30 sm:h-10 sm:w-10 ${
              isLooping ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
            }`}
          >
            <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3" /></svg>
          </button>
        </div>

        <div className="flex flex-1 items-baseline gap-1.5 font-mono text-xs sm:gap-2 sm:text-sm">
          <span className="text-zinc-100">{formatTime(playbackPosition)}</span>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-500">{formatTime(duration)}</span>
        </div>

        {/* Filename + actions — visible only on sm+ inline, on mobile goes to row 2 */}
        {currentFile && (
          <div className="hidden items-center gap-2 sm:flex">
            <FileInfo currentFile={currentFile} />
            <ExportButton exporting={exporting} disabled={effects.length === 0} onExport={() => void handleExport()} />
            <button
              onClick={() => { transport.stop(); clearFile() }}
              className="text-xs text-zinc-500 transition hover:text-zinc-200"
              aria-label="Remove file"
            >✕</button>
          </div>
        )}
      </div>

      {/* Row 2 (mobile only): filename + export */}
      {currentFile && (
        <div className="mt-2 flex items-center gap-2 sm:hidden">
          <FileInfo currentFile={currentFile} />
          <ExportButton exporting={exporting} disabled={effects.length === 0} onExport={() => void handleExport()} />
          <button
            onClick={() => { transport.stop(); clearFile() }}
            className="text-xs text-zinc-500 transition hover:text-zinc-200"
            aria-label="Remove file"
          >✕</button>
        </div>
      )}
    </div>
  )
}

function FileInfo({ currentFile }: { currentFile: { name: string; sampleRate: number; numberOfChannels: number } }) {
  return (
    <div className="min-w-0 flex-1 truncate text-xs text-zinc-400" title={currentFile.name}>
      <span className="truncate">{currentFile.name}</span>
      <span className="ml-2 text-zinc-600">
        {currentFile.sampleRate / 1000}kHz · {currentFile.numberOfChannels === 1 ? 'mono' : 'stereo'}
      </span>
    </div>
  )
}

function ExportButton({ exporting, disabled, onExport }: { exporting: boolean; disabled: boolean; onExport: () => void }) {
  return (
    <button
      onClick={onExport}
      disabled={exporting || disabled}
      title={disabled ? 'Add effects before exporting' : 'Export processed audio as WAV'}
      className="flex shrink-0 items-center gap-1.5 rounded-md bg-zinc-800 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {exporting ? (
        <>
          <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Exporting…
        </>
      ) : (
        <>
          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          WAV
        </>
      )}
    </button>
  )
}
