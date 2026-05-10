/**
 * Bilingual educational content for every effect & parameter.
 *
 * Jargon (Threshold, Ratio, Q, etc.) is intentionally kept in English in both
 * locales — those are the standard names used in every DAW. Everything around
 * the jargon is translated.
 */

import {
  COMPRESSOR_PARAM,
  DELAY_PARAM,
  EQ_BAND_PARAM,
  EQ_LOW_CUT_PARAM,
  EQ_PARAMS_PER_BAND,
  EffectType,
  GAIN_PARAM,
  GATE_PARAM,
  LIMITER_PARAM,
  REVERB_PARAM,
  SATURATION_PARAM,
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
    // Low Cut params
    params[EQ_LOW_CUT_PARAM.ENABLED] = {
      title: { ro: 'Low Cut', en: 'Low Cut' },
      body: {
        ro: {
          beginner: 'Activează filtrul care taie frecvențele joase nedorite (zgomot de cameră, bâzâit de microfon). Util pe aproape orice semnal.',
          advanced: 'Activează HPF procesat înaintea benzilor parametrice. 12 dB/oct = un biquad Butterworth (Q=0.707); 24 dB/oct = două biquad-uri cascadate (Q=0.541 + Q=1.306).',
        },
        en: {
          beginner: 'Enables the filter that removes unwanted low frequencies (room rumble, mic noise). Useful on almost any signal.',
          advanced: 'Activates the HPF processed before the parametric bands. 12 dB/oct = single Butterworth biquad (Q=0.707); 24 dB/oct = two cascaded biquads (Q=0.541 + Q=1.306).',
        },
      },
    }
    params[EQ_LOW_CUT_PARAM.FREQ] = {
      title: { ro: 'LC Freq', en: 'LC Freq' },
      body: {
        ro: {
          beginner: 'Frecvența de tăiere. Tot ce e sub ea e atenuat. 80-120 Hz tipic pe voce; 30-60 Hz pe instrumente. Trage nodul portocaliu din display pentru a ajusta.',
          advanced: 'Cutoff în Hz (20-600). Scală log. La 24 dB/oct, acesta e punctul -3 dB al filtrului Butterworth de ord. 4; la 12 dB/oct, punctul -3 dB al Butterworth ord. 2.',
        },
        en: {
          beginner: 'Cutoff frequency — everything below is attenuated. 80-120 Hz typical for vocals; 30-60 Hz for instruments. Drag the orange node in the display to adjust.',
          advanced: 'Cutoff in Hz (20-600). Log scale. At 24 dB/oct this is the -3 dB point of the 4th-order Butterworth; at 12 dB/oct, the -3 dB point of the 2nd-order Butterworth.',
        },
      },
    }
    params[EQ_LOW_CUT_PARAM.SLOPE] = {
      title: { ro: 'LC Slope', en: 'LC Slope' },
      body: {
        ro: {
          beginner: 'Cât de abrupt e filtrul. 12 dB/oct = tăiere graduală, mai naturală. 24 dB/oct = tăiere mai bruscă, mai curată. Diferența se aude clar sub 200 Hz.',
          advanced: '12 dB/oct = biquad Butterworth de ord. 2 (-3 dB la cutoff). 24 dB/oct = două biquad-uri cascadate, răspuns Butterworth de ord. 4. Diferența de pantă: 12 dB per octavă sub cutoff.',
        },
        en: {
          beginner: 'How steeply the filter cuts. 12 dB/oct = gradual, more natural. 24 dB/oct = steeper, cleaner. The difference is clearly audible below 200 Hz.',
          advanced: '12 dB/oct = 2nd-order Butterworth biquad (-3 dB at cutoff). 24 dB/oct = two cascaded biquads, 4th-order Butterworth response. Slope difference: 12 dB per octave below cutoff.',
        },
      },
    }
    return params
  })(),
}

// ─── Gate ────────────────────────────────────────────────────────────────

