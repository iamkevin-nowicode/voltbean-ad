'use strict';
// ---- SOUND: every note of the score synthesised sample by sample (in a Worker in the browser, in Node for the video).
// Music box, string pad, soft bass, bells, sleigh bells, snow crunch, a robin, a whoosh, a hall to play them in.
// synthFilm is self-contained on purpose: its source text is shipped to the Worker as-is.
function synthFilm(SR, notes, DUR) {
  const N = Math.ceil(SR * DUR), L = new Float32Array(N), R = new Float32Array(N), SL = new Float32Array(N), SR_ = new Float32Array(N);
  let seed = 22222; const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12), TAU = Math.PI * 2;
  const PG = new Map(), pg = pan => { const k = Math.round(Math.max(-1, Math.min(1, pan)) * 100); let g = PG.get(k); if (!g) { const a = (k / 100 + 1) * Math.PI / 4; g = [Math.cos(a), Math.sin(a)]; PG.set(k, g); } return g; };
  const put = (i, v, g, send) => { if (i < 0 || i >= N) return; const l = g[0] * v, r = g[1] * v; L[i] += l; R[i] += r; SL[i] += l * send; SR_[i] += r * send; };
  // band-limited saw wavetable for the strings
  const TB = 4096, SAW = new Float32Array(TB); for (let k = 1; k <= 24; k++) for (let i = 0; i < TB; i++) SAW[i] += Math.sin(TAU * k * i / TB) / k * (k > 16 ? (24 - k) / 8 : 1);
  const biquadBP = (f, q) => { const w = TAU * f / SR, al = Math.sin(w) / (2 * q), b0 = al, a0 = 1 + al, a1 = -2 * Math.cos(w), a2 = 1 - al; return { b0: b0 / a0, b2: -b0 / a0, a1: a1 / a0, a2: a2 / a0, x1: 0, x2: 0, y1: 0, y2: 0 }; };
  const bp = (s, x) => { const y = s.b0 * x + s.b2 * s.x2 - s.a1 * s.y1 - s.a2 * s.y2; s.x2 = s.x1; s.x1 = x; s.y2 = s.y1; s.y1 = y; return y; };

  for (const n of notes) {
    const i0 = Math.floor(n.t * SR), v = n.v, pan = n.p || 0, G = pg(pan), G0 = pg(0);
    if (n.i === 'box' || n.i === 'bell') {          // struck metal: decaying partials
      const f = mtof(n.m), bell = n.i === 'bell';
      const P = bell ? [[1, 1, 2.6], [2.76, 0.42, 1.4], [5.4, 0.2, 0.7], [8.93, 0.1, 0.4], [0.5, 0.18, 3]] : [[1, 1, 1.5], [2, 0.3, 0.8], [3, 0.1, 0.5], [4.16, 0.07, 0.25], [5.43, 0.035, 0.15]];
      const len = Math.min(N - i0, Math.floor(SR * (bell ? 4 : 2.6)));
      for (const [h, a, tau] of P) { const w = TAU * f * h / SR; if (f * h > SR * 0.45) continue; const det = 1 + (rnd() - 0.5) * 0.002;
        // sine by a two-pole resonator, decay by a constant factor per sample
        const ww = w * det, k2 = 2 * Math.cos(ww), dec = Math.exp(-1 / (tau * SR)), att = Math.floor(0.003 * SR); let y1 = Math.sin(-ww), y2 = Math.sin(-2 * ww), env = a * v * 0.32;
        for (let j = 0; j < len; j++) { const y = k2 * y1 - y2; y2 = y1; y1 = y; env *= dec; put(i0 + j, y * env * (j < att ? j / att : 1), G, bell ? 0.5 : 0.3); } }
    } else if (n.i === 'pad') {                      // strings: three detuned saws, slow bow, warm filter, vibrato
      const f = mtof(n.m), len = Math.min(N - i0, Math.floor(SR * (n.d + 1.4))), rel = n.d; let lp = 0;
      const ph = [rnd(), rnd(), rnd()], det = [0.997, 1, 1.0032]; let lp2 = 0;
      let inc0 = 0, inc1 = 0, inc2 = 0, env = 0, p0 = ph[0], p1 = ph[1], p2 = ph[2];
      const relK = Math.exp(-1 / (0.45 * SR)), att = 0.55 * SR, relI = rel * SR;
      for (let j = 0; j < len; j++) {
        if ((j & 31) === 0) { const vib = 1 + 0.0035 * Math.sin(TAU * 5.1 * j / SR + n.m), b = f * vib / SR; inc0 = b * det[0]; inc1 = b * det[1]; inc2 = b * det[2]; }
        p0 += inc0; if (p0 >= 1) p0 -= 1; p1 += inc1; if (p1 >= 1) p1 -= 1; p2 += inc2; if (p2 >= 1) p2 -= 1;
        lp += (SAW[(p0 * TB) | 0] + SAW[(p1 * TB) | 0] + SAW[(p2 * TB) | 0] - lp) * 0.08;
        env = j < att ? j / att : j > relI ? env * relK : 1;
        put(i0 + j, lp * env * v * 0.045, G, 0.55); }
    } else if (n.i === 'bass') {
      const f = mtof(n.m), len = Math.min(N - i0, Math.floor(SR * (n.d + 0.6)));
      for (let j = 0; j < len; j++) { const tt = j / SR, env = Math.min(1, tt / 0.012) * Math.exp(-tt / 1.1) * (tt > n.d ? Math.exp(-(tt - n.d) / 0.15) : 1);
        put(i0 + j, (Math.sin(TAU * f * tt) + 0.25 * Math.sin(TAU * 2 * f * tt)) * env * v * 0.22, G0, 0.15); }
    } else if (n.i === 'pluck') {                    // Karplus-Strong: a little pizzicato for hops and pops
      const f = mtof(n.m), D = Math.round(SR / f), buf = new Float32Array(D); for (let k = 0; k < D; k++) buf[k] = rnd() * 2 - 1;
      const len = Math.min(N - i0, Math.floor(SR * 0.9)); let k = 0, prev = 0;
      for (let j = 0; j < len; j++) { const x = buf[k]; const y = 0.5 * (x + prev) * 0.996; prev = x; buf[k] = y; k = (k + 1) % D; put(i0 + j, x * v * 0.3 * Math.exp(-j / SR / 0.5), G, 0.3); }
    } else if (n.i === 'sleigh') {                   // a shake: a handful of tiny jingle bells
      for (let b = 0; b < 7; b++) { const GJ = pg(pan + (rnd() - 0.5) * 0.3), st = i0 + Math.floor(rnd() * 0.045 * SR), fs = [5200, 6900, 8300].map(x => x * (0.9 + rnd() * 0.2)), len = Math.floor(SR * 0.12);
        for (let j = 0; j < len; j++) { const tt = j / SR, env = Math.exp(-tt / 0.03); let s = 0; for (const fq of fs) s += Math.sin(TAU * fq * tt); put(st + j, s * env * v * 0.035, GJ, 0.4); } }
    } else if (n.i === 'step') {                     // snow crunch: grainy filtered noise
      const s = biquadBP(1500 + rnd() * 900, 0.9), len = Math.floor(SR * 0.09);
      for (let j = 0; j < len; j++) { const tt = j / SR, env = Math.min(1, tt / 0.004) * Math.exp(-tt / 0.03) * (0.4 + 0.6 * (rnd() < 0.3 ? 1 : 0.3));
        put(i0 + j, bp(s, rnd() * 2 - 1) * env * v * 0.5, G, 0.1); }
    } else if (n.i === 'thump') {                    // a soft fall into snow / the seal on paper
      const s = biquadBP(220, 0.7), len = Math.floor(SR * 0.5), f = 70 * Math.pow(2, (n.m - 40) / 12);
      for (let j = 0; j < len; j++) { const tt = j / SR; put(i0 + j, (bp(s, rnd() * 2 - 1) * Math.exp(-tt / 0.09) * 0.9 + Math.sin(TAU * f * tt * (1 - tt * 0.6)) * Math.exp(-tt / 0.12)) * v * 0.5, G0, 0.2); }
    } else if (n.i === 'chirp') {                    // the robin: three quick rising whistles
      for (let c = 0; c < 3; c++) { const st = i0 + Math.floor(c * 0.11 * SR), len = Math.floor(SR * 0.07); let ph = 0;
        for (let j = 0; j < len; j++) { const u = j / len, f = 3400 + 1500 * u + 300 * Math.sin(u * 20); ph += TAU * f / SR; put(st + j, Math.sin(ph) * Math.sin(Math.PI * u) * v * 0.18, G, 0.4); } }
    } else if (n.i === 'wind') {                     // the storm: noise in two bands, a low howl that rises and falls with the gusts
      const env = n.env, s1 = biquadBP(400, 1.2), s2 = biquadBP(2600, 0.7); let e = 0, ei = 0, GW = pg(0);
      for (let j = 0; j < N; j++) {
        if ((j & 63) === 0) { const tt = j / SR; while (ei < env.length - 2 && env[ei + 1][0] < tt) ei++; const a = env[ei], b = env[ei + 1], u = Math.max(0, Math.min(1, (tt - a[0]) / (b[0] - a[0]))); e = a[1] + (b[1] - a[1]) * u;
          const ns = biquadBP(260 + 520 * e + 150 * Math.sin(tt * 0.9) + 110 * Math.sin(tt * 2.3), 1.5); s1.b0 = ns.b0; s1.b2 = ns.b2; s1.a1 = ns.a1; s1.a2 = ns.a2; GW = pg(0.35 * Math.sin(tt * 0.7)); }
        if (e < 0.003) continue;
        const x = rnd() * 2 - 1; put(j, (bp(s1, x) * 1.7 + bp(s2, x) * 0.3) * e * e * n.v * 0.55, GW, 0.25);
      }
    } else if (n.i === 'whoosh') {                   // warm light pouring down the tree
      const len = Math.min(N - i0, Math.floor(SR * 1.8)); const s = biquadBP(600, 0.6);
      for (let j = 0; j < len; j++) { const u = j / len; if (j % 64 === 0) { const f = 500 + 3500 * u; const ns = biquadBP(f, 1.2); s.b0 = ns.b0; s.b2 = ns.b2; s.a1 = ns.a1; s.a2 = ns.a2; }
        put(i0 + j, bp(s, rnd() * 2 - 1) * Math.sin(Math.PI * u) * v * 0.25, pg(Math.sin(u * 3) * 0.4), 0.6); }
    }
  }
  // the hall: a small Schroeder reverb on the send
  const sc = SR / 44100, combs = [1116, 1188, 1277, 1356, 1422, 1491].map(d => Math.floor(d * sc * 1.25)), aps = [556, 441].map(d => Math.floor(d * sc));
  function verb(inp, spread) {
    const out = new Float32Array(N);
    for (const d0 of combs) { const d = d0 + spread, b = new Float32Array(d); let k = 0, lp = 0; for (let i = 0; i < N; i++) { const y = b[k]; lp = y * 0.65 + lp * 0.35; b[k] = inp[i] + lp * 0.84; out[i] += y; k = (k + 1) % d; } }
    for (const d0 of aps) { const d = d0 + spread, b = new Float32Array(d); let k = 0; for (let i = 0; i < N; i++) { const bo = b[k], x = out[i]; b[k] = x + bo * 0.5; out[i] = bo - x * 0.5; k = (k + 1) % d; } }
    return out;
  }
  const VL = verb(SL, 0), VR = verb(SR_, 23);
  for (let i = 0; i < N; i++) {
    const tt = i / SR, fade = Math.min(1, tt / 0.02) * (tt > DUR - 0.5 ? Math.max(0, (DUR - tt) / 0.5) : 1);
    const l = (L[i] + VL[i] * 0.1) * 0.9, r = (R[i] + VR[i] * 0.1) * 0.9;
    L[i] = Math.tanh(l) * fade; R[i] = Math.tanh(r) * fade;
  }
  return [L, R];
}
const Sound = (() => {
  let ctx = null, buf = null, src = null, gain = null, startAt = 0, startOff = 0, muted = false, ready = null;
  function prepare() {   // synthesise in a Worker so the picture keeps loading
    if (ready) return ready;
    ready = new Promise(res => {
      const code = synthFilm.toString() + ';onmessage=e=>{const o=synthFilm(e.data.sr,e.data.notes,e.data.dur);postMessage(o,[o[0].buffer,o[1].buffer]);};';
      let wk; try { wk = new Worker(URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))); } catch (e) { res(null); return; }
      wk.onmessage = e => { res(e.data); wk.terminate(); };
      wk.postMessage({ sr: 44100, notes: Score.notes, dur: FILM });
    });
    return ready;
  }
  async function start(offset) {
    const pcm = await prepare(); if (!pcm) return false;
    if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); gain = ctx.createGain(); gain.connect(ctx.destination); }
    if (ctx.state === 'suspended') await ctx.resume();
    if (!buf) { buf = ctx.createBuffer(2, pcm[0].length, 44100); buf.copyToChannel(pcm[0], 0); buf.copyToChannel(pcm[1], 1); }
    stop(); src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(gain);
    src.start(0, offset % FILM); startAt = ctx.currentTime; startOff = offset; gain.gain.value = muted ? 0 : 1; return true;
  }
  function stop() { if (src) { try { src.stop(); } catch (e) {} src.disconnect(); src = null; } }
  const time = () => (src ? (startOff + ctx.currentTime - startAt) % FILM : null);
  const mute = () => { muted = !muted; if (gain) gain.gain.value = muted ? 0 : 1; return muted; };
  return { prepare, start, stop, time, mute };
})();
