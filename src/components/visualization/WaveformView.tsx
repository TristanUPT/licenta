import { useEffect, useRef } from 'react'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'
import type { Region } from 'wavesurfer.js/dist/plugins/regions.esm.js'
import { useAudioStore } from '@/store/audioStore'
import { useEducationStore } from '@/store/educationStore'
import * as transport from '@/audio/transport'

const LOOP_REGION_ID = 'loop'

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  const ms = Math.floor((sec - Math.floor(sec)) * 100)
  return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
}

export function WaveformView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WaveSurfer | null>(null)
  const regionsRef = useRef<ReturnType<typeof RegionsPlugin.create> | null>(null)
  const loopRegionRef = useRef<Region | null>(null)

  const audioBuffer = useAudioStore((s) => s.audioBuffer)
  const playbackPosition = useAudioStore((s) => s.playbackPosition)
  const isLooping = useAudioStore((s) => s.isLooping)
  const isPlaying = useAudioStore((s) => s.isPlaying)
  const setLoopRegion = useAudioStore((s) => s.setLoopRegion)
  const setPlaying = useAudioStore((s) => s.setPlaying)
  const loopStart = useAudioStore((s) => s.loopStart)
  const loopEnd = useAudioStore((s) => s.loopEnd)
  const language = useEducationStore((s) => s.language)

  const duration = audioBuffer?.duration ?? 0
  const hasRegion = loopStart !== 0 || loopEnd !== duration

  function handleSetIn() {
    setLoopRegion(playbackPosition, Math.max(playbackPosition + 0.1, loopEnd))
  }

  function handleSetOut() {
    setLoopRegion(Math.min(loopStart, playbackPosition - 0.1), playbackPosition)
  }

  function handleClearRegion() {
    setLoopRegion(0, duration)
  }

  // Build / rebuild wavesurfer when a new buffer is loaded.
  useEffect(() => {
    if (!containerRef.current || !audioBuffer) return

    const peaks: Float32Array[] = []
    for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
      peaks.push(audioBuffer.getChannelData(c))
    }

    const regions = RegionsPlugin.create()
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#52525b',
      progressColor: '#a855f7',
      cursorColor: '#e4e4e7',
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 140,
      normalize: true,
      interact: true,
      peaks: peaks as unknown as number[][],
      duration: audioBuffer.duration,
      plugins: [regions],
    })
    wsRef.current = ws
    regionsRef.current = regions

    ws.on('click', (relativeX) => {
      const offset = relativeX * audioBuffer.duration
      transport.play(audioBuffer, {
        offset,
        loop: useAudioStore.getState().isLooping,
        loopStart: useAudioStore.getState().loopStart,
        loopEnd: useAudioStore.getState().loopEnd,
      })
      setPlaying(true)
    })

    regions.enableDragSelection({ color: 'rgba(168, 85, 247, 0.18)' })

    regions.on('region-created', (region: Region) => {
      const all = regions.getRegions()
      for (const r of all) {
        if (r.id !== region.id) r.remove()
      }
      region.id = LOOP_REGION_ID
      loopRegionRef.current = region
      setLoopRegion(region.start, region.end)
    })
    regions.on('region-updated', (region: Region) => {
      if (region.id !== LOOP_REGION_ID) return
      setLoopRegion(region.start, region.end)
    })

    return () => {
      ws.destroy()
      wsRef.current = null
      regionsRef.current = null
      loopRegionRef.current = null
    }
  }, [audioBuffer, setLoopRegion, setPlaying])

  // Push the engine's playback position to wavesurfer's cursor.
  useEffect(() => {
    const ws = wsRef.current
    if (!ws || !audioBuffer) return
    ws.setTime(playbackPosition)
  }, [playbackPosition, audioBuffer])

  // Reflect store-side loop region back into the visual region.
  useEffect(() => {
    const regions = regionsRef.current
    if (!regions || !audioBuffer) return
    const existing = regions.getRegions().find((r) => r.id === LOOP_REGION_ID)
    if (loopStart === 0 && loopEnd === audioBuffer.duration) {
      existing?.remove()
      loopRegionRef.current = null
      return
    }
    if (existing) {
      existing.setOptions({ start: loopStart, end: loopEnd })
    } else {
      const region = regions.addRegion({
        id: LOOP_REGION_ID,
        start: loopStart,
        end: loopEnd,
        color: 'rgba(168, 85, 247, 0.18)',
        drag: true,
        resize: true,
      })
      loopRegionRef.current = region
    }
  }, [loopStart, loopEnd, audioBuffer])

  useEffect(() => {
    const ws = wsRef.current
    if (!ws) return
    ws.setOptions({ cursorColor: isPlaying ? '#e4e4e7' : '#71717a' })
  }, [isPlaying])

  useEffect(() => {
    const region = loopRegionRef.current
    if (!region) return
    region.setOptions({
      color: isLooping ? 'rgba(16, 185, 129, 0.22)' : 'rgba(168, 85, 247, 0.18)',
    })
  }, [isLooping])

  if (!audioBuffer) return null

  const hint = language === 'ro'
    ? 'Click pentru seek · drag pentru regiune de loop'
    : 'Click to seek · drag to select loop region'
  const setInLabel  = language === 'ro' ? 'Set In'  : 'Set In'
  const setOutLabel = language === 'ro' ? 'Set Out' : 'Set Out'
  const clearLabel  = language === 'ro' ? 'Șterge'  : 'Clear'

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div ref={containerRef} className="w-full" />

      {/* Controls row */}
      <div className="mt-2 flex items-center justify-between gap-4">
        <p className="text-xs text-zinc-500">{hint}</p>

        <div className="flex items-center gap-2">
          {/* Loop region times */}
          {hasRegion && (
            <span className="font-mono text-[11px] text-zinc-400">
              <span className={isLooping ? 'text-emerald-400' : 'text-purple-400'}>{fmt(loopStart)}</span>
              <span className="mx-1 text-zinc-600">–</span>
              <span className={isLooping ? 'text-emerald-400' : 'text-purple-400'}>{fmt(loopEnd)}</span>
            </span>
          )}

          {/* Set In / Set Out */}
          <button
            onClick={handleSetIn}
            disabled={!isPlaying}
            title={language === 'ro' ? 'Setează punctul de start la poziția curentă' : 'Set loop start to current position'}
            className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {setInLabel}
          </button>
          <button
            onClick={handleSetOut}
            disabled={!isPlaying}
            title={language === 'ro' ? 'Setează punctul de sfârșit la poziția curentă' : 'Set loop end to current position'}
            className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {setOutLabel}
          </button>

          {/* Clear region */}
          {hasRegion && (
            <button
              onClick={handleClearRegion}
              title={language === 'ro' ? 'Șterge regiunea de loop' : 'Clear loop region'}
              className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 transition hover:bg-red-500/20 hover:text-red-400"
            >
              {clearLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