const GATE_DOCS: EffectDocs = {
  title: { ro: 'Noise Gate', en: 'Noise Gate' },
  summary: {
    ro: {
      beginner: 'Reduce semnalul când e sub un anumit nivel — îți "tace" pauzele dintre fraze. Util pentru voce cu zgomot de fond, drums cu bleed.',
      advanced: 'Downward expander cu state machine (closed/opening/open/closing) și hysteresis. Asymmetric attack/hold/release pe envelope follower peak.',
    },
    en: {
      beginner: 'Cuts the signal when it drops below a level — silences the gaps between phrases. Useful for noisy vocal tracks, drums with bleed.',
      advanced: 'Downward expander with a state machine (closed/opening/open/closing) and hysteresis. Asymmetric attack/hold/release driven by a peak envelope follower.',
    },
  },
  params: {
    [GATE_PARAM.THRESHOLD_DB]: {
      title: { ro: 'Threshold', en: 'Threshold' },
      body: {
        ro: { beginner: 'Nivelul de la care gate-ul se deschide. Sub el = tăcere.', advanced: 'Open level în dBFS. Combină cu Hysteresis pentru a evita chattering pe semnal aproape de prag.' },
        en: { beginner: 'Level above which the gate opens. Below it = silence.', advanced: 'Open level in dBFS. Pair with Hysteresis to avoid chattering on signal hovering near the threshold.' },
      },
    },
    [GATE_PARAM.ATTACK_MS]: {
      title: { ro: 'Attack', en: 'Attack' },
      body: {
        ro: { beginner: 'Cât de repede se deschide gate-ul. Rapid = lasă transient-ele să treacă; lent = "fade in" audibil.', advanced: 'Time constant pentru rise-ul gain-ului către 1.0. Sub 5 ms pe drums; 5-20 ms pe voce.' },
        en: { beginner: 'How fast the gate opens. Fast = lets transients through; slow = audible fade-in.', advanced: 'Time constant for the gain to ramp to 1.0. Sub-5 ms for drums; 5-20 ms on vocals.' },
      },
    },
    [GATE_PARAM.HOLD_MS]: {
      title: { ro: 'Hold', en: 'Hold' },
      body: {
        ro: { beginner: 'Cât timp rămâne deschis după ce semnalul a scăzut sub threshold. Previne închideri intempestive între cuvinte.', advanced: 'Counter în samples; gate-ul refuză să încheie cycle-ul de release până nu trec hold_samples.' },
        en: { beginner: 'How long the gate stays open after the signal drops. Prevents premature closing between words.', advanced: 'Sample counter; gate refuses to start the release cycle until hold_samples elapse.' },
      },
    },
    [GATE_PARAM.RELEASE_MS]: {
      title: { ro: 'Release', en: 'Release' },
      body: {
        ro: { beginner: 'Cât de natural se închide după hold. Prea rapid → "chopping" audibil.', advanced: 'Fall time toward range_lin. 50-200 ms = release muzical pe voce.' },
        en: { beginner: 'How smoothly the gate closes after hold. Too fast → audible chopping.', advanced: 'Fall time toward range_lin. 50-200 ms gives a musical release on vocals.' },
      },
    },
    [GATE_PARAM.RANGE_DB]: {
      title: { ro: 'Range', en: 'Range' },
      body: {
        ro: { beginner: 'Cât de tare e atenuată zona "închisă". -60 dB ≈ tăcere; 0 dB = fără efect.', advanced: 'Floor gain când gate-ul e închis. Folosește valori moderate (-20 dB) pentru efect mai natural.' },
        en: { beginner: 'How much the closed region is attenuated. -60 dB ≈ silence; 0 dB = no effect.', advanced: 'Floor gain when closed. Use moderate values (-20 dB) for a more natural effect.' },
      },
    },
    [GATE_PARAM.HYSTERESIS_DB]: {
      title: { ro: 'Hysteresis', en: 'Hysteresis' },
      body: {
        ro: { beginner: 'Diferența între pragul de deschidere și de închidere. Mare = mai puțin "chattering" pe semnal cu nivel oscilant.', advanced: 'Close threshold = open threshold − hysteresis. Schmitt-trigger style.' },
        en: { beginner: 'Gap between open and close thresholds. Larger = less chattering on signals near the threshold.', advanced: 'Close threshold = open − hysteresis. Schmitt-trigger style.' },
      },
    },
    [GATE_PARAM.DRY_WET]: {
      title: { ro: 'Mix', en: 'Mix' },
      body: { ro: { beginner: 'Blendează gate-ul cu originalul.', advanced: 'Linear crossfade între gate output și signal-ul brut.' }, en: { beginner: 'Blends the gated signal with the original.', advanced: 'Linear crossfade between gated output and raw signal.' } },
    },
  },
}

// ─── Limiter ─────────────────────────────────────────────────────────────

