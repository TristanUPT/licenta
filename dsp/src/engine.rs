//! Real-time audio engine — stereo dual-instance design.
//!
//! Each effect slot holds an independent left-channel and right-channel
//! instance of the same effect. Parameters are mirrored to both. This
//! preserves stereo image through every effect without changing individual
//! effect implementations.

use crate::effects::{build, Effect, EffectType};

pub const RENDER_QUANTUM: usize = 128;

struct EffectSlot {
    id: u32,
    bypassed: bool,
    left: Box<dyn Effect>,
    right: Box<dyn Effect>,
}

pub struct Engine {
    sample_rate: f32,
    chain: Vec<EffectSlot>,
    work_l: Vec<f32>,
    work_r: Vec<f32>,
    temp_l: Vec<f32>,
    temp_r: Vec<f32>,
    blocks_processed: u64,
}

impl Engine {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate,
            chain: Vec::with_capacity(16),
            work_l: vec![0.0; RENDER_QUANTUM],
            work_r: vec![0.0; RENDER_QUANTUM],
            temp_l: vec![0.0; RENDER_QUANTUM],
            temp_r: vec![0.0; RENDER_QUANTUM],
            blocks_processed: 0,
        }
    }

    /// Mono passthrough — used by unit tests and the old mono WASM export.
    /// Processes only through the `left` instance of each effect.
    pub fn process_block(&mut self, input: &[f32], output: &mut [f32]) {
        let n = input.len().min(output.len()).min(RENDER_QUANTUM);

        if self.chain.is_empty() {
            output[..n].copy_from_slice(&input[..n]);
            if output.len() > n {
                for s in &mut output[n..] { *s = 0.0; }
            }
            self.blocks_processed = self.blocks_processed.wrapping_add(1);
            return;
        }

        self.work_l[..n].copy_from_slice(&input[..n]);

        // Disjoint field borrows — Rust allows these simultaneously.
        let chain = &mut self.chain;
        let mut work: &mut [f32] = &mut self.work_l[..n];
        let mut temp: &mut [f32] = &mut self.temp_l[..n];

        for slot in chain.iter_mut() {
            if slot.bypassed { continue; }
            slot.left.process(work, temp);
            core::mem::swap(&mut work, &mut temp);
        }

        output[..n].copy_from_slice(work);
        if output.len() > n {
            for s in &mut output[n..] { *s = 0.0; }
        }
        self.blocks_processed = self.blocks_processed.wrapping_add(1);
    }

    /// True stereo processing — L through `left` instances, R through `right`.
    pub fn process_block_stereo(
        &mut self,
        in_l: &[f32], in_r: &[f32],
        out_l: &mut [f32], out_r: &mut [f32],
    ) {
        let n = in_l.len().min(in_r.len())
                    .min(out_l.len()).min(out_r.len())
                    .min(RENDER_QUANTUM);

        if self.chain.is_empty() {
            out_l[..n].copy_from_slice(&in_l[..n]);
            out_r[..n].copy_from_slice(&in_r[..n]);
            if out_l.len() > n { for s in &mut out_l[n..] { *s = 0.0; } }
            if out_r.len() > n { for s in &mut out_r[n..] { *s = 0.0; } }
            self.blocks_processed = self.blocks_processed.wrapping_add(1);
            return;
        }

        self.work_l[..n].copy_from_slice(&in_l[..n]);
        self.work_r[..n].copy_from_slice(&in_r[..n]);

        // Disjoint field borrows for all 4 ping-pong buffers + chain.
        let chain = &mut self.chain;
        let mut wl: &mut [f32] = &mut self.work_l[..n];
        let mut wr: &mut [f32] = &mut self.work_r[..n];
        let mut tl: &mut [f32] = &mut self.temp_l[..n];
        let mut tr: &mut [f32] = &mut self.temp_r[..n];

        for slot in chain.iter_mut() {
            if slot.bypassed { continue; }
            slot.left.process(wl, tl);
            slot.right.process(wr, tr);
            core::mem::swap(&mut wl, &mut tl);
            core::mem::swap(&mut wr, &mut tr);
        }

        out_l[..n].copy_from_slice(wl);
        out_r[..n].copy_from_slice(wr);
        if out_l.len() > n { for s in &mut out_l[n..] { *s = 0.0; } }
        if out_r.len() > n { for s in &mut out_r[n..] { *s = 0.0; } }
        self.blocks_processed = self.blocks_processed.wrapping_add(1);
    }

    pub fn blocks_processed(&self) -> u64 {
        self.blocks_processed
    }

    pub fn add_effect(&mut self, effect_type_id: u32, instance_id: u32) -> i32 {
        let Some(effect_type) = EffectType::from_u32(effect_type_id) else {
            return -1;
        };
        if self.chain.iter().any(|s| s.id == instance_id) {
            return -2;
        }
        let left  = build(effect_type, self.sample_rate);
        let right = build(effect_type, self.sample_rate);
        self.chain.push(EffectSlot { id: instance_id, bypassed: false, left, right });
        0
    }

    pub fn remove_effect(&mut self, instance_id: u32) -> i32 {
        let pos = self.chain.iter().position(|s| s.id == instance_id);
        match pos {
            Some(i) => { self.chain.remove(i); 0 }
            None => -1,
        }
    }

    pub fn set_param(&mut self, instance_id: u32, param_id: u32, value: f32) -> i32 {
        match self.chain.iter_mut().find(|s| s.id == instance_id) {
            Some(slot) => {
                slot.left.set_param(param_id, value);
                slot.right.set_param(param_id, value);
                0
            }
            None => -1,
        }
    }

    pub fn set_bypass(&mut self, instance_id: u32, bypassed: bool) -> i32 {
        match self.chain.iter_mut().find(|s| s.id == instance_id) {
            Some(slot) => { slot.bypassed = bypassed; 0 }
            None => -1,
        }
    }

    pub fn collect_meters(
        &self,
        meter_id: u32,
        ids: &mut [u32],
        values: &mut [f32],
    ) -> u32 {
        let cap = ids.len().min(values.len()).min(self.chain.len());
        for i in 0..cap {
            ids[i] = self.chain[i].id;
            values[i] = (self.chain[i].left.get_meter(meter_id)
                       + self.chain[i].right.get_meter(meter_id)) * 0.5;
        }
        cap as u32
    }

    pub fn reorder(&mut self, order: &[u32]) -> i32 {
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
    fn stereo_empty_chain_is_passthrough() {
        let mut eng = Engine::new(48_000.0);
        let in_l: Vec<f32> = (0..128).map(|i| i as f32 * 0.001).collect();
        let in_r: Vec<f32> = (0..128).map(|i| -(i as f32 * 0.001)).collect();
        let mut out_l = vec![0.0_f32; 128];
        let mut out_r = vec![0.0_f32; 128];
        eng.process_block_stereo(&in_l, &in_r, &mut out_l, &mut out_r);
        assert_eq!(in_l, out_l);
        assert_eq!(in_r, out_r);
    }

    #[test]
    fn add_remove_works() {
        let mut eng = Engine::new(48_000.0);
        assert_eq!(eng.add_effect(0, 1), 0);
        assert_eq!(eng.add_effect(0, 1), -2);
        assert_eq!(eng.add_effect(99, 2), -1);
        assert_eq!(eng.remove_effect(1), 0);
        assert_eq!(eng.remove_effect(1), -1);
    }

    #[test]
    fn gain_in_chain_attenuates_signal() {
        let mut eng = Engine::new(48_000.0);
        eng.add_effect(0, 1);
        eng.set_param(1, PARAM_GAIN_DB, -6.0206);
        let block = vec![1.0_f32; 128];
        let mut out = vec![0.0_f32; 128];
        for _ in 0..50 {
            eng.process_block(&block, &mut out);
        }
        let tail_avg = out.iter().sum::<f32>() / 128.0;
        assert!((tail_avg - 0.5).abs() < 1e-3, "expected ~0.5, got {}", tail_avg);
    }

    #[test]
    fn stereo_gain_attenuates_both_channels() {
        let mut eng = Engine::new(48_000.0);
        eng.add_effect(0, 1);
        eng.set_param(1, PARAM_GAIN_DB, -6.0206);
        let block = vec![1.0_f32; 128];
        let mut out_l = vec![0.0_f32; 128];
        let mut out_r = vec![0.0_f32; 128];
        for _ in 0..50 {
            eng.process_block_stereo(&block, &block, &mut out_l, &mut out_r);
        }
        let avg_l = out_l.iter().sum::<f32>() / 128.0;
        let avg_r = out_r.iter().sum::<f32>() / 128.0;
        assert!((avg_l - 0.5).abs() < 1e-3, "L expected ~0.5, got {}", avg_l);
        assert!((avg_r - 0.5).abs() < 1e-3, "R expected ~0.5, got {}", avg_r);
    }

    #[test]
    fn stereo_channels_independent() {
        // L = 1.0, R = 0.5 — gain at -6 dB → L≈0.5, R≈0.25.
        let mut eng = Engine::new(48_000.0);
        eng.add_effect(0, 1);
        eng.set_param(1, PARAM_GAIN_DB, -6.0206);
        let in_l = vec![1.0_f32; 128];
        let in_r = vec![0.5_f32; 128];
        let mut out_l = vec![0.0_f32; 128];
        let mut out_r = vec![0.0_f32; 128];
        for _ in 0..50 {
            eng.process_block_stereo(&in_l, &in_r, &mut out_l, &mut out_r);
        }
        let avg_l = out_l.iter().sum::<f32>() / 128.0;
        let avg_r = out_r.iter().sum::<f32>() / 128.0;
        assert!((avg_l - 0.5).abs() < 1e-3, "L expected ~0.5, got {}", avg_l);
        assert!((avg_r - 0.25).abs() < 1e-3, "R expected ~0.25, got {}", avg_r);
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
        assert!((out[127] - 1.0).abs() < 1e-6);
    }

    #[test]
    fn gate_in_chain_at_threshold_zero_silences_typical_audio() {
        let mut eng = Engine::new(48_000.0);
        assert_eq!(eng.add_effect(3, 1), 0);
        eng.set_param(1, 0, 0.0);
        eng.set_param(1, 1, 2.0);
        eng.set_param(1, 2, 20.0);
        eng.set_param(1, 3, 80.0);
        eng.set_param(1, 4, -60.0);
        eng.set_param(1, 5, 3.0);
        eng.set_param(1, 6, 1.0);

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
        let mut eng = Engine::new(48_000.0);
        assert_eq!(eng.add_effect(3, 1), 0);
        eng.set_param(1, 0, -40.0);
        eng.set_param(1, 1, 2.0);
        eng.set_param(1, 2, 20.0);
        eng.set_param(1, 3, 80.0);
        eng.set_param(1, 4, -60.0);
        eng.set_param(1, 5, 3.0);
        eng.set_param(1, 6, 1.0);

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
