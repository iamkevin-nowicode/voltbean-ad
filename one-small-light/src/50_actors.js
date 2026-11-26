'use strict';
// ---- ACTORS: the choreography. Who stands where, in what pose, at every moment; and the lights they carry.
// Bodies are posed "on twos" (a new drawing every 1/12 s, like hand-drawn animation); positions move on every frame.
const Actors = (() => {
  const two = t => Math.floor(t * 12) / 12;
  const blinkAt = (t, list) => list.some(b => t >= b && t < b + 0.13);
  const DEER_FACE = -1, DS = 1.15;

  function deerState(t) {
    const x = kf([[14.7, 3720], [17.35, 2790, 'out']], t);
    const P = {
      walk: (t - 14.7) / (BEAT * 2), walkAmt: smooth(14.6, 14.9, t) * (1 - smooth(17.05, 17.4, t)),
      neck: kf([[17.4, 0], [18.05, -1], [18.62, -1], [19.9, 1], [22.55, 1], [23.5, 0]], t),
      blink: blinkAt(t, [16.8, 21.7, 26.4]), earFlick: Math.max(arc(t, 16.1, 16.4, 1), arc(t, 19.0, 19.3, 1), arc(t, 24.4, 24.7, 1)),
    };
    return { x, y: hillY(x), tilt: Math.atan(hillSlope(x)) * 0.8, P };
  }
  // deer-local point -> world
  const deerWorld = (d, p) => { const r = Ink.rot([p[0] * DEER_FACE * DS, p[1] * DS], d.tilt); return [d.x + r[0], d.y + r[1]]; };

  function foxState(t) {
    const tc = two(t);
    const P = {
      walk: (tc - 3.75) / BEAT, walkAmt: smooth(3.6, 3.9, tc) * (1 - smooth(9.8, 10.1, tc)),
      hop: arc(t, 10.55, 10.95, 34) + arc(t, 11.2, 11.72, 78),
      stand: Math.max(arc(tc, 11.15, 11.75, 0.55), kf([[19.9, 0], [20.3, 1], [20.8, 1], [21.3, 0.25], [22.5, 0.25], [22.8, 0]], tc)),
      flop: kf([[11.7, 0], [11.9, 1, 'out'], [12.55, 1], [13.0, 0]], tc),
      sit: Math.max(kf([[12.55, 0], [13.0, 1], [17.85, 1], [18.05, 0]], tc), kf([[23.0, 0], [23.5, 1]], tc)),
      crouch: kf([[18.4, 0], [18.55, 0.8], [19.85, 0.8], [20.0, 0]], tc),
      ear: kf([[12.7, 0], [13.3, 1], [14.1, 1], [14.5, 0.35], [15.1, 0.35], [15.4, 0]], tc),
      look: kf([[9.9, 0], [10.4, 0.55], [11.7, 0.7], [11.9, -0.2], [13.0, -0.35], [13.9, -0.35], [14.3, -0.55], [15.2, -0.55], [15.6, 0.15], [17.6, 0.15], [18.0, 0.3], [19.9, 0.2], [20.3, 0.75], [21.2, 0.5], [23.5, 0.45]], tc),
      wag: tc * (tc > 21 ? 6 : 2.2), sad: tc > 12.9 && tc < 14.4,
      blink: blinkAt(tc, [3.2, 7.4, 13.05, 13.15, 13.25, 13.35, 16.6, 24.8, 27.9]),
    };
    let x, y, face = 1, tilt = 0;
    if (t < 18.1) {
      x = t < 10 ? Story.foxWalkX(t) : 2440 + 18 * P.flop; y = hillY(x);
      tilt = -Math.atan(hillSlope(x)) * 0.85 * (1 - P.sit);
    } else {
      const d = deerState(t), dr = Deer.rig(d.P), head = deerWorld(d, dr.headTop), back = deerWorld(d, dr.back);
      if (t < 18.55) { const u = ease.sine((t - 18.1) / 0.45); x = lerp(2440, head[0], u); y = lerp(hillY(2440), head[1], u) - arc(t, 18.1, 18.55, 60); }
      else if (t < 22.6) { x = head[0]; y = head[1] + 2; }
      else { const u = ease.inOut(clamp((t - 22.6) / 0.9)); x = lerp(head[0], back[0], u); y = lerp(head[1], back[1], u) - arc(t, 22.6, 23.5, 30) + 4 * u; }
      face = t < 19.45 ? 1 : -1;
      tilt = t < 22.6 ? -d.tilt * 0.5 : 0.12;
    }
    P.tilt = tilt;
    return { x, y, face, P };
  }
  // where the lantern's handle is, and how it swings
  function lanternState(t, fox, foxRig) {
    const S = 1.1, mouth = [fox.x + fox.face * S * foxRig.mouth[0], fox.y + S * foxRig.mouth[1]];
    let p = mouth, swing = -0.22 * fox.P.walkAmt * Math.sin(fox.P.walk * TAU * 2) + 0.06 * Math.sin(t * 2.3);
    const ground = hillY(mouth[0]); if (p[1] + 40 > ground) { p = [p[0], ground - 40]; swing += 0.25; }
    const tip = [TREE.x, TREE.top + 2];
    if (t >= 20.45) { const u = ease.inOut(clamp((t - 20.45) / 0.18)); p = [lerp(p[0], tip[0], u), lerp(p[1], tip[1], u)]; const s = t - 20.63; swing = s > 0 ? 0.32 * Math.exp(-s * 1.4) * Math.sin(s * 6.5) : swing; }
    let glow = kf([[0, 1], [11.9, 1], [12.3, 0.42], [14.9, 0.48], [15.7, 1.0], [20.6, 1.05], [20.72, 2.3, 'out'], [21.8, 1.45]], t);
    if (t > 11.9 && t < 15.7) glow *= 0.82 + 0.18 * vn1(t * 9);
    return { p, swing, glow };
  }
  function hareState(t) {
    const tc = two(t);
    let x = 2330; x = lerp(x, 2385, ease.inOut(clamp((t - 15.625) / 0.33))); x = lerp(x, 2452, ease.inOut(clamp((t - 23.4) / 0.35))); x = lerp(x, 2522, ease.inOut(clamp((t - 23.78) / 0.35)));
    const hop = arc(t, 15.625, 15.955, 30) + arc(t, 23.4, 23.75, 26) + arc(t, 23.78, 24.13, 26);
    return { x, y: hillY(x), P: { emerge: kf([[15.0, 0], [15.28, 1, 'back']], tc), hop, stretch: hop > 1 ? 0.6 : 0, perk: kf([[15.1, 0.3], [15.5, 1]], tc), blink: blinkAt(tc, [17.3, 25.2]) }, on: t >= 15.0 };
  }
  function robinState(t, lan, deerTip) {
    const perchL = [lan.p[0] + 4, lan.p[1] + 7];
    let p, fly = 1, face = -1;
    if (t < 13.75) { const u = clamp((t - 12.6) / 1.15); p = [lerp(2150, perchL[0], ease.out(u)), lerp(720, perchL[1], ease.inOut(u)) - Math.sin(u * Math.PI) * 60]; face = 1; fly = u < 0.98 ? 1 : 0; }
    else if (t < 18.05) { p = perchL; fly = 0; }
    else if (t < 21.2) { p = kf([[18.05, perchL], [18.8, [2540, 900]], [19.6, [2720, 720]], [20.4, [2570, 640]], [21.2, [2585, 650]]], t); face = t > 19.6 ? -1 : 1; }
    else { const u = clamp((t - 21.2) / 2.3); const a = kf([[21.2, [2585, 650]], [22.4, [2700, 600]]], t); p = [lerp(a[0], deerTip[0], ease.inOut(u)), lerp(a[1], deerTip[1], ease.inOut(u)) - Math.sin(u * Math.PI) * 30]; face = 1; fly = u < 1 ? 1 : 0; }
    return { p, fly, face, flap: t * 42, on: t >= 12.6 };
  }

  // ---- snow puffs, footprints
  const PUFFS = [[10.95, 'fox', 12, 30], [11.72, 'fox', 18, 46], [11.9, 'fox', 30, 80], [15.0, 'hare', 26, 70], [18.1, 'fox', 12, 34], [23.75, 'hare', 8, 22], [24.13, 'hare', 8, 22]];
  function puffs(ctx, t, fox, hare) {
    for (const [t0, who, n, r] of PUFFS) {
      const dt = t - t0; if (dt < 0 || dt > 1.1) continue;
      const cx = who === 'fox' ? (t0 < 18 ? 2440 + (t0 > 11.8 ? 30 : 0) : 2440) : (t0 < 20 ? 2330 : hare.x), cy = hillY(cx);
      const R = rng(Math.floor(t0 * 100)), k = 1 - Math.exp(-dt * 5), fade = 1 - dt / 1.1;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI * (0.1 + 0.8 * R()), d = r * (0.4 + 0.8 * R()) * k, rr = (4 + 8 * R()) * (1 + dt);
        ctx.fillStyle = `rgba(246,248,255,${0.75 * fade})`; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d * 1.5, cy + Math.sin(a) * d * 0.7 + dt * dt * 30, rr, 0, TAU); ctx.fill();
      }
    }
  }
  function prints(ctx, t) {
    ctx.fillStyle = 'rgba(140,150,200,0.42)';
    for (const s of Score.tagged('step')) {
      if (t < s.t) break;
      const x = Story.foxWalkX(s.t) + (s.k % 2 ? 6 : -10), y = hillY(x) + 3 + (s.k % 2 ? 3 : 0);
      ctx.beginPath(); ctx.ellipse(x, y, 5, 2.2, Math.atan(hillSlope(x)), 0, TAU); ctx.fill();
    }
    for (const s of Score.tagged('deerstep')) {
      if (t < s.t) break;
      const x = kf([[14.7, 3720], [17.35, 2790, 'out']], s.t) + (s.k % 2 ? 40 : -50), y = hillY(x) + 4;
      ctx.beginPath(); ctx.ellipse(x, y, 7, 2.6, Math.atan(hillSlope(x)), 0, TAU); ctx.fill();
    }
  }

  // ---- the frame: draws the characters (lit later by the light map) and collects every light source
  function draw(t, cam, A) {
    const tc = two(t); Ink.setBoil(t);
    const z = cam[2], toWorld = ctx => ctx.setTransform(z * ctx._s, 0, 0, z * ctx._s, (W / 2 - cam[0] * z) * ctx._s, (H / 2 - cam[1] * z) * ctx._s);
    const ctx = A.actors; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); toWorld(ctx);
    prints(ctx, t);

    const deer = deerState(t), deerC = deerState(tc); deerC.x = deer.x; deerC.y = deer.y;
    const deerR = Deer.rig(deerC.P), deerTip = deerWorld(deerC, deerR.antlerTip);
    const fox = foxState(t), foxR = Fox.rig(fox.P), hare = hareState(t);
    const lan = lanternState(t, fox, foxR), robin = robinState(t, lan, [deerTip[0], deerTip[1] - 2]);
    const lanternOnTree = t >= 20.55;

    const place = (x, y, face, s, rotA, fn) => { ctx.save(); toWorld(ctx); ctx.translate(x, y); ctx.rotate(rotA || 0); ctx.scale(face * s, s); fn(); ctx.restore(); };
    const drawLantern = () => { ctx.save(); toWorld(ctx); ctx.translate(lan.p[0], lan.p[1]); const f = Lantern.draw(ctx, lan.swing, lan.glow); ctx.restore(); return [lan.p[0] + f[0], lan.p[1] + f[1]]; };
    let flame;
    if (lanternOnTree) flame = drawLantern();
    if (hare.on) place(hare.x, hare.y, 1, 1, 0, () => Hare.draw(ctx, hare.P));
    if (t >= 14.7) place(deer.x, deer.y, DEER_FACE, DS, deer.tilt, () => Deer.draw(ctx, deerC.P));
    place(fox.x, fox.y, fox.face, 1.1, 0, () => Fox.draw(ctx, fox.P));
    if (!lanternOnTree) flame = drawLantern();
    if (robin.on) place(robin.p[0], robin.p[1], robin.face, 1, 0, () => Robin.draw(ctx, { fly: robin.fly, flap: robin.flap }));
    toWorld(ctx); puffs(ctx, t, fox, hare);

    // ---- lights
    const tierAge = k => Score.since('tier', k, t);
    const lights = [{ x: flame[0], y: flame[1], r: 340, c: [1, 0.66, 0.3], k: 0.85 * lan.glow }];
    let treeGlow = 0;
    for (let k = 0; k < 7; k++) { const a = tierAge(k); if (a === Infinity) continue; const g = clamp(a / 0.2), tr = World.tree.tiers[6 - k];
      treeGlow += g / 7; lights.push({ x: TREE.x, y: (tr.yb + tr.yt) / 2, r: 300, c: [1, 0.72, 0.38], k: 0.32 * g * (1 + 1.4 * Math.exp(-a * 5)) }); }
    return { flame, lan, lights, treeGlow, tierAge, fox, deer, hare };
  }
  return { draw };
})();
