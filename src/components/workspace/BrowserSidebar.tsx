import { useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useAudioStore } from '@/store/audioStore'
import { useEducationStore } from '@/store/educationStore'
import { useEffectsStore } from '@/store/effectsStore'
import { usePresetStore } from '@/store/presetStore'
import { decodeFile, UnsupportedAudioFormatError } from '@/audio/file-loader'
import { start as startEngine, getContext, getStatus } from '@/audio/engine'
import { FACTORY_PRESETS, type Preset } from '@/presets/factoryPresets'
import * as transport from '@/audio/transport'

const DEMO_SAMPLES = [
  { id: 'voice',       label: 'Voice.wav',      file: 'voice.wav' },
  { id: 'guitar',      label: 'Guitar.wav',     file: 'guitar.wav' },
  { id: 'guitar-dist', label: 'GuitarDist.wav', file: 'guitar-dist.wav' },
  { id: 'drums',       label: 'Drums.wav',      file: 'drums.wav' },
  { id: 'bass',        label: 'Bass.wav',       file: 'bass.wav' },
  { id: 'sweep',       label: 'Sweep.wav',      file: 'sweep.wav' },
]

type PendingLoad =
  | { type: 'sample'; data: typeof DEMO_SAMPLES[number] }
  | { type: 'file';   data: File }

interface SectionProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}

function Section({ title, children, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-zinc-800/60">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 hover:text-zinc-400"
      >
        {title}
        <span className={`text-zinc-700 transition-transform duration-150 ${open ? '' : '-rotate-90'}`}>▾</span>
      </button>
      {open && <div className="pb-1">{children}</div>}
    </div>
  )
}

