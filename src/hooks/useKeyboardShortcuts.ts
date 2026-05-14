import { useEffect } from 'react'
import { useAudioStore } from '@/store/audioStore'
import { useEffectsStore } from '@/store/effectsStore'
import * as transport from '@/audio/transport'

/**
 * Global keyboard shortcuts.
 *
 * Space       — play / pause
 * S / Escape  — stop (return to 0)
 * L           — toggle loop
 * I           — set loop in  at current playback position
 * O           — set loop out at current playback position
 * B           — toggle global bypass (A/B comparison)
 *
 * Shortcuts are suppressed when focus is inside an <input>, <textarea>,
 * or any element with contenteditable, so typing in the preset-name field
 * or the EQ value boxes is not intercepted.
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Ignore when typing in a form element.
      const tag = (e.target as HTMLElement).tagName
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        (e.target as HTMLElement).isContentEditable
      ) return

      const state = useAudioStore.getState()
      const { audioBuffer, isPlaying, isLooping, loopStart, loopEnd,
              playbackPosition, setPlaying, setPlaybackPosition,
              toggleLoop, setLoopRegion } = state

      switch (e.code) {
        case 'Space': {
          e.preventDefault()
          if (!audioBuffer) return
          if (isPlaying) {
            transport.stop()
            setPlaying(false)
          } else {
            transport.play(audioBuffer, {
              offset: isLooping ? loopStart : playbackPosition,
              loop: isLooping,
              loopStart,
              loopEnd,
            })
            setPlaying(true)
          }
          break
        }

        case 'KeyS':
        case 'Escape': {
          if (!audioBuffer) return
          transport.stop()
          setPlaying(false)
          setPlaybackPosition(0)
          break
        }

        case 'KeyL': {
          if (!audioBuffer) return
          toggleLoop()
          break
        }

        case 'KeyI': {
          if (!audioBuffer) return
          const newEnd = Math.max(playbackPosition + 0.1, loopEnd)
          setLoopRegion(playbackPosition, newEnd)
          break
        }

        case 'KeyO': {
          if (!audioBuffer) return
          const newStart = Math.min(loopStart, playbackPosition - 0.1)
          setLoopRegion(newStart, playbackPosition)
          break
        }

        case 'KeyB': {
          const { setGlobalBypass, globalBypass } = useEffectsStore.getState()
          setGlobalBypass(!globalBypass)
          break
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
