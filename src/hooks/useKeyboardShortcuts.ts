import { useEffect } from 'react'
import { useAudioStore } from '@/store/audioStore'
import { useEffectsStore } from '@/store/effectsStore'
import * as transport from '@/audio/transport'
import { usePresetStore } from '@/store/presetStore'

/**
 * Undo/redo spans two independent histories — the effects chain and the audio
 * buffer edits (chop). Each undoable step carries a global sequence number, so a
 * single Ctrl+Z can respect true chronological order: undo reverts whichever
 * domain holds the most recent step, redo re-applies the earliest undone one.
 */
function globalUndo() {
  const effects = useEffectsStore.getState()
  const audio = useAudioStore.getState()
  const eSeq = effects.peekUndoSeq()
  const bSeq = audio.peekBufferUndoSeq()
  if (eSeq === null && bSeq === null) return
  if (bSeq !== null && (eSeq === null || bSeq > eSeq)) {
    audio.undoBuffer()
  } else {
    effects.undo()
    usePresetStore.getState().setActivePresetId(null)
  }
}

function globalRedo() {
  const effects = useEffectsStore.getState()
  const audio = useAudioStore.getState()
  const eSeq = effects.peekRedoSeq()
  const bSeq = audio.peekBufferRedoSeq()
  if (eSeq === null && bSeq === null) return
  if (bSeq !== null && (eSeq === null || bSeq < eSeq)) {
    audio.redoBuffer()
  } else {
    effects.redo()
    usePresetStore.getState().setActivePresetId(null)
  }
}

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

        case 'KeyZ': {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            if (e.shiftKey) globalRedo()
            else globalUndo()
          }
          break
        }

        case 'KeyY': {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            globalRedo()
          }
          break
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
