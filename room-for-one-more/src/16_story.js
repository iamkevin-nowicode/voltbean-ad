'use strict';
// ---- STORY: the camera, the weather, and the paths the fox and the deer travel. ----
const Story = (() => {
  const { cruise } = Phys;
  // where the fox's feet are going (it runs down the hill to the robin, then fights back up)
  function foxX(t) {
    if (t < 16.6) return [2470, 0];
    if (t < 22.8) return cruise(t, 16.6, 22.8, 2470, 1520, 0.8);
    if (t < 25.8) return [1520, 0];
    if (t < 30.0) return cruise(t, 25.8, 30.0, 1520, 1780, 0.6);
    if (t < 30.6) return cruise(t, 30.0, 30.6, 1780, 1764, 0.3);
    return [1764, 0];
  }
  // the deer: down out of the storm to find them; after the cut, carrying them home
  const CUT = 41.25;
  function deerX(t) {
    if (t < 33.6) return [2380, 0];
    if (t < CUT) return t < 37.0 ? cruise(t, 33.6, 37.0, 2380, 1960, 0.8) : [1960, 0];
    if (t < 46.5) return cruise(t, CUT, 46.5, 1990, 2480, 0.9);
    return [2480, 0];
  }
  const deerFace = t => (t < CUT ? -1 : 1);

  // weather: how hard the storm blows (0..1), the wind (px/s, blowing down the hill to the left), and how clear the sky is
  const storm = t => kf([[9.6, 0], [12.4, 0.55], [13.4, 1.0], [14.6, 0.68], [17, 0.8], [29.4, 0.85], [30.2, 1.0], [31.2, 0.76], [36, 0.66], [41, 0.5], [44, 0.24], [46.5, 0.05], [48, 0]], t);
  const wind = t => -storm(t) * 520 * (1 + 0.25 * Math.sin(t * 1.7) + 0.15 * Math.sin(t * 4.3 + 1));
  const WX = (() => { const a = new Float32Array(Math.ceil(FILM * 100) + 2); for (let i = 1; i < a.length; i++) a[i] = a[i - 1] + wind(i / 100) / 100; return a; })();
  const windX = t => { const i = clamp(t * 100, 0, WX.length - 2), k = Math.floor(i); return lerp(WX[k], WX[k + 1], i - k); };
  const clear = t => smooth(46.5, 50.5, t);

  const mix3 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
  const K = (keys, t) => kf(keys, t);
  function camera(t) {
    let c;
    if (t < 16.6) c = K([[0, [1800, 1060, 0.6]], [4.0, [1790, 1066, 0.62], 'sine'], [6.6, [2500, 1035, 1.25]], [10.0, [2495, 1030, 1.3], 'sine'], [12.4, [2470, 1000, 1.05]],
      [13.5, [2440, 1010, 1.02]], [15.3, [1900, 1190, 0.85]], [16.6, [2330, 1110, 1.15]]], t);
    else if (t < 23.0) { const fx = foxX(t)[0]; c = mix3([2330, 1110, 1.15], [fx - 210, hillY(fx) - 130, 1.12], smooth(16.6, 18.0, t)); }
    else if (t < 25.8) c = mix3([1310, hillY(1520) - 130, 1.12], [1495, 1355, 1.6], ease.inOut(clamp((t - 23.0) / 1.2)));
    else if (t < 31.0) { const fx = foxX(t)[0]; c = mix3([1495, 1355, 1.6], [fx + 170, hillY(fx) - 150, 1.28], smooth(25.8, 27.2, t)); }
    else if (t < 32.6) c = mix3([1764 + 170, hillY(1764) - 150, 1.28], [2180, 1040, 1.12], ease.inOut(clamp((t - 31.0) / 1.6)));
    else if (t < CUT) c = K([[32.6, [2180, 1040, 1.12]], [34.2, [1960, 1200, 1.1]], [37.4, [1880, 1235, 1.1], 'sine'], [39.6, [1900, 1150, 1.15]], [CUT, [1905, 1140, 1.16], 'sine']], t);
    else if (t < 46.5) { const dx = deerX(t)[0]; c = [dx + 130, hillY(dx) - 210, 1.0]; c = mix3(c, [2470, 1060, 1.25], smooth(45.2, 46.5, t)); }
    else c = K([[46.5, [2470, 1060, 1.25]], [49.5, [2455, 1095, 1.45]], [52.5, [2450, 1110, 1.62]], [55.0, [2452, 1112, 1.66], 'sine'], [57.4, [1880, 1010, 0.6]], [60.5, [1860, 1015, 0.6], 'sine']], t);
    const shake = storm(t) * 4;
    return [c[0] + 3 * Math.sin(t * 0.7) + shake * Math.sin(t * 9.1), c[1] + 2 * Math.sin(t * 0.53 + 1) + shake * Math.sin(t * 7.3 + 2), c[2]];
  }
  // it is night all through; the storm greys the sky; when it clears the sky deepens and the stars come back
  const SKY = { night: ['#1a2352', '#2f3e7b', '#58659b'].map(hex), storm: ['#2a3050', '#454f72', '#6b7392'].map(hex), clear: ['#16204d', '#2f4189', '#6a6ea6'].map(hex) };
  function sky(t) { const s = storm(t), c = clear(t), k = i => mixC(mixC(SKY.night[i], SKY.storm[i], s), SKY.clear[i], c); return { top: k(0), mid: k(1), hor: k(2) }; }
  const ambient = t => mixC(mixC([0.48, 0.54, 0.8], [0.5, 0.53, 0.66], storm(t)), [0.54, 0.58, 0.86], clear(t));
  const mood = () => 2.2;
  return { camera, foxX, deerX, deerFace, CUT, storm, wind, windX, clear, sky, ambient, mood };
})();
