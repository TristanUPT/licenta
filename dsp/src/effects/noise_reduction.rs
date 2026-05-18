//! Single-channel noise reduction via SNR-based Wiener gain.
//!
//! Algorithm:
//!   1. Short-term envelope follower tracks current signal level.
//!   2. Long-term "leaky minimum" tracker estimates the noise floor.
//!   3. Wiener gain:  G = snr² / (snr² + α)  where snr = env / noise_est.
//!      α is the oversubtraction factor (controlled by sensitivity).
//!   4. Gain is clamped to `floor_lin` (= reduction_db) to preserve comfort noise.
//!   5. Gain changes are smoothed with asymmetric attack / release.
//!
//! No FFT is required — this is a single-band (wideband) implementation
//! suitable as an educational introduction to noise reduction concepts.

use super::Effect;
use crate::utils::math::{db_to_lin, lin_to_db, smoothing_alpha, flush_denormal};

pub const PARAM_REDUCTION_DB: u32 = 0;   // max reduction in dB  (–24..0)
pub const PARAM_SENSITIVITY:  u32 = 1;   // oversubtraction 0..1
pub const PARAM_ATTACK_MS:    u32 = 2;
pub const PARAM_RELEASE_MS:   u32 = 3;
pub const PARAM_DRY_WET:      u32 = 4;

/// How fast the noise-floor estimate tracks downward (toward quieter signals).
const NOISE_TRACK_DOWN: f32 = 0.001;
/// How slowly it updates upward (we assume noise floor doesn't rise quickly).
const NOISE_TRACK_UP:   f32 = 0.00002;
/// Seed noise estimate so the effect doesn't open wide immediately.
const NOISE_SEED: f32 = 0.003;

pub struct NoiseReduction {
    sample_rate: f32,

    // params (smoothed)
    floor_lin:     f32,   // minimum gain = db_to_lin(reduction_db)
    oversub:       f32,   // Wiener oversubtraction α  (1..4 mapped from sensitivity)
    attack_coef:   f32,   // one-pole coef (closer to 1 = slower)
    release_coef:  f32,
    dry_wet:       f32,
    smooth_dw:     f32,
    dw_alpha:      f32,

    // state
    env:       f32,   // short-term |input| envelope
    noise_est: f32,   // long-term noise floor estimate
    gain:      f32,   // current smoothed gain applied to signal

    last_gr_db: f32,
}

impl NoiseReduction {
    pub fn new(sample_rate: f32) -> Self {
        let dw_alpha = smoothing_alpha(0.005, sample_rate);
        let mut nr = Self {
            sample_rate,
            floor_lin:   db_to_lin(-18.0),
            oversub:     2.0,
            attack_coef:  0.0,
            release_coef: 0.0,
            dry_wet:  1.0,
            smooth_dw: 1.0,
            dw_alpha,
            env:       NOISE_SEED,
            noise_est: NOISE_SEED,
            gain:      1.0,
            last_gr_db: 0.0,
        };
        nr.set_attack_ms(5.0);
        nr.set_release_ms(80.0);
        nr
    }

    fn coef(ms: f32, sr: f32) -> f32 {
        let tau = (ms.max(0.1) * 0.001) * sr;
        (-1.0_f32 / tau).exp()
    }

    fn set_attack_ms(&mut self, ms: f32) {
        self.attack_coef = Self::coef(ms, self.sample_rate);
    }
    fn set_release_ms(&mut self, ms: f32) {
        self.release_coef = Self::coef(ms, self.sample_rate);
    }
}

impl Effect for NoiseReduction {
    fn process(&mut self, input: &[f32], output: &mut [f32]) {
        let n = input.len().min(output.len());
        let floor = self.floor_lin;
        let alpha = self.oversub;
        let dw_a  = self.dw_alpha;
        let mut min_gr: f32 = 0.0;

        for i in 0..n {
            let x = input[i];

            // ── Short-term envelope (peak follower) ────────────────────────
            let abs_x = x.abs();
            let coef = if abs_x > self.env { self.attack_coef } else { self.release_coef };
            self.env = abs_x + coef * (self.env - abs_x);
            self.env = flush_denormal(self.env);

            // ── Noise floor estimation (leaky minimum) ─────────────────────
            let tr = if self.env < self.noise_est {
                NOISE_TRACK_DOWN
            } else {
                NOISE_TRACK_UP
            };
            self.noise_est += tr * (self.env - self.noise_est);
            self.noise_est = flush_denormal(self.noise_est.max(1e-10));

            // ── Wiener gain ────────────────────────────────────────────────
            // snr  = (env / noise_est) — power ratio already squared by squaring both
            let env2   = self.env * self.env;
            let noise2 = self.noise_est * self.noise_est;
            let wiener = env2 / (env2 + alpha * noise2);
            let target_gain = wiener.max(floor);

            // ── Attack / release smoothing ─────────────────────────────────
            let g_coef = if target_gain < self.gain {
                self.attack_coef   // gain going down → fast (attack = fast clamp)
            } else {
                self.release_coef  // gain going up → slow
            };
            self.gain = target_gain + g_coef * (self.gain - target_gain);
            self.gain = flush_denormal(self.gain.clamp(floor, 1.0));

            // ── Dry/wet ────────────────────────────────────────────────────
            self.smooth_dw += dw_a * (self.dry_wet - self.smooth_dw);
            let wet = x * self.gain;
            output[i] = x * (1.0 - self.smooth_dw) + wet * self.smooth_dw;

            let gr = lin_to_db(self.gain);
            if gr < min_gr { min_gr = gr; }
        }
        self.last_gr_db = min_gr;
    }

    fn set_param(&mut self, id: u32, value: f32) {
        match id {
            PARAM_REDUCTION_DB => {
                self.floor_lin = db_to_lin(value.clamp(-24.0, 0.0));
            }
            PARAM_SENSITIVITY => {
                // sensitivity 0..1 → oversubtraction α: 1.0..8.0
                let s = value.clamp(0.0, 1.0);
                self.oversub = 1.0 + 7.0 * s;
            }
            PARAM_ATTACK_MS  => self.set_attack_ms(value.clamp(1.0, 50.0)),
            PARAM_RELEASE_MS => self.set_release_ms(value.clamp(10.0, 200.0)),
            PARAM_DRY_WET    => self.dry_wet = value.clamp(0.0, 1.0),
            _ => {}
        }
    }

    fn reset(&mut self) {
        self.env       = NOISE_SEED;
        self.noise_est = NOISE_SEED;
        self.gain      = 1.0;
        self.smooth_dw = self.dry_wet;
        self.last_gr_db = 0.0;
    }

    fn get_meter(&self, meter_id: u32) -> f32 {
        match meter_id {
            0 => self.last_gr_db,
            _ => 0.0,
        }
    }
}
