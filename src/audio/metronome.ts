import { getContext, start as startEngine } from './engine'

const LOOKAHEAD_SEC = 0.1
const SCHEDULE_INTERVAL_MS = 25

type BeatListener = (beat: number, accented: boolean) => void

let ctx: AudioContext | null = null
let bpm = 120
let beatsPerMeasure = 4
let currentBeat = 0
let nextNoteTime = 0
let timerID: number | null = null
let running = false

const beatListeners = new Set<BeatListener>()

function scheduleClick(time: number, beatIndex: number, accented: boolean) {
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = accented ? 1200 : 800
  const peakGain = accented ? 1.0 : 0.7
  const dur = accented ? 0.02 : 0.015
  gain.gain.setValueAtTime(peakGain, time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + dur)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(time)
  osc.stop(time + dur + 0.01)

  const delayMs = Math.max(0, (time - ctx.currentTime) * 1000)
  setTimeout(() => {
    for (const l of beatListeners) l(beatIndex, accented)
  }, delayMs)
}

function scheduler() {
  if (!ctx || !running) return
  while (nextNoteTime < ctx.currentTime + LOOKAHEAD_SEC) {
    const accented = currentBeat === 0
    scheduleClick(nextNoteTime, currentBeat, accented)
    nextNoteTime += 60.0 / bpm
    currentBeat = (currentBeat + 1) % beatsPerMeasure
  }
  timerID = window.setTimeout(scheduler, SCHEDULE_INTERVAL_MS)
}

export async function startMetronome(): Promise<void> {
  if (running) return
  ctx = getContext()
  if (!ctx) {
    await startEngine()
    ctx = getContext()
  }
  if (!ctx) return
  if (ctx.state === 'suspended') await ctx.resume()

  running = true
  currentBeat = 0
  nextNoteTime = ctx.currentTime + 0.05
  scheduler()
}

export function stopMetronome(): void {
  running = false
  if (timerID !== null) {
    clearTimeout(timerID)
    timerID = null
  }
  currentBeat = 0
}

export function isRunning(): boolean {
  return running
}

export function setBpm(value: number): void {
  bpm = Math.max(40, Math.min(240, value))
}

export function getBpm(): number {
  return bpm
}

export function setBeatsPerMeasure(beats: number): void {
  beatsPerMeasure = beats
  if (currentBeat >= beats) currentBeat = 0
}

export function onBeat(listener: BeatListener): () => void {
  beatListeners.add(listener)
  return () => beatListeners.delete(listener)
}
