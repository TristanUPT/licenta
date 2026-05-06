/**
 * Rule-based feedback engine. Pure functions only — fed the current effects
 * chain, returns a list of bilingual notes about what the user is doing.
 *
 * Two rule families:
 *   • Style A — per-effect: looks at one effect's parameter values
 *   • Style B — chain-level: looks at order and combinations between effects
 */

import {
  COMPRESSOR_PARAM,
  DELAY_PARAM,
  EQ_BAND_PARAM,
  EQ_BANDS,
  GAIN_PARAM,
  GATE_PARAM,
  LIMITER_PARAM,
  REVERB_PARAM,
  SATURATION_PARAM,
  EffectType,
  eqParamId,
  type EffectInstance,
} from '@/types/effects'
import type { EducationLanguage } from '@/store/educationStore'

export type FeedbackSeverity = 'info' | 'warning' | 'critical'

export interface FeedbackEntry {
  id: string
  severity: FeedbackSeverity
  /** Effect IDs this feedback references (for highlight in UI). */
  effectIds: number[]
  ro: string
  en: string
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
      ro: `Compressor #${effect.id}: ratio ${ratio.toFixed(1)}:1 cu attack ${attack.toFixed(1)} ms — practic e un *limiter*. Util pentru a prinde peak-uri scurte, dar elimină dinamica naturală.`,
      en: `Compressor #${effect.id}: ratio ${ratio.toFixed(1)}:1 with attack ${attack.toFixed(1)} ms — this is effectively a *limiter*. Useful for catching short peaks, but removes natural dynamics.`,
    })
  }

  if (ratio < 2 && wet > 0.95) {
    out.push({
      id: `${effect.id}:comp-very-gentle`,
      severity: 'info',
      effectIds: [effect.id],
      ro: `Compressor #${effect.id}: ratio ${ratio.toFixed(1)}:1 e foarte gentle — comprimă doar peak-urile cele mai mari. Tipic pentru *bus compression* sau "glue".`,
      en: `Compressor #${effect.id}: ratio ${ratio.toFixed(1)}:1 is very gentle — only the loudest peaks get compressed. Typical for *bus compression* or "glue".`,
    })
  }

  if (release < 30) {
    out.push({
      id: `${effect.id}:comp-pumping-risk`,
      severity: 'warning',
      effectIds: [effect.id],
      ro: `Compressor #${effect.id}: release ${release.toFixed(0)} ms e foarte rapid — risc de "pumping" audibil pe material muzical susținut. Tipic 80-200 ms pe voce, 200-400 ms pe bus.`,
      en: `Compressor #${effect.id}: release ${release.toFixed(0)} ms is very fast — risks audible "pumping" on sustained material. Typical 80-200 ms on vocals, 200-400 ms on buses.`,
    })
  }

  if (release > 800) {
    out.push({
      id: `${effect.id}:comp-release-too-slow`,
      severity: 'warning',
      effectIds: [effect.id],
      ro: `Compressor #${effect.id}: release ${release.toFixed(0)} ms e foarte lent — compressor-ul nu se redeschide la timp pentru următoarea frază, semnalul rămâne "stuck" sub threshold.`,
      en: `Compressor #${effect.id}: release ${release.toFixed(0)} ms is very slow — the compressor won't reopen in time for the next phrase, signal stays "stuck" under threshold.`,
    })
  }

  if (threshold > -2) {
    out.push({
      id: `${effect.id}:comp-threshold-too-high`,
      severity: 'info',
      effectIds: [effect.id],
      ro: `Compressor #${effect.id}: threshold ${threshold.toFixed(1)} dB e foarte aproape de 0 dBFS — compresorul aproape nu acționează. Coboară-l pentru a vedea gain reduction.`,
      en: `Compressor #${effect.id}: threshold ${threshold.toFixed(1)} dB is close to 0 dBFS — the compressor barely acts. Lower it to see gain reduction.`,
    })
  }

  if (knee === 0 && ratio >= 6) {
    out.push({
      id: `${effect.id}:comp-hard-knee-aggressive`,
      severity: 'info',
      effectIds: [effect.id],
      ro: `Compressor #${effect.id}: knee 0 dB + ratio ${ratio.toFixed(1)}:1 — comportament "brick wall" abrupt. Adaugă knee 6-12 dB pentru o tranziție muzicală.`,
      en: `Compressor #${effect.id}: knee 0 dB + ratio ${ratio.toFixed(1)}:1 — abrupt "brick wall" behaviour. Add 6-12 dB knee for a musical transition.`,
    })
  }

  if (makeup > 18) {
    out.push({
      id: `${effect.id}:comp-makeup-extreme`,
      severity: 'warning',
      effectIds: [effect.id],
      ro: `Compressor #${effect.id}: makeup +${makeup.toFixed(1)} dB e extrem — vei urca semnalul artificial de mult. Verifică nivelul de output cu un limiter.`,
      en: `Compressor #${effect.id}: makeup +${makeup.toFixed(1)} dB is extreme — you're boosting the signal heavily. Check output with a limiter.`,
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
        ro: `EQ #${effect.id} banda ${band + 1}: boost +${gain.toFixed(1)} dB pe Q ${q.toFixed(1)} (lățime mare) — riscă să sune harsh / clipping. Crește Q pentru o intervenție mai chirurgicală.`,
        en: `EQ #${effect.id} band ${band + 1}: +${gain.toFixed(1)} dB at Q ${q.toFixed(1)} (wide) — likely to sound harsh / clip. Increase Q for surgical work.`,
      })
    }
    if (gain < -18) {
      out.push({
        id: `${effect.id}:eq-band${band}-deep-cut`,
        severity: 'info',
        effectIds: [effect.id],
        ro: `EQ #${effect.id} banda ${band + 1}: cut ${gain.toFixed(1)} dB e foarte adânc. Pentru rezonanțe punctuale, un Notch ar fi mai eficient.`,
        en: `EQ #${effect.id} band ${band + 1}: ${gain.toFixed(1)} dB cut is very deep. For point resonances, a Notch would be more effective.`,
      })
    }
    if ((bandType === 1 || bandType === 2) && q > 3) {
      // shelf with very high Q — produces overshoot/ringing
      out.push({
        id: `${effect.id}:eq-band${band}-shelf-high-q`,
        severity: 'info',
        effectIds: [effect.id],
        ro: `EQ #${effect.id} banda ${band + 1}: shelf cu Q ${q.toFixed(1)} produce un "umflătură" la cutoff (Gibbs-like ringing). Pentru shelf curat, păstrează Q în jur de 0.7.`,
        en: `EQ #${effect.id} band ${band + 1}: shelf at Q ${q.toFixed(1)} produces a bump at the cutoff (Gibbs-like ringing). Keep shelf Q near 0.7 for a clean response.`,
      })
    }
    if ((bandType === 3 || bandType === 4) && Math.abs(gain) > 0.1) {
      // HPF/LPF with non-zero gain set (no effect, but might be confusing)
      out.push({
        id: `${effect.id}:eq-band${band}-pass-gain-ignored`,
        severity: 'info',
        effectIds: [effect.id],
        ro: `EQ #${effect.id} banda ${band + 1}: tipul HPF/LPF ignoră parametrul Gain. Schimbă Freq sau Q pentru a regla filtrul.`,
        en: `EQ #${effect.id} band ${band + 1}: HPF/LPF types ignore Gain. Adjust Freq or Q to tune the filter.`,
      })
    }
    if (freq < 30 && bandType !== 3) {
      out.push({
        id: `${effect.id}:eq-band${band}-subsonic`,
        severity: 'info',
        effectIds: [effect.id],
        ro: `EQ #${effect.id} banda ${band + 1}: freq ${freq.toFixed(0)} Hz e sub plaja audibilă. Util doar pentru HPF de curățare a infrasunetelor.`,
        en: `EQ #${effect.id} band ${band + 1}: freq ${freq.toFixed(0)} Hz is below audible range. Only useful as a sub-sonic cleanup HPF.`,
      })
    }
  }

  if (enabledBands.length === 0) {
    out.push({
      id: `${effect.id}:eq-no-bands`,
      severity: 'info',
      effectIds: [effect.id],
      ro: `EQ #${effect.id}: nicio bandă activă — efectul e inert. Activează cel puțin o bandă (click pe "Band X") pentru a auzi diferența.`,
      en: `EQ #${effect.id}: no bands enabled — the effect is inert. Enable at least one band (click "Band X") to hear it.`,
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
      ro: `Gain #${effect.id}: +${gainDb.toFixed(1)} dB e foarte mare — verifică să nu clipeze ieșirea (peak meter).`,
      en: `Gain #${effect.id}: +${gainDb.toFixed(1)} dB is very high — make sure the output doesn't clip (check the peak meter).`,
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
      ro: `Gate #${effect.id}: threshold la ${threshold.toFixed(1)} dB e foarte sus — gate-ul se va activa în mijlocul frazelor muzicale, nu doar pe pauze. Coboară la -30..-20 dB.`,
      en: `Gate #${effect.id}: threshold at ${threshold.toFixed(1)} dB is very high — it will chop into musical phrases, not just silence. Lower to -30..-20 dB.`,
    })
  }
  if (range > -6) {
    out.push({
      id: `${effect.id}:gate-range-weak`,
      severity: 'info',
      effectIds: [effect.id],
      ro: `Gate #${effect.id}: range ${range.toFixed(1)} dB e aproape de 0 — atenuarea când gate-ul e "închis" e minimă. Setează la -40..-60 dB pentru efect real de noise gate.`,
      en: `Gate #${effect.id}: range ${range.toFixed(1)} dB is near 0 — attenuation when closed is minimal. Set to -40..-60 dB for a real gating effect.`,
    })
  }
  if (release < 20 && hold < 10) {
    out.push({
      id: `${effect.id}:gate-fast-release-short-hold`,
      severity: 'warning',
      effectIds: [effect.id],
      ro: `Gate #${effect.id}: release rapid (${release.toFixed(0)} ms) + hold scurt (${hold.toFixed(0)} ms) → risc de "chattering" (închideri rapide repetate pe semnale la limita threshold-ului). Mărește hold la 30+ ms.`,
      en: `Gate #${effect.id}: fast release (${release.toFixed(0)} ms) + short hold (${hold.toFixed(0)} ms) → risk of "chattering" (rapid re-triggering on borderline signals). Increase hold to 30+ ms.`,
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
      ro: `Limiter #${effect.id}: ceiling ${ceiling.toFixed(1)} dB — limitezi agresiv. La valori sub -6 dB veți auzi o reducere evidentă a volumului. Pentru mastering, -1..-0.3 dB e standard.`,
      en: `Limiter #${effect.id}: ceiling at ${ceiling.toFixed(1)} dB — aggressive limiting. Below -6 dB you'll hear a clear volume reduction. For mastering, -1..-0.3 dB is standard.`,
    })
  }
  if (release < 10) {
    out.push({
      id: `${effect.id}:limiter-fast-release`,
      severity: 'warning',
      effectIds: [effect.id],
      ro: `Limiter #${effect.id}: release de ${release.toFixed(0)} ms e foarte rapid — pe material cu peak-uri repetate vei auzi "pumping" (volum care pulsează). Încearcă 30-100 ms.`,
      en: `Limiter #${effect.id}: release of ${release.toFixed(0)} ms is very fast — on material with repeated peaks you'll hear "pumping" (pulsing volume). Try 30-100 ms.`,
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
      ro: `Delay #${effect.id}: feedback ${Math.round(feedback * 100)}% — la valori peste 85% eco-urile se pot acumula și satura ieșirea ("runaway"). Coboară sub 80%.`,
      en: `Delay #${effect.id}: feedback at ${Math.round(feedback * 100)}% — above 85% echoes can accumulate and saturate the output ("runaway"). Keep below 80%.`,
    })
  }
  if (wet > 0.7 && feedback > 0.5) {
    out.push({
      id: `${effect.id}:delay-wet-feedback-muddy`,
      severity: 'warning',
      effectIds: [effect.id],
      ro: `Delay #${effect.id}: mix ridicat (${Math.round(wet * 100)}%) + feedback mare (${Math.round(feedback * 100)}%) → sunet aglomerat. Pe voce și instrumente melodice păstrează mix sub 40%.`,
      en: `Delay #${effect.id}: high mix (${Math.round(wet * 100)}%) + high feedback (${Math.round(feedback * 100)}%) → muddy sound. On vocals and melodic instruments keep mix below 40%.`,
    })
  }
  if (tone > 15000) {
    out.push({
      id: `${effect.id}:delay-tone-bright`,
      severity: 'info',
      effectIds: [effect.id],
      ro: `Delay #${effect.id}: tone ${(tone / 1000).toFixed(1)}k Hz — feedback-ul e strălucitor (LP-ul e deschis). Eco-urile vor suna la fel de clare ca originalul, ceea ce poate obosi urechea. Încearcă 4-8 kHz.`,
      en: `Delay #${effect.id}: tone ${(tone / 1000).toFixed(1)}k Hz — feedback is bright (LP is wide open). Echoes will sound as clear as the original, which can fatigue the ear. Try 4-8 kHz.`,
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
      ro: `Reverb #${effect.id}: size ${Math.round(size * 100)}% — aproape de auto-oscilație (reverb infinit). Feedback-ul comb-filter-elor se acumulează și sunetul nu se mai stinge. Coboară sub 90%.`,
      en: `Reverb #${effect.id}: size at ${Math.round(size * 100)}% — near self-oscillation (infinite reverb). Comb feedback accumulates and the tail never decays. Keep below 90%.`,
    })
  }
  if (wet > 0.6) {
    out.push({
      id: `${effect.id}:reverb-too-wet`,
      severity: 'warning',
      effectIds: [effect.id],
      ro: `Reverb #${effect.id}: mix ${Math.round(wet * 100)}% — reverb-ul domină semnalul uscat. Vocea sau instrumentul se va pierde în spațiu. Tipic: 15-35% pe voce, 20-40% pe instrumente.`,
      en: `Reverb #${effect.id}: mix at ${Math.round(wet * 100)}% — reverb dominates the dry signal. Vocals or instruments will get lost in the space. Typical: 15-35% on vocals, 20-40% on instruments.`,
    })
  }
  if (preDelay === 0 && wet > 0.2) {
    out.push({
      id: `${effect.id}:reverb-no-predelay`,
      severity: 'info',
      effectIds: [effect.id],
      ro: `Reverb #${effect.id}: predelay 0 ms — reverb-ul pornește imediat după atacul sunetului, ceea ce poate îneca tranzientele. Încearcă 15-30 ms pentru a păstra claritatea atacului.`,
      en: `Reverb #${effect.id}: predelay 0 ms — reverb starts immediately with the sound's attack, which can drown transients. Try 15-30 ms to keep the attack clear.`,
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
      ro: `Saturation #${effect.id}: drive mare (+${drive.toFixed(1)} dB) + tone deschis (${(tone / 1000).toFixed(1)}k Hz) → aliasing și harshness accentuat. Coboară tone la 6-8 kHz pentru a rula armonicele de sus.`,
      en: `Saturation #${effect.id}: high drive (+${drive.toFixed(1)} dB) + bright tone (${(tone / 1000).toFixed(1)}k Hz) → aliasing and harsh upper harmonics. Lower tone to 6-8 kHz to roll off the harshest partials.`,
    })
  }
  if (drive > 24) {
    out.push({
      id: `${effect.id}:saturation-extreme-drive`,
      severity: 'info',
      effectIds: [effect.id],
      ro: `Saturation #${effect.id}: drive +${drive.toFixed(1)} dB — distorsiune pronunțată. Intenționat? Dacă vrei densitate subtilă, încearcă 6-12 dB cu mix 40-70%.`,
      en: `Saturation #${effect.id}: drive +${drive.toFixed(1)} dB — pronounced distortion. Intentional? For subtle density, try 6-12 dB at 40-70% mix.`,
    })
  }
  if (wet < 0.2 && drive > 0) {
    out.push({
      id: `${effect.id}:saturation-very-dry`,
      severity: 'info',
      effectIds: [effect.id],
      ro: `Saturation #${effect.id}: mix ${Math.round(wet * 100)}% — aproape inaudibil. Mărește mix sau drive-ul pentru a simți efectul.`,
      en: `Saturation #${effect.id}: mix at ${Math.round(wet * 100)}% — barely audible. Increase mix or drive to hear the effect.`,
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
        ro: `EQ #${a.id} (boost de bas) → Compressor #${b.id}: boost-ul amplifică declanșarea compresorului pe frecvențele joase. Pentru tonalitate stabilă, mută EQ-ul *după* compressor sau urcă SC HPF pe compressor.`,
        en: `EQ #${a.id} (bass boost) → Compressor #${b.id}: the boost makes the compressor react harder to lows. For stable tone, move EQ *after* the compressor, or raise the SC HPF on the compressor.`,
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
        ro: `Două Compressor-i (#${a.id} → #${b.id}) cu attack rapid în cascadă — risc de "pumping" și dinamică artificială. Folosește un compressor cu attack lent + un limiter la final.`,
        en: `Two compressors (#${a.id} → #${b.id}) with fast attack in series — risks "pumping" and artificial dynamics. Use one slow-attack compressor + a limiter at the end instead.`,
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
        ro: `Singurul efect activ e un EQ fără benzi pornite — chain-ul e momentan transparent. Activează cel puțin o bandă pentru a auzi vreo diferență.`,
        en: `The only active effect is an EQ with no enabled bands — the chain is currently transparent. Enable at least one band to hear something.`,
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
        ro: `Compressor #${c.id} pe primul slot cu threshold ${t.toFixed(1)} dB — comprimi aproape tot semnalul, inclusiv zgomotul. De obicei se face mai întâi gain staging și/sau gate, apoi compresie.`,
        en: `Compressor #${c.id} as the first effect with threshold ${t.toFixed(1)} dB — almost everything (including noise) gets compressed. Typically gain-stage and/or gate first, then compress.`,
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
      ro: `Reverb #${a.id} → Compressor #${b.id}: tail-ul reverb-ului va declanșa compresorul, "pompând" semnalul în mod artificial. Pune compresorul *înaintea* reverb-ului.`,
      en: `Reverb #${a.id} → Compressor #${b.id}: the reverb tail will keep triggering the compressor, causing artificial "pumping." Put the compressor *before* the reverb.`,
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
        ro: `Reverb #${a.id} → Saturation #${b.id}: saturai inclusiv tail-ul de reverb, ceea ce poate suna nenatural. Dacă intenționat, e un efect de "grit on ambience"; altfel mută Saturation înaintea Reverb.`,
        en: `Reverb #${a.id} → Saturation #${b.id}: you're saturating the reverb tail too, which can sound unnatural. If intentional, it's a "grit on ambience" effect; otherwise move Saturation before Reverb.`,
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
        ro: `Reverb #${a.id} → Delay #${b.id}: delay-ul repetă tail-ul de reverb, rezultând un sunet extrem de aglomerat. Ordinea standard este Delay → Reverb (reverb-ul îmbracă eco-urile, nu invers).`,
        en: `Reverb #${a.id} → Delay #${b.id}: delay repeats the reverb tail, resulting in a very cluttered sound. Standard order is Delay → Reverb (reverb wraps the echoes, not the other way around).`,
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
        ro: `Compressor #${a.id} (release rapid ${compRelease.toFixed(0)} ms) → Gate #${b.id}: release-ul rapid al compresorului scade nivelul sub threshold-ul gate-ului, declanșând chattering. Mărește release-ul compresorului sau coboară threshold-ul gate-ului.`,
        en: `Compressor #${a.id} (fast release ${compRelease.toFixed(0)} ms) → Gate #${b.id}: the fast compressor release can dip the level below the gate threshold, causing chattering. Increase the compressor release or lower the gate threshold.`,
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
        ro: `Limiter #${lim.id} nu e pe ultima poziție din chain — efectele de după pot depăși ceiling-ul său. Un limiter e de obicei ultimul în lanț.`,
        en: `Limiter #${lim.id} is not the last effect in the chain — effects after it can exceed its ceiling. A limiter is typically the final stage.`,
      })
    }
  }

  return out
}

// ─── public API ──────────────────────────────────────────────────────────

export function analyzeAll(effects: EffectInstance[]): FeedbackEntry[] {
  const out: FeedbackEntry[] = []
  for (const e of effects) {
    if (isCompressor(e))  out.push(...analyzeCompressor(e))
    else if (isEq(e))         out.push(...analyzeEq(e))
    else if (isGain(e))       out.push(...analyzeGain(e))
    else if (isGate(e))       out.push(...analyzeGate(e))
    else if (isLimiter(e))    out.push(...analyzeLimiter(e))
    else if (isDelay(e))      out.push(...analyzeDelay(e))
    else if (isReverb(e))     out.push(...analyzeReverb(e))
    else if (isSaturation(e)) out.push(...analyzeSaturation(e))
  }
  out.push(...analyzeChain(effects))
  out.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
  return out
}

export function pickFeedback(entry: FeedbackEntry, language: EducationLanguage): string {
  return entry[language]
}
