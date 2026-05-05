/**
 * Bilingual educational content for every effect & parameter.
 *
 * Jargon (Threshold, Ratio, Q, etc.) is intentionally kept in English in both
 * locales — those are the standard names used in every DAW. Everything around
 * the jargon is translated.
 */

import {
  COMPRESSOR_PARAM,
  EQ_BAND_PARAM,
  EQ_PARAMS_PER_BAND,
  EffectType,
  GAIN_PARAM,
} from '@/types/effects'

export interface BilingualText {
  ro: string
  en: string
}

export interface BilingualByMode {
  ro: { beginner: string; advanced: string }
  en: { beginner: string; advanced: string }
}

export interface ParamDocs {
  /** Localised name shown above the description (jargon stays as-is). */
  title: BilingualText
  body: BilingualByMode
}

export interface EffectDocs {
  title: BilingualText
  summary: BilingualByMode
  /** Keyed by paramId. Falls back to `summary` if a param is missing. */
  params: Record<number, ParamDocs>
}

// ─── Gain ────────────────────────────────────────────────────────────────

const GAIN_DOCS: EffectDocs = {
  title: { ro: 'Gain', en: 'Gain' },
  summary: {
    ro: {
      beginner:
        'Crește sau scade volumul semnalului. Ca un buton de volum simplu — folosit pentru a ajusta nivelul înainte sau după alte efecte.',
      advanced:
        'Amplificator linear (multiplicare scalară). Include phase invert (180°) și mix wet/dry. Smoothing one-pole 3 ms pe modificările de gain pentru a evita zipper noise.',
    },
    en: {
      beginner:
        "Makes the signal louder or quieter. Like a simple volume knob — useful before or after other effects to set the right level.",
      advanced:
        'Linear amplifier (scalar multiply). Includes 180° phase invert and wet/dry mix. 3 ms one-pole smoothing on gain changes to avoid zipper noise.',
    },
  },
  params: {
    [GAIN_PARAM.GAIN_DB]: {
      title: { ro: 'Gain', en: 'Gain' },
      body: {
        ro: {
          beginner:
            'Cu cât crești sau scazi volumul, în decibeli (dB). 0 dB = neschimbat. +6 dB ≈ dublu de tare. -6 dB ≈ pe jumătate. Audio-ul peste 0 dBFS poate clipa.',
          advanced:
            'Linear gain in dB applied as multiplicative scalar (10^(dB/20)). Range -24..+24 dB. La +6 dB se dublează amplitudinea; ai grijă la headroom-ul ieșirii pentru a evita inter-sample peaks.',
        },
        en: {
          beginner:
            'How much louder or quieter, in decibels (dB). 0 dB = unchanged. +6 dB ≈ twice as loud. -6 dB ≈ half as loud. Audio above 0 dBFS may clip.',
          advanced:
            'Linear gain in dB applied as multiplicative scalar (10^(dB/20)). Range -24..+24 dB. +6 dB doubles amplitude; mind output headroom to avoid inter-sample peaks.',
        },
      },
    },
    [GAIN_PARAM.PHASE_INVERT]: {
      title: { ro: 'Phase', en: 'Phase' },
      body: {
        ro: {
          beginner:
            'Inversează polaritatea undelor sonore (sus devine jos și invers). Util când ai două microfoane pe același sunet și unul "luptă" cu celălalt.',
          advanced:
            'Multiplică semnalul cu -1 (inversare 180°). Critic în multi-mic recording (kick out vs in, snare top vs bottom) și pentru detectarea anulărilor de fază în mid-side.',
        },
        en: {
          beginner:
            'Flips the polarity of the sound waves (up becomes down). Useful when two mics on the same sound are "fighting" each other.',
          advanced:
            'Multiplies signal by -1 (180° flip). Critical for multi-mic recording (kick out vs in, snare top vs bottom) and for spotting phase cancellation in mid-side processing.',
        },
      },
    },
    [GAIN_PARAM.DRY_WET]: {
      title: { ro: 'Mix', en: 'Mix' },
      body: {
        ro: {
          beginner:
            'Cât din semnalul procesat (wet) se aude vs cât din original (dry). 100 % = doar procesat. 0 % = doar original.',
          advanced:
            'Linear crossfade between unprocessed (dry) and processed (wet). Util pentru parallel compression / parallel saturation pe Gain când îl combini cu phase invert.',
        },
        en: {
          beginner:
            'How much of the processed (wet) sound vs the original (dry). 100 % = fully processed. 0 % = original only.',
          advanced:
            'Linear crossfade between unprocessed (dry) and processed (wet). Useful for parallel compression / parallel saturation on Gain when paired with phase invert.',
        },
      },
    },
  },
}

