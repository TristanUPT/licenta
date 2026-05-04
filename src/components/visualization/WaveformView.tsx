import { useEffect, useRef } from 'react'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'
import type { Region } from 'wavesurfer.js/dist/plugins/regions.esm.js'
import { useAudioStore } from '@/store/audioStore'
import * as transport from '@/audio/transport'

const LOOP_REGION_ID = 'loop'

/**
 * Display the loaded clip's waveform and let the user select a loop region.
 *
 * Wavesurfer is used for visualisation only — peaks are computed from the
 * decoded `AudioBuffer` and passed in directly. Playback never goes through
 * Wavesurfer's internal audio element; it always runs through the engine
 * (`transport.play`).
 */
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
      waveColor: '#52525b',          // zinc-600
      progressColor: '#a855f7',      // purple-500
      cursorColor: '#e4e4e7',        // zinc-200
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 140,
      normalize: true,
      interact: true,
      // Skip wavesurfer's own decoding: provide peaks + duration.
      peaks: peaks as unknown as number[][],
      duration: audioBuffer.duration,
      plugins: [regions],
    })
    wsRef.current = ws
    regionsRef.current = regions

    // Click anywhere on the waveform → seek + (re)start playback at that point.
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

    // Drag-to-create a region; we keep at most one ("loop").
    regions.enableDragSelection({ color: 'rgba(168, 85, 247, 0.18)' })

    regions.on('region-created', (region: Region) => {
      // Remove any previous region — we want a single loop region.
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

  // Reflect store-side loop region back into the visual region (e.g. preset
  // load, programmatic toggle).
  useEffect(() => {
    const regions = regionsRef.current
    if (!regions || !audioBuffer) return
    const existing = regions.getRegions().find((r) => r.id === LOOP_REGION_ID)
    if (loopStart === 0 && loopEnd === audioBuffer.duration) {
      // No meaningful region selected; clear it.
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

  // Visual: dim the cursor when not playing.
  useEffect(() => {
    const ws = wsRef.current
    if (!ws) return
    ws.setOptions({ cursorColor: isPlaying ? '#e4e4e7' : '#71717a' })
  }, [isPlaying])

  // Visual hint that a region IS the loop region (toggle outline).
  useEffect(() => {
    const region = loopRegionRef.current
    if (!region) return
    region.setOptions({
      color: isLooping ? 'rgba(16, 185, 129, 0.22)' : 'rgba(168, 85, 247, 0.18)',
    })
  }, [isLooping])

  if (!audioBuffer) return null

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div ref={containerRef} className="w-full" />
      <p className="mt-2 text-center text-xs text-zinc-500">
        Click pe waveform pentru seek · drag pentru a selecta o regiune de loop
      </p>
    </div>
  )
}
