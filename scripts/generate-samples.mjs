/**
 * Generates demo WAV samples for SoundLab.
 * Run once: node scripts/generate-samples.mjs
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '../public/samples')
mkdirSync(OUT, { recursive: true })

const SR = 44100

// ── WAV encoder ──────────────────────────────────────────────────────────────
function encodeWav(samples, sampleRate = SR) {
  const numCh = 1, bps = 16
  const byteRate = sampleRate * numCh * 2
  const dataBytes = samples.length * 2
  const buf = Buffer.alloc(44 + dataBytes)

  buf.write('RIFF', 0); buf.writeUInt32LE(36 + dataBytes, 4)
  buf.write('WAVE', 8); buf.write('fmt ', 12); buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(numCh, 22)
  buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(byteRate, 28)
  buf.writeUInt16LE(numCh * 2, 32); buf.writeUInt16LE(bps, 34)
  buf.write('data', 36); buf.writeUInt32LE(dataBytes, 40)

  let off = 44
  for (const s of samples) {
    const c = Math.max(-1, Math.min(1, s))
    buf.writeInt16LE(Math.round(c * (c < 0 ? 0x8000 : 0x7fff)), off)
    off += 2
  }
  return buf
}

function write(name, samples) {
  writeFileSync(join(OUT, name), encodeWav(samples))
  console.log(`✓ ${name}  (${samples.length} samples, ${(samples.length / SR).toFixed(1)}s)`)
}

// ── Signal generators ────────────────────────────────────────────────────────
function sine(freq, dur, amp = 0.7) {
  const n = Math.round(dur * SR)
  return Float32Array.from({ length: n }, (_, i) =>
    amp * Math.sin(2 * Math.PI * freq * i / SR)
  )
}

function noise(dur, amp = 0.5) {
  const n = Math.round(dur * SR)
  return Float32Array.from({ length: n }, () => amp * (Math.random() * 2 - 1))
}

function envelope(samples, attackSec, releaseSec) {
  const att = Math.round(attackSec * SR)
  const rel = Math.round(releaseSec * SR)
  const out = new Float32Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    let gain = 1
    if (i < att) gain = i / att
    else if (i > samples.length - rel) gain = (samples.length - i) / rel
    out[i] = samples[i] * gain
  }
  return out
}

function mix(...arrays) {
  const len = Math.max(...arrays.map(a => a.length))
  const out = new Float32Array(len)
  for (const a of arrays) for (let i = 0; i < a.length; i++) out[i] += a[i]
  return out
}

function gain(samples, g) {
  return samples.map(s => s * g)
}

// Kick: sine sweep 180→50 Hz + sub thump, 0.4s
function kick(startTime = 0) {
  const dur = 0.4
  const n = Math.round(dur * SR)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const freq = 180 * Math.exp(-t * 12) + 50
    const amp = Math.exp(-t * 8)
    out[i] = amp * Math.sin(2 * Math.PI * freq * t)
  }
  return { samples: out, dur }
}

// Snare: sine + noise burst, 0.2s
function snare() {
  const dur = 0.2
  const n = Math.round(dur * SR)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const amp = Math.exp(-t * 18)
    const tone = Math.sin(2 * Math.PI * 200 * t)
    const crack = (Math.random() * 2 - 1)
    out[i] = amp * (0.4 * tone + 0.6 * crack)
  }
  return out
}

// Hi-hat: high-pass noise burst, 0.06s
function hihat(open = false) {
  const dur = open ? 0.15 : 0.06
  const n = Math.round(dur * SR)
  const out = new Float32Array(n)
  let hp = 0
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const raw = Math.random() * 2 - 1
    hp = 0.85 * hp + 0.15 * raw   // crude high-pass
    const amp = Math.exp(-t * (open ? 12 : 30))
    out[i] = amp * hp * 0.4
  }
  return out
}

function placeAt(samples, eventSamples, offsetSec) {
  const off = Math.round(offsetSec * SR)
  for (let i = 0; i < eventSamples.length; i++) {
    if (off + i < samples.length) samples[off + i] += eventSamples[i]
  }
}

// ── 1. Voice: C major scale up + down, sung with harmonics & vibrato ────────
{
  // C major scale: C4 D4 E4 F4 G4 A4 B4 C5 then back down
  const SCALE = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25,
                 493.88, 440.00, 392.00, 349.23, 329.63, 293.66, 261.63]
  const NOTE_DUR = 0.55   // seconds per note
  const FADE = 0.06       // crossfade between notes

  function voiceNote(freq, durSec) {
    const n = Math.round(durSec * SR)
    const out = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const t = i / SR
      // vibrato kicks in after 80ms
      const vibDepth = Math.min(1, Math.max(0, (t - 0.08) / 0.12))
      const vib = 1 + 0.007 * vibDepth * Math.sin(2 * Math.PI * 5.5 * t)
      const f0 = freq * vib
      let s = 0
      // singer's formant: boost harmonics 3–5 for vowel colour
      for (let h = 1; h <= 14; h++) {
        const formant = (h >= 3 && h <= 5) ? 1.4 : (h >= 6 && h <= 8) ? 0.9 : 1
        const hamp = (0.65 / h) * (h % 2 === 1 ? 1 : 0.55) * formant
        s += hamp * Math.sin(2 * Math.PI * f0 * h * t)
      }
      // breath noise
      s += 0.05 * (Math.random() * 2 - 1)
      // note envelope: quick attack, sustain, tail
      const att = Math.min(1, t / 0.03)
      const rel = Math.min(1, (durSec - t) / FADE)
      out[i] = s * 0.38 * att * rel
    }
    return out
  }

  const totalSamples = Math.round((SCALE.length * NOTE_DUR + FADE) * SR)
  const out = new Float32Array(totalSamples)
  for (let ni = 0; ni < SCALE.length; ni++) {
    const note = voiceNote(SCALE[ni], NOTE_DUR + FADE)
    const start = Math.round(ni * NOTE_DUR * SR)
    for (let i = 0; i < note.length && start + i < totalSamples; i++) {
      out[start + i] += note[i]
    }
  }
  const peak = out.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
  write('voice.wav', out.map(v => v / peak * 0.82))
}

// ── 2. Guitar: Karplus-Strong multi-note melody, 8 bars @ 120 BPM ──────────
{
  // Karplus-Strong pluck for one note
  function ksPluck(freq, durSec, amp = 0.85) {
    const delayLen = Math.round(SR / freq)
    const buf = new Float32Array(delayLen)
    for (let i = 0; i < delayLen; i++) buf[i] = Math.random() * 2 - 1
    const n = Math.round(durSec * SR)
    const out = new Float32Array(n)
    let prev = 0
    for (let i = 0; i < n; i++) {
      const idx = i % delayLen
      const s = buf[idx]
      // averaging filter (slight brightness boost: 0.499 instead of 0.498)
      const filtered = 0.499 * (s + prev)
      buf[idx] = filtered
      prev = s
      out[i] = filtered * amp
    }
    return out
  }

  // Am pentatonic melody over 2 repeating bars (16 eighth notes per bar pair)
  // Frequencies: E2=82.4, A2=110, D3=146.8, E3=164.8, G3=196, A3=220, C4=261.6, E4=329.6
  const bpm = 120
  const eighth = 60 / bpm / 2   // eighth note duration
  // [freq, start_beat_in_eighths, note_dur_sec]
  const seq = [
    // Bar 1-2: ascending arpeggio then melody
    [110.0, 0,  0.9], // A2
    [164.8, 1,  0.9], // E3
    [220.0, 2,  0.9], // A3
    [261.6, 3,  0.9], // C4
    [329.6, 4,  1.2], // E4 — held longer
    [261.6, 6,  0.9], // C4
    [220.0, 7,  0.9], // A3
    [164.8, 8,  0.9], // E3
    // Bar 3-4: melodic variation
    [146.8, 9,  0.9], // D3
    [220.0, 10, 0.9], // A3
    [293.7, 11, 0.9], // D4
    [329.6, 12, 1.2], // E4
    [293.7, 14, 0.9], // D4
    [220.0, 15, 0.9], // A3
    // Bar 5-6: same as 1-2
    [110.0, 16, 0.9],
    [164.8, 17, 0.9],
    [220.0, 18, 0.9],
    [261.6, 19, 0.9],
    [329.6, 20, 1.2],
    [261.6, 22, 0.9],
    [220.0, 23, 0.9],
    [164.8, 24, 0.9],
    // Bar 7-8: descending run
    [329.6, 25, 0.6],
    [261.6, 26, 0.6],
    [220.0, 27, 0.6],
    [196.0, 28, 0.6],
    [164.8, 29, 0.6],
    [146.8, 30, 0.6],
    [110.0, 31, 1.8], // final note, held
  ]

  const totalDur = 32 * eighth + 2.0
  const totalSamples = Math.round(totalDur * SR)
  const out = new Float32Array(totalSamples)

  for (const [freq, beat, dur] of seq) {
    const pluck = ksPluck(freq, dur)
    const start = Math.round(beat * eighth * SR)
    for (let i = 0; i < pluck.length && start + i < totalSamples; i++) {
      out[start + i] += pluck[i]
    }
  }

  const peak = out.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
  write('guitar.wav', envelope(out.map(v => v / peak * 0.88), 0.002, 0.4))
}

// ── 3. Drum loop: 4/4 pattern, 120 BPM, 4 bars (~8s) ──────────────────────
{
  const bpm = 120, beat = 60 / bpm
  const bars = 4, beats = bars * 4
  const dur = beats * beat
  const n = Math.round(dur * SR)
  const out = new Float32Array(n)

  for (let b = 0; b < beats; b++) {
    const t = b * beat
    // Kick on 1 and 3
    if (b % 4 === 0 || b % 4 === 2) placeAt(out, kick().samples, t)
    // Snare on 2 and 4
    if (b % 4 === 1 || b % 4 === 3) placeAt(out, snare(), t)
    // Closed hi-hat every beat
    placeAt(out, hihat(), t)
    // Open hi-hat on the "and" of beat 2
    if (b % 4 === 1) placeAt(out, hihat(true), t + beat * 0.5)
  }
  // normalize
  const peak = out.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
  const norm = out.map(v => v / peak * 0.85)
  write('drums.wav', norm)
}

// ── 4. Bass: simple synth bass line, 8s ────────────────────────────────────
{
  const bpm = 120, beat = 60 / bpm
  const notes = [55, 55, 73.4, 55, 65.4, 55, 49, 55]  // A1, A1, D2, A1, C2, A1, G1, A1 (Hz)
  const dur = notes.length * beat
  const n = Math.round(dur * SR)
  const out = new Float32Array(n)
  for (let ni = 0; ni < notes.length; ni++) {
    const freq = notes[ni]
    const startSample = Math.round(ni * beat * SR)
    const noteDur = Math.round(beat * 0.8 * SR)
    for (let i = 0; i < noteDur && startSample + i < n; i++) {
      const t = i / SR
      // sawtooth-ish: fundamental + harmonics
      let s = 0
      for (let h = 1; h <= 8; h++) s += (1 / h) * Math.sin(2 * Math.PI * freq * h * t)
      const env = Math.exp(-t * 3) * (1 - Math.exp(-t * 200))
      out[startSample + i] += s * env * 0.5
    }
  }
  const peak = out.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
  write('bass.wav', out.map(v => v / peak * 0.8))
}

// ── 5. Sweep: 20 Hz → 20 kHz sine sweep, 10s (useful for EQ visualization) ─
{
  const dur = 10, n = Math.round(dur * SR)
  const out = new Float32Array(n)
  const f0 = 20, f1 = 20000
  const k = Math.log(f1 / f0)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const phase = 2 * Math.PI * f0 * dur / k * (Math.exp(k * t / dur) - 1)
    out[i] = 0.7 * Math.sin(phase)
  }
  write('sweep.wav', envelope(out, 0.01, 0.1))
}

console.log('\nDone. Samples saved to public/samples/')
