/**
 * Typed wrapper around the AudioWorklet message port.
 *
 * The port is owned by `engine.ts`, which installs a single message router
 * and dispatches to interested subscribers. This file only declares the
 * message shapes.
 */

export type WorkletInMsg =
  | { type: 'init'; wasmBytes: ArrayBuffer }
// More message variants land here in Phase 3+ (set_param, add_effect, …).

export type WorkletOutMsg =
  | { type: 'hello' }
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'stats'; blocksProcessed: number; inputRms: number; outputRms: number }
