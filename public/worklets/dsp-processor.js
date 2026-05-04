// SoundLab DSP AudioWorklet processor.
//
// Runs in AudioWorkletGlobalScope (separate thread, no DOM/fetch/window).
// Loads the SoundLab DSP WASM module sent from the main thread and forwards
// audio frames through it.
//
// Wire-format messages:
//   main → worklet: { type: 'init', wasmModule: WebAssembly.Module }
//   worklet → main: { type: 'hello' }                (sent at construction)
//                   { type: 'ready' }                (sent after WASM init)
//                   { type: 'error', message }
//                   { type: 'stats', blocksProcessed, inputRms, outputRms }

const RENDER_QUANTUM = 128;
const STATS_EVERY_N_BLOCKS = 37;  // ≈ 100 ms at 48 kHz/128

class DspProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ready = false;
    this.wasm = null;
    this.enginePtr = 0;
    this.inputPtr = 0;
    this.outputPtr = 0;
    this.inputView = null;
    this.outputView = null;
    this.localBlockCount = 0;

    this.port.onmessage = (event) => this._onMessage(event.data);
    // Tell the main thread we exist and are ready to receive `init`.
    this.port.postMessage({ type: 'hello' });
    console.log('[worklet] processor constructed; sent hello');
  }

  _onMessage(msg) {
    if (msg && msg.type === 'init') {
      console.log('[worklet] init received, compiling WASM…');
      this._init(msg.wasmBytes).catch((err) => {
        const message = err && err.message ? err.message : String(err);
        console.error('[worklet] init error:', message);
        this.port.postMessage({ type: 'error', message });
      });
    }
  }

  async _init(wasmBytes) {
    const { instance } = await WebAssembly.instantiate(wasmBytes, {});
    this.wasm = instance.exports;
    console.log('[worklet] wasm exports:', Object.keys(this.wasm));

    // alloc_f32 returns a 4-byte-aligned f32 pointer.
    this.inputPtr = this.wasm.alloc_f32(RENDER_QUANTUM);
    this.outputPtr = this.wasm.alloc_f32(RENDER_QUANTUM);
    this.enginePtr = this.wasm.create_engine(sampleRate);
    // Refresh views AFTER all allocations to handle any memory growth.
    this._refreshViews();

    this.ready = true;
    console.log(
      '[worklet] ready. enginePtr=', this.enginePtr,
      'inputPtr=', this.inputPtr,
      'outputPtr=', this.outputPtr,
      'sampleRate=', sampleRate,
    );
    this.port.postMessage({ type: 'ready' });
  }

  _refreshViews() {
    // WASM pointers are byte offsets into linear memory regardless of pointee
    // type. alloc_f32 guarantees a 4-byte-aligned offset.
    const buffer = this.wasm.memory.buffer;
    this.inputView = new Float32Array(buffer, this.inputPtr, RENDER_QUANTUM);
    this.outputView = new Float32Array(buffer, this.outputPtr, RENDER_QUANTUM);
  }

  process(inputs, outputs) {
    if (!this.ready) return true;

    const input = inputs[0];
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    // If our views detached due to memory growth, recover.
    if (this.inputView.length === 0) this._refreshViews();

    // Mono-collapse the input.
    if (input && input.length > 0 && input[0] && input[0].length > 0) {
      const ch0 = input[0];
      if (input.length > 1 && input[1] && input[1].length > 0) {
        const ch1 = input[1];
        for (let i = 0; i < RENDER_QUANTUM; i++) {
          this.inputView[i] = (ch0[i] + ch1[i]) * 0.5;
        }
      } else {
        this.inputView.set(ch0);
      }
    } else {
      this.inputView.fill(0);
    }

    const rc = this.wasm.process(
      this.enginePtr,
      this.inputPtr,
      this.outputPtr,
      RENDER_QUANTUM,
    );
    if (rc !== 0) {
      for (let ch = 0; ch < output.length; ch++) output[ch].fill(0);
      return true;
    }

    for (let ch = 0; ch < output.length; ch++) {
      output[ch].set(this.outputView);
    }

    this.localBlockCount++;
    if (this.localBlockCount % STATS_EVERY_N_BLOCKS === 0) {
      let inSumSq = 0;
      let outSumSq = 0;
      for (let i = 0; i < RENDER_QUANTUM; i++) {
        inSumSq += this.inputView[i] * this.inputView[i];
        outSumSq += this.outputView[i] * this.outputView[i];
      }
      this.port.postMessage({
        type: 'stats',
        blocksProcessed: this.localBlockCount,
        inputRms: Math.sqrt(inSumSq / RENDER_QUANTUM),
        outputRms: Math.sqrt(outSumSq / RENDER_QUANTUM),
      });
    }

    return true;
  }
}

registerProcessor('dsp-processor', DspProcessor);
