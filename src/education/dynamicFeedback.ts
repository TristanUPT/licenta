/**
 * Rule-based feedback engine. Pure functions only — fed the current effects
 * chain, returns a list of bilingual notes about what the user is doing.
 *
 * Two rule families:
 *   • Style A — per-effect: looks at one effect's parameter values
 *   • Style B — chain-level: looks at order and combinations between effects
 */

import {
  CHORUS_PARAM,
  COMPRESSOR_PARAM,
  DELAY_PARAM,
  EQ_BAND_PARAM,
  EQ_BANDS,
  FLANGER_PARAM,
  GAIN_PARAM,
  GATE_PARAM,
  LIMITER_PARAM,
  PITCH_SHIFT_PARAM,
  REVERB_PARAM,
  SATURATION_PARAM,
  EffectType,
  eqParamId,
  type EffectInstance,
} from '@/types/effects'
import type { EducationLanguage, EducationMode } from '@/store/educationStore'

export type FeedbackSeverity = 'info' | 'warning' | 'critical'

export interface FeedbackEntry {
  id: string
  severity: FeedbackSeverity
  /** Effect IDs this feedback references (for highlight in UI). */
  effectIds: number[]
  ro: { beginner: string; advanced: string }
  en: { beginner: string; advanced: string }
}

const SEVERITY_RANK: Record<FeedbackSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
}

// ─── helpers ─────────────────────────────────────────────────────────────

function paramOf(effect: EffectInstance, paramId: number, fallback = 0): number {
  return effect.params[paramId] ?? fallback
}

function isCompressor(e: EffectInstance) { return e.type === EffectType.Compressor }
function isEq(e: EffectInstance) { return e.type === EffectType.ParametricEq }
function isGate(e: EffectInstance) { return e.type === EffectType.Gate }
function isLimiter(e: EffectInstance) { return e.type === EffectType.Limiter }
function isDelay(e: EffectInstance) { return e.type === EffectType.Delay }
function isReverb(e: EffectInstance) { return e.type === EffectType.Reverb }
function isSaturation(e: EffectInstance) { return e.type === EffectType.Saturation }
function isGain(e: EffectInstance) { return e.type === EffectType.Gain }
function isChorus(e: EffectInstance) { return e.type === EffectType.Chorus }
function isFlanger(e: EffectInstance) { return e.type === EffectType.Flanger }
function isPitchShift(e: EffectInstance) { return e.type === EffectType.PitchShift }

// ─── Style A — per-effect rules ──────────────────────────────────────────

function analyzeCompressor(effect: EffectInstance): FeedbackEntry[] {
  if (effect.bypassed) return []
  const out: FeedbackEntry[] = []
  const ratio = paramOf(effect, COMPRESSOR_PARAM.RATIO, 4)
  const attack = paramOf(effect, COMPRESSOR_PARAM.ATTACK_MS, 10)
  const release = paramOf(effect, COMPRESSOR_PARAM.RELEASE_MS, 100)
  const threshold = paramOf(effect, COMPRESSOR_PARAM.THRESHOLD_DB, -18)
  const wet = paramOf(effect, COMPRESSOR_PARAM.DRY_WET, 1)
  const knee = paramOf(effect, COMPRESSOR_PARAM.KNEE_DB, 6)
  const makeup = paramOf(effect, COMPRESSOR_PARAM.MAKEUP_DB, 0)

  if (ratio >= 10 && attack <= 3) {
    out.push({
      id: `${effect.id}:comp-as-limiter`,
      severity: 'info',
      effectIds: [effect.id],
      ro: {
        beginner: `Compressor #${effect.id}: ratio ${ratio.toFixed(1)}:1 cu attack ${attack.toFixed(1)} ms funcționează ca un limiter — prinde și vârfurile scurte. Util, dar elimină naturalețea sunetului.`,
        advanced: `Compressor #${effect.id}: ratio ${ratio.toFixed(1)}:1 cu attack ${attack.toFixed(1)} ms — practic e un *limiter*. Util pentru a prinde peak-uri scurte, dar elimină dinamica naturală.`,
      },
      en: {
        beginner: `Compressor #${effect.id}: ratio ${ratio.toFixed(1)}:1 with ${attack.toFixed(1)} ms attack acts as a limiter — it catches even short peaks. Useful, but removes the natural feel of the sound.`,
        advanced: `Compressor #${effect.id}: ratio ${ratio.toFixed(1)}:1 with attack ${attack.toFixed(1)} ms — this is effectively a *limiter*. Useful for catching short peaks, but removes natural dynamics.`,
      },
    })
  }

  if (ratio < 2 && wet > 0.95) {
    out.push({
      id: `${effect.id}:comp-very-gentle`,
      severity: 'info',
      effectIds: [effect.id],
      ro: {
        beginner: `Compressor #${effect.id}: ratio ${ratio.toFixed(1)}:1 e foarte ușor — "lipește" ușor sunetele fără a schimba prea mult dinamica. Bun pentru un sunet mai coeziv.`,
        advanced: `Compressor #${effect.id}: ratio ${ratio.toFixed(1)}:1 e foarte gentle — comprimă doar peak-urile cele mai mari. Tipic pentru *bus compression* sau "glue".`,
      },
      en: {
        beginner: `Compressor #${effect.id}: ratio ${ratio.toFixed(1)}:1 is very gentle — it "glues" sounds together without changing the feel much. Good for a more cohesive result.`,
        advanced: `Compressor #${effect.id}: ratio ${ratio.toFixed(1)}:1 is very gentle — only the loudest peaks get compressed. Typical for *bus compression* or "glue".`,
      },
    })
  }

  if (release < 30) {
    out.push({
      id: `${effect.id}:comp-pumping-risk`,
      severity: 'warning',
      effectIds: [effect.id],
      ro: {
        beginner: `Compressor #${effect.id}: release ${release.toFixed(0)} ms e prea rapid — vei auzi sunetul "pompând" (crând și scăzând ritmic). Încearcă 80-200 ms pe voce sau 200-400 ms pe grup de instrumente.`,
        advanced: `Compressor #${effect.id}: release ${release.toFixed(0)} ms e foarte rapid — risc de "pumping" audibil pe material muzical susținut. Tipic 80-200 ms pe voce, 200-400 ms pe bus.`,
      },
      en: {
        beginner: `Compressor #${effect.id}: release ${release.toFixed(0)} ms is too fast — you'll hear the sound "pumping" (volume rising and falling rhythmically). Try 80-200 ms on vocals, 200-400 ms on a mix bus.`,
        advanced: `Compressor #${effect.id}: release ${release.toFixed(0)} ms is very fast — risks audible "pumping" on sustained material. Typical 80-200 ms on vocals, 200-400 ms on buses.`,
      },
    })
  }

  if (release > 800) {
    out.push({
      id: `${effect.id}:comp-release-too-slow`,
      severity: 'warning',
      effectIds: [effect.id],
      ro: {
        beginner: `Compressor #${effect.id}: release ${release.toFixed(0)} ms e prea lent — compresorul nu se redeschide la timp între fraze și semnalul rămâne "strâns" tot timpul. Încearcă 100-400 ms.`,
        advanced: `Compressor #${effect.id}: release ${release.toFixed(0)} ms e foarte lent — compressor-ul nu se redeschide la timp pentru următoarea frază, semnalul rămâne "stuck" sub threshold.`,
      },
      en: {
        beginner: `Compressor #${effect.id}: release ${release.toFixed(0)} ms is too slow — the compressor doesn't reopen between phrases, keeping the signal permanently "squashed". Try 100-400 ms.`,
        advanced: `Compressor #${effect.id}: release ${release.toFixed(0)} ms is very slow — the compressor won't reopen in time for the next phrase, signal stays "stuck" under threshold.`,
      },
    })
  }

  if (threshold > -2) {
    out.push({
      id: `${effect.id}:comp-threshold-too-high`,
      severity: 'info',
      effectIds: [effect.id],
      ro: {
        beginner: `Compressor #${effect.id}: threshold ${threshold.toFixed(1)} dB e prea sus — compresorul aproape nu face nimic. Coboară-l până când meterele arată o reducere de 3-6 dB.`,
        advanced: `Compressor #${effect.id}: threshold ${threshold.toFixed(1)} dB e foarte aproape de 0 dBFS — compresorul aproape nu acționează. Coboară-l pentru a vedea gain reduction.`,
      },
      en: {
        beginner: `Compressor #${effect.id}: threshold at ${threshold.toFixed(1)} dB is too high — the compressor barely does anything. Lower it until the meters show 3-6 dB of reduction.`,
        advanced: `Compressor #${effect.id}: threshold ${threshold.toFixed(1)} dB is close to 0 dBFS — the compressor barely acts. Lower it to see gain reduction.`,
      },
    })
  }

  if (knee === 0 && ratio >= 6) {
    out.push({
      id: `${effect.id}:comp-hard-knee-aggressive`,
      severity: 'info',
      effectIds: [effect.id],
      ro: {
        beginner: `Compressor #${effect.id}: knee 0 dB + ratio ${ratio.toFixed(1)}:1 = compresie bruscă și agresivă, poate suna artificial. Adaugă 6-12 dB la Knee pentru un rezultat mai natural.`,
        advanced: `Compressor #${effect.id}: knee 0 dB + ratio ${ratio.toFixed(1)}:1 — comportament "brick wall" abrupt. Adaugă knee 6-12 dB pentru o tranziție muzicală.`,
      },
      en: {
        beginner: `Compressor #${effect.id}: knee 0 dB + ratio ${ratio.toFixed(1)}:1 = abrupt, aggressive compression that can sound unnatural. Add 6-12 dB of Knee for a more musical feel.`,
        advanced: `Compressor #${effect.id}: knee 0 dB + ratio ${ratio.toFixed(1)}:1 — abrupt "brick wall" behaviour. Add 6-12 dB knee for a musical transition.`,
      },
    })
  }

  if (makeup > 18) {
    out.push({
      id: `${effect.id}:comp-makeup-extreme`,
      severity: 'warning',
      effectIds: [effect.id],
      ro: {
        beginner: `Compressor #${effect.id}: makeup +${makeup.toFixed(1)} dB e foarte mare — amplifici excesiv semnalul după compresie. Verifică că nu clipează ieșirea (adaugă un Limiter după).`,
        advanced: `Compressor #${effect.id}: makeup +${makeup.toFixed(1)} dB e extrem — vei urca semnalul artificial de mult. Verifică nivelul de output cu un limiter.`,
      },
      en: {
        beginner: `Compressor #${effect.id}: makeup +${makeup.toFixed(1)} dB is very high — you're boosting the signal heavily after compression. Check that the output isn't clipping (add a Limiter after).`,
        advanced: `Compressor #${effect.id}: makeup +${makeup.toFixed(1)} dB is extreme — you're boosting the signal heavily. Check output with a limiter.`,
      },
    })
  }

  return out
}

