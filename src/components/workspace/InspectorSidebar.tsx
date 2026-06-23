import { useAudioStore } from '@/store/audioStore'
import { useAnalysisStore } from '@/store/analysisStore'
import { useEducationStore } from '@/store/educationStore'
import { useUiStore } from '@/store/uiStore'
import { LevelMeter } from '@/components/visualization/LevelMeter'
import { InfoPanel } from '@/components/education/InfoPanel'
import { RecommendationsPanel } from '@/components/education/RecommendationsPanel'
import { LessonsPanel } from '@/components/education/LessonsPanel'
import { VisualizerPanel } from '@/components/visualization/VisualizerPanel'

function toDbfs(lin: number): string {
  if (lin <= 0) return '-∞'
  return (20 * Math.log10(lin)).toFixed(1)
}

export function InspectorSidebar() {
  const currentFile    = useAudioStore((s) => s.currentFile)
  const integratedLufs = useAudioStore((s) => s.integratedLufs)
  const masterPeak     = useAnalysisStore((s) => s.masterPeak)
  const masterRms      = useAnalysisStore((s) => s.masterRms)
  const clipped        = useAnalysisStore((s) => s.clipped)
  const clearClip      = useAnalysisStore((s) => s.clearClip)
  const language       = useEducationStore((s) => s.language)

  const showVisualizer = useUiStore((s) => s.showVisualizer)
  const showEducation  = useUiStore((s) => s.showEducation)
  const showLessons    = useUiStore((s) => s.showLessons)

  const hasEducation = showVisualizer || showEducation || showLessons

  return (
    <aside data-tour="visualizer" className="flex h-full w-56 shrink-0 flex-col border-l border-zinc-800 bg-zinc-950">
      {/* Inspector */}
      <div className="shrink-0 border-b border-zinc-800 p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          Inspector
        </p>

        {currentFile ? (
          <div className="space-y-2">
            <p className="truncate text-[11px] font-medium text-zinc-200" title={currentFile.name}>
              {currentFile.name}
            </p>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
              <div>
                <p className="text-[9px] uppercase tracking-wider text-zinc-700">Rate</p>
                <p className="font-mono text-[10px] text-zinc-400">{(currentFile.sampleRate / 1000).toFixed(1)} kHz</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-zinc-700">Ch</p>
                <p className="font-mono text-[10px] text-zinc-400">{currentFile.numberOfChannels === 1 ? 'Mono' : 'Stereo'}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-zinc-700">Dur</p>
                <p className="font-mono text-[10px] text-zinc-400">{currentFile.duration.toFixed(1)}s</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-zinc-700">Size</p>
                <p className="font-mono text-[10px] text-zinc-400">{(currentFile.size / 1024).toFixed(0)} KB</p>
              </div>
            </div>
            {integratedLufs !== null && (
              <div className="flex items-baseline gap-1.5">
                <span className="text-[9px] uppercase tracking-wider text-zinc-700">LUFS</span>
                <span className={`font-mono text-[11px] tabular-nums ${integratedLufs > -14 ? 'text-amber-300' : integratedLufs > -23 ? 'text-emerald-400' : 'text-zinc-500'}`}>
                  {integratedLufs.toFixed(1)}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div>
            <p className="text-[11px] text-zinc-500">
              {language === 'ro' ? 'Niciun fișier selectat' : 'No file selected'}
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-zinc-700">
              {language === 'ro'
                ? 'Importă un fișier sau alege un sample pentru a începe.'
                : 'Import a file or select a sample to start shaping your sound.'}
            </p>
          </div>
        )}
      </div>

      {/* Education panels when active */}
      {hasEducation && currentFile && (
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          <div className="space-y-2 p-2">
            {showVisualizer && <VisualizerPanel />}
            {showEducation  && <InfoPanel />}
            {showEducation  && <RecommendationsPanel />}
            {showLessons    && <LessonsPanel />}
          </div>
        </div>
      )}

      {/* Master meters — always at bottom */}
      <div className="mt-auto shrink-0 border-t border-zinc-800 p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          Master
        </p>
        <div className="flex items-end gap-3">
          <LevelMeter height={60} width={18} />
          <div className="flex flex-col gap-1">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-700">Peak</p>
              <p className={`font-mono text-[11px] tabular-nums ${masterPeak >= 1 ? 'text-red-400' : masterPeak > 0.5 ? 'text-amber-300' : 'text-zinc-300'}`}>
                {toDbfs(masterPeak)}
              </p>
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-700">RMS</p>
              <p className="font-mono text-[11px] tabular-nums text-zinc-500">{toDbfs(masterRms)}</p>
            </div>
            <button
              onClick={clearClip}
              title="Click to reset clip indicator"
              className={`mt-1 rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase transition ${
                clipped ? 'bg-red-500 text-white' : 'bg-zinc-900 text-zinc-700 hover:text-zinc-500'
              }`}
            >
              CLIP
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
