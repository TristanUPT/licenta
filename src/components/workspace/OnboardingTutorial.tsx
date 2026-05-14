import { useState, useEffect } from 'react'
import { useEducationStore } from '@/store/educationStore'

const STORAGE_KEY = 'soundlab-onboarding-done'

// ─── Step definitions ─────────────────────────────────────────────────────────

interface Step {
  icon: string
  title: { ro: string; en: string }
  body: { ro: string; en: string }
  tip?: { ro: string; en: string }
}

const STEPS: Step[] = [
  {
    icon: '🎛️',
    title: { ro: 'Bun venit în SoundLab!', en: 'Welcome to SoundLab!' },
    body: {
      ro: 'SoundLab este un mini-DAW educațional — procesează audio în timp real direct în browser, folosind un motor DSP scris în Rust/WebAssembly.',
      en: 'SoundLab is an educational mini-DAW — processes audio in real-time directly in the browser, using a DSP engine written in Rust/WebAssembly.',
    },
    tip: {
      ro: 'Tutorialul durează ~1 minut. Poți sări oricând.',
      en: 'The tutorial takes ~1 minute. You can skip at any time.',
    },
  },
  {
    icon: '📂',
    title: { ro: 'Încarcă un fișier audio', en: 'Load an audio file' },
    body: {
      ro: 'Trage un fișier WAV, MP3 sau FLAC în zona centrală, sau apasă pentru a-l selecta. Nu ai un fișier la îndemână? Folosește unul din sample-urile demo din pagina principală.',
      en: 'Drag a WAV, MP3, or FLAC file into the main area, or click to select it. No file handy? Use one of the demo samples on the main page.',
    },
    tip: {
      ro: 'Fișierul este decodat local — nu se încarcă nicăieri pe internet.',
      en: 'The file is decoded locally — nothing is uploaded to the internet.',
    },
  },
  {
    icon: '🎚️',
    title: { ro: 'Adaugă efecte DSP', en: 'Add DSP effects' },
    body: {
      ro: 'Apasă "+ Add effect" din secțiunea Effects Chain și alege un efect. Poți adăuga oricâte efecte și le poți reordona prin drag & drop de pe simbolul ⠿.',
      en: 'Click "+ Add effect" in the Effects Chain section and choose an effect. You can add as many as you like and reorder them by dragging the ⠿ handle.',
    },
    tip: {
      ro: 'Fiecare knob are un tooltip educațional — ține mouse-ul deasupra lui.',
      en: 'Every knob has an educational tooltip — hover over it to read.',
    },
  },
  {
    icon: '▶️',
    title: { ro: 'Transport și loop', en: 'Transport & loop' },
    body: {
      ro: 'Folosește bara de transport din josul ecranului pentru play/stop. Activează butonul Loop 🔁, apoi trage pe waveform pentru a selecta o regiune. Poți folosi și tastele: Space = play/pause, L = loop, I/O = set in/out.',
      en: 'Use the transport bar at the bottom for play/stop. Enable the Loop 🔁 button, then drag on the waveform to select a region. You can also use keys: Space = play/pause, L = loop, I/O = set in/out.',
    },
    tip: {
      ro: 'Apasă B oricând pentru a compara semnalul procesat cu originalul (A/B).',
      en: 'Press B at any time to compare the processed signal with the original (A/B).',
    },
  },
  {
    icon: '📊',
    title: { ro: 'Vizualizări și feedback', en: 'Visualizations & feedback' },
    body: {
      ro: 'Panoul de vizualizări arată spectrul și spectrograma în timp real. Secțiunea "Feedback contextual" analizează lanțul tău de efecte și oferă sugestii bazate pe valorile parametrilor.',
      en: 'The visualizer panel shows the spectrum and spectrogram in real-time. The "Contextual feedback" section analyzes your effect chain and offers parameter-based suggestions.',
    },
    tip: {
      ro: 'Comută între modul Beginner și Advanced în header pentru explicații tehnice.',
      en: 'Switch between Beginner and Advanced mode in the header for technical explanations.',
    },
  },
  {
    icon: '💾',
    title: { ro: 'Preseturi și export', en: 'Presets & export' },
    body: {
      ro: 'Salvează lanțul tău de efecte ca preset personalizat prin butonul "Presets" din secțiunea Effects Chain. Când ești mulțumit de sunet, exportă rezultatul ca fișier WAV cu butonul WAV din transport bar.',
      en: 'Save your effect chain as a custom preset via the "Presets" button in the Effects Chain section. When happy with the sound, export the result as a WAV file using the WAV button in the transport bar.',
    },
    tip: {
      ro: 'Exportul procesează offline — nu folosește playback-ul în timp real.',
      en: 'Export processes offline — it does not use the real-time playback.',
    },
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function OnboardingTutorial() {
  const language = useEducationStore((s) => s.language)
  const [open, setOpen]   = useState(false)
  const [step, setStep]   = useState(0)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setOpen(true)
  }, [])

  function finish() {
    localStorage.setItem(STORAGE_KEY, '1')
    setOpen(false)
  }

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1)
    else finish()
  }

  function back() {
    if (step > 0) setStep(step - 1)
  }

  if (!open) return null

  const s      = STEPS[step]!
  const isLast = step === STEPS.length - 1

  const nextLabel = isLast
    ? (language === 'ro' ? 'Hai să începem!' : "Let's start!")
    : (language === 'ro' ? 'Înainte' : 'Next')
  const backLabel = language === 'ro' ? 'Înapoi' : 'Back'
  const skipLabel = language === 'ro' ? 'Sari tutorialul' : 'Skip tutorial'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={finish}
        aria-hidden
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal
        aria-label={s.title[language]}
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl"
      >
        {/* Step indicator */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step
                    ? 'w-6 bg-purple-500'
                    : i < step
                    ? 'w-1.5 bg-purple-500/40'
                    : 'w-1.5 bg-zinc-700'
                }`}
              />
            ))}
          </div>
          <button
            onClick={finish}
            className="text-xs text-zinc-600 transition hover:text-zinc-400"
          >
            {skipLabel}
          </button>
        </div>

        {/* Content */}
        <div className="mb-6 text-center">
          <div className="mb-3 text-5xl">{s.icon}</div>
          <h2 className="mb-2 text-lg font-bold text-zinc-100">
            {s.title[language]}
          </h2>
          <p className="text-sm leading-relaxed text-zinc-400">
            {s.body[language]}
          </p>
          {s.tip && (
            <p className="mt-3 rounded-lg bg-purple-500/10 px-3 py-2 text-xs text-purple-300">
              💡 {s.tip[language]}
            </p>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-2">
          {step > 0 && (
            <button
              onClick={back}
              className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
            >
              {backLabel}
            </button>
          )}
          <button
            onClick={next}
            className="flex-1 rounded-lg bg-purple-600 py-2 text-sm font-semibold text-white transition hover:bg-purple-500"
          >
            {nextLabel}
          </button>
        </div>

        {/* Step counter */}
        <p className="mt-3 text-center text-[10px] text-zinc-600">
          {step + 1} / {STEPS.length}
        </p>
      </div>
    </>
  )
}
