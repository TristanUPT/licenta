//! SoundLab DSP — `extern "C"` facade for the AudioWorklet.
//!
//! All real logic lives in `engine.rs` and `effects/*.rs`. Functions here
//! only marshal pointers / primitives across the WASM boundary.

#![allow(clippy::missing_safety_doc)]

pub mod effects;
pub mod engine;
pub mod utils;

pub use engine::{Engine, RENDER_QUANTUM};

// ──────────────────────────────────────────────────────────────────────────
//  Engine lifecycle
// ──────────────────────────────────────────────────────────────────────────

#[unsafe(no_mangle)]
pub extern "C" fn create_engine(sample_rate: f32) -> *mut Engine {
    Box::into_raw(Box::new(Engine::new(sample_rate)))
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn destroy_engine(ptr: *mut Engine) {
    if !ptr.is_null() {
        unsafe { drop(Box::from_raw(ptr)) };
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn process(
    engine: *mut Engine,
    input_ptr: *const f32,
    output_ptr: *mut f32,
    len: u32,
) -> i32 {
    if engine.is_null() || input_ptr.is_null() || output_ptr.is_null() {
        return -1;
    }
    let n = len as usize;
    unsafe {
        let input = core::slice::from_raw_parts(input_ptr, n);
        let output = core::slice::from_raw_parts_mut(output_ptr, n);
        (*engine).process_block(input, output);
    }
    0
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn get_blocks_processed(engine: *const Engine) -> u64 {
    if engine.is_null() { return 0 }
    unsafe { (*engine).blocks_processed() }
}

// ──────────────────────────────────────────────────────────────────────────
//  Chain mutators
// ──────────────────────────────────────────────────────────────────────────

#[unsafe(no_mangle)]
pub unsafe extern "C" fn engine_add_effect(
    engine: *mut Engine,
    effect_type: u32,
    instance_id: u32,
) -> i32 {
    if engine.is_null() { return -100 }
    unsafe { (*engine).add_effect(effect_type, instance_id) }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn engine_remove_effect(
    engine: *mut Engine,
    instance_id: u32,
) -> i32 {
    if engine.is_null() { return -100 }
    unsafe { (*engine).remove_effect(instance_id) }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn engine_set_param(
    engine: *mut Engine,
    instance_id: u32,
    param_id: u32,
    value: f32,
) -> i32 {
    if engine.is_null() { return -100 }
    unsafe { (*engine).set_param(instance_id, param_id, value) }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn engine_set_bypass(
    engine: *mut Engine,
    instance_id: u32,
    bypassed: u32,
) -> i32 {
    if engine.is_null() { return -100 }
    unsafe { (*engine).set_bypass(instance_id, bypassed != 0) }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn engine_reorder(
    engine: *mut Engine,
    ids_ptr: *const u32,
    len: u32,
) -> i32 {
    if engine.is_null() || ids_ptr.is_null() { return -100 }
    let n = len as usize;
    let order = unsafe { core::slice::from_raw_parts(ids_ptr, n) };
    unsafe { (*engine).reorder(order) }
}

/// Snapshot every effect's meter into JS-side buffers.
/// Returns the number of (id, value) pairs written, or 0 on error.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn engine_collect_meters(
    engine: *const Engine,
    meter_id: u32,
    ids_ptr: *mut u32,
    values_ptr: *mut f32,
    capacity: u32,
) -> u32 {
    if engine.is_null() || ids_ptr.is_null() || values_ptr.is_null() {
        return 0;
    }
    let cap = capacity as usize;
    unsafe {
        let ids = core::slice::from_raw_parts_mut(ids_ptr, cap);
        let vals = core::slice::from_raw_parts_mut(values_ptr, cap);
        (*engine).collect_meters(meter_id, ids, vals)
    }
}

// ──────────────────────────────────────────────────────────────────────────
//  Buffer alloc / dealloc — f32-aligned for safe Float32Array views from JS
// ──────────────────────────────────────────────────────────────────────────

#[unsafe(no_mangle)]
pub extern "C" fn alloc_f32(n: usize) -> *mut f32 {
    let mut buf = Vec::<f32>::with_capacity(n);
    let ptr = buf.as_mut_ptr();
    core::mem::forget(buf);
    ptr
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn dealloc_f32(ptr: *mut f32, n: usize) {
    if !ptr.is_null() {
        unsafe { drop(Vec::from_raw_parts(ptr, 0, n)) };
    }
}

/// Allocate `n` u32 slots — used for chain reorder lists.
#[unsafe(no_mangle)]
pub extern "C" fn alloc_u32(n: usize) -> *mut u32 {
    let mut buf = Vec::<u32>::with_capacity(n);
    let ptr = buf.as_mut_ptr();
    core::mem::forget(buf);
    ptr
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn dealloc_u32(ptr: *mut u32, n: usize) {
    if !ptr.is_null() {
        unsafe { drop(Vec::from_raw_parts(ptr, 0, n)) };
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ffi_roundtrip_with_gain() {
        unsafe {
            let eng = create_engine(48_000.0);
            assert!(!eng.is_null());

            // Add Gain (type=0) with id=42, set -6 dB.
            assert_eq!(engine_add_effect(eng, 0, 42), 0);
            assert_eq!(engine_set_param(eng, 42, 0, -6.0206), 0);

            // Pump audio — settle the smoother — then inspect.
            let mut input = [1.0_f32; 128];
            let mut output = [0.0_f32; 128];
            for _ in 0..50 {
                process(eng, input.as_mut_ptr(), output.as_mut_ptr(), 128);
            }
            let avg = output.iter().sum::<f32>() / 128.0;
            assert!((avg - 0.5).abs() < 1e-3);

            assert_eq!(engine_set_bypass(eng, 42, 1), 0);
            for _ in 0..50 {
                process(eng, input.as_mut_ptr(), output.as_mut_ptr(), 128);
            }
            assert!((output[127] - 1.0).abs() < 1e-6);

            destroy_engine(eng);
        }
    }
}
