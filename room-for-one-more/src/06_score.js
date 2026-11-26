'use strict';
// ---- SCORE: one note list for 'Room for One More'. 96 BPM, 24 bars, G major with a storm in E minor.
// The synthesiser plays it; the picture reads it. Footsteps and landings are added by the simulation (Actors.boot).
const Score = (() => {
  const N = [];
  const n = (bar, beat, durBeats, m, i, v = 0.6, extra = {}) => N.push(Object.assign({ t: at(bar, beat), d: durBeats * BEAT, m, i, v, p: 0 }, extra));
  const mel = (bar, list, extra) => list.forEach(([b, m, d, v]) => n(bar, 1 + b, d, m, 'box', v || 0.5, Object.assign({ tag: 'mel' }, extra || {})));
  const G = [55, 59, 62], C = [48, 52, 55], D = [50, 54, 57], Em = [52, 55, 59], Am = [45, 48, 52], B7 = [47, 51, 57], GB = [47, 50, 55];
  // ---- harmony: [bar, beat, length in beats, chord, bass, loudness]
  const H = [
    [1, 1, 4, G, 43, 0.16], [2, 1, 4, G, 43], [3, 1, 4, G, 43], [4, 1, 2, C, 36], [4, 3, 2, D, 38],
    [5, 1, 4, Em, 40, 0.24], [6, 1, 2, C, 36], [6, 3, 2, B7, 35], [7, 1, 2, Am, 33], [7, 3, 2, B7, 35],
    [8, 1, 4, Em, 40], [9, 1, 4, C, 36], [10, 1, 2, D, 38], [10, 3, 2, B7, 35], [11, 1, 4, Em, 40, 0.2],
    [12, 1, 4, C, 36, 0.2], [13, 1, 2, Am, 33, 0.18], [13, 3, 2, B7, 35, 0.16], [14, 1, 2, Em, 40, 0.2], [14, 3, 2, C, 36, 0.24],
    [15, 1, 4, D, 38, 0.28], [16, 1, 2, GB, 35, 0.3], [16, 3, 2, C, 36, 0.3], [17, 1, 2, D, 38, 0.3], [17, 3, 2, G, 43, 0.34],
    [18, 1, 4, G, 43, 0.34], [19, 1, 2, C, 36, 0.34], [19, 3, 2, D, 38, 0.34], [20, 1, 4, [...G, 67], 43, 0.36], [21, 1, 2, Em, 40, 0.34], [21, 3, 2, C, 36, 0.34],
    [22, 1, 2, C, 36, 0.32], [22, 3, 2, D, 38, 0.32], [23, 1, 4, [...G, 67], 43, 0.36], [24, 1, 4, [...G, 67], 31, 0.28],
  ];
  for (const [bar, beat, len, tones, bass, v] of H) {
    tones.forEach((m, j) => n(bar, beat, len + (bar === 24 ? 2 : 0.15), m, 'pad', v === undefined ? 0.26 : v, { p: (j - 1) * 0.35 }));
    if (bar > 1) n(bar, beat, len, bass, 'bass', bar >= 12 && bar <= 13 ? 0.42 : 0.5);
  }
  // ---- ACT ONE: a peaceful Christmas Eve under the lit tree
  [79, 74, 71, 67].forEach((m, k) => n(1, 1 + k, 3, m, 'bell', 0.42, { tag: 'wash', k, p: [-0.4, 0.3, -0.2, 0.4][k] }));
  mel(2, [[0, 74, 1, 0.45], [1, 76, 0.5], [1.5, 74, 0.5], [2, 71, 1], [3, 67, 1]]);
  mel(3, [[0, 71, 1.5], [1.5, 72, 0.5], [2, 74, 1], [3, 79, 1]]);           // the lullaby: the robin sings along
  mel(4, [[0, 76, 1], [1, 74, 0.5], [1.5, 72, 0.5], [2, 71, 1], [3, 69, 1]]);
  n(3, 2.5, 0.4, 0, 'chirp', 0.4, { p: 0.3 }); n(4, 1.5, 0.4, 0, 'chirp', 0.35, { p: 0.2 }); n(4, 4, 0.4, 0, 'chirp', 0.3, { p: 0.1 });
  [76, 79, 83].forEach((m, k) => n(4, 3.5 + k * 0.17, 0.4, m, 'pluck', 0.35));    // the robin flutters back up
  // the wind rises
  mel(5, [[0, 71, 1, 0.4], [1, 67, 1, 0.38], [2, 64, 2, 0.36]]);
  // the gust: the robin is torn away and tumbles down the hill
  n(6, 2.44, 4, 0, 'whoosh', 0.9); n(6, 2.44, 3, 75, 'bell', 0.3, { p: 0.2 }); n(6, 2.44, 3, 74, 'bell', 0.25, { p: -0.2 });
  [83, 79, 76, 71, 67, 64, 59, 55].forEach((m, k) => n(6, 2.44 + k * 0.4, 1, m, 'box', 0.42 - k * 0.03, { p: 0.6 - k * 0.15 }));
  n(7, 3.5, 0.5, 52, 'pluck', 0.5); n(7, 4, 0.5, 59, 'pluck', 0.55);               // the fox makes up its mind
  // ---- ACT TWO: down through the storm, and back up
  for (let b = 8; b <= 10; b++) for (let k = 0; k < 8; k++) n(b, 1 + k * 0.5, 0.5, [52, 55, 59, 64, 48, 52, 55, 60, 50, 54, 57, 62][(b - 8) * 4 + (k % 4)], 'pluck', 0.28 + 0.08 * (k % 2 === 0));
  mel(8, [[0, 76, 0.5], [0.5, 74, 0.5], [1, 71, 1], [2, 76, 0.5], [2.5, 78, 0.5], [3, 79, 1]]);
  mel(9, [[0, 81, 1], [1, 79, 0.5], [1.5, 76, 0.5], [2, 72, 1], [3, 71, 1]]);
  mel(10, [[0, 74, 1], [1, 72, 1], [2, 71, 1.5, 0.4], [3.5, 66, 0.5, 0.35]]);
  n(10, 4, 0.4, 0, 'chirp', 0.18, { p: -0.5 });                                    // a faint call from the snow
  mel(11, [[0, 76, 1.5, 0.42], [1.5, 74, 0.5, 0.38], [2, 71, 2, 0.4]]);              // found you
  n(11, 1.5, 0.3, 0, 'chirp', 0.14, { p: -0.4 });
  mel(12, [[0, 64, 2, 0.32], [2, 67, 2, 0.3]]);                                     // the long climb against the wind
  n(13, 1, 4, 0, 'whoosh', 1.0);                                                    // the strongest gust
  mel(13, [[2, 66, 2, 0.28]]);
  n(13, 3, 3, 64, 'bell', 0.16);                                                    // too tired to go on
  // help
  n(14, 2.12, 0.5, 62, 'pluck', 0.5, { tag: 'hare' });
  for (let k = 0; k < 10; k++) n(14, 3.5 + k * 0.5, 0.25, 0, 'sleigh', 0.1 + k * 0.025, { p: 0.5 - k * 0.04 });
  mel(15, [[0, 74, 1, 0.42], [1, 78, 1, 0.45], [2, 81, 2, 0.5]]);
  mel(16, [[0, 71, 0.5], [0.5, 74, 0.5], [1, 79, 0.5], [1.5, 83, 0.5], [2, 72, 0.5], [2.5, 76, 0.5], [3, 79, 0.5], [3.5, 84, 0.5]], { tag: 'lift' });
  mel(17, [[0, 81, 2, 0.5], [2, 79, 2, 0.55]]);
  // ---- ACT THREE: home
  mel(18, [[0, 79, 1], [1, 78, 0.5], [1.5, 76, 0.5], [2, 74, 1], [3, 76, 1]]);
  for (let k = 0; k < 8; k++) n(18, 1 + k * 0.5, 0.25, 0, 'sleigh', 0.1 + 0.05 * (k % 2 === 0));
  mel(19, [[0, 79, 1], [1, 81, 1], [2, 83, 2, 0.55]]);
  [95, 91, 98, 93, 96, 91, 100, 95].forEach((m, k) => n(19, 3 + k * 0.33, 2, m, 'bell', 0.11, { tag: 'star', k, p: k % 2 ? 0.6 : -0.6 }));
  mel(20, [[0, 71, 1.5], [1.5, 72, 0.5], [2, 74, 1], [3, 79, 1]]);                  // the lullaby again, now everyone's together
  n(20, 3, 0.5, 67, 'pluck', 0.45); n(21, 1, 0.5, 79, 'pluck', 0.35); n(21, 1.2, 0.5, 74, 'pluck', 0.3);
  mel(21, [[0, 76, 1], [1, 74, 0.5], [1.5, 72, 0.5], [2, 71, 2]]);
  n(22, 1.2, 0.4, 0, 'chirp', 0.42, { p: -0.1, tag: 'happy' }); n(22, 1.2, 3, 86, 'bell', 0.3);
  mel(22, [[0, 72, 1, 0.42], [1, 76, 1, 0.42], [2, 74, 1, 0.4], [3, 78, 1, 0.38]]);
  mel(23, [[0, 79, 1.5, 0.55], [1.5, 78, 0.5], [2, 76, 0.5], [2.5, 74, 0.5], [3, 71, 1]]);
  [88, 84, 91, 86, 93, 88, 95, 91].forEach((m, k) => n(23, 1 + k * 0.5, 2, m, 'box', 0.16, { tag: 'answer', k, p: -0.7 + k * 0.2 }));
  mel(24, [[0, 79, 3, 0.5]]); n(24, 1, 3, 71, 'box', 0.28); n(24, 1, 3, 74, 'box', 0.28);
  n(24, 3, 1, 36, 'thump', 0.35, { tag: 'seal' }); n(24, 3, 3, 91, 'bell', 0.3);

  N.sort((a, b) => a.t - b.t);
  const tagged = tag => N.filter(x => x.tag === tag);
  const since = (tag, k, t) => { const x = N.find(q => q.tag === tag && q.k === k); return x && t >= x.t ? t - x.t : Infinity; };
  const add = list => { N.push(...list); N.sort((a, b) => a.t - b.t); };
  return { notes: N, tagged, since, add };
})();
