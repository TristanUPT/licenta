/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export const alloc_f32: (a: number) => number;
export const create_engine: (a: number) => number;
export const dealloc_f32: (a: number, b: number) => void;
export const destroy_engine: (a: number) => void;
export const engine_add_effect: (a: number, b: number, c: number) => number;
export const engine_collect_meters: (a: number, b: number, c: number, d: number, e: number) => number;
export const engine_remove_effect: (a: number, b: number) => number;
export const engine_reorder: (a: number, b: number, c: number) => number;
export const engine_set_bypass: (a: number, b: number, c: number) => number;
export const engine_set_param: (a: number, b: number, c: number, d: number) => number;
export const get_blocks_processed: (a: number) => bigint;
export const process: (a: number, b: number, c: number, d: number) => number;
export const dealloc_u32: (a: number, b: number) => void;
export const alloc_u32: (a: number) => number;
