import { useEffect, useRef } from 'react'
import AudioMotionAnalyzer from 'audiomotion-analyzer'
import { getContext, getNode, getStatus, subscribe } from '@/audio/engine'

/**
 * Real-time spectrum display. Connects to the engine's worklet output as a
 * parallel branch — does not affect the main signal path.
 */
export function SpectrumAnalyzer() {
  const containerRef = useRef<HTMLDivElement>(null)
  const analyzerRef = useRef<AudioMotionAnalyzer | null>(null)

  useEffect(() => {
    function tryAttach() {
      if (analyzerRef.current) return
      if (!containerRef.current) return
      if (getStatus().status !== 'running') return
      const ctx = getContext()
      const node = getNode()
      if (!ctx || !node) return

      const analyzer = new AudioMotionAnalyzer(containerRef.current, {
        audioCtx: ctx,
        // Engine node is the source — analyzer connects to it as a branch.
        source: node,
        // We already route audio to ctx.destination through transport — the
        // analyzer must NOT connect to speakers itself (would double the audio).
        connectSpeakers: false,
        height: 180,
        mode: 4,                     // 1/6th octave bands — readable in UI
        showScaleX: true,
        showScaleY: false,
        showPeaks: true,
        smoothing: 0.7,
        gradient: 'classic',
        bgAlpha: 0,
        overlay: true,
        showBgColor: false,
        weightingFilter: 'D',        // perceptual loudness curve
        minDecibels: -85,
        maxDecibels: -20,
        ledBars: false,
        lumiBars: false,
        radial: false,
        reflexRatio: 0.05,
        reflexAlpha: 0.2,
      })
      // Custom violet gradient.
      analyzer.registerGradient('soundlab', {
        bgColor: '#0a0a0a',
        colorStops: [
          { pos: 0,    color: '#a855f7' },
          { pos: 0.5,  color: '#7c3aed' },
          { pos: 1,    color: '#22d3ee' },
        ],
      })
      analyzer.setOptions({ gradient: 'soundlab' })
      analyzerRef.current = analyzer
    }

    tryAttach()
    const off = subscribe(() => tryAttach())
    return () => {
      off()
      analyzerRef.current?.destroy()
      analyzerRef.current = null
    }
  }, [])

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-2">
      <div ref={containerRef} className="overflow-hidden rounded-md" />
      <p className="mt-1 text-center text-[10px] uppercase tracking-wider text-zinc-600">
        Spectrum (1/6 oct.)
      </p>
    </div>
  )
}
