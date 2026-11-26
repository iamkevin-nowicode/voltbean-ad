'use strict';
// ---- THE FOX KIT: a skeleton (pelvis, chest, neck, head, four three-part legs, a seven-bone tail, two ears) with a skin
// that rides on it. Local space: facing right, origin on the ground under the middle of the body, y down, unscaled.
// Poses blend (stand, sit, up = on hind legs, crouch, air); feet come from the stepping system or from the pose; legs
// reach their feet with two-bone IK, elbows bending back and knees forward like a real fox.
const Fox = (() => {
  const C = { fur: '#d9692c', far: '#ad4f22', cream: '#f7e8d2', dark: '#3a2620', sock: '#45291f', sh: 'rgba(110,35,30,0.3)', inner: '#5a3024' };
  const POSE = {
    stand:  { P: [-24, -38], C: [26, -38], bend: 0, fn: [30, 0], ff: [23, 0], hn: [-20, 0], hf: [-27, 0], mt: [-4, -14] },
    sit:    { P: [-18, -13], C: [17, -40], bend: 0.1, fn: [22, 0], ff: [17, 0], hn: [-3, 0], hf: [-8, 0], mt: [-14, -2] },
    up:     { P: [-8, -30], C: [2, -73], bend: 0.12, fn: [13, -60], ff: [9, -56], hn: [6, 0], hf: [-1, 0], mt: [-4, -13] },
    crouch: { P: [-21, -25], C: [23, -26], bend: 0.04, fn: [31, 0], ff: [25, 0], hn: [-18, 0], hf: [-24, 0], mt: [-9, -9] },
    air:    { P: [-26, -38], C: [28, -39], bend: -0.04, fn: [42, -18], ff: [37, -13], hn: [-42, -14], hf: [-36, -9], mt: [-13, -5] },
    lie:    { P: [-21, -11], C: [21, -13], bend: 0.02, fn: [40, 0], ff: [35, 0], hn: [-5, 0], hf: [-10, 0], mt: [-15, -2] },
  };
  const NAMES = ['stand', 'sit', 'up', 'crouch', 'air', 'lie'];
  const TORSO = [[-0.3, -2], [-0.18, -12], [0.12, -14.5], [0.45, -13], [0.78, -14.5], [1.02, -13], [1.18, -6], [1.26, 4], [1.16, 12.5], [0.9, 13.5], [0.6, 11.5], [0.32, 12], [0.05, 12.5], [-0.2, 9], [-0.32, 3]];
  const HEAD = [[0, -6], [2, -20], [12, -28], [24, -26], [33, -17], [43, -10], [47, -6], [42, -1], [28, 2], [12, 4], [1, 2]];
  const CHEEK = [[16, -7], [30, -9], [45, -5], [41, 1], [27, 3], [12, 1]];
  const TAIL = { n: 7, len: 7.5, w: [5, 10, 12.5, 13, 12.5, 10.5, 7, 2.5] };
  const { ik, at, tr, mix, shape, tube, eye, dot, curve } = Ink;

  function weights(w) { const s = clamp(w.s || 0), u = clamp(w.u || 0), c = clamp(w.c || 0), a = clamp(w.a || 0), l = clamp(w.l || 0); const st = Math.max(0, 1 - s - u - c - a - l), tot = st + s + u + c + a + l || 1; return [st / tot, s / tot, u / tot, c / tot, a / tot, l / tot]; }
  const blend = (k, ws) => { let x = 0, y = 0; ws.forEach((w, i) => { const v = POSE[NAMES[i]][k]; x += v[0] * w; y += v[1] * w; }); return [x, y]; };
  const blend1 = (k, ws) => ws.reduce((a, w, i) => a + POSE[NAMES[i]][k] * w, 0);

  // P: { w:{s,u,c,a}, bob, stretch, pitch, feet:{fn,ff,hn,hf} (local, optional), lift:{...}, look, reach, tilt, ears:[n,f], tail:[angles], blink, hold }
  function solve(P) {
    const ws = weights(P.w || {});
    let Pv = blend('P', ws), Cv = blend('C', ws); const bend = blend1('bend', ws);
    Pv[1] += P.bob || 0; Cv[1] += P.bob || 0;
    if (P.stretch && P.stretch !== 1) { const m = mix(Pv, Cv, 0.5); Pv = mix(m, Pv, P.stretch); Cv = mix(m, Cv, P.stretch); }
    if (P.pitch) { const m = mix(Pv, Cv, 0.35); Pv = at(m, P.pitch, [Pv[0] - m[0], Pv[1] - m[1]]); Cv = at(m, P.pitch, [Cv[0] - m[0], Cv[1] - m[1]]); }
    if (P.lean) { Pv[1] += P.lean; Cv[1] -= P.lean; }
    const dir = Math.atan2(Cv[1] - Pv[1], Cv[0] - Pv[0]), len = Math.hypot(Cv[0] - Pv[0], Cv[1] - Pv[1]);
    const sp = (u, v) => { const b = [Pv[0] + Math.cos(dir) * len * u, Pv[1] + Math.sin(dir) * len * u], a = dir + bend * (u - 0.5); return [b[0] - Math.sin(a) * v, b[1] + Math.cos(a) * v]; };
    // feet: from the stepping system where given, else from the pose
    const feet = {};
    for (const k of ['fn', 'ff', 'hn', 'hf']) { const d = blend(k, ws); feet[k] = P.feet && P.feet[k] ? mix(d, P.feet[k], P.feetW === undefined ? 1 : P.feetW) : d; }
    if (ws[2] > 0.01 && !(P.feet && P.feet.fn)) { const sh = sp(1, 6); feet.fn = mix(feet.fn, [sh[0] + 13, sh[1] + 16], ws[2]); feet.ff = mix(feet.ff, [sh[0] + 9, sh[1] + 19], ws[2]); }
    const lift = P.lift || {};
    const S = sp(1.0, 5), Hp = sp(0.02, 5), mt = blend('mt', ws);
    const leg = {};
    for (const k of ['fn', 'ff']) {          // front: shoulder -> elbow (back) -> wrist -> paw
      const toe = feet[k], curl = clamp((lift[k] || 0) * 1.2 + ws[2] + ws[4] * 0.6);
      const flat = ws[5] || 0, wrist = [toe[0] - 4 + curl * 3 - flat * 6, toe[1] - 4 - curl * 3 + flat * 2.5];
      const [el, wr] = ik(S, wrist, 16, 17, -1);
      leg[k] = { top: sp(1.0, -6), j1: S, j2: el, j3: wr, toe: [wr[0] + 4 - curl * 3, wr[1] + 4 - curl * 1.5] };
    }
    for (const k of ['hn', 'hf']) {          // hind: hip -> knee (forward) -> hock -> toe
      const toe = feet[k], curl = clamp((lift[k] || 0) * 1.2 + ws[4] * 0.8);
      const m = [mt[0] - curl * 6, mt[1] + curl * 5], hock = [toe[0] + m[0], toe[1] + m[1]];
      const [kn, hk] = ik(Hp, hock, 14, 15, 1);
      leg[k] = { top: sp(0.02, -7), j1: Hp, j2: kn, j3: hk, toe: [hk[0] - m[0], hk[1] - m[1]] };
    }
    // neck and head
    const look = P.look || 0, reach = P.reach || 0;
    const NB = sp(1.1, -5), an = dir * 0.4 - 0.95 - look * 0.45 + reach * 1.15, HP = at(NB, an, [20 - reach * 3, 0]);
    const ah = dir * 0.3 - look + reach * 0.85 + (P.tilt || 0);
    const hat = p => at(HP, ah, p);
    // tail chain
    const TB = sp(-0.3, -5), tail = [TB]; let a = 0;
    for (let i = 0; i < TAIL.n; i++) { a = P.tail ? P.tail[i] : dir + Math.PI - 0.45 + i * 0.07; const q = tail[i]; tail.push([q[0] + Math.cos(a) * TAIL.len, q[1] + Math.sin(a) * TAIL.len]); }
    return { ws, Pv, Cv, dir, sp, leg, NB, HP, ah, hat, tail, TB, mouth: hat([41, 2]), headTop: hat([18, -27]) };
  }
  // where the tail wants to rest, per pose (relative to the spine)
  function tailRest(ws, wag) {
    const base = ws[0] * (Math.PI - 0.45) + ws[1] * (Math.PI - 0.55) + ws[2] * (Math.PI + 0.25) + ws[3] * (Math.PI - 0.3) + ws[4] * (Math.PI - 0.12) + (ws[5] || 0) * (Math.PI - 0.15);
    const curl = ws[0] * 0.07 + ws[1] * -0.36 + ws[2] * -0.22 + ws[3] * 0.05 + ws[4] * 0.03 + (ws[5] || 0) * -0.44;
    return { base: base + wag, curl };
  }

  function legShape(ctx, L, front, col, sock) {
    const w = front ? [12, 6.5, 4.4, 4.8] : [18, 9, 4.6, 4.8];
    const pts = [L.top, L.j2, L.j3, L.toe];
    tube(ctx, pts, w, col, { lw: 1.8 });
    const s0 = mix(L.j2, L.j3, front ? 0.68 : 0.92);
    tube(ctx, [s0, L.j3, L.toe], [w[1] * 0.62, w[2], w[3]], sock, { lw: 0 });
  }
  function draw(ctx, P, R) {
    R = R || solve(P);
    const sp = R.sp, hat = R.hat;
    // far legs, behind everything
    legShape(ctx, R.leg.hf, false, C.far, C.dark); legShape(ctx, R.leg.ff, true, C.far, C.dark);
    // tail
    const tw = TAIL.w.map((w, i) => w * (i === 0 ? 1 : 1)), tp = Ink.tubePts(R.tail, tw);
    shape(ctx, tp, C.fur, { shadow: Ink.tubePts(R.tail.map(p => [p[0], p[1] + 4]), tw.map(w => w * 0.7)), shadowCol: C.sh, lw: 1.9 });
    const tipStart = R.tail.length - 3;
    shape(ctx, Ink.tubePts(R.tail.slice(tipStart), tw.slice(tipStart)), C.cream, { lw: 1.6 });
    // body
    const T = TORSO.map(([u, v]) => sp(u, v));
    shape(ctx, T, C.fur, { shadow: [[-0.4, 5], [1.35, 5], [1.35, 22], [-0.4, 22]].map(([u, v]) => sp(u, v)), shadowCol: C.sh, lw: 2 });
    // neck (no seam where it joins the body), chest bib
    const neck = [sp(0.95, -13.5), hat([2, -21]), hat([-3, -8]), hat([13, 4]), sp(1.27, 5), sp(1.0, 2)];
    shape(ctx, neck, C.fur, { lw: 0 });
    shape(ctx, [hat([24, 3]), hat([9, 4]), sp(1.24, 2), sp(1.12, 11), sp(1.02, 5)], C.cream, { lw: 0 });
    // near legs over the body: the haunch and the shoulder
    legShape(ctx, R.leg.hn, false, C.fur, C.dark); legShape(ctx, R.leg.fn, true, C.fur, C.dark);
    // ears, head, face
    const ear = (bc, e, col, s) => {
      const a = R.ah + e, base0 = at(bc, R.ah, [-5.5 * s, 1]), base1 = at(bc, R.ah, [5.5 * s, 1]), tip = at(bc, a, [0, -24]);
      const m0 = at(bc, a, [-6, -12]), m1 = at(bc, a, [5.5, -12]);
      shape(ctx, [base0, m0, tip, m1, base1], col, { lw: 1.8 });
      shape(ctx, [at(bc, a, [-2.5, -3]), at(bc, a, [-3, -12]), at(bc, a, [0, -19]), at(bc, a, [2.5, -11]), at(bc, a, [2, -3])], C.inner, { lw: 0 });
    };
    ear(hat([10, -24]), P.ears ? P.ears[1] : -0.15, C.far, 1);
    shape(ctx, tr(HEAD, R.HP, R.ah), C.fur, { shadow: tr([[0, -3], [50, -3], [50, 8], [0, 8]], R.HP, R.ah), shadowCol: C.sh, lw: 2 });
    shape(ctx, tr(CHEEK, R.HP, R.ah), C.cream, { lw: 1.3 });
    ear(hat([21, -25]), P.ears ? P.ears[0] : -0.15, C.fur, 1);
    const n = hat([46, -6]); dot(ctx, n[0], n[1], 3.2, C.dark);
    const ey = hat([27, -15]); eye(ctx, ey[0], ey[1], 2.8, P.blink === undefined ? 1 : P.blink);
    return R;
  }
  // which side of a limb segment faces forward (+x) or back
  const edge = (a, b, w, front) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; let n = [-dy / l, dx / l]; if ((n[0] > 0) !== front) n = [-n[0], -n[1]]; return p => [p[0] + n[0] * w / 2, p[1] + n[1] * w / 2]; };
  // the few lines an animator draws inside the silhouette
  function inner(ctx, P, R) {
    const line = (pts, w, a) => Ink.line(ctx, pts, w, C.line, a), hat = R.hat;
    const hn = R.leg.hn, e1 = edge(hn.top, hn.j2, 14, true);
    line([e1(mix(hn.top, hn.j2, 0.25)), e1(mix(hn.top, hn.j2, 0.7)), edge(hn.j2, hn.j3, 9, true)(hn.j2)], 1.5);     // the front of the haunch
    const fn = R.leg.fn, e2 = edge(fn.top, fn.j2, 9, false);
    line([e2(mix(fn.top, fn.j2, 0.45)), e2(fn.j2), edge(fn.j2, fn.j3, 6, false)(mix(fn.j2, fn.j3, 0.3))], 1.3);       // the elbow
    line([hat([2, 1]), hat([13, 4]), hat([27, 2.5]), hat([40, -0.5])], 1.3, 0.7);                                       // the jaw
    line([hat([35, 0]), hat([42, 0.5])], 1.2);                                                                         // the mouth
    if (P.sad) line([hat([21, -20]), hat([31, -22.5])], 1.4 * P.sad);
  }
  C.line = '#5b2a17';
  return { solve, draw, inner, tailRest, TAIL, POSE, LINE: C.line };
})();