export function BrowserSidebar() {
  const inputRef      = useRef<HTMLInputElement>(null)
  const setLoading    = useAudioStore((s) => s.setLoading)
  const setError      = useAudioStore((s) => s.setError)
  const setFile       = useAudioStore((s) => s.setFile)
  const clearFile     = useAudioStore((s) => s.clearFile)
  const loading       = useAudioStore((s) => s.loading)
  const currentFile   = useAudioStore((s) => s.currentFile)
  const isRecording   = useAudioStore((s) => s.isRecording)
  const language      = useEducationStore((s) => s.language)

  const addEffect      = useEffectsStore((s) => s.addEffect)
  const setParam       = useEffectsStore((s) => s.setParam)
  const setBypass      = useEffectsStore((s) => s.setBypass)
  const clearEffects   = useEffectsStore((s) => s.clear)
  const activePresetId  = usePresetStore((s) => s.activePresetId)
  const setActivePreset = usePresetStore((s) => s.setActivePresetId)
  const userPresets     = usePresetStore((s) => s.userPresets)
  const deleteUserPreset = usePresetStore((s) => s.deleteUserPreset)

  const [searchQ, setSearchQ]           = useState('')
  const [presetError, setPresetError]   = useState<string | null>(null)
  const [pendingLoad, setPendingLoad]   = useState<PendingLoad | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const ro = language === 'ro'

  // ── Internal loaders (no guards) ────────────────────────────────────────

  async function _doLoadFile(file: File) {
    setError(null); setLoading(true)
    try {
      if (getStatus().status !== 'running') await startEngine()
      const ctx = getContext()
      if (!ctx) throw new Error('AudioContext unavailable')
      const audioBuffer = await decodeFile(file, ctx)
      setFile(
        { name: file.name, size: file.size, duration: audioBuffer.duration, sampleRate: audioBuffer.sampleRate, numberOfChannels: audioBuffer.numberOfChannels },
        audioBuffer,
      )
    } catch (err) {
      const msg = err instanceof UnsupportedAudioFormatError
        ? (ro ? `Format nesuportat: ${file.name}` : `Unsupported: ${file.name}`)
        : err instanceof Error ? err.message : String(err)
      setError(msg)
    } finally { setLoading(false) }
  }

  async function _doLoadSample(sample: typeof DEMO_SAMPLES[number]) {
    setError(null); setLoading(true)
    try {
      if (getStatus().status !== 'running') await startEngine()
      const ctx = getContext()
      if (!ctx) throw new Error('AudioContext unavailable')
      const resp = await fetch(`/samples/${sample.file}`)
      if (!resp.ok) throw new Error(`Failed: ${sample.file}`)
      const ab = await resp.arrayBuffer()
      const audioBuffer = await ctx.decodeAudioData(ab)
      setFile(
        { name: sample.file, size: ab.byteLength, duration: audioBuffer.duration, sampleRate: audioBuffer.sampleRate, numberOfChannels: audioBuffer.numberOfChannels },
        audioBuffer,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally { setLoading(false) }
  }

  // ── Public entry points with guards ─────────────────────────────────────

  async function loadFile(file: File) {
    if (isRecording) {
      setError(ro ? 'Înregistrare activă — oprește înregistrarea mai întâi.' : 'Recording in progress — stop recording first.')
      return
    }
    if (currentFile) {
      setPendingLoad({ type: 'file', data: file })
      return
    }
    await _doLoadFile(file)
  }

  async function loadSample(sample: typeof DEMO_SAMPLES[number]) {
    if (isRecording) {
      setError(ro ? 'Înregistrare activă — oprește înregistrarea mai întâi.' : 'Recording in progress — stop recording first.')
      return
    }
    if (currentFile) {
      setPendingLoad({ type: 'sample', data: sample })
      return
    }
    await _doLoadSample(sample)
  }

  async function confirmReplace() {
    const pending = pendingLoad
    if (!pending) return
    setPendingLoad(null)
    transport.stop()
    clearFile()
    if (pending.type === 'sample') await _doLoadSample(pending.data)
    else await _doLoadFile(pending.data)
  }

  function ejectFile() {
    transport.stop()
    clearFile()
    setPendingLoad(null)
  }

  async function handleDeleteConfirm() {
    const id = confirmDeleteId
    if (!id) return
    setConfirmDeleteId(null)
    await deleteUserPreset(id)
  }

  // ─────────────────────────────────────────────────────────────────────────

  function loadPreset(preset: Preset) {
    setPresetError(null)
    if (getStatus().status !== 'running') {
      setPresetError(ro ? 'Pornește engine-ul mai întâi.' : 'Start the engine first.')
      return
    }
    try {
      clearEffects()
      for (const pe of preset.effects) {
        const instance = addEffect(pe.type)
        for (const [id, value] of Object.entries(pe.params)) setParam(instance.id, Number(id), value)
        if (pe.bypassed) setBypass(instance.id, true)
      }
      setActivePreset(preset.id)
    } catch (e) {
      setPresetError(e instanceof Error ? e.message : String(e))
    }
  }

  const filteredSamples = DEMO_SAMPLES.filter((s) =>
    s.label.toLowerCase().includes(searchQ.toLowerCase()),
  )

  const pendingName = pendingLoad
    ? (pendingLoad.type === 'sample' ? pendingLoad.data.label : pendingLoad.data.name)
    : null

  return (
    <aside className="flex h-full w-48 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950">

      {/* Confirmation banner */}
      {pendingLoad && (
        <div className="shrink-0 border-b border-amber-800/40 bg-amber-950/30 p-3">
          <p className="mb-1 text-[10px] font-semibold text-amber-300">
            {ro ? 'Înlocuiești fișierul curent?' : 'Replace current file?'}
          </p>
          <p className="mb-2 truncate text-[9px] text-zinc-500" title={pendingName ?? ''}>
            {pendingName}
          </p>
          <div className="flex gap-1.5">
            <button
              onClick={() => void confirmReplace()}
              className="flex-1 rounded bg-amber-600 py-1 text-[10px] font-semibold text-white transition hover:bg-amber-500"
            >
              {ro ? 'Înlocuiește' : 'Replace'}
            </button>
            <button
              onClick={() => setPendingLoad(null)}
              className="flex-1 rounded border border-zinc-700 py-1 text-[10px] text-zinc-400 transition hover:text-zinc-200"
            >
              {ro ? 'Anulează' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>

        {/* Factory presets */}
        <Section title={ro ? 'Preseturi Factory' : 'Factory Presets'}>
          {presetError && (
            <p className="px-3 pb-1 text-[9px] text-red-400">{presetError}</p>
          )}
          {FACTORY_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => loadPreset(p)}
              className={`flex w-full items-center gap-2 px-3 py-1 text-left text-[11px] transition ${
                activePresetId === p.id
                  ? 'bg-purple-600/15 text-purple-300'
                  : 'text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300'
              }`}
            >
              <span className={`h-1 w-1 shrink-0 rounded-full ${activePresetId === p.id ? 'bg-purple-400' : 'bg-zinc-700'}`} />
              <span className="truncate">{p.name[language]}</span>
            </button>
          ))}
        </Section>

        {/* Custom / user presets */}
        <Section title={ro ? 'Preseturile Mele' : 'My Presets'}>
          {userPresets.length === 0 ? (
            <p className="px-3 py-2 text-[10px] text-zinc-700">
              {ro ? 'Niciun preset salvat încă.' : 'No saved presets yet.'}
            </p>
          ) : (
            userPresets.map((p) => (
              <div key={p.id} className="group flex items-center">
                <button
                  onClick={() => loadPreset(p)}
                  className={`flex min-w-0 flex-1 items-center gap-2 px-3 py-1 text-left text-[11px] transition ${
                    activePresetId === p.id
                      ? 'bg-purple-600/15 text-purple-300'
                      : 'text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300'
                  }`}
                >
                  <span className={`h-1 w-1 shrink-0 rounded-full ${activePresetId === p.id ? 'bg-purple-400' : 'bg-zinc-700'}`} />
                  <span className="truncate">{p.name[language]}</span>
                </button>
                <button
                  onClick={() => setConfirmDeleteId(p.id)}
                  title={ro ? 'Șterge presetul' : 'Delete preset'}
                  aria-label={ro ? `Șterge „${p.name[language]}"` : `Delete "${p.name[language]}"`}
                  className="mr-1.5 shrink-0 rounded p-0.5 text-zinc-700 opacity-0 transition hover:bg-red-500/15 hover:text-red-400 group-hover:opacity-100"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </Section>

        {/* Sample Library */}
        <Section title="Sample Library">
          <div className="px-3 pb-1.5">
            <input
              type="text"
              placeholder={ro ? 'Caută...' : 'Search samples...'}
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] text-zinc-300 placeholder-zinc-700 outline-none focus:border-zinc-700"
            />
          </div>
          {filteredSamples.map((s) => (
            <button
              key={s.id}
              onClick={() => void loadSample(s)}
              disabled={loading}
              className="flex w-full items-center gap-2 px-3 py-1 text-left text-[11px] text-zinc-500 transition hover:bg-zinc-800/60 hover:text-zinc-200 disabled:opacity-40"
            >
              <svg className="h-3 w-3 shrink-0 text-zinc-700" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
              </svg>
              <span className="truncate">{s.label}</span>
            </button>
          ))}
        </Section>
      </div>

      {/* Footer: eject + import */}
      <div className="shrink-0 border-t border-zinc-800 p-3 space-y-2">
        {/* Current file indicator with eject button */}
        {currentFile && (
          <div className="flex items-center gap-1.5">
            <svg className="h-3 w-3 shrink-0 text-zinc-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
            </svg>
            <span className="flex-1 truncate text-[9px] text-zinc-500" title={currentFile.name}>
              {currentFile.name}
            </span>
            <button
              onClick={ejectFile}
              title={ro ? 'Scoate fișierul din memorie' : 'Eject file from memory'}
              className="shrink-0 rounded p-0.5 text-zinc-600 transition hover:bg-zinc-800 hover:text-zinc-300"
              aria-label={ro ? 'Scoate fișierul' : 'Eject file'}
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <button
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded border border-zinc-800 py-1.5 text-[10px] font-medium text-zinc-600 transition hover:border-zinc-700 hover:text-zinc-300 disabled:opacity-40"
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          {ro ? 'Importă fișier audio' : 'Import Audio File'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,.wav,.mp3,.ogg,.flac,.m4a,.aac"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (f) await loadFile(f)
            e.target.value = ''
          }}
        />
      </div>

      {/* Delete preset confirmation */}
      {(() => {
        const target = userPresets.find((p) => p.id === confirmDeleteId)
        return (
          <Dialog.Root open={confirmDeleteId !== null} onOpenChange={(o) => { if (!o) setConfirmDeleteId(null) }}>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
              <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-72 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
                <Dialog.Title className="text-sm font-semibold text-zinc-200">
                  {ro ? 'Ștergi presetul?' : 'Delete preset?'}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-[11px] text-zinc-500">
                  {target
                    ? (ro
                        ? `„${target.name[language]}" va fi eliminat definitiv.`
                        : `"${target.name[language]}" will be permanently removed.`)
                    : null}
                </Dialog.Description>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => void handleDeleteConfirm()}
                    className="flex-1 rounded-lg bg-red-600/80 py-2 text-xs font-semibold text-white transition hover:bg-red-500"
                  >
                    {ro ? 'Șterge' : 'Delete'}
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="flex-1 rounded-lg border border-zinc-700 py-2 text-xs text-zinc-400 transition hover:text-zinc-200"
                  >
                    {ro ? 'Anulează' : 'Cancel'}
                  </button>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        )
      })()}
    </aside>
  )
}
