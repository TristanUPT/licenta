import wasmUrl from '../../dsp/pkg/soundlab_dsp_bg.wasm?url'
import type { EffectInstance } from '@/types/effects'

const RENDER_QUANTUM = 128
// Process this many silent blocks before the real audio to let filter/smoother
// state settle. ~0.7 s at 48 kHz — avoids audible transients at the very start.
const WARMUP_BLOCKS = 256

interface WasmExports {
  memory: WebAssembly.Memory
  create_engine:      (sampleRate: number) => number
  destroy_engine:     (ptr: number) => void
  process:            (engine: number, inPtr: number, outPtr: number, len: number) => number
  engine_add_effect:  (engine: number, type: number, id: number) => number
  engine_set_param:   (engine: number, id: number, paramId: number, value: number) => number
  engine_set_bypass:  (engine: number, id: number, bypassed: number) => number
  alloc_f32:          (n: number) => number
  dealloc_f32:        (ptr: number, n: number) => void
}

/**
 * Renders `audioBuffer` through the given effects chain entirely in the main
 * thread (using a fresh WASM instance fetched from browser cache), encodes
 * the result as 16-bit PCM WAV, and triggers a browser download.
 */
export async function renderAndDownload(
  audioBuffer: AudioBuffer,
  effects: EffectInstance[],
  sourceFileName: string,
): Promise<void> {
  // ── 1. Instantiate a fresh WASM module (browser-cached → fast) ──────────
  const resp  = await fetch(wasmUrl)
  const bytes = await resp.arrayBuffer()
  const { instance } = await WebAssembly.instantiate(bytes, {})
  const wasm = instance.exports as unknown as WasmExports

  const sr = audioBuffer.sampleRate
  const enginePtr = wasm.create_engine(sr)

  // ── 2. Build the effects chain (respects per-effect bypass state) ────────
  let nextId = 1
  for (const effect of effects) {
    const wasmId = nextId++
    wasm.engine_add_effect(enginePtr, effect.type, wasmId)
    for (const [paramId, value] of Object.entries(effect.params)) {
      wasm.engine_set_param(enginePtr, wasmId, Number(paramId), value)
    }
    if (effect.bypassed) wasm.engine_set_bypass(enginePtr, wasmId, 1)
  }

  // ── 3. Allocate I/O buffers in WASM linear memory ───────────────────────
  const inputPtr  = wasm.alloc_f32(RENDER_QUANTUM)
  const outputPtr = wasm.alloc_f32(RENDER_QUANTUM)

  // ── 4. Mix source to mono ────────────────────────────────────────────────
  const ch0 = audioBuffer.getChannelData(0)
  const totalSamples = ch0.length
  const mono = new Float32Array(totalSamples)
  if (audioBuffer.numberOfChannels > 1) {
    const ch1 = audioBuffer.getChannelData(1)
    for (let i = 0; i < totalSamples; i++) {
      mono[i] = ((ch0[i] ?? 0) + (ch1[i] ?? 0)) * 0.5
    }
  } else {
    mono.set(ch0)
  }

  // ── 5. Warmup: process silence to settle smoothers and filter states ─────
  for (let w = 0; w < WARMUP_BLOCKS; w++) {
    new Float32Array(wasm.memory.buffer, inputPtr, RENDER_QUANTUM).fill(0)
    wasm.process(enginePtr, inputPtr, outputPtr, RENDER_QUANTUM)
  }

  // ── 6. Process audio block by block (128 samples per quantum) ───────────
  const processed = new Float32Array(totalSamples)
  for (let offset = 0; offset < totalSamples; offset += RENDER_QUANTUM) {
    // Re-obtain views each block: a WASM memory.grow could detach the buffer.
    const inView  = new Float32Array(wasm.memory.buffer, inputPtr,  RENDER_QUANTUM)
    const outView = new Float32Array(wasm.memory.buffer, outputPtr, RENDER_QUANTUM)
    const blockSize = Math.min(RENDER_QUANTUM, totalSamples - offset)
    inView.fill(0)
    inView.set(mono.subarray(offset, offset + blockSize))
    wasm.process(enginePtr, inputPtr, outputPtr, RENDER_QUANTUM)
    processed.set(outView.subarray(0, blockSize), offset)
  }

  // ── 7. Cleanup WASM resources ────────────────────────────────────────────
  wasm.dealloc_f32(inputPtr,  RENDER_QUANTUM)
  wasm.dealloc_f32(outputPtr, RENDER_QUANTUM)
  wasm.destroy_engine(enginePtr)

  // ── 8. Encode to 16-bit PCM WAV and trigger download ────────────────────
  const blob     = encodeWav16(processed, sr)
  const url      = URL.createObjectURL(blob)
  const stem     = sourceFileName.replace(/\.[^.]+$/, '')
  const a        = document.createElement('a')
  a.href         = url
  a.download     = `${stem}_processed.wav`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── WAV encoder (16-bit PCM, mono) ──────────────────────────────────────────

function encodeWav16(samples: Float32Array, sampleRate: number): Blob {
  const numChannels   = 1
  const bitsPerSample = 16
  const byteRate      = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign    = numChannels * (bitsPerSample / 8)
  const dataBytes     = samples.length * blockAlign
  const buf           = new ArrayBuffer(44 + dataBytes)
  const v             = new DataView(buf)

  // RIFF chunk descriptor
  ws(v,  0, 'RIFF');  v.setUint32( 4, 36 + dataBytes, true)
  ws(v,  8, 'WAVE')
  // fmt sub-chunk
  ws(v, 12, 'fmt ');  v.setUint32(16, 16,             true)
                      v.setUint16(20, 1,              true)   // PCM
                      v.setUint16(22, numChannels,    true)
                      v.setUint32(24, sampleRate,     true)
                      v.setUint32(28, byteRate,       true)
                      v.setUint16(32, blockAlign,     true)
                      v.setUint16(34, bitsPerSample,  true)
  // data sub-chunk
  ws(v, 36, 'data');  v.setUint32(40, dataBytes,      true)

  // Samples: clamp float → int16 little-endian
  let off = 44
  for (let i = 0; i < samples.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0))
    v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }

  return new Blob([buf], { type: 'audio/wav' })
}

function ws(v: DataView, offset: number, s: string) {
  for (let i = 0; i < s.length; i++) v.setUint8(offset + i, s.charCodeAt(i))
}
