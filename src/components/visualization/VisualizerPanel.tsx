import { useState } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { SpectrumAnalyzer } from './SpectrumAnalyzer'
import { Spectrogram } from './Spectrogram'
import { SpectrumCompare } from './SpectrumCompare'
import { Oscilloscope } from './Oscilloscope'
import { useEducationStore } from '@/store/educationStore'

type Tab = 'spectrum' | 'spectrogram' | 'oscilloscope' | 'compare'

const TAB_LABELS: Record<Tab, { ro: string; en: string }> = {
  spectrum:     { ro: 'Spectru',       en: 'Spectrum'     },
  spectrogram:  { ro: 'Spectrogram',   en: 'Spectrogram'  },
  oscilloscope: { ro: 'Osciloscop',    en: 'Oscilloscope' },
  compare:      { ro: 'Compară',       en: 'Compare'      },
}

const TAB_DESC: Record<Tab, { ro: string; en: string }> = {
  spectrum: {
    ro: 'Puterea semnalului per frecvență în timp real — înalt în stânga, joase în dreapta.',
    en: 'Real-time signal power per frequency band — highs on the right, lows on the left.',
  },
  spectrogram: {
    ro: 'Evoluția spectrului în timp — axa Y = frecvență (log), axa X = timp, culoare = amplitudine.',
    en: 'Spectrum over time — Y = frequency (log scale), X = time, colour = amplitude.',
  },
  oscilloscope: {
    ro: 'Forma de undă în domeniul timp — arată amplitudinea semnalului per eșantion, trigger pe trecerea prin zero.',
    en: 'Time-domain waveform — shows signal amplitude per sample, zero-crossing trigger for stability.',
  },
  compare: {
    ro: 'Îngheață spectrul curent (cyan) și compară-l cu semnalul live (violet) — util pentru A/B parametri.',
    en: 'Freeze the current spectrum (cyan) and compare with the live signal (purple) — useful for A/B parameter changes.',
  },
}

const TABS: Tab[] = ['spectrum', 'spectrogram', 'oscilloscope', 'compare']

export function VisualizerPanel() {
  const [tab, setTab] = useState<Tab>('spectrum')
  const language = useEducationStore((s) => s.language)

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-2">
      {/* Tab bar */}
      <Tooltip.Provider delayDuration={400} skipDelayDuration={100}>
        <div className="mb-2 flex items-center gap-0.5 overflow-x-auto px-1" style={{ scrollbarWidth: 'none' }}>
          {TABS.map((t) => (
            <Tooltip.Root key={t}>
              <Tooltip.Trigger asChild>
                <button
                  onClick={() => setTab(t)}
                  className={`shrink-0 rounded-md px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition ${
                    tab === t
                      ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                      : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'
                  }`}
                >
                  {TAB_LABELS[t][language]}
                  {tab === t && (
                    <span className="ml-1.5 inline-block h-1 w-1 rounded-full bg-purple-400 align-middle" />
                  )}
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  side="bottom"
                  sideOffset={6}
                  className="z-50 max-w-[220px] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-[11px] leading-relaxed text-zinc-300 shadow-xl"
                >
                  {TAB_DESC[t][language]}
                  <Tooltip.Arrow className="fill-zinc-700" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          ))}
        </div>
      </Tooltip.Provider>

      {/* Active visualization */}
      {tab === 'spectrum'     && <SpectrumAnalyzer />}
      {tab === 'spectrogram'  && <Spectrogram />}
      {tab === 'oscilloscope' && <Oscilloscope />}
      {tab === 'compare'      && <SpectrumCompare />}
    </div>
  )
}
