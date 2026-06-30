import { useEffect, useState, useRef, useCallback } from 'react'
import { useAudioStore } from '@/store/audioStore'
import { useAnalysisStore } from '@/store/analysisStore'
import { useEffectsStore } from '@/store/effectsStore'
import * as transport from '@/audio/transport'
import * as metronome from '@/audio/metronome'
import { renderAndDownload } from '@/audio/export'
import { LevelMeter } from '@/components/visualization/LevelMeter'
import { useRecording } from '@/hooks/useRecording'

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

  const clipped        = useAnalysisStore((s) => s.clipped)
  const clearClip      = useAnalysisStore((s) => s.clearClip)
  const masterPeak     = useAnalysisStore((s) => s.masterPeak)
  const masterRms      = useAnalysisStore((s) => s.masterRms)
  const integratedLufs = useAudioStore((s) => s.integratedLufs)

  function toDbfs(lin: number) {
    if (lin <= 0) return '-∞'
    const db = 20 * Math.log10(lin)
    return `${db.toFixed(1)} dB`
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 sm:px-4 sm:py-3">
      {/* Row 1: meter + transport controls + time */}
      <div className="flex items-center gap-2 sm:gap-4">
        <div className="flex flex-col items-center gap-1">
          <LevelMeter height={40} width={16} />
          <button
            onClick={clearClip}
            title="Click to reset clip indicator"
            className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase transition ${
              clipped
                ? 'bg-red-500 text-white hover:bg-red-400'
                : 'bg-zinc-800 text-zinc-600'
            }`}
          >
            CLIP
          </button>
        </div>
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

        <MetronomeGroup />

        <RecordingControls />

        <div className="flex flex-1 items-baseline gap-1.5 font-mono text-xs sm:gap-2 sm:text-sm">
          <span className="text-zinc-100">{formatTime(playbackPosition)}</span>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-500">{formatTime(duration)}</span>
        </div>

        {/* Numeric level readout — fixed width so it never shifts adjacent elements */}
        <div className="hidden w-24 shrink-0 flex-col items-end gap-0.5 sm:flex">
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-[10px] text-zinc-500">pk</span>
            <span className={`w-16 text-right font-mono text-[11px] tabular-nums ${masterPeak >= 1 ? 'text-red-400' : masterPeak > 0.5 ? 'text-amber-300' : 'text-zinc-300'}`}>
              {toDbfs(masterPeak)}
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-[10px] text-zinc-500">rms</span>
            <span className="w-16 text-right font-mono text-[11px] tabular-nums text-zinc-400">
              {toDbfs(masterRms)}
            </span>
          </div>
          {integratedLufs !== null && (
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-[10px] text-zinc-500">lufs</span>
              <span className={`w-16 text-right font-mono text-[11px] tabular-nums ${integratedLufs > -14 ? 'text-amber-300' : integratedLufs > -23 ? 'text-emerald-400' : 'text-zinc-400'}`}>
                {integratedLufs.toFixed(1)}
              </span>
            </div>
          )}
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

      {/* Row 2 (mobile only): filename + LUFS + export */}
      {currentFile && (
        <div className="mt-2 flex items-center gap-2 sm:hidden">
          <FileInfo currentFile={currentFile} />
          {integratedLufs !== null && (
            <span className={`shrink-0 font-mono text-[10px] tabular-nums ${integratedLufs > -14 ? 'text-amber-300' : integratedLufs > -23 ? 'text-emerald-400' : 'text-zinc-500'}`}>
              {integratedLufs.toFixed(1)} LUFS
            </span>
          )}
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

// ─── Metronome Group (BPM + metronome button + time sig) ─────────────────────

const TIME_SIGS = ['2/4', '3/4', '4/4', '6/8'] as const
type TimeSig = typeof TIME_SIGS[number]

function beatsFromSig(sig: TimeSig): number {
  return parseInt(sig.split('/')[0]!)
}

function MetronomeGroup() {
  const [bpm, setBpmLocal] = useState(120)
  const [active, setActive] = useState(false)
  const [timeSig, setTimeSig] = useState<TimeSig>('4/4')
  const [beat, setBeat] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [sigOpen, setSigOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const holdRef = useRef<number | null>(null)
  const beatTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    const off = metronome.onBeat(() => {
      setBeat(true)
      if (beatTimeoutRef.current !== null) clearTimeout(beatTimeoutRef.current)
      beatTimeoutRef.current = window.setTimeout(() => setBeat(false), 80)
    })
    return () => {
      off()
      if (beatTimeoutRef.current !== null) clearTimeout(beatTimeoutRef.current)
    }
  }, [])

  const changeBpm = useCallback((value: number) => {
    const clamped = Math.max(40, Math.min(240, value))
    setBpmLocal(clamped)
    metronome.setBpm(clamped)
    transport.setPlaybackRate(clamped / 120)
  }, [])

  function startHold(delta: number) {
    changeBpm(bpm + delta)
    let speed = 150
    const tick = () => {
      changeBpm(metronome.getBpm() + delta)
      speed = Math.max(30, speed * 0.9)
      holdRef.current = window.setTimeout(tick, speed)
    }
    holdRef.current = window.setTimeout(tick, 400)
  }

  function stopHold() {
    if (holdRef.current !== null) {
      clearTimeout(holdRef.current)
      holdRef.current = null
    }
  }

  function handleToggleMetronome() {
    if (active) {
      metronome.stopMetronome()
      setActive(false)
    } else {
      void metronome.startMetronome().then(() => setActive(true))
    }
  }

  function handleTimeSig(sig: TimeSig) {
    setTimeSig(sig)
    metronome.setBeatsPerMeasure(beatsFromSig(sig))
    setSigOpen(false)
  }

  function startEdit() {
    setEditValue(String(bpm))
    setEditing(true)
    requestAnimationFrame(() => inputRef.current?.select())
  }

  function commitEdit() {
    setEditing(false)
    const n = parseInt(editValue, 10)
    if (!isNaN(n)) changeBpm(n)
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault()
    changeBpm(bpm + (e.deltaY < 0 ? 1 : -1))
  }

  return (
    <div className="hidden items-center gap-1 sm:flex">
      {/* BPM control */}
      <div className="flex h-9 items-center overflow-hidden rounded-lg border border-zinc-700 sm:h-10">
        {/* Minus */}
        <button
          onPointerDown={() => startHold(-1)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          className="flex h-full w-7 items-center justify-center text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200 active:bg-zinc-700"
          aria-label="Decrease BPM"
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M5 12h14" /></svg>
        </button>

        {/* Display / edit */}
        <div
          className="flex h-full w-[72px] cursor-pointer items-center justify-center border-x border-zinc-700 bg-zinc-900 px-1"
          onWheel={handleWheel}
          onClick={() => !editing && startEdit()}
          onDoubleClick={() => { changeBpm(120); setEditing(false) }}
        >
          {editing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false) }}
              className="w-full bg-transparent text-center font-mono text-[11px] font-semibold text-purple-300 outline-none"
              type="text"
              inputMode="numeric"
            />
          ) : (
            <span className="flex items-center gap-1 font-mono text-[11px] font-semibold text-zinc-300">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full bg-purple-500"
                style={{
                  transform: beat ? 'scale(1.4)' : 'scale(1)',
                  transition: 'transform 80ms ease-out',
                }}
              />
              {bpm}
              <span className="text-[9px] font-normal text-zinc-600">BPM</span>
            </span>
          )}
        </div>

        {/* Plus */}
        <button
          onPointerDown={() => startHold(1)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          className="flex h-full w-7 items-center justify-center text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200 active:bg-zinc-700"
          aria-label="Increase BPM"
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </div>

      {/* Metronome button */}
      <button
        onClick={handleToggleMetronome}
        title={active ? 'Stop metronome' : 'Start metronome'}
        aria-pressed={active}
        className={`flex h-9 w-9 items-center justify-center rounded-lg transition sm:h-10 sm:w-10 ${
          active
            ? 'text-white hover:brightness-110'
            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
        }`}
        style={active ? {
          backgroundColor: beat ? '#a78bfa' : '#7c3aed',
          transition: 'background-color 80ms ease-out',
        } : undefined}
      >
        {/* Metronome icon */}
        <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 22h12" />
          <path d="M7 22L9.5 4h5L17 22" />
          <path d="M12 14l5-8" />
          <circle cx="12" cy="14" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      </button>

      {/* Time signature */}
      <div className="relative">
        <button
          onClick={() => setSigOpen(!sigOpen)}
          className="flex h-9 items-center rounded-lg bg-zinc-800 px-2 font-mono text-[11px] font-semibold text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-200 sm:h-10"
        >
          {timeSig}
        </button>
        {sigOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setSigOpen(false)} />
            <div className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded-lg border border-zinc-700 bg-zinc-900 p-1 shadow-xl">
              {TIME_SIGS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleTimeSig(s)}
                  className={`block w-full rounded px-3 py-1 text-left font-mono text-[11px] transition ${
                    timeSig === s
                      ? 'bg-purple-600 text-white'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Recording Controls ──────────────────────────────────────────────────────

function formatRec(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function RecordingControls() {
  const {
    micActive, isRecording, recordingUrl, recordingSec, micError,
    audioDevices, selectedDeviceId, monitoring,
    enumerateDevices, selectDevice, disconnectMic, toggleMonitor,
    startRecording, stopRecording, clearRecording,
  } = useRecording()
  const [devOpen, setDevOpen] = useState(false)

  async function handleMicClick() {
    if (micActive && !devOpen) {
      setDevOpen(true)
      return
    }
    if (devOpen) {
      setDevOpen(false)
      return
    }
    await enumerateDevices()
    setDevOpen(true)
  }

  async function handleSelectDevice(id: string) {
    await selectDevice(id)
    setDevOpen(false)
  }

  return (
    <div className="flex items-center gap-1 sm:gap-1.5">
      {/* Mic / device selector */}
      <div className="relative">
        <button
          onClick={() => void handleMicClick()}
          title={micError ?? (micActive ? 'Audio input settings' : 'Select audio input')}
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition sm:h-10 sm:w-10 ${
            micError
              ? 'bg-red-900 text-red-400 hover:bg-red-800'
              : micActive
              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
          }`}
        >
          <MicIcon />
        </button>

        {devOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setDevOpen(false)} />
            <div className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl">
              <div className="border-b border-zinc-800 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                  Audio Input
                </p>
              </div>

              {micError && (
                <div className="border-b border-zinc-800 px-3 py-2 text-[11px] text-red-400">
                  {micError}
                </div>
              )}

              <div className="max-h-40 overflow-y-auto p-1" style={{ scrollbarWidth: 'thin' }}>
                {audioDevices.length === 0 ? (
                  <button
                    onClick={() => void enumerateDevices()}
                    className="w-full rounded px-3 py-2 text-left text-[11px] text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
                  >
                    Scan for devices…
                  </button>
                ) : (
                  audioDevices.map((d) => (
                    <button
                      key={d.deviceId}
                      onClick={() => void handleSelectDevice(d.deviceId)}
                      className={`flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-[11px] transition ${
                        selectedDeviceId === d.deviceId
                          ? 'bg-purple-600/20 text-purple-300'
                          : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        selectedDeviceId === d.deviceId ? 'bg-emerald-500' : 'bg-zinc-700'
                      }`} />
                      <span className="truncate">{d.label || `Input ${d.deviceId.slice(0, 8)}`}</span>
                    </button>
                  ))
                )}
              </div>

              {/* Monitor toggle + disconnect */}
              {micActive && (
                <div className="space-y-1 border-t border-zinc-800 p-2">
                  <button
                    onClick={toggleMonitor}
                    className={`flex w-full items-center gap-2 rounded px-3 py-1.5 text-[11px] transition ${
                      monitoring
                        ? 'bg-emerald-600/20 text-emerald-300'
                        : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
                    }`}
                  >
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M12 12h.01" />
                    </svg>
                    {monitoring ? 'Monitoring active' : 'Monitor (direct listen)'}
                  </button>
                  {monitoring && (
                    <p className="px-3 text-[10px] text-amber-500">
                      ⚠ Use headphones to avoid feedback
                    </p>
                  )}
                  <button
                    onClick={() => { disconnectMic(); setDevOpen(false) }}
                    className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-[11px] text-zinc-600 transition hover:bg-zinc-800 hover:text-red-400"
                  >
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Disconnect input
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Record / Stop record */}
      <button
        onClick={isRecording ? stopRecording : startRecording}
        title={isRecording ? 'Stop recording' : 'Start recording'}
        className={`flex h-9 w-9 items-center justify-center rounded-lg transition sm:h-10 sm:w-10 ${
          isRecording
            ? 'bg-red-600 text-white hover:bg-red-500'
            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
        }`}
      >
        {isRecording ? (
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
        ) : (
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" /></svg>
        )}
      </button>

      {/* REC badge + timer */}
      {isRecording && (
        <span className="hidden items-center gap-1.5 sm:flex">
          <span className="animate-pulse font-mono text-[10px] font-bold tracking-widest text-red-400">
            REC
          </span>
          <span className="font-mono text-[11px] tabular-nums text-red-300">
            {formatRec(recordingSec)}
          </span>
        </span>
      )}

      {/* Download + clear when a recording exists */}
      {recordingUrl && !isRecording && (
        <>
          <a
            href={recordingUrl}
            download="recording.wav"
            title="Download recording (WAV)"
            className="hidden h-9 items-center gap-1 rounded-lg bg-zinc-800 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-300 transition hover:bg-zinc-700 hover:text-white sm:flex sm:h-10"
          >
            <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            WAV
          </a>
          <button
            onClick={clearRecording}
            title="Discard recording"
            className="text-xs text-zinc-600 transition hover:text-zinc-300"
          >✕</button>
        </>
      )}
    </div>
  )
}

function MicIcon() {
  return (
    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" />
      <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      <line x1="9" y1="21" x2="15" y2="21" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