const LIMITER_DOCS: EffectDocs = {
  title: { ro: 'Limiter', en: 'Limiter' },
  summary: {
    ro: {
      beginner: 'Pune un plafon pe ce iese din chain — peak-urile sunt împinse sub un ceiling fix. Folosit la final de chain pentru maximizare loudness sigură.',
      advanced: 'Peak limiter cu lookahead 5 ms (delay line). Attack instant la coborâre + release configurable. Garanteaza output ≤ ceiling pe peak-urile sample-rate-detected.',
    },
    en: {
      beginner: "Puts a hard ceiling on the output — peaks are pushed below a fixed level. Used at the end of the chain for safe loudness maximisation.",
      advanced: 'Peak limiter with 5 ms lookahead (delay line). Instant attack on falling target + configurable release. Guarantees output ≤ ceiling on sample-rate-detected peaks.',
    },
  },
  params: {
    [LIMITER_PARAM.CEILING_DB]: {
      title: { ro: 'Ceiling', en: 'Ceiling' },
      body: {
        ro: { beginner: 'Maximul peste care output-ul nu poate trece. -1 dB e o margine de siguranță tipică (intersample peaks).', advanced: 'Limita peak în dBFS. -0.3 ... -1 dB e standard pentru a evita inter-sample peaks la conversia la mp3/aac.' },
        en: { beginner: 'The hard ceiling for output. -1 dB is a typical safety margin (intersample peaks).', advanced: 'Peak ceiling in dBFS. -0.3 to -1 dB is standard for safety against intersample peaks during mp3/aac encoding.' },
      },
    },
    [LIMITER_PARAM.RELEASE_MS]: {
      title: { ro: 'Release', en: 'Release' },
      body: {
        ro: { beginner: 'Cât de repede revine limiter-ul după ce a "lovit". Prea rapid = pumping; prea lent = volum global mai mic.', advanced: 'Coeficient one-pole pentru release. 30-100 ms = transparent pe material muzical; sub 10 ms = pumping audibil pe lovituri repetate.' },
        en: { beginner: 'How fast the limiter recovers after engaging. Too fast = pumping; too slow = lower overall loudness.', advanced: 'One-pole release coefficient. 30-100 ms = transparent on music; below 10 ms = audible pumping on repeated hits.' },
      },
    },
    [LIMITER_PARAM.DRY_WET]: {
      title: { ro: 'Mix', en: 'Mix' },
      body: { ro: { beginner: 'Blendează limiter-ul cu originalul.', advanced: 'Linear crossfade — la 100 % output e clamp-uit sub ceiling.' }, en: { beginner: 'Blends the limited signal with the original.', advanced: 'Linear crossfade — at 100 % the output is clamped under the ceiling.' } },
    },
  },
}

// ─── Delay ───────────────────────────────────────────────────────────────

const DELAY_DOCS: EffectDocs = {
  title: { ro: 'Delay', en: 'Delay' },
  summary: {
    ro: {
      beginner: 'Repetă semnalul după un timp setabil. Cu feedback poți avea mai multe ecouri care se sting treptat. Filtrul Tone face ecourile să sune mai "tape", mai blânde.',
      advanced: 'Single-tap echo cu circular buffer (linear interp.) și one-pole LP în feedback path pentru tape-emulation feel. Smoothing pe time/feedback pt. modulation tape-style.',
    },
    en: {
      beginner: "Repeats the signal after a chosen time. With feedback you get multiple echoes fading away. The Tone filter makes echoes feel more 'tape'-like, softer.",
      advanced: 'Single-tap echo with circular buffer (linear interp.) and a one-pole LP in the feedback path for tape-emulation feel. Smoothed time/feedback for tape-style modulation.',
    },
  },
  params: {
    [DELAY_PARAM.TIME_MS]: {
      title: { ro: 'Time', en: 'Time' },
      body: { ro: { beginner: 'Cât de departe în timp e ecoul. 250 ms ≈ optimă pentru o voce ritmică.', advanced: 'Echo time în ms. Smoothed pentru a evita pitch-shift abrupt la modificare.' }, en: { beginner: 'How far back the echo sits. 250 ms ≈ a sweet spot for rhythmic vocals.', advanced: 'Echo time in ms. Smoothed to avoid abrupt pitch-shifting when changed.' } },
    },
    [DELAY_PARAM.FEEDBACK]: {
      title: { ro: 'Feedback', en: 'Feedback' },
      body: { ro: { beginner: 'Câte repetiții auzi înainte să se stingă. 0 = un ecou; 0.95 = aproape la nesfârșit (atenție la self-oscillation).', advanced: 'Gain pe loop-back. Limitat la 0.95 pentru stabilitate. Cu LP în feedback, energia înaltelor se topește gradual.' }, en: { beginner: 'How many repeats before fade-out. 0 = single echo; 0.95 = nearly endless (watch for self-oscillation).', advanced: 'Loop-back gain. Capped at 0.95 for stability. With LP in feedback, high-frequency energy decays gradually.' } },
    },
    [DELAY_PARAM.TONE_HZ]: {
      title: { ro: 'Tone', en: 'Tone' },
      body: { ro: { beginner: 'Cât de luminos sună ecoul. Mai jos = ecou mai întunecat, ca pe bandă magnetică.', advanced: 'Cutoff one-pole LP în feedback path. La 6 kHz se simulează tape; la 18 kHz e digital clean.' }, en: { beginner: 'How bright the echo sounds. Lower = darker echo, tape-like.', advanced: 'One-pole LP cutoff in the feedback path. 6 kHz emulates tape; 18 kHz is digital clean.' } },
    },
    [DELAY_PARAM.DRY_WET]: {
      title: { ro: 'Mix', en: 'Mix' },
      body: { ro: { beginner: 'Cât de tare e ecoul vs semnalul original.', advanced: 'Linear crossfade între dry și wet (echo + feedback chain).' }, en: { beginner: 'How loud the echo is vs the original signal.', advanced: 'Linear crossfade between dry and wet (echo + feedback chain).' } },
    },
  },
}

