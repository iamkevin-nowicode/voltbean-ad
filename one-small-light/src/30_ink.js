'use strict';
// ---- INK & PAINT: the cel kit. Characters are drawn like animation cels: a smooth inked outline, a flat colour,
// a flat shadow tone, and a line that "boils" - every drawing is traced again, so the line trembles 12 times a second.
const Ink = (() => {
  let boil = 0;                    // which drawing we are on (changes 12x a second)
  const setBoil = t => (boil = Math.floor(t * 12));
  const LINE = '#3b2a22';
  // closed (or open) Catmull-Rom curve through points, each point nudged by the boil
  function curve(ctx, pts, closed = true, id = 0, amp = 0.9) {
    const q = pts.map((p, i) => [p[0] + (hash(boil * 7.13 + id * 1.7 + i * 3.1) - 0.5) * 2 * amp, p[1] + (hash(boil * 3.71 + id * 2.3 + i * 5.7) - 0.5) * 2 * amp]);
    const n = q.length; ctx.beginPath();
    const P = i => (closed ? q[(i + n) % n] : q[clamp(i, 0, n - 1)]);
    ctx.moveTo(q[0][0], q[0][1]);
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
    }
    if (closed) ctx.closePath();
  }
  // a filled cel shape. o.shadow: points of a shadow shape clipped inside. o.lw: line weight.
  function shape(ctx, pts, fill, o = {}) {
    const id = o.id || 0;
    curve(ctx, pts, true, id, o.amp); ctx.fillStyle = fill; ctx.fill();
    if (o.shadow) { ctx.save(); curve(ctx, pts, true, id, o.amp); ctx.clip(); curve(ctx, o.shadow, true, id + 50, o.amp); ctx.fillStyle = o.shadowCol || 'rgba(60,30,40,0.28)'; ctx.fill(); ctx.restore(); }
    if (o.lw !== 0) { curve(ctx, pts, true, id, o.amp); ctx.strokeStyle = o.line || LINE; ctx.lineWidth = o.lw || 2.2; ctx.lineJoin = 'round'; ctx.stroke(); }
  }
  // a limb: an inked stroke of width w from a through a bend to b, with an optional darker "sock" at the end
  function limb(ctx, pts, w, col, o = {}) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    curve(ctx, pts, false, o.id || 0, 0.5); ctx.strokeStyle = o.line || LINE; ctx.lineWidth = w + 4.4; ctx.stroke();
    curve(ctx, pts, false, o.id || 0, 0.5); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
    if (o.sock) { const n = pts.length, a = pts[n - 2], b = pts[n - 1], s = [[lerp(a[0], b[0], 1 - o.sockLen), lerp(a[1], b[1], 1 - o.sockLen)], b];
      curve(ctx, s, false, (o.id || 0) + 9, 0.4); ctx.strokeStyle = o.sock; ctx.lineWidth = w; ctx.stroke(); }
  }
  const dot = (ctx, x, y, r, col) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = col; ctx.fill(); };
  // an eye: open (dark oval + glint) or closed (an arc)
  function eye(ctx, x, y, r, open, look = 0) {
    if (open > 0.5) { ctx.save(); ctx.translate(x, y); ctx.scale(1, 1.25); dot(ctx, 0, 0, r, '#21160f'); ctx.restore(); dot(ctx, x + r * 0.35 + look, y - r * 0.45, r * 0.38, '#fff8ea'); }
    else { ctx.beginPath(); ctx.arc(x, y - r * 0.4, r * 1.1, 0.25, Math.PI - 0.25); ctx.strokeStyle = LINE; ctx.lineWidth = 1.8; ctx.stroke(); }
  }
  // two-bone limb solve: from hip h to foot f with segment lengths a,b; bend +1/-1 picks the knee side
  function knee(h, f, a, b, bend) {
    const dx = f[0] - h[0], dy = f[1] - h[1], d = Math.min(Math.hypot(dx, dy), a + b - 0.01), ang = Math.atan2(dy, dx);
    const c = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1), k = ang - bend * Math.acos(c);
    return [h[0] + Math.cos(k) * a, h[1] + Math.sin(k) * a];
  }
  const rot = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
  const tr = (pts, o, a, s = 1) => pts.map(p => { const r = rot([p[0] * s, p[1] * s], a); return [o[0] + r[0], o[1] + r[1]]; });
  return { setBoil, curve, shape, limb, dot, eye, knee, rot, tr, LINE };
})();
