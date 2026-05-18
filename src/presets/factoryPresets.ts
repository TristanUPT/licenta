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

  // ── 6. Acoustic Guitar ─────────────────────────────────────────────────
  {
    id: 'factory:acoustic-guitar',
    name: { ro: 'Chitară Acustică', en: 'Acoustic Guitar' },
    description: {
      ro: 'HPF 80 Hz → EQ (mud cut + body + air) → Compressor ușor → Reverb de cameră.',
      en: 'HPF 80 Hz → EQ (mud cut + body + air) → light Compressor → room Reverb.',
    },
    rationale: {
      ro: {
        beginner:
          'Chitara acustică are o gamă de frecvențe foarte largă — de la sub-bas la armonice înalte. HPF 80 Hz taie rumenblul microfonului și zgomotul de podea. EQ-ul scoate "noroiul" de la 200 Hz (specific microfoanelor directionate aproape de cutia de rezonanță), adaugă corp la 120 Hz și prezență la 5 kHz. Compresorul ușor (ratio 2:1) uniformizează atacurile de pana fără a ucide dinamica. Reverb mic simulează sala de concert.',
        advanced:
          'Low Cut 80 Hz (12 dB/oct) — pantă mai blândă față de voce pentru a nu afecta "thump"-ul chitarei. Bell –3 dB @ 200 Hz (Q=2.5) atenuează boxiness-ul cutiei de rezonanță (proximity effect dacă microfonul e aproape de soundhole). Bell +2 dB @ 120 Hz (Q=1) → fundamentalele coardelor D și A (+1 octavă) — adaugă warmth. Bell +2.5 dB @ 5 kHz (Q=2) → "sparkle" — armonicele plectrumului/unghiei. Compressor 2:1, attack 20 ms (lasă pick transient), release 80 ms. Reverb (Schroeder) SIZE=0.35, DAMPING=0.4 → cameră live, nu hall.',
      },
      en: {
        beginner:
          'Acoustic guitar has a very wide frequency range — from sub-bass to high harmonics. HPF 80 Hz removes mic rumble and floor noise. The EQ removes "mud" at 200 Hz (typical when mic is close to the soundhole), adds body at 120 Hz and presence at 5 kHz. The light compressor (2:1) evens out pick attacks without killing dynamics. Small reverb simulates a concert room.',
        advanced:
          'Low Cut 80 Hz (12 dB/oct) — gentler slope than vocals to preserve the guitar "thump". Bell –3 dB @ 200 Hz (Q=2.5) attenuates resonance box boxiness (proximity effect when mic is near soundhole). Bell +2 dB @ 120 Hz (Q=1) → D and A string fundamentals (+1 octave) — adds warmth. Bell +2.5 dB @ 5 kHz (Q=2) → "sparkle" — plectrum/nail harmonics. Compressor 2:1, attack 20 ms (passes pick transient), release 80 ms. Reverb (Schroeder) SIZE=0.35, DAMPING=0.4 → live room, not hall.',
      },
    },
    effects: [
      {
        type: EffectType.ParametricEq,
        params: {
          ...eqLowCut(80, 1),
          ...eqBand(0, 0,  120,   2,   1),
          ...eqBand(1, 0,  200,  -3,   2.5),
          ...eqBand(2, 0, 5000,   2.5, 2),
          ...eqBand(3, 2, 12000,  1.5, 1),
        },
      },
      {
        type: EffectType.Compressor,
        params: { 0: -18, 1: 2, 2: 20, 3: 80, 4: 4, 5: 3, 6: 60, 7: 1 },
      },
      {
        type: EffectType.Reverb,
        params: { 0: 0.35, 1: 0.4, 2: 15, 3: 0.18 },
      },
    ],
  },

  // ── 7. Lo-Fi / Vinyl ───────────────────────────────────────────────────
  {
    id: 'factory:lo-fi',
    name: { ro: 'Lo-Fi / Vinil', en: 'Lo-Fi / Vinyl' },
    description: {
      ro: 'Saturation → EQ (bandpass 150–8 kHz) → Chorus fin → Reverb warm.',
      en: 'Saturation → bandpass EQ (150–8 kHz) → subtle Chorus → warm Reverb.',
    },
    rationale: {
      ro: {
        beginner:
          'Sunetul lo-fi imită un vinil sau o casetă veche — are mai puțin sub-bas și înalte clare, mai multă "murdar". Saturarea adaugă armonice calde. EQ-ul limitează banda la 150 Hz–8 kHz, ca un difuzor mic sau un vinil. Chorus-ul fin simulează ușoarele variații de viteză ale unui girofar. Reverb-ul cald adaugă ambiența unui studio vechi.',
        advanced:
          'Lo-fi chain: Saturation TAPE (TYPE=1), DRIVE=4, TONE=8 kHz — waveshaper cu clipper moale asimetric + LPF, imitând banda de caseta cu saturare la niveluri medii. EQ: HPF 150 Hz (24 dB/oct) taie sub-bass-ul absent pe vinil (canalul de modulator are răspuns HPF la bass); HiShelf –6 dB @ 8 kHz (Q=0.7) taie frecvențele înalte absente din calitatea vinil/casetă. Chorus (RATE=0.3 Hz, DEPTH=0.4) simulează wow & flutter (variații de viteză sub 4 Hz). Reverb warm (SIZE=0.55, DAMPING=0.8) → "room sound" al unui studio mic din anii \'70.',
      },
      en: {
        beginner:
          'Lo-fi sound mimics a vinyl record or old cassette — less sub-bass and crisp highs, more "dirt". Saturation adds warm harmonics. EQ limits the band to 150 Hz–8 kHz, like a small speaker or vinyl. Subtle Chorus simulates the slight speed variations of a turntable. Warm reverb adds the ambience of an old studio.',
        advanced:
          'Lo-fi chain: Saturation TAPE (TYPE=1), DRIVE=4, TONE=8 kHz — soft asymmetric clipper waveshaper + LPF, mimicking cassette tape saturation at medium levels. EQ: HPF 150 Hz (24 dB/oct) removes sub-bass absent on vinyl (the cutter head has HPF bass response); HiShelf –6 dB @ 8 kHz (Q=0.7) removes high frequencies absent from vinyl/cassette quality. Chorus (RATE=0.3 Hz, DEPTH=0.4) simulates wow & flutter (speed variations below 4 Hz). Warm reverb (SIZE=0.55, DAMPING=0.8) → room sound of a small 1970s studio.',
      },
    },
    effects: [
      {
        type: EffectType.Saturation,
        params: { 0: 4, 1: 1, 2: 8000, 3: 0.85 },
      },
      {
        type: EffectType.ParametricEq,
        params: {
          ...eqLowCut(150, 2),
          ...eqBand(0, 1,  300,  1.5, 0.8),
          ...eqBand(3, 2, 8000, -6,   0.7),
        },
      },
      {
        type: EffectType.Chorus,
        params: { 0: 0.3, 1: 0.4, 2: 12, 3: 0.2, 4: 0.5 },
      },
      {
        type: EffectType.Reverb,
        params: { 0: 0.55, 1: 0.8, 2: 20, 3: 0.2 },
      },
    ],
  },

  // ── 8. De-Essing & Breath Control ──────────────────────────────────────
  {
    id: 'factory:voice-advanced',
    name: { ro: 'Voce Avansată (De-ess)', en: 'Advanced Voice (De-ess)' },
    description: {
      ro: 'Gate → EQ → Compressor → De-esser → Limiter. Lanț complet pentru voce cu sibilanță.',
      en: 'Gate → EQ → Compressor → De-esser → Limiter. Full chain for voice with sibilance.',
    },
    rationale: {
      ro: {
        beginner:
          'Unele voci au un "s" sau "ș" prea ascuțit — se numește sibilanță. De-esser-ul este un compressor special care lucrează doar pe frecvențele înalte (6–8 kHz) unde se găsesc sibilantele. Îl punem după compresorul principal pentru că compresorul poate amplifica sibilantele prin makeup gain. Ordinea corectă: Gate (zgomot) → EQ (modelare) → Compressor (dinamică) → De-esser (sibilante) → Limiter (protecție).',
        advanced:
          'De-esser post-compressor este arhitectura standard: compresorul cu makeup gain crește nivelul mediu, amplificând implicit sibilantele care oricum sunt mai sus în spectru. De-esser-ul (sidechain HPF @ 6 kHz, Q=0.7) detectează energia de înaltă frecvență independent și aplică reducere de gain selectivă. THRESHOLD –22 dB, RATIO 4:1, RELEASE 50 ms — răspuns rapid pentru a prinde tranzienetele de sibilanță (< 30 ms) fără a afecta vocalele. Avantaj față de EQ static: nu atenuează permanent 8 kHz — atenuează NUMAI când apare sibilanță.',
      },
      en: {
        beginner:
          'Some voices have a too-sharp "s" or "sh" — this is called sibilance. The de-esser is a special compressor that works only on the high frequencies (6–8 kHz) where sibilants live. We place it after the main compressor because the compressor can amplify sibilants through makeup gain. Correct order: Gate (noise) → EQ (shaping) → Compressor (dynamics) → De-esser (sibilance) → Limiter (protection).',
        advanced:
          'De-esser post-compressor is the standard architecture: the compressor with makeup gain raises average level, implicitly amplifying sibilants which are already higher in the spectrum. The de-esser (sidechain HPF @ 6 kHz, Q=0.7) independently detects high-frequency energy and applies selective gain reduction. THRESHOLD −22 dB, RATIO 4:1, RELEASE 50 ms — fast response to catch sibilant transients (< 30 ms) without affecting vowels. Advantage over static EQ: does not permanently attenuate 8 kHz — attenuates ONLY when sibilance occurs.',
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
          ...eqBand(1, 0, 300,   -3,  2),
          ...eqBand(2, 0, 3000,   2,  1.5),
        },
      },
      {
        type: EffectType.Compressor,
        params: { 0: -22, 1: 3, 2: 10, 3: 120, 4: 6, 5: 6, 6: 80, 7: 1 },
      },
      {
        type: EffectType.DeEsser,
        params: { 0: -22, 1: 4, 2: 6000, 3: 50, 4: 0, 5: 1 },
      },
      {
        type: EffectType.Limiter,
        params: { 0: -1, 1: 50, 2: 1 },
      },
    ],
  },
]