// ─── Compressor ──────────────────────────────────────────────────────────

const COMPRESSOR_DOCS: EffectDocs = {
  title: { ro: 'Compressor', en: 'Compressor' },
  summary: {
    ro: {
      beginner:
        'Reduce diferența dintre părțile tari și cele liniștite ale sunetului. Folosit pe voce, drums, bass — face sunetul mai dens, mai constant, mai prezent în mix.',
      advanced:
        'Feed-forward dynamic range compressor cu envelope follower (peak detector), gain computer cu soft knee parabolic, sidechain HPF (curăță triggering-ul de bass), makeup gain post și dry/wet mix pentru parallel compression.',
    },
    en: {
      beginner:
        "Reduces the gap between the loud and quiet parts of a sound. Used on vocals, drums, bass — makes them feel denser, more consistent, more present in the mix.",
      advanced:
        'Feed-forward dynamic range compressor with peak envelope follower, soft (parabolic) knee gain computer, sidechain HPF (prevents bass-driven triggering), post makeup gain, and dry/wet mix for parallel compression.',
    },
  },
  params: {
    [COMPRESSOR_PARAM.THRESHOLD_DB]: {
      title: { ro: 'Threshold', en: 'Threshold' },
      body: {
        ro: {
          beginner:
            'Nivelul peste care compressor-ul începe să acționeze. Mai jos = comprimă mai mult din semnal. Setează threshold-ul deasupra zonei "liniștite" și sub vârfurile pe care vrei să le îmblânzești.',
          advanced:
            'Pragul în dBFS unde gain-ul începe să se reducă. Combinat cu Knee, definește zona de tranziție. Reglează-l până vezi 3-6 dB de gain reduction pe peak-uri pentru compresie subtilă.',
        },
        en: {
          beginner:
            'The level above which the compressor kicks in. Lower = compresses more of the signal. Set above the "quiet" baseline and below the peaks you want to tame.',
          advanced:
            'dBFS level where gain reduction starts. Together with Knee defines the transition region. Aim for 3-6 dB GR on peaks for subtle compression.',
        },
      },
    },
    [COMPRESSOR_PARAM.RATIO]: {
      title: { ro: 'Ratio', en: 'Ratio' },
      body: {
        ro: {
          beginner:
            'Cât de mult comprimă sunetul peste threshold. 4:1 = pentru fiecare 4 dB peste prag, doar 1 dB iese. 1:1 = fără efect. Peste 10:1 e "limiter".',
          advanced:
            'Output_above_thresh_dB = input_above_thresh_dB / ratio. 1.5-3:1 = subtil, gluing. 4-8:1 = control puternic. >10:1 + attack rapid → comportament de limiter.',
        },
        en: {
          beginner:
            "How much it compresses above threshold. 4:1 = for every 4 dB over threshold, only 1 dB comes out. 1:1 = no effect. Above 10:1 it's a 'limiter'.",
          advanced:
            "Output_above_thresh_dB = input_above_thresh_dB / ratio. 1.5-3:1 = subtle gluing. 4-8:1 = strong control. >10:1 + fast attack → limiter behaviour.",
        },
      },
    },
    [COMPRESSOR_PARAM.ATTACK_MS]: {
      title: { ro: 'Attack', en: 'Attack' },
      body: {
        ro: {
          beginner:
            'Cât de repede reacționează compressor-ul. Rapid (sub 5 ms) = prinde și transient-ele scurte (snare, "p"-uri în voce). Încet (>20 ms) = lasă atac-ul natural să treacă, comprimă restul.',
          advanced:
            'Time constant pentru rise-ul envelope follower-ului (one-pole). Fast attack = ucide transient-e (poate suna "ploit"). Slow attack = preserves punch dar lasă peak-urile să clipuiască — folosește un limiter după.',
        },
        en: {
          beginner:
            "How fast the compressor reacts. Fast (under 5 ms) = catches short transients (snare hits, vocal 'p'-pops). Slow (>20 ms) = lets the natural attack through and only compresses what comes after.",
          advanced:
            "Rise time constant of the envelope follower (one-pole). Fast attack = squashes transients (can sound 'splatted'). Slow attack = preserves punch but lets peaks slip through — chain a limiter after it.",
        },
      },
    },
    [COMPRESSOR_PARAM.RELEASE_MS]: {
      title: { ro: 'Release', en: 'Release' },
      body: {
        ro: {
          beginner:
            'Cât de repede revine compressor-ul după ce semnalul a coborât. Prea rapid (<30 ms) = "pumping" audibil. Prea lent (>500 ms) = nu se mai redeschide la timp pentru următoarea frază.',
          advanced:
            'Fall time constant. Reglează-l să respecte tempo-ul piesei (auto-release este una dintre raritățile DAW-ului mainstream). Pentru voce: 80-200 ms; pentru bus: 200-400 ms.',
        },
        en: {
          beginner:
            "How fast the compressor releases after the signal drops. Too fast (<30 ms) = audible 'pumping'. Too slow (>500 ms) = won't reopen in time for the next phrase.",
          advanced:
            'Fall time constant. Tune to musical phrasing — for vocals 80-200 ms; for buses 200-400 ms. Auto-release is one of the DAW mainstream rarities.',
        },
      },
    },
    [COMPRESSOR_PARAM.KNEE_DB]: {
      title: { ro: 'Knee', en: 'Knee' },
      body: {
        ro: {
          beginner:
            'Cât de "smooth" e tranziția când threshold-ul e atins. Mai mare (12 dB) = compresia se "topește" gradual, sună natural. Mai mic (0 dB) = lovește brusc, agresiv.',
          advanced:
            'Lățimea zonei de tranziție în jurul pragului (parabolic interpolation). 0 dB = hard knee (brick wall). 6-12 dB = soft knee — preferat pe voce și material muzical.',
        },
        en: {
          beginner:
            "How smooth the transition is when the signal hits threshold. Wider (12 dB) = compression eases in, sounds natural. Narrower (0 dB) = snaps in abruptly, aggressive.",
          advanced:
            "Transition width around the threshold (parabolic interpolation). 0 dB = hard knee (brick wall). 6-12 dB = soft knee — preferred on vocals and musical material.",
        },
      },
    },
    [COMPRESSOR_PARAM.MAKEUP_DB]: {
      title: { ro: 'Makeup', en: 'Makeup' },
      body: {
        ro: {
          beginner:
            'Compensare pentru volumul pierdut prin compresie. Dacă vezi -4 dB de gain reduction, adaugă +4 dB makeup ca să ai aceeași loudness percepută.',
          advanced:
            'Linear gain post-compressor pentru a egala loudness-ul wet vs dry — important pentru A/B onest (auzul preferă semnal mai tare). Auto-makeup ar fi -avg(GR), dar manual e mai flexibil.',
        },
        en: {
          beginner:
            "Boosts the volume back after compression has reduced it. If you see -4 dB of gain reduction, add +4 dB makeup to match perceived loudness.",
          advanced:
            "Post-compressor linear gain to match wet vs dry loudness — important for honest A/B (the ear favours louder signals). Auto-makeup would be -avg(GR), but manual is more flexible.",
        },
      },
    },
    [COMPRESSOR_PARAM.SIDECHAIN_HPF_HZ]: {
      title: { ro: 'SC HPF', en: 'SC HPF' },
      body: {
        ro: {
          beginner:
            'Filtru high-pass pe semnalul de detecție. Împiedică bass-ul (kick, voce gravă) să declanșeze compressor-ul. Setează în jur de 80-150 Hz.',
          advanced:
            'Sidechain highpass biquad (Q≈0.707). Decuplează detecția de bas — esențial pe vocal mixing și pe master bus pentru a nu pomp-ui kick-ul. NU afectează semnalul audibil; doar detecția.',
        },
        en: {
          beginner:
            "High-pass filter on the detector signal. Stops bass (kick, low vocals) from triggering the compressor. Set around 80-150 Hz.",
          advanced:
            "Sidechain highpass biquad (Q≈0.707). Decouples detection from bass — essential on vocal mixing and master bus to prevent kick-driven pumping. Does NOT affect the audible signal, only the detection.",
        },
      },
    },
    [COMPRESSOR_PARAM.DRY_WET]: {
      title: { ro: 'Mix', en: 'Mix' },
      body: {
        ro: {
          beginner:
            'Blendează compressor-ul cu semnalul original. La 100 % auzi doar wet. 50/50 = parallel compression — păstrează transient-ele și densitatea.',
          advanced:
            'Linear crossfade. Parallel compression la 30-50 % wet adaugă densitate fără să ucidă transient-ele — tehnică standard pentru drums și vocal busses.',
        },
        en: {
          beginner:
            "Blend the compressed signal with the original. At 100 % you only hear wet. 50/50 = parallel compression — keeps transients and adds density.",
          advanced:
            'Linear crossfade. 30-50 % wet adds density without crushing transients — standard parallel-compression technique on drums and vocal buses.',
        },
      },
    },
  },
}

