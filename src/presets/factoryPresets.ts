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
  /** Educational explanation of why this chain works. */
  rationale?: {
    ro: { beginner: string; advanced: string }
    en: { beginner: string; advanced: string }
  }
  category?: 'factory' | 'user'
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
    rationale: {
      ro: {
        beginner:
          'Ordinea lanțului este importantă: Gate-ul taie mai întâi zgomotul de fundal — dacă l-am pune după compressor, compresorul ar amplifica zgomotul. EQ-ul vine al doilea pentru a scoate frecvențele neplăcute înainte ca compresorul să le amplifice. Compresorul uniformizează volumul, iar Limiterul se asigură că nu apare nicio distorsie la ieșire.',
        advanced:
          'Gate (pre-EQ) previne amplificarea zgomotului de cameră de către compressor. Low Cut 80 Hz (24 dB/oct) elimină plosivele și rumenblul fără a afecta fundamentala vocală (f0 ≈ 100–300 Hz). Bell –3 dB @ 300 Hz atenuează "mud"-ul caracteristic al microfoanelor cu diagramă cardioide în spații mici (proximity effect + boxiness). Bell +2.5 dB @ 3 kHz adaugă prezență în zona de maximă sensibilitate a urechii (2–4 kHz). Compressor 3:1 cu attack 10 ms lasă tranzientele să treacă înainte de a compresa — "sunetul" vocii. Makeup +6 dB compensează reducerea medie. Limiterul la –1 dBFS protejează DAW-ul de clipping.',
      },
      en: {
        beginner:
          'The chain order matters: the Gate first removes background noise — putting it after the compressor would make the compressor amplify the noise. EQ second removes unwanted frequencies before the compressor can amplify them. The compressor evens out the volume, and the Limiter prevents any clipping at the output.',
        advanced:
          'Gate (pre-EQ) prevents the compressor from amplifying room noise. Low Cut at 80 Hz (24 dB/oct) removes plosives and rumble without affecting the vocal fundamental (f0 ≈ 100–300 Hz). Bell –3 dB @ 300 Hz attenuates "mud" typical of cardioid mics in small rooms (proximity effect + boxiness). Bell +2.5 dB @ 3 kHz adds presence in the ear\'s peak sensitivity zone (2–4 kHz). Compressor 3:1 with 10 ms attack lets transients pass before compressing — preserving the vocal "snap". Makeup +6 dB restores average level. Limiter at –1 dBFS protects the DAW from clipping.',
      },
    },
    effects: [
      {
        type: EffectType.Gate,
        params: { 0: -50, 1: 2, 2: 20, 3: 100, 4: -60, 5: 4, 6: 1 },
      },
      {
        type: EffectType.ParametricEq,
        params: {
          ...eqLowCut(80, 2),
          ...eqBand(1, 0, 300,   -3,  2.5),
          ...eqBand(2, 0, 3000,   2.5, 1.5),
          ...eqBand(3, 2, 10000,  1.5, 1),
        },
      },
      {
        type: EffectType.Compressor,
        params: { 0: -22, 1: 3, 2: 10, 3: 120, 4: 6, 5: 6, 6: 80, 7: 1 },
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
    rationale: {
      ro: {
        beginner:
          'Gate-ul strâns taie "coada" tobelor, lăsând sunetul mai sec și mai puternic. Compresorul 6:1 cu attack rapid (3 ms) prinde tranzientele și reduce dinamica, ceea ce face tobele să "pompeze" — efectul clasic de drum compresie. EQ-ul vine după compressor pentru a definitiva sunetul: +3 dB la 60 Hz adaugă punch în sub-bas fără a supra-solicita compresorul.',
        advanced:
          'Gate cu HOLD 40 ms — suficient de lung pentru a nu clipa transientul, suficient de scurt pentru a evita bleed-ul. Compressor 6:1, attack 3 ms, release 60 ms → GR tipic 6–10 dB, producând pump controlat. EQ post-compressor: Bell +3 dB @ 60 Hz (Q=1) pentru fundamentala kick-ului; Bell –4 dB @ 400 Hz (Q=2) taie "boxiness"-ul; Bell +2.5 dB @ 5 kHz (Q=1.5) scoate "atacul" stickului, creând definire în mix. Limiterul la –2 dBFS cu release 30 ms lasă tobele să respire.',
      },
      en: {
        beginner:
          'The tight Gate cuts the "tail" of the drums, making them drier and punchier. The 6:1 compressor with fast attack (3 ms) catches the transients and reduces dynamics, making the drums "pump" — the classic drum compression effect. EQ after the compressor finalises the sound: +3 dB at 60 Hz adds sub punch without overloading the compressor.',
        advanced:
          'Gate with HOLD 40 ms — long enough not to clip the transient, short enough to avoid bleed. Compressor 6:1, attack 3 ms, release 60 ms → typical GR 6–10 dB, producing controlled pump. EQ post-compressor: Bell +3 dB @ 60 Hz (Q=1) boosts the kick fundamental; Bell –4 dB @ 400 Hz (Q=2) removes boxiness; Bell +2.5 dB @ 5 kHz (Q=1.5) brings out the stick attack, adding definition in the mix. Limiter at –2 dBFS with 30 ms release lets the drums breathe.',
      },
    },
    effects: [
      {
        type: EffectType.Gate,
        params: { 0: -30, 1: 1, 2: 40, 3: 60, 4: -60, 5: 3, 6: 1 },
      },
      {
        type: EffectType.Compressor,
        params: { 0: -20, 1: 6, 2: 3, 3: 60, 4: 3, 5: 4, 6: 80, 7: 1 },
      },
      {
        type: EffectType.ParametricEq,
        params: {
          ...eqLowCut(30, 2),
          ...eqBand(0, 0,   60,   3,   1),
          ...eqBand(1, 0,  400,  -4,   2),
          ...eqBand(2, 0, 5000,   2.5, 1.5),
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
    rationale: {
      ro: {
        beginner:
          'Masteringul trebuie să fie subtil — vorbim de modificări de 1–2 dB, nu de 10 dB. EQ-ul adaugă puțin corp la bas și puțin aer la înalte, fără a schimba caracterul fundamental al mixului. Compresorul la ratio 2:1 cu Mix 80% face "parallel compression" — 20% din semnal trece necomprimat, menținând dinamica naturală. Limiterul la –1 dBFS este obligatoriu pentru a preveni clipping-ul la platformele de streaming.',
        advanced:
          'EQ mastering: LoShelf +1.5 dB @ 100 Hz (Q=1) adaugă body fără a atinge sub-bas; HiShelf +2 dB @ 12 kHz (Q=1) adaugă "air" fără sibilanță. Compressor 2:1, attack 30 ms, release 200 ms (răspuns lent) → maximizează glue-ul fără a afecta dinamica. Mix 0.8 = New York/parallel compression: suma ponderată (0.8×wet + 0.2×dry) păstrează tranzientele originale — tehnica "two-buss" clasică. Limiter release 80 ms evită distorsiunea inter-sample clipping.',
      },
      en: {
        beginner:
          'Mastering should be subtle — we are talking 1–2 dB changes, not 10 dB. The EQ adds a little body in the lows and a little air in the highs without changing the fundamental character of the mix. The 2:1 compressor at 80% Mix does "parallel compression" — 20% of the signal passes uncompressed, preserving natural dynamics. The Limiter at –1 dBFS is mandatory to prevent clipping on streaming platforms.',
        advanced:
          'Mastering EQ: LoShelf +1.5 dB @ 100 Hz (Q=1) adds body without touching sub-bass; HiShelf +2 dB @ 12 kHz (Q=1) adds "air" without sibilance. Compressor 2:1, attack 30 ms, release 200 ms (slow response) → maximises glue without affecting dynamics. Mix 0.8 = New York/parallel compression: the weighted sum (0.8×wet + 0.2×dry) preserves original transients — classic "two-buss" technique. Limiter release 80 ms avoids inter-sample clipping distortion.',
      },
    },
    effects: [
      {
        type: EffectType.ParametricEq,
        params: {
          ...eqLowCut(30, 1),
          ...eqBand(0, 1,   100,  1.5, 1),
          ...eqBand(3, 2, 12000,  2,   1),
        },
      },
      {
        type: EffectType.Compressor,
        params: { 0: -12, 1: 2, 2: 30, 3: 200, 4: 8, 5: 2, 6: 80, 7: 0.8 },
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
    rationale: {
      ro: {
        beginner:
          'Saturation Tube imită comportamentul unui amplificator cu tuburi: adaugă armonice pare (2, 4, 6 Hz) care sună "cald" și "rotund". EQ-ul de după scoate frecvențele neplăcute care pot apărea din saturare. Compresorul lent (attack 40 ms) lasă tranzientele să treacă, dând senzația "de bandă magnetică". Reverb-ul mic (15%) adaugă o ușoară ambiență de cameră.',
        advanced:
          'Tube saturation (TYPE=3): waveshaper asimetric care simulează caracteristicile I-V ale unui tub triodă — produce predominant armonice pare (2f, 4f) care se amestecă consonant cu fundamentala. TONE=6 kHz LP-filter atenuează frizzing-ul armonic de înaltă frecvență. EQ post-saturation: LoShelf +2 dB @ 150 Hz (warmth zone) + Bell –2 dB @ 350 Hz (mud cut) + Bell –1.5 dB @ 4 kHz (harsh saturation cut). Compressor 2.5:1 cu attack 40 ms → transient-friendly. Reverb (Schroeder): SIZE=0.4, DAMPING=0.6 simulează absorbția aerului și materialelor moi — reverb cald, "roomed".',
      },
      en: {
        beginner:
          'Tube Saturation mimics a tube amplifier: it adds even harmonics (2nd, 4th) that sound "warm" and "round". The EQ removes unpleasant frequencies that may appear from saturation. The slow compressor (40 ms attack) lets transients through, giving a "tape machine" feel. The small reverb (15%) adds a subtle room ambience.',
        advanced:
          'Tube saturation (TYPE=3): asymmetric waveshaper simulating triode I-V characteristics — predominantly produces even harmonics (2f, 4f) that mix consonantly with the fundamental. TONE=6 kHz LP-filter attenuates high-frequency harmonic frizziness. EQ post-saturation: LoShelf +2 dB @ 150 Hz (warmth zone) + Bell –2 dB @ 350 Hz (mud cut) + Bell –1.5 dB @ 4 kHz (harsh saturation cut). Compressor 2.5:1 with 40 ms attack → transient-friendly. Reverb (Schroeder): SIZE=0.4, DAMPING=0.6 simulates air and soft material absorption — warm, "roomed" reverb.',
      },
    },
    effects: [
      {
        type: EffectType.Saturation,
        params: { 0: 8, 1: 3, 2: 6000, 3: 0.7 },
      },
      {
        type: EffectType.ParametricEq,
        params: {
          ...eqLowCut(40, 1),
          ...eqBand(0, 1,  150,   2,   1),
          ...eqBand(1, 0,  350,  -2,   2),
          ...eqBand(2, 0, 4000,  -1.5, 2),
        },
      },
      {
        type: EffectType.Compressor,
        params: { 0: -16, 1: 2.5, 2: 40, 3: 200, 4: 10, 5: 3, 6: 80, 7: 1 },
      },
      {
        type: EffectType.Reverb,
        params: { 0: 0.4, 1: 0.6, 2: 15, 3: 0.15 },
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
    rationale: {
      ro: {
        beginner:
          'Vocea vorbită are nevoie de consistență — ascultătorul nu vrea să fie "plesnit" de un cuvânt tare și să nu audă un altul. HPF 100 Hz taie zgomotul de aer condiționat și vibrating (sub 100 Hz nu există informație utilă în vocea vorbită). Compresorul la ratio 3:1 cu attack mediu (15 ms) uniformizează volumul fără a distorsiona. +5 dB Makeup normalizează nivelul final.',
        advanced:
          'Gate (THRESHOLD=-45 dB, HOLD=100 ms, RELEASE=150 ms) — parametri mai lenți decât la tobe pentru a nu tăia coada silabelor. Low Cut 100 Hz (24 dB/oct) elimină atât rumble-ul mic cât și fundamentalele sub-bas ale vocalei (sub-125 Hz). Bell +2 dB @ 2 kHz (Q=1.5) → "nasal-to-front-of-mouth" region, crește inteligibilitatea în căști/boxe mici. Compressor 3:1 cu SIDECHAIN HPF la 100 Hz previne bass-ul din a activa compresorul pe vocalele deschise. Ratio 3:1 este considerat optim pentru voce vorbită: controlează vârfurile fără a "squash" naturalețea.',
      },
      en: {
        beginner:
          'Spoken voice needs consistency — the listener does not want to be "hit" by a loud word and then not hear another. HPF 100 Hz cuts air conditioning and vibration noise (below 100 Hz there is no useful information in spoken voice). The 3:1 compressor with medium attack (15 ms) evens out volume without distorting. +5 dB Makeup normalises the final level.',
        advanced:
          'Gate (THRESHOLD=−45 dB, HOLD=100 ms, RELEASE=150 ms) — slower parameters than drums to avoid cutting syllable tails. Low Cut 100 Hz (24 dB/oct) removes both mic rumble and sub-bass vocal fundamentals (sub-125 Hz). Bell +2 dB @ 2 kHz (Q=1.5) → "nasal-to-front-of-mouth" region, increases intelligibility through earphones/small speakers. Compressor 3:1 with SIDECHAIN HPF at 100 Hz prevents bass from triggering compression on open vowels. Ratio 3:1 is considered optimal for spoken word: controls peaks without squashing naturalness.',
      },
    },
    effects: [
      {
        type: EffectType.Gate,
        params: { 0: -45, 1: 5, 2: 100, 3: 150, 4: -60, 5: 3, 6: 1 },
      },
      {
        type: EffectType.ParametricEq,
        params: {
          ...eqLowCut(100, 2),
          ...eqBand(1, 0,  250,  -3, 2),
          ...eqBand(2, 0, 2000,   2, 1.5),
          ...eqBand(3, 2, 10000,  1, 1),
        },
      },
      {
        type: EffectType.Compressor,
        params: { 0: -20, 1: 3, 2: 15, 3: 150, 4: 6, 5: 5, 6: 100, 7: 1 },
      },
      {
        type: EffectType.Limiter,
        params: { 0: -1, 1: 100, 2: 1 },
      },
    ],
  },
]
