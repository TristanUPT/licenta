import type { EffectInstance } from '@/types/effects'
import { EffectType } from '@/types/effects'
import type { EducationLanguage, EducationMode } from '@/store/educationStore'
import type { FrequencyBands } from '@/audio/analyzerNode'

export type RecSeverity = 'info' | 'suggestion' | 'warning'

export interface Recommendation {
  id: string
  severity: RecSeverity
  effectType?: EffectType
  ro: { beginner: string; advanced: string }
  en: { beginner: string; advanced: string }
}

const hasType = (effects: EffectInstance[], t: EffectType) => effects.some((e) => e.type === t)

function toDB(linear: number): number {
  return linear > 0 ? 20 * Math.log10(linear) : -Infinity
}

export function computeRecommendations(
  effects: EffectInstance[],
  bands: FrequencyBands | null,
  masterRms: number,
  masterPeak: number,
): Recommendation[] {
  const out: Recommendation[] = []

  const hasComp    = hasType(effects, EffectType.Compressor)
  const hasLimiter = hasType(effects, EffectType.Limiter)
  const hasEq      = hasType(effects, EffectType.ParametricEq)
  const hasReverb  = hasType(effects, EffectType.Reverb)
  const hasDelay   = hasType(effects, EffectType.Delay)
  const hasGate    = hasType(effects, EffectType.Gate)

  const isPlaying = masterRms > 0.001

  // ── Signal rules ──────────────────────────────────────────────────────────

  if (masterPeak > 0.891 && !hasLimiter) {
    out.push({
      id: 'signal:peak-no-limiter',
      severity: 'warning',
      effectType: EffectType.Limiter,
      ro: {
        beginner: 'Semnalul atinge nivelul maxim și pot apărea distorsiuni nedorite. Adaugă un Limiter la finalul lanțului.',
        advanced: `Peak la ${toDB(masterPeak).toFixed(1)} dBFS — risc de clipping digital. Inserează un Limiter cu ceiling –1 dBFS ca ultim efect în chain.`,
      },
      en: {
        beginner: 'The signal is hitting maximum level and unwanted distortion may occur. Add a Limiter at the end of the chain.',
        advanced: `Peak at ${toDB(masterPeak).toFixed(1)} dBFS — digital clipping risk. Insert a Limiter with –1 dBFS ceiling as the last effect in the chain.`,
      },
    })
  }

  if (isPlaying && masterRms < 0.032 && effects.length > 0) {
    out.push({
      id: 'signal:weak-level',
      severity: 'info',
      effectType: EffectType.Gain,
      ro: {
        beginner: 'Semnalul de ieșire este prea slab. Adaugă un efect Gain pentru a-l amplifica.',
        advanced: `RMS la ${toDB(masterRms).toFixed(1)} dBFS — nivel submix scăzut. Aplică +6..+12 dB Gain sau activează makeup gain pe Compressor.`,
      },
      en: {
        beginner: 'The output signal level is very low. Add a Gain effect to boost it.',
        advanced: `RMS at ${toDB(masterRms).toFixed(1)} dBFS — low submix level. Apply +6..+12 dB Gain or enable makeup gain on the Compressor.`,
      },
    })
  }

  if (isPlaying && !hasComp && masterPeak > 0.05 && masterRms > 0.005) {
    const crestDb = toDB(masterPeak) - toDB(masterRms)
    if (crestDb > 14) {
      out.push({
        id: 'signal:high-crest-factor',
        severity: 'suggestion',
        effectType: EffectType.Compressor,
        ro: {
          beginner: 'Semnalul are variații mari de volum — sunete puternice și slabe alternează rapid. Un Compressor ar uniformiza nivelul.',
          advanced: `Crest factor ${crestDb.toFixed(1)} dB — dynamic range extrem. Adaugă un Compressor ratio 3:1–6:1, attack ~10 ms, release ~100 ms.`,
        },
        en: {
          beginner: 'The audio has large volume swings between loud and quiet parts. A Compressor would even out the levels.',
          advanced: `Crest factor ${crestDb.toFixed(1)} dB — extreme dynamic range. Add a Compressor with 3:1–6:1 ratio, ~10 ms attack, ~100 ms release.`,
        },
      })
    }
  }

  // ── Spectral rules ────────────────────────────────────────────────────────

  if (bands && isPlaying) {
    const { subBass, bass, lowMids, mids, upperMids, presence } = bands

    if (subBass > 0.38 && subBass > bass * 1.25 && !hasEq) {
      out.push({
        id: 'spectral:sub-bass-excess',
        severity: 'suggestion',
        effectType: EffectType.ParametricEq,
        ro: {
          beginner: 'Există prea mult bas adânc (sub 80 Hz) care îngreunează sunetul. Adaugă un EQ și activează filtrul High-Pass (Low Cut).',
          advanced: 'Sub-bass dominant față de bass — frecvențe sub 80 Hz saturează mix-ul. Activează Low Cut pe EQ la 80 Hz, pantă 24 dB/oct.',
        },
        en: {
          beginner: 'There is too much deep bass (below 80 Hz) making the sound heavy and muddy. Add an EQ and enable the High-Pass (Low Cut) filter.',
          advanced: 'Sub-bass dominant over bass — frequencies below 80 Hz are saturating the mix. Enable Low Cut on EQ at 80 Hz, 24 dB/oct slope.',
        },
      })
    }

    if (lowMids > 0.48 && lowMids > mids * 1.5 && !hasEq) {
      out.push({
        id: 'spectral:low-mid-buildup',
        severity: 'suggestion',
        effectType: EffectType.ParametricEq,
        ro: {
          beginner: 'Frecvențele medii-joase (200–500 Hz) sunt prea puternice — sunetul sună „înfundat". Un EQ cu tăiere în această zonă ar clarifica sunetul.',
          advanced: 'Low-mid buildup 250–500 Hz — proximity effect sau reflexii de cameră. EQ narrow cut –4..–8 dB la 300–400 Hz, Q=2–3.',
        },
        en: {
          beginner: 'Low-mid frequencies (200–500 Hz) are too strong — the sound feels "boxy". An EQ cut in this range would add clarity.',
          advanced: 'Low-mid buildup 250–500 Hz — proximity effect or room reflections. EQ narrow cut –4..–8 dB at 300–400 Hz, Q=2–3.',
        },
      })
    }

    if (presence > 0.42 && presence > upperMids * 1.35 && !hasEq) {
      out.push({
        id: 'spectral:harsh-highs',
        severity: 'suggestion',
        effectType: EffectType.ParametricEq,
        ro: {
          beginner: 'Frecvențele înalte (4–8 kHz) sunt prea pronunțate — sunetul sună aspru sau obositor. Un EQ cu tăiere în această zonă ar ajuta.',
          advanced: 'Energie excesivă în banda presence (4–8 kHz) — risc de oboseală auditivă. High shelf cut sau EQ band la 5–6 kHz, –3..–6 dB.',
        },
        en: {
          beginner: 'High frequencies (4–8 kHz) are too prominent — the sound feels harsh or fatiguing. An EQ cut in this range would help.',
          advanced: 'Excessive presence band energy (4–8 kHz) — potential listening fatigue. High shelf cut or EQ band at 5–6 kHz, –3..–6 dB.',
        },
      })
    }
  }

  // ── Chain composition rules ───────────────────────────────────────────────

  if (isPlaying && effects.length >= 2 && !hasReverb && !hasDelay) {
    out.push({
      id: 'chain:no-space-effects',
      severity: 'info',
      effectType: EffectType.Reverb,
      ro: {
        beginner: 'Lanțul tău nu conține niciun efect spațial. Încearcă să adaugi un Reverb pentru a plasa sunetul într-un spațiu natural.',
        advanced: 'Chain fără reverb sau delay — sunet anechoic. Reverb cu pre-delay 10–30 ms și decay 1.5–2.5 s pentru naturalism.',
      },
      en: {
        beginner: 'Your chain has no spatial effect. Try adding a Reverb to place the sound in a natural space.',
        advanced: 'Chain without reverb or delay — completely anechoic sound. Reverb with 10–30 ms pre-delay and 1.5–2.5 s decay for naturalness.',
      },
    })
  }

  if (hasGate && !hasComp) {
    out.push({
      id: 'chain:gate-no-comp',
      severity: 'suggestion',
      effectType: EffectType.Compressor,
      ro: {
        beginner: 'Ai un Gate dar nu ai Compressor. Pe un semnal necompresat, gate-ul poate deschide și închide brusc. Un Compressor înaintea Gate-ului ar netezi semnalul.',
        advanced: 'Gate fără compressor în amonte — crest factor mare poate cauza gate chattering. Inserează Compressor → Gate pentru level control pre-gate.',
      },
      en: {
        beginner: 'You have a Gate but no Compressor. On an uncompressed signal the gate may chatter. Add a Compressor before the Gate.',
        advanced: 'Gate without upstream compressor — high crest factor can cause gate chattering. Insert Compressor → Gate for pre-gate level control.',
      },
    })
  }

  return out
}

export function pickRecommendation(
  rec: Recommendation,
  language: EducationLanguage,
  mode: EducationMode,
): string {
  return rec[language][mode]
}