// ─── Reverb ──────────────────────────────────────────────────────────────

const REVERB_DOCS: EffectDocs = {
  title: { ro: 'Reverb', en: 'Reverb' },
  summary: {
    ro: {
      beginner: 'Adaugă "spațiu" sunetului — ca și cum sunetul ar răsuna într-o cameră. Util pentru voce uscată, drums lipsite de spațiu.',
      advanced: 'Schroeder-style algorithmic reverb (4 LP-feedback comb filters în paralel + 2 allpass în serie), cu predelay separat. Damping = LP în feedback comb-urilor.',
    },
    en: {
      beginner: "Adds 'space' to the sound — like the sound resonating in a room. Useful for dry vocals, drums lacking depth.",
      advanced: 'Schroeder-style algorithmic reverb (4 LP-feedback comb filters in parallel + 2 allpass in series), with a separate predelay. Damping = LP in the comb feedback path.',
    },
  },
  params: {
    [REVERB_PARAM.ROOM_SIZE]: {
      title: { ro: 'Size', en: 'Size' },
      body: { ro: { beginner: 'Cât de mare e camera virtuală. 0 = încăpere mică; 1 = sală mare.', advanced: 'Mapează la feedback-ul comb-urilor (0.5..0.97). Valori peste 0.95 ating self-oscillation = reverb infinit.' }, en: { beginner: 'How big the virtual room feels. 0 = small room; 1 = large hall.', advanced: 'Maps to comb feedback (0.5..0.97). Above 0.95 you reach self-oscillation = infinite reverb.' } },
    },
    [REVERB_PARAM.DAMPING]: {
      title: { ro: 'Damping', en: 'Damping' },
      body: { ro: { beginner: 'Cât de mult înghite camera frecvențele înalte. Mai mare = sună mai cald, mai "vechi".', advanced: 'Coef. LP în feedback-ul comb-urilor. Simulează absorbția HF pe materiale moi (covor, mobilier).' }, en: { beginner: 'How much the room absorbs high frequencies. Higher = warmer, more "vintage" sound.', advanced: 'LP coef in the comb feedback path. Simulates HF absorption by soft surfaces (carpet, furniture).' } },
    },
    [REVERB_PARAM.PRE_DELAY_MS]: {
      title: { ro: 'PreDelay', en: 'PreDelay' },
      body: { ro: { beginner: 'Cât așteaptă reverb-ul înainte să înceapă. 20-50 ms = vocea rămâne clară, reverb-ul vine după.', advanced: 'Delay separat în fața rețelei comb/allpass. Util pentru a separa atac-ul vocii de tail-ul reverb.' }, en: { beginner: "How long the reverb waits before starting. 20-50 ms = vocal stays upfront, reverb arrives after.", advanced: 'Separate delay in front of the comb/allpass network. Useful to keep the vocal attack distinct from the reverb tail.' } },
    },
    [REVERB_PARAM.DRY_WET]: {
      title: { ro: 'Mix', en: 'Mix' },
      body: { ro: { beginner: 'Cât din reverb auzi vs semnal uscat. 20-30 % e tipic pentru voce.', advanced: 'Linear crossfade. Send-style mixing recomandat: trimite parallel către un canal Reverb cu wet=100% și controlează prin send.' }, en: { beginner: 'How much reverb vs dry signal. 20-30 % is typical on vocals.', advanced: 'Linear crossfade. Send-style mixing recommended: parallel-send to a Reverb channel at wet=100 % and control via send level.' } },
    },
  },
}

