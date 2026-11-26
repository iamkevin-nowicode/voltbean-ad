'use strict';
// ---- INK & PAINT: the cel kit. Characters are drawn like animation cels: a smooth inked outline, a flat colour and a
// flat shadow tone. Shapes are smooth curves through points that ride on a skeleton, so bodies bend instead of breaking.
const Ink = (() => {
  const LINE = '#3b2a22', S = { fillsOnly: false };
  // closed (or open) Catmull-Rom curve through points
  function curve(ctx, q, closed = true) {
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
  // a filled cel shape. o.shadow: a shadow shape clipped inside. o.lw: line weight (0 = no line).
  function shape(ctx, pts, fill, o = {}) {
    curve(ctx, pts, true); ctx.fillStyle = fill; ctx.fill();
    if (o.shadow) { ctx.save(); curve(ctx, pts, true); ctx.clip(); curve(ctx, o.shadow, true); ctx.fillStyle = o.shadowCol || 'rgba(60,30,40,0.28)'; ctx.fill(); ctx.restore(); }
    if (o.lw !== 0 && !S.fillsOnly) { curve(ctx, pts, true); ctx.strokeStyle = o.line || LINE; ctx.lineWidth = o.lw || 2; ctx.lineJoin = 'round'; ctx.stroke(); }
  }
  // an inner contour line, the kind an animator draws only where one form passes in front of another: thin, tapered
  // at both ends, in a dark tone of the fur rather than black
  function line(ctx, pts, w, col, alpha = 0.85) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const n = 6; for (let k = 0; k < n; k++) {           // overlapping strokes, thickest in the middle = a tapered line
      const a = k / (2 * n), b = 1 - a, q = sub(pts, a, b); ctx.lineWidth = w * (0.35 + 0.65 * k / (n - 1)); ctx.globalAlpha = alpha * (k === 0 ? 1 : 0.55);
      curve(ctx, q, false); ctx.stroke(); }
    ctx.restore();
  }
  // the part of a polyline between fractions a and b of its length
  function sub(pts, a, b) {
    const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const T = L[L.length - 1], at = d => { let i = 1; while (i < pts.length - 1 && L[i] < d) i++; const u = (d - L[i - 1]) / ((L[i] - L[i - 1]) || 1); return mix(pts[i - 1], pts[i], clamp(u)); };
    const out = [at(a * T)]; for (let i = 1; i < pts.length - 1; i++) if (L[i] > a * T && L[i] < b * T) out.push(pts[i]); out.push(at(b * T)); return out.length < 2 ? [out[0], out[0]] : out;
  }
  // the outline of a tapered tube along a polyline (limbs, necks, tails): widths per point, rounded ends
  function tubePts(pts, wid) {
    const L = [], R = [], n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1, w = wid[i] / 2;
      L.push([pts[i][0] - ty / l * w, pts[i][1] + tx / l * w]); R.push([pts[i][0] + ty / l * w, pts[i][1] - tx / l * w]);
    }
    const cap = (p, q, w, s) => { const tx = p[0] - q[0], ty = p[1] - q[1], l = Math.hypot(tx, ty) || 1; return [p[0] + tx / l * w * 0.55 * s, p[1] + ty / l * w * 0.55 * s]; };
    return L.concat([cap(pts[n - 1], pts[n - 2], wid[n - 1] / 2, 1)], R.reverse(), [cap(pts[0], pts[1], wid[0] / 2, 1)]);
  }
  const tube = (ctx, pts, wid, fill, o) => shape(ctx, tubePts(pts, wid), fill, o);
  const dot = (ctx, x, y, r, col) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = col; ctx.fill(); };
  // an eye: open (dark oval + glint), half, or closed (a soft arc)
  function eye(ctx, x, y, r, open) {
    if (open > 0.15) { ctx.save(); ctx.translate(x, y); ctx.scale(1, 1.2 * open); dot(ctx, 0, 0, r, '#21160f'); ctx.restore(); if (open > 0.6) dot(ctx, x + r * 0.35, y - r * 0.4, r * 0.36, '#fff8ea'); }
    else { ctx.beginPath(); ctx.arc(x, y - r * 0.5, r * 1.1, 0.3, Math.PI - 0.3); ctx.strokeStyle = LINE; ctx.lineWidth = 1.6; ctx.stroke(); }
  }
  // two-bone IK: from root h toward target f with bone lengths a, b. bend +1 puts the middle joint on the +x side (a knee),
  // -1 on the -x side (an elbow) for a limb hanging downward. Out-of-reach targets are approached as far as the limb allows.
  function ik(h, f, a, b, bend) {
    const dx = f[0] - h[0], dy = f[1] - h[1], d0 = Math.hypot(dx, dy), d = clamp(d0, Math.abs(a - b) + 0.01, a + b - 0.01), ang = Math.atan2(dy, dx);
    const c = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1), k = ang - bend * Math.acos(c);
    const mid = [h[0] + Math.cos(k) * a, h[1] + Math.sin(k) * a];
    const end = [h[0] + Math.cos(ang) * d, h[1] + Math.sin(ang) * d];
    return [mid, end];
  }
  const rot = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
  const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
  const at = (o, a, p) => add(o, rot(p, a));
  const tr = (pts, o, a) => pts.map(p => at(o, a, p));
  const mix = (p, q, u) => [lerp(p[0], q[0], u), lerp(p[1], q[1], u)];
  return { curve, shape, tube, tubePts, dot, eye, ik, rot, add, at, tr, mix, line, LINE, S };
})();
