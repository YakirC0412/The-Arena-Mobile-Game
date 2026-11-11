/* global __dirname, Buffer */
// Generates the game's feedback sounds (assets/sounds/*.wav). Run: node scripts/generate-feedback-sounds.js
//  - tick, correct, skip, time-up and conquest are plain decaying tones (conquest is the original one);
//  - draw-roll / draw: the cursor's decelerating tocks ending in a bell chime / the chime alone;
//  - champion: a drum roll (snare roll that speeds up and swells, timpani beats), a cymbal crash and a trumpet fanfare.

const fs = require('node:fs');
const path = require('node:path');

const outputDirectory = path.join(__dirname, '..', 'assets', 'sounds');
fs.mkdirSync(outputDirectory, { recursive: true });

function writeWav(filename, samples, sampleRate) {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(samples.length * 2, 40);
  for (let index = 0; index < samples.length; index += 1) {
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[index])) * 32767), 44 + index * 2);
  }
  fs.writeFileSync(path.join(outputDirectory, filename), buffer);
}

function createTone(filename, frequency, duration, volume) {
  const sampleRate = 8000;
  const count = Math.floor(sampleRate * duration);
  const samples = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    const envelope = Math.max(0, 1 - index / count);
    samples[index] = Math.sin(2 * Math.PI * frequency * index / sampleRate) * volume * envelope;
  }
  writeWav(filename, samples, sampleRate);
}

const RATE = 22050;
const TAU = Math.PI * 2;

// Small deterministic noise, so the generated files are identical on every run.
let seed = 12345;
const noise = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 2147483648 - 1;
};

function normalise(samples, peak) {
  let max = 0;
  for (const value of samples) max = Math.max(max, Math.abs(value));
  if (max > 0) for (let index = 0; index < samples.length; index += 1) samples[index] = (samples[index] / max) * peak;
}

// ---------- draw ----------

// A bell-like chime: a few inharmonic partials with a long ring.
function addBell(samples, at, frequency, length, volume) {
  const start = Math.floor(at * RATE);
  const count = Math.floor(length * RATE);
  const partials = [[1, 1], [2.76, 0.45], [5.4, 0.2], [8.9, 0.1]];
  for (let index = 0; index < count && start + index < samples.length; index += 1) {
    const t = index / RATE;
    let tone = 0;
    partials.forEach(([ratio, gain]) => { tone += Math.sin(TAU * frequency * ratio * t) * gain * Math.exp(-t * (3 + ratio * 1.6)); });
    samples[start + index] += tone * Math.min(1, t / 0.004) * volume;
  }
}

// The landing: two bright bell notes, the second a fourth above (a "found it" lock-in).
function addLanding(samples, at, volume) {
  addBell(samples, at, 784, 1.3, volume);
  addBell(samples, at + 0.11, 1046.5, 1.4, volume);
}

// The draw: the cursor jumping between squares as a wheel that slows down (same step timings as drawStepDelaysMs in
// game/engine.ts: 20 x 80 ms, 8 x 140, 4 x 260, 2 x 420), each jump a short wooden "tock" that gets lower as it slows,
// then the landing chime at the end. The short landing alone is draw.wav (used for bots and Reduce Motion).
function createDrawRoll() {
  const delays = Array.from({ length: 34 }, (_, step) => (step < 20 ? 80 : step < 28 ? 140 : step < 32 ? 260 : 420));
  const total = delays.reduce((sum, value) => sum + value, 0) / 1000;
  const samples = new Float32Array(Math.floor((total + 1.6) * RATE));
  let at = 0;
  delays.forEach((delay, step) => {
    const slow = step / delays.length;
    const frequency = 1900 - 900 * slow;
    const start = Math.floor(at * RATE);
    const count = Math.floor(0.05 * RATE);
    for (let index = 0; index < count && start + index < samples.length; index += 1) {
      const t = index / RATE;
      const body = Math.sin(TAU * frequency * t) * Math.exp(-t * 70);
      const click = (index < 40 ? noise() * 0.6 : 0) * Math.exp(-t * 400);
      samples[start + index] += (body + click) * (0.55 + 0.45 * slow);
    }
    at += delay / 1000;
  });
  addLanding(samples, total, 0.7);
  normalise(samples, 0.8);
  writeWav('draw-roll.wav', samples, RATE);
}

function createDrawLand() {
  const samples = new Float32Array(Math.floor(1.6 * RATE));
  addLanding(samples, 0, 0.7);
  normalise(samples, 0.8);
  writeWav('draw.wav', samples, RATE);
}

// ---------- champion: drums, then a trumpet ----------

// One snare hit: band-limited noise with a short snap and a tiny tonal body.
function addSnare(samples, at, volume) {
  const start = Math.floor(at * RATE);
  const count = Math.floor(0.09 * RATE);
  let last = 0;
  for (let index = 0; index < count && start + index < samples.length; index += 1) {
    const t = index / RATE;
    const hiss = noise();
    const bright = hiss - 0.55 * last; // a gentle high-pass: the rattle of the snares
    last = hiss;
    samples[start + index] += (bright * Math.exp(-t * 55) + Math.sin(TAU * 190 * t) * 0.5 * Math.exp(-t * 60)) * volume;
  }
}