// ─── Saturation ──────────────────────────────────────────────────────────

const SATURATION_DOCS: EffectDocs = {
  title: { ro: 'Saturation', en: 'Saturation' },
  summary: {
    ro: {
      beginner: 'Adaugă "căldură" sau "agresivitate" prin distorsiune. Drive controlează cât de mult; tipul (Tanh/Soft/Hard/Tube) decide caracterul.',
      advanced: 'Memoryless waveshaper cu drive pre-gain, alegere între 4 curbe (tanh, polynomial soft clip, hard clip, asymmetric tube), LP post-shaper pentru anti-alias soft, level compensation empiric.',
    },
    en: {
      beginner: "Adds 'warmth' or 'aggression' via distortion. Drive sets how much; the Type (Tanh/Soft/Hard/Tube) decides the character.",
      advanced: 'Memoryless waveshaper with drive pre-gain, choice of 4 curves (tanh, polynomial soft clip, hard clip, asymmetric tube), post-shaper LP for soft anti-aliasing, empirical level compensation.',
    },
  },
  params: {
    [SATURATION_PARAM.DRIVE_DB]: {
      title: { ro: 'Drive', en: 'Drive' },
      body: { ro: { beginner: 'Cât de tare împingi semnalul în distorsiune. 0 = neschimbat; +18 dB = caracter clar.', advanced: 'Pre-gain dB înainte de shaping. La drive mare ai nevoie de Tone activ ca să tai aliasing-ul harmonic.' }, en: { beginner: "How hard you push the signal into distortion. 0 = unchanged; +18 dB = obvious character.", advanced: 'Pre-shaper gain in dB. At high drive you need Tone engaged to tame harmonic aliasing.' } },
    },
    [SATURATION_PARAM.TYPE]: {
      title: { ro: 'Type', en: 'Type' },
      body: { ro: { beginner: 'Forma curbei: Tanh = neted, Soft = polynomial, Hard = clipping clasic, Tube = asimetric (chip de tub).', advanced: 'Tanh: smooth, energie pe pare. Soft (cubic): edge-uri mai blânde. Hard: clip dur cu odd harmonics. Tube: pos vs neg diferit, even-harmonic flavour.' }, en: { beginner: 'Shape of the curve: Tanh = smooth, Soft = polynomial, Hard = classic clipping, Tube = asymmetric (tube-style).', advanced: 'Tanh: smooth, even-harmonic energy. Soft (cubic): gentler edges. Hard: brick clip, odd harmonics. Tube: pos vs neg differs, even-harmonic flavour.' } },
    },
    [SATURATION_PARAM.TONE_HZ]: {
      title: { ro: 'Tone', en: 'Tone' },
      body: { ro: { beginner: 'Cutoff-ul filtrului LP de după shaper. Mai jos = mai puține înalte agresive.', advanced: 'LP biquad post-shaper (Q=0.707). Setează în jur de 6-10 kHz la drive ridicat pentru a controla aliasing-ul.' }, en: { beginner: 'LP filter cutoff after the shaper. Lower = fewer aggressive highs.', advanced: 'LP biquad post-shaper (Q=0.707). Set around 6-10 kHz at high drive to keep aliasing under control.' } },
    },
    [SATURATION_PARAM.DRY_WET]: {
      title: { ro: 'Mix', en: 'Mix' },
      body: { ro: { beginner: 'Blendează semnalul saturat cu cel original.', advanced: 'Linear crossfade pentru parallel saturation — păstrează transient-ele și adaugă densitate.' }, en: { beginner: 'Blends the saturated signal with the original.', advanced: 'Linear crossfade for parallel saturation — preserves transients while adding density.' } },
    },
  },
}

export const EFFECT_DOCS: Record<EffectType, EffectDocs> = {
  [EffectType.Gain]: GAIN_DOCS,
  [EffectType.Compressor]: COMPRESSOR_DOCS,
  [EffectType.ParametricEq]: EQ_DOCS,
  [EffectType.Gate]: GATE_DOCS,
  [EffectType.Limiter]: LIMITER_DOCS,
  [EffectType.Delay]: DELAY_DOCS,
  [EffectType.Reverb]: REVERB_DOCS,
  [EffectType.Saturation]: SATURATION_DOCS,
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
