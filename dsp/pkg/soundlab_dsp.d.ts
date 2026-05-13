/* tslint:disable */
/* eslint-disable */

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly alloc_f32: (a: number) => number;
    readonly create_engine: (a: number) => number;
    readonly dealloc_f32: (a: number, b: number) => void;
    readonly destroy_engine: (a: number) => void;
    readonly engine_add_effect: (a: number, b: number, c: number) => number;
    readonly engine_collect_meters: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly engine_remove_effect: (a: number, b: number) => number;
    readonly engine_reorder: (a: number, b: number, c: number) => number;
    readonly engine_set_bypass: (a: number, b: number, c: number) => number;
    readonly engine_set_param: (a: number, b: number, c: number, d: number) => number;
    readonly get_blocks_processed: (a: number) => bigint;
    readonly process: (a: number, b: number, c: number, d: number) => number;
    readonly dealloc_u32: (a: number, b: number) => void;
    readonly alloc_u32: (a: number) => number;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