function analyzeEq(effect: EffectInstance): FeedbackEntry[] {
  if (effect.bypassed) return []
  const out: FeedbackEntry[] = []
  const enabledBands: number[] = []

  for (let band = 0; band < EQ_BANDS; band++) {
    const enabled = paramOf(effect, eqParamId(band, EQ_BAND_PARAM.ENABLED), 0) >= 0.5
    if (!enabled) continue
    enabledBands.push(band)

    const gain = paramOf(effect, eqParamId(band, EQ_BAND_PARAM.GAIN), 0)
    const q = paramOf(effect, eqParamId(band, EQ_BAND_PARAM.Q), 1)
    const freq = paramOf(effect, eqParamId(band, EQ_BAND_PARAM.FREQ), 1000)
    const bandType = Math.round(paramOf(effect, eqParamId(band, EQ_BAND_PARAM.TYPE), 0))

    if (gain > 12 && q < 1.5) {
      out.push({
        id: `${effect.id}:eq-band${band}-wide-boost`,
        severity: 'warning',
        effectIds: [effect.id],
        ro: {
          beginner: `EQ #${effect.id} banda ${band + 1}: ridici +${gain.toFixed(1)} dB pe o bandă largă — poate suna strident sau poate apărea distorsiune. Coboară sub +9 dB sau crește Q-ul pentru o zonă mai strâmtă.`,
          advanced: `EQ #${effect.id} banda ${band + 1}: boost +${gain.toFixed(1)} dB pe Q ${q.toFixed(1)} (lățime mare) — riscă să sune harsh / clipping. Crește Q pentru o intervenție mai chirurgicală.`,
        },
        en: {
          beginner: `EQ #${effect.id} band ${band + 1}: boosting +${gain.toFixed(1)} dB over a wide area — may sound harsh or introduce clipping. Keep below +9 dB or raise Q to narrow the affected range.`,
          advanced: `EQ #${effect.id} band ${band + 1}: +${gain.toFixed(1)} dB at Q ${q.toFixed(1)} (wide) — likely to sound harsh / clip. Increase Q for surgical work.`,
        },
      })
    }
    if (gain < -18) {
      out.push({
        id: `${effect.id}:eq-band${band}-deep-cut`,
        severity: 'info',
        effectIds: [effect.id],
        ro: {
          beginner: `EQ #${effect.id} banda ${band + 1}: cut ${gain.toFixed(1)} dB e foarte adânc. Dacă vrei să elimini o frecvență specifică, tipul Notch cu Q mare e mai eficient.`,
          advanced: `EQ #${effect.id} banda ${band + 1}: cut ${gain.toFixed(1)} dB e foarte adânc. Pentru rezonanțe punctuale, un Notch ar fi mai eficient.`,
        },
        en: {
          beginner: `EQ #${effect.id} band ${band + 1}: ${gain.toFixed(1)} dB is a very deep cut. If you're targeting a specific resonance, switching to Notch type with a high Q is more effective.`,
          advanced: `EQ #${effect.id} band ${band + 1}: ${gain.toFixed(1)} dB cut is very deep. For point resonances, a Notch would be more effective.`,
        },
      })
    }
    if ((bandType === 1 || bandType === 2) && q > 3) {
      out.push({
        id: `${effect.id}:eq-band${band}-shelf-high-q`,
        severity: 'info',
        effectIds: [effect.id],
        ro: {
          beginner: `EQ #${effect.id} banda ${band + 1}: shelf cu Q ${q.toFixed(1)} produce o "umflătură" audibilă la frecvența de tăiere. Setează Q la 0.7 pentru un shelf curat, fără artefacte.`,
          advanced: `EQ #${effect.id} banda ${band + 1}: shelf cu Q ${q.toFixed(1)} produce un "umflătură" la cutoff (Gibbs-like ringing). Pentru shelf curat, păstrează Q în jur de 0.7.`,
        },
        en: {
          beginner: `EQ #${effect.id} band ${band + 1}: shelf at Q ${q.toFixed(1)} creates an audible bump at the cutoff frequency. Set Q to 0.7 for a clean shelf without artefacts.`,
          advanced: `EQ #${effect.id} band ${band + 1}: shelf at Q ${q.toFixed(1)} produces a bump at the cutoff (Gibbs-like ringing). Keep shelf Q near 0.7 for a clean response.`,
        },
      })
    }
    if ((bandType === 3 || bandType === 4) && Math.abs(gain) > 0.1) {
      out.push({
        id: `${effect.id}:eq-band${band}-pass-gain-ignored`,
        severity: 'info',
        effectIds: [effect.id],
        ro: {
          beginner: `EQ #${effect.id} banda ${band + 1}: tipul HPF/LPF nu folosește knob-ul Gain. Modifică Freq (frecvența de tăiere) sau Q (panta) în schimb.`,
          advanced: `EQ #${effect.id} banda ${band + 1}: tipul HPF/LPF ignoră parametrul Gain. Schimbă Freq sau Q pentru a regla filtrul.`,
        },
        en: {
          beginner: `EQ #${effect.id} band ${band + 1}: HPF/LPF types don't use the Gain knob. Adjust Freq (the cutoff frequency) or Q (the slope) instead.`,
          advanced: `EQ #${effect.id} band ${band + 1}: HPF/LPF types ignore Gain. Adjust Freq or Q to tune the filter.`,
        },
      })
    }
    if (freq < 30 && bandType !== 3) {
      out.push({
        id: `${effect.id}:eq-band${band}-subsonic`,
        severity: 'info',
        effectIds: [effect.id],
        ro: {
          beginner: `EQ #${effect.id} banda ${band + 1}: ${freq.toFixed(0)} Hz e sub limita auzului uman (20 Hz). Nu vei auzi nicio diferență cu această setare.`,
          advanced: `EQ #${effect.id} banda ${band + 1}: freq ${freq.toFixed(0)} Hz e sub plaja audibilă. Util doar pentru HPF de curățare a infrasunetelor.`,
        },
        en: {
          beginner: `EQ #${effect.id} band ${band + 1}: ${freq.toFixed(0)} Hz is below the threshold of human hearing (20 Hz). You won't hear any difference with this setting.`,
          advanced: `EQ #${effect.id} band ${band + 1}: freq ${freq.toFixed(0)} Hz is below audible range. Only useful as a sub-sonic cleanup HPF.`,
        },
      })
    }
  }

  if (enabledBands.length === 0) {
    out.push({
      id: `${effect.id}:eq-no-bands`,
      severity: 'info',
      effectIds: [effect.id],
      ro: {
        beginner: `EQ #${effect.id}: nicio bandă activată — EQ-ul nu face nimic. Click pe "Band 1", "Band 2" etc. pentru a activa o bandă și a auzi diferența.`,
        advanced: `EQ #${effect.id}: nicio bandă activă — efectul e inert. Activează cel puțin o bandă (click pe "Band X") pentru a auzi diferența.`,
      },
      en: {
        beginner: `EQ #${effect.id}: no bands enabled — the EQ isn't doing anything. Click "Band 1", "Band 2" etc. to enable a band and hear the difference.`,
        advanced: `EQ #${effect.id}: no bands enabled — the effect is inert. Enable at least one band (click "Band X") to hear it.`,
      },
    })
  }

  return out
}

