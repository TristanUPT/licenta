import { useEffect } from 'react'
import { useAudioStore } from '@/store/audioStore'
import * as transport from '@/audio/transport'

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
  const isLooping = useAudioStore((s) => s.isLooping)
  const loopStart = useAudioStore((s) => s.loopStart)
  const loopEnd = useAudioStore((s) => s.loopEnd)
  const playbackPosition = useAudioStore((s) => s.playbackPosition)
  const setPlaying = useAudioStore((s) => s.setPlaying)
  const toggleLoop = useAudioStore((s) => s.toggleLoop)
  const clearFile = useAudioStore((s) => s.clearFile)
  const setPlaybackPosition = useAudioStore((s) => s.setPlaybackPosition)

  // Bridge transport events into the store.
  useEffect(() => {
    const off1 = transport.onEnded(() => setPlaying(false))
    const off2 = transport.onPosition((p) => setPlaybackPosition(p))
    return () => { off1(); off2() }
  }, [setPlaying, setPlaybackPosition])

  // Push loop changes into the active source (if any).
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

  return (
    <div className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
      <div className="flex items-center gap-2">
        <button
          onClick={handlePlayPause}
          disabled={!audioBuffer}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-600 text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-30"
        >
          {isPlaying ? (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
          ) : (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          )}
        </button>
        <button
          onClick={handleStop}
          disabled={!audioBuffer}
          aria-label="Stop"
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 text-zinc-200 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
        </button>
        <button
          onClick={toggleLoop}
          disabled={!audioBuffer}
          aria-label="Loop"
          aria-pressed={isLooping}
          className={`flex h-10 w-10 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-30 ${
            isLooping ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
          }`}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3" /></svg>
        </button>
      </div>

      <div className="flex flex-1 items-baseline gap-2 font-mono text-sm">
        <span className="text-zinc-100">{formatTime(playbackPosition)}</span>
        <span className="text-zinc-600">/</span>
        <span className="text-zinc-500">{formatTime(duration)}</span>
      </div>

      {currentFile && (
        <>
          <div className="truncate text-xs text-zinc-400" title={currentFile.name}>
            {currentFile.name}
            <span className="ml-2 text-zinc-600">
              {currentFile.sampleRate / 1000}kHz · {currentFile.numberOfChannels === 1 ? 'mono' : 'stereo'}
            </span>
          </div>
          <button
            onClick={() => { transport.stop(); clearFile() }}
            className="text-xs text-zinc-500 transition hover:text-zinc-200"
            aria-label="Remove file"
          >
            ✕
          </button>
        </>
      )}
    </div>
  )
}
