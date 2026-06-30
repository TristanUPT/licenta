import { useState, useEffect, useCallback, useRef } from 'react'
import { useEducationStore } from '@/store/educationStore'

const STORAGE_KEY = 'resolab-onboarding-done'

type Side = 'below' | 'left' | 'above' | 'right'

interface Step {
  icon: string
  title: { ro: string; en: string }
  body: { ro: string; en: string }
  tip?: { ro: string; en: string }
  target?: string
  side?: Side
}

const STEPS: Step[] = [
  {
    icon: '🎛️',
    title: { ro: 'Bun venit în ResoLab!', en: 'Welcome to ResoLab!' },
    body: {
      ro: 'ResoLab este un mini-DAW educațional — procesează audio în timp real direct în browser, folosind un motor DSP scris în Rust/WebAssembly.',
      en: 'ResoLab is an educational mini-DAW — processes audio in real-time directly in the browser, using a DSP engine written in Rust/WebAssembly.',
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
    target: 'dropzone',
    side: 'below',
  },
  {
    icon: '🎚️',
    title: { ro: 'Adaugă efecte DSP', en: 'Add DSP effects' },
    body: {
      ro: 'Apasă "+ Adaugă efect" din secțiunea Lanț de efecte și alege un efect. Poți adăuga oricâte efecte și le poți reordona prin drag & drop de pe simbolul ⠿. Ctrl+Z anulează orice modificare.',
      en: 'Click "+ Add effect" in the Effects Chain section and choose an effect. You can add as many as you like and reorder them by dragging the ⠿ handle. Ctrl+Z undoes any change.',
    },
    tip: {
      ro: 'Fiecare knob are un tooltip educațional — ține mouse-ul deasupra lui.',
      en: 'Every knob has an educational tooltip — hover over it to read.',
    },
    target: 'add-effect',
    side: 'left',
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
    target: 'transport',
    side: 'above',
  },
  {
    icon: '📊',
    title: { ro: 'Vizualizări și feedback', en: 'Visualizations & feedback' },
    body: {
      ro: 'Panoul de vizualizări arată spectrul și spectrograma în timp real. Secțiunea "Sfaturi efecte" analizează lanțul tău de efecte și oferă observații bazate pe valorile parametrilor. "Sugestii semnal" îți propune efecte noi bazat pe analiza spectrală.',
      en: 'The visualizer panel shows the spectrum and spectrogram in real-time. The "Effect Tips" section analyzes your effect chain and offers parameter-based observations. "Signal Suggestions" recommends new effects based on spectral analysis.',
    },
    tip: {
      ro: 'Comută între modul Beginner și Advanced în header pentru explicații tehnice.',
      en: 'Switch between Beginner and Advanced mode in the header for technical explanations.',
    },
    target: 'visualizer',
    side: 'left',
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
    target: 'presets',
    side: 'left',
  },
]

const GAP = 12
const TOOLTIP_W = 210
const SPOT_PAD = 6

interface Rect { x: number; y: number; w: number; h: number }

function getTargetRect(selector: string): Rect | null {
  const el = document.querySelector(`[data-tour="${selector}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.left, y: r.top, w: r.width, h: r.height }
}

function computeTooltipPos(spot: Rect, side: Side, tipH: number): { left: number; top: number } {
  switch (side) {
    case 'below':
      return {
        left: Math.max(8, Math.min(spot.x + spot.w / 2 - TOOLTIP_W / 2, window.innerWidth - TOOLTIP_W - 8)),
        top: spot.y + spot.h + SPOT_PAD + GAP,
      }
    case 'above':
      return {
        left: Math.max(8, Math.min(spot.x + spot.w / 2 - TOOLTIP_W / 2, window.innerWidth - TOOLTIP_W - 8)),
        top: spot.y - SPOT_PAD - GAP - tipH,
      }
    case 'left':
      return {
        left: Math.max(8, spot.x - SPOT_PAD - GAP - TOOLTIP_W),
        top: Math.max(8, Math.min(spot.y + spot.h / 2 - tipH / 2, window.innerHeight - tipH - 8)),
      }
    case 'right':
      return {
        left: Math.min(window.innerWidth - TOOLTIP_W - 8, spot.x + spot.w + SPOT_PAD + GAP),
        top: Math.max(8, Math.min(spot.y + spot.h / 2 - tipH / 2, window.innerHeight - tipH - 8)),
      }
  }
}

export function OnboardingTutorial() {
  const language = useEducationStore((s) => s.language)
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [spot, setSpot] = useState<Rect | null>(null)
  const [tipPos, setTipPos] = useState<{ left: number; top: number } | null>(null)
  const tipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setOpen(true)
  }, [])

  const measure = useCallback(() => {
    const s = STEPS[step]!
    if (!s.target) {
      setSpot(null)
      setTipPos(null)
      return
    }
    const rect = getTargetRect(s.target)
    setSpot(rect)
    if (rect && s.side) {
      const tipH = tipRef.current?.offsetHeight ?? 300
      setTipPos(computeTooltipPos(rect, s.side, tipH))
    }
  }, [step])

  useEffect(() => {
    if (!open) return
    measure()
    const id = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener('resize', measure)
    }
  }, [open, measure])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') finish()
      else if (e.key === 'ArrowRight') setStep((s) => (s < STEPS.length - 1 ? s + 1 : s))
      else if (e.key === 'ArrowLeft') setStep((s) => (s > 0 ? s - 1 : 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

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

  const s = STEPS[step]!
  const ro = language === 'ro'
  const isLast = step === STEPS.length - 1
  const isFirst = step === 0

  const nextLabel = isFirst
    ? (ro ? 'Hai să începem!' : "Let's start!")
    : isLast
      ? (ro ? 'Gata!' : 'Done!')
      : (ro ? 'Înainte' : 'Next')
  const backLabel = ro ? 'Înapoi' : 'Back'
  const skipLabel = ro ? 'Sari tutorialul' : 'Skip'
  const stepLabel = ro ? `Pas ${step + 1} din ${STEPS.length}` : `Step ${step + 1} of ${STEPS.length}`

  const hasCutout = spot !== null

  const clipPath = hasCutout
    ? `polygon(
        0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
        ${spot.x - SPOT_PAD}px ${spot.y - SPOT_PAD}px,
        ${spot.x - SPOT_PAD}px ${spot.y + spot.h + SPOT_PAD}px,
        ${spot.x + spot.w + SPOT_PAD}px ${spot.y + spot.h + SPOT_PAD}px,
        ${spot.x + spot.w + SPOT_PAD}px ${spot.y - SPOT_PAD}px,
        ${spot.x - SPOT_PAD}px ${spot.y - SPOT_PAD}px
      )`
    : undefined

  const tooltipStyle: React.CSSProperties = tipPos && hasCutout
    ? { left: tipPos.left, top: tipPos.top, width: TOOLTIP_W }
    : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: TOOLTIP_W }

  return (
    <>
      {/* Overlay with cutout */}
      <div
        className="fixed inset-0 z-[60]"
        style={{
          backgroundColor: 'rgba(0,0,0,0.65)',
          clipPath,
        }}
        onClick={finish}
        aria-hidden
      />

      {/* Spotlight ring */}
      {hasCutout && (
        <div
          className="pointer-events-none fixed z-[60]"
          style={{
            left: spot.x - SPOT_PAD,
            top: spot.y - SPOT_PAD,
            width: spot.w + SPOT_PAD * 2,
            height: spot.h + SPOT_PAD * 2,
            borderRadius: 8,
            boxShadow: '0 0 0 2px rgba(124,58,237,0.5), 0 0 20px 4px rgba(124,58,237,0.15)',
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tipRef}
        role="dialog"
        aria-modal
        aria-label={s.title[language]}
        className="fixed z-[61]"
        style={tooltipStyle}
      >
        <div
          style={{
            background: 'var(--tooltip-bg)',
            border: '1px solid var(--tooltip-border)',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          {/* Header: step indicator + skip */}
          <div
            style={{ padding: '10px 15px 0 15px' }}
            className="flex items-center justify-between"
          >
            <span style={{ fontSize: 10, color: 'var(--step-label)', fontWeight: 600 }}>
              {stepLabel}
            </span>
            <button
              onClick={finish}
              style={{ fontSize: 10, color: 'var(--step-label)', background: 'none', border: 'none', cursor: 'pointer' }}
              className="transition hover:text-zinc-300"
            >
              {skipLabel}
            </button>
          </div>

          {/* Content */}
          <div style={{ padding: '10px 15px 12px 15px' }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{s.icon}</div>
            <h2 style={{ fontSize: 13, fontWeight: 500, color: 'var(--tooltip-title)', marginBottom: 6, lineHeight: 1.3 }}>
              {s.title[language]}
            </h2>
            <p style={{ fontSize: 11.5, color: 'var(--tooltip-body)', lineHeight: 1.65, margin: 0 }}>
              {s.body[language]}
            </p>
            {s.tip && (
              <div
                style={{
                  marginTop: 8,
                  background: 'var(--tip-section-bg)',
                  borderRadius: 6,
                  padding: '6px 10px',
                  fontSize: 11,
                  color: 'var(--tip-text)',
                  lineHeight: 1.5,
                }}
              >
                💡 {s.tip[language]}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              borderTop: '1px solid var(--tooltip-divider)',
              padding: '10px 15px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            {/* Dots */}
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  style={{
                    display: 'block',
                    height: 5,
                    borderRadius: i === step ? 3 : '50%',
                    width: i === step ? 14 : 5,
                    background: i === step ? 'var(--accent)' : i < step ? 'rgba(124,58,237,0.4)' : 'var(--dot-inactive)',
                    transition: 'width 200ms, border-radius 200ms',
                  }}
                />
              ))}
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 6 }}>
              {step > 0 && (
                <button
                  onClick={back}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--dot-inactive)',
                    borderRadius: 7,
                    padding: '5px 12px',
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                  className="transition hover:border-zinc-600 hover:text-zinc-300"
                >
                  {backLabel}
                </button>
              )}
              <button
                onClick={next}
                style={{
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: 7,
                  padding: '5px 12px',
                  fontSize: 11,
                  color: '#fff',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
                className="transition hover:brightness-110"
              >
                {nextLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
