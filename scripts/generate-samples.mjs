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

// ── 1. Voice-like: fundamental 120 Hz + harmonics, slow vibrato, 6s ────────
{
  const dur = 6, n = Math.round(dur * SR)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const vib = 1 + 0.006 * Math.sin(2 * Math.PI * 5.5 * t)
    const f0 = 120 * vib
    let s = 0
    // harmonics with rolloff
    for (let h = 1; h <= 12; h++) {
      const amp = 0.7 / h * (h % 2 === 1 ? 1 : 0.6)
      s += amp * Math.sin(2 * Math.PI * f0 * h * t)
    }
    // breathiness
    s += 0.08 * (Math.random() * 2 - 1)
    out[i] = s * 0.4
  }
  write('voice.wav', envelope(out, 0.05, 0.3))
}

// ── 2. Acoustic guitar-like: plucked string simulation, 5s ─────────────────
{
  const dur = 5, n = Math.round(dur * SR)
  const out = new Float32Array(n)
  // Karplus-Strong-ish: delay line + filter
  const freq = 196  // G3
  const delayLen = Math.round(SR / freq)
  const buf = new Float32Array(delayLen).fill(0)
  for (let i = 0; i < delayLen; i++) buf[i] = Math.random() * 2 - 1
  let prev = 0
  for (let i = 0; i < n; i++) {
    const idx = i % delayLen
    const s = buf[idx]
    const filtered = 0.498 * (s + prev)
    buf[idx] = filtered
    prev = s
    out[i] = filtered * 0.8
  }
  write('guitar.wav', envelope(out, 0.001, 0.5))
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
