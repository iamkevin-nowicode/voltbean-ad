'use strict';
// ---- SCORE: one note list. The synthesiser plays it; the picture reads it. 96 BPM, 12 bars, G major. ----
// A note: { t: seconds, d: seconds, m: midi, i: instrument, v: velocity, p: pan -1..1, tag: what it moves on screen, k: index }
const Score = (() => {
  const N = [];
  const n = (bar, beat, durBeats, m, i, v = 0.6, extra = {}) => N.push(Object.assign({ t: at(bar, beat), d: durBeats * BEAT, m, i, v, p: 0 }, extra));
  const mel = (bar, list, extra) => list.forEach(([b, m, d, v]) => n(bar, 1 + b, d, m, 'box', v || 0.55, Object.assign({ tag: 'mel' }, extra || {})));
  const G = 55, B = 59, D = 62, C = 60, E = 64, Fs = 66, A = 57;   // chord tones around the middle

  // ---- harmony: string pad + soft bass, one chord per half or whole bar
  const chords = [
    [1, 1, 4, [G, B, D], 43], [2, 1, 2, [G, B, D], 43], [2, 3, 2, [52, G, B], 40],
    [3, 1, 4, [48, 52, G], 36], [4, 1, 4, [50, 54, 57], 38],
    [5, 1, 4, [52, G, B], 40], [6, 1, 2, [48, 52, G], 36], [6, 3, 2, [45, 48, 52], 33],
    [7, 1, 4, [50, 54, 57], 38], [8, 1, 2, [47, 50, G], 35], [8, 3, 2, [48, 52, G], 36],
    [9, 1, 2, [50, 55, 57], 38], [9, 3, 2, [50, 54, 57], 38],
    [10, 1, 4, [G, B, D, 67], 43], [11, 1, 2, [48, 52, G, 64], 36], [11, 3, 2, [50, 54, 57, 62], 38], [12, 1, 4, [G, B, D, 67], 31],
  ];
  for (const [bar, beat, len, tones, bass] of chords) {
    tones.forEach((m, j) => n(bar, beat, len + (bar === 12 ? 2 : 0.15), m, 'pad', bar === 1 ? 0.16 : bar >= 10 ? 0.34 : 0.26, { p: (j - 1) * 0.35 }));
    if (bar > 1) n(bar, beat, len, bass, 'bass', bar === 6 ? 0.4 : 0.55);
  }

  // ---- bar 1: four chimes, four washes of paint go down on the paper
  [79, 74, 71, 67].forEach((m, k) => n(1, 1 + k, 3, m, 'bell', 0.42, { tag: 'wash', k, p: [-0.4, 0.3, -0.2, 0.4][k] }));
  // ---- bar 2: the motif; the sheet comes alive
  mel(2, [[0, 74, 1], [1, 76, 0.5], [1.5, 74, 0.5], [2, 71, 1], [3, 67, 0.5], [3.5, 69, 0.5]]);
  // ---- bars 3-4: the climb, trotting eighths
  mel(3, [[0, 71, 0.5], [0.5, 72, 0.5], [1, 76, 0.5], [1.5, 74, 0.5], [2, 72, 0.5], [2.5, 71, 0.5], [3, 69, 1]]);
  mel(4, [[0, 69, 0.5], [0.5, 71, 0.5], [1, 74, 0.5], [1.5, 78, 0.5], [2, 76, 0.5], [2.5, 74, 0.5], [3, 69, 1]]);
  // footsteps: every eighth from bar 2 beat 3 to bar 5 beat 1 (20 steps). Each one leaves a print in the snow.
  for (let k = 0; k < 20; k++) N.push({ t: at(2, 3) + k * BEAT / 2, d: 0.08, m: 0, i: 'step', v: 0.5 + 0.12 * (k % 2), p: -0.2 + k * 0.02, tag: 'step', k });
  // ---- bar 5: two hops that rise, one flop into the snow
  mel(5, [[0, 67, 1, 0.45]]);
  n(5, 2, 0.5, 71, 'pluck', 0.6, { tag: 'hop', k: 0 }); n(5, 3, 0.5, 76, 'pluck', 0.7, { tag: 'hop', k: 1 });
  n(5, 4, 1, 40, 'thump', 0.8, { tag: 'flop' });
  // ---- bar 6: the sad phrase. The robin arrives on beat 3.
  mel(6, [[0, 76, 1.5, 0.42], [1.5, 74, 0.5, 0.38], [2, 72, 1, 0.4], [3, 69, 1, 0.36]]);
  n(6, 3, 0.4, 0, 'chirp', 0.45, { tag: 'robin', p: -0.3 });
  // ---- bar 7: friends. A pop from the snow (hare), sleigh bells for the deer's steps.
  n(7, 1, 0.5, 62, 'pluck', 0.6, { tag: 'hare' });
  for (let k = 0; k < 8; k++) n(7, 1 + k * 0.5, 0.25, 0, 'sleigh', k % 2 ? 0.25 : 0.42, { tag: 'deerstep', k, p: 0.5 - k * 0.05 });
  mel(7, [[0, 74, 0.5], [0.5, 78, 0.5], [1, 81, 1], [2, 78, 0.5], [2.5, 76, 0.5], [3, 74, 1]]);
  // ---- bar 8: the lift, a rising arpeggio
  mel(8, [[0, 71, 0.5], [0.5, 74, 0.5], [1, 79, 0.5], [1.5, 83, 0.5], [2, 72, 0.5], [2.5, 76, 0.5], [3, 79, 0.5], [3.5, 84, 0.5]], { tag: 'lift' });
  // ---- bar 9: the lantern goes on the tip (beat 2), then a cascade: one note lights one tier of the tree, top to bottom
  n(9, 2, 3, 81, 'bell', 0.55, { tag: 'hang' });
  n(9, 2.5, 3, 0, 'whoosh', 0.5);
  [86, 81, 78, 74, 69, 66, 62].forEach((m, k) => n(9, 3 + k * 0.25, 1.5, m, 'box', 0.5 + k * 0.03, { tag: 'tier', k, p: 0.5 - k * 0.15 }));
  // ---- bar 10: the theme; high bells open the stars
  mel(10, [[0, 79, 1.5, 0.6], [1.5, 78, 0.5], [2, 76, 0.5], [2.5, 74, 0.5], [3, 71, 1]]);
  [95, 91, 98, 93, 96, 91, 100, 95].forEach((m, k) => n(10, 1 + k * 0.5, 2, m, 'bell', 0.12, { tag: 'star', k, p: (k % 2 ? 0.6 : -0.6) }));
  for (let k = 0; k < 8; k++) n(10, 1 + k * 0.5, 0.25, 0, 'sleigh', 0.12 + 0.06 * (k % 2 === 0));
  // ---- bar 11: far away, other lights answer, one per note
  mel(11, [[0, 72, 0.5], [0.5, 76, 0.5], [1, 79, 1], [2, 78, 0.5], [2.5, 81, 0.5], [3, 74, 1]]);
  [88, 84, 91, 86, 93, 88, 95, 91].forEach((m, k) => n(11, 1 + k * 0.5, 2, m, 'box', 0.18, { tag: 'answer', k, p: -0.7 + k * 0.2 }));
  // ---- bar 12: home. The seal is stamped on beat 3.
  mel(12, [[0, 79, 3, 0.55]]); n(12, 1, 3, 71, 'box', 0.3); n(12, 1, 3, 74, 'box', 0.3);
  n(12, 3, 1, 36, 'thump', 0.35, { tag: 'seal' }); n(12, 3, 3, 91, 'bell', 0.3);

  N.sort((a, b) => a.t - b.t);
  const tagged = tag => N.filter(x => x.tag === tag);
  // how long ago the k-th note with a tag sounded (Infinity if not yet)
  const since = (tag, k, t) => { const x = N.find(q => q.tag === tag && q.k === k); return x && t >= x.t ? t - x.t : Infinity; };
  return { notes: N, tagged, since };
})();
