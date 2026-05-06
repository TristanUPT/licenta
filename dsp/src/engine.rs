//! Real-time audio engine.
//!
//! Owns a chain of `Effect` instances, dispatches per-block processing
//! (ping-pong buffers), and exposes mutator methods for the chain.
//! The thin `extern "C"` facade lives in `lib.rs`.

use crate::effects::{build, Effect, EffectType};

pub const RENDER_QUANTUM: usize = 128;

struct EffectSlot {
    id: u32,
    bypassed: bool,
    effect: Box<dyn Effect>,
}

pub struct Engine {
    sample_rate: f32,
    chain: Vec<EffectSlot>,
    /// Working buffers (ping-pong). Pre-allocated; never resized in `process`.
    work_buf: Vec<f32>,
    temp_buf: Vec<f32>,
    blocks_processed: u64,
}

impl Engine {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate,
            chain: Vec::with_capacity(16),
            work_buf: vec![0.0; RENDER_QUANTUM],
            temp_buf: vec![0.0; RENDER_QUANTUM],
            blocks_processed: 0,
        }
    }

    pub fn process_block(&mut self, input: &[f32], output: &mut [f32]) {
        let n = input.len().min(output.len()).min(RENDER_QUANTUM);

        if self.chain.is_empty() {
            output[..n].copy_from_slice(&input[..n]);
            if output.len() > n {
                for s in &mut output[n..] {
                    *s = 0.0;
                }
            }
            self.blocks_processed = self.blocks_processed.wrapping_add(1);
            return
        }

        // Seed the ping-pong with the input.
        self.work_buf[..n].copy_from_slice(&input[..n]);

        // Disjoint borrows of struct fields are allowed.
        let chain = &mut self.chain;
        let mut work: &mut [f32] = &mut self.work_buf[..n];
        let mut temp: &mut [f32] = &mut self.temp_buf[..n];

        for slot in chain.iter_mut() {
            if slot.bypassed {
                continue;
            }
            slot.effect.process(work, temp);
            core::mem::swap(&mut work, &mut temp);
        }

        // `work` now points at the post-final-effect buffer.
        output[..n].copy_from_slice(work);
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

    /// Append a new effect to the chain. Returns 0 on success, -1 on unknown
    /// effect type, -2 on duplicate id.
    pub fn add_effect(&mut self, effect_type_id: u32, instance_id: u32) -> i32 {
        let Some(effect_type) = EffectType::from_u32(effect_type_id) else {
            return -1;
        };
        if self.chain.iter().any(|s| s.id == instance_id) {
            return -2;
        }
        let effect = build(effect_type, self.sample_rate);
        self.chain.push(EffectSlot { id: instance_id, bypassed: false, effect });
        0
    }

    /// Remove an effect by id. Returns 0 on success, -1 if not found.
    pub fn remove_effect(&mut self, instance_id: u32) -> i32 {
        let pos = self.chain.iter().position(|s| s.id == instance_id);
        match pos {
            Some(i) => { self.chain.remove(i); 0 }
            None => -1,
        }
    }

    pub fn set_param(&mut self, instance_id: u32, param_id: u32, value: f32) -> i32 {
        match self.chain.iter_mut().find(|s| s.id == instance_id) {
            Some(slot) => { slot.effect.set_param(param_id, value); 0 }
            None => -1,
        }
    }

    pub fn set_bypass(&mut self, instance_id: u32, bypassed: bool) -> i32 {
        match self.chain.iter_mut().find(|s| s.id == instance_id) {
            Some(slot) => { slot.bypassed = bypassed; 0 }
            None => -1,
        }
    }

    /// Snapshot every effect's meter into the supplied buffers.
    /// Returns the number of slots filled (≤ chain.len() and ≤ buf capacities).
    pub fn collect_meters(
        &self,
        meter_id: u32,
        ids: &mut [u32],
        values: &mut [f32],
    ) -> u32 {
        let cap = ids.len().min(values.len()).min(self.chain.len());
        for i in 0..cap {
            ids[i] = self.chain[i].id;
            values[i] = self.chain[i].effect.get_meter(meter_id);
        }
        cap as u32
    }

    /// Reorder the chain to match `order`. Each id in `order` must already
    /// exist in the chain; missing ids leave their slots unchanged at the
    /// tail. Returns 0 on success, -1 if any id is unknown.
    pub fn reorder(&mut self, order: &[u32]) -> i32 {
        // Fast validation: every id in `order` must currently be in the chain.
        for &id in order {
            if !self.chain.iter().any(|s| s.id == id) {
                return -1;
            }
        }
        let mut reordered: Vec<EffectSlot> = Vec::with_capacity(self.chain.len());
        for &id in order {
            if let Some(pos) = self.chain.iter().position(|s| s.id == id) {
                reordered.push(self.chain.remove(pos));
            }
        }
        // Append any leftovers (chain ids not present in `order`) so we don't
        // silently drop effects.
        reordered.append(&mut self.chain);
        self.chain = reordered;
        0
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::effects::gain::PARAM_GAIN_DB;

    #[test]
    fn empty_chain_is_passthrough() {
        let mut eng = Engine::new(48_000.0);
        let input: Vec<f32> = (0..128).map(|i| i as f32 * 0.001).collect();
        let mut output = vec![0.0_f32; 128];
        eng.process_block(&input, &mut output);
        assert_eq!(input, output);
    }

    #[test]
    fn add_remove_works() {
        let mut eng = Engine::new(48_000.0);
        assert_eq!(eng.add_effect(0, 1), 0);  // Gain, id=1
        assert_eq!(eng.add_effect(0, 1), -2); // duplicate
        assert_eq!(eng.add_effect(99, 2), -1);// unknown type
        assert_eq!(eng.remove_effect(1), 0);
        assert_eq!(eng.remove_effect(1), -1); // not found
    }

    #[test]
    fn gain_in_chain_attenuates_signal() {
        let mut eng = Engine::new(48_000.0);
        eng.add_effect(0, 1);
        eng.set_param(1, PARAM_GAIN_DB, -6.0206);
        // Pump enough audio for the smoother to fully settle (~130ms).
        let block = vec![1.0_f32; 128];
        let mut out = vec![0.0_f32; 128];
        for _ in 0..50 {
            eng.process_block(&block, &mut out);
        }
        let tail_avg = out.iter().sum::<f32>() / 128.0;
        assert!((tail_avg - 0.5).abs() < 1e-3, "expected ~0.5, got {}", tail_avg);
    }

    #[test]
    fn bypass_skips_effect() {
        let mut eng = Engine::new(48_000.0);
        eng.add_effect(0, 1);
        eng.set_param(1, PARAM_GAIN_DB, -24.0);
        eng.set_bypass(1, true);
        let block = vec![1.0_f32; 128];
        let mut out = vec![0.0_f32; 128];
        for _ in 0..5 {
            eng.process_block(&block, &mut out);
        }
        // Bypassed → output equals input.
        assert!((out[127] - 1.0).abs() < 1e-6);
    }

    #[test]
    fn gate_in_chain_at_threshold_zero_silences_typical_audio() {
        // This mirrors the live UI scenario the user reported: Gate added,
        // threshold set to 0 dB, "typical" audio at ≤ 0.5 amplitude.
        let mut eng = Engine::new(48_000.0);
        assert_eq!(eng.add_effect(3, 1), 0);
        eng.set_param(1, 0, 0.0);    // THRESHOLD_DB = 0
        eng.set_param(1, 1, 2.0);
        eng.set_param(1, 2, 20.0);
        eng.set_param(1, 3, 80.0);
        eng.set_param(1, 4, -60.0);
        eng.set_param(1, 5, 3.0);
        eng.set_param(1, 6, 1.0);

        // 0.5-amplitude sine — peaks well below 0 dBFS = 1.0.
        let block: Vec<f32> = (0..128)
            .map(|i| 0.5 * (2.0 * core::f32::consts::PI * 440.0 * i as f32 / 48_000.0).sin())
            .collect();
        let mut out = vec![0.0_f32; 128];
        for _ in 0..200 {
            eng.process_block(&block, &mut out);
        }
        let in_peak = block.iter().map(|s| s.abs()).fold(0.0_f32, f32::max);
        let out_peak = out.iter().map(|s| s.abs()).fold(0.0_f32, f32::max);
        assert!(out_peak < in_peak * 0.01,
            "gate at threshold 0 dB should heavily attenuate 0.5-amp signal: in_peak={}, out_peak={}",
            in_peak, out_peak);
    }

    #[test]
    fn gate_in_chain_attenuates_quiet_signal() {
        // Mirror what `effectsStore.addEffect` does: build a Gate, then
        // push the UI defaults via `set_param` in the same order as TS.
        let mut eng = Engine::new(48_000.0);
        assert_eq!(eng.add_effect(3, 1), 0); // 3 = EffectType::Gate
        // Defaults from `GATE_DEFINITION` (TS schema):
        eng.set_param(1, 0, -40.0);  // THRESHOLD_DB
        eng.set_param(1, 1, 2.0);    // ATTACK_MS
        eng.set_param(1, 2, 20.0);   // HOLD_MS
        eng.set_param(1, 3, 80.0);   // RELEASE_MS
        eng.set_param(1, 4, -60.0);  // RANGE_DB
        eng.set_param(1, 5, 3.0);    // HYSTERESIS_DB
        eng.set_param(1, 6, 1.0);    // DRY_WET

        // Quiet signal well below -40 dBFS threshold → gate should attenuate.
        let block: Vec<f32> = (0..128).map(|i| 0.005 * (0.05 * i as f32).sin()).collect();
        let mut out = vec![0.0_f32; 128];
        for _ in 0..200 {
            eng.process_block(&block, &mut out);
        }
        let peak = out.iter().map(|s| s.abs()).fold(0.0_f32, f32::max);
        assert!(peak < 1e-3, "gate failed to attenuate; peak {}", peak);
    }

    #[test]
    fn reorder_validates_unknown_ids() {
        let mut eng = Engine::new(48_000.0);
        eng.add_effect(0, 1);
        eng.add_effect(0, 2);
        assert_eq!(eng.reorder(&[2, 1]), 0);
        assert_eq!(eng.reorder(&[2, 1, 99]), -1);
    }
}