// ─── Parametric EQ ───────────────────────────────────────────────────────

function eqBandTypeDocs(): ParamDocs {
  return {
    title: { ro: 'Type', en: 'Type' },
    body: {
      ro: {
        beginner:
          'Forma filtrului. Bell = boost/cut într-o bandă. Hi/Lo Shelf = boost/cut peste/sub un punct. HPF/LPF = taie complet sub/peste o frecvență. Notch = elimină o frecvență strâmtă.',
        advanced:
          'Bell (peaking biquad RBJ). Shelf (RBJ low/high shelf, slope determinat de Q). HPF/LPF (Butterworth-like @ Q=0.707). Notch (RBJ infinite null la f₀).',
      },
      en: {
        beginner:
          'Filter shape. Bell = boost/cut a band. Hi/Lo Shelf = boost/cut above/below a point. HPF/LPF = cut everything below/above a frequency. Notch = remove a narrow frequency.',
        advanced:
          'Bell (RBJ peaking biquad). Shelf (RBJ low/high shelf, slope set by Q). HPF/LPF (Butterworth-like at Q=0.707). Notch (RBJ infinite null at f₀).',
      },
    },
  }
}

function eqBandFreqDocs(): ParamDocs {
  return {
    title: { ro: 'Freq', en: 'Freq' },
    body: {
      ro: {
        beginner:
          'Frecvența pe care o ajustează banda, în Hz. Sub 200 Hz = bas. 200-2 kHz = corp și voce. 2-6 kHz = prezență. Peste 6 kHz = strălucire / aer.',
        advanced:
          'Centrul filtrului (bell/shelf/notch) sau cutoff-ul (HPF/LPF). Scală logaritmică pentru editare confortabilă (octave egale pe knob).',
      },
      en: {
        beginner:
          "Which frequency the band adjusts, in Hz. Under 200 Hz = bass. 200-2 kHz = body and voice. 2-6 kHz = presence. Above 6 kHz = sparkle / air.",
        advanced:
          "Centre frequency (bell/shelf/notch) or cutoff (HPF/LPF). Log-scaled for comfortable editing (equal octaves across the knob).",
      },
    },
  }
}

