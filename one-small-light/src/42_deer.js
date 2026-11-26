'use strict';
// ---- THE DEER: a gentle roe-ish stag, side-on facing right, origin on the ground under its middle (y down). ----
// Pose: walk (cycles), walkAmt, neck (-1 head to the ground, 0 normal, 1 raised high), blink, earFlick.
const Deer = (() => {
  const C = { fur: '#a8693f', far: '#7d4a2c', cream: '#f0dfc4', dark: '#2e2019', antler: '#e6d2a8', antD: '#c9b083', sh: 'rgba(70,30,40,0.3)', inner: '#6b4030' };
  const TORSO = [[-104, -262], [-86, -290], [-30, -300], [30, -298], [76, -286], [100, -258], [92, -222], [56, -205], [0, -200], [-56, -206], [-94, -222], [-108, -244]];
  const HEAD = [[-10, -16], [8, -24], [32, -20], [56, -10], [70, 0], [68, 10], [46, 14], [16, 14], [-6, 10], [-14, -2]];
  const { tr, rot, knee, shape, limb, eye, dot } = Ink;
  const NECK = [[-1, [165, -128], 1.25], [-0.4, [168, -210], 0.75], [0, [132, -372], 0.12], [0.5, [116, -452], 0.0], [1, [100, -494], -0.12]];
  function headAt(n) {
    for (let i = 1; i < NECK.length; i++) if (n <= NECK[i][0] || i === NECK.length - 1) {
      const a = NECK[i - 1], b = NECK[i], u = ease.sine(clamp((n - a[0]) / (b[0] - a[0])));
      return { p: [lerp(a[1][0], b[1][0], u), lerp(a[1][1], b[1][1], u)], a: lerp(a[2], b[2], u) };
    }
  }
  function rig(P) {
    const wa = P.walkAmt || 0, ph = (P.walk || 0) * TAU, bob = -Math.abs(Math.sin(ph * 2)) * 4 * wa;
    const Y = 92, B = [0, bob + Y], h = headAt(P.neck || 0), Hb = [h.p[0], h.p[1] + bob + Y];
    const hat = p => { const r = rot(p, h.a); return [Hb[0] + r[0], Hb[1] + r[1]]; };
    const legs = [[-70, 0, -1], [62, 0.25, 1], [-62, 0.5, -1], [70, 0.75, 1]].map(([x, off, front]) => {
      const u = ph + off * TAU; return { top: [x, -238 + bob + Y], foot: [x + 6 + Math.sin(u) * 34 * wa, -Math.max(0, Math.cos(u)) * 16 * wa], front };
    });
    return { B, Hb, ha: h.a, hat, legs, headTop: hat([24, -24]), back: [-6, -298 + bob + Y], antlerTip: hat([2, -128]) };
  }
  function antler(ctx, hat, dx, col, id) {
    const o = p => hat([p[0] + dx, p[1]]);
    const beam = [[12, -20], [6, -60], [-6, -96], [2, -128]].map(o);
    const tines = [[[6, -60], [30, -84]], [[-6, -96], [18, -114]], [[-4, -90], [-30, -108]], [[8, -40], [-14, -52]]];
    limb(ctx, beam, 6, col, { id, line: Ink.LINE });
    tines.forEach((t, i) => limb(ctx, t.map(o), 4.2, col, { id: id + i + 1 }));
  }
  function draw(ctx, P) {
    const r = rig(P), hat = r.hat;
    // far legs
    [r.legs[2], r.legs[3]].forEach((l, i) => limb(ctx, [l.top, knee(l.top, l.foot, 70, 80, l.front), l.foot], 9, C.far, { id: 40 + i, sock: C.dark, sockLen: 0.12 }));
    // far antler, far ear behind everything of the head
    antler(ctx, hat, 10, C.antD, 50);
    shape(ctx, [hat([8, -18]), hat([-20, -52]), hat([-6, -16])], C.far, { id: 56 });
    // body + tail
    shape(ctx, tr([[-102, -270], [-120, -262], [-114, -244], [-100, -250]], r.B, 0), C.cream, { id: 57 });
    shape(ctx, tr(TORSO, r.B, 0), C.fur, { id: 58, shadow: tr([[-110, -232], [104, -236], [104, -190], [-110, -190]], r.B, 0), shadowCol: C.sh });
    shape(ctx, tr([[-50, -214], [40, -212], [30, -203], [-40, -204]], r.B, 0), C.cream, { id: 59, lw: 0 });
    // neck: from the shoulders to the back of the head
    const n0 = [62, -290 + r.B[1]], n1 = [96, -228 + r.B[1]], h0 = hat([-8, -14]), h1 = hat([12, 12]);
    const mid = (a, b, k) => [lerp(a[0], b[0], 0.5) + k, lerp(a[1], b[1], 0.5)];
    const neck = [n0, mid(n0, h0, -6), h0, h1, mid(n1, h1, 8), n1, [80, -262 + r.B[1]]];
    shape(ctx, neck, C.fur, { id: 60, shadow: [mid(n0, h0, 6), h0, h1, mid(n1, h1, 20), n1], shadowCol: 'rgba(70,30,40,0.16)' });
    shape(ctx, [mid(n1, h1, 4), h1, hat([20, 12]), mid(n1, h1, 16), [96, -236 + r.B[1]]], C.cream, { id: 61, lw: 0 });
    // near legs
    [r.legs[0], r.legs[1]].forEach((l, i) => limb(ctx, [l.top, knee(l.top, l.foot, 70, 80, l.front), l.foot], 10, C.fur, { id: 62 + i, sock: C.dark, sockLen: 0.12 }));
    // head
    shape(ctx, tr(HEAD, r.Hb, r.ha), C.fur, { id: 64, shadow: tr([[-14, 2], [72, 2], [72, 16], [-14, 16]], r.Hb, r.ha), shadowCol: C.sh });
    shape(ctx, tr([[50, -2], [69, 0], [68, 10], [50, 12]], r.Hb, r.ha), C.cream, { id: 65, lw: 0 });
    const ns = hat([67, 2]); dot(ctx, ns[0], ns[1], 5, C.dark);
    const ey = hat([28, -8]); eye(ctx, ey[0], ey[1], 4.2, P.blink ? 0 : 1);
    const fl = (P.earFlick || 0);
    shape(ctx, [hat([0, -18]), hat([-34 - 6 * fl, -40 - 10 * fl]), hat([-10, -10])], C.fur, { id: 66 });
    shape(ctx, [hat([-4, -16]), hat([-26 - 5 * fl, -36 - 8 * fl]), hat([-10, -12])], C.inner, { id: 67, lw: 0 });
    antler(ctx, hat, 0, C.antler, 70);
    return r;
  }
  return { draw, rig };
})();