function analyzeGain(effect: EffectInstance): FeedbackEntry[] {
  if (effect.bypassed) return []
  const out: FeedbackEntry[] = []
  const gainDb = paramOf(effect, GAIN_PARAM.GAIN_DB, 0)
  if (gainDb > 18) {
    out.push({
      id: `${effect.id}:gain-too-hot`,
      severity: 'warning',
      effectIds: [effect.id],
      ro: {
        beginner: `Gain #${effect.id}: +${gainDb.toFixed(1)} dB e foarte mare — semnalul poate distorsiona (clipping). Verifică meterele și coboară gain-ul dacă peak-ul depășește 0 dB.`,
        advanced: `Gain #${effect.id}: +${gainDb.toFixed(1)} dB e foarte mare — verifică să nu clipeze ieșirea (peak meter).`,
      },
      en: {
        beginner: `Gain #${effect.id}: +${gainDb.toFixed(1)} dB is very high — the signal may distort (clip). Watch the meters and reduce gain if the peak goes over 0 dB.`,
        advanced: `Gain #${effect.id}: +${gainDb.toFixed(1)} dB is very high — make sure the output doesn't clip (check the peak meter).`,
      },
    })
  }
  return out
}

function analyzeGate(effect: EffectInstance): FeedbackEntry[] {
  if (effect.bypassed) return []
  const out: FeedbackEntry[] = []
  const threshold = paramOf(effect, GATE_PARAM.THRESHOLD_DB, -40)
  const range = paramOf(effect, GATE_PARAM.RANGE_DB, -60)
  const release = paramOf(effect, GATE_PARAM.RELEASE_MS, 80)
  const hold = paramOf(effect, GATE_PARAM.HOLD_MS, 20)

  if (threshold > -10) {
    out.push({
      id: `${effect.id}:gate-threshold-very-high`,
      severity: 'warning',
      effectIds: [effect.id],
      ro: {
        beginner: `Gate #${effect.id}: threshold la ${threshold.toFixed(1)} dB e prea sus — gate-ul taie în mijlocul frazelor, nu doar pe pauze. Coboară la -30 până -20 dB.`,
        advanced: `Gate #${effect.id}: threshold la ${threshold.toFixed(1)} dB e foarte sus — gate-ul se va activa în mijlocul frazelor muzicale, nu doar pe pauze. Coboară la -30..-20 dB.`,
      },
      en: {
        beginner: `Gate #${effect.id}: threshold at ${threshold.toFixed(1)} dB is too high — the gate will chop into musical phrases, not just silence. Lower to -30..-20 dB.`,
        advanced: `Gate #${effect.id}: threshold at ${threshold.toFixed(1)} dB is very high — it will chop into musical phrases, not just silence. Lower to -30..-20 dB.`,
      },
    })
  }
  if (range > -6) {
    out.push({
      id: `${effect.id}:gate-range-weak`,
      severity: 'info',
      effectIds: [effect.id],
      ro: {
        beginner: `Gate #${effect.id}: range ${range.toFixed(1)} dB e aproape de 0 — gate-ul nu reduce prea mult zgomotul când e "închis". Setează la -40 sau -60 dB pentru un efect real.`,
        advanced: `Gate #${effect.id}: range ${range.toFixed(1)} dB e aproape de 0 — atenuarea când gate-ul e "închis" e minimă. Setează la -40..-60 dB pentru efect real de noise gate.`,
      },
      en: {
        beginner: `Gate #${effect.id}: range at ${range.toFixed(1)} dB is near 0 — the gate barely reduces noise when "closed". Set to -40 or -60 dB for a real noise reduction effect.`,
        advanced: `Gate #${effect.id}: range ${range.toFixed(1)} dB is near 0 — attenuation when closed is minimal. Set to -40..-60 dB for a real gating effect.`,
      },
    })
  }
  if (release < 20 && hold < 10) {
    out.push({
      id: `${effect.id}:gate-fast-release-short-hold`,
      severity: 'warning',
      effectIds: [effect.id],
      ro: {
        beginner: `Gate #${effect.id}: release rapid (${release.toFixed(0)} ms) + hold scurt (${hold.toFixed(0)} ms) = gate-ul "pâlpâie" rapid pe semnale la limita threshold-ului. Mărește Hold la cel puțin 30 ms.`,
        advanced: `Gate #${effect.id}: release rapid (${release.toFixed(0)} ms) + hold scurt (${hold.toFixed(0)} ms) → risc de "chattering" (închideri rapide repetate pe semnale la limita threshold-ului). Mărește hold la 30+ ms.`,
      },
      en: {
        beginner: `Gate #${effect.id}: fast release (${release.toFixed(0)} ms) + short hold (${hold.toFixed(0)} ms) = the gate "flickers" rapidly on signals near the threshold. Increase Hold to at least 30 ms.`,
        advanced: `Gate #${effect.id}: fast release (${release.toFixed(0)} ms) + short hold (${hold.toFixed(0)} ms) → risk of "chattering" (rapid re-triggering on borderline signals). Increase hold to 30+ ms.`,
      },
    })
  }
  return out
}

