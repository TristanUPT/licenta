/**
 * Decode audio files into AudioBuffer for playback.
 *
 * - Files (drag & drop / file picker) → `decodeFile`
 * - URLs (bundled samples)            → `decodeUrl`
 *
 * Decoding is expensive: results are cached in-memory (LRU-ish, capped).
 */

const SUPPORTED_EXTENSIONS = ['wav', 'mp3', 'ogg', 'flac', 'm4a', 'aac'] as const
const SUPPORTED_MIMES = [
  'audio/wav', 'audio/wave', 'audio/x-wav',
  'audio/mpeg', 'audio/mp3',
  'audio/ogg', 'audio/vorbis',
  'audio/flac', 'audio/x-flac',
  'audio/mp4', 'audio/x-m4a', 'audio/aac',
] as const

const CACHE_LIMIT = 8
const cache = new Map<string, AudioBuffer>()

function cacheGet(key: string): AudioBuffer | undefined {
  const buf = cache.get(key)
  if (buf) {
    // Touch: re-insert to mark as most recently used.
    cache.delete(key)
    cache.set(key, buf)
  }
  return buf
}

function cacheSet(key: string, buf: AudioBuffer): void {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
  cache.set(key, buf)
}

export class UnsupportedAudioFormatError extends Error {
  constructor(name: string) {
    super(`Unsupported audio format: ${name}`)
  }
}

function looksSupported(file: File): boolean {
  if (file.type && SUPPORTED_MIMES.includes(file.type as (typeof SUPPORTED_MIMES)[number])) {
    return true
  }
  // Fall back to extension if MIME is empty/odd.
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return SUPPORTED_EXTENSIONS.includes(ext as (typeof SUPPORTED_EXTENSIONS)[number])
}

export async function decodeFile(file: File, ctx: BaseAudioContext): Promise<AudioBuffer> {
  if (!looksSupported(file)) throw new UnsupportedAudioFormatError(file.name)

  // Use file path-ish key. Two different files with the same name are unlikely
  // here (single-user app), but include size to be safer.
  const key = `file:${file.name}:${file.size}`
  const cached = cacheGet(key)
  if (cached) return cached

  const arrayBuffer = await file.arrayBuffer()
  // decodeAudioData detaches the input ArrayBuffer; we don't reuse it.
  const decoded = await ctx.decodeAudioData(arrayBuffer)
  cacheSet(key, decoded)
  return decoded
}

export async function decodeUrl(url: string, ctx: BaseAudioContext): Promise<AudioBuffer> {
  const cached = cacheGet(url)
  if (cached) return cached

  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`)
  const arrayBuffer = await response.arrayBuffer()
  const decoded = await ctx.decodeAudioData(arrayBuffer)
  cacheSet(url, decoded)
  return decoded
}

export function clearCache(): void {
  cache.clear()
}
