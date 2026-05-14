import { useEffect, useState } from 'react'
import { useEducationStore } from '@/store/educationStore'

interface LessonContent {
  title: { ro: string; en: string }
  icon: string
  body: {
    ro: { beginner: string; advanced: string }
    en: { beginner: string; advanced: string }
  }
  keyPoints: {
    ro: string[]
    en: string[]
  }
}

const LESSONS: LessonContent[] = [
  {
    icon: '⛓️',
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
  },
  {
    icon: '📊',
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
  },
  {
    icon: '🎛️',
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
  },
  {
    icon: '🏛️',
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
  },
  {
    icon: '🌊',
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
  },
]

export function LessonsPanel() {
  const language          = useEducationStore((s) => s.language)
  const mode              = useEducationStore((s) => s.mode)
  const completedLessons  = useEducationStore((s) => s.completedLessons)
  const markComplete      = useEducationStore((s) => s.markLessonComplete)
  const [active, setActive] = useState(0)

  // Auto-mark a lesson as read after viewing it for 2 seconds
  useEffect(() => {
    const t = setTimeout(() => markComplete(active), 2000)
    return () => clearTimeout(t)
  }, [active, markComplete])

  const lesson = LESSONS[active]!

  const titleLabel  = language === 'ro' ? 'Lecții de audio' : 'Audio lessons'
  const pointsLabel = language === 'ro' ? 'Puncte cheie' : 'Key points'
  const doneCount   = completedLessons.length
  const progressLabel = language === 'ro'
    ? `${doneCount} din ${LESSONS.length} parcurse`
    : `${doneCount} of ${LESSONS.length} completed`

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
      <div className="flex flex-wrap gap-1">
        {LESSONS.map((l, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${
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
        <div className="flex items-center gap-2">
          <span className="text-2xl">{lesson.icon}</span>
          <h3 className="text-base font-semibold text-zinc-100">
            {lesson.title[language]}
          </h3>
        </div>

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
      </div>
    </section>
  )
}