function analyzeLimiter(effect: EffectInstance): FeedbackEntry[] {
  if (effect.bypassed) return []
  const out: FeedbackEntry[] = []
  const ceiling = paramOf(effect, LIMITER_PARAM.CEILING_DB, -1)
  const release = paramOf(effect, LIMITER_PARAM.RELEASE_MS, 50)

  if (ceiling < -6) {
    out.push({
      id: `${effect.id}:limiter-ceiling-very-low`,
      severity: 'warning',
      effectIds: [effect.id],
      ro: {
        beginner: `Limiter #${effect.id}: ceiling ${ceiling.toFixed(1)} dB e prea jos — volumul general va scădea vizibil. Pentru uz normal, -1 dB e suficient ca marjă de siguranță.`,
        advanced: `Limiter #${effect.id}: ceiling ${ceiling.toFixed(1)} dB — limitezi agresiv. La valori sub -6 dB veți auzi o reducere evidentă a volumului. Pentru mastering, -1..-0.3 dB e standard.`,
      },
      en: {
        beginner: `Limiter #${effect.id}: ceiling at ${ceiling.toFixed(1)} dB is too low — the overall volume will drop noticeably. For normal use, -1 dB is enough as a safety margin.`,
        advanced: `Limiter #${effect.id}: ceiling at ${ceiling.toFixed(1)} dB — aggressive limiting. Below -6 dB you'll hear a clear volume reduction. For mastering, -1..-0.3 dB is standard.`,
      },
    })
  }
  if (release < 10) {
    out.push({
      id: `${effect.id}:limiter-fast-release`,
      severity: 'warning',
      effectIds: [effect.id],
      ro: {
        beginner: `Limiter #${effect.id}: release de ${release.toFixed(0)} ms e prea rapid — vei auzi volumul "pompând" (pulsând) pe sunete repetate. Încearcă 30-100 ms.`,
        advanced: `Limiter #${effect.id}: release de ${release.toFixed(0)} ms e foarte rapid — pe material cu peak-uri repetate vei auzi "pumping" (volum care pulsează). Încearcă 30-100 ms.`,
      },
      en: {
        beginner: `Limiter #${effect.id}: release of ${release.toFixed(0)} ms is too fast — you'll hear the volume "pumping" (pulsing) on repeated sounds. Try 30-100 ms.`,
        advanced: `Limiter #${effect.id}: release of ${release.toFixed(0)} ms is very fast — on material with repeated peaks you'll hear "pumping" (pulsing volume). Try 30-100 ms.`,
      },
    })
  }
  return out
}

function analyzeDelay(effect: EffectInstance): FeedbackEntry[] {
  if (effect.bypassed) return []
  const out: FeedbackEntry[] = []
  const feedback = paramOf(effect, DELAY_PARAM.FEEDBACK, 0.35)
  const wet = paramOf(effect, DELAY_PARAM.DRY_WET, 0.4)
  const tone = paramOf(effect, DELAY_PARAM.TONE_HZ, 6000)

  if (feedback > 0.85) {
    out.push({
      id: `${effect.id}:delay-feedback-runaway`,
      severity: 'critical',
      effectIds: [effect.id],
      ro: {
        beginner: `Delay #${effect.id}: feedback ${Math.round(feedback * 100)}% e periculos — eco-urile se acumulează și pot distorsiona ieșirea. Coboară sub 80%.`,
        advanced: `Delay #${effect.id}: feedback ${Math.round(feedback * 100)}% — la valori peste 85% eco-urile se pot acumula și satura ieșirea ("runaway"). Coboară sub 80%.`,
      },
      en: {
        beginner: `Delay #${effect.id}: feedback at ${Math.round(feedback * 100)}% is dangerous — echoes accumulate and can saturate / distort the output. Keep below 80%.`,
        advanced: `Delay #${effect.id}: feedback at ${Math.round(feedback * 100)}% — above 85% echoes can accumulate and saturate the output ("runaway"). Keep below 80%.`,
      },
    })
  }
  if (wet > 0.7 && feedback > 0.5) {
    out.push({
      id: `${effect.id}:delay-wet-feedback-muddy`,
      severity: 'warning',
      effectIds: [effect.id],
      ro: {
        beginner: `Delay #${effect.id}: mix ridicat (${Math.round(wet * 100)}%) + feedback mare (${Math.round(feedback * 100)}%) = prea multe eco-uri, sunet aglomerat. Pe voce și instrumente, coboară mix-ul sub 40%.`,
        advanced: `Delay #${effect.id}: mix ridicat (${Math.round(wet * 100)}%) + feedback mare (${Math.round(feedback * 100)}%) → sunet aglomerat. Pe voce și instrumente melodice păstrează mix sub 40%.`,
      },
      en: {
        beginner: `Delay #${effect.id}: high mix (${Math.round(wet * 100)}%) + high feedback (${Math.round(feedback * 100)}%) = too many echoes, cluttered sound. On vocals and instruments keep mix below 40%.`,
        advanced: `Delay #${effect.id}: high mix (${Math.round(wet * 100)}%) + high feedback (${Math.round(feedback * 100)}%) → muddy sound. On vocals and melodic instruments keep mix below 40%.`,
      },
    })
  }
  if (tone > 15000) {
    out.push({
      id: `${effect.id}:delay-tone-bright`,
      severity: 'info',
      effectIds: [effect.id],
      ro: {
        beginner: `Delay #${effect.id}: tone ${(tone / 1000).toFixed(1)}k Hz — eco-urile sună la fel de strălucitoare ca originalul, ceea ce poate obosi urechea rapid. Încearcă 4-8 kHz pentru un efect mai cald.`,
        advanced: `Delay #${effect.id}: tone ${(tone / 1000).toFixed(1)}k Hz — feedback-ul e strălucitor (LP-ul e deschis). Eco-urile vor suna la fel de clare ca originalul, ceea ce poate obosi urechea. Încearcă 4-8 kHz.`,
      },
      en: {
        beginner: `Delay #${effect.id}: tone at ${(tone / 1000).toFixed(1)}k Hz — echoes sound as bright as the original, which fatigues the ear quickly. Try 4-8 kHz for a warmer effect.`,
        advanced: `Delay #${effect.id}: tone ${(tone / 1000).toFixed(1)}k Hz — feedback is bright (LP is wide open). Echoes will sound as clear as the original, which can fatigue the ear. Try 4-8 kHz.`,
      },
    })
  }
  return out
}

