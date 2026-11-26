'use strict';
// ---- WORLD: the painted backgrounds. Seven sheets of paper at different depths, painted once when the page loads.
// A sheet at depth p moves p times as fast as the hill when the camera moves (parallax); its zoom follows zoom^p.
const World = (() => {
  const C0 = [1800, 1060];
  const LAYERS = [
    { id: 'clouds', p: 0.05, res: 0.5, light: 0.0, fog: 0.15 },
    { id: 'far', p: 0.12, res: 0.6, light: 0.0, fog: 0.3 },
    { id: 'hills', p: 0.3, res: 0.6, light: 0.04, fog: 0.2 },
    { id: 'village', p: 0.5, res: 0.75, light: 0.12, fog: 0.1 },
    { id: 'mid', p: 0.75, res: 0.7, light: 0.45, fog: 0.05 },
    { id: 'main', p: 1.0, res: 0.85, light: 1.0, fog: 0.0 },
    { id: 'fore', p: 1.35, res: 0.6, light: 0.7, fog: 0.0 },
  ];
  const byId = {}; LAYERS.forEach(L => (byId[L.id] = L));
  // layer coords -> screen:  s = (q - o) * z + (W/2, H/2)
  function view(L, cam) { return { ox: cam[0] * L.p + C0[0] * (1 - L.p), oy: cam[1] * L.p + C0[1] * (1 - L.p), z: Math.pow(cam[2], L.p) }; }
  const toScreen = (L, cam, x, y) => { const v = view(L, cam); return [(x - v.ox) * v.z + W / 2, (y - v.oy) * v.z + H / 2]; };
  const fromScreen = (L, cam, sx, sy) => { const v = view(L, cam); return [(sx - W / 2) / v.z + v.ox, (sy - H / 2) / v.z + v.oy]; };

  // which part of each sheet the camera ever sees
  function extents(L) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let t = 0; t <= FILM; t += 0.05) {
      const v = view(L, Story.camera(t)), hw = W / 2 / v.z, hh = H / 2 / v.z;
      x0 = Math.min(x0, v.ox - hw); x1 = Math.max(x1, v.ox + hw); y0 = Math.min(y0, v.oy - hh); y1 = Math.max(y1, v.oy + hh);
    }
    const m = 60; return [Math.floor(x0 - m), Math.floor(y0 - m), Math.ceil(x1 + m), Math.ceil(y1 + m)];
  }

  const P = {
    snow: hex('#eef1f7'), snowB: hex('#d3d6ee'), snowS: hex('#aab1d8'), snowW: hex('#f8dcc4'),
    fir: hex('#2e5a55'), firD: hex('#1b3a3f'), firL: hex('#5f8d74'),
    bark: hex('#6a4636'), grass: hex('#b78b55'), grassD: hex('#7a5a3c'), rock: hex('#8d87a6'),
    mtn: hex('#8f9acb'), mtnD: hex('#6c76ad'), mtnL: hex('#c9cdea'), hill: hex('#b8bde0'), hillD: hex('#8f97c8'),
    wall: ['#d9a26b', '#c77a5a', '#e2c08a', '#9fb0c9', '#c98f6b'].map(hex), roof: hex('#f4f2f6'), win: hex('#ffd58a'),
  };

  const tree = { bulbs: [], tiers: [] };      // filled while painting the fir
  const answers = [];                          // far lights that answer in bar 11 (hills layer coordinates)
  const windows = [];                          // village windows (village layer coordinates) for their glow

  // ------------------------------------------------------------------ painters, one per sheet (coordinates = layer space)
  function paintClouds(ctx, ex) {
    const R = rng(11);
    for (let i = 0; i < 9; i++) {
      const x = lerp(ex[0], ex[2], (i + R() * 0.6) / 9), y = 580 + R() * 260, w = 300 + R() * 420, h = 26 + R() * 30;
      const pts = []; for (let k = 0; k <= 14; k++) { const u = k / 14; pts.push([x - w / 2 + u * w, y - Math.sin(u * Math.PI) * h * (0.7 + 0.6 * vn1(i * 9 + k))]); }
      for (let k = 14; k >= 0; k--) { const u = k / 14; pts.push([x - w / 2 + u * w, y + Math.sin(u * Math.PI) * h * 0.35]); }
      Paint.wash(ctx, pts, hex('#f1dbe0'), { seed: 100 + i, layers: 12, alpha: 0.05, rough: 0.12, spread: 0.12 });
      Paint.wash(ctx, pts.map(p => [p[0] + 10, p[1] + h * 0.35]), hex('#f6c7a8'), { seed: 200 + i, layers: 8, alpha: 0.045, rough: 0.1 });
    }
  }
  const MB = 1090, peaks = [[700, 800, 640], [1480, 762, 820], [2330, 815, 700], [3150, 785, 820], [3900, 815, 700], [-100, 815, 700]];
  const mtnY = x => { let y = MB; for (const [px, py, w] of peaks) { const d = Math.abs(x - px) / w; if (d < 1) y = Math.min(y, py + (MB - py) * Math.pow(d, 1.25) + 12 * vn1(x / 40)); } return y; };
  function paintFar(ctx, ex) {
    Paint.wash(ctx, Paint.ridge(mtnY, ex[0], ex[2], 14, ex[3]), P.mtn, { seed: 21, layers: 20, alpha: 0.06, rough: 0.05, spread: 0.03 });
    for (const [px, py, w] of peaks) {   // shadow side and snow caps
      const sh = [[px, py], [px + w * 0.6, py + (MB - py) * 0.6], [px + w, MB + 20], [px + 40, MB + 20], [px + 25, py + 90]];
      Paint.wash(ctx, sh, P.mtnD, { seed: px, layers: 14, alpha: 0.05, rough: 0.15 });
      const capH = (MB - py) * 0.42, cap = [[px, py - 2]];
      for (let k = 0; k <= 8; k++) { const u = k / 8 * 2 - 1; cap.push([px + u * w * 0.42, py + capH * (0.75 + 0.45 * vn1(px + k * 3.3)) * Math.pow(Math.abs(u), 0.6)]); }
      Paint.wash(ctx, [[px, py + 1]].concat(cap.slice(1).reverse()), P.mtnL, { seed: px + 5, layers: 14, alpha: 0.08, rough: 0.12, spread: 0.08 });
    }
    // mist pooling at the feet of the range
    for (let x = ex[0]; x < ex[2]; x += 260) Paint.mist(ctx, x, MB, 340, 60, hex('#f3e4ea'), 0.45);
    ctx.fillStyle = css(hex('#e8e4f0'), 1); ctx.fillRect(ex[0], MB + 40, ex[2] - ex[0], ex[3] - MB - 40);
    for (let x = ex[0]; x < ex[2]; x += 200) Paint.mist(ctx, x, MB + 40, 260, 45, hex('#e8e4f0'), 0.9);
  }
  const hillsY = x => 1150 + 55 * Math.sin(x / 430 + 1) + 35 * Math.sin(x / 190) + 25 * vn1(x / 120);
  function paintHills(ctx, ex) {
    Paint.wash(ctx, Paint.ridge(hillsY, ex[0], ex[2], 12, ex[3]), P.hill, { seed: 31, layers: 18, alpha: 0.07, rough: 0.04, spread: 0.025 });
    Paint.wash(ctx, Paint.ridge(x => hillsY(x) + 60 + 30 * vn1(x / 200), ex[0], ex[2], 16, ex[3]), P.hillD, { seed: 32, layers: 12, alpha: 0.04 });
    const R = rng(33);
    for (let x = ex[0]; x < ex[2]; x += 14 + R() * 30) {      // little stands of fir along the crests
      if (vn1(x / 260) < 0.45) continue;
      const y = hillsY(x) + 4 + R() * 30, h = 18 + R() * 22;
      Paint.wash(ctx, [[x, y - h], [x + h * 0.32, y], [x - h * 0.32, y]], hex('#4f6a86'), { seed: x | 0, layers: 5, alpha: 0.16, depth: 1, sub: 1, rough: 0.1 });
    }
    // where the far lights will answer (chosen in front of the camera's final view, not hidden by the hill)
    const L = byId.hills, M = byId.main, cam0 = Story.camera(27.5);
    for (let k = 0, tries = 0; answers.length < 8 && tries < 80; tries++, k++) {
      const q = fromScreen(L, cam0, 180 + (tries * 397) % 1500, 0), y = hillsY(q[0]) + 14 + 40 * hash(tries + 3);
      const ok = [25.2, 26, 27, 28.5].every(tt => { const cam = Story.camera(tt), s = toScreen(L, cam, q[0], y), wy = fromScreen(M, cam, s[0], s[1]); return s[0] > 40 && s[0] < W - 40 && wy[1] < hillY(wy[0]) - 25; });
      if (ok && answers.every(a => Math.abs(a[0] - q[0]) > 90)) answers.push([q[0], y]);
    }
  }
  const villageY = x => 1420 + 20 * Math.sin(x / 260);
  function paintVillage(ctx, ectx, ex) {
    Paint.wash(ctx, Paint.ridge(x => villageY(x) - 70 - 30 * vn1(x / 90), ex[0], ex[2], 10, ex[3]), hex('#3f5c70'), { seed: 41, layers: 10, alpha: 0.06 });
    const R = rng(42);
    for (let x = ex[0]; x < ex[2]; x += 10 + R() * 16) { const y = villageY(x) - 40 + R() * 20, h = 40 + R() * 46;
      Paint.wash(ctx, [[x, y - h], [x + h * 0.3, y + 10], [x - h * 0.3, y + 10]], hex('#2f4a5a'), { seed: x | 0, layers: 4, alpha: 0.2, depth: 1, sub: 1 }); }
    Paint.wash(ctx, Paint.ridge(villageY, ex[0], ex[2], 12, ex[3]), P.snow, { seed: 43, layers: 16, alpha: 0.1, rough: 0.03 });
    Paint.wash(ctx, Paint.ridge(x => villageY(x) + 90, ex[0], ex[2], 20, ex[3]), P.snowB, { seed: 44, layers: 10, alpha: 0.05 });
    const houses = [[560, 1.0], [690, 0.9], [810, 1.1], [945, 0.8], [1060, 1.25], [1195, 0.95], [1320, 1.05], [1440, 0.85], [1570, 1.0], [400, 0.9]];
    houses.forEach(([hx, s], i) => {
      const gy = villageY(hx) + 6, w = 86 * s, h = 58 * s, rh = 56 * s, col = P.wall[i % P.wall.length];
      Paint.wash(ctx, [[hx - w / 2, gy], [hx - w / 2, gy - h], [hx + w / 2, gy - h], [hx + w / 2, gy]], col, { seed: 400 + i, layers: 10, alpha: 0.12, rough: 0.03, spread: 0.02, edge: 0.25 });
      Paint.wash(ctx, [[hx + w * 0.1, gy], [hx + w * 0.1, gy - h], [hx + w / 2, gy - h], [hx + w / 2, gy]], shade(col, 0.7), { seed: 410 + i, layers: 6, alpha: 0.08, rough: 0.03 });
      Paint.wash(ctx, [[hx - w / 2 - 12, gy - h + 4], [hx, gy - h - rh], [hx + w / 2 + 12, gy - h + 4], [hx + w / 2 + 6, gy - h + 14], [hx - w / 2 - 6, gy - h + 14]], P.roof, { seed: 420 + i, layers: 12, alpha: 0.14, rough: 0.04, edge: 0.22, edgeK: 0.7 });
      Paint.wash(ctx, [[hx, gy - h - rh], [hx + w / 2 + 12, gy - h + 4], [hx + w / 2 + 6, gy - h + 14], [hx + 10, gy - h - rh + 26]], P.snowS, { seed: 430 + i, layers: 6, alpha: 0.06 });
      ctx.fillStyle = css(hex('#5b4038'), 0.9); ctx.fillRect(hx + w * 0.22, gy - h - rh * 0.7, 9 * s, rh * 0.45);     // chimney
      for (let k = 0; k < 2; k++) {
        const wx = hx - w * 0.28 + k * w * 0.36, wy = gy - h * 0.62, ww = 13 * s, wh = 15 * s;
        ctx.fillStyle = css(shade(P.win, 0.95), 1); ctx.fillRect(wx, wy, ww, wh);
        ectx.fillStyle = css(P.win, 1); ectx.fillRect(wx, wy, ww, wh); windows.push([wx + ww / 2, wy + wh / 2]);
        ctx.strokeStyle = css(hex('#4a352c'), 0.6); ctx.lineWidth = 1.2; ctx.strokeRect(wx, wy, ww, wh); ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.stroke();
      }
      for (let k = 0; k < 4; k++) Paint.mist(ctx, hx + w * 0.26 + k * 10 - k * k * 6, gy - h - rh * 0.8 - k * 26, 14 + k * 6, 10 + k * 3, hex('#d9d6e6'), 0.35 - k * 0.06);   // smoke
    });
  }
  const midY = x => (x > 2500 ? 1235 + 70 * Math.sin((x - 2500) / 520) + 20 * vn1(x / 90) : 1560 + 60 * vn1(x / 300));
  function paintMid(ctx, ex) {
    Paint.wash(ctx, Paint.ridge(midY, ex[0], ex[2], 12, ex[3]), mixC(P.snow, P.snowB, 0.8), { seed: 51, layers: 16, alpha: 0.09, rough: 0.03 });
    Paint.wash(ctx, Paint.ridge(x => midY(x) + 50 + 40 * vn1(x / 150), ex[0], ex[2], 16, ex[3]), P.snowB, { seed: 52, layers: 10, alpha: 0.05 });
    const R = rng(53);
    for (let i = 0; i < 26; i++) {        // a fir wood on the far ridge
      const x = 2900 + R() * 1500, y = midY(x) + 10 + R() * 40, h = 90 + R() * 120;
      firSmall(ctx, x, y, h, 600 + i, 0.75);
    }
    for (let i = 0; i < 8; i++) { const x = ex[0] + 120 + i * 170 + R() * 60, y = midY(x) + R() * 30; firSmall(ctx, x, y, 70 + R() * 60, 700 + i, 0.7); }
  }
  function firSmall(ctx, x, y, h, seed, k) {
    const col = mixC(P.fir, P.mtnD, 1 - k);
    for (let t = 0; t < 4; t++) {
      const yb = y - t * h * 0.22, w = h * 0.32 * (1 - t * 0.2), yt = yb - h * 0.38;
      Paint.wash(ctx, [[x, yt], [x + w, yb], [x + w * 0.2, yb - 6], [x - w * 0.3, yb - 2], [x - w, yb]], col, { seed: seed * 7 + t, layers: 6, alpha: 0.15, depth: 2, sub: 1, rough: 0.12 });
      Paint.wash(ctx, [[x, yt + 2], [x - w * 0.8, yb - 8], [x - w * 0.5, yb - 14], [x, yt + 18]], P.snow, { seed: seed * 9 + t, layers: 5, alpha: 0.2, depth: 2, sub: 1 });
    }
  }
  function paintMain(ctx, ex) {
    const R = rng(61);
    Paint.wash(ctx, Paint.ridge(hillY, ex[0], ex[2], 14, ex[3]), P.snow, { seed: 62, layers: 22, alpha: 0.12, rough: 0.015, spread: 0.01 });
    ctx.fillStyle = css(P.snow, 1); ctx.fillRect(ex[0], 2000, ex[2] - ex[0], ex[3] - 2000);
    // cool hollows and the far side in shade, a warm lip where the last sun catches the crest
    Paint.wash(ctx, Paint.ridge(x => hillY(x) + 150 + 60 * vn1(x / 260), ex[0], ex[2], 18, ex[3]), P.snowB, { seed: 63, layers: 14, alpha: 0.05 });
    Paint.wash(ctx, Paint.ridge(x => hillY(x) + 330 + 90 * vn1(x / 300 + 4), ex[0], ex[2], 20, ex[3]), P.snowS, { seed: 64, layers: 12, alpha: 0.035 });
    // the near crest: a cool shadow line where the snow turns away, so the ground reads against the snowfields behind
    const rim = []; for (let x = ex[0]; x <= ex[2]; x += 12) rim.push([x, hillY(x) + 1.5]);
    Paint.stroke(ctx, rim, 5, hex('#8f97c6'), { seed: 68, bristles: 4, alpha: 0.5 });
    Paint.stroke(ctx, rim.map(p => [p[0], p[1] + 7]), 14, hex('#c6c9e6'), { seed: 69, bristles: 6, alpha: 0.25 });
    const lip = []; for (let x = 700; x <= 2820; x += 30) lip.push([x, hillY(x) + 5]);
    Paint.stroke(ctx, lip, 9, P.snowW, { seed: 66, bristles: 5, alpha: 0.35 });
    const path = []; for (let x = 820; x <= 2460; x += 24) path.push([x, hillY(x) + 10 + 3 * Math.sin(x / 70)]);
    Paint.stroke(ctx, path, 16, P.snowB, { seed: 67, bristles: 7, alpha: 0.22 });
    // rocks and dry grass through the snow
    for (const [x, dy, s] of [[1240, 60, 1], [2140, 40, 0.8], [3010, 70, 1.2], [560, 120, 1.1], [3300, 120, 0.9], [1780, 150, 0.7]]) {
      const y = hillY(x) + dy;
      Paint.dab(ctx, x, y, 40 * s, 20 * s, P.rock, { seed: x, edge: 0.3 });
      Paint.dab(ctx, x - 6, y - 12 * s, 34 * s, 10 * s, P.snow, { seed: x + 1, alpha: 0.16 });
    }
    for (let i = 0; i < 70; i++) {
      const x = ex[0] + R() * (ex[2] - ex[0]), y = hillY(x) + 6 + R() * R() * 380;
      if (Math.abs(x - TREE.x) < 200 && y < TREE.base + 40) continue;
      for (let b = 0; b < 5; b++) { const a = -Math.PI / 2 + (R() - 0.5) * 0.9, l = 14 + R() * 24;
        Paint.stroke(ctx, [[x + b * 3, y], [x + b * 3 + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.5], [x + b * 3 + Math.cos(a) * l, y + Math.sin(a) * l]], 2, R() < 0.5 ? P.grass : P.grassD, { seed: i * 9 + b, bristles: 2, alpha: 0.6 }); }
    }
    // fence posts along the path, leaning, capped with snow
    for (let i = 0; i < 6; i++) {
      const x = 1560 + i * 128, y = hillY(x) + 24, lean = (hash(i) - 0.5) * 0.18, h = 74 + 10 * hash(i + 4);
      const top = [x + Math.sin(lean) * h, y - Math.cos(lean) * h];
      Paint.wash(ctx, [[x - 6, y + 4], [top[0] - 6, top[1]], [top[0] + 6, top[1] - 2], [x + 6, y + 4]], P.bark, { seed: 80 + i, layers: 8, alpha: 0.2, depth: 2, rough: 0.05, edge: 0.4 });
      Paint.dab(ctx, top[0], top[1] - 4, 11, 6, P.snow, { seed: 90 + i, alpha: 0.25 });
      Paint.dab(ctx, x, y + 2, 22, 7, P.snowS, { seed: 95 + i, alpha: 0.06 });
    }
    paintTree(ctx);
  }
  function paintTree(ctx) {
    const cx = TREE.x, tiers = 7;
    Paint.dab(ctx, cx + 30, TREE.base + 6, 260, 26, P.snowS, { seed: 70, alpha: 0.05, n: 18 });
    Paint.wash(ctx, [[cx - 12, TREE.base + 4], [cx - 9, TREE.base - 70], [cx + 9, TREE.base - 70], [cx + 12, TREE.base + 4]], P.bark, { seed: 71, layers: 10, alpha: 0.2, depth: 2, rough: 0.04, edge: 0.4 });
    for (let i = 0; i < tiers; i++) {
      const gap = (TREE.base - 46 - (TREE.top + 92)) / (tiers - 1), yb = TREE.base - 46 - i * gap, w = 160 * (1 - i / 7.6), yt = (i === tiers - 1 ? TREE.top : yb - gap * 2.1);
      const R = rng(500 + i), sc = 4 + (i < 4 ? 1 : 0), tips = [];
      const pts = [[cx, yt]];
      for (let k = 1; k <= 6; k++) { const u = k / 6; pts.push([cx + w * u, yt + (yb - yt) * Math.pow(u, 0.9) + 8 * Math.sin(u * Math.PI)]); }
      for (let k = 0; k <= sc; k++) {     // the scalloped bottom, right to left: tips hang down, gaps ride up
        const u = 1 - k / sc, x = cx + w * (u * 2 - 1);
        tips.push([x, yb + 10 + R() * 6]); pts.push([x, yb + 10 + R() * 6]);
        if (k < sc) pts.push([x - w / sc, yb - 10 - R() * 8]);
      }
      for (let k = 5; k >= 1; k--) { const u = k / 6; pts.push([cx - w * u, yt + (yb - yt) * Math.pow(u, 0.9) + 8 * Math.sin(u * Math.PI)]); }
      Paint.wash(ctx, pts, P.fir, { seed: 520 + i, layers: 18, alpha: 0.1, rough: 0.07, spread: 0.05, edge: 0.45, edgeK: 0.55, edgeW: 2 });
      Paint.wash(ctx, [[cx + 4, yt + 14], [cx + w * 0.95, yb + 6], [cx + w * 0.2, yb + 10], [cx + 6, yb - 10]], P.firD, { seed: 540 + i, layers: 10, alpha: 0.08, rough: 0.12 });
      Paint.wash(ctx, [[cx - 4, yt + 12], [cx - w * 0.7, yb - 4], [cx - w * 0.5, yb - 14], [cx - 6, yt + 40]], P.firL, { seed: 560 + i, layers: 7, alpha: 0.06, rough: 0.15 });
      for (let k = 0; k < 9; k++) {    // snow resting in soft clumps on the upper edges, more on the lit (left) side
        const side = k % 3 === 2 ? 1 : -1, u = 0.12 + 0.8 * hash(i * 13 + k), ex_ = cx + side * w * u * 0.92, ey = yt + (yb - yt) * Math.pow(u, 0.9) + 4;
        const ang = Math.atan2((yb - yt) * 0.9, side * w), len = w * (0.16 + 0.1 * hash(k + i * 7)), th = 5 + 4 * hash(k * 3 + i);
        const pts = []; for (let q = 0; q < 12; q++) { const a = q / 12 * TAU, px = Math.cos(a) * len, py = Math.sin(a) * th * (Math.sin(a) > 0 ? 0.7 : 1.2); pts.push([ex_ + px * Math.cos(ang) - py * Math.sin(ang), ey + px * Math.sin(ang) + py * Math.cos(ang)]); }
        Paint.wash(ctx, pts, P.snow, { seed: 580 + i * 20 + k, layers: 8, alpha: 0.16, depth: 2, sub: 1, rough: 0.2, spread: 0.12 });
        Paint.wash(ctx, pts.map(p => [p[0] + 2, p[1] + th * 0.9]), P.snowS, { seed: 600 + i * 20 + k, layers: 4, alpha: 0.07, depth: 2, sub: 1, rough: 0.2 });
      }
      Paint.dab(ctx, cx, yt + 8, 8, 6, P.snow, { seed: 620 + i, alpha: 0.18 });
      tree.tiers.push({ yb, w, yt });
      tips.forEach((p, k) => { if (k > 0 && k < tips.length - 1 || i < 6) tree.bulbs.push({ x: p[0], y: p[1] - 4, tier: tiers - 1 - i, c: (k + i) % 4 === 0 ? 1 : (k + i) % 5 === 0 ? 2 : 0 }); });
    }
  }
  function paintFore(ctx, ex) {
    const L = byId.fore;
    // a snowy bank with dry grass, bottom-left of the opening/closing view and bottom-right of the tree shots
    const banks = [[27.5, 120, 1110, 520], [1.0, 1780, 1120, 420], [16.5, 1820, 1110, 380], [21, 120, 1110, 320]];
    banks.forEach(([t, sx, sy, r], i) => {
      const c = fromScreen(L, Story.camera(t), sx, sy), z = view(L, Story.camera(t)).z, rr = r / z;
      Paint.dab(ctx, c[0], c[1] + rr * 0.1, rr, rr * 0.32, P.snow, { seed: 900 + i, alpha: 0.2, n: 18, layers: 12, edge: 0.15 });
      Paint.dab(ctx, c[0] + rr * 0.1, c[1] + rr * 0.2, rr * 0.8, rr * 0.18, P.snowB, { seed: 910 + i, alpha: 0.08 });
      const R = rng(920 + i);
      for (let b = 0; b < 26; b++) { const x = c[0] + (R() - 0.5) * rr * 1.6, y = c[1] - rr * 0.2 + R() * rr * 0.12, a = -Math.PI / 2 + (R() - 0.5) * 0.8, l = (40 + R() * 70) / z * 0.7;
        Paint.stroke(ctx, [[x, y], [x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.5], [x + Math.cos(a + 0.15) * l, y + Math.sin(a + 0.15) * l]], 3 / z, R() < 0.5 ? P.grass : P.grassD, { seed: b + i * 40, bristles: 2, alpha: 0.7 }); }
    });
  }

  // ------------------------------------------------------------------ build every sheet
  function build() {
    for (const L of LAYERS) {
      const ex = extents(L); let s = L.res; const w = ex[2] - ex[0], h = ex[3] - ex[1];
      s = Math.min(s, 4000 / w, 4000 / h);
      const cv = document.createElement('canvas'); cv.width = Math.ceil(w * s); cv.height = Math.ceil(h * s);
      const ctx = cv.getContext('2d'); ctx.setTransform(s, 0, 0, s, -ex[0] * s, -ex[1] * s);
      let ecv = null, ectx = null;
      if (L.id === 'village') { ecv = document.createElement('canvas'); ecv.width = cv.width; ecv.height = cv.height; ectx = ecv.getContext('2d'); ectx.setTransform(s, 0, 0, s, -ex[0] * s, -ex[1] * s); }
      ({ clouds: paintClouds, far: paintFar, hills: paintHills, village: (c, e) => paintVillage(c, ectx, e), mid: paintMid, main: paintMain, fore: paintFore })[L.id](ctx, ex);
      Object.assign(L, { ex, canvas: cv, emissive: ecv });
    }
    tree.bulbs.sort((a, b) => a.tier - b.tier);
  }
  return { LAYERS, byId, view, toScreen, fromScreen, build, tree, answers, windows, hillsY, P };
})();
