'use strict';
// ---- PAINT: a watercolour kit for Canvas 2D. Washes are built the way a painter glazes: many thin, slightly different
// transparent layers of the same shape, each edge pushed around by recursive midpoint displacement. Where the layers
// overlap the pigment is dense; at the ragged rim it thins out and bleeds. A darker rim is added where water pooled.
const Paint = (() => {
  const g = R => (R() + R() + R() - 1.5) / 1.5;  // cheap gaussian-ish, -1..1

  // pts: [[x,y],...] closed. Returns a new ring with every edge split `depth` times and pushed sideways.
  function deform(pts, depth, amt, R) {
    let out = pts.map(p => [p[0], p[1], p[2] === undefined ? 1 : p[2]]);
    for (let d = 0; d < depth; d++) {
      const nx = [];
      for (let i = 0; i < out.length; i++) {
        const a = out[i], b = out[(i + 1) % out.length];
        nx.push(a);
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]), v = (a[2] + b[2]) * 0.5;
        nx.push([(a[0] + b[0]) / 2 + g(R) * len * amt * v, (a[1] + b[1]) / 2 + g(R) * len * amt * v, clamp(v * (0.75 + R() * 0.5), 0.05, 3)]);
      }
      out = nx;
    }
    return out;
  }
  const path = (ctx, pts) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); };

  // a transparent glaze of one colour over a shape
  function wash(ctx, pts, col, o = {}) {
    const R = rng(o.seed || 1), layers = o.layers || 22, a = o.alpha || 0.055;
    const base = deform(pts, o.depth || 3, o.rough === undefined ? 0.22 : o.rough, R);
    if (o.bleed) { ctx.save(); ctx.filter = `blur(${o.bleed}px)`; ctx.fillStyle = css(col, a * 3); path(ctx, base); ctx.fill(); ctx.restore(); }
    ctx.fillStyle = css(col, a);
    for (let i = 0; i < layers; i++) { path(ctx, deform(base, o.sub || 2, o.spread || 0.16, R)); ctx.fill(); }
    if (o.edge) {   // pigment pooled at the drying edge
      ctx.save(); ctx.strokeStyle = css(shade(col, o.edgeK || 0.78), o.edge); ctx.lineWidth = o.edgeW || 1.6; ctx.lineJoin = 'round';
      ctx.filter = 'blur(0.6px)'; path(ctx, deform(base, 1, 0.05, R)); ctx.stroke(); ctx.restore();
    }
    return base;
  }
  // a round dab of paint
  function dab(ctx, x, y, rx, ry, col, o = {}) {
    const n = o.n || 12, pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * TAU; pts.push([x + Math.cos(a) * rx, y + Math.sin(a) * ry]); }
    return wash(ctx, pts, col, Object.assign({ layers: 9, alpha: 0.09, depth: 2, sub: 1, rough: 0.3, spread: 0.2 }, o));
  }
  // a dry-brush stroke along a polyline: several bristles that skip on the paper's tooth
  function stroke(ctx, pts, w, col, o = {}) {
    const R = rng(o.seed || 7), bristles = o.bristles || 6;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let b = 0; b < bristles; b++) {
      const off = (b / Math.max(1, bristles - 1) - 0.5) * w, a = (o.alpha || 0.35) * (0.6 + R() * 0.6);
      ctx.strokeStyle = css(col, a); ctx.lineWidth = Math.max(0.6, w / bristles * (0.8 + R()));
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[Math.min(i + 1, pts.length - 1)], r = pts[Math.max(i - 1, 0)];
        const tx = q[0] - r[0], ty = q[1] - r[1], l = Math.hypot(tx, ty) || 1, taper = o.taper ? Math.sin(Math.PI * (i + 0.5) / pts.length) : 1;
        const x = p[0] - ty / l * off * taper + g(R) * 0.6, y = p[1] + tx / l * off * taper + g(R) * 0.6;
        if (i === 0 || R() < 0.06) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  // soft gradient wash (sky, mist): a blurred blob
  function mist(ctx, x, y, rx, ry, col, a) {
    const gr = ctx.createRadialGradient(x, y, 0, x, y, 1); gr.addColorStop(0, css(col, a)); gr.addColorStop(1, css(col, 0));
    ctx.save(); ctx.translate(x, y); ctx.scale(rx, ry); ctx.translate(-x, -y); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, 1, 0, TAU); ctx.fill(); ctx.restore();
  }
  // a polygon from a function y(x) down to `bottom`
  function ridge(fn, x0, x1, step, bottom) { const pts = []; for (let x = x0; x <= x1 + 1e-6; x += step) pts.push([x, fn(x)]); pts.push([x1, bottom], [x0, bottom]); return pts; }
  return { deform, wash, dab, stroke, mist, ridge, path };
})();