function analyzeReverb(effect: EffectInstance): FeedbackEntry[] {
  if (effect.bypassed) return []
  const out: FeedbackEntry[] = []
  const size = paramOf(effect, REVERB_PARAM.ROOM_SIZE, 0.7)
  const wet = paramOf(effect, REVERB_PARAM.DRY_WET, 0.3)
  const preDelay = paramOf(effect, REVERB_PARAM.PRE_DELAY_MS, 20)

  if (size > 0.92) {
    out.push({
      id: `${effect.id}:reverb-self-oscillation`,
      severity: 'critical',
      effectIds: [effect.id],
      ro: {
        beginner: `Reverb #${effect.id}: size ${Math.round(size * 100)}% — reverb-ul nu se mai stinge (reverb infinit). Coboară sub 90% pentru a evita sunetul haotic.`,
        advanced: `Reverb #${effect.id}: size ${Math.round(size * 100)}% — aproape de auto-oscilație (reverb infinit). Feedback-ul comb-filter-elor se acumulează și sunetul nu se mai stinge. Coboară sub 90%.`,
      },
      en: {
        beginner: `Reverb #${effect.id}: size at ${Math.round(size * 100)}% — the reverb tail never decays (infinite reverb). Keep below 90% to avoid a chaotic sound.`,
        advanced: `Reverb #${effect.id}: size at ${Math.round(size * 100)}% — near self-oscillation (infinite reverb). Comb feedback accumulates and the tail never decays. Keep below 90%.`,
      },
    })
  }
  if (wet > 0.6) {
    out.push({
      id: `${effect.id}:reverb-too-wet`,
      severity: 'warning',
      effectIds: [effect.id],
      ro: {
        beginner: `Reverb #${effect.id}: mix ${Math.round(wet * 100)}% — prea mult reverb, vocea sau instrumentul se pierde. Încearcă 15-35% pe voce, 20-40% pe instrumente.`,
        advanced: `Reverb #${effect.id}: mix ${Math.round(wet * 100)}% — reverb-ul domină semnalul uscat. Vocea sau instrumentul se va pierde în spațiu. Tipic: 15-35% pe voce, 20-40% pe instrumente.`,
      },
      en: {
        beginner: `Reverb #${effect.id}: mix at ${Math.round(wet * 100)}% — too much reverb, the vocal or instrument gets lost. Try 15-35% on vocals, 20-40% on instruments.`,
        advanced: `Reverb #${effect.id}: mix at ${Math.round(wet * 100)}% — reverb dominates the dry signal. Vocals or instruments will get lost in the space. Typical: 15-35% on vocals, 20-40% on instruments.`,
      },
    })
  }
  if (preDelay === 0 && wet > 0.2) {
    out.push({
      id: `${effect.id}:reverb-no-predelay`,
      severity: 'info',
      effectIds: [effect.id],
      ro: {
        beginner: `Reverb #${effect.id}: predelay 0 ms — reverb-ul începe imediat cu atacul sunetului. Adaugă 15-30 ms predelay pentru ca sunetul să rămână clar și reverb-ul să vină după.`,
        advanced: `Reverb #${effect.id}: predelay 0 ms — reverb-ul pornește imediat după atacul sunetului, ceea ce poate îneca tranzientele. Încearcă 15-30 ms pentru a păstra claritatea atacului.`,
      },
      en: {
        beginner: `Reverb #${effect.id}: predelay at 0 ms — reverb starts immediately with the sound's attack. Add 15-30 ms predelay so the sound stays upfront and the reverb follows behind.`,
        advanced: `Reverb #${effect.id}: predelay 0 ms — reverb starts immediately with the sound's attack, which can drown transients. Try 15-30 ms to keep the attack clear.`,
      },
    })
  }
  return out
}

function analyzeSaturation(effect: EffectInstance): FeedbackEntry[] {
  if (effect.bypassed) return []
  const out: FeedbackEntry[] = []
  const drive = paramOf(effect, SATURATION_PARAM.DRIVE_DB, 6)
  const tone = paramOf(effect, SATURATION_PARAM.TONE_HZ, 8000)
  const wet = paramOf(effect, SATURATION_PARAM.DRY_WET, 1)

  if (drive > 20 && tone > 12000) {
    out.push({
      id: `${effect.id}:saturation-harsh`,
      severity: 'warning',
      effectIds: [effect.id],
      ro: {
        beginner: `Saturation #${effect.id}: drive mare (+${drive.toFixed(1)} dB) + tone deschis (${(tone / 1000).toFixed(1)}k Hz) = sunet aspru, obositor. Coboară Tone la 6-8 kHz pentru a înmuia înaltele.`,
        advanced: `Saturation #${effect.id}: drive mare (+${drive.toFixed(1)} dB) + tone deschis (${(tone / 1000).toFixed(1)}k Hz) → aliasing și harshness accentuat. Coboară tone la 6-8 kHz pentru a rula armonicele de sus.`,
      },
      en: {
        beginner: `Saturation #${effect.id}: high drive (+${drive.toFixed(1)} dB) + open tone (${(tone / 1000).toFixed(1)}k Hz) = harsh, ear-fatiguing sound. Lower Tone to 6-8 kHz to soften the highs.`,
        advanced: `Saturation #${effect.id}: high drive (+${drive.toFixed(1)} dB) + bright tone (${(tone / 1000).toFixed(1)}k Hz) → aliasing and harsh upper harmonics. Lower tone to 6-8 kHz to roll off the harshest partials.`,
      },
    })
  }
  if (drive > 24) {
    out.push({
      id: `${effect.id}:saturation-extreme-drive`,
      severity: 'info',
      effectIds: [effect.id],
      ro: {
        beginner: `Saturation #${effect.id}: drive +${drive.toFixed(1)} dB — distorsiune puternică. Dacă vrei doar "căldură" subtilă, încearcă 6-12 dB cu mix 40-70%.`,
        advanced: `Saturation #${effect.id}: drive +${drive.toFixed(1)} dB — distorsiune pronunțată. Intenționat? Dacă vrei densitate subtilă, încearcă 6-12 dB cu mix 40-70%.`,
      },
      en: {
        beginner: `Saturation #${effect.id}: drive +${drive.toFixed(1)} dB — heavy distortion. If you just want subtle "warmth", try 6-12 dB at 40-70% mix.`,
        advanced: `Saturation #${effect.id}: drive +${drive.toFixed(1)} dB — pronounced distortion. Intentional? For subtle density, try 6-12 dB at 40-70% mix.`,
      },
    })
  }
  if (wet < 0.2 && drive > 0) {
    out.push({
      id: `${effect.id}:saturation-very-dry`,
      severity: 'info',
      effectIds: [effect.id],
      ro: {
        beginner: `Saturation #${effect.id}: mix ${Math.round(wet * 100)}% — efectul e aproape inaudibil. Mărește Mix sau Drive-ul pentru a auzi diferența.`,
        advanced: `Saturation #${effect.id}: mix ${Math.round(wet * 100)}% — aproape inaudibil. Mărește mix sau drive-ul pentru a simți efectul.`,
      },
      en: {
        beginner: `Saturation #${effect.id}: mix at ${Math.round(wet * 100)}% — the effect is barely audible. Increase Mix or Drive to hear the difference.`,
        advanced: `Saturation #${effect.id}: mix at ${Math.round(wet * 100)}% — barely audible. Increase mix or drive to hear the effect.`,
      },
    })
  }
  return out
}

