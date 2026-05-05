// SoundLab DSP AudioWorklet processor.
// Runs in AudioWorkletGlobalScope. Loads the SoundLab DSP WASM module sent
// from the main thread and forwards audio frames + control messages.

const RENDER_QUANTUM = 128;
// Stats batched at ≈ 30 Hz at 48 kHz / 128 → every 12 blocks.
const STATS_EVERY_N_BLOCKS = 12;
const MAX_METER_SLOTS = 32;

class DspProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ready = false;
    this.wasm = null;
    this.enginePtr = 0;
    this.inputPtr = 0;
    this.outputPtr = 0;
    this.meterIdsPtr = 0;
    this.meterValsPtr = 0;
    this.inputView = null;
    this.outputView = null;
    this.meterIdsView = null;
    this.meterValsView = null;
    this.localBlockCount = 0;

    this.port.onmessage = (event) => this._onMessage(event.data);
    this.port.postMessage({ type: 'hello' });
    console.log('[worklet] processor constructed; sent hello');
  }

  _onMessage(msg) {
    if (!msg) return;
    try {
      switch (msg.type) {
        case 'init':
          this._init(msg.wasmBytes).catch((err) => this._postError(err, 'init'));
          break;
        case 'add_effect':
          if (this.ready) {
            const rc = this.wasm.engine_add_effect(this.enginePtr, msg.effectType, msg.instanceId);
            if (rc !== 0) console.warn('[worklet] add_effect rc=', rc);
          }
          break;
        case 'remove_effect':
          if (this.ready) this.wasm.engine_remove_effect(this.enginePtr, msg.instanceId);
          break;
        case 'set_param':
          if (this.ready) this.wasm.engine_set_param(this.enginePtr, msg.instanceId, msg.paramId, msg.value);
          break;
        case 'set_bypass':
          if (this.ready) this.wasm.engine_set_bypass(this.enginePtr, msg.instanceId, msg.bypassed ? 1 : 0);
          break;
        case 'reorder':
          if (this.ready) this._reorder(msg.order);
          break;
      }
    } catch (err) {
      this._postError(err, 'message');
    }
  }

  _postError(err, context) {
    const message = err && err.message ? err.message : String(err);
    console.error(`[worklet] ${context} error:`, message);
    this.port.postMessage({ type: 'error', message: `${context}: ${message}` });
  }

  async _init(wasmBytes) {
    console.log('[worklet] init received, compiling WASM…');
    const { instance } = await WebAssembly.instantiate(wasmBytes, {});
    this.wasm = instance.exports;
    console.log('[worklet] wasm exports:', Object.keys(this.wasm));

    this.inputPtr = this.wasm.alloc_f32(RENDER_QUANTUM);
    this.outputPtr = this.wasm.alloc_f32(RENDER_QUANTUM);
    this.meterIdsPtr = this.wasm.alloc_u32(MAX_METER_SLOTS);
    this.meterValsPtr = this.wasm.alloc_f32(MAX_METER_SLOTS);
    this.enginePtr = this.wasm.create_engine(sampleRate);
    this._refreshViews();

    this.ready = true;
    console.log('[worklet] ready. enginePtr=', this.enginePtr, 'sampleRate=', sampleRate);
    this.port.postMessage({ type: 'ready' });
  }

  _reorder(order) {
    if (!Array.isArray(order) || order.length === 0) return;
    const ptr = this.wasm.alloc_u32(order.length);
    try {
      const view = new Uint32Array(this.wasm.memory.buffer, ptr, order.length);
      for (let i = 0; i < order.length; i++) view[i] = order[i] >>> 0;
      this.wasm.engine_reorder(this.enginePtr, ptr, order.length);
    } finally {
      this.wasm.dealloc_u32(ptr, order.length);
    }
  }

  _refreshViews() {
    const buffer = this.wasm.memory.buffer;
    this.inputView = new Float32Array(buffer, this.inputPtr, RENDER_QUANTUM);
    this.outputView = new Float32Array(buffer, this.outputPtr, RENDER_QUANTUM);
    this.meterIdsView = new Uint32Array(buffer, this.meterIdsPtr, MAX_METER_SLOTS);
    this.meterValsView = new Float32Array(buffer, this.meterValsPtr, MAX_METER_SLOTS);
  }

  process(inputs, outputs) {
    if (!this.ready) return true;

    const input = inputs[0];
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    if (this.inputView.length === 0) this._refreshViews();

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
      let outPeak = 0;
      for (let i = 0; i < RENDER_QUANTUM; i++) {
        const inS = this.inputView[i];
        const outS = this.outputView[i];
        inSumSq += inS * inS;
        outSumSq += outS * outS;
        const a = outS < 0 ? -outS : outS;
        if (a > outPeak) outPeak = a;
      }
      // Snapshot per-effect primary meters (compressor GR, etc.).
      const count = this.wasm.engine_collect_meters(
        this.enginePtr,
        0,
        this.meterIdsPtr,
        this.meterValsPtr,
        MAX_METER_SLOTS,
      );
      const effectMeters = new Array(count);
      for (let i = 0; i < count; i++) {
        effectMeters[i] = { id: this.meterIdsView[i], value: this.meterValsView[i] };
      }
      this.port.postMessage({
        type: 'stats',
        blocksProcessed: this.localBlockCount,
        inputRms: Math.sqrt(inSumSq / RENDER_QUANTUM),
        outputRms: Math.sqrt(outSumSq / RENDER_QUANTUM),
        outputPeak: outPeak,
        effectMeters,
      });
    }

    return true;
  }
}

registerProcessor('dsp-processor', DspProcessor);
