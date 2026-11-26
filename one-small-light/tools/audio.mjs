// Synthesise the soundtrack to a WAV with the same code the page runs:  node tools/audio.mjs out.wav
import fs from 'fs'; import vm from 'vm'; import path from 'path';
const src = ['00_util.js', '06_score.js', '85_audio.js'].map(f => fs.readFileSync(path.join('src', f), 'utf8')).join('\n');
const ctx = { console, Math, Float32Array, Promise }; vm.createContext(ctx);
const SR = 48000, t0 = Date.now();
vm.runInContext(src + `\n;globalThis.__pcm = synthFilm(${SR}, Score.notes, FILM);`, ctx);
const [L, R] = ctx.__pcm, n = L.length, buf = Buffer.alloc(44 + n * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
let peak = 0; for (let i = 0; i < n; i++) { peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4); }
fs.writeFileSync(process.argv[2] || 'soundtrack.wav', buf); console.log(`audio ${n / SR}s in ${Date.now() - t0} ms, peak ${peak.toFixed(3)}`);