// ─── Style B — chain-level rules ─────────────────────────────────────────

function analyzeChain(chain: EffectInstance[]): FeedbackEntry[] {
  const out: FeedbackEntry[] = []
  const active = chain.filter((e) => !e.bypassed)

  // Rule: EQ before Compressor with low-freq boost amplifies bass triggering.
  for (let i = 0; i < active.length - 1; i++) {
    const a = active[i]
    const b = active[i + 1]
    if (!isEq(a) || !isCompressor(b)) continue

    let bassBoosted = false
    for (let band = 0; band < EQ_BANDS; band++) {
      const enabled = paramOf(a, eqParamId(band, EQ_BAND_PARAM.ENABLED), 0) >= 0.5
      if (!enabled) continue
      const freq = paramOf(a, eqParamId(band, EQ_BAND_PARAM.FREQ), 1000)
      const gain = paramOf(a, eqParamId(band, EQ_BAND_PARAM.GAIN), 0)
      if (freq < 300 && gain > 3) bassBoosted = true
    }
    if (bassBoosted) {
      out.push({
        id: `chain:${a.id}->${b.id}:bass-boost-precomp`,
        severity: 'warning',
        effectIds: [a.id, b.id],
        ro: {
          beginner: `EQ #${a.id} (boost de bas) → Compressor #${b.id}: bass-ul amplificat face compresorul să reacționeze prea puternic la frecvențele joase. Mută EQ-ul *după* compressor, sau ridică SC HPF pe compressor.`,
          advanced: `EQ #${a.id} (boost de bas) → Compressor #${b.id}: boost-ul amplifică declanșarea compresorului pe frecvențele joase. Pentru tonalitate stabilă, mută EQ-ul *după* compressor sau urcă SC HPF pe compressor.`,
        },
        en: {
          beginner: `EQ #${a.id} (bass boost) → Compressor #${b.id}: the boosted bass makes the compressor over-react to low frequencies. Move EQ *after* the compressor, or raise the SC HPF on the compressor.`,
          advanced: `EQ #${a.id} (bass boost) → Compressor #${b.id}: the boost makes the compressor react harder to lows. For stable tone, move EQ *after* the compressor, or raise the SC HPF on the compressor.`,
        },
      })
    }
  }

  // Rule: two compressors back-to-back with similar settings → pumping risk.
  for (let i = 0; i < active.length - 1; i++) {
    const a = active[i]
    const b = active[i + 1]
    if (!isCompressor(a) || !isCompressor(b)) continue
    const aAttack = paramOf(a, COMPRESSOR_PARAM.ATTACK_MS, 10)
    const bAttack = paramOf(b, COMPRESSOR_PARAM.ATTACK_MS, 10)
    if (aAttack <= 5 && bAttack <= 5) {
      out.push({
        id: `chain:${a.id}->${b.id}:double-fast-comp`,
        severity: 'warning',
        effectIds: [a.id, b.id],
        ro: {
          beginner: `Două compressoare (#${a.id} → #${b.id}) cu attack rapid unul după altul — dublezi riscul de "pumping". Mai simplu: un singur compressor cu attack lent + un limiter la final.`,
          advanced: `Două Compressor-i (#${a.id} → #${b.id}) cu attack rapid în cascadă — risc de "pumping" și dinamică artificială. Folosește un compressor cu attack lent + un limiter la final.`,
        },
        en: {
          beginner: `Two compressors (#${a.id} → #${b.id}) with fast attack back-to-back — doubles the risk of "pumping". Simpler: one slow-attack compressor + a limiter at the end.`,
          advanced: `Two compressors (#${a.id} → #${b.id}) with fast attack in series — risks "pumping" and artificial dynamics. Use one slow-attack compressor + a limiter at the end instead.`,
        },
      })
    }
  }

  // Rule: only an EQ with no enabled bands → no-op chain.
  if (active.length === 1 && isEq(active[0])) {
    const eq = active[0]
    let any = false
    for (let band = 0; band < EQ_BANDS; band++) {
      if (paramOf(eq, eqParamId(band, EQ_BAND_PARAM.ENABLED), 0) >= 0.5) {
        any = true
        break
      }
    }
    if (!any) {
      out.push({
        id: `chain:eq-only-no-bands`,
        severity: 'info',
        effectIds: [eq.id],
        ro: {
          beginner: `Singurul efect e un EQ fără benzi activate — semnalul trece neschimbat. Click pe "Band 1" sau "Band 2" pentru a activa o bandă.`,
          advanced: `Singurul efect activ e un EQ fără benzi pornite — chain-ul e momentan transparent. Activează cel puțin o bandă pentru a auzi vreo diferență.`,
        },
        en: {
          beginner: `The only effect is an EQ with no bands enabled — the signal passes through unchanged. Click "Band 1" or "Band 2" to enable a band.`,
          advanced: `The only active effect is an EQ with no enabled bands — the chain is currently transparent. Enable at least one band to hear something.`,
        },
      })
    }
  }

  // Rule: chain starts with compressor at very low threshold → unusual; usually
  // gain staging before compression is preferred.
  if (active.length > 0 && isCompressor(active[0])) {
    const c = active[0]
    const t = paramOf(c, COMPRESSOR_PARAM.THRESHOLD_DB, -18)
    if (t < -40) {
      out.push({
        id: `chain:first-comp-deep-threshold`,
        severity: 'info',
        effectIds: [c.id],
        ro: {
          beginner: `Compressor #${c.id} pe primul slot cu threshold ${t.toFixed(1)} dB — comprimă aproape tot, inclusiv zgomotul de fond. Încearcă mai întâi un Gate sau ajustează volumul de intrare.`,
          advanced: `Compressor #${c.id} pe primul slot cu threshold ${t.toFixed(1)} dB — comprimi aproape tot semnalul, inclusiv zgomotul. De obicei se face mai întâi gain staging și/sau gate, apoi compresie.`,
        },
        en: {
          beginner: `Compressor #${c.id} first in chain with threshold ${t.toFixed(1)} dB — almost everything including background noise gets compressed. Try adding a Gate first, or adjust the input level.`,
          advanced: `Compressor #${c.id} as the first effect with threshold ${t.toFixed(1)} dB — almost everything (including noise) gets compressed. Typically gain-stage and/or gate first, then compress.`,
        },
      })
    }
  }

  // Rule: Reverb followed immediately by Compressor → reverb tail triggers comp.
  for (let i = 0; i < active.length - 1; i++) {
    const a = active[i]
    const b = active[i + 1]
    if (!isReverb(a) || !isCompressor(b)) continue
    out.push({
      id: `chain:${a.id}->${b.id}:reverb-into-compressor`,
      severity: 'warning',
      effectIds: [a.id, b.id],
      ro: {
        beginner: `Reverb #${a.id} → Compressor #${b.id}: reverb-ul produce un "ecou" lung, iar compresorul îl va tăia ritmic — sună ciudat. Mută compresorul înaintea reverb-ului.`,
        advanced: `Reverb #${a.id} → Compressor #${b.id}: tail-ul reverb-ului va declanșa compresorul, "pompând" semnalul în mod artificial. Pune compresorul *înaintea* reverb-ului.`,
      },
      en: {
        beginner: `Reverb #${a.id} → Compressor #${b.id}: the reverb's long tail will cause the compressor to chop it rhythmically — sounds odd. Move the compressor before the reverb.`,
        advanced: `Reverb #${a.id} → Compressor #${b.id}: the reverb tail will keep triggering the compressor, causing artificial "pumping." Put the compressor *before* the reverb.`,
      },
    })
  }

  // Rule: Saturation after Reverb → saturates the reverb tail (rarely intended).
  for (let i = 0; i < active.length - 1; i++) {
    const a = active[i]
    const b = active[i + 1]
    if (!isReverb(a) || !isSaturation(b)) continue
    const drive = paramOf(b, SATURATION_PARAM.DRIVE_DB, 6)
    if (drive > 10) {
      out.push({
        id: `chain:${a.id}->${b.id}:reverb-into-saturation`,
        severity: 'info',
        effectIds: [a.id, b.id],
        ro: {
          beginner: `Reverb #${a.id} → Saturation #${b.id}: saturezi și "coada" reverb-ului, nu doar sunetul direct. Dacă vrei un efect mai curat, pune Saturation înaintea Reverb.`,
          advanced: `Reverb #${a.id} → Saturation #${b.id}: saturai inclusiv tail-ul de reverb, ceea ce poate suna nenatural. Dacă intenționat, e un efect de "grit on ambience"; altfel mută Saturation înaintea Reverb.`,
        },
        en: {
          beginner: `Reverb #${a.id} → Saturation #${b.id}: you're saturating the reverb tail as well, not just the dry signal. For a cleaner sound, move Saturation before Reverb.`,
          advanced: `Reverb #${a.id} → Saturation #${b.id}: you're saturating the reverb tail too, which can sound unnatural. If intentional, it's a "grit on ambience" effect; otherwise move Saturation before Reverb.`,
        },
      })
    }
  }

  // Rule: Delay after Reverb → echoes of reverb tails = very muddy.
  for (let i = 0; i < active.length - 1; i++) {
    const a = active[i]
    const b = active[i + 1]
    if (!isReverb(a) || !isDelay(b)) continue
    const delayWet = paramOf(b, DELAY_PARAM.DRY_WET, 0.4)
    if (delayWet > 0.25) {
      out.push({
        id: `chain:${a.id}->${b.id}:reverb-into-delay`,
        severity: 'warning',
        effectIds: [a.id, b.id],
        ro: {
          beginner: `Reverb #${a.id} → Delay #${b.id}: delay-ul repetă "coada" lungă a reverb-ului și totul devine foarte aglomerat. Încearcă ordinea inversă: Delay înainte de Reverb.`,
          advanced: `Reverb #${a.id} → Delay #${b.id}: delay-ul repetă tail-ul de reverb, rezultând un sunet extrem de aglomerat. Ordinea standard este Delay → Reverb (reverb-ul îmbracă eco-urile, nu invers).`,
        },
        en: {
          beginner: `Reverb #${a.id} → Delay #${b.id}: the delay repeats the reverb's long tail and everything gets very muddy. Try the reversed order: Delay before Reverb.`,
          advanced: `Reverb #${a.id} → Delay #${b.id}: delay repeats the reverb tail, resulting in a very cluttered sound. Standard order is Delay → Reverb (reverb wraps the echoes, not the other way around).`,
        },
      })
    }
  }

  // Rule: Gate after Compressor with fast release → gate may chatter on pumped signal.
  for (let i = 0; i < active.length - 1; i++) {
    const a = active[i]
    const b = active[i + 1]
    if (!isCompressor(a) || !isGate(b)) continue
    const compRelease = paramOf(a, COMPRESSOR_PARAM.RELEASE_MS, 100)
    const gateThresh = paramOf(b, GATE_PARAM.THRESHOLD_DB, -40)
    if (compRelease < 30 && gateThresh > -30) {
      out.push({
        id: `chain:${a.id}->${b.id}:comp-fast-release-gate`,
        severity: 'info',
        effectIds: [a.id, b.id],
        ro: {
          beginner: `Compressor #${a.id} → Gate #${b.id}: compresorul lasă sunetul să scadă repede, iar gate-ul îl taie brusc — auzi un "clipping" ritmic. Încearcă să mărești release-ul la compresor.`,
          advanced: `Compressor #${a.id} (release rapid ${compRelease.toFixed(0)} ms) → Gate #${b.id}: release-ul rapid al compresorului scade nivelul sub threshold-ul gate-ului, declanșând chattering. Mărește release-ul compresorului sau coboară threshold-ul gate-ului.`,
        },
        en: {
          beginner: `Compressor #${a.id} → Gate #${b.id}: the compressor lets the level drop quickly, and the gate snaps it shut — you get rhythmic chopping. Try increasing the compressor's release time.`,
          advanced: `Compressor #${a.id} (fast release ${compRelease.toFixed(0)} ms) → Gate #${b.id}: the fast compressor release can dip the level below the gate threshold, causing chattering. Increase the compressor release or lower the gate threshold.`,
        },
      })
    }
  }

  // Rule: Limiter not at the end → unusual; typically the last stage.
  const lastActive = active[active.length - 1]
  if (active.length > 1 && lastActive && !isLimiter(lastActive)) {
    const limiterIdx = active.findIndex(isLimiter)
    if (limiterIdx !== -1 && limiterIdx < active.length - 1) {
      const lim = active[limiterIdx]
      out.push({
        id: `chain:limiter-not-last:${lim.id}`,
        severity: 'warning',
        effectIds: [lim.id],
        ro: {
          beginner: `Limiter #${lim.id} nu este ultimul efect din lanț. Efectele care urmează după el pot face sunetul mai tare decât limita setată. Mută limiter-ul la final.`,
          advanced: `Limiter #${lim.id} nu e pe ultima poziție din chain — efectele de după pot depăși ceiling-ul său. Un limiter e de obicei ultimul în lanț.`,
        },
        en: {
          beginner: `Limiter #${lim.id} is not the last effect in the chain. Effects after it can make the signal louder than your set ceiling. Move the limiter to the end.`,
          advanced: `Limiter #${lim.id} is not the last effect in the chain — effects after it can exceed its ceiling. A limiter is typically the final stage.`,
        },
      })
    }
  }

  return out
}

