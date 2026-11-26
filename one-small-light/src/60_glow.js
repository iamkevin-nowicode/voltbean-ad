'use strict';
// ---- GLOW: everything that gives off light. Drawn into small canvases that are added on top of the paint:
// sky (moon, stars, aurora), back (tree bulbs, far lights answering), front (the lantern flame), and the light map
// (a tiny picture of where warm light falls, which lights the snow, the tree and the animals).
const Glow = (() => {
  const halo = (ctx, x, y, r, c, a) => { if (r <= 0.5 || a <= 0.003) return; const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, css(c, a)); g.addColorStop(0.35, css(c, a * 0.35)); g.addColorStop(1, css(c, 0)); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); };
  const STARS = (() => { const R = rng(77), s = []; for (let i = 0; i < 170; i++) s.push({ x: R() * W, y: Math.pow(R(), 1.4) * 720, m: 0.4 + R() * 0.9, ph: R() * TAU, grp: i < 96 ? -1 : (i - 96) % 8 }); return s; })();
  const BULB = [[1, 0.8, 0.42], [1, 0.42, 0.3], [1, 0.93, 0.75]];

  function sky(ctx, t, cam) {
    const s = ctx._s; ctx.setTransform(s, 0, 0, s, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    const night = smooth(10, 14, t), sx = -(cam[0] - 1800) * 0.02, sy = -(cam[1] - 1060) * 0.02;
    // moon: a pale painted disc with a soft halo
    const ma = smooth(8.5, 11.5, t); if (ma > 0) {
      const mx = 1530 + sx, my = 175 + sy;
      halo(ctx, mx, my, 260, [0.75, 0.78, 1], 0.22 * ma);
      ctx.fillStyle = css([0.98, 0.95, 0.86], 0.92 * ma); ctx.beginPath(); ctx.arc(mx, my, 34, 0, TAU); ctx.fill();
      ctx.fillStyle = css([0.85, 0.82, 0.9], 0.35 * ma); ctx.beginPath(); ctx.arc(mx - 9, my - 6, 9, 0, TAU); ctx.arc(mx + 11, my + 8, 6, 0, TAU); ctx.fill();
    }
    // stars: a field that comes with the night, and eight groups that open on the bells of bar 10
    for (const st of STARS) {
      let a = st.grp < 0 ? night * 0.75 : 0, flash = 0;
      if (st.grp >= 0) { const age = Score.since('star', st.grp, t); if (age !== Infinity) { a = clamp(age / 0.12); flash = Math.exp(-age * 4); } }
      if (a <= 0) continue;
      const tw = 0.7 + 0.3 * Math.sin(t * 3 + st.ph), x = st.x + sx, y = st.y + sy;
      ctx.fillStyle = css([1, 0.97, 0.88], a * tw * st.m); ctx.beginPath(); ctx.arc(x, y, 1.2 + st.m + flash * 2, 0, TAU); ctx.fill();
      if (flash > 0.02 || st.m > 1.1) halo(ctx, x, y, 10 + 30 * flash, [0.9, 0.9, 1], 0.3 * a * (0.4 + flash));
    }
    // aurora: two soft ribbons that breathe across the top of the sky once the tree is lit
    const au = smooth(22.6, 25.5, t);
    if (au > 0) for (let r = 0; r < 2; r++) {
      const col = r ? [0.55, 0.45, 0.95] : [0.35, 0.95, 0.72];
      for (let x = -20; x < W + 20; x += 10) {
        const y = 120 + r * 70 + 70 * Math.sin(x / 330 + t * 0.35 + r * 2) + 30 * vn1(x / 140 + t * 0.25 + r * 9) + sy, h = 140 + 90 * vn1(x / 200 + r * 4 + t * 0.2);
        const g = ctx.createLinearGradient(0, y + h, 0, y); g.addColorStop(0, css(col, 0)); g.addColorStop(0.25, css(col, 0.07 * au)); g.addColorStop(1, css(col, 0));
        ctx.fillStyle = g; ctx.fillRect(x + sx, y, 11, h);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function back(ctx, t, cam, F) {
    const s = ctx._s, z = cam[2]; ctx.setTransform(s, 0, 0, s, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    const sc = (x, y) => [(x - cam[0]) * z + W / 2, (y - cam[1]) * z + H / 2];
    // the tree's own warm aura
    if (F.treeGlow > 0) { const c = sc(TREE.x, 880); halo(ctx, c[0], c[1], 520 * z, [1, 0.7, 0.36], 0.22 * F.treeGlow); }
    World.tree.bulbs.forEach((b, i) => {
      const age = F.tierAge(b.tier); if (age === Infinity) return;
      const on = clamp(age / 0.08), flash = Math.exp(-age * 5), tw = 0.8 + 0.2 * Math.sin(t * 4 + i * 1.7), c = sc(b.x, b.y), col = BULB[b.c];
      halo(ctx, c[0], c[1], (22 + 40 * flash) * z, col, 0.55 * on * tw);
      ctx.fillStyle = css(mixC(col, [1, 1, 1], 0.6), on); ctx.beginPath(); ctx.arc(c[0], c[1], (3.6 + 2 * flash) * z, 0, TAU); ctx.fill();
    });
    // far lights answering, one per note of bar 11
    const Lh = World.byId.hills;
    World.answers.forEach((p, k) => {
      const age = Score.since('answer', k, t); if (age === Infinity) return;
      const c = World.toScreen(Lh, cam, p[0], p[1]), on = clamp(age / 0.15), flash = Math.exp(-age * 3);
      halo(ctx, c[0], c[1], 26 + 50 * flash, [1, 0.75, 0.4], 0.5 * on);
      ctx.fillStyle = css([1, 0.92, 0.7], on); ctx.beginPath(); ctx.arc(c[0], c[1], 2.6 + flash * 2, 0, TAU); ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';
  }

  function front(ctx, t, cam, F) {
    const s = ctx._s, z = cam[2]; ctx.setTransform(s, 0, 0, s, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    const c = [(F.flame[0] - cam[0]) * z + W / 2, (F.flame[1] - cam[1]) * z + H / 2], g = F.lan.glow;
    const dk = clamp(Story.mood(t) / 2); halo(ctx, c[0], c[1], (36 + 26 * g) * z, [1, 0.7, 0.32], (0.08 + 0.16 * dk) * g);
    halo(ctx, c[0], c[1], 16 * z, [1, 0.9, 0.6], 0.8 * Math.min(1, g));
    ctx.globalCompositeOperation = 'source-over';
  }

  function lightmap(ctx, t, cam, F) {
    const s = ctx._s, z = cam[2]; ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (const L of F.lights) { const x = (L.x - cam[0]) * z + W / 2, y = (L.y - cam[1]) * z + H / 2, r = L.r * z;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, css(L.c, clamp(L.k))); g.addColorStop(0.4, css(L.c, clamp(L.k) * 0.4)); g.addColorStop(1, css(L.c, 0)); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
    ctx.globalCompositeOperation = 'source-over';
  }
  return { sky, back, front, lightmap };
})();
