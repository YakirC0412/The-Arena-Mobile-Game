/* global __dirname, Buffer */

const fs = require('node:fs');
const path = require('node:path');

const outputDirectory = path.join(__dirname, '..', 'assets', 'sounds');
fs.mkdirSync(outputDirectory, { recursive: true });

function createTone(filename, frequency, duration, volume) {
  const sampleRate = 8000;
  const sampleCount = Math.floor(sampleRate * duration);
  const buffer = Buffer.alloc(44 + sampleCount * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + sampleCount * 2, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(sampleCount * 2, 40);

  for (let index = 0; index < sampleCount; index += 1) {
    const envelope = Math.max(0, 1 - index / sampleCount);
    const sample = Math.sin(2 * Math.PI * frequency * index / sampleRate);
    buffer.writeInt16LE(Math.round(sample * 32767 * volume * envelope), 44 + index * 2);
  }

  fs.writeFileSync(path.join(outputDirectory, filename), buffer);
}

createTone('clock-tick.wav', 900, 0.07, 0.18);
createTone('correct.wav', 720, 0.14, 0.22);
createTone('skip.wav', 360, 0.09, 0.16);
createTone('time-up.wav', 140, 0.45, 0.3);
createTone('draw.wav', 520, 0.18, 0.18);
createTone('conquest.wav', 260, 0.42, 0.24);
createTone('champion.wav', 880, 0.7, 0.22);