function analyzeChorus(effect: EffectInstance): FeedbackEntry[] {
  const out: FeedbackEntry[] = []
  const rate  = paramOf(effect, CHORUS_PARAM.RATE, 1.5)
  const depth = paramOf(effect, CHORUS_PARAM.DEPTH, 0.5)
  const mix   = paramOf(effect, CHORUS_PARAM.DRY_WET, 0.5)

  if (rate > 3.5) {
    out.push({
      id: `chorus:fast-rate:${effect.id}`,
      severity: 'info',
      effectIds: [effect.id],
      ro: { beginner: 'Rate-ul mare (>3.5 Hz) face chorus-ul să sune ca vibrato. Încearcă sub 2 Hz pentru un efect mai natural.', advanced: 'LFO >3.5 Hz → frecvența de modulație intră în zona de vibrato perceptibil. Sub 2 Hz pentru chorus pur, fără artefacte de pitch.' },
      en: { beginner: 'High rate (>3.5 Hz) makes chorus sound like vibrato. Try below 2 Hz for a more natural effect.', advanced: 'LFO >3.5 Hz → modulation frequency enters perceptible vibrato range. Below 2 Hz for pure chorus without pitch artifacts.' },
    })
  }
  if (mix > 0.8) {
    out.push({
      id: `chorus:high-mix:${effect.id}`,
      severity: 'info',
      effectIds: [effect.id],
      ro: { beginner: 'Mix mare înseamnă că ai puțin semnal original. Încearcă 40–60 % pentru un sunet mai echilibrat.', advanced: 'Wet >80 % — semnalul dry e prea atenuat. Chorus tipic: 40–60 % wet pentru a păstra coerența în mix.' },
      en: { beginner: 'High mix means little original signal. Try 40–60 % for a more balanced sound.', advanced: 'Wet >80 % — dry signal is overly attenuated. Typical chorus: 40–60 % wet to preserve mix coherence.' },
    })
  }
  if (depth < 0.1 && rate < 0.5) {
    out.push({
      id: `chorus:ineffective:${effect.id}`,
      severity: 'info',
      effectIds: [effect.id],
      ro: { beginner: 'Depth și Rate mici — efectul e aproape imperceptibil. Crește cel puțin unul din ei.', advanced: 'Depth <10 % și Rate <0.5 Hz → modulare sub pragul perceptibil. Crește depth sau rate pentru a activa efectul.' },
      en: { beginner: 'Low depth and rate — effect is nearly imperceptible. Increase at least one.', advanced: 'Depth <10 % and Rate <0.5 Hz → modulation below perceptible threshold. Increase depth or rate to activate the effect.' },
    })
  }
  return out
}

