/**
 * Non-destructive region editing at the AudioBuffer level.
 *
 * Both operations copy samples into a freshly allocated buffer and never touch
 * the source. Times are converted to sample indices with rounding and clamped
 * to the valid range, so callers can pass raw region seconds from the waveform.
 *
 * A resulting buffer must contain at least one sample frame; requests that would
 * yield an empty buffer (zero-length selection to crop, or deleting everything)
 * return `null` so the caller can ignore them.
 */

function timeToSample(sec: number, sampleRate: number, length: number): number {
  const idx = Math.round(sec * sampleRate)
  return Math.max(0, Math.min(length, idx))
}

function allocLike(source: AudioBuffer, length: number): AudioBuffer {
  return new AudioBuffer({
    length,
    numberOfChannels: source.numberOfChannels,
    sampleRate: source.sampleRate,
  })
}

/**
 * Keep only the samples inside [startSec, endSec); discard everything else.
 * Returns `null` for an empty or inverted selection.
 */
export function cropToRegion(
  source: AudioBuffer,
  startSec: number,
  endSec: number,
): AudioBuffer | null {
  const { sampleRate, length, numberOfChannels } = source
  const s = timeToSample(startSec, sampleRate, length)
  const e = timeToSample(endSec, sampleRate, length)
  if (e <= s) return null

  const out = allocLike(source, e - s)
  for (let ch = 0; ch < numberOfChannels; ch++) {
    out.getChannelData(ch).set(source.getChannelData(ch).subarray(s, e))
  }
  return out
}

/**
 * Remove the samples inside [startSec, endSec) and splice the remainder
 * together. Returns `null` when nothing would remain or the selection is empty.
 */
export function deleteRegion(
  source: AudioBuffer,
  startSec: number,
  endSec: number,
): AudioBuffer | null {
  const { sampleRate, length, numberOfChannels } = source
  const s = timeToSample(startSec, sampleRate, length)
  const e = timeToSample(endSec, sampleRate, length)
  if (e <= s) return null

  const newLength = s + (length - e)
  if (newLength < 1) return null

  const out = allocLike(source, newLength)
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const src = source.getChannelData(ch)
    const dst = out.getChannelData(ch)
    dst.set(src.subarray(0, s), 0)
    dst.set(src.subarray(e, length), s)
  }
  return out
}