// A timpani: a low note that starts a little higher and settles, ringing for a while.
function addTimpani(samples, at, frequency, volume) {
  const start = Math.floor(at * RATE);
  const count = Math.floor(0.9 * RATE);
  let phase = 0;
  for (let index = 0; index < count && start + index < samples.length; index += 1) {
    const t = index / RATE;
    phase += TAU * frequency * (1 + 0.35 * Math.exp(-t * 18)) / RATE;
    samples[start + index] += (Math.sin(phase) + 0.4 * Math.sin(phase * 1.5)) * Math.exp(-t * 4.5) * Math.min(1, t / 0.003) * volume;
  }
}

// A cymbal crash: bright noise with a long fade.
function addCrash(samples, at, volume) {
  const start = Math.floor(at * RATE);
  const count = Math.floor(2.4 * RATE);
  let last = 0;
  for (let index = 0; index < count && start + index < samples.length; index += 1) {
    const t = index / RATE;
    const hiss = noise();
    const bright = hiss - last;
    last = hiss;
    samples[start + index] += bright * Math.exp(-t * 2.2) * Math.min(1, t / 0.002) * volume;
  }
}

// A trumpet note: a sawtooth-like stack of harmonics, a brassy scoop up to the pitch, a quick attack, vibrato on long notes.
function addTrumpet(samples, at, frequency, length, volume) {
  const start = Math.floor(at * RATE);
  const count = Math.floor(length * RATE);
  let phase = 0;
  for (let index = 0; index < count && start + index < samples.length; index += 1) {
    const t = index / RATE;
    const scoop = 1 - 0.035 * Math.exp(-t * 45);
    const vibrato = 1 + 0.006 * Math.sin(TAU * 5.8 * t) * Math.min(1, t / 0.35);
    phase += TAU * frequency * scoop * vibrato / RATE;
    // Brightness opens during the attack ("blat") and settles.
    const bright = 0.55 + 0.45 * Math.exp(-t * 7);
    let tone = 0;
    for (let harmonic = 1; harmonic <= 9; harmonic += 1) tone += Math.sin(phase * harmonic) * (1 / harmonic) * Math.pow(bright, harmonic - 1);
    const envelope = Math.min(1, t / 0.025) * Math.min(1, (length - t) / 0.12) * (0.82 + 0.18 * Math.exp(-t * 3));
    samples[start + index] += tone * envelope * volume;
  }
}

// 0 - 3.0 s: a drum roll that speeds up (10 -> 30 hits a second) and swells, with timpani beats under it.
// 3.0 s: a timpani + crash as the stage and the champion appear, then the fanfare: three quick G notes and a C, then E and a held G,
// with the same chord played softly under the last notes.
function createChampion() {
  const samples = new Float32Array(Math.floor(7 * RATE));
  let at = 0;
  while (at < 2.95) {
    const p = at / 2.95;
    addSnare(samples, at, 0.12 + 0.75 * p * p);
    at += 1 / (10 + 20 * p);
  }
  [0, 0.75, 1.5, 2.1, 2.5, 2.75].forEach((time, index) => addTimpani(samples, time, 82, 0.5 + index * 0.08));
  addTimpani(samples, 3.0, 73, 1.3);
  addCrash(samples, 3.0, 0.55);
  const G4 = 392;
  const C5 = 523.25;
  const E5 = 659.25;
  const G5 = 783.99;
  addTrumpet(samples, 3.05, G4, 0.14, 0.5);
  addTrumpet(samples, 3.25, G4, 0.14, 0.5);
  addTrumpet(samples, 3.45, G4, 0.14, 0.5);
  addTrumpet(samples, 3.65, C5, 0.55, 0.62);
  addTrumpet(samples, 4.3, E5, 0.25, 0.55);
  addTrumpet(samples, 4.6, G5, 1.9, 0.68);
  // The chord underneath, softer, so the held note sounds like a whole section.
  addTrumpet(samples, 3.65, C5 / 2, 0.55, 0.22);
  addTrumpet(samples, 4.6, C5, 1.9, 0.26);
  addTrumpet(samples, 4.6, E5, 1.9, 0.22);
  addTimpani(samples, 4.6, 98, 0.8);
  normalise(samples, 0.85);
  writeWav('champion.wav', samples, RATE);
}

createTone('clock-tick.wav', 900, 0.07, 0.18);
createTone('correct.wav', 720, 0.14, 0.22);
createTone('skip.wav', 360, 0.09, 0.16);
createTone('time-up.wav', 140, 0.45, 0.3);
createTone('conquest.wav', 260, 0.42, 0.24);
createDrawLand();
createDrawRoll();
createChampion();
