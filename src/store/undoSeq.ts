/**
 * Global monotonic sequence for cross-store undo ordering.
 *
 * The effects chain (`effectsStore`) and the audio buffer edits (`audioStore`)
 * keep independent undo histories. To let a single Ctrl+Z respect the true
 * chronological order across both, every undoable action stamps the step it
 * produces with a value from here. The keyboard handler then undoes whichever
 * domain holds the step with the highest sequence (most recent), and redoes the
 * one with the lowest pending sequence (earliest undone).
 */
let seq = 0

export function nextUndoSeq(): number {
  return ++seq
}
