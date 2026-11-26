'use strict';
// ---- ACTORS: one simulation, stepped 240 times a second from the first frame, moves everyone.
// Bodies follow their direction with springs (weight and overlap), jumps fly under gravity, feet are planted by the
// stepping system and never slide or sink, tails/ears/the lantern swing from the motion of what carries them, and
// contact is real: the fox rides the deer's head, the lantern rests on the snow, the robin perches on what it lands on.
const Actors = (() => {
  const DT = 1 / 240, FS = 1.1, DS = 1.15;
  const { Spring, ballistic, cruise, Gait } = Phys;
  const rot = Ink.rot;
  const toW = (o, g, f, s, p) => { const r = rot([f * p[0] * s, p[1] * s], g); return [o[0] + r[0], o[1] + r[1]]; };
  const toL = (o, g, f, s, p) => { const r = rot([p[0] - o[0], p[1] - o[1]], -g); return [f * r[0] / s, r[1] / s]; };
  const slope = x => Math.atan(hillSlope(x));
  const CFG = { deerX: 2800 };
  // the timetable (seconds)
  const T = {
    walk0: 3.7, walk1: 10.1, fx0: 1500, fx1: 2425,
    c1: 10.33, j1: 10.55, l1: 10.93, c2: 11.0, j2: 11.18, l2: 11.66, drop: 11.62,
    rise: 16.85, wl0: 16.95, wl1: 17.42, r0: 17.42, pick: 17.62, r1: 17.86, c3: 17.96, j3: 18.2, l3: 18.7,
    turn0: 19.4, turn1: 19.62, up0: 19.95, up1: 20.3, hang0: 20.42, hang1: 20.6, down0: 20.85, slide0: 22.6, slide1: 23.5,
    deer0: 12.9, deer1: 17.35, lower0: 17.45, lower1: 18.1, raise0: 18.98, raise1: 20.0, rest0: 22.6, rest1: 23.6,
  };
  const FOX_BLINK = [3.2, 7.4, 10.2, 14.6, 16.4, 19.2, 24.8, 27.9], DEER_BLINK = [16.8, 21.7, 26.4], HARE_BLINK = [17.3, 25.2];
  const blinkAt = (t, list, base = 1) => { let b = base; for (const x of list) { const d = t - x; if (d > 0 && d < 0.16) b = Math.min(b, Math.abs(d - 0.08) / 0.08); } return b; };
  const flick = (t, list, w = 0.25) => list.reduce((a, x) => a + (t > x && t < x + w ? Math.sin(Math.PI * (t - x) / w) : 0), 0);

  // ----------------------------------------------------------------------------------------------------- the state
  let S = null;
  function fresh() {
    const sp = (x, f, z) => new Spring(x, f, z);
    const s = {
      t: 0, events: [], puffs: [],
      deer: { gait: new Gait({ who: 'deer', pattern: 'walk', stride: 150, lift: 22, dur: 0.3, lead: 0.25, settle: 5, overlap: 0.18, order: [0, 1, 2, 3],
        feet: [{ id: 'hn', home: -56 * DS, side: 'n' }, { id: 'fn', home: 62 * DS, side: 'n' }, { id: 'hf', home: -64 * DS, side: 'f' }, { id: 'ff', home: 54 * DS, side: 'f' }] }),
        n: sp(0, 1.5, 0.85), ears: [sp(0, 3, 0.3), sp(0, 3, 0.3)], tail: sp(0, 5, 0.3), bob: sp(0, 3, 0.7) },
      fox: { gait: new Gait({ who: 'fox', pattern: 'trot', stride: 60, lift: 10, dur: 0.17, lead: 0.1, settle: 3,
        feet: [{ id: 'fn', home: 30 * FS, group: 0 }, { id: 'hf', home: -27 * FS, group: 0 }, { id: 'ff', home: 23 * FS, group: 1 }, { id: 'hn', home: -20 * FS, group: 1 }] }),
        s: sp(0, 5, 0.75), u: sp(0, 4.5, 0.7), c: sp(0, 6, 0.6), a: sp(0, 7, 0.8), fw: sp(1, 9, 1), look: sp(0, 3, 0.6), reach: sp(0, 3.5, 0.8), tilt: sp(0, 3, 0.6),
        ears: [sp(-0.15, 4, 0.3), sp(-0.15, 4, 0.3)], tail: Array.from({ length: Fox.TAIL.n }, () => ({ x: Math.PI - 0.45, v: 0 })), g: sp(0, 4, 1), face: 1, faceS: 1,
        root: [T.fx0, hillY(T.fx0)], vel: [0, 0], acc: [0, 0], mode: 'ground', jump: null },
      hare: { em: sp(0, 2.6, 0.45), st: sp(0, 8, 0.7), cr: sp(0, 7, 0.5), ears: [sp(0, 3.5, 0.25), sp(0, 3.5, 0.25)], x: 2330, y: hillY(2330), vy: 0 },
      robin: { p: [2160, 760], face: 1, flap: 0 },
      lan: { mode: 'held', piv: null, pv: [0, 0], th: 0, om: 0, h: [0, 0], v: [0, 0], ang: 0, angv: 0, rest: null },
    };
    s.fox.gait.plant({ x: T.fx0, vx: 0, face: 1 }); s.deer.gait.plant({ x: 3520, vx: 0, face: -1 });
    return s;
  }
  const event = (kind, t, x, y, extra) => S.events.push(Object.assign({ kind, t, x, y }, extra || {}));

  // ----------------------------------------------------------------------------------------------------- the deer
  function deerStep(t) {
    const D = S.deer, [x, vx] = t < T.deer0 ? [3520, 0] : cruise(t, T.deer0, T.deer1, 3520, CFG.deerX, 1.0);
    const body = { x, vx, face: -1 };
    const n0 = D.gait.events.length; D.gait.update(t, DT, body);
    for (let i = n0; i < D.gait.events.length; i++) { const e = D.gait.events[i]; if (t > T.deer0) event('step', t, e.x, e.y, { who: 'deer' }); }
    const lifts = {}; let lsum = 0; for (const f of D.gait.feet) { lifts[f.id] = f.lift; lsum += f.lift; }
    const nT = kf([[T.lower0, 0], [T.lower1, -1], [T.raise0, -1], [T.raise1, 1], [T.rest0, 1], [T.rest1, 0]], t);
    D.n.step(nT - 0.3 * clamp(Math.abs(vx) / 150) * (t < T.lower0 ? 1 : 0), DT);   // head low and forward while it climbs D.bob.step(lsum * 2.2 + Math.sin(t * TAU * 0.35) * 0.8, DT);
    D.ears[0].step(0.35 * flick(t, [16.1, 19.0, 24.4, 27.0], 0.3) - 0.15 * (lifts.fn || 0), DT); D.ears[1].step(0.3 * flick(t, [16.15, 24.45], 0.3), DT);
    D.tail.step(0.5 * flick(t, [15.6, 18.0, 21.4, 25.6], 0.22), DT);
    D.root = [x, hillY(x)]; D.g = slope(x) * 0.65;
    const feet = {}; for (const f of D.gait.feet) feet[f.id] = toL(D.root, D.g, -1, DS, f.p);
    D.P = { n: D.n.x, nod: 0.05 * ((lifts.fn || 0) + (lifts.ff || 0)), feet, lift: lifts, bob: D.bob.x, ears: [D.ears[0].x, D.ears[1].x], tail: D.tail.x, blink: blinkAt(t, DEER_BLINK) };
    D.R = Deer.solve(D.P);
  }
  const deerW = p => toW(S.deer.root, S.deer.g, -1, DS, p);
  const deerHeadAngle = () => -S.deer.R.ah + S.deer.g;     // the slope of the top of its head, in the world

  // ----------------------------------------------------------------------------------------------------- the fox
  function foxPlan(t) {
    const F = S.fox;
    if (t < T.j1) return { mode: 'ground', x: t < T.walk1 ? cruise(t, T.walk0, T.walk1, T.fx0, T.fx1, 1.0) : [T.fx1, 0] };
    if (t < T.l1) return { mode: 'air', from: [T.fx1, hillY(T.fx1)], to: [2430, hillY(2430)], t0: T.j1, t1: T.l1 };
    if (t < T.j2) return { mode: 'ground', x: [2430, 0] };
    if (t < T.l2) return { mode: 'air', from: [2430, hillY(2430)], to: [2416, hillY(2416)], t0: T.j2, t1: T.l2 };
    if (t < T.wl0) return { mode: 'ground', x: [2416, 0] };
    if (t < T.j3) { const xl = F.xLantern || 2440; return { mode: 'ground', x: cruise(t, T.wl0, T.wl1, 2416, xl, 0.18) }; }
    if (t < T.l3) return { mode: 'air', from: [F.xLantern, hillY(F.xLantern)], to: deerW(S.deer.R.headTop), t0: T.j3, t1: T.l3, rideAt: true };
    if (t < T.slide0) return { mode: 'ride' };
    if (t < T.slide1) return { mode: 'slide' };
    return { mode: 'back' };
  }
  const pick = (t, list) => { for (const [a, b, v] of list) if (t >= a && t < b) return v; return 0; };
  function foxTargets(t, mode) {
    return {
      c: pick(t, [[T.c1, T.j1, 0.9], [T.c2, T.j2, 1.0], [T.r0 - 0.05, T.r1, 0.4], [T.c3, T.j3, 0.95], [T.l3, T.up0, 0.85]]),
      a: pick(t, [[T.j1, T.l1 - 0.06, 1], [T.j2, T.l2 - 0.1, 0.3], [T.j3, T.l3 - 0.08, 0.9]]),
      u: pick(t, [[T.j2 + 0.05, T.l2, 0.8], [T.up0, T.down0, 1]]),
      s: pick(t, [[T.l2, T.rise, 1], [21.1, 99, 1]]),
      look: pick(t, [[0, 9.9, 0.05], [9.9, T.l2, 0.85], [T.l2, 12.3, 0.25], [12.3, 13.85, -0.38], [13.85, 15.0, -0.25], [15.0, T.rise, 0.12], [T.rise, T.r0, -0.05], [T.r1, T.j3, 0.35], [T.j3, T.up0, 0.2], [T.up0, T.down0, 0.75], [T.down0, 21.2, 0.3], [21.2, 99, 0.45]]),
      reach: pick(t, [[T.r0, T.r1 - 0.1, S.reachV || 1]]),
      tilt: pick(t, [[13.95, 14.9, 0.18], [26.5, 27.4, -0.12]]),
      ear: pick(t, [[12.4, 13.9, -1.15], [13.9, 15.0, -0.6], [15.0, 15.3, 0.1], [21.3, 99, -0.3]]) || -0.15,
    };
  }
  function foxStep(t) {
    const F = S.fox, plan = foxPlan(t), tg = foxTargets(t, plan.mode), prevRoot = F.root.slice(), prevMode = F.mode;
    // springs toward the targets: weight shifts, overlap, settle
    F.s.set(t > T.l2 && t < T.l2 + 0.6 ? 6.5 : 4.5, t > T.l2 && t < T.l2 + 0.6 ? 0.42 : 0.75);
    for (const k of ['c', 'a', 'u', 's', 'look', 'reach', 'tilt']) F[k].step(tg[k], DT);
    // facing: turns round on the deer's head to face the tree
    const fT = t < T.turn0 ? 1 : t > T.turn1 ? -1 : Math.cos(Math.PI * ease.inOut((t - T.turn0) / (T.turn1 - T.turn0)));
    F.faceS = fT; F.face = fT >= 0 ? 1 : -1;
    let root, g, grounded = false;
    if (plan.mode === 'ground') {
      root = [plan.x[0], hillY(plan.x[0])]; grounded = true; F.g.step(slope(root[0]) * 0.9, DT); g = F.g.x;
      if (prevMode === 'air') { F.c.v += 9; replant(root, g); event('land', t, root[0], root[1], { r: t > T.l2 - 0.1 && t < T.l2 + 0.2 ? 46 : 26 }); }
      if (Math.abs(t - T.rise) < DT / 2) replant(root, g);
      if (F.s.x < 0.5) { const n0 = F.gait.events.length; F.gait.update(t, DT, { x: root[0], vx: plan.x[1], face: 1 }); for (let i = n0; i < F.gait.events.length; i++) { const e = F.gait.events[i]; event('step', t, e.x, e.y, { who: 'fox' }); } }
    } else if (plan.mode === 'air') {
      const to = plan.rideAt ? deerW(S.deer.R.headTop) : plan.to, b = ballistic(plan.from, to, plan.t0, plan.t1, t);
      root = [b[0], b[1]]; F.g.step(plan.rideAt ? deerHeadAngle() * clamp((t - plan.t0) / (plan.t1 - plan.t0)) : 0, DT); g = F.g.x;
    } else if (plan.mode === 'ride') {
      if (prevMode === 'air') { F.c.v += 7; event('land', t, F.root[0], F.root[1], { r: 0 }); }
      root = deerW(S.deer.R.headTop); g = deerHeadAngle(); F.g.x = g;
    } else {
      const path = S.deer.R.path.map(deerW), u = plan.mode === 'slide' ? ease.inOut((t - T.slide0) / (T.slide1 - T.slide0)) : 1;
      const L = []; let tot = 0; for (let i = 1; i < path.length; i++) { const l = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); L.push(l); tot += l; }
      let d = u * tot, i = 0; while (i < L.length - 1 && d > L[i]) { d -= L[i]; i++; }
      const a = path[i], b = path[i + 1], k = clamp(d / L[i]);
      root = [lerp(a[0], b[0], k), lerp(a[1], b[1], k) + (plan.mode === 'back' ? 0 : 0)];
      const tang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      F.g.step(plan.mode === 'slide' ? tang : S.deer.g + 0.05, DT); g = F.g.x;
      if (plan.mode === 'back' && prevMode === 'slide') { F.s.v -= 3; event('land', t, root[0], root[1], { r: 0 }); }
    }
    // motion of the root (for inertia on ears and tail)
    const vel = [(root[0] - prevRoot[0]) / DT, (root[1] - prevRoot[1]) / DT];
    F.acc = [clamp((vel[0] - F.vel[0]) / DT, -4000, 4000), clamp((vel[1] - F.vel[1]) / DT, -4000, 4000)]; F.vel = vel;
    F.root = root; F.gRoot = g; F.mode = plan.mode;
    // feet: planted by the gait on the ground, from the pose otherwise
    F.fw.step(grounded && F.s.x < 0.5 ? 1 : 0, DT);
    const feet = {}, lift = {};
    for (const f of F.gait.feet) { feet[f.id] = toL(root, g, F.face, FS, f.p); lift[f.id] = f.lift; }
    const breath = Math.sin(t * TAU * 0.55) * 0.5 + (t > 12.7 && t < 13.5 ? Math.sin((t - 12.7) / 0.8 * Math.PI) * 2.5 : 0);
    const airPitch = plan.mode === 'air' ? clamp(-F.vel[1] * 0.00035, -0.3, 0.3) * -1 : 0;
    // tail: a chain of springs, each following the one before it; gravity and the body's acceleration act on it
    const ws = Fox.solve({ w: { s: F.s.x, u: F.u.x, c: F.c.x, a: F.a.x } }).ws;
    const wag = (t > 21.3 ? 0.28 * Math.sin(t * 7) : 0.06 * Math.sin(t * 1.6)) + (t > 15.6 && t < 16.4 ? 0.2 * Math.sin(t * 9) : 0);
    F.P = { w: { s: F.s.x, u: F.u.x, c: F.c.x, a: F.a.x }, feet, feetW: F.fw.x, lift, bob: breath, stretch: 1 + 0.07 * F.a.x, pitch: airPitch,
      look: F.look.x, reach: F.reach.x, tilt: F.tilt.x, blink: blinkAt(t, FOX_BLINK, t > 12.5 && t < 13.9 ? 0.55 : 1), sad: t > 12.6 && t < 14.0 ? 1 : 0 };
    const R0 = Fox.solve(F.P), rest = Fox.tailRest(ws, wag), la = rot([F.acc[0] * F.face, F.acc[1]], -g);
    let prev = R0.dir + rest.base;
    const pts = [R0.TB];
    for (let i = 0; i < F.tail.length; i++) {
      const sg = F.tail[i], tgt = (i === 0 ? R0.dir + rest.base : F.tail[i - 1].x + rest.curl), k = (TAU * (5.5 - i * 0.45)) ** 2, c = 2 * 0.32 * TAU * (5.5 - i * 0.45);
      const inert = (la[0] * Math.sin(sg.x) - la[1] * Math.cos(sg.x)) * 0.012, grav = Math.cos(sg.x) * 18;
      sg.v += (k * (tgt - sg.x) - c * sg.v + inert + grav) * DT; sg.x += sg.v * DT;
      // the tail lies on the ground rather than going through it
      let q = [pts[i][0] + Math.cos(sg.x) * Fox.TAIL.len, pts[i][1] + Math.sin(sg.x) * Fox.TAIL.len];
      if (q[1] > -1.5) { const dy = -1.5 - pts[i][1], ang = Math.asin(clamp(dy / Fox.TAIL.len, -1, 1)); sg.x = Math.cos(sg.x) < 0 ? Math.PI - ang : ang; sg.v *= 0.3; q = [pts[i][0] + Math.cos(sg.x) * Fox.TAIL.len, pts[i][1] + Math.sin(sg.x) * Fox.TAIL.len]; }
      pts.push(q); prev = sg.x;
    }
    F.P.tail = F.tail.map(s => s.x);
    // ears: springs that flop with the head's motion
    for (const e of F.ears) e.step(tg.ear, DT, la[1] * 0.004);
    F.P.ears = [F.ears[0].x, F.ears[1].x - 0.05];
    F.R = Fox.solve(F.P);
    F.mouth = toW(root, g, F.faceS === 0 ? 1e-3 : F.faceS, FS, F.R.mouth);
  }
  function replant(root, g) {
    const F = S.fox, R = Fox.solve(F.P || { w: {} });
    const map = { fn: R.leg.fn.toe, ff: R.leg.ff.toe, hn: R.leg.hn.toe, hf: R.leg.hf.toe };
    for (const f of F.gait.feet) { const w = toW(root, g, F.face, FS, map[f.id]); f.p = [w[0], hillY(w[0])]; f.sw = null; f.lift = 0; }
  }

  // ----------------------------------------------------------------------------------------------------- the lantern
  const LL = 22, LH = 37;
  function lanternStep(t) {
    const L = S.lan, F = S.fox, tip = [TREE.x, TREE.top + 4];
    if (L.mode === 'held' && t >= T.drop && t < T.pick) {     // knocked loose by the fall
      const bob = [L.piv[0] + LL * Math.sin(L.th), L.piv[1] + LL * Math.cos(L.th)];
      L.mode = 'free'; L.h = L.piv.slice(); L.v = [L.pv[0] * 0.3 + 125, Math.min(0, L.pv[1]) * 0.3 - 300]; L.ang = -L.th; L.angv = 6;
    }
    if (L.mode === 'free') {
      L.v[1] += Phys.G * DT; L.h = [L.h[0] + L.v[0] * DT, L.h[1] + L.v[1] * DT]; L.ang += L.angv * DT;
      const bottom = [L.h[0] - Math.sin(L.ang) * LH, L.h[1] + Math.cos(L.ang) * LH];
      if (bottom[1] >= hillY(bottom[0]) + 3) { L.mode = 'ground'; L.angv = L.angv * 0.25 + L.v[0] * 0.004; L.base = [bottom[0], hillY(bottom[0]) + 3]; event('land', t, bottom[0], hillY(bottom[0]), { r: 22 });
        F.xLantern = L.base[0] - S.mouthReach; }
    }
    if (L.mode === 'ground') {            // stands in the snow, wobbles about its base, settles
      L.angv += (-((TAU * 2.2) ** 2) * L.ang - 2 * 0.22 * TAU * 2.2 * L.angv) * DT; L.ang += L.angv * DT;
      L.h = [L.base[0] + Math.sin(L.ang) * LH, L.base[1] - Math.cos(L.ang) * LH];
      if (t >= T.pick) { L.mode = 'held'; L.th = 0; L.om = 0; L.piv = F.mouth.slice(); L.pv = [0, 0]; }
    }
    if (L.mode === 'held' || L.mode === 'tip') {
      let piv = F.mouth;
      if (t >= T.hang0) { const u = ease.inOut(clamp((t - T.hang0) / (T.hang1 - T.hang0))); piv = [lerp(F.mouth[0], tip[0], u), lerp(F.mouth[1], tip[1], u)]; if (t >= T.hang1) L.mode = 'tip'; }
      if (!L.piv) L.piv = piv.slice();
      const v = [(piv[0] - L.piv[0]) / DT, (piv[1] - L.piv[1]) / DT], a = [clamp((v[0] - L.pv[0]) / DT, -3500, 3500), clamp((v[1] - L.pv[1]) / DT, -3500, 3500)];
      L.om += ((-a[0] * Math.cos(L.th) - (Phys.G - a[1]) * Math.sin(L.th)) / LL - 2.2 * L.om) * DT; L.th += L.om * DT;
      // a handle held in the teeth (or hooked on a tip) can't swing over the top
      const lim = L.mode === 'tip' ? 0.9 : 0.75; if (Math.abs(L.th) > lim) { L.th = Math.sign(L.th) * lim; L.om *= -0.25; }
      // the lantern can't swing into the ground
      const bottomY = piv[1] + Math.cos(L.th) * (LH + 2); const gy = hillY(piv[0] + Math.sin(L.th) * LH);
      if (bottomY > gy) { L.th *= 0.9; L.om *= 0.5; }
      L.piv = piv; L.pv = v; L.h = piv; L.ang = -L.th;
    }
    L.glow = kf([[0, 1], [11.6, 1], [12.1, 0.45], [17.5, 0.5], [17.9, 1.0], [20.55, 1.05], [20.68, 2.3, 'out'], [21.8, 1.45]], t) * (t > 11.6 && t < 17.9 ? 0.85 + 0.15 * vn1(t * 9) : 1);
  }

  // ----------------------------------------------------------------------------------------------------- the hare
  const HOPS = [[15.6, 15.95, 2330, 2372], [23.4, 23.75, 2372, 2440], [23.82, 24.17, 2440, 2505]];
  function hareStep(t) {
    const H = S.hare;
    H.em.step(t >= 15.0 ? 1 : 0, DT);
    let x = H.x, y = hillY(x), air = 0, st = 0, crT = 0;
    for (const [t0, t1, x0, x1] of HOPS) {
      if (t >= t0 && t < t1) { const b = ballistic([x0, hillY(x0)], [x1, hillY(x1)], t0, t1, t); x = b[0]; y = b[1]; air = 1; st = Math.sin(Math.PI * (t - t0) / (t1 - t0)); }
      else if (t >= t1) x = x1;
      if (t >= t0 - 0.14 && t < t0) crT = 1;
      if (Math.abs(t - t1) < DT / 2) { H.cr.v += 8; event('land', t, x1, hillY(x1), { r: 18 }); }
    }
    if (!air) y = hillY(x);
    const vy = (y - H.y) / DT, ay = (vy - H.vy) / DT; H.vy = vy; H.x = x; H.y = y;
    H.st.step(st, DT); H.cr.step(crT, DT);
    H.ears[0].step(t < 15.3 ? -0.6 : 0, DT, -ay * 0.003); H.ears[1].step(t < 15.3 ? -0.6 : -0.05, DT, -ay * 0.003);
    if (Math.abs(t - 15.0) < DT / 2) event('land', t, 2330, hillY(2330), { r: 40 });
    H.P = { emerge: H.em.x, stretch: H.st.x, crouch: H.cr.x, ears: [H.ears[0].x, H.ears[1].x], blink: blinkAt(t, HARE_BLINK) };
  }

  // ----------------------------------------------------------------------------------------------------- the robin
  function robinStep(t) {
    const B = S.robin, L = S.lan;
    const onLantern = [L.h[0] + 1, L.h[1] - 1], branch = [2512, TREE.base - 120], tip = deerW(S.deer.R.antlerTip);
    const legs = [[12.6, 13.75, [2160, 760], () => onLantern, -120], [17.2, 17.95, () => onLantern, branch, -90], [21.5, 22.4, branch, () => tip, -110]];
    let p = null, fly = 0, flare = 0;
    if (t < 12.6) p = [2160, 760]; else if (t < 13.75) p = null; else if (t < 17.2) p = onLantern; else if (t < 17.95) p = null; else if (t < 21.5) p = branch; else if (t < 22.4) p = null; else p = tip;
    if (!p) {
      const [t0, t1, a0, b0, h] = legs.find(l => t >= l[0] && t < l[1]), a = typeof a0 === 'function' ? a0() : a0, b = typeof b0 === 'function' ? b0() : b0;
      const u = (t - t0) / (t1 - t0), e = ease.inOut(u), c = [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) + h];
      p = [(1 - e) * (1 - e) * a[0] + 2 * (1 - e) * e * c[0] + e * e * b[0], (1 - e) * (1 - e) * a[1] + 2 * (1 - e) * e * c[1] + e * e * b[1]];
      fly = 1; flare = smooth(0.75, 0.95, u);
      if (Math.abs(b[0] - a[0]) > 4) B.face = b[0] > a[0] ? 1 : -1;
    } else if (t > 13.75 && t < 17.2) B.face = -1; else if (t > 22.4) B.face = 1;
    B.flap += DT * TAU * (fly ? lerp(14, 6, flare) : 0);
    const v = [(p[0] - B.p[0]) / DT, (p[1] - B.p[1]) / DT]; B.p = p;
    B.P = { fly, flap: B.flap, wing: fly ? lerp(Math.sin(B.flap) * 1.1 - 0.3, -1.25 + 0.25 * Math.sin(B.flap), flare) : undefined, pitch: fly ? clamp(v[1] * 0.0012, -0.5, 0.5) * B.face - flare * 0.35 * B.face : 0.04 * Math.sin(t * 3) };
  }

  // ----------------------------------------------------------------------------------------------------- stepping
  function step(t) { S.t = t; deerStep(t); foxStep(t); lanternStep(t); hareStep(t); robinStep(t); }
  function reset() {
    S = fresh(); S.mouthReach = 0;
    // how far to lower the head so the mouth meets the lantern's handle as it stands in the snow
    let best = 1, err = 1e9; for (let r = 0.2; r <= 1.2; r += 0.01) { const m = Fox.solve({ w: { c: 0.4 }, reach: r }).mouth; const e = Math.abs(m[1] * FS + LH - 2); if (e < err) { err = e; best = r; } }
    S.reachV = best; S.mouthReach = Fox.solve({ w: { c: 0.4 }, reach: best }).mouth[0] * FS;
    deerStep(0); foxStep(0); S.lan.piv = S.fox.mouth.slice(); S.lan.h = S.lan.piv; lanternStep(0); hareStep(0); robinStep(0);
  }
  let simT = -1;
  function advance(t) {
    if (!S || t < simT - 1e-9) { reset(); simT = 0; }
    while (simT + DT <= t + 1e-9) { simT += DT; step(simT); }
    return S;
  }
  // run the whole film once: place the deer so the fox can reach the treetop, size the tree to fit, and write the
  // footsteps into the score so every footfall crunches exactly when a foot lands
  function precompute() {
    for (let pass = 0; pass < 2; pass++) {
      S = null; advance(T.hang0);
      const m = S.fox.mouth; CFG.deerX += TREE.x - m[0]; TREE.top = Math.round(m[1] - 4);
    }
    S = null; advance(FILM - 0.01);
    const steps = S.events.filter(e => e.kind === 'step'), lands = S.events.filter(e => e.kind === 'land');
    const seen = []; const steps1 = steps.filter(e => { const dup = seen.some(q => q.who === e.who && Math.abs(q.t - e.t) < 0.03); seen.push(e); return !dup; });
    Score.add(steps1.map(e => ({ t: e.t, d: 0.08, m: 0, i: 'step', v: e.who === 'deer' ? 0.55 : 0.28, p: clamp((e.x - 2400) / 900, -0.8, 0.8), tag: 'foot' })));
    Score.add(lands.filter(e => e.r > 20).map(e => ({ t: e.t, d: 0.3, m: 48, i: 'thump', v: e.r > 40 ? 0.5 : 0.22, p: 0, tag: 'landfx' })));
    const all = S.events.slice(); S = null; simT = -1;
    return all;
  }
  let EV = [];

  // ----------------------------------------------------------------------------------------------------- drawing
  function prints(ctx, t) {
    ctx.fillStyle = 'rgba(140,150,200,0.4)';
    for (const e of EV) { if (e.t > t) break; if (e.kind !== 'step') continue; const r = e.who === 'deer' ? 6.5 : 4;
      ctx.beginPath(); ctx.ellipse(e.x, e.y + 2, r, r * 0.42, slope(e.x), 0, TAU); ctx.fill(); }
  }
  function puffs(ctx, t) {
    for (const e of EV) {
      if (e.kind !== 'land' || !e.r) continue; const dt = t - e.t; if (dt < 0 || dt > 1.1) continue;
      const R = rng(Math.floor(e.t * 1000)), k = 1 - Math.exp(-dt * 5), fade = 1 - dt / 1.1, n = Math.round(e.r * 0.5);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI * (0.05 + 0.9 * R()), d = e.r * (0.3 + 0.8 * R()) * k, rr = (2.5 + 6 * R()) * (1 + dt);
        ctx.fillStyle = `rgba(246,248,255,${0.7 * fade})`; ctx.beginPath(); ctx.arc(e.x + Math.cos(a) * d * 1.4, e.y + Math.sin(a) * d * 0.6 + dt * dt * 40, rr, 0, TAU); ctx.fill();
      }
    }
  }
  function draw(t, cam, A) {
    advance(t);
    const z = cam[2], toWorld = ctx => ctx.setTransform(z * ctx._s, 0, 0, z * ctx._s, (W / 2 - cam[0] * z) * ctx._s, (H / 2 - cam[1] * z) * ctx._s);
    const ctx = A.actors; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); toWorld(ctx);
    prints(ctx, t);
    const place = (p, g, sx, sy, fn) => { ctx.save(); toWorld(ctx); ctx.translate(p[0], p[1]); ctx.rotate(g); ctx.scale(sx, sy); fn(); ctx.restore(); };
    const L = S.lan, F = S.fox, D = S.deer;
    const drawLantern = () => { ctx.save(); toWorld(ctx); ctx.translate(L.h[0], L.h[1]); const f = Lantern.draw(ctx, L.ang, L.glow); ctx.restore(); return [L.h[0] + f[0], L.h[1] + f[1]]; };
    let flame;
    if (L.mode === 'tip') flame = drawLantern();
    if (t >= 15.0) place([S.hare.x, S.hare.y], slope(S.hare.x) * 0.6, 1, 1, () => Hare.draw(ctx, S.hare.P));
    if (t >= T.deer0 - 0.2) place(D.root, D.g, -DS, DS, () => Deer.draw(ctx, D.P, D.R));
    if (L.mode === 'free' || L.mode === 'ground') flame = drawLantern();
    place(F.root, F.gRoot, F.faceS * FS, FS, () => Fox.draw(ctx, F.P, F.R));
    if (L.mode === 'held') flame = drawLantern();
    if (t >= 12.6) place(S.robin.p, S.robin.P.pitch, S.robin.face, 1, () => Robin.draw(ctx, S.robin.P));
    toWorld(ctx); puffs(ctx, t);
    if (typeof location !== 'undefined' && location.search.includes('debug')) { ctx.strokeStyle = 'red'; ctx.lineWidth = 1; ctx.beginPath(); for (let x = cam[0] - 1000; x < cam[0] + 1000; x += 4) ctx.lineTo(x, hillY(x)); ctx.stroke(); for (const f of F.gait.feet) { ctx.fillStyle = 'blue'; ctx.fillRect(f.p[0] - 1.5, f.p[1] - 1.5, 3, 3); } }

    const tierAge = k => Score.since('tier', k, t);
    const lights = [{ x: flame[0], y: flame[1], r: 340, c: [1, 0.66, 0.3], k: 0.85 * L.glow }];
    let treeGlow = 0;
    for (let k = 0; k < 7; k++) { const a = tierAge(k); if (a === Infinity) continue; const g = clamp(a / 0.2), tr = World.tree.tiers[6 - k];
      treeGlow += g / 7; lights.push({ x: TREE.x, y: (tr.yb + tr.yt) / 2, r: 300, c: [1, 0.72, 0.38], k: 0.32 * g * (1 + 1.4 * Math.exp(-a * 5)) }); }
    return { flame, lan: { glow: L.glow }, lights, treeGlow, tierAge };
  }
  function boot() { EV = precompute(); EV.sort((a, b) => a.t - b.t); return EV; }
  return { draw, boot, advance, T, CFG, get state() { return S; }, FS, DS };
})();
