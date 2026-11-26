'use strict';
// ---- UTIL: maths, seeded randomness, easing, keyframe tracks. Everything is deterministic: same time in, same frame out. ----
const TAU = Math.PI * 2;
const W = 1920, H = 1080, FILM = 30;               // frame size, film length (s)
const BPM = 96, BEAT = 60 / BPM, BAR = BEAT * 4;     // 12 bars of 2.5 s
const at = (bar, beat = 1) => ((bar - 1) * 4 + (beat - 1)) * BEAT;   // bar/beat (1-indexed) -> seconds

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = {
  lin: t => t,
  in: t => t * t * t,
  out: t => 1 - Math.pow(1 - t, 3),
  inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  sine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  back: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};

// mulberry32
function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const hash2 = (x, y) => { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); };
const vn1 = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u); };
const vn2 = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y); let fx = x - xi, fy = y - yi; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), fx), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), fx), fy); };

// keyframe track: keys = [[t, value, easeName?], ...]; ease on a key shapes the segment that ENDS at it. Values may be numbers or arrays.
function kf(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const k0 = keys[i - 1], k1 = keys[i];
    if (t <= k1[0]) { const u = (ease[k1[2] || 'inOut'])((t - k0[0]) / Math.max(1e-6, k1[0] - k0[0]));
      return Array.isArray(k0[1]) ? k0[1].map((v, j) => lerp(v, k1[1][j], u)) : lerp(k0[1], k1[1], u); }
  }
  return keys[keys.length - 1][1];
}
// a jump arc between t0 and t1 of height h (0 outside)
const arc = (t, t0, t1, h) => { if (t <= t0 || t >= t1) return 0; const u = (t - t0) / (t1 - t0); return 4 * h * u * (1 - u); };

// colours: '#rrggbb' <-> [r,g,b] 0..1
const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const css = (c, a = 1) => `rgba(${Math.round(clamp(c[0]) * 255)},${Math.round(clamp(c[1]) * 255)},${Math.round(clamp(c[2]) * 255)},${a})`;
const mixC = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

// the hill the story happens on: rises from the valley (left) to a small plateau where the lone fir stands, then falls away (right)
function hillY(x) {
  if (x < 2450) return 1900 - 720 * ease.sine(clamp(x / 2450));
  if (x < 2820) return 1180 + 6 * Math.sin((x - 2450) / 370 * Math.PI);
  return 1180 + 340 * ease.sine(clamp((x - 2820) / 1150));
}
const hillSlope = x => (hillY(x + 2) - hillY(x - 2)) / 4;
const TREE = { x: 2620, base: 1182, top: 612 };