function analyzeFlanger(effect: EffectInstance): FeedbackEntry[] {
  const out: FeedbackEntry[] = []
  const feedback = paramOf(effect, FLANGER_PARAM.FEEDBACK, 0.5)
  const rate     = paramOf(effect, FLANGER_PARAM.RATE, 0.5)

  if (Math.abs(feedback) > 0.85) {
    out.push({
      id: `flanger:high-feedback:${effect.id}`,
      severity: 'warning',
      effectIds: [effect.id],
      ro: { beginner: 'Feedback mare (>85 %) poate crea un sunet exagerat de rezonant sau instabil. Coboară sub 70 % pentru siguranță.', advanced: 'Feedback >±0.85 → rezonanță ridicată a comb-filter-ului. Riscul de auto-oscillation crește. Limitat la 0.95 în engine, dar valorile de peste 0.85 pot suna neplăcut.' },
      en: { beginner: 'High feedback (>85 %) can create an overly resonant or unstable sound. Lower below 70 % for safety.', advanced: 'Feedback >±0.85 → high comb-filter resonance. Auto-oscillation risk increases. Engine caps at 0.95 but values above 0.85 can sound unpleasant.' },
    })
  }
  if (rate > 4) {
    out.push({
      id: `flanger:fast-rate:${effect.id}`,
      severity: 'info',
      effectIds: [effect.id],
      ro: { beginner: 'Rate rapid (>4 Hz) face flangerul să sune mai mult ca un vibrato metalic. Sub 2 Hz pentru efectul clasic.', advanced: 'LFO >4 Hz → sweep-ul comb-filter-ului intră în zona de frecvență audibilă ca variație de pitch. Classic flanger: 0.1–1 Hz.' },
      en: { beginner: 'Fast rate (>4 Hz) makes the flanger sound more like metallic vibrato. Below 2 Hz for classic effect.', advanced: 'LFO >4 Hz → comb sweep enters audible pitch variation zone. Classic flanger: 0.1–1 Hz.' },
    })
  }
  return out
}

function analyzePitchShift(effect: EffectInstance): FeedbackEntry[] {
  const out: FeedbackEntry[] = []
  const semitones = paramOf(effect, PITCH_SHIFT_PARAM.SEMITONES, 0)
  const mix       = paramOf(effect, PITCH_SHIFT_PARAM.DRY_WET, 1)

  if (semitones === 0 && mix > 0.5) {
    out.push({
      id: `pitch:zero-semitones:${effect.id}`,
      severity: 'info',
      effectIds: [effect.id],
      ro: { beginner: 'Semitones = 0 înseamnă că pitch-ul nu se schimbă. Ajustează valoarea pentru a auzi efectul.', advanced: 'Pitch ratio = 2^(0/12) = 1.0 → fără transpoziție. Efectul procesează audio fără modificare — setează semitones ≠ 0.' },
      en: { beginner: 'Semitones = 0 means pitch is unchanged. Adjust the value to hear the effect.', advanced: 'Pitch ratio = 2^(0/12) = 1.0 → no transposition. Effect processes audio without change — set semitones ≠ 0.' },
    })
  }
  if (Math.abs(semitones) > 7 && mix > 0.7) {
    out.push({
      id: `pitch:large-shift:${effect.id}`,
      severity: 'info',
      effectIds: [effect.id],
      ro: { beginner: 'Transpoziție mare (>7 semitone) la mix ridicat poate crea artefacte audibile. Încearcă un mix de 50–70 %.', advanced: 'Transpoziție >±7 st → ratio >1.5 sau <0.67. Algoritmul granular devine mai vizibil; amestecul cu dry (mix 50–70 %) maschează artefactele de grain.' },
      en: { beginner: 'Large shift (>7 semitones) at high mix can create audible artifacts. Try 50–70 % mix.', advanced: 'Shift >±7 st → ratio >1.5 or <0.67. Granular algorithm becomes more audible; blending with dry (mix 50–70 %) masks grain artifacts.' },
    })
  }
  if (mix > 0.3 && mix < 0.7 && semitones !== 0) {
    out.push({
      id: `pitch:harmonizer:${effect.id}`,
      severity: 'info',
      effectIds: [effect.id],
      ro: { beginner: 'Mix de 30–70 % cu transpoziție activă creează un efect de harmonizer — originalul și nota transpusă se aud împreună.', advanced: 'Crossfade dry/wet la 30–70 % cu semitones ≠ 0 → harmonizer. Intervalul creat: semitones față de fundamental. Uzual: +3 st (terță minoră), +4 (terță majoră), +7 (cvintă).' },
      en: { beginner: '30–70 % mix with active pitch shift creates a harmonizer — you hear both the original and transposed note.', advanced: 'Dry/wet crossfade at 30–70 % with semitones ≠ 0 → harmonizer. Created interval: semitones relative to fundamental. Common: +3 st (minor third), +4 (major third), +7 (fifth).' },
    })
  }
  return out
}

// ─── public API ──────────────────────────────────────────────────────────

export function analyzeAll(effects: EffectInstance[]): FeedbackEntry[] {
  const out: FeedbackEntry[] = []
  for (const e of effects) {
    if (isCompressor(e))       out.push(...analyzeCompressor(e))
    else if (isEq(e))          out.push(...analyzeEq(e))
    else if (isGain(e))        out.push(...analyzeGain(e))
    else if (isGate(e))        out.push(...analyzeGate(e))
    else if (isLimiter(e))     out.push(...analyzeLimiter(e))
    else if (isDelay(e))       out.push(...analyzeDelay(e))
    else if (isReverb(e))      out.push(...analyzeReverb(e))
    else if (isSaturation(e))  out.push(...analyzeSaturation(e))
    else if (isChorus(e))      out.push(...analyzeChorus(e))
    else if (isFlanger(e))     out.push(...analyzeFlanger(e))
    else if (isPitchShift(e))  out.push(...analyzePitchShift(e))
  }
  out.push(...analyzeChain(effects))
  out.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
  return out
}

export function pickFeedback(
  entry: FeedbackEntry,
  language: EducationLanguage,
  mode: EducationMode,
): string {
  return entry[language][mode]
}
