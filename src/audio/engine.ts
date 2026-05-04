import type { WorkletInMsg, WorkletOutMsg } from './worklet-bridge'

import wasmUrl from '../../dsp/pkg/soundlab_dsp_bg.wasm?url'

const WORKLET_URL = '/worklets/dsp-processor.js'
const SAMPLE_RATE = 48_000
const HELLO_TIMEOUT_MS = 8000
const READY_TIMEOUT_MS = 8000

export type EngineStatus = 'idle' | 'starting' | 'running' | 'error'

export interface EngineStats {
  blocksProcessed: number
  inputRms: number
  outputRms: number
}

type Listener = (status: EngineStatus, error?: string) => void
type StatsListener = (stats: EngineStats) => void

let ctx: AudioContext | null = null
let node: AudioWorkletNode | null = null
let status: EngineStatus = 'idle'
let lastError: string | undefined
const listeners = new Set<Listener>()
const statsListeners = new Set<StatsListener>()

// Init handshake state
let helloResolve: (() => void) | null = null
let readyResolve: (() => void) | null = null
let initReject: ((err: Error) => void) | null = null

function setStatus(next: EngineStatus, error?: string) {
  status = next
  lastError = error
  for (const l of listeners) l(next, error)
}

/** Single message router. Dispatches every WorkletOutMsg to the right place. */
function handleWorkletMessage(event: MessageEvent<WorkletOutMsg>) {
  const data = event.data
  switch (data.type) {
    case 'hello':
      helloResolve?.()
      helloResolve = null
      break
    case 'ready':
      readyResolve?.()
      readyResolve = null
      break
    case 'error':
      initReject?.(new Error(`Worklet error: ${data.message}`))
      initReject = null
      setStatus('error', data.message)
      break
    case 'stats':
      for (const l of statsListeners) l(data)
      break
  }
}

function waitWith(setResolve: (r: () => void) => void, timeoutMs: number, label: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`))
    }, timeoutMs)
    setResolve(() => {
      clearTimeout(timer)
      resolve()
    })
    initReject = (e) => {
      clearTimeout(timer)
      reject(e)
    }
  })
}

export async function start(): Promise<void> {
  if (status === 'running') {
    if (ctx && ctx.state === 'suspended') await ctx.resume()
    return
  }
  if (status === 'starting') return

  setStatus('starting')
  try {
    if (!ctx) {
      ctx = new AudioContext({ sampleRate: SAMPLE_RATE, latencyHint: 'interactive' })
      document.addEventListener('visibilitychange', () => {
        if (!ctx) return
        if (document.hidden && ctx.state === 'running') void ctx.suspend()
        else if (!document.hidden && ctx.state === 'suspended') void ctx.resume()
      })
    }
    if (ctx.state === 'suspended') await ctx.resume()

    if (!node) {
      // 1) Register the AudioWorklet processor module.
      await ctx.audioWorklet.addModule(WORKLET_URL)

      // 2) Fetch the WASM bytes (worklets cannot fetch). We ship the raw
      //    bytes — structured-cloning a WebAssembly.Module across the
      //    main↔AudioWorklet boundary is unreliable in some browsers.
      const response = await fetch(wasmUrl)
      const wasmBytes = await response.arrayBuffer()

      // 3) Create the node and wire up the single message router *before*
      //    posting anything. AudioWorkletNode construction triggers the
      //    worklet-side processor constructor asynchronously, which posts
      //    a 'hello'. We wait for that before sending 'init'.
      const newNode = new AudioWorkletNode(ctx, 'dsp-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      })
      newNode.port.addEventListener('message', handleWorkletMessage)
      newNode.port.start()

      // Wait for the worklet's 'hello' before sending init.
      await waitWith((r) => { helloResolve = r }, HELLO_TIMEOUT_MS, 'Worklet hello')

      // Send the WASM bytes (transferable) and wait for 'ready'.
      const readyPromise = waitWith((r) => { readyResolve = r }, READY_TIMEOUT_MS, 'Worklet ready')
      const initMsg: WorkletInMsg = { type: 'init', wasmBytes }
      newNode.port.postMessage(initMsg, [wasmBytes])
      await readyPromise

      node = newNode
    }

    setStatus('running')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    setStatus('error', message)
    throw err
  }
}

export async function stop(): Promise<void> {
  if (ctx && ctx.state === 'running') await ctx.suspend()
  if (status === 'running') setStatus('idle')
}

export function getContext(): AudioContext | null {
  return ctx
}

export function getNode(): AudioWorkletNode | null {
  return node
}

export function getStatus(): { status: EngineStatus; error?: string } {
  return { status, error: lastError }
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function subscribeStats(listener: StatsListener): () => void {
  statsListeners.add(listener)
  return () => statsListeners.delete(listener)
}

// ──────────────────────────────────────────────────────────────────────────
//  Effect-chain controls (forward to worklet via typed messages)
// ──────────────────────────────────────────────────────────────────────────

function postOrThrow(msg: WorkletInMsg): void {
  if (!node) throw new Error('Engine not running — call start() first.')
  node.port.postMessage(msg)
}

export function addEffect(effectType: number, instanceId: number): void {
  postOrThrow({ type: 'add_effect', effectType, instanceId })
}

export function removeEffect(instanceId: number): void {
  postOrThrow({ type: 'remove_effect', instanceId })
}

export function setParam(instanceId: number, paramId: number, value: number): void {
  postOrThrow({ type: 'set_param', instanceId, paramId, value })
}

export function setBypass(instanceId: number, bypassed: boolean): void {
  postOrThrow({ type: 'set_bypass', instanceId, bypassed })
}

export function reorderEffects(order: number[]): void {
  postOrThrow({ type: 'reorder', order })
}
