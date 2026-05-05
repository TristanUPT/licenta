/**
 * Wire-format messages between the main thread and the AudioWorklet.
 * The port itself is owned by `engine.ts` (single message router).
 */

export type WorkletInMsg =
  | { type: 'init'; wasmBytes: ArrayBuffer }
  | { type: 'add_effect'; effectType: number; instanceId: number }
  | { type: 'remove_effect'; instanceId: number }
  | { type: 'set_param'; instanceId: number; paramId: number; value: number }
  | { type: 'set_bypass'; instanceId: number; bypassed: boolean }
  | { type: 'reorder'; order: number[] }

export type WorkletOutMsg =
  | { type: 'hello' }
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | {
      type: 'stats'
      blocksProcessed: number
      inputRms: number
      outputRms: number
      outputPeak: number
      /** Primary meter (id 0) per effect: e.g. compressor gain reduction in dB. */
      effectMeters: { id: number; value: number }[]
    }
