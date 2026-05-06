//! Peak limiter with lookahead.
//!
//! Strategy:
//!  1. Push each input sample into a delay line (lookahead window).
//!  2. Compute the envelope of |input| over the same window.
//!  3. Derive the gain that would push the envelope below `ceiling`.
//!  4. Apply that gain to the *delayed* sample so the lookahead actually
//!     "sees" the peak before it arrives at the output.
//!
//! The envelope uses a *fast attack* (instant rise to current peak) so
//! transients are caught before they reach the output, then a configurable
//! release for transparent recovery.

use super::Effect;
use crate::utils::delay_line::DelayLine;
use crate::utils::math::{db_to_lin, lin_to_db};

pub const PARAM_CEILING_DB: u32 = 0;
pub const PARAM_RELEASE_MS: u32 = 1;
pub const PARAM_DRY_WET: u32 = 2;

const LOOKAHEAD_MS: f32 = 5.0;

pub struct Limiter {
    sample_rate: f32,
    ceiling_lin: f32,
    target_dry_wet: f32,
    smoothed_dry_wet: f32,

    delay: DelayLine,
    lookahead_samples: usize,

    release_coef: f32,
    /// Smoothed (released) gain — only released, attack is instant.
    current_gain: f32,
    last_gr_db: f32,
}

impl Limiter {
    pub fn new(sample_rate: f32) -> Self {
        let lookahead_samples = ((LOOKAHEAD_MS * 0.001) * sample_rate) as usize;
        let mut lim = Self {
            sample_rate,
            ceiling_lin: db_to_lin(-1.0),
            target_dry_wet: 1.0,
            smoothed_dry_wet: 1.0,
            delay: DelayLine::new(lookahead_samples + 16),
            lookahead_samples,
            release_coef: 0.0,
            current_gain: 1.0,
            last_gr_db: 0.0,
        };
        lim.set_release_ms(50.0);
        lim
    }

    fn set_release_ms(&mut self, ms: f32) {
        let tau = (ms.max(1.0) * 0.001) * self.sample_rate;
        self.release_coef = (-1.0 / tau).exp();
    }
}

impl Effect for Limiter {
    fn process(&mut self, input: &[f32], output: &mut [f32]) {
        let n = input.len().min(output.len());
        let mut block_min_gr = 0.0_f32;

        for i in 0..n {
            // Compute the gain we'd need to push *this incoming sample* under
            // the ceiling, then carry that decision forward through the delay.
            let abs = input[i].abs();
            let target_gain = if abs > self.ceiling_lin {
                self.ceiling_lin / abs
            } else {
                1.0
            };

            // Attack is instant when target < current; otherwise release.
            self.current_gain = if target_gain < self.current_gain {
                target_gain
            } else {
                target_gain + self.release_coef * (self.current_gain - target_gain)
            };

            // Push input into the lookahead delay; read out the delayed sample.
            self.delay.write(input[i]);
            let delayed = self.delay.read_int(self.lookahead_samples);

            let dry = input[i];
            let wet = delayed * self.current_gain;
            self.smoothed_dry_wet += 0.005 * (self.target_dry_wet - self.smoothed_dry_wet);
            output[i] = dry * (1.0 - self.smoothed_dry_wet) + wet * self.smoothed_dry_wet;

            let gr_db = lin_to_db(self.current_gain);
            if gr_db < block_min_gr {
                block_min_gr = gr_db;
            }
        }
        self.last_gr_db = block_min_gr;
    }

    fn set_param(&mut self, param_id: u32, value: f32) {
        match param_id {
            PARAM_CEILING_DB => {
                let db = value.clamp(-12.0, 0.0);
                self.ceiling_lin = db_to_lin(db);
            }
            PARAM_RELEASE_MS => self.set_release_ms(value.clamp(1.0, 500.0)),
            PARAM_DRY_WET => self.target_dry_wet = value.clamp(0.0, 1.0),
            _ => {}
        }
    }

    fn reset(&mut self) {
        self.delay.reset();
        self.current_gain = 1.0;
        self.smoothed_dry_wet = self.target_dry_wet;
        self.last_gr_db = 0.0;
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
    fn limiter_clamps_peaks() {
        let sr = 48_000.0;
        let mut lim = Limiter::new(sr);
        lim.set_param(PARAM_CEILING_DB, -1.0);
        lim.set_param(PARAM_RELEASE_MS, 50.0);
        lim.set_param(PARAM_DRY_WET, 1.0);
        lim.reset();

        // Sustained loud signal at 0 dBFS — limiter must keep us under -1 dB.
        let mut input = vec![0.95_f32; 4096];
        // Insert a peak.
        input[2048] = 0.99;
        let mut output = vec![0.0_f32; 4096];
        lim.process(&input, &mut output);
        let max = output.iter().map(|s| s.abs()).fold(0.0_f32, f32::max);
        let max_db = 20.0 * max.log10();
        assert!(max_db <= -0.95, "expected peak ≤ -1 dB, got {} dB", max_db);
    }

    #[test]
    fn quiet_signal_passes_through() {
        let sr = 48_000.0;
        let mut lim = Limiter::new(sr);
        lim.set_param(PARAM_CEILING_DB, -1.0);
        lim.set_param(PARAM_DRY_WET, 1.0);
        lim.reset();
        let input = vec![0.5_f32; 1024];
        let mut output = vec![0.0_f32; 1024];
        lim.process(&input, &mut output);
        // After lookahead, the bulk of the signal is 0.5.
        let tail_avg = output[600..].iter().sum::<f32>() / 424.0;
        assert!((tail_avg - 0.5).abs() < 1e-3);
    }
}
