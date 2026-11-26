'use strict';
// ---- THE DEER: a gentle stag with the same kind of skeleton: pelvis, chest, a three-bone neck that curves (it never
// stretches), head, four legs with real deer joints (elbow back, knee/carpus, hock, fetlock, hoof), ears and tail.
// Local space: facing right, origin on the ground under the middle, y down, unscaled.
const Deer = (() => {
  const C = { fur: '#a8693f', far: '#80502f', cream: '#f0dfc4', dark: '#2e2019', hoof: '#3a2a22', antler: '#e6d2a8', antD: '#c3a97c', sh: 'rgba(70,30,40,0.28)', inner: '#6b4030' };
  const TORSO = [[-0.18, -8], [-0.08, -24], [0.2, -27], [0.55, -26], [0.85, -30], [1.02, -28], [1.14, -12], [1.18, 6], [1.08, 24], [0.85, 28], [0.5, 26], [0.2, 27], [-0.02, 22], [-0.15, 10]];
  const HS = 0.86, HEAD = [[-10, -16], [8, -24], [32, -20], [56, -10], [70, 0], [68, 10], [46, 14], [16, 14], [-6, 10], [-14, -2]].map(p => [p[0] * HS, p[1] * HS]);
  const SEG = 36;
  // neck by one number n: -1 head down to the ground, 0 carried, 1 raised high
  const NK = [[-1, 0.55, 0.5, 0.5, 0.55], [0, -0.95, 0.15, 0.25, 0.12], [1, -1.3, 0.08, 0.15, -0.06]];
  function neckAt(n) { const i = n < 0 ? 0 : 1, a = NK[i], b = NK[i + 1], u = ease.sine(clamp((n - a[0]) / (b[0] - a[0]))); return [1, 2, 3, 4].map(k => lerp(a[k], b[k], u)); }
  const { ik, at, tr, mix, shape, tube, eye, dot, curve } = Ink;

  // P: { n, feet:{fn,ff,hn,hf} local, lift, bob, ears:[n,f], tail, blink, nod }
  function solve(P) {
    const n = P.n || 0, kneel = Math.max(0, -n) * 22, bob = P.bob || 0;
    const Pv = [-60, -140 + bob + kneel * 0.25], Cv = [58, -140 + bob + kneel];
    const dir = Math.atan2(Cv[1] - Pv[1], Cv[0] - Pv[0]), len = Math.hypot(Cv[0] - Pv[0], Cv[1] - Pv[1]);
    const sp = (u, v) => { const b = [Pv[0] + Math.cos(dir) * len * u, Pv[1] + Math.sin(dir) * len * u]; return [b[0] - Math.sin(dir) * v, b[1] + Math.cos(dir) * v]; };
    const feet = P.feet || { fn: [62, 0], ff: [54, 0], hn: [-56, 0], hf: [-64, 0] }, lift = P.lift || {};
    const leg = {};
    for (const k of ['fn', 'ff']) { const hf = feet[k], cu = lift[k] || 0, carp = [hf[0] + 2 - cu * 10, hf[1] - 48 + cu * 6], S = sp(1.0, 14);
      const [el, cp] = ik(S, carp, 46, 50, -1); const fet = [cp[0] + (hf[0] - carp[0]) * 0.9 + cu * 6, cp[1] + 40 - cu * 4];
      leg[k] = { top: sp(1.0, 4), S, el, cp, fet, hoof: [fet[0] + 2 + cu * 4, fet[1] + 8 - cu * 2] }; }
    for (const k of ['hn', 'hf']) { const hf = feet[k], cu = lift[k] || 0, hock = [hf[0] - 10 - cu * 12, hf[1] - 54 + cu * 8], H = sp(0.0, 10);
      const [st, hk] = ik(H, hock, 48, 52, 1); const fet = [hk[0] + 9 + cu * 8, hk[1] + 46 - cu * 6];
      leg[k] = { top: sp(0.03, 0), S: H, el: st, cp: hk, fet, hoof: [fet[0] + 2 + cu * 4, fet[1] + 8 - cu * 2] }; }
    const [b0, b1, b2, ah0] = neckAt(n + (P.nod || 0));
    const NB = sp(1.05, -14), j1 = at(NB, b0, [SEG, 0]), j2 = at(j1, b0 + b1, [SEG, 0]), HP = at(j2, b0 + b1 + b2, [SEG, 0]);
    const ah = ah0 + (P.headTilt || 0);
    const hat = p => at(HP, ah, [p[0] * HS, p[1] * HS]);
    return { sp, dir, leg, NB, j1, j2, HP, ah, hat, headTop: hat([22, -22]), antlerTip: hat([5, -116]), tailBase: sp(-0.16, -14),
      path: [hat([22, -22]), hat([-6, -24]), at(j2, b0 + b1 + b2 - Math.PI / 2, [0, 13]), at(j1, b0 + b1 - Math.PI / 2, [0, 16]), sp(1.0, -30), sp(0.82, -31), sp(0.62, -27)] };
  }
  function legShape(ctx, L, front, col) {
    const pts = [L.top, L.el, L.cp, L.fet, L.hoof], w = front ? [30, 15, 9, 7, 7.5] : [40, 20, 10, 7, 7.5];
    tube(ctx, pts, w, col, { lw: 2 });
    const hv = [[L.fet[0] - 3, L.fet[1] + 1], [L.fet[0] + 4, L.fet[1] + 1], [L.hoof[0] + 6, L.hoof[1] + 1], [L.hoof[0] - 5, L.hoof[1] + 1]];
    shape(ctx, hv, C.hoof, { lw: 1.4 });
  }
  function antler(ctx, hat, dx, col) {
    const o = p => hat([p[0] + dx, p[1]]);
    const beam = [[4, -22], [-6, -50], [-15, -78], [-9, -102], [5, -116]].map(o);
    tube(ctx, beam, [7, 6, 5, 4, 2.6], col, { lw: 1.6 });
    for (const t of [[[-3, -38], [10, -50], [18, -52]], [[-12, -64], [0, -80], [6, -88]], [[-14, -86], [-6, -98], [-4, -108]]]) tube(ctx, t.map(o), [4.6, 3.4, 2.2], col, { lw: 1.4 });
  }
  function draw(ctx, P, R) {
    R = R || solve(P); const sp = R.sp, hat = R.hat;
    legShape(ctx, R.leg.hf, false, C.far); legShape(ctx, R.leg.ff, true, C.far);
    antler(ctx, hat, -9, C.antD);
    const earF = P.ears ? P.ears[1] : 0, earN = P.ears ? P.ears[0] : 0;
    const ear = (b, a, col) => { const q = p => at(hat(b), R.ah + a, p); shape(ctx, [q([-6, 2]), q([-20, -10]), q([-34, -20]), q([-18, -2]), q([0, 6])], col, { lw: 1.6 }); shape(ctx, [q([-6, 1]), q([-24, -12]), q([-17, -3])], C.inner, { lw: 0 }); };
    ear([2, -18], earF - 0.1, C.far);
    // tail, then body
    const tb = R.tailBase, ta = R.dir + Math.PI - 0.9 + (P.tail || 0);
    shape(ctx, [at(tb, ta, [0, -7]), at(tb, ta, [20, -5]), at(tb, ta, [24, 2]), at(tb, ta, [14, 7]), at(tb, ta, [0, 7])], C.cream, { lw: 1.6 });
    shape(ctx, TORSO.map(([u, v]) => sp(u, v)), C.fur, { shadow: [[-0.3, 8], [1.3, 8], [1.3, 40], [-0.3, 40]].map(([u, v]) => sp(u, v)), shadowCol: C.sh, lw: 2.2 });
    shape(ctx, [sp(0.2, 22), sp(0.55, 22), sp(0.85, 24), sp(0.7, 27), sp(0.3, 26)], C.cream, { lw: 0 });
    shape(ctx, [sp(-0.16, -6), sp(-0.05, -10), sp(0.02, 6), sp(-0.12, 8)], C.cream, { lw: 0 });
    // neck: filled without a seam, then its two edges inked
    const NP = [R.NB, R.j1, R.j2, R.HP], NW = [50, 38, 30, 26], np = Ink.tubePts(NP, NW);
    shape(ctx, np, C.fur, { lw: 0 });
    shape(ctx, Ink.tubePts(NP.map((p, i) => at(p, R.ah, [4, 0])), NW.map(w => w * 0.42)).map((p, i) => p), 'rgba(0,0,0,0)', { lw: 0 });
    ctx.strokeStyle = Ink.LINE; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    curve(ctx, np.slice(0, 4), false); ctx.stroke(); curve(ctx, np.slice(5, 9), false); ctx.stroke();
    // near legs over the body
    legShape(ctx, R.leg.hn, false, C.fur); legShape(ctx, R.leg.fn, true, C.fur);
    // head
    shape(ctx, tr(HEAD, R.HP, R.ah), C.fur, { shadow: tr([[-14, 3], [70, 3], [70, 16], [-14, 16]], R.HP, R.ah), shadowCol: C.sh, lw: 2 });
    shape(ctx, [hat([48, -2]), hat([69, 0]), hat([68, 10]), hat([48, 12])], C.cream, { lw: 0 });
    const ns = hat([67, 2]); dot(ctx, ns[0], ns[1], 4.2, C.dark);
    const ey = hat([28, -8]); eye(ctx, ey[0], ey[1], 3.8, P.blink === undefined ? 1 : P.blink);
    ear([-4, -16], earN, C.fur);
    antler(ctx, hat, 0, C.antler);
    return R;
  }
  return { solve, draw };
})();
