'use strict';
// ---- ACTORS: one simulation, stepped 240 times a second from the first frame, moves everyone (see 'One Small Light').
// New here: wind. The storm pushes on ears, tails, the lantern and the robin; the fox leans into it; the robin is torn
// off its branch by a gust and tumbles down the hill. And rest: the deer lies down, the fox curls up, the robin nestles.
const Actors = (() => {
  const DT = 1 / 240, FS = 1.1, DS = 1.15;
  const { Spring, ballistic, Gait } = Phys;
  const rot = Ink.rot;
  const toW = (o, g, f, s, p) => { const r = rot([f * p[0] * s, p[1] * s], g); return [o[0] + r[0], o[1] + r[1]]; };
  const toL = (o, g, f, s, p) => { const r = rot([p[0] - o[0], p[1] - o[1]], -g); return [f * r[0] / s, r[1] / s]; };
  const slope = x => Math.atan(hillSlope(x));
  const CUT = Story.CUT;
  const blinkAt = (t, list, base = 1) => { let b = base; for (const x of list) { const d = t - x; if (d > 0 && d < 0.16) b = Math.min(b, Math.abs(d - 0.08) / 0.08); } return b; };
  const flick = (t, list, w = 0.25) => list.reduce((a, x) => a + (t > x && t < x + w ? Math.sin(Math.PI * (t - x) / w) : 0), 0);
  const pick = (t, list, dflt = 0) => { for (const [a, b, v] of list) if (t >= a && t < b) return v; return dflt; };
  const sleepy = (t, t0, t1) => 1 - smooth(t0, t1, t);          // eyes closing for good
  const BRANCH = () => [TREE.x - 34, TREE.top + 96];             // the robin's perch near the top of the tree
  const ROBIN_LAND = [1452, 0];

  let S = null;
  function fresh() {
    const sp = (x, f, z) => new Spring(x, f, z);
    const s = {
      t: 0, events: [],
      deer: { gait: new Gait({ who: 'deer', pattern: 'walk', stride: 120, lift: 20, dur: 0.36, lead: 0.22, settle: 5, overlap: 0.2, order: [0, 1, 2, 3],
        feet: [{ id: 'hn', home: -56 * DS, side: 'n' }, { id: 'fn', home: 62 * DS, side: 'n' }, { id: 'hf', home: -64 * DS, side: 'f' }, { id: 'ff', home: 54 * DS, side: 'f' }] }),
        n: sp(0, 1.4, 0.85), lie: sp(0, 1.2, 0.9), ears: [sp(0, 3, 0.3), sp(0, 3, 0.3)], tail: sp(0, 5, 0.3), bob: sp(0, 3, 0.7), face: -1 },
      fox: { gait: new Gait({ who: 'fox', pattern: 'trot', stride: 60, lift: 10, dur: 0.17, lead: 0.1, settle: 3,
        feet: [{ id: 'fn', home: 30 * FS, group: 0 }, { id: 'hf', home: -27 * FS, group: 0 }, { id: 'ff', home: 23 * FS, group: 1 }, { id: 'hn', home: -20 * FS, group: 1 }] }),
        s: sp(1, 4.5, 0.75), u: sp(0, 4.5, 0.7), c: sp(0, 5, 0.65), a: sp(0, 7, 0.8), l: sp(0, 2.2, 0.8), fw: sp(0, 9, 1), look: sp(0, 2.6, 0.6), reach: sp(0, 3, 0.8), tilt: sp(0, 3, 0.6),
        ears: [sp(-0.15, 4, 0.3), sp(-0.15, 4, 0.3)], tail: Array.from({ length: Fox.TAIL.n }, () => ({ x: Math.PI - 1, v: 0 })), g: sp(0, 4, 1),
        face: 1, faceS: 1, root: [2470, hillY(2470)], vel: [0, 0], acc: [0, 0], mode: 'ground' },
      hare: { em: sp(0, 2.6, 0.45), st: sp(0, 8, 0.7), cr: sp(0, 6, 0.6), ears: [sp(0, 3.5, 0.25), sp(0, 3.5, 0.25)], x: 1690, y: hillY(1690), vy: 0 },
      robin: { p: BRANCH(), face: 1, flap: 0, ang: 0, fluff: sp(0, 4, 0.5) },
      lan: { th: 0, om: 0 },
    };
    s.fox.gait.plant({ x: 2470, vx: 0, face: 1 }); s.deer.gait.plant({ x: 2380, vx: 0, face: -1 });
    return s;
  }
  const event = (kind, t, x, y, extra) => S.events.push(Object.assign({ kind, t, x, y }, extra || {}));

  // ----------------------------------------------------------------------------------------------------- the deer
  function deerStep(t) {
    const D = S.deer, [x, vx] = Story.deerX(t), face = Story.deerFace(t);
    if (face !== D.face) { D.face = face; D.gait.plant({ x, vx, face }); }      // the cut: a new shot, the deer now heading home
    const n0 = D.gait.events.length; D.gait.update(t, DT, { x, vx, face });
    for (let i = n0; i < D.gait.events.length; i++) { const e = D.gait.events[i]; if (t > 33.6) event('step', t, e.x, e.y, { who: 'deer' }); }
    const lifts = {}; let lsum = 0; for (const f of D.gait.feet) { lifts[f.id] = f.lift; lsum += f.lift; }
    const nT = kf([[37.2, 0], [37.9, -1], [38.9, -1], [40.4, 0], [46.6, 0], [47.6, -0.2], [48.8, -0.15], [51.0, -0.15], [52.2, -0.5]], t) - 0.25 * clamp(Math.abs(vx) / 150) * (t > CUT ? 1 : 0.4);
    D.n.step(nT, DT); D.lie.step(t > 47.6 ? 1 : 0, DT);
    D.bob.step(lsum * 2.2 + Math.sin(t * TAU * (t > 49 ? 0.25 : 0.35)) * (t > 49 ? 1.6 : 0.8), DT);
    const st = Story.storm(t), wl = Story.wind(t) * face;
    D.ears[0].step(0.35 * flick(t, [34.8, 39.4, 44.2, 50.6], 0.3) + wl * 0.0011 + st * 0.08 * Math.sin(t * 21), DT);
    D.ears[1].step(0.3 * flick(t, [34.85, 44.25], 0.3) + wl * 0.0011, DT);
    D.tail.step(0.5 * flick(t, [36.0, 42.6, 45.1, 49.2], 0.22) + wl * 0.0009, DT);
    D.root = [x, hillY(x)]; D.g = slope(x) * 0.6 * (1 - D.lie.x);
    const feet = {}; for (const f of D.gait.feet) feet[f.id] = toL(D.root, D.g, face, DS, f.p);
    D.P = { n: D.n.x, nod: 0.05 * ((lifts.fn || 0) + (lifts.ff || 0)), lie: D.lie.x, feet, lift: lifts, bob: D.bob.x, ears: [D.ears[0].x, D.ears[1].x], tail: D.tail.x,
      blink: blinkAt(t, [35.6, 39.0, 43.3, 47.0, 51.7]) * (t > 53.5 ? sleepy(t, 54.6, 55.6) : 1) };
    D.R = Deer.solve(D.P);
  }
  const deerW = p => toW(S.deer.root, S.deer.g, S.deer.face, DS, p);
  const deerHeadAngle = () => S.deer.face * S.deer.R.ah + S.deer.g;

  // ----------------------------------------------------------------------------------------------------- the fox
  function foxPlan(t) {
    if (t < 38.3) { if (t >= 25.8 || t < 13.7) return { mode: 'ground', x: Story.foxX(t) }; return { mode: 'ground', x: Story.foxX(t) }; }
    if (t < 38.65) return { mode: 'air', from: [1764, hillY(1764)], to: deerW(S.deer.R.headTop), t0: 38.3, t1: 38.65, toRide: true };
    if (t < 40.6) return { mode: 'neck' };
    if (t < 49.0) return { mode: 'back' };
    if (t < 49.42) return { mode: 'air', from: S.fox.hopFrom || S.fox.root, to: [2452, hillY(2452)], t0: 49.0, t1: 49.42 };
    return { mode: 'ground', x: [2452, 0] };
  }
  function foxTargets(t) {
    return {
      s: pick(t, [[0, 13.6, 1]]),
      c: pick(t, [[10.6, 13.6, 0.35], [15.0, 16.4, 0.45], [24.2, 25.2, 1.0], [25.8, 30.0, 0.42], [30.0, 31.0, 0.9], [37.95, 38.3, 0.8], [38.65, 40.6, 0.55], [48.85, 49.0, 0.7]]),
      a: pick(t, [[38.3, 38.6, 0.7], [49.0, 49.36, 0.5]]),
      l: pick(t, [[31.0, 37.9, 1], [40.6, 49.0, 1], [49.5, 99, 1]]),
      look: pick(t, [[0, 4.8, 0.15], [4.8, 7.0, 0.55], [7.0, 7.8, 0.35], [7.8, 8.8, 0.05], [8.8, 10.2, 0.5], [10.2, 13.6, 0.0], [13.6, 16.4, -0.15], [16.4, 22.8, -0.1],
        [22.8, 23.9, -0.45], [23.9, 25.2, -0.6], [25.2, 30.0, -0.25], [30.0, 31.0, -0.4], [31.0, 34.4, -0.35], [34.4, 37.9, 0.15], [37.9, 40.6, -0.1], [40.6, 46.4, 0.1],
        [46.4, 49.0, 0.35], [49.5, 52.4, -0.3], [52.4, 53.6, 0.25], [53.6, 99, -0.35]]),
      reach: pick(t, [[23.0, 23.9, 0.75], [24.2, 25.1, 0.45]]),
      tilt: pick(t, [[7.85, 8.7, -0.18], [23.2, 23.9, 0.15]]),
      ear: pick(t, [[7.8, 8.0, 0.25], [13.6, 13.9, 0.2], [31.0, 33.3, -1.1], [33.3, 34.4, -0.7], [34.4, 35.2, 0.05], [52.4, 99, -0.35]], -0.15),
    };
  }
  const STEP_FACE = t => (t < 13.7 ? 1 : t < 13.95 ? Math.cos(Math.PI * ease.inOut((t - 13.7) / 0.25)) : t < 25.3 ? -1 : t < 25.6 ? -Math.cos(Math.PI * ease.inOut((t - 25.3) / 0.3)) : 1);
  function foxStep(t) {
    const F = S.fox, plan = foxPlan(t), tg = foxTargets(t), prevRoot = F.root.slice(), prevMode = F.mode;
    F.l.set(t > 31 && t < 31.6 ? 3.2 : 2.2, t > 31 && t < 31.6 ? 0.55 : 0.8);       // the collapse lands with a little bounce
    for (const k of ['s', 'c', 'a', 'u', 'l', 'look', 'reach', 'tilt']) F[k].step(tg[k] === undefined ? 0 : tg[k], DT);
    const fT = STEP_FACE(t); F.faceS = fT; F.face = fT >= 0 ? 1 : -1;
    let root, g, grounded = false, feetFromGait = false;
    if (plan.mode === 'ground') {
      root = [plan.x[0], hillY(plan.x[0])]; grounded = true; F.g.step(slope(root[0]) * 0.9, DT); g = F.g.x;
      if (prevMode === 'air') { F.c.v += 7; replant(root, g); event('land', t, root[0], root[1], { r: 26 }); }
      if (Math.abs(t - 13.6) < DT / 2 || Math.abs(t - 25.6) < DT / 2 || Math.abs(t - 13.95) < DT / 2) replant(root, g);
      if (F.s.x < 0.5 && F.l.x < 0.5) {
        const n0 = F.gait.events.length; F.gait.update(t, DT, { x: root[0], vx: plan.x[1], face: F.face });
        for (let i = n0; i < F.gait.events.length; i++) { const e = F.gait.events[i]; event('step', t, e.x, e.y, { who: 'fox' }); }
        feetFromGait = true;
      }
    } else if (plan.mode === 'air') {
      const to = plan.toRide ? deerW(S.deer.R.headTop) : plan.to, b = ballistic(plan.from, to, plan.t0, plan.t1, t);
      root = [b[0], b[1]]; F.g.step(plan.toRide ? deerHeadAngle() * clamp((t - plan.t0) / (plan.t1 - plan.t0)) : 0, DT); g = F.g.x;
    } else if (plan.mode === 'neck') {          // climbing the neck as the deer lifts its head: along the top line, head to back
      if (prevMode === 'air') { F.c.v += 6; event('land', t, F.root[0], F.root[1], { r: 0 }); }
      const path = S.deer.R.path.map(deerW), u = ease.inOut(clamp((t - 38.65) / (40.5 - 38.65)));
      const L = []; let tot = 0; for (let i = 1; i < path.length; i++) { const l = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); L.push(l); tot += l; }
      let d = u * tot * 0.92, i = 0; while (i < L.length - 1 && d > L[i]) { d -= L[i]; i++; }
      const a = path[i], b = path[i + 1], k = clamp(d / L[i]);
      root = [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
      F.g.step(Math.atan2(b[1] - a[1], b[0] - a[0]), DT); g = F.g.x;
      F.climb = (F.climb || 0) + Math.hypot(root[0] - prevRoot[0], root[1] - prevRoot[1]);
    } else {                                     // lying on the deer's back
      const R = S.deer.R; root = deerW(R.path[R.path.length - 2]); F.g.step(S.deer.g + 0.04 * S.deer.face, DT); g = F.g.x;
      F.hopFrom = root.slice();
    }
    const vel = [(root[0] - prevRoot[0]) / DT, (root[1] - prevRoot[1]) / DT];
    if (Math.abs(t - CUT) < DT) F.vel = vel;                                    // no jolt across the cut
    F.acc = [clamp((vel[0] - F.vel[0]) / DT, -4000, 4000), clamp((vel[1] - F.vel[1]) / DT, -4000, 4000)]; F.vel = vel;
    F.root = root; F.gRoot = g; F.mode = plan.mode;
    F.fw.step(feetFromGait ? 1 : 0, DT);
    const feet = {}, lift = {};
    for (const f of F.gait.feet) { feet[f.id] = toL(root, g, F.face, FS, f.p); lift[f.id] = f.lift; }
    if (plan.mode === 'neck') {                  // paws taking turns on the deer's neck
      const ph = (F.climb || 0) / 26 * TAU, d0 = Fox.POSE.crouch;
      for (const [k, off] of [['fn', 0], ['hf', 0], ['ff', Math.PI], ['hn', Math.PI]]) { const sw = Math.sin(ph + off); feet[k] = [d0[k][0] + sw * 6, -Math.max(0, Math.cos(ph + off)) * 5]; lift[k] = Math.max(0, Math.cos(ph + off)); }
      F.fw.x = 1;
    }
    const st = Story.storm(t), wl = Story.wind(t) * F.face;                     // wind along the fox's own facing
    const breath = Math.sin(t * TAU * (F.l.x > 0.5 ? 0.3 : 0.55)) * (F.l.x > 0.5 ? 0.9 : 0.5) + (t > 31.3 && t < 32.3 ? Math.sin((t - 31.3) * Math.PI) * 2.5 : 0);
    const airPitch = plan.mode === 'air' ? clamp(F.vel[1] * 0.00035, -0.3, 0.3) : 0;
    F.P = { w: { s: F.s.x, u: F.u.x, c: F.c.x, a: F.a.x, l: F.l.x }, feet, feetW: F.fw.x, lift, bob: breath, stretch: 1 + 0.07 * F.a.x, pitch: airPitch,
      look: F.look.x, reach: F.reach.x, tilt: F.tilt.x,
      blink: blinkAt(t, [3.2, 6.4, 9.3, 18.9, 27.7, 36.1, 43.0, 48.2]) * (t > 10.6 && t < 34.4 ? 0.62 + 0.38 * (1 - st) : 1) * (t > 53 ? sleepy(t, 53.8, 55.0) : 1) * (t > 31.2 && t < 34.4 ? 0.7 : 1),
      sad: t > 31.3 && t < 34.4 ? 1 : 0 };
    // tail: a chain of springs; the body's motion and the wind act on it; it lies on the ground, and at the end wraps the robin
    const R0 = Fox.solve(F.P), ws = R0.ws, wag = (t < 10 ? 0.12 * Math.sin(t * 3.2) : 0) + (t > 7.8 && t < 8.8 ? 0.25 * Math.sin(t * 9) : 0);
    const rest = Fox.tailRest(ws, wag); rest.curl -= 0.12 * smooth(50.6, 51.6, t);
    const la = rot([F.acc[0] * F.face - wl * 3, F.acc[1]], -g);
    const pts = [R0.TB];
    for (let i = 0; i < F.tail.length; i++) {
      const sg = F.tail[i], tgt = (i === 0 ? R0.dir + rest.base : F.tail[i - 1].x + rest.curl), w0 = 5.5 - i * 0.45, k = (TAU * w0) ** 2, c = 2 * 0.32 * TAU * w0;
      const inert = (la[0] * Math.sin(sg.x) - la[1] * Math.cos(sg.x)) * 0.012 + st * 30 * Math.sin(t * 17 + i), grav = Math.cos(sg.x) * 18;
      sg.v += (k * (tgt - sg.x) - c * sg.v + inert + grav) * DT; sg.x += sg.v * DT;
      let q = [pts[i][0] + Math.cos(sg.x) * Fox.TAIL.len, pts[i][1] + Math.sin(sg.x) * Fox.TAIL.len];
      if (q[1] > -1.5) { const dy = -1.5 - pts[i][1], ang = Math.asin(clamp(dy / Fox.TAIL.len, -1, 1)); sg.x = Math.cos(sg.x) < 0 ? Math.PI - ang : ang; sg.v *= 0.3; q = [pts[i][0] + Math.cos(sg.x) * Fox.TAIL.len, pts[i][1] + Math.sin(sg.x) * Fox.TAIL.len]; }
      pts.push(q);
    }
    F.P.tail = F.tail.map(s => s.x);
    // ears: springs that flop with the head and stream back in the wind
    for (let i = 0; i < 2; i++) F.ears[i].step(tg.ear, DT, la[1] * 0.004 + wl * 0.6 * (i ? 0.9 : 1) + st * 70 * Math.sin(t * 23 + i * 2));
    F.P.ears = [F.ears[0].x, F.ears[1].x - 0.05];
    F.R = Fox.solve(F.P);
    const fs = F.faceS === 0 ? 1e-3 : F.faceS;
    F.headTop = toW(root, g, fs, FS, F.R.headTop); F.headAng = g + fs * F.R.ah * (fs < 0 ? -1 : 1) * Math.sign(fs);
    F.tailNest = toW(root, g, fs, FS, mixP(F.R.tail[4], F.R.tail[5], 0.5));
  }
  const mixP = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
  function replant(root, g) {
    const F = S.fox, R = Fox.solve(F.P || { w: {} });
    const map = { fn: R.leg.fn.toe, ff: R.leg.ff.toe, hn: R.leg.hn.toe, hf: R.leg.hf.toe };
    for (const f of F.gait.feet) { const w = toW(root, g, F.face, FS, map[f.id]); f.p = [w[0], hillY(w[0])]; f.sw = null; f.lift = 0; }
  }

  // ----------------------------------------------------------------------------------------------------- the lantern
  // still hanging from the tip of the tree where the fox put it; the wind swings it
  const LL = 22;
  function lanternStep(t) {
    const L = S.lan, w = Story.wind(t);
    L.om += ((w * 1.25 * Math.cos(L.th) - Phys.G * Math.sin(L.th)) / LL - 2.0 * L.om) * DT; L.th += L.om * DT;
    if (Math.abs(L.th) > 0.95) { L.th = Math.sign(L.th) * 0.95; L.om *= -0.3; }
    L.h = [TREE.x, TREE.top + 4]; L.ang = -L.th;
    L.glow = kf([[0, 1.25], [52.3, 1.3], [52.6, 2.2, 'out'], [54, 1.6]], t) * (1 - 0.25 * Story.storm(t) * (0.5 + 0.5 * vn1(t * 7)));
  }

  // ----------------------------------------------------------------------------------------------------- the hare
  const HOPS = (() => {           // out of the burrow to the fox; after the cut, along behind the deer; at the end, in close
    const h = [[33.9, 34.25, 1690, 1716]];
    let x = 1880; for (let k = 0; k < 8; k++) { const t0 = 41.6 + k * 0.62, x1 = x + 58; h.push([t0, t0 + 0.4, x, x1]); x = x1; }
    h.push([50.1, 50.5, x, 2395]);
    return h;
  })();
  function hareStep(t) {
    const H = S.hare;
    H.em.step(t >= 33.2 ? 1 : 0, DT);
    let x = t < CUT ? 1690 : 1880, y, air = 0, st = 0, crT = 0;
    for (const [t0, t1, x0, x1] of HOPS) {
      if (t0 > 40 && t < CUT) continue;
      if (t >= t0 && t < t1) { const b = ballistic([x0, hillY(x0)], [x1, hillY(x1)], t0, t1, t); x = b[0]; y = b[1]; air = 1; st = Math.sin(Math.PI * (t - t0) / (t1 - t0)); }
      else if (t >= t1) x = x1;
      if (t >= t0 - 0.13 && t < t0) crT = 1;
      if (Math.abs(t - t1) < DT / 2) { H.cr.v += 8; event('land', t, x1, hillY(x1), { r: 16 }); }
    }
    if (!air) y = hillY(x);
    if (t > 50.6) crT = 0.9;                                          // settles in, low and round
    const vy = (y - H.y) / DT, ay = (vy - H.vy) / DT; H.vy = vy; H.x = x; H.y = y;
    H.st.step(st, DT); H.cr.step(crT, DT);
    const wl = Story.wind(t);
    H.ears[0].step((t < 33.5 ? -0.6 : t > 51 ? -0.5 : 0) + wl * 0.0012, DT, -ay * 0.003); H.ears[1].step((t < 33.5 ? -0.6 : t > 51 ? -0.55 : -0.05) + wl * 0.0012, DT, -ay * 0.003);
    if (Math.abs(t - 33.2) < DT / 2) event('land', t, 1690, hillY(1690), { r: 34 });
    H.P = { emerge: H.em.x, stretch: H.st.x, crouch: H.cr.x, ears: [H.ears[0].x, H.ears[1].x], blink: blinkAt(t, [36.4, 44.6, 49.0]) * (t > 53 ? sleepy(t, 54.3, 55.3) : 1) };
  }

  // ----------------------------------------------------------------------------------------------------- the robin
  const bez = (a, c, b, e) => [(1 - e) * (1 - e) * a[0] + 2 * (1 - e) * e * c[0] + e * e * b[0], (1 - e) * (1 - e) * a[1] + 2 * (1 - e) * e * c[1] + e * e * b[1]];
  function robinStep(t) {
    const B = S.robin, F = S.fox, br = BRANCH(), land = [ROBIN_LAND[0], hillY(ROBIN_LAND[0]) + 4];
    let p, fly = 0, flare = 0, ang = 0, face = B.face, shiver = 0;
    const flight = (a, b, t0, t1, h) => { const u = clamp((t - t0) / (t1 - t0)), e = ease.inOut(u); fly = 1; flare = smooth(0.72, 0.95, u); face = b[0] > a[0] ? 1 : -1; return bez(a, [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - h], b, e); };
    if (t < 7.0) { p = br; face = 1; }
    else if (t < 7.8) p = flight(br, F.headTop, 7.0, 7.8, 40);
    else if (t < 8.8) { p = F.headTop; face = 1; }
    else if (t < 9.7) p = flight(F.headTop, br, 8.8, 9.7, 60);
    else if (t < 13.4) { p = br; face = 1; ang = -0.25 * Story.storm(t); }
    else if (t < 15.4) {                       // torn off by the gust: tumbling, flapping uselessly, carried down the hill
      const u = (t - 13.4) / 2.0, e = 1 - Math.pow(1 - u, 1.6);
      p = bez(br, [2050, 560], land, e); p = [p[0] + 18 * Math.sin(u * 19), p[1] + 10 * Math.sin(u * 13)];
      fly = 1; ang = u * 11 + Math.sin(u * 7); face = -1;
      if (t + DT >= 15.4) event('land', t, land[0], land[1], { r: 30 });
    }
    else if (t < 24.6) {                       // in the snow, shivering; tries to fly and can't
      const tryF = t > 23.3 && t < 24.0; p = [land[0], land[1] - (tryF ? Math.abs(Math.sin((t - 23.3) * 14)) * 7 : 0)]; face = 1;
      shiver = 1; fly = tryF ? 1 : 0; ang = 0.15;
    }
    else if (t < 25.0) { const b = ballistic(land, F.headTop, 24.6, 25.0, t); p = [b[0], b[1]]; fly = 1; flare = smooth(24.85, 24.98, t); face = 1; }
    else if (t < 50.0) { p = F.headTop; face = F.face; ang = 0; shiver = clamp(1 - (t - 42) / 6); }
    else if (t < 50.45) { const b = ballistic(F.headTop, F.tailNest, 50.0, 50.45, t); p = [b[0], b[1]]; fly = 1; flare = smooth(50.3, 50.43, t); face = -1; }
    else { p = F.tailNest; face = 1; }
    B.face = face; B.flap += DT * TAU * (fly ? lerp(14, 6, flare) : 0);
    B.fluff.step(t > 52.5 && t < 52.8 ? 1 : 0, DT);
    const jit = shiver ? [Math.sin(t * 113) * 0.7, Math.sin(t * 97) * 0.4] : [0, 0];
    B.p = [p[0] + jit[0], p[1] + jit[1]]; B.ang = ang;
    B.P = { fly, flap: B.flap, wing: fly ? lerp(Math.sin(B.flap) * 1.1 - 0.3, -1.25 + 0.25 * Math.sin(B.flap), flare) : undefined, fluff: B.fluff.x,
      blink: (t > 15.4 && t < 25 ? 0.55 : 1) * (t > 53 ? sleepy(t, 54.0, 54.9) : 1) * blinkAt(t, [5.1, 11.2, 26.0, 37.7, 45.5]), sunk: t > 15.4 && t < 24.6 };
  }

  // ----------------------------------------------------------------------------------------------------- stepping
  function step(t) { S.t = t; deerStep(t); foxStep(t); lanternStep(t); hareStep(t); robinStep(t); }
  function reset() { S = fresh(); deerStep(0); foxStep(0); lanternStep(0); hareStep(0); robinStep(0); }
  let simT = -1;
  function advance(t) {
    if (!S || t < simT - 1e-9) { reset(); simT = 0; }
    while (simT + DT <= t + 1e-9) { simT += DT; step(simT); }
    return S;
  }
  // run the whole film once and write every footfall and landing into the score
  let EV = [];
  function boot() {
    S = null; advance(FILM - 0.01);
    const ev = S.events.slice().sort((a, b) => a.t - b.t);
    const seen = [], steps = ev.filter(e => e.kind === 'step').filter(e => { const d = seen.some(q => q.who === e.who && Math.abs(q.t - e.t) < 0.03); seen.push(e); return !d; });
    Score.add(steps.map(e => ({ t: e.t, d: 0.08, m: 0, i: 'step', v: (e.who === 'deer' ? 0.5 : 0.26) * (1 - 0.4 * Story.storm(e.t)), p: clamp((e.x - 2100) / 900, -0.8, 0.8), tag: 'foot' })));
    Score.add([{ t: 0, d: FILM, m: 0, i: 'wind', v: 1, p: 0, env: Array.from({ length: FILM * 10 + 1 }, (_, i) => [i / 10, Story.storm(i / 10)]) }]);
    Score.add(ev.filter(e => e.kind === 'land' && e.r > 20).map(e => ({ t: e.t, d: 0.3, m: 48, i: 'thump', v: 0.25, p: 0, tag: 'landfx' })));
    S = null; simT = -1; EV = ev; return ev;
  }

  // ----------------------------------------------------------------------------------------------------- drawing
  const SCR = [];
  function scratch(i, w, h) { if (!SCR[i] || SCR[i].canvas.width < w || SCR[i].canvas.height < h) { const c = document.createElement('canvas'); c.width = w; c.height = h; SCR[i] = c.getContext('2d'); } return SCR[i]; }
  function prints(ctx, t) {
    for (const e of EV) { if (e.t > t) break; if (e.kind !== 'step') continue;
      const age = t - e.t, fill = clamp(age / 6 * Story.storm(e.t + 1));            // the storm fills prints back in
      const r = e.who === 'deer' ? 6.5 : 4; ctx.fillStyle = `rgba(140,150,200,${0.4 * (1 - fill)})`;
      ctx.beginPath(); ctx.ellipse(e.x, e.y + 2, r, r * 0.42, slope(e.x), 0, TAU); ctx.fill(); }
  }
  function puffs(ctx, t) {
    for (const e of EV) {
      if (e.kind !== 'land' || !e.r) continue; const dt = t - e.t; if (dt < 0 || dt > 1.1) continue;
      const R = rng(Math.floor(e.t * 1000)), k = 1 - Math.exp(-dt * 5), fade = 1 - dt / 1.1, n = Math.round(e.r * 0.5), drift = Story.wind(e.t) * dt * 0.5;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI * (0.05 + 0.9 * R()), d = e.r * (0.3 + 0.8 * R()) * k, rr = (2.5 + 6 * R()) * (1 + dt);
        ctx.fillStyle = `rgba(246,248,255,${0.7 * fade})`; ctx.beginPath(); ctx.arc(e.x + Math.cos(a) * d * 1.4 + drift, e.y + Math.sin(a) * d * 0.6 + dt * dt * 40, rr, 0, TAU); ctx.fill();
      }
    }
  }
  function draw(t, cam, A) {
    advance(t);
    const z = cam[2], toWorld = c => c.setTransform(z * c._s, 0, 0, z * c._s, (W / 2 - cam[0] * z) * c._s, (H / 2 - cam[1] * z) * c._s);
    const ctx = A.actors; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); toWorld(ctx);
    prints(ctx, t);
    const place = (p, g, sx, sy, fn) => { ctx.save(); toWorld(ctx); ctx.translate(p[0], p[1]); ctx.rotate(g); ctx.scale(sx, sy); fn(ctx); ctx.restore(); };
    // a character as a cel: flat fills, ONE line around the whole silhouette, then only the inner lines an animator draws
    const cel = (p, g, sx, sy, rad, col, lw, fill, inner) => {
      toWorld(ctx); const m = ctx.getTransform(), cw = ctx.canvas.width, ch = ctx.canvas.height;
      const sx0 = m.a * p[0] + m.e, sy0 = m.d * p[1] + m.f, R = rad * m.a;
      const x0 = Math.max(0, Math.floor(sx0 - R)), y0 = Math.max(0, Math.floor(sy0 - R)), x1 = Math.min(cw, Math.ceil(sx0 + R)), y1 = Math.min(ch, Math.ceil(sy0 + R));
      if (x1 <= x0 || y1 <= y0) return;
      const w = x1 - x0, h = y1 - y0, Fc = scratch(0, cw, ch), Lc = scratch(1, cw, ch);
      Fc.setTransform(1, 0, 0, 1, 0, 0); Fc.clearRect(0, 0, w, h); Fc.setTransform(m.a, m.b, m.c, m.d, m.e - x0, m.f - y0);
      Fc.save(); Fc.translate(p[0], p[1]); Fc.rotate(g); Fc.scale(sx, sy); Ink.S.fillsOnly = true; fill(Fc); Ink.S.fillsOnly = false; Fc.restore();
      Lc.setTransform(1, 0, 0, 1, 0, 0); Lc.clearRect(0, 0, w, h); Lc.globalCompositeOperation = 'source-over'; Lc.drawImage(Fc.canvas, 0, 0, w, h, 0, 0, w, h);
      Lc.globalCompositeOperation = 'source-in'; Lc.fillStyle = col; Lc.fillRect(0, 0, w, h); Lc.globalCompositeOperation = 'source-over';
      const r = Math.max(0.9, lw * m.a);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; ctx.drawImage(Lc.canvas, 0, 0, w, h, x0 + Math.cos(a) * r, y0 + Math.sin(a) * r, w, h); }
      ctx.drawImage(Fc.canvas, 0, 0, w, h, x0, y0, w, h);
      ctx.restore();
      if (inner) place(p, g, sx, sy, inner);
    };
    const L = S.lan, F = S.fox, D = S.deer, B = S.robin;
    ctx.save(); toWorld(ctx); ctx.translate(L.h[0], L.h[1]); const fl = Lantern.draw(ctx, L.ang, L.glow); ctx.restore();
    const flame = [L.h[0] + fl[0], L.h[1] + fl[1]];
    const drawRobin = () => cel(B.p, B.ang * B.face, B.face * (1 + 0.12 * B.P.fluff), 1 + 0.1 * B.P.fluff, 60, '#3b2a22', 1.3, c => Robin.draw(c, B.P));
    if (t >= 33.4) cel(D.root, D.g, D.face * DS, DS, 560, Deer.LINE, 2.0, c => Deer.draw(c, D.P, D.R), c => Deer.inner(c, D.P, D.R));
    if (t >= 33.2) cel([S.hare.x, S.hare.y], slope(S.hare.x) * 0.6, 1, 1, 150, Hare.LINE, 1.6, c => Hare.draw(c, S.hare.P), c => Hare.draw(c, Object.assign({ pass: 'inner' }, S.hare.P)));
    if (t >= 50.45) drawRobin();                                           // tucked into the curl of the tail: behind the tail tip
    cel(F.root, F.gRoot, F.faceS * FS, FS, 190, Fox.LINE, 1.7, c => Fox.draw(c, F.P, F.R), c => Fox.inner(c, F.P, F.R));
    if (t < 50.45) drawRobin();
    if (B.P.sunk) { ctx.save(); toWorld(ctx); for (let k = 0; k < 5; k++) { ctx.fillStyle = 'rgba(240,243,250,0.95)'; ctx.beginPath(); ctx.ellipse(B.p[0] - 12 + k * 6, B.p[1] - 1 + (k % 2) * 2, 9, 5, 0, 0, TAU); ctx.fill(); } ctx.restore(); }
    toWorld(ctx); puffs(ctx, t);

    const vis = 1 - 0.55 * Story.storm(t);
    const lights = [{ x: flame[0], y: flame[1], r: 300, c: [1, 0.66, 0.3], k: 0.6 * L.glow * vis }];
    for (let k = 0; k < 7; k++) { const tr = World.tree.tiers[6 - k]; lights.push({ x: TREE.x, y: (tr.yb + tr.yt) / 2, r: 300, c: [1, 0.72, 0.38], k: 0.3 * vis }); }
    return { flame, lan: { glow: L.glow * vis }, lights, treeGlow: vis, tierAge: () => 10 + t, vis };
  }
  return { draw, boot, advance, get state() { return S; }, FS, DS };
})();
