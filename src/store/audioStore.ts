import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { computeIntegratedLufs } from '@/audio/lufs'
import { nextUndoSeq } from '@/store/undoSeq'
import * as transport from '@/audio/transport'

export interface LoadedFile {
  name: string
  size: number
  duration: number
  sampleRate: number
  numberOfChannels: number
}

/** Cap on non-destructive buffer edits kept for undo — mirrors the effects chain. */
const MAX_BUFFER_HISTORY = 30

interface BufferSnapshot {
  buf: AudioBuffer
  seq: number
}

interface AudioState {
  /** Metadata of the currently loaded clip (null = no file). */
  currentFile: LoadedFile | null
  /**
   * Decoded audio data. Kept out of devtools snapshots — large objects.
   * Not persisted (heavy + ephemeral).
   */
  audioBuffer: AudioBuffer | null
  /** Pristine buffer as first loaded, kept so edits can be fully reverted. */
  originalBuffer: AudioBuffer | null

  isPlaying: boolean
  isLooping: boolean
  loopStart: number   // seconds
  loopEnd: number     // seconds
  /** Current playback position in seconds (updated from rAF). */
  playbackPosition: number

  /** ITU-R BS.1770-4 integrated loudness of loaded file (null when no file). */
  integratedLufs: number | null

  loading: boolean
  error: string | null
  isRecording: boolean

  /** Undo/redo stacks for non-destructive buffer edits (chop). */
  _bufferPast: BufferSnapshot[]
  _bufferFuture: BufferSnapshot[]

  // Actions
  setFile: (file: LoadedFile, buffer: AudioBuffer) => void
  clearFile: () => void
  setPlaying: (playing: boolean) => void
  toggleLoop: () => void
  setLoopRegion: (start: number, end: number) => void
  setPlaybackPosition: (sec: number) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setIsRecording: (v: boolean) => void

  // Non-destructive buffer editing
  applyBufferEdit: (buffer: AudioBuffer) => void
  undoBuffer: () => void
  redoBuffer: () => void
  revertToOriginal: () => void
  canUndoBuffer: () => boolean
  canRedoBuffer: () => boolean
  peekBufferUndoSeq: () => number | null
  peekBufferRedoSeq: () => number | null
}

type SetState = (
  partial: Partial<AudioState> | ((s: AudioState) => Partial<AudioState>),
  replace?: false,
  action?: string,
) => void

/**
 * Swap in a new buffer and recompute everything that depends on its duration:
 * stops playback, resets the loop over the full clip, updates the reported
 * duration and re-measures integrated loudness. Shared by chop, undo/redo and
 * revert so they all leave the app in a consistent state.
 */
function commitBuffer(set: SetState, buffer: AudioBuffer): void {
  transport.stop()
  set((s) => ({
    audioBuffer: buffer,
    currentFile: s.currentFile ? { ...s.currentFile, duration: buffer.duration } : s.currentFile,
    isPlaying: false,
    playbackPosition: 0,
    loopStart: 0,
    loopEnd: buffer.duration,
    isLooping: false,
    integratedLufs: null,
    error: null,
  }), undefined, 'audio/commitBuffer')
  setTimeout(() => {
    const lufs = computeIntegratedLufs(buffer)
    set({ integratedLufs: isFinite(lufs) ? lufs : null }, undefined, 'audio/setLufs')
  }, 0)
}

