//! Noise gate. Below `threshold`, the signal is attenuated by `range` dB.
//! Above `threshold + hysteresis`, the gate fully opens. Asymmetric attack /
//! hold / release shape the envelope of the gain reduction.
//!
//! State machine:
//!   Closed  → (det ≥ open) → Opening
//!   Opening → (smoothed ≈ 1) → Open
//!   Open    → (det < close) → Holding
//!   Holding → (hold expired) → Closing
//!           → (det ≥ open during hold) → Open    (re-trigger)
//!   Closing → (smoothed ≈ range_lin) → Closed
//!           → (det ≥ open during release) → Opening (re-trigger)

use super::Effect;
use crate::utils::envelope::EnvelopeFollower;
use crate::utils::math::{db_to_lin, lin_to_db, smoothing_alpha};

pub const PARAM_THRESHOLD_DB: u32 = 0;
pub const PARAM_ATTACK_MS: u32 = 1;
pub const PARAM_HOLD_MS: u32 = 2;
pub const PARAM_RELEASE_MS: u32 = 3;
pub const PARAM_RANGE_DB: u32 = 4;
pub const PARAM_HYSTERESIS_DB: u32 = 5;
pub const PARAM_DRY_WET: u32 = 6;

const SMOOTH_TIME_SEC: f32 = 0.005;
const SNAP_OPEN_EPS: f32 = 1e-3;
const SNAP_CLOSED_EPS: f32 = 1e-4;

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
enum State {
    Closed,
    Opening,
    Open,
    Holding,
    Closing,
}

pub struct Gate {
    sample_rate: f32,
    threshold_db: f32,
    hysteresis_db: f32,
    range_lin: f32,
    target_dry_wet: f32,
    smoothed_dry_wet: f32,
    smoother_alpha: f32,

    envelope: EnvelopeFollower,

    state: State,
    target_gain: f32,
    smoothed_gain: f32,
    attack_coef: f32,
    release_coef: f32,
    hold_samples: u32,
    hold_counter: u32,

    last_gr_db: f32,
}

impl Gate {
    pub fn new(sample_rate: f32) -> Self {
        let mut gate = Self {
            sample_rate,
            threshold_db: -40.0,
            hysteresis_db: 3.0,
            range_lin: db_to_lin(-60.0),
            target_dry_wet: 1.0,
            smoothed_dry_wet: 1.0,
            smoother_alpha: smoothing_alpha(SMOOTH_TIME_SEC, sample_rate),
            envelope: EnvelopeFollower::new(sample_rate, 1.0, 30.0),
            state: State::Closed,
            target_gain: db_to_lin(-60.0),
            smoothed_gain: db_to_lin(-60.0),
            attack_coef: 0.0,
            release_coef: 0.0,
            hold_samples: 0,
            hold_counter: 0,
            last_gr_db: 0.0,
        };
        gate.set_attack_ms(2.0);
        gate.set_release_ms(80.0);
        gate.set_hold_ms(20.0);
        gate
    }

    fn coef_from_ms(ms: f32, sample_rate: f32) -> f32 {
        let tau_samples = (ms.max(0.01) * 0.001) * sample_rate;
        (-1.0 / tau_samples).exp()
    }

    fn set_attack_ms(&mut self, ms: f32) {
        self.attack_coef = Self::coef_from_ms(ms, self.sample_rate);
    }
    fn set_release_ms(&mut self, ms: f32) {
        self.release_coef = Self::coef_from_ms(ms, self.sample_rate);
    }
    fn set_hold_ms(&mut self, ms: f32) {
        self.hold_samples = (ms.max(0.0) * 0.001 * self.sample_rate) as u32;
    }
}

