import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export interface LoadedFile {
  name: string
  size: number
  duration: number
  sampleRate: number
  numberOfChannels: number
}

interface AudioState {
  /** Metadata of the currently loaded clip (null = no file). */
  currentFile: LoadedFile | null
  /**
   * Decoded audio data. Kept out of devtools snapshots — large objects.
   * Not persisted (heavy + ephemeral).
   */
  audioBuffer: AudioBuffer | null

  isPlaying: boolean
  isLooping: boolean
  loopStart: number   // seconds
  loopEnd: number     // seconds
  /** Current playback position in seconds (updated from rAF). */
  playbackPosition: number

  loading: boolean
  error: string | null

  // Actions
  setFile: (file: LoadedFile, buffer: AudioBuffer) => void
  clearFile: () => void
  setPlaying: (playing: boolean) => void
  toggleLoop: () => void
  setLoopRegion: (start: number, end: number) => void
  setPlaybackPosition: (sec: number) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useAudioStore = create<AudioState>()(
  devtools(
    (set) => ({
      currentFile: null,
      audioBuffer: null,
      isPlaying: false,
      isLooping: false,
      loopStart: 0,
      loopEnd: 0,
      playbackPosition: 0,
      loading: false,
      error: null,

      setFile: (file, buffer) => set({
        currentFile: file,
        audioBuffer: buffer,
        isPlaying: false,
        playbackPosition: 0,
        loopStart: 0,
        loopEnd: file.duration,
        isLooping: false,
        error: null,
      }, undefined, 'audio/setFile'),

      clearFile: () => set({
        currentFile: null,
        audioBuffer: null,
        isPlaying: false,
        playbackPosition: 0,
        loopStart: 0,
        loopEnd: 0,
        isLooping: false,
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
    }),
    { name: 'audioStore' },
  ),
)