function eqBandGainDocs(): ParamDocs {
  return {
    title: { ro: 'Gain', en: 'Gain' },
    body: {
      ro: {
        beginner:
          'Cât boostezi (+) sau scazi (-) banda, în dB. Începe modest (±3 dB). Cut-urile chirurgicale pot fi mai adânci (-6 până la -12 dB).',
        advanced:
          'În dB, doar pentru bell și shelf. HPF/LPF/notch ignoră acest parametru. Boosts > +6 dB pe Q strâmt sună "ringy" — preferă cut.',
      },
      en: {
        beginner:
          "How much you boost (+) or cut (-) the band, in dB. Start modest (±3 dB). Surgical cuts can go deeper (-6 to -12 dB).",
        advanced:
          'In dB, only effective for bell and shelf. HPF/LPF/notch ignore this. Boosts above +6 dB at narrow Q ring — prefer cuts.',
      },
    },
  }
}

function eqBandQDocs(): ParamDocs {
  return {
    title: { ro: 'Q', en: 'Q' },
    body: {
      ro: {
        beginner:
          'Cât de strâmtă e banda. Q mic (0.5) = bandă largă, sună muzical. Q mare (5) = bandă strâmtă, intervenție chirurgicală.',
        advanced:
          'Bandwidth = freq/Q. Q=0.707 = Butterworth (maximally flat) la HPF/LPF. Q ≥ 4 pe bell-uri lucrează ca notch atunci când gain-ul e negativ — util pe rezonanțe nedorite.',
      },
      en: {
        beginner:
          "How narrow the band is. Low Q (0.5) = wide band, sounds musical. High Q (5) = narrow band, surgical work.",
        advanced:
          "Bandwidth = freq/Q. Q=0.707 = Butterworth (maximally flat) for HPF/LPF. Q ≥ 4 on a bell with negative gain behaves like a notch — useful on resonance problems.",
      },
    },
  }
}

