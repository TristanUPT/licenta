# ResoLab — Mini-DAW Educațional Web

Aplicație web pentru învățarea și practica ingineriei de sunet, construită ca proiect de licență.

## Ce face

ResoLab permite:
- Încărcarea unui fișier audio (WAV, MP3, OGG, FLAC, M4A) prin drag & drop sau selector
- Aplicarea unui lanț de efecte audio procesate în timp real (Compressor, Parametric EQ, Gate, Reverb, Delay, Limiter, Saturation, Stereo Width, Gain)
- Vizualizarea semnalului: formă de undă, analizor de spectru, VU-metre, curbă EQ
- Strat educațional: tooltipuri bilingve (RO/EN), mod beginner/advanced, lecții interactive cu quiz, recomandări dinamice bazate pe analiza DSP
- Export WAV stereo
- Preseturi de fabrică și preseturi personalizate (persisted în IndexedDB)

## Stack tehnic

| Strat | Tehnologie |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Stilizare | TailwindCSS v4 + Radix UI |
| State | Zustand |
| DSP Engine | Rust → WebAssembly (wasm-pack) |
| Audio bridge | Web Audio API + AudioWorklet |
| Transport | Tone.js |
| Waveform | wavesurfer.js v7 |
| Spectrum | audiomotion-analyzer |
| Persistență | IndexedDB (idb) + localStorage |

## Instalare și rulare

```bash
# Instalare dependențe frontend
npm install

# Compilare modul DSP Rust → WASM (necesită Rust + wasm-pack)
npm run build:wasm

# Server de dezvoltare
npm run dev

# Build de producție
npm run build
```

### Cerințe pentru compilarea WASM

- [Rust](https://rustup.rs/) (edition 2024)
- [wasm-pack](https://rustwasm.github.io/wasm-pack/) ≥ 0.14

```bash
cargo install wasm-pack
cd dsp && wasm-pack build --target web
```

## Structura proiectului

```
src/
  app/           → Shell aplicație, router
  audio/         → Engine audio, worklet bridge, transport
  components/    → Componente React (efecte, vizualizări, workspace, educație)
  store/         → Magazine Zustand (effects, audio, analysis, education, presets, ui)
  education/     → Conținut educațional, feedback dinamic, recomandări
  presets/       → Preseturi fabrică (JSON)
  types/         → Tipuri TypeScript
  utils/         → Utilități comune
dsp/
  src/effects/   → Implementări efecte DSP în Rust
  src/analysis/  → FFT, loudness, extragere trăsături
  src/utils/     → Filtre, envelope, delay lines, math
public/
  samples/       → Exemple audio CC0
  worklets/      → AudioWorklet processor JS
```

## Teste DSP

```bash
cd dsp && cargo test
```

## Deploy

Cloudflare Pages din branch `main`. Fișierul `public/_headers` setează headerele COOP/COEP necesare pentru `SharedArrayBuffer`.