export const useAudioStore = create<AudioState>()(
  devtools(
    (set, get) => ({
      currentFile: null,
      audioBuffer: null,
      originalBuffer: null,
      isPlaying: false,
      isLooping: false,
      loopStart: 0,
      loopEnd: 0,
      playbackPosition: 0,
      integratedLufs: null,
      loading: false,
      error: null,
      isRecording: false,
      _bufferPast: [],
      _bufferFuture: [],

      setFile: (file, buffer) => {
        set({
          currentFile: file,
          audioBuffer: buffer,
          originalBuffer: buffer,
          isPlaying: false,
          playbackPosition: 0,
          loopStart: 0,
          loopEnd: file.duration,
          isLooping: false,
          integratedLufs: null,
          error: null,
          _bufferPast: [],
          _bufferFuture: [],
        }, undefined, 'audio/setFile')
        setTimeout(() => {
          const lufs = computeIntegratedLufs(buffer)
          set({ integratedLufs: isFinite(lufs) ? lufs : null }, undefined, 'audio/setLufs')
        }, 0)
      },

      clearFile: () => set({
        currentFile: null,
        audioBuffer: null,
        originalBuffer: null,
        isPlaying: false,
        playbackPosition: 0,
        loopStart: 0,
        loopEnd: 0,
        isLooping: false,
        integratedLufs: null,
        error: null,
        _bufferPast: [],
        _bufferFuture: [],
      }, undefined, 'audio/clearFile'),

      setPlaying: (playing) => set({ isPlaying: playing }, undefined, 'audio/setPlaying'),

      toggleLoop: () => set((s) => ({ isLooping: !s.isLooping }), undefined, 'audio/toggleLoop'),

      setLoopRegion: (start, end) => set({
        loopStart: Math.max(0, Math.min(start, end)),
        loopEnd: Math.max(start, end),
      }, undefined, 'audio/setLoopRegion'),

      setPlaybackPosition: (sec) => set({ playbackPosition: sec }, undefined, 'audio/setPlaybackPosition'),

      setLoading: (loading) => set({ loading }, undefined, 'audio/setLoading'),

      setError: (error) => set({ error }, undefined, 'audio/setError'),

      setIsRecording: (v) => set({ isRecording: v }, undefined, 'audio/setIsRecording'),

      applyBufferEdit: (buffer) => {
        const cur = get().audioBuffer
        if (!cur) return
        set((s) => {
          const past = [...s._bufferPast, { buf: cur, seq: nextUndoSeq() }]
          if (past.length > MAX_BUFFER_HISTORY) past.shift()
          return { _bufferPast: past, _bufferFuture: [] }
        }, undefined, 'audio/applyBufferEdit')
        commitBuffer(set, buffer)
      },

      undoBuffer: () => {
        const { _bufferPast, audioBuffer } = get()
        if (_bufferPast.length === 0 || !audioBuffer) return
        const prev = _bufferPast[_bufferPast.length - 1]!
        set((s) => ({
          _bufferPast: s._bufferPast.slice(0, -1),
          _bufferFuture: [...s._bufferFuture, { buf: audioBuffer, seq: prev.seq }],
        }), undefined, 'audio/undoBuffer')
        commitBuffer(set, prev.buf)
      },

      redoBuffer: () => {
        const { _bufferFuture, audioBuffer } = get()
        if (_bufferFuture.length === 0 || !audioBuffer) return
        const next = _bufferFuture[_bufferFuture.length - 1]!
        set((s) => ({
          _bufferFuture: s._bufferFuture.slice(0, -1),
          _bufferPast: [...s._bufferPast, { buf: audioBuffer, seq: next.seq }],
        }), undefined, 'audio/redoBuffer')
        commitBuffer(set, next.buf)
      },

      revertToOriginal: () => {
        const { originalBuffer, audioBuffer } = get()
        if (!originalBuffer || audioBuffer === originalBuffer) return
        set((s) => {
          const past = [...s._bufferPast, { buf: audioBuffer!, seq: nextUndoSeq() }]
          if (past.length > MAX_BUFFER_HISTORY) past.shift()
          return { _bufferPast: past, _bufferFuture: [] }
        }, undefined, 'audio/revertToOriginal')
        commitBuffer(set, originalBuffer)
      },

      canUndoBuffer: () => get()._bufferPast.length > 0,
      canRedoBuffer: () => get()._bufferFuture.length > 0,
      peekBufferUndoSeq: () => {
        const p = get()._bufferPast
        return p.length ? p[p.length - 1]!.seq : null
      },
      peekBufferRedoSeq: () => {
        const f = get()._bufferFuture
        return f.length ? f[f.length - 1]!.seq : null
      },
    }),
    { name: 'audioStore' },
  ),
)
