import { useEffect, useState } from 'react'
import { useEducationStore } from '@/store/educationStore'
import { useEffectsStore } from '@/store/effectsStore'
import { usePresetStore } from '@/store/presetStore'
import { FACTORY_PRESETS } from '@/presets/factoryPresets'
import { getStatus } from '@/audio/engine'

interface QuizQuestion {
  q: { ro: string; en: string }
  options: { ro: string[]; en: string[] }
  correct: number
}

interface LessonContent {
  title: { ro: string; en: string }
  icon: string
  /** ID of the factory preset that best illustrates this lesson. */
  presetId?: string
  body: {
    ro: { beginner: string; advanced: string }
    en: { beginner: string; advanced: string }
  }
  keyPoints: {
    ro: string[]
    en: string[]
  }
  quiz?: QuizQuestion[]
}

const LESSONS: LessonContent[] = [
  {
    icon: '⛓️',
    presetId: 'factory:vocal-cleanup',
    title: { ro: 'Ordinea Efectelor', en: 'Signal Chain Order' },
    body: {
      ro: {
        beginner:
          'Ordinea în care pui efectele contează enorm. Imaginează-ți că fiecare efect transformă sunetul — și efectul următor primește sunetul deja transformat. Gate → EQ → Compressor → Reverb este ordinea clasică pentru voce: mai întâi tăiem zgomotul, apoi modelăm timbrul, apoi controlăm dinamica, și în final adăugăm spațiu.',
        advanced:
          'Ordinea afectează comportamentul fiecărui efect din lanț. Gate înaintea compressorului: semnalul de sidechain al compressorului nu "vede" zgomotul de fundal. EQ înaintea compressorului: compresorul reacționează la timbrul final, nu la frecvențele neegalizate. Reverb la final: reverb-ul procesează semnalul complet — dacă l-ai pune înaintea compressorului, compresorul ar "pompa" reverb-ul.',
      },
      en: {
        beginner:
          'The order you place effects matters enormously. Think of each effect transforming the sound — and the next effect receives the already-transformed signal. Gate → EQ → Compressor → Reverb is the classic vocal order: first cut noise, then shape the tone, then control dynamics, finally add space.',
        advanced:
          'Order affects every effect\'s behaviour. Gate before compressor: the compressor sidechain doesn\'t "see" background noise. EQ before compressor: the compressor reacts to the final timbre, not the unequalized frequencies. Reverb last: reverb processes the complete signal — if placed before the compressor, the compressor would "pump" the reverb.',
      },
    },
    keyPoints: {
      ro: ['Gate → taie zgomotul înainte de tot', 'EQ → modelează înainte de compresie', 'Compressor → controlează dinamica', 'Reverb/Delay → spațializare la final'],
      en: ['Gate → remove noise first', 'EQ → shape before compression', 'Compressor → control dynamics', 'Reverb/Delay → spatialise last'],
    },
    quiz: [
      {
        q: { ro: 'De ce se pune Gate-ul înaintea Compressorului?', en: 'Why is the Gate placed before the Compressor?' },
        options: {
          ro: ['Gate-ul taie zgomotul înainte ca Compressorul să-l amplifice', 'Gate-ul funcționează mai bine la semnale puternice', 'Compressorul nu funcționează fără Gate', 'Ordinea nu contează'],
          en: ['Gate removes noise before the Compressor can amplify it', 'Gate works better on loud signals', 'Compressor does not work without a Gate', 'The order does not matter'],
        },
        correct: 0,
      },
      {
        q: { ro: 'Unde se pune Reverb-ul de obicei în lanț?', en: 'Where is Reverb usually placed in the chain?' },
        options: {
          ro: ['La început, pentru a adăuga spațiu sunetului brut', 'La mijloc, între EQ și Compressor', 'La final, după toate efectele de dinamică', 'Nu contează'],
          en: ['At the start, to add space to the raw sound', 'In the middle, between EQ and Compressor', 'At the end, after all dynamics effects', 'It does not matter'],
        },
        correct: 2,
      },
    ],
  },
  {
    icon: '📊',
    presetId: 'factory:drum-punch',
    title: { ro: 'Compresie și Dinamică', en: 'Compression & Dynamics' },
    body: {
      ro: {
        beginner:
          'Dinamica unui sunet este diferența dintre cel mai tare și cel mai silențios moment. Muzica live are o dinamică mare — diferența poate fi de 40 dB. Un podcast trebuie să aibă o dinamică mică — ascultătorul nu vrea să regleze volumul constant. Compresorul reduce automat vârfurile tari, uniformizând volumul.',
        advanced:
          'Raportul semnal/zgomot (SNR) este limitat de nivelul de zgomot al înregistrării. Compresia reduce dinamica, ceea ce permite creșterea nivelului mediu (makeup gain) fără clipping — efectiv crește SNR-ul perceptual. Limiterul este un compressor cu ratio ∞:1 — blochează orice vârf deasupra threshold-ului. Parallel compression (New York): amestecul unui semnal comprimat agresiv cu originalul menține dinamica naturală dar adaugă "glue".',
      },
      en: {
        beginner:
          'Dynamics is the difference between the loudest and quietest moments in a recording. Live music has high dynamics — the range can be 40 dB. A podcast needs low dynamics — the listener doesn\'t want to constantly adjust the volume. A compressor automatically reduces loud peaks, evening out the volume.',
        advanced:
          'The signal-to-noise ratio (SNR) is limited by the recording\'s noise floor. Compression reduces dynamics, allowing the average level to be raised (makeup gain) without clipping — effectively increasing perceptual SNR. A limiter is a compressor with ∞:1 ratio — it blocks any peak above threshold. Parallel compression (New York): mixing an aggressively compressed signal with the original preserves natural dynamics while adding "glue".',
      },
    },
    keyPoints: {
      ro: ['Threshold = nivelul de la care se activează', 'Ratio = cât de tare se reduce', 'Attack = cât de repede intră', 'Release = cât de repede iese', 'Makeup = compensează nivelul redus'],
      en: ['Threshold = level at which it engages', 'Ratio = how much it reduces', 'Attack = how fast it engages', 'Release = how fast it disengages', 'Makeup = compensates reduced level'],
    },
    quiz: [
      {
        q: { ro: 'Ce parametru determină la ce nivel de volum intră compresorul?', en: 'Which parameter determines at what volume level the compressor engages?' },
        options: {
          ro: ['Ratio', 'Threshold', 'Attack', 'Makeup Gain'],
          en: ['Ratio', 'Threshold', 'Attack', 'Makeup Gain'],
        },
        correct: 1,
      },
      {
        q: { ro: 'Un Ratio de 10:1 înseamnă că semnalul care depășește pragul cu 10 dB va ieși cu…', en: 'A 10:1 Ratio means a signal exceeding the threshold by 10 dB will come out…' },
        options: {
          ro: ['10 dB mai mult decât pragul', '1 dB mai mult decât pragul', 'Egal cu pragul', 'Fără schimbare'],
          en: ['10 dB above the threshold', '1 dB above the threshold', 'Equal to the threshold', 'Unchanged'],
        },
        correct: 1,
      },
    ],
  },
  {
    icon: '🎛️',
    presetId: 'factory:acoustic-guitar',
    title: { ro: 'Egalizarea (EQ)', en: 'Equalisation (EQ)' },
    body: {
      ro: {
        beginner:
          'EQ-ul îți permite să modifici volumul unor frecvențe specifice fără a le afecta pe celelalte. Băsii (20–200 Hz) dau greutate sunetului. Mediile-joase (200–500 Hz) = "corpul". Mediile (500 Hz–2 kHz) = inteligibilitate, nazalitate. Înaltele (2–10 kHz) = prezență, claritate. Aerul (10–20 kHz) = strălucire. Regula de aur: înainte să boostezi, încearcă să tai frecvențele nedorite — sună mai natural.',
        advanced:
          'Biquad filters (RBJ cookbook): bell/peaking, low/high shelf, HPF/LPF, notch. Parametrii: freq (centrul), gain (±dB), Q (bandwidth = freq / (upper_hz − lower_hz)). La Q înalt (>4) → filtru îngust, chirurgical. La Q mic (<1) → filtru lat, muzical. Ordinea EQ → compressor vs compressor → EQ schimbă fundamental răspunsul: EQ post-comp permite corectarea artefactelor de compresie (de ex. bass-ul care "pompează" se poate atenua selectiv).',
      },
      en: {
        beginner:
          'EQ lets you change the volume of specific frequencies without affecting others. Bass (20–200 Hz) gives weight. Low-mids (200–500 Hz) = "body". Mids (500 Hz–2 kHz) = intelligibility, nasality. Highs (2–10 kHz) = presence, clarity. Air (10–20 kHz) = shimmer. Golden rule: before boosting, try cutting unwanted frequencies — it sounds more natural.',
        advanced:
          'Biquad filters (RBJ cookbook): bell/peaking, low/high shelf, HPF/LPF, notch. Parameters: freq (centre), gain (±dB), Q (bandwidth = freq / (upper_hz − lower_hz)). High Q (>4) → narrow, surgical filter. Low Q (<1) → wide, musical filter. EQ → compressor vs compressor → EQ order fundamentally changes the response: EQ post-compressor allows correcting compression artefacts (e.g. pumping bass can be selectively attenuated).',
      },
    },
    keyPoints: {
      ro: ['Taie înainte să boostezi', 'HPF (High-Pass Filter) elimină sub-basul nedorit', 'Bell = boost/cut punctual', 'Shelf = boost/cut progresiv', 'Q mic = muzical; Q mare = chirurgical'],
      en: ['Cut before you boost', 'HPF removes unwanted sub-bass', 'Bell = point boost/cut', 'Shelf = gradual boost/cut', 'Low Q = musical; High Q = surgical'],
    },
    quiz: [
      {
        q: { ro: 'Care este regula de aur în egalizare?', en: 'What is the golden rule of equalisation?' },
        options: {
          ro: ['Booostează frecvențele de care ai nevoie', 'Taie înainte să boostezi', 'Folosește întotdeauna High-Pass Filter', 'EQ-ul nu trebuie depășit ±3 dB'],
          en: ['Boost the frequencies you need', 'Cut before you boost', 'Always use a High-Pass Filter', 'EQ should never exceed ±3 dB'],
        },
        correct: 1,
      },
      {
        q: { ro: 'Un Q înalt (ex. Q=8) creează un filtru…', en: 'A high Q value (e.g. Q=8) creates a…' },
        options: {
          ro: ['Lat și muzical, afectează o gamă largă de frecvențe', 'Îngust și chirurgical, afectează frecvențe precise', 'Care elimină complet o frecvență', 'Shelf care ridică toate frecvențele înalte'],
          en: ['Wide and musical, affecting a broad range of frequencies', 'Narrow and surgical, affecting precise frequencies', 'That completely removes a frequency', 'Shelf that boosts all high frequencies'],
        },
        correct: 1,
      },
    ],
  },
  {
    icon: '🏛️',
    presetId: 'factory:vintage-warmth',
    title: { ro: 'Reverb și Delay', en: 'Reverb & Delay' },
    body: {
      ro: {
        beginner:
          'Reverb simulează sunetul unui spațiu — dacă înregistrezi într-o cameră mică (dry), reverb-ul adaugă senzația unui concert hall. Delay creează ecouri — copii ale semnalului cu o ușoară întârziere. Amândouă creează "profunzime" în mix — senzația că sunetele sunt la distanțe diferite. Regula: mai puțin este mai mult. Reverb excesiv face mixul "noroios".',
        advanced:
          'Reverb Schroeder (implementat aici): 4 comb filters în paralel + 2 all-pass filters în serie. Comb filter = delay cu feedback, crează "metalic ring" la frecvențe specifice. All-pass filter = colorare de fază fără schimbare de amplitudine, difuzează reflexiile. Pre-delay (10–30 ms) separă sursa de reverb — creează perceptia că sunetul "respiră". Damping controlează absorbția HF a "pereților" virtuali — valori mari = spațiu cu materiale moi (studio, living).',
      },
      en: {
        beginner:
          'Reverb simulates the sound of a space — if you record in a small dry room, reverb adds the feel of a concert hall. Delay creates echoes — copies of the signal with a slight delay. Both create "depth" in the mix — the sensation of sounds being at different distances. Rule: less is more. Excessive reverb makes the mix "muddy".',
        advanced:
          'Schroeder reverb (implemented here): 4 parallel comb filters + 2 series all-pass filters. Comb filter = delay with feedback, creates metallic ringing at specific frequencies. All-pass filter = phase colouring without amplitude change, diffuses reflections. Pre-delay (10–30 ms) separates source from reverb — creates the perception that the sound "breathes". Damping controls HF absorption of virtual "walls" — high values = soft-material space (studio, living room).',
      },
    },
    keyPoints: {
      ro: ['Reverb la final în lanț', 'Pre-delay (10–30 ms) = naturalitate', 'Damping = materiale moi vs dure', 'Mix scăzut (10–30%) pentru mix dens', 'Delay = ritmul (BPM sync) + feedback'],
      en: ['Reverb last in chain', 'Pre-delay (10–30 ms) = naturalness', 'Damping = soft vs hard materials', 'Low mix (10–30%) for dense mixes', 'Delay = rhythm (BPM sync) + feedback'],
    },
    quiz: [
      {
        q: { ro: 'De ce se pune Reverb-ul la finalul lanțului de efecte?', en: 'Why is Reverb placed at the end of the effects chain?' },
        options: {
          ro: ['Pentru că are nevoie de semnal puternic', 'Ca să proceseze semnalul complet finalizat, nu intermediar', 'Pentru că nu funcționează pe semnale slabe', 'Nu contează unde e pus'],
          en: ['Because it needs a strong signal', 'To process the fully processed signal, not an intermediate one', 'Because it does not work on weak signals', 'It does not matter where it is placed'],
        },
        correct: 1,
      },
      {
        q: { ro: 'Ce face parametrul Pre-delay în Reverb?', en: 'What does the Pre-delay parameter do in Reverb?' },
        options: {
          ro: ['Controlează volumul reverb-ului', 'Separă sunetul direct de reverb, adăugând naturalitate', 'Setează BPM-ul ecou-urilor', 'Filtrează frecvențele înalte'],
          en: ['Controls the reverb volume', 'Separates the direct sound from reverb, adding naturalness', 'Sets the BPM of the echoes', 'Filters high frequencies'],
        },
        correct: 1,
      },
    ],
  },
  {
    icon: '🎚️',
    presetId: 'factory:mastering',
    title: { ro: 'Mastering: Lanțul Final', en: 'Mastering: The Final Chain' },
    body: {
      ro: {
        beginner:
          'Masteringul este ultimul pas înainte ca muzica să ajungă la public — "lipiciul" care face ca un mix să sune bine pe orice sistem audio. Nu schimbi dramatic sunetul; corectezi subtil, uniformizezi și optimizezi nivelul. Un lanț tipic de mastering: EQ dinamic (corectează probleme) → Compressor ușor (glue) → Limiter (maximizare volum). Scopul: sunet consistent, care ajunge la nivelul de referință al platformei (ex: Spotify –14 LUFS).',
        advanced:
          'Mastering chain arhitectural: EQ corectiv (tăieri chirurgicale, max ±3 dB) → EQ creativ (shelving cald) → Compressor (2:1–4:1, attack lent 30–80 ms, GR 2–4 dB, New York parallel mix 50–80%) → Saturation subtilă (tape, 1–2 dB drive, adaugă armonice pare → distorsiune armonică plăcută, crește perceived loudness) → Limiter (true-peak limiting la –1 dBTP pentru streaming, attack ≤1 ms, inter-sample peak protection). LUFS: Spotify –14, Apple Music –16, YouTube –14 integrated LUFS. Diferența fastaudio vs broadcast: broadcast normalizează la –23 LUFS (EBU R128).',
      },
      en: {
        beginner:
          'Mastering is the last step before music reaches the public — the "glue" that makes a mix sound good on any audio system. You don\'t dramatically change the sound; you subtly correct, balance, and optimise the level. A typical mastering chain: dynamic EQ (fix problems) → light Compressor (glue) → Limiter (loudness maximisation). Goal: consistent sound reaching the platform\'s reference level (e.g. Spotify −14 LUFS).',
        advanced:
          'Mastering chain architecture: corrective EQ (surgical cuts, max ±3 dB) → creative EQ (warm shelving) → Compressor (2:1–4:1, slow attack 30–80 ms, GR 2–4 dB, New York parallel mix 50–80%) → subtle Saturation (tape, 1–2 dB drive, adds even harmonics → pleasant harmonic distortion, increases perceived loudness) → Limiter (true-peak limiting at −1 dBTP for streaming, attack ≤1 ms, inter-sample peak protection). LUFS targets: Spotify −14, Apple Music −16, YouTube −14 integrated LUFS. Difference fast audio vs broadcast: broadcast normalises to −23 LUFS (EBU R128).',
      },
    },
    keyPoints: {
      ro: ['Modificări subtile (max ±3 dB)', 'EQ → Compressor → Limiter', 'Parallel compression pentru "glue"', 'Limiter la –1 dBTP pentru streaming', 'LUFS = standard de volum perceput'],
      en: ['Subtle changes (max ±3 dB)', 'EQ → Compressor → Limiter', 'Parallel compression for glue', 'Limiter at –1 dBTP for streaming', 'LUFS = perceived loudness standard'],
    },
    quiz: [
      {
        q: { ro: 'Care este scopul principal al Limiterului în mastering?', en: 'What is the main purpose of the Limiter in mastering?' },
        options: {
          ro: ['Eliminarea zgomotului de fundal', 'Maximizarea volumului fără clipping', 'Adăugarea de armonice calde', 'Corectarea frecvențelor'],
          en: ['Removing background noise', 'Maximising loudness without clipping', 'Adding warm harmonics', 'Correcting frequencies'],
        },
        correct: 1,
      },
      {
        q: { ro: 'Care este targetul LUFS recomandat pentru Spotify?', en: 'What is the recommended LUFS target for Spotify?' },
        options: {
          ro: ['–6 LUFS', '–23 LUFS', '–14 LUFS', '0 LUFS'],
          en: ['–6 LUFS', '–23 LUFS', '–14 LUFS', '0 LUFS'],
        },
        correct: 2,
      },
    ],
  },
  {
    icon: '🌊',
    presetId: 'factory:lo-fi',
    title: { ro: 'Efecte de Modulare', en: 'Modulation Effects' },
    body: {
      ro: {
        beginner:
          'Efectele de modulare (Chorus, Flanger, Phaser) modifică sunetul în mod ciclic, ritmici. Toate trei folosesc un LFO (oscilator de frecvență joasă) care modifică un parametru al efectului în timp. Chorus = mai multe voci cu pitch ușor diferit = sunet "mai gros". Flanger = efect de "jet" metalic. Phaser = efect de "swoosh".',
        advanced:
          'LFO (Low-Frequency Oscillator): oscilator sinusoidal sub 20 Hz care modulează un parametru audio. Chorus: 3 delay-uri modulate independent (120° offset de fază), base delay 5–30 ms → simulează mai mulți interpreți. Flanger: 1 delay cu feedback, base delay 1–5 ms → notch-uri comb-filter care se deplasează → "jet". Phaser: cascade de all-pass filters cu Q modulat → notch-uri de fază → "swoosh". Diferența față de flanger: notch-urile de fază nu depind de delay, deci sunt mai uniforme în spectru.',
      },
      en: {
        beginner:
          'Modulation effects (Chorus, Flanger, Phaser) modify the sound cyclically, rhythmically. All three use an LFO (low-frequency oscillator) that changes an effect parameter over time. Chorus = multiple voices with slightly different pitch = "thicker" sound. Flanger = metallic "jet" sound. Phaser = "swoosh" sound.',
        advanced:
          'LFO (Low-Frequency Oscillator): sinusoidal oscillator below 20 Hz modulating an audio parameter. Chorus: 3 independently modulated delays (120° phase offset), base delay 5–30 ms → simulates multiple performers. Flanger: 1 delay with feedback, base delay 1–5 ms → moving comb-filter notches → "jet". Phaser: all-pass filter cascade with modulated Q → phase notches → "swoosh". Difference from flanger: phase notches don\'t depend on delay, so they are more uniform across the spectrum.',
      },
    },
    keyPoints: {
      ro: ['LFO Rate = viteza modulației', 'Depth = intensitatea efectului', 'Feedback adâncește efectul', 'Chorus = mai multe voci', 'Phaser ≠ Flanger: baza e all-pass, nu delay'],
      en: ['LFO Rate = modulation speed', 'Depth = effect intensity', 'Feedback deepens the effect', 'Chorus = multiple voices', 'Phaser ≠ Flanger: based on all-pass, not delay'],
    },
    quiz: [
      {
        q: { ro: 'Ce diferențiază fundamental Phaser-ul de Flanger?', en: 'What fundamentally differentiates a Phaser from a Flanger?' },
        options: {
          ro: ['Phaser folosește delay, Flanger nu', 'Phaser folosește all-pass filters, Flanger folosește delay', 'Phaser are feedback, Flanger nu', 'Nu există nicio diferență'],
          en: ['Phaser uses delay, Flanger does not', 'Phaser uses all-pass filters, Flanger uses delay', 'Phaser has feedback, Flanger does not', 'There is no difference'],
        },
        correct: 1,
      },
      {
        q: { ro: 'Ce creează Chorus-ul față de sunetul original?', en: 'What does Chorus create compared to the original sound?' },
        options: {
          ro: ['Ecouri ritmice distincte', 'Senzația de mai multe voci/instrumente simultane', 'Distorsie armonică', 'Reducere de zgomot'],
          en: ['Distinct rhythmic echoes', 'The sensation of multiple simultaneous voices/instruments', 'Harmonic distortion', 'Noise reduction'],
        },
        correct: 1,
      },
    ],
  },
  {
    icon: '🎸',
    presetId: 'factory:vintage-warmth',
    title: { ro: 'Pitch, Timp & Saturare', en: 'Pitch, Time & Saturation' },
    body: {
      ro: {
        beginner:
          'Pitch Shift modifică înălțimea unui sunet fără a schimba viteza — util pentru a transpune o voce sau un instrument în altă tonalitate. Saturarea "murdărește" sunetul intenționat, adăugând armonice calde — ca un amplificator de chitară împins la limită. Există trei tipuri: Tube (armonice pare, sunet cald), Tape (compresie și distorsie moale), Clip (distorsie digitală tăioasă). Fiecare tip de saturare are un caracter diferit și se folosește în contexte diferite.',
        advanced:
          'Pitch Shifting algoritm (Rubato/WSOLA): segmente de semnal (grains) sunt rearanjate/suprapuse cu overlap-add pentru a schimba tonalitatea fără a afecta tempo-ul — artefacte audibile la intervale mari (>±12 semitoane) din cauza limitelor coherenței de fază. Saturare: Tube = waveshaper cu caracteristică tanh (f(x) = tanh(gain·x)/tanh(gain)) — asimetric, produce f2, f4; Tape = hard clipper + LPF + ușoară compresie → caracterul "warmth" al ferrofluidului magnetizat; Clip (Hard) = max(−1, min(1, x·gain)) → spectre de armonice impare (f3, f5, f7) — distorsie "gritty". Regula: Tube pentru voce/mix-bus, Tape pentru instrumente percutante, Clip pentru efecte agresive.',
      },
      en: {
        beginner:
          'Pitch Shift changes the pitch of a sound without changing its speed — useful for transposing a voice or instrument to another key. Saturation intentionally "dirtifies" the sound, adding warm harmonics — like a guitar amplifier pushed to its limits. There are three types: Tube (even harmonics, warm sound), Tape (soft compression and distortion), Clip (sharp digital distortion). Each type has a different character and is used in different contexts.',
        advanced:
          'Pitch Shifting algorithm (Rubato/WSOLA): signal segments (grains) are rearranged/overlapped with overlap-add to change pitch without affecting tempo — audible artefacts at large intervals (>±12 semitones) due to phase coherence limits. Saturation: Tube = tanh waveshaper (f(x) = tanh(gain·x)/tanh(gain)) — asymmetric, produces f2, f4; Tape = hard clipper + LPF + slight compression → warmth character of magnetised ferrofluid; Clip (Hard) = max(−1, min(1, x·gain)) → odd harmonic spectrum (f3, f5, f7) — "gritty" distortion. Rule: Tube for voice/mix-bus, Tape for percussive instruments, Clip for aggressive effects.',
      },
    },
    keyPoints: {
      ro: ['Pitch Shift: transpose fără schimbare tempo', 'Tube = armonice pare (cald)', 'Tape = compresie + cald (organică)', 'Clip = armonice impare (agresiv)', 'Saturare < 5% = warmth; > 20% = distorsie'],
      en: ['Pitch Shift: transpose without tempo change', 'Tube = even harmonics (warm)', 'Tape = compression + warm (organic)', 'Clip = odd harmonics (aggressive)', 'Saturation < 5% = warmth; > 20% = distortion'],
    },
    quiz: [
      {
        q: { ro: 'Ce tip de saturare produce armonice impare (f3, f5, f7)?', en: 'Which saturation type produces odd harmonics (f3, f5, f7)?' },
        options: {
          ro: ['Tube (Tanh)', 'Tape', 'Clip (Hard Clip)', 'Toate produc aceleași armonice'],
          en: ['Tube (Tanh)', 'Tape', 'Clip (Hard Clip)', 'All produce the same harmonics'],
        },
        correct: 2,
      },
      {
        q: { ro: 'Pitch Shift schimbă tonalitatea fără să schimbe…', en: 'Pitch Shift changes the pitch without changing the…' },
        options: {
          ro: ['Volumul semnalului', 'Viteza/tempo-ul', 'Timbrul fundamental', 'Frecvența fundamentală'],
          en: ['Signal volume', 'Speed/tempo', 'The fundamental timbre', 'The fundamental frequency'],
        },
        correct: 1,
      },
    ],
  },
  {
    icon: '🚪',
    presetId: 'factory:vocal-cleanup',
    title: { ro: 'Procesare Dinamică Avansată', en: 'Advanced Dynamics Processing' },
    body: {
      ro: {
        beginner:
          'Pe lângă compresie, există trei procesoare dinamice mai specializate. Gate-ul (poarta de zgomot) taie complet semnalul când acesta scade sub un prag — util pentru a elimina zgomotul de fundal dintre fraze vocale sau loviturile de tobe. Expanderul face ceva similar, dar mai blând: în loc să taie brusc, scade volumul treptat. TransientShaper controlează separat "atacul" (momentul în care lovești o tobă) și "coada" sunetului — poți face tobele să sune mai "punchy" mărind atacul sau mai "open" prelungind coada.',
        advanced:
          'Gate: detectare nivel cu sidechain (RMS sau peak), histerezis (Hold+Release) pentru evitarea "chattering" la semnale fluctuante aproape de prag. Expander: raport invers față de compressor — în loc de x:1 (compresie), raportul x:1 sub prag (expansie): nivel_out = nivel_in × factor; mai fin decât gating, păstrează caracterul natural al fade-out-ului. TransientShaper: detector de atac via diferențiale RMS scurte (≤ 5 ms) față de RMS lung (≥ 100 ms) — attack gain aplicat pe segmentul ascendent al envelope-ului, sustain gain pe segmentul descendent. Spre deosebire de compressor (reacție la nivel), TransientShaper reacționează la *rată de schimbare* a nivelului. Regulă: attack ↑ = mai percutat; sustain ↑ = mai "room"; attack ↓ = mai blând, mai "soft".',
      },
      en: {
        beginner:
          'Beyond compression, there are three more specialised dynamics processors. The Gate (noise gate) cuts the signal completely when it falls below a threshold — useful for removing background noise between vocal phrases or drum hits. The Expander does something similar but gentler: instead of cutting abruptly, it gradually reduces volume. The TransientShaper controls the "attack" (the moment you hit a drum) and the "tail" of the sound separately — you can make drums sound more "punchy" by boosting the attack, or more "open" by extending the sustain.',
        advanced:
          'Gate: level detection with sidechain (RMS or peak), hysteresis (Hold+Release) to avoid "chattering" on signals fluctuating near the threshold. Expander: inverse ratio vs compressor — instead of x:1 (compression), x:1 below threshold (expansion): level_out = level_in × factor; more subtle than gating, preserves natural fade-out character. TransientShaper: attack detection via short RMS differentials (≤ 5 ms) vs long RMS (≥ 100 ms) — attack gain applied during the rising envelope segment, sustain gain during the falling segment. Unlike a compressor (reacts to level), the TransientShaper reacts to the *rate of change* of the level. Rule: attack ↑ = more percussive; sustain ↑ = more "roomy"; attack ↓ = softer, more blended.',
      },
    },
    keyPoints: {
      ro: [
        'Gate taie brusc sub prag (Threshold); Expander taie treptat',
        'Hold previne chattering la semnale care oscilează în jurul pragului',
        'TransientShaper: Attack = primele ms ale sunetului; Sustain = coada',
        'Attack ↑ = punch; Attack ↓ = blând; Sustain ↑ = spațiu',
        'Ordinea recomandată: Gate → Compressor → TransientShaper',
        'Expanderul înlocuiește gate-ul când tăierea bruscă sună artificial',
      ],
      en: [
        'Gate cuts abruptly below threshold; Expander reduces gradually',
        'Hold prevents chattering on signals oscillating near the threshold',
        'TransientShaper: Attack = first ms of sound; Sustain = tail',
        'Attack ↑ = punch; Attack ↓ = soft; Sustain ↑ = room feel',
        'Recommended order: Gate → Compressor → TransientShaper',
        'Use Expander instead of Gate when abrupt cuts sound unnatural',
      ],
    },
    quiz: [
      {
        q: { ro: 'Ce face TransientShaper față de Compressor?', en: 'What does TransientShaper do differently from a Compressor?' },
        options: {
          ro: ['Reacționează la nivel (dB), la fel ca un compressor', 'Reacționează la rata de schimbare a nivelului (atac vs. coadă)', 'Crează reverb artificial', 'Controlează pitch-ul'],
          en: ['Reacts to level (dB), same as a compressor', 'Reacts to the rate of change of the level (attack vs. tail)', 'Creates artificial reverb', 'Controls pitch'],
        },
        correct: 1,
      },
      {
        q: { ro: 'Ce problemă rezolvă parametrul Hold al unui Gate?', en: 'What problem does the Hold parameter of a Gate solve?' },
        options: {
          ro: ['Adaugă reverb la sunet', '"Chattering" — deschidere/închidere rapidă la semnale fluctuante', 'Controlează viteza de atac', 'Schimbă raportul de compresie'],
          en: ['Adds reverb to the sound', '"Chattering" — rapid open/close on fluctuating signals', 'Controls attack speed', 'Changes compression ratio'],
        },
        correct: 1,
      },
    ],
  },
  {
    icon: '🌀',
    presetId: 'factory:lo-fi',
    title: { ro: 'Modulare & Efecte Speciale', en: 'Modulation & Special Effects' },
    body: {
      ro: {
        beginner:
          'Efectele de modulare creează mișcare și textură prin varierea periodică a unui parametru. Chorus "îngroașă" sunetul creând cópii ușor dezacordate — ca și cum ar cânta mai mulți muzicieni simultan. Flanger creează un efect de "vâjâit" prin amestecul semnalului cu o copie cu delay foarte scurt care variază. Phaser mișcă în continuare fazele unor frecvențe, creând un "whoosh" rotitor. LFO-ul din sintetizator face același lucru pe cutoff-ul filtrului sau pe pitch — mișcare periodică la frecvență joasă (sub 20 Hz). Delay-ul adaugă ecouri repetitive, Reverb simulează spațiul acustic.',
        advanced:
          'Chorus: 2+ linii de delay (10–30 ms) cu LFO pe delay time → variație pitch mica (±15 ¢) → spectrul de bătăi creează "densitate" armonică. Flanger: delay time mic (1–10 ms) + feedback, LFO pe delay time → comb filter variabil (frecvențe notch care se deplasează = efect "swept comb"). Phaser: all-pass filter stages (2/4/6/8) → suma cu dry creează notch-uri la frecvențele cu defazaj 180° → LFO rotește notch-urile; nu folosește delay, ci doar schimbare de fază. LFO în sintetizator: rate < 20 Hz (audio-rate LFO = FM synthesis). Rate 0.1–1 Hz = tremolo/vibrato lent; 3–8 Hz = vibrato standard; >10 Hz = tonalitate FM. Depth controlează deviația — pe cutoff în octave (multiplicator exponențial), pe pitch în semitoane.',
      },
      en: {
        beginner:
          'Modulation effects create movement and texture by periodically varying a parameter. Chorus "thickens" the sound by creating slightly detuned copies — as if multiple musicians were playing simultaneously. Flanger creates a "swooshing" effect by mixing the signal with a very short, varying delay copy. Phaser continuously shifts the phases of certain frequencies, creating a rotating "whoosh". The LFO in the synthesiser does the same on the filter cutoff or pitch — periodic movement at low frequency (below 20 Hz). Delay adds repeating echoes, Reverb simulates acoustic space.',
        advanced:
          'Chorus: 2+ delay lines (10–30 ms) with LFO on delay time → small pitch variation (±15 ¢) → beating spectrum creates harmonic "density". Flanger: short delay time (1–10 ms) + feedback, LFO on delay time → variable comb filter (notch frequencies that sweep = "swept comb" effect). Phaser: all-pass filter stages (2/4/6/8) → sum with dry creates notches at frequencies with 180° phase shift → LFO rotates the notches; uses no delay, only phase change. Synth LFO: rate < 20 Hz (audio-rate LFO = FM synthesis). Rate 0.1–1 Hz = slow tremolo/vibrato; 3–8 Hz = standard vibrato; >10 Hz = FM-like tonality. Depth controls deviation — on cutoff in octaves (exponential multiplier), on pitch in semitones.',
      },
    },
    keyPoints: {
      ro: [
        'Chorus = delay scurt (10–30 ms) + LFO → lărgime și densitate',
        'Flanger = delay foarte scurt (1–10 ms) + feedback → comb filter variabil',
        'Phaser = all-pass stages + LFO → rotire de notch-uri (fără delay)',
        'LFO < 1 Hz = tremolo/vibrato; 3–8 Hz = vibrato standard; >10 Hz = FM',
        'Reverb = spatializare; Delay = ecouri ritmice — rol complet diferit',
        'Modulare pe sintetizator: LFO Depth > 0 activează modularea cutoff-ului',
      ],
      en: [
        'Chorus = short delay (10–30 ms) + LFO → width and density',
        'Flanger = very short delay (1–10 ms) + feedback → swept comb filter',
        'Phaser = all-pass stages + LFO → rotating notches (no delay used)',
        'LFO < 1 Hz = tremolo/vibrato; 3–8 Hz = standard vibrato; >10 Hz = FM',
        'Reverb = spatialisation; Delay = rhythmic echoes — completely different roles',
        'Synth modulation: LFO Depth > 0 activates cutoff modulation',
      ],
    },
    quiz: [
      {
        q: { ro: 'Ce gamă de frecvențe folosește un LFO tipic?', en: 'What frequency range does a typical LFO use?' },
        options: {
          ro: ['20 Hz – 20 kHz (audio)', '1 kHz – 10 kHz', 'Sub 20 Hz', 'Exact 440 Hz'],
          en: ['20 Hz – 20 kHz (audio)', '1 kHz – 10 kHz', 'Below 20 Hz', 'Exactly 440 Hz'],
        },
        correct: 2,
      },
      {
        q: { ro: 'Care efect NU folosește delay lines în implementare?', en: 'Which effect does NOT use delay lines in its implementation?' },
        options: {
          ro: ['Chorus', 'Flanger', 'Phaser', 'Echo/Delay'],
          en: ['Chorus', 'Flanger', 'Phaser', 'Echo/Delay'],
        },
        correct: 2,
      },
    ],
  },
  {
    icon: '🎹',
    title: { ro: 'Bazele Sintezei Sunetului', en: 'Sound Synthesis Basics' },
    body: {
      ro: {
        beginner:
          'Sinteza sunetului înseamnă generarea de sunete noi din nimic — spre deosebire de efectele care modifică un sunet existent. SoundLab include un sintetizator substractiv cu 8 voci simultane. Oscilatorii generează unde sonore de diferite forme — Sine (pur, blând), Saw (ascuțit, bogat în armonice), Square (hohot electric, gol la mijloc), Triangle (blând dar mai luminos decât Sine), Noise (sunet de vânt/ocean). Filtrul LP taie frecvențele înalte, lăsând să treacă cele joase — Cutoff este frecvența de tăiere, Resonance amplifică frecvențele din jurul tăieturii. Înfășurătoarea ADSR controlează cum evoluează volumul în timp: Attack = cât de rapid crește, Decay = căderea spre Sustain, Sustain = nivelul ținut cât timp apeși tasta, Release = cum dispare după ce eliberezi.',
        advanced:
          'Sinteza substractivă: se pornește de la un semnal bogat în armonice (Saw, Square) și se sculptează cu filtre și înfășurători. Oscilator dual cu detuning (±50 ¢) creează bătăi de frecvență (chorus natural). SVF (State Variable Filter) implementat în Rust/WASM: modul LP/BP/HP comutabil, rezistență la aliasing la cutoff înaltă. LFO → Cutoff: modulare periodică (vibrato spectral). Voce polifonică 8-slot cu furt de voce prin vârstă (oldest-first). Arpegiorul implementat în frontend cu timer JavaScript — precizie suficientă la ≤ 16simi, nu audio-rate. Chord mode: 8 tipuri de acorduri (M, m, 7, M7, m7, sus4, dim, aug) cu declanșare simultană multi-voice. Pitch Bend: multiplicator de frecvență 2^(semitone/12), ±2 semitoane implicit.',
      },
      en: {
        beginner:
          'Sound synthesis means generating new sounds from nothing — unlike effects which modify an existing sound. SoundLab includes a subtractive synthesiser with 8 simultaneous voices. Oscillators generate waveforms of different shapes — Sine (pure, gentle), Saw (sharp, rich in harmonics), Square (hollow electric buzz), Triangle (gentler but brighter than Sine), Noise (wind/ocean sound). The LP filter cuts high frequencies, letting lows through — Cutoff is the cut frequency, Resonance amplifies frequencies around the cut. The ADSR envelope controls how volume evolves over time: Attack = how quickly it rises, Decay = fall toward Sustain, Sustain = held level while the key is pressed, Release = how it fades after you release.',
        advanced:
          'Subtractive synthesis: starts from a harmonically rich signal (Saw, Square) and sculpts it with filters and envelopes. Dual oscillator with detuning (±50 ¢) creates frequency beating (natural chorus). SVF (State Variable Filter) implemented in Rust/WASM: switchable LP/BP/HP mode, aliasing-resistant at high cutoff. LFO → Cutoff: periodic spectral modulation (filter vibrato). 8-slot polyphony with oldest-first voice stealing. Arpeggiator implemented in frontend via JavaScript timer — sufficient precision at ≤ 16th notes, not audio-rate. Chord mode: 8 chord types (M, m, 7, M7, m7, sus4, dim, aug) with simultaneous multi-voice triggering. Pitch Bend: frequency multiplier 2^(semitone/12), ±2 semitones default.',
      },
    },
    keyPoints: {
      ro: [
        'Sine = frecvență pură; Saw = toate armonicele; Square = armonice impare',
        'Filter Cutoff = frecvența de tăiere; Resonance = vârf rezonant',
        'ADSR: Attack → Decay → Sustain (nivel) → Release',
        'LFO modulează cutoff-ul periodic (vibrato/wah)',
        'Arpegiatorul parcurge notele ținute în buclă la BPM ales',
        'Chord mode declanșează simultan toate notele acordului',
      ],
      en: [
        'Sine = pure frequency; Saw = all harmonics; Square = odd harmonics only',
        'Filter Cutoff = cut frequency; Resonance = resonant peak',
        'ADSR: Attack → Decay → Sustain (level) → Release',
        'LFO modulates cutoff periodically (vibrato/wah effect)',
        'Arpeggiator loops through held notes at chosen BPM',
        'Chord mode triggers all chord notes simultaneously',
      ],
    },
    quiz: [
      {
        q: { ro: 'Care formă de undă conține TOATE armonicele (pare și impare)?', en: 'Which waveform contains ALL harmonics (even and odd)?' },
        options: {
          ro: ['Sine (Sinusoidă)', 'Square (Pătrat)', 'Saw (Ferăstrău)', 'Triangle (Triunghi)'],
          en: ['Sine', 'Square', 'Saw (Sawtooth)', 'Triangle'],
        },
        correct: 2,
      },
      {
        q: { ro: 'Ce parametru ADSR controlează cât timp durează sunetul după ce eliberezi tasta?', en: 'Which ADSR parameter controls how long the sound lasts after you release the key?' },
        options: {
          ro: ['Attack', 'Decay', 'Sustain', 'Release'],
          en: ['Attack', 'Decay', 'Sustain', 'Release'],
        },
        correct: 3,
      },
    ],
  },
]

