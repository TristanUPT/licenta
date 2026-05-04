//! SoundLab DSP Engine
//!
//! Audio engine compiled to WebAssembly. Loaded directly inside the AudioWorklet
//! (not through wasm-bindgen JS glue) — see `public/worklets/dsp-processor.js`.
//!
//! Exposes plain `extern "C"` functions only. No `String` / `Vec` cross-boundary.

#![allow(clippy::missing_safety_doc)]

/// Per-block size (Web Audio API render quantum). Hardcoded by spec.
pub const RENDER_QUANTUM: usize = 128;

/// Real-time audio engine. In Phase 1 it is just a pass-through; effects come
/// in Phase 3 (chain of `Box<dyn Effect>` mutated via `set_param` messages).
pub struct Engine {
    #[allow(dead_code)]
    sample_rate: f32,
    blocks_processed: u64,
}

impl Engine {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate,
            blocks_processed: 0,
        }
    }

    pub fn process_block(&mut self, input: &[f32], output: &mut [f32]) {
        let n = input.len().min(output.len());
        output[..n].copy_from_slice(&input[..n]);
        if output.len() > n {
            for s in &mut output[n..] {
                *s = 0.0;
            }
        }
        self.blocks_processed = self.blocks_processed.wrapping_add(1);
    }

    pub fn blocks_processed(&self) -> u64 {
        self.blocks_processed
    }
}

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
    if engine.is_null() {
        return 0;
    }
    unsafe { (*engine).blocks_processed() }
}

// ──────────────────────────────────────────────────────────────────────────
//  Buffer alloc / dealloc — f32-aligned for safe Float32Array views from JS
// ──────────────────────────────────────────────────────────────────────────

/// Allocate `n` f32 slots in WASM linear memory. Returns a 4-byte-aligned
/// pointer suitable for `new Float32Array(buffer, ptr, n)`.
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn passthrough_copies_input_to_output() {
        let mut eng = Engine::new(48_000.0);
        let input: Vec<f32> = (0..RENDER_QUANTUM).map(|i| i as f32 * 0.001).collect();
        let mut output = vec![0.0_f32; RENDER_QUANTUM];
        eng.process_block(&input, &mut output);
        assert_eq!(input, output);
    }

    #[test]
    fn passthrough_zero_pads_when_output_larger() {
        let mut eng = Engine::new(48_000.0);
        let input = vec![1.0_f32; 8];
        let mut output = vec![9.9_f32; 16];
        eng.process_block(&input, &mut output);
        assert_eq!(&output[..8], &[1.0; 8]);
        assert_eq!(&output[8..], &[0.0; 8]);
    }

    #[test]
    fn block_counter_increments() {
        let mut eng = Engine::new(48_000.0);
        let input = [0.0_f32; 4];
        let mut output = [0.0_f32; 4];
        for _ in 0..5 {
            eng.process_block(&input, &mut output);
        }
        assert_eq!(eng.blocks_processed(), 5);
    }

    #[test]
    fn alloc_dealloc_roundtrip() {
        unsafe {
            let ptr = alloc_f32(128);
            assert!(!ptr.is_null());
            assert_eq!((ptr as usize) % 4, 0, "f32 alloc must be 4-byte aligned");
            dealloc_f32(ptr, 128);
        }
    }

    #[test]
    fn create_destroy_roundtrip() {
        unsafe {
            let eng = create_engine(48_000.0);
            assert!(!eng.is_null());
            let mut input = [0.5_f32; 4];
            let mut output = [0.0_f32; 4];
            let rc = process(eng, input.as_mut_ptr(), output.as_mut_ptr(), 4);
            assert_eq!(rc, 0);
            assert_eq!(output, [0.5, 0.5, 0.5, 0.5]);
            assert_eq!(get_blocks_processed(eng), 1);
            destroy_engine(eng);
        }
    }

    #[test]
    fn process_rejects_null_pointers() {
        unsafe {
            assert_eq!(
                process(core::ptr::null_mut(), core::ptr::null(), core::ptr::null_mut(), 0),
                -1
            );
        }
    }
}
