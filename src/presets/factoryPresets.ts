import { EffectType } from '@/types/effects'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PresetEffect {
  type: EffectType
  bypassed?: boolean
  /** Only non-default param values; merged on top of effect defaults at load time. */
  params: Record<number, number>
}

export interface Preset {
  id: string
  name: { ro: string; en: string }
  description: { ro: string; en: string }
  effects: PresetEffect[]
}

// ─── EQ param helpers ────────────────────────────────────────────────────────
// bandIdx * 5 + {TYPE=0, FREQ=1, GAIN=2, Q=3, ENABLED=4}
// EQ_BAND_TYPE: Bell=0, LowShelf=1, HighShelf=2, HighPass=3, LowPass=4, Notch=5
// Low Cut: ENABLED=20, FREQ=21, SLOPE=22 (slope: 1=12dB/oct, 2=24dB/oct)

function eqBand(idx: number, type: number, freq: number, gain: number, q: number) {
  const base = idx * 5
  return { [base]: type, [base + 1]: freq, [base + 2]: gain, [base + 3]: q, [base + 4]: 1 }
}

function eqLowCut(freq: number, slope: 1 | 2) {
  return { 20: 1, 21: freq, 22: slope }
}

// ─── Factory presets ─────────────────────────────────────────────────────────

export const FACTORY_PRESETS: Preset[] = [
  // ── 1. Vocal Cleanup ───────────────────────────────────────────────────
  {
    id: 'factory:vocal-cleanup',
    name: { ro: 'Curățare Voce', en: 'Vocal Cleanup' },
    description: {
      ro: 'Gate → EQ (Low Cut 80 Hz + mud cut + presence) → Compressor → Limiter. Ideal pentru voce înregistrată.',
      en: 'Gate → EQ (80 Hz Low Cut + mud cut + presence boost) → Compressor → Limiter. Ideal for recorded vocals.',
    },
    effects: [
      {
        type: EffectType.Gate,
        params: { 0: -50, 1: 2, 2: 20, 3: 100, 4: -60, 5: 4, 6: 1 },
        // THRESHOLD=-50, ATTACK=2ms, HOLD=20ms, RELEASE=100ms, RANGE=-60, HYST=4, MIX=1
      },
      {
        type: EffectType.ParametricEq,
        params: {
          ...eqLowCut(80, 2),
          ...eqBand(1, 0, 300,   -3,  2.5),  // Bell –3 dB @ 300 Hz: mud cut
          ...eqBand(2, 0, 3000,   2.5, 1.5), // Bell +2.5 dB @ 3 kHz: presence
          ...eqBand(3, 2, 10000,  1.5, 1),   // HiShelf +1.5 dB @ 10 kHz: air
        },
      },
      {
        type: EffectType.Compressor,
        params: { 0: -22, 1: 3, 2: 10, 3: 120, 4: 6, 5: 6, 6: 80, 7: 1 },
        // THRESHOLD=-22, RATIO=3:1, ATTACK=10ms, RELEASE=120ms, KNEE=6, MAKEUP=+6, SC_HPF=80
      },
      {
        type: EffectType.Limiter,
        params: { 0: -1, 1: 50, 2: 1 },
      },
    ],
  },

  // ── 2. Drum Punch ──────────────────────────────────────────────────────
  {
    id: 'factory:drum-punch',
    name: { ro: 'Punch Tobe', en: 'Drum Punch' },
    description: {
      ro: 'Gate strâns → Compressor agresiv → EQ (sub + attack + mud cut) → Limiter.',
      en: 'Tight Gate → aggressive Compressor → EQ (sub boost + attack + mud cut) → Limiter.',
    },
    effects: [
      {
        type: EffectType.Gate,
        params: { 0: -30, 1: 1, 2: 40, 3: 60, 4: -60, 5: 3, 6: 1 },
        // THRESHOLD=-30, ATTACK=1ms, HOLD=40ms, RELEASE=60ms
      },
      {
        type: EffectType.Compressor,
        params: { 0: -20, 1: 6, 2: 3, 3: 60, 4: 3, 5: 4, 6: 80, 7: 1 },
        // THRESHOLD=-20, RATIO=6:1, ATTACK=3ms, RELEASE=60ms, MAKEUP=+4
      },
      {
        type: EffectType.ParametricEq,
        params: {
          ...eqLowCut(30, 2),
          ...eqBand(0, 0,   60,   3,   1),   // Bell +3 dB @ 60 Hz: sub punch
          ...eqBand(1, 0,  400,  -4,   2),   // Bell –4 dB @ 400 Hz: mud cut
          ...eqBand(2, 0, 5000,   2.5, 1.5), // Bell +2.5 dB @ 5 kHz: stick attack
        },
      },
      {
        type: EffectType.Limiter,
        params: { 0: -2, 1: 30, 2: 1 },
      },
    ],
  },

  // ── 3. Mastering Chain ─────────────────────────────────────────────────
  {
    id: 'factory:mastering',
    name: { ro: 'Lanț Mastering', en: 'Mastering Chain' },
    description: {
      ro: 'EQ de mastering (shelving gentil) → Compressor paralel (ratio 2:1) → Limiter –1 dBFS.',
      en: 'Mastering EQ (gentle shelving) → parallel Compressor (2:1) → Limiter at –1 dBFS.',
    },
    effects: [
      {
        type: EffectType.ParametricEq,
        params: {
          ...eqLowCut(30, 1),
          ...eqBand(0, 1,   100,  1.5, 1), // LoShelf +1.5 dB @ 100 Hz: body
          ...eqBand(3, 2, 12000,  2,   1), // HiShelf +2 dB @ 12 kHz: air
        },
      },
      {
        type: EffectType.Compressor,
        params: { 0: -12, 1: 2, 2: 30, 3: 200, 4: 8, 5: 2, 6: 80, 7: 0.8 },
        // RATIO=2:1, slow attack/release, MIX=0.8 (parallel compression)
      },
      {
        type: EffectType.Limiter,
        params: { 0: -1, 1: 80, 2: 1 },
      },
    ],
  },

  // ── 4. Vintage Warmth ──────────────────────────────────────────────────
  {
    id: 'factory:vintage-warmth',
    name: { ro: 'Căldură Vintage', en: 'Vintage Warmth' },
    description: {
      ro: 'Saturation Tube → EQ cald → Compressor lent → Reverb subtil. Sunet analogic.',
      en: 'Tube Saturation → warm EQ → slow Compressor → subtle Reverb. Analogue character.',
    },
    effects: [
      {
        type: EffectType.Saturation,
        params: { 0: 8, 1: 3, 2: 6000, 3: 0.7 },
        // DRIVE=+8 dB, TYPE=Tube(3), TONE=6kHz LP, MIX=70%
      },
      {
        type: EffectType.ParametricEq,
        params: {
          ...eqLowCut(40, 1),
          ...eqBand(0, 1,  150,   2,   1), // LoShelf +2 dB @ 150 Hz: warmth
          ...eqBand(1, 0,  350,  -2,   2), // Bell –2 dB @ 350 Hz: mud cut
          ...eqBand(2, 0, 4000,  -1.5, 2), // Bell –1.5 dB @ 4 kHz: de-harsh
        },
      },
      {
        type: EffectType.Compressor,
        params: { 0: -16, 1: 2.5, 2: 40, 3: 200, 4: 10, 5: 3, 6: 80, 7: 1 },
        // RATIO=2.5:1, slow attack 40ms
      },
      {
        type: EffectType.Reverb,
        params: { 0: 0.4, 1: 0.6, 2: 15, 3: 0.15 },
        // ROOM=0.4, DAMPING=0.6, PRE_DELAY=15ms, MIX=15% — subtle room
      },
    ],
  },

  // ── 5. Podcast / Spoken Word ───────────────────────────────────────────
  {
    id: 'factory:podcast',
    name: { ro: 'Podcast / Voce Vorbită', en: 'Podcast / Spoken Word' },
    description: {
      ro: 'Gate → EQ (HPF 100 Hz + claritate) → Compressor consistent → Limiter. Optim pentru podcast.',
      en: 'Gate → EQ (100 Hz HPF + clarity) → consistent Compressor → Limiter. Optimised for podcasting.',
    },
    effects: [
      {
        type: EffectType.Gate,
        params: { 0: -45, 1: 5, 2: 100, 3: 150, 4: -60, 5: 3, 6: 1 },
        // THRESHOLD=-45, ATTACK=5ms, HOLD=100ms, RELEASE=150ms — gentle
      },
      {
        type: EffectType.ParametricEq,
        params: {
          ...eqLowCut(100, 2),
          ...eqBand(1, 0,  250,  -3, 2),   // Bell –3 dB @ 250 Hz: mud cut
          ...eqBand(2, 0, 2000,   2, 1.5), // Bell +2 dB @ 2 kHz: intelligibility
          ...eqBand(3, 2, 10000,  1, 1),   // HiShelf +1 dB @ 10 kHz: air
        },
      },
      {
        type: EffectType.Compressor,
        params: { 0: -20, 1: 3, 2: 15, 3: 150, 4: 6, 5: 5, 6: 100, 7: 1 },
        // THRESHOLD=-20, RATIO=3:1, ATTACK=15ms, MAKEUP=+5
      },
      {
        type: EffectType.Limiter,
        params: { 0: -1, 1: 100, 2: 1 },
      },
    ],
  },
]
