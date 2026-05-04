/**
 * Audio playback transport.
 *
 * Wraps the lifecycle of `AudioBufferSourceNode` (one-shots) and routes audio
 * through the engine's worklet node before reaching the destination:
 *
 *     BufferSource → engine.node → ctx.destination
 *
 * Use Tone.js for transport scheduling later (BPM/loop sync) — for the MVP
 * the native `BufferSourceNode.loop` properties are enough.
 */

import { getContext, getNode } from './engine'

type EndedListener = () => void
type PositionListener = (positionSec: number) => void

let currentSource: AudioBufferSourceNode | null = null
let currentBuffer: AudioBuffer | null = null
let startedAtCtxTime = 0
let startedAtBufferOffset = 0
let loopEnabled = false
let loopStartSec = 0
let loopEndSec = 0
let rafHandle: number | null = null

const endedListeners = new Set<EndedListener>()
const positionListeners = new Set<PositionListener>()

function notifyEnded() {
  for (const l of endedListeners) l()
}

function tickPosition() {
  if (!currentSource) {
    rafHandle = null
    return
  }
  const ctx = getContext()
  if (!ctx) {
    rafHandle = null
    return
  }
  let position = startedAtBufferOffset + (ctx.currentTime - startedAtCtxTime)
  if (loopEnabled && currentBuffer && loopEndSec > loopStartSec) {
    const loopLen = loopEndSec - loopStartSec
    if (position >= loopEndSec) {
      position = loopStartSec + ((position - loopStartSec) % loopLen)
    }
  } else if (currentBuffer && position >= currentBuffer.duration) {
    position = currentBuffer.duration
  }
  for (const l of positionListeners) l(position)
  rafHandle = requestAnimationFrame(tickPosition)
}

export interface PlayOptions {
  /** Seconds into the buffer to start at. */
  offset?: number
  /** Enable native loop. */
  loop?: boolean
  /** Loop start (seconds into buffer). Required if `loop`. */
  loopStart?: number
  /** Loop end (seconds into buffer). Required if `loop`. */
  loopEnd?: number
}

/** Stop and clean up any current source. Idempotent. */
export function stop(): void {
  if (currentSource) {
    try {
      currentSource.onended = null
      currentSource.stop()
    } catch { /* already stopped */ }
    try { currentSource.disconnect() } catch { /* nop */ }
    currentSource = null
  }
  if (rafHandle != null) {
    cancelAnimationFrame(rafHandle)
    rafHandle = null
  }
}

export function play(buffer: AudioBuffer, opts: PlayOptions = {}): void {
  const ctx = getContext()
  const node = getNode()
  if (!ctx || !node) throw new Error('Audio engine not started — call engine.start() first.')
  if (ctx.state === 'suspended') void ctx.resume()

  // Replace any current source.
  stop()

  const source = ctx.createBufferSource()
  source.buffer = buffer

  loopEnabled = opts.loop === true
  loopStartSec = opts.loopStart ?? 0
  loopEndSec = opts.loopEnd ?? buffer.duration
  if (loopEnabled) {
    source.loop = true
    source.loopStart = loopStartSec
    source.loopEnd = loopEndSec
  }

  source.connect(node)
  // Engine node may already be connected to destination — make sure it is.
  // Repeatedly connecting is a no-op.
  node.connect(ctx.destination)

  const offset = Math.max(0, opts.offset ?? 0)
  startedAtCtxTime = ctx.currentTime
  startedAtBufferOffset = offset
  source.start(0, offset)

  source.onended = () => {
    if (currentSource === source) {
      stop()
      notifyEnded()
    }
  }

  currentSource = source
  currentBuffer = buffer
  // Start position polling.
  if (rafHandle == null) rafHandle = requestAnimationFrame(tickPosition)
}

/** Update loop region on the active source (if any) and remember for next play. */
export function setLoopRegion(startSec: number, endSec: number, enabled: boolean): void {
  loopStartSec = startSec
  loopEndSec = endSec
  loopEnabled = enabled
  if (currentSource) {
    currentSource.loop = enabled
    currentSource.loopStart = startSec
    currentSource.loopEnd = endSec
  }
}

export function isPlaying(): boolean {
  return currentSource !== null
}

export function getCurrentBuffer(): AudioBuffer | null {
  return currentBuffer
}

export function onEnded(listener: EndedListener): () => void {
  endedListeners.add(listener)
  return () => endedListeners.delete(listener)
}

export function onPosition(listener: PositionListener): () => void {
  positionListeners.add(listener)
  return () => positionListeners.delete(listener)
}