impl Effect for Gate {
    fn process(&mut self, input: &[f32], output: &mut [f32]) {
        let n = input.len().min(output.len());
        let alpha = self.smoother_alpha;
        let open_thresh_lin = db_to_lin(self.threshold_db);
        let close_thresh_lin = db_to_lin(self.threshold_db - self.hysteresis_db);
        let mut block_min_gr = 0.0_f32;

        for i in 0..n {
            let det = self.envelope.process_sample(input[i]);

            // ── Full state machine ─────────────────────────────────────────
            match self.state {
                State::Closed => {
                    if det >= open_thresh_lin {
                        self.state = State::Opening;
                        self.target_gain = 1.0;
                    }
                }
                State::Opening => {
                    if (self.smoothed_gain - 1.0).abs() < SNAP_OPEN_EPS {
                        self.state = State::Open;
                        self.smoothed_gain = 1.0;
                    }
                }
                State::Open => {
                    if det < close_thresh_lin {
                        self.state = State::Holding;
                        self.hold_counter = 0;
                        // target_gain stays at 1.0 during hold
                    }
                }
                State::Holding => {
                    if det >= open_thresh_lin {
                        // Re-trigger before hold finishes.
                        self.state = State::Open;
                    } else {
                        self.hold_counter += 1;
                        if self.hold_counter >= self.hold_samples {
                            self.state = State::Closing;
                            self.target_gain = self.range_lin;
                        }
                    }
                }
                State::Closing => {
                    if det >= open_thresh_lin {
                        // Re-trigger during release.
                        self.state = State::Opening;
                        self.target_gain = 1.0;
                    } else if (self.smoothed_gain - self.range_lin).abs() < SNAP_CLOSED_EPS {
                        self.state = State::Closed;
                        self.smoothed_gain = self.range_lin;
                    }
                }
            }

            // ── One-pole smoothing toward target ───────────────────────────
            let coef = if self.target_gain > self.smoothed_gain {
                self.attack_coef
            } else {
                self.release_coef
            };
            self.smoothed_gain = self.target_gain + coef * (self.smoothed_gain - self.target_gain);

            // Smooth dry/wet.
            self.smoothed_dry_wet += alpha * (self.target_dry_wet - self.smoothed_dry_wet);

            let dry = input[i];
            let wet = dry * self.smoothed_gain;
            output[i] = dry * (1.0 - self.smoothed_dry_wet) + wet * self.smoothed_dry_wet;

            let gr_db = lin_to_db(self.smoothed_gain);
            if gr_db < block_min_gr {
                block_min_gr = gr_db;
            }
        }
        self.last_gr_db = block_min_gr;
    }

    fn set_param(&mut self, param_id: u32, value: f32) {
        match param_id {
            PARAM_THRESHOLD_DB => self.threshold_db = value.clamp(-80.0, 0.0),
            PARAM_ATTACK_MS => self.set_attack_ms(value.clamp(0.01, 50.0)),
            PARAM_HOLD_MS => self.set_hold_ms(value.clamp(0.0, 500.0)),
            PARAM_RELEASE_MS => self.set_release_ms(value.clamp(5.0, 500.0)),
            PARAM_RANGE_DB => {
                let db = value.clamp(-90.0, 0.0);
                self.range_lin = db_to_lin(db);
                // If we're currently closed/closing toward the old range, retarget.
                if matches!(self.state, State::Closed | State::Closing) {
                    self.target_gain = self.range_lin;
                }
            }
            PARAM_HYSTERESIS_DB => self.hysteresis_db = value.clamp(0.0, 10.0),
            PARAM_DRY_WET => self.target_dry_wet = value.clamp(0.0, 1.0),
            _ => {}
        }
    }

    fn reset(&mut self) {
        self.envelope.reset();
        self.state = State::Closed;
        self.smoothed_gain = self.range_lin;
        self.target_gain = self.range_lin;
        self.smoothed_dry_wet = self.target_dry_wet;
        self.last_gr_db = 0.0;
        self.hold_counter = 0;
    }

