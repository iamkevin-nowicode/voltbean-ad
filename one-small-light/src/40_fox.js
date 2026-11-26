'use strict';
// ---- THE FOX KIT: a small red fox, drawn side-on facing right, origin on the ground under its middle (y down). ----
// Pose: walk (cycles), walkAmt, hop (px), tilt (rad, nose up +), sit, stand, flop, crouch (0..1), look (rad, up +),
// ear (droop 0..1), wag, blink (bool). Returns anchors in local space: mouth (lantern handle), feet.
const Fox = (() => {
  const C = { fur: '#d9692c', far: '#a84a20', cream: '#f7e8d2', dark: '#3a2620', sh: 'rgba(110,35,30,0.32)', inner: '#5a3024' };
  const TORSO = [[-14, -2], [-6, -16], [16, -20], [40, -19], [58, -15], [70, -6], [68, 8], [54, 15], [30, 16], [6, 14], [-10, 9]];
  const CHEST = [[46, 4], [64, -2], [70, 6], [58, 14], [44, 12]];
  const HEAD = [[0, -6], [2, -22], [14, -30], [26, -26], [34, -16], [44, -9], [47, -5], [42, -1], [28, 2], [12, 4], [0, 2]];
  const CHEEK = [[16, -7], [30, -9], [45, -5], [41, 1], [27, 3], [12, 1]];
  const { tr, rot, knee, shape, limb, eye, dot } = Ink;

  function rig(P) {
    const sit = P.sit || 0, stand = P.stand || 0, flop = P.flop || 0, crouch = P.crouch || 0, wa = P.walkAmt || 0;
    const ph = (P.walk || 0) * TAU;
    let hy = -44; hy = lerp(hy, -24, sit); hy = lerp(hy, -40, stand); hy = lerp(hy, -19, flop); hy += crouch * 12;
    hy -= Math.abs(Math.sin(ph)) * 3 * wa;
    const hx = -30 + 8 * sit + 16 * stand + 4 * flop;
    const ang = -((P.tilt || 0) + 0.78 * sit + 1.3 * stand) + flop * 0.04;
    const H = [hx, hy - (P.hop || 0)];
    const at = p => { const r = rot(p, ang); return [H[0] + r[0], H[1] + r[1]]; };
    const S = at([52, 4]), Hj = at([2, 4]), N = at([62, -8]);
    const headAng = ang * (0.55 - 0.3 * stand) - (P.look || 0) + flop * 0.3;
    const hat = p => { const r = rot(p, headAng); return [N[0] + r[0], N[1] + r[1]]; };
    // feet: trot, then blend toward the held poses
    const gy = -(P.hop || 0) * 0.6;
    const foot = (base, off, lift) => { const u = ph + off * TAU; return [base + Math.sin(u) * 15 * wa, gy - Math.max(0, Math.cos(u)) * lift * wa]; };
    let fN = foot(S[0] + 4, 0, 9), fF = foot(S[0] + 2, 0.5, 9), hN = foot(Hj[0] - 4, 0.5, 8), hF = foot(Hj[0] - 2, 0, 8);
    const blend = (f, tgt, k) => [lerp(f[0], tgt[0], k), lerp(f[1], tgt[1], k)];
    fN = blend(fN, [S[0] + 3, 0], sit); fF = blend(fF, [S[0] - 3, 0], sit); hN = blend(hN, [Hj[0] + 22, 0], sit); hF = blend(hF, [Hj[0] + 16, 0], sit);
    fN = blend(fN, [S[0] + 18, S[1] + 18], stand); fF = blend(fF, [S[0] + 12, S[1] + 22], stand); hN = blend(hN, [Hj[0] + 8, 0], stand); hF = blend(hF, [Hj[0] - 4, 0], stand);
    fN = blend(fN, [S[0] + 30, -4], flop); fF = blend(fF, [S[0] + 22, -2], flop); hN = blend(hN, [Hj[0] - 30, -4], flop); hF = blend(hF, [Hj[0] - 24, -2], flop);
    return { H, ang, S, Hj, N, headAng, at, hat, fN, fF, hN, hF, mouth: hat([40, 1]), headTop: hat([16, -30]) };
  }

  function tail(ctx, r, P) {
    const sit = P.sit || 0, base = r.at([-12, -4]);
    let a = r.ang + Math.PI - 0.3 - 0.7 * sit + Math.sin(P.wag || 0) * 0.22 + (P.flop || 0) * 0.25 - (P.stand || 0) * 0.3;
    const curl = -0.05 - 0.32 * sit, seg = 8, pts = [base];
    for (let i = 1; i <= seg; i++) { a += curl + Math.sin((P.wag || 0) - i * 0.5) * 0.04; const p = pts[i - 1]; pts.push([p[0] + Math.cos(a) * 8.5, p[1] + Math.sin(a) * 8.5]); }
    const L = [], R = [];
    pts.forEach((p, i) => {
      const q = pts[Math.min(i + 1, seg)], o = pts[Math.max(i - 1, 0)], tx = q[0] - o[0], ty = q[1] - o[1], l = Math.hypot(tx, ty) || 1, u = i / seg;
      const w = 4 + 11 * Math.pow(Math.sin(Math.PI * (0.12 + 0.82 * u)), 0.8) * (u > 0.97 ? 0.3 : 1);
      L.push([p[0] - ty / l * w, p[1] + tx / l * w]); R.unshift([p[0] + ty / l * w, p[1] - tx / l * w]);
    });
    shape(ctx, L.concat(R), C.fur, { id: 31, shadow: R.map(p => [p[0], p[1]]).concat(pts.slice().reverse()), shadowCol: C.sh });
    const k = 6; const tipPts = L.slice(k).concat(R.slice(0, seg + 1 - k));
    shape(ctx, tipPts, C.cream, { id: 32 });
  }

  function draw(ctx, P) {
    const r = rig(P);
    // far legs
    limb(ctx, [r.Hj, knee(r.Hj, r.hF, 20, 22, -1), r.hF], 6.5, C.far, { id: 1, sock: C.dark, sockLen: 0.45 });
    limb(ctx, [r.S, knee(r.S, r.fF, 18, 20, 1), r.fF], 6.5, C.far, { id: 2, sock: C.dark, sockLen: 0.5 });
    tail(ctx, r, P);
    // body
    const T = tr(TORSO, r.H, r.ang);
    shape(ctx, T, C.fur, { id: 3, shadow: tr([[-16, 3], [72, 3], [72, 22], [-16, 22]], r.H, r.ang), shadowCol: C.sh });
    shape(ctx, tr(CHEST, r.H, r.ang), C.cream, { id: 4, lw: 0 });
    shape(ctx, tr([[-12, -6], [4, -12], [18, -4], [16, 10], [0, 14], [-12, 8]], r.H, r.ang), C.fur, { id: 5, shadow: tr([[-14, 4], [20, 4], [20, 16], [-14, 16]], r.H, r.ang), shadowCol: C.sh, lw: 1.6 });
    // near legs
    limb(ctx, [r.Hj, knee(r.Hj, r.hN, 20, 22, -1), r.hN], 7, C.fur, { id: 6, sock: C.dark, sockLen: 0.45 });
    limb(ctx, [r.S, knee(r.S, r.fN, 18, 20, 1), r.fN], 7, C.fur, { id: 7, sock: C.dark, sockLen: 0.5 });
    // ears (behind the head's outline), then head
    const e = clamp(P.ear || 0), hat = r.hat;
    const ear = (b0, b1, up, down, col, id) => { const tip = [lerp(up[0], down[0], e), lerp(up[1], down[1], e)];
      shape(ctx, [hat(b0), hat(tip), hat(b1)], col, { id }); shape(ctx, [hat([lerp(b0[0], b1[0], 0.3), b0[1] - 1]), hat([lerp(tip[0], b0[0], 0.25), lerp(tip[1], b0[1], 0.25)]), hat([lerp(b0[0], b1[0], 0.75), b1[1] - 1])], C.inner, { id: id + 1, lw: 0 }); };
    ear([5, -23], [16, -28], [3, -50], [-16, -34], C.far, 10);
    ear([15, -28], [27, -23], [22, -54], [-2, -40], C.fur, 12);
    shape(ctx, tr(HEAD, r.N, r.headAng), C.fur, { id: 14, shadow: tr([[0, -4], [48, -4], [48, 6], [0, 6]], r.N, r.headAng), shadowCol: C.sh });
    shape(ctx, tr(CHEEK, r.N, r.headAng), C.cream, { id: 15, lw: 1.4 });
    const n = hat([46, -6]); dot(ctx, n[0], n[1], 3.3, C.dark);
    const ey = hat([27, -16]); eye(ctx, ey[0], ey[1], 2.9, P.blink ? 0 : 1);
    if (P.sad) { const b = hat([22, -21]), c = hat([31, -23]); ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(c[0], c[1] + 2); ctx.strokeStyle = Ink.LINE; ctx.lineWidth = 1.5; ctx.stroke(); }
    return r;
  }
  return { draw, rig };
})();
