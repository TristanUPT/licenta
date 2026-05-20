import wasmUrl from '../../dsp/pkg/soundlab_dsp_bg.wasm?url'
import type { EffectInstance } from '@/types/effects'

const RENDER_QUANTUM = 128
const WARMUP_BLOCKS = 256

interface WasmExports {
  memory: WebAssembly.Memory
  create_engine:      (sampleRate: number) => number
  destroy_engine:     (ptr: number) => void
  process_stereo:     (engine: number, inL: number, inR: number, outL: number, outR: number, len: number) => number
  engine_add_effect:  (engine: number, type: number, id: number) => number
  engine_set_param:   (engine: number, id: number, paramId: number, value: number) => number
  engine_set_bypass:  (engine: number, id: number, bypassed: number) => number
  alloc_f32:          (n: number) => number
  dealloc_f32:        (ptr: number, n: number) => void
}

/**
 * Renders `audioBuffer` through the given effects chain in stereo, encodes
 * as 16-bit PCM stereo WAV, and triggers a browser download.
 */
export async function renderAndDownload(
  audioBuffer: AudioBuffer,
  effects: EffectInstance[],
  sourceFileName: string,
): Promise<void> {
  // ── 1. Instantiate WASM (browser-cached) ─────────────────────────────────
  const resp  = await fetch(wasmUrl)
  const bytes = await resp.arrayBuffer()
  const { instance } = await WebAssembly.instantiate(bytes, {})
  const wasm = instance.exports as unknown as WasmExports

  const sr = audioBuffer.sampleRate
  const enginePtr = wasm.create_engine(sr)

  // ── 2. Build effects chain ────────────────────────────────────────────────
  let nextId = 1
  for (const effect of effects) {
    const wasmId = nextId++
    wasm.engine_add_effect(enginePtr, effect.type, wasmId)
    for (const [paramId, value] of Object.entries(effect.params)) {
      wasm.engine_set_param(enginePtr, wasmId, Number(paramId), value)
    }
    if (effect.bypassed) wasm.engine_set_bypass(enginePtr, wasmId, 1)
  }

  // ── 3. Allocate stereo I/O buffers ────────────────────────────────────────
  const inLPtr  = wasm.alloc_f32(RENDER_QUANTUM)
  const inRPtr  = wasm.alloc_f32(RENDER_QUANTUM)
  const outLPtr = wasm.alloc_f32(RENDER_QUANTUM)
  const outRPtr = wasm.alloc_f32(RENDER_QUANTUM)

  // ── 4. Extract source channels (mono sources mirror L into R) ────────────
  const ch0 = audioBuffer.getChannelData(0)
  const ch1 = audioBuffer.numberOfChannels > 1
    ? audioBuffer.getChannelData(1)
    : ch0
  const totalSamples = ch0.length

  // ── 5. Warmup: settle smoothers / filter state ───────────────────────────
  for (let w = 0; w < WARMUP_BLOCKS; w++) {
    new Float32Array(wasm.memory.buffer, inLPtr,  RENDER_QUANTUM).fill(0)
    new Float32Array(wasm.memory.buffer, inRPtr,  RENDER_QUANTUM).fill(0)
    wasm.process_stereo(enginePtr, inLPtr, inRPtr, outLPtr, outRPtr, RENDER_QUANTUM)
  }

  // ── 6. Process block by block ─────────────────────────────────────────────
  const outL = new Float32Array(totalSamples)
  const outR = new Float32Array(totalSamples)

  for (let offset = 0; offset < totalSamples; offset += RENDER_QUANTUM) {
    const blockSize = Math.min(RENDER_QUANTUM, totalSamples - offset)
    // Re-obtain views each block (WASM memory.grow detaches typed arrays).
    const inLView  = new Float32Array(wasm.memory.buffer, inLPtr,  RENDER_QUANTUM)
    const inRView  = new Float32Array(wasm.memory.buffer, inRPtr,  RENDER_QUANTUM)
    const outLView = new Float32Array(wasm.memory.buffer, outLPtr, RENDER_QUANTUM)
    const outRView = new Float32Array(wasm.memory.buffer, outRPtr, RENDER_QUANTUM)

    inLView.fill(0)
    inRView.fill(0)
    inLView.set(ch0.subarray(offset, offset + blockSize))
    inRView.set(ch1.subarray(offset, offset + blockSize))

    wasm.process_stereo(enginePtr, inLPtr, inRPtr, outLPtr, outRPtr, RENDER_QUANTUM)

    outL.set(outLView.subarray(0, blockSize), offset)
    outR.set(outRView.subarray(0, blockSize), offset)
  }

  // ── 7. Cleanup WASM resources ─────────────────────────────────────────────
  wasm.dealloc_f32(inLPtr,  RENDER_QUANTUM)
  wasm.dealloc_f32(inRPtr,  RENDER_QUANTUM)
  wasm.dealloc_f32(outLPtr, RENDER_QUANTUM)
  wasm.dealloc_f32(outRPtr, RENDER_QUANTUM)
  wasm.destroy_engine(enginePtr)

  // ── 8. Encode stereo WAV and trigger download ─────────────────────────────
  const blob = encodeWav16Stereo(outL, outR, sr)
  const url  = URL.createObjectURL(blob)
  const stem = sourceFileName.replace(/\.[^.]+$/, '')
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${stem}_processed.wav`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── WAV encoder (16-bit PCM, stereo interleaved) ────────────────────────────

function encodeWav16Stereo(left: Float32Array, right: Float32Array, sampleRate: number): Blob {
  const numChannels   = 2
  const bitsPerSample = 16
  const byteRate      = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign    = numChannels * (bitsPerSample / 8)
  const numFrames     = left.length
  const dataBytes     = numFrames * blockAlign
  const buf           = new ArrayBuffer(44 + dataBytes)
  const v             = new DataView(buf)

  ws(v,  0, 'RIFF');  v.setUint32( 4, 36 + dataBytes, true)
  ws(v,  8, 'WAVE')
  ws(v, 12, 'fmt ');  v.setUint32(16, 16,           true)
                      v.setUint16(20, 1,             true)  // PCM
                      v.setUint16(22, numChannels,   true)
                      v.setUint32(24, sampleRate,    true)
                      v.setUint32(28, byteRate,      true)
                      v.setUint16(32, blockAlign,    true)
                      v.setUint16(34, bitsPerSample, true)
  ws(v, 36, 'data');  v.setUint32(40, dataBytes,     true)

  // Interleaved: L0, R0, L1, R1, …
  let off = 44
  for (let i = 0; i < numFrames; i++) {
    const l = Math.max(-1, Math.min(1, left[i]  ?? 0))
    const r = Math.max(-1, Math.min(1, right[i] ?? 0))
    v.setInt16(off,     l < 0 ? l * 0x8000 : l * 0x7fff, true)
    v.setInt16(off + 2, r < 0 ? r * 0x8000 : r * 0x7fff, true)
    off += 4
  }

  return new Blob([buf], { type: 'audio/wav' })
}

function ws(v: DataView, offset: number, s: string) {
  for (let i = 0; i < s.length; i++) v.setUint8(offset + i, s.charCodeAt(i))
}