function eqBandEnabledDocs(): ParamDocs {
  return {
    title: { ro: 'Band', en: 'Band' },
    body: {
      ro: {
        beginner: 'Activează sau dezactivează această bandă.',
        advanced: 'Bypass pe bandă individuală. Util pentru A/B per bandă în mixaj.',
      },
      en: {
        beginner: 'Enable or disable this band.',
        advanced: 'Per-band bypass. Useful for A/B-ing individual bands while mixing.',
      },
    },
  }
}

const EQ_DOCS: EffectDocs = {
  title: { ro: 'Parametric EQ', en: 'Parametric EQ' },
  summary: {
    ro: {
      beginner:
        'Boostează sau taie frecvențe specifice ca să modelezi tonalitatea sunetului. 4 benzi independente, fiecare cu formă, frecvență, gain și Q proprii.',
      advanced:
        '4 cascade biquad RBJ (Direct Form II Transposed). Tipuri: bell, low/high shelf, HPF, LPF, notch. Coeficienți recalculați la set_param. Magnitude response calculat live în UI pentru afișare.',
    },
    en: {
      beginner:
        'Boost or cut specific frequencies to shape the tone. 4 independent bands, each with its own shape, frequency, gain, and Q.',
      advanced:
        '4 cascaded RBJ biquads (Direct Form II Transposed). Types: bell, low/high shelf, HPF, LPF, notch. Coefficients recomputed on set_param. Magnitude response computed live in the UI for display.',
    },
  },
  params: (() => {
    const params: Record<number, ParamDocs> = {}
    for (let band = 0; band < 4; band++) {
      const base = band * EQ_PARAMS_PER_BAND
      params[base + EQ_BAND_PARAM.TYPE] = eqBandTypeDocs()
      params[base + EQ_BAND_PARAM.FREQ] = eqBandFreqDocs()
      params[base + EQ_BAND_PARAM.GAIN] = eqBandGainDocs()
      params[base + EQ_BAND_PARAM.Q] = eqBandQDocs()
      params[base + EQ_BAND_PARAM.ENABLED] = eqBandEnabledDocs()
    }
    return params
  })(),
}

export const EFFECT_DOCS: Record<EffectType, EffectDocs> = {
  [EffectType.Gain]: GAIN_DOCS,
  [EffectType.Compressor]: COMPRESSOR_DOCS,
  [EffectType.ParametricEq]: EQ_DOCS,
}

import type { EducationLanguage, EducationMode } from '@/store/educationStore'

export function getParamDocs(
  effectType: EffectType,
  paramId: number,
): ParamDocs | null {
  return EFFECT_DOCS[effectType]?.params[paramId] ?? null
}

export function pickText(
  body: BilingualByMode,
  language: EducationLanguage,
  mode: EducationMode,
): string {
  return body[language][mode]
}

export function pickTitle(text: BilingualText, language: EducationLanguage): string {
  return text[language]
}