export function LessonsPanel() {
  const language          = useEducationStore((s) => s.language)
  const mode              = useEducationStore((s) => s.mode)
  const completedLessons  = useEducationStore((s) => s.completedLessons)
  const markComplete      = useEducationStore((s) => s.markLessonComplete)
  const addEffect         = useEffectsStore((s) => s.addEffect)
  const setParam          = useEffectsStore((s) => s.setParam)
  const setBypass         = useEffectsStore((s) => s.setBypass)
  const clearChain        = useEffectsStore((s) => s.clear)
  const setActivePreset   = usePresetStore((s) => s.setActivePresetId)
  const [active, setActive] = useState(0)
  const [presetError, setPresetError] = useState<string | null>(null)
  // Quiz state: reset whenever the active lesson changes
  const [quizAnswers, setQuizAnswers] = useState<(number | null)[]>([])
  const [quizSubmitted, setQuizSubmitted] = useState(false)

  // Reset quiz when switching lesson
  useEffect(() => {
    const lesson = LESSONS[active]
    setQuizAnswers(new Array(lesson?.quiz?.length ?? 0).fill(null))
    setQuizSubmitted(false)
  }, [active])

  // Auto-mark a lesson as read after viewing it for 2 seconds
  useEffect(() => {
    const t = setTimeout(() => markComplete(active), 2000)
    return () => clearTimeout(t)
  }, [active, markComplete])

  const lesson = LESSONS[active]!

  const ro = language === 'ro'
  const titleLabel  = ro ? 'Lecții de audio' : 'Audio lessons'
  const pointsLabel = ro ? 'Puncte cheie' : 'Key points'
  const doneCount   = completedLessons.length
  const progressLabel = ro
    ? `${doneCount} din ${LESSONS.length} parcurse`
    : `${doneCount} of ${LESSONS.length} completed`
  const tryLabel    = ro ? 'Încarcă preset exemplu' : 'Load example preset'
  const tryErrorMsg = ro
    ? 'Pornește engine-ul mai întâi (drag un fișier audio sau Synth Lab).'
    : 'Start the engine first (drag an audio file or use Synth Lab).'

  function handleLoadPreset() {
    if (!lesson.presetId) return
    setPresetError(null)
    if (getStatus().status !== 'running') {
      setPresetError(tryErrorMsg)
      return
    }
    const preset = FACTORY_PRESETS.find((p) => p.id === lesson.presetId)
    if (!preset) return
    clearChain()
    for (const pe of preset.effects) {
      const instance = addEffect(pe.type)
      for (const [rawId, value] of Object.entries(pe.params)) {
        setParam(instance.id, Number(rawId), value)
      }
      if (pe.bypassed) setBypass(instance.id, true)
    }
    setActivePreset(preset.id)
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          {titleLabel}
        </h2>
        <span className="text-[10px] text-zinc-500">{progressLabel}</span>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-purple-500 transition-all duration-500"
          style={{ width: `${(doneCount / LESSONS.length) * 100}%` }}
        />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
        {LESSONS.map((l, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${
              active === i
                ? 'bg-purple-600/30 text-purple-200 ring-1 ring-purple-500/40'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
            }`}
          >
            <span>{l.icon}</span>
            <span>{l.title[language]}</span>
            {completedLessons.includes(i) && (
              <span className="ml-0.5 text-emerald-400">✓</span>
            )}
          </button>
        ))}
      </div>

      {/* Lesson content */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{lesson.icon}</span>
            <h3 className="text-base font-semibold text-zinc-100">
              {lesson.title[language]}
            </h3>
          </div>
          {lesson.presetId && (
            <button
              onClick={handleLoadPreset}
              title={tryLabel}
              className="shrink-0 rounded-md border border-purple-500/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-purple-400 transition hover:border-purple-500/60 hover:bg-purple-500/10 hover:text-purple-300"
            >
              {tryLabel}
            </button>
          )}
        </div>
        {presetError && (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
            {presetError}
          </p>
        )}

        <p className="text-sm leading-relaxed text-zinc-400">
          {lesson.body[language][mode]}
        </p>

        <div className="rounded-lg bg-zinc-800/60 p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            {pointsLabel}
          </p>
          <ul className="space-y-1">
            {lesson.keyPoints[language].map((point, i) => (
              <li key={i} className="flex items-start gap-2 text-[12px] text-zinc-300">
                <span className="mt-0.5 text-purple-400">▸</span>
                {point}
              </li>
            ))}
          </ul>
        </div>

        {/* Quiz */}
        {lesson.quiz && lesson.quiz.length > 0 && (
          <QuizBlock
            quiz={lesson.quiz}
            language={language}
            answers={quizAnswers}
            submitted={quizSubmitted}
            onAnswer={(qi, oi) => {
              if (quizSubmitted) return
              setQuizAnswers((prev) => { const next = [...prev]; next[qi] = oi; return next })
            }}
            onSubmit={() => setQuizSubmitted(true)}
            onRetry={() => {
              setQuizAnswers(new Array(lesson.quiz!.length).fill(null))
              setQuizSubmitted(false)
            }}
          />
        )}
      </div>
    </section>
  )
}

// ─── Quiz sub-component ───────────────────────────────────────────────────────

interface QuizBlockProps {
  quiz: QuizQuestion[]
  language: 'ro' | 'en'
  answers: (number | null)[]
  submitted: boolean
  onAnswer: (qi: number, oi: number) => void
  onSubmit: () => void
  onRetry: () => void
}

function QuizBlock({ quiz, language, answers, submitted, onAnswer, onSubmit, onRetry }: QuizBlockProps) {
  const ro = language === 'ro'
  const allAnswered = answers.every((a) => a !== null)
  const score = submitted ? answers.filter((a, i) => a === quiz[i]!.correct).length : 0
  const passed = score === quiz.length

  return (
    <div className="rounded-lg border border-zinc-700/60 bg-zinc-800/40 p-3 space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {ro ? 'Quiz rapid' : 'Quick quiz'}
      </p>

      {quiz.map((q, qi) => {
        const chosen = answers[qi] ?? null
        const isCorrect = submitted && chosen === q.correct
        const isWrong   = submitted && chosen !== null && chosen !== q.correct
        return (
          <div key={qi} className="space-y-1.5">
            <p className="text-[12px] font-medium text-zinc-200">{q.q[language]}</p>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {q.options[language].map((opt, oi) => {
                const isSelected = chosen === oi
                const showCorrect = submitted && oi === q.correct
                const showWrong   = submitted && isSelected && !showCorrect
                return (
                  <button
                    key={oi}
                    disabled={submitted}
                    onClick={() => onAnswer(qi, oi)}
                    className={`rounded-md px-2.5 py-1.5 text-left text-[11px] transition ${
                      showCorrect
                        ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                        : showWrong
                        ? 'bg-red-500/20 text-red-300 ring-1 ring-red-500/40'
                        : isSelected
                        ? 'bg-purple-500/20 text-purple-200 ring-1 ring-purple-500/40'
                        : 'bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    {showCorrect && '✓ '}{showWrong && '✗ '}{opt}
                  </button>
                )
              })}
            </div>
            {submitted && isWrong && (
              <p className="text-[10px] text-emerald-400">
                {ro ? `Răspuns corect: ${q.options[language][q.correct]}` : `Correct answer: ${q.options[language][q.correct]}`}
              </p>
            )}
          </div>
        )
      })}

      {!submitted ? (
        <button
          disabled={!allAnswered}
          onClick={onSubmit}
          className="w-full rounded-md bg-purple-600 py-1.5 text-[11px] font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {ro ? 'Verifică răspunsurile' : 'Check answers'}
        </button>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p className={`text-[11px] font-semibold ${passed ? 'text-emerald-400' : 'text-amber-400'}`}>
            {passed
              ? (ro ? `${score}/${quiz.length} — Excelent!` : `${score}/${quiz.length} — Excellent!`)
              : (ro ? `${score}/${quiz.length} — Mai încearcă` : `${score}/${quiz.length} — Try again`)}
          </p>
          <button
            onClick={onRetry}
            className="rounded-md border border-zinc-600 px-2.5 py-1 text-[10px] text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
          >
            {ro ? 'Încearcă din nou' : 'Retry'}
          </button>
        </div>
      )}
    </div>
  )
}
