'use strict';
// ---- STORY: where the camera is, and where the fox is, at any moment. ----
const Story = (() => {
  // the fox trots up the hill from bar 2 beat 3 until bar 5 beat 1
  const foxWalkX = t => kf([[3.75, 900], [4.4, 960, 'in'], [9.4, 2370, 'lin'], [10.0, 2440, 'out']], t);
  const mix3 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
  const SHOTS = [
    [10.6, [2560, 990, 1.05]], [12.2, [2540, 1005, 1.07], 'sine'], [13.3, [2480, 1060, 1.3]], [14.6, [2490, 1052, 1.32], 'sine'],
    [15.9, [2610, 965, 0.95]], [17.6, [2620, 955, 0.96], 'sine'], [19.9, [2630, 845, 1.0]], [22.5, [2620, 850, 1.0], 'sine'],
    [25.0, [2420, 905, 0.76]], [27.3, [1880, 1010, 0.6]], [30.5, [1860, 1015, 0.6], 'sine'],
  ];
  // camera = [centre x, centre y, zoom] in world units
  function camera(t) {
    let c;
    if (t < 10.6) {
      const wide = kf([[0, [1800, 1060, 0.6]], [3.9, [1780, 1075, 0.63], 'sine']], t);
      const fx = foxWalkX(t), follow = [fx + 270, hillY(fx) - 200, 1.0];
      c = mix3(wide, follow, smooth(3.9, 6.4, t));
      c = mix3(c, SHOTS[0][1], smooth(8.6, 10.6, t));
    } else c = kf(SHOTS, t);
    // a breathing hand on the camera
    return [c[0] + 3 * Math.sin(t * 0.7), c[1] + 2 * Math.sin(t * 0.53 + 1), c[2]];
  }
  // time-of-day mood: 0 dusk, 1 blue hour, 2 night, 3 night lit by the tree
  const mood = t => (t < 8 ? 0 : t < 11.5 ? smooth(8, 11.5, t) : t < 14 ? 1 + smooth(11.5, 14, t) : t < 21.25 ? 2 : 2 + smooth(21.25, 23.5, t));
  const pick = (stops, m) => { const i = Math.min(stops.length - 2, Math.floor(m)); return mixC(stops[i], stops[i + 1], ease.sine(clamp(m - i))); };
  const SKY = {
    top: ['#7884be', '#3a4680', '#1a2352', '#1b2758'].map(hex),
    mid: ['#d6a3bd', '#6e70a8', '#2f3e7b', '#34478a'].map(hex),
    hor: ['#f6c99c', '#b89ab6', '#58659b', '#6b6fa4'].map(hex),
  };
  const AMB = [[1.0, 0.95, 0.93], [0.7, 0.72, 0.9], [0.47, 0.53, 0.8], [0.53, 0.57, 0.85]];
  const sky = t => { const m = mood(t); return { top: pick(SKY.top, m), mid: pick(SKY.mid, m), hor: pick(SKY.hor, m) }; };
  const ambient = t => pick(AMB, mood(t));
  return { camera, foxWalkX, mood, sky, ambient };
})();
