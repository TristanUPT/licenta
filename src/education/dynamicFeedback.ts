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
  EQ_BAND_PARAM,
  EQ_BANDS,
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
  const gainDb = paramOf(effect, 0, 0)
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

  return out
}

// ─── public API ──────────────────────────────────────────────────────────

export function analyzeAll(effects: EffectInstance[]): FeedbackEntry[] {
  const out: FeedbackEntry[] = []
  for (const e of effects) {
    if (isCompressor(e)) out.push(...analyzeCompressor(e))
    else if (isEq(e)) out.push(...analyzeEq(e))
    else if (e.type === EffectType.Gain) out.push(...analyzeGain(e))
  }
  out.push(...analyzeChain(effects))
  out.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
  return out
}

export function pickFeedback(entry: FeedbackEntry, language: EducationLanguage): string {
  return entry[language]
}