    fn get_meter(&self, meter_id: u32) -> f32 {
        match meter_id {
            0 => self.last_gr_db,
            _ => 0.0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quiet_input_gets_attenuated() {
        let sr = 48_000.0;
        let mut gate = Gate::new(sr);
        gate.set_param(PARAM_THRESHOLD_DB, -30.0);
        gate.set_param(PARAM_RANGE_DB, -60.0);
        gate.set_param(PARAM_DRY_WET, 1.0);
        gate.reset();

        let n = (sr * 0.3) as usize;
        let mut input = vec![0.0_f32; n];
        let mut output = vec![0.0_f32; n];
        for i in 0..n {
            input[i] = 0.003 * (2.0 * core::f32::consts::PI * 1000.0 * i as f32 / sr).sin();
        }
        gate.process(&input, &mut output);
        let tail_peak = output[(0.2 * sr as f32) as usize..]
            .iter().map(|s| s.abs()).fold(0.0_f32, f32::max);
        assert!(tail_peak < 1e-4, "expected near silence, got peak {}", tail_peak);
    }

    #[test]
    fn loud_input_passes_through() {
        let sr = 48_000.0;
        let mut gate = Gate::new(sr);
        gate.set_param(PARAM_THRESHOLD_DB, -30.0);
        gate.set_param(PARAM_RANGE_DB, -60.0);
        gate.set_param(PARAM_DRY_WET, 1.0);
        gate.reset();

        let n = (sr * 0.3) as usize;
        let mut input = vec![0.0_f32; n];
        let mut output = vec![0.0_f32; n];
        for i in 0..n {
            input[i] = 0.5 * (2.0 * core::f32::consts::PI * 1000.0 * i as f32 / sr).sin();
        }
        gate.process(&input, &mut output);
        let tail_peak = output[(0.2 * sr as f32) as usize..]
            .iter().map(|s| s.abs()).fold(0.0_f32, f32::max);
        assert!(tail_peak > 0.45, "expected near-passthrough, got peak {}", tail_peak);
    }

    /// Open → quiet → must close again. Regression for the bug where
    /// `target_gain` was stuck at 1.0 after a hold cycle, leaving the gate
    /// permanently open.
    #[test]
    fn closes_after_hold_when_signal_drops() {
        let sr = 48_000.0;
        let mut gate = Gate::new(sr);
        gate.set_param(PARAM_THRESHOLD_DB, -30.0);
        gate.set_param(PARAM_RANGE_DB, -60.0);
        gate.set_param(PARAM_HOLD_MS, 20.0);
        gate.set_param(PARAM_RELEASE_MS, 50.0);
        gate.set_param(PARAM_DRY_WET, 1.0);
        gate.reset();

        // 100 ms loud → opens
        let mut input = vec![0.5_f32; (sr * 0.1) as usize];
        let mut output = vec![0.0_f32; input.len()];
        gate.process(&input, &mut output);
        let loud_peak = output.iter().map(|s| s.abs()).fold(0.0_f32, f32::max);
        assert!(loud_peak > 0.45, "expected open during loud, got {}", loud_peak);

        // 500 ms quiet (well below threshold) → must close after hold + release.
        let n_quiet = (sr * 0.5) as usize;
        input = vec![0.0_f32; n_quiet];
        output = vec![0.0_f32; n_quiet];
        gate.process(&input, &mut output);
        // Last 100 ms should be effectively silent (gate closed).
        let tail = &output[(n_quiet - (sr * 0.1) as usize)..];
        let tail_peak = tail.iter().map(|s| s.abs()).fold(0.0_f32, f32::max);
        assert!(tail_peak < 1e-4,
            "gate failed to close after loud signal stopped: peak {}",
            tail_peak);
    }

    /// After a full open-then-close cycle, a second loud burst must still
    /// open the gate (state machine must reach State::Closed, not stay
    /// in Closing forever).
    #[test]
    fn reopens_after_full_close_cycle() {
        let sr = 48_000.0;
        let mut gate = Gate::new(sr);
        gate.set_param(PARAM_THRESHOLD_DB, -30.0);
        gate.set_param(PARAM_RANGE_DB, -60.0);
        gate.set_param(PARAM_HOLD_MS, 20.0);
        gate.set_param(PARAM_RELEASE_MS, 30.0);
        gate.set_param(PARAM_DRY_WET, 1.0);
        gate.reset();

        // Cycle 1
        let mut buf = vec![0.5_f32; (sr * 0.1) as usize];
        let mut out = vec![0.0_f32; buf.len()];
        gate.process(&buf, &mut out);

        buf = vec![0.0_f32; (sr * 0.5) as usize];
        out = vec![0.0_f32; buf.len()];
        gate.process(&buf, &mut out);

        // Cycle 2 — must open again
        buf = vec![0.5_f32; (sr * 0.1) as usize];
        out = vec![0.0_f32; buf.len()];
        gate.process(&buf, &mut out);
        let peak = out[(out.len() - 100)..].iter().map(|s| s.abs()).fold(0.0_f32, f32::max);
        assert!(peak > 0.45, "gate failed to reopen on second loud burst: peak {}", peak);
    }
}
