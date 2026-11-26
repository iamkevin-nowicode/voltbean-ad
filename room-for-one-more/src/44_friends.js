'use strict';
// ---- FRIENDS: a snowshoe hare in its white winter coat, a robin, and the little lantern. ----
const Hare = (() => {
  // a snowshoe hare in its white winter coat. Its shapes morph between a round sitting pose and the long stretch of a
  // hop (same points, blended), so the body squashes and stretches instead of swapping drawings.
  const C = { fur: '#f4f1ea', sh: 'rgba(90,100,150,0.28)', tip: '#4a3a33', inner: '#e9b9b0', nose: '#d98a8a', line: '#7d82a3' };
  const { shape, eye, dot, at, mix } = Ink;
  const K = {
    body: [[[-30, -4], [-36, -30], [-22, -54], [4, -60], [24, -50], [32, -26], [26, -4], [0, 2]], [[-40, -22], [-44, -36], [-28, -52], [6, -54], [32, -50], [46, -38], [38, -24], [0, -18]]],
    foot: [[[-14, -2], [-12, -12], [18, -10], [30, -4], [26, 2], [-12, 2]], [[-36, -26], [-44, -32], [-66, -20], [-72, -10], [-64, -8], [-42, -16]]],
    paw: [[[18, -10], [26, -12], [32, -4], [26, 1], [18, 0]], [[40, -32], [52, -30], [60, -20], [54, -16], [44, -22]]],
    head: [[0, 0], [16, 4]],
  };
  const HEAD = [[8, -58], [14, -76], [30, -82], [44, -72], [48, -60], [40, -52], [22, -50]];
  const M = (k, u) => K[k][0].map((p, i) => mix(p, K[k][1][i], u));
  // P: emerge (0 under the snow .. 1 out), stretch (0 sit .. 1 mid-hop), crouch, ears [near, far] (radians, 0 up), blink
  function draw(ctx, P) {
    const em = P.emerge === undefined ? 1 : P.emerge, st = clamp(P.stretch || 0), cr = P.crouch || 0;
    ctx.save(); ctx.beginPath(); ctx.rect(-200, -400, 400, 403); ctx.clip();
    ctx.translate(0, (1 - em) * 110); ctx.scale(1 + cr * 0.06, 1 - cr * 0.1);
    const ho = K.head[0].map((v, i) => lerp(v, K.head[1][i], st)), head = HEAD.map(p => [p[0] + ho[0], p[1] + ho[1]]);
    const ear = (bx, a, id) => { const b = [bx + ho[0], -76 + ho[1]], q = p => at(b, a - st * 0.5, p);
      shape(ctx, [q([-5, 2]), q([-7, -22]), q([-2, -50]), q([5, -22]), q([5, 2])], C.fur, { shadow: [q([0, 2]), q([1, -22]), q([-2, -50]), q([5, -22]), q([5, 2])], shadowCol: C.sh, lw: 1.6 });
      shape(ctx, [q([-5, -34]), q([-2, -50]), q([3, -34])], C.tip, { lw: 1.2 }); };
    if (P.pass === 'inner') {            // the hind foot and the front paw against the white body, and the jaw
      const f = M('foot', st), pw = M('paw', st), L = (pts, w) => Ink.line(ctx, pts, w, C.line, 0.8);
      L([f[1], f[2], f[3]], 1.4); L([pw[4], pw[0], pw[1]], 1.2); L([head[6], head[5], [head[4][0] - 1, head[4][1] + 2]], 1.2);
      ctx.restore(); return;
    }
    ear(20, P.ears ? P.ears[1] - 0.25 : -0.25);
    shape(ctx, M('body', st), C.fur, { shadow: [[-50, -16], [50, -12], [50, 6], [-50, 6]], shadowCol: C.sh, lw: 1.8 });
    shape(ctx, [[-36 - st * 8, -22 - st * 10], [-46 - st * 8, -28 - st * 10], [-44 - st * 8, -14 - st * 10], [-34 - st * 8, -12 - st * 10]], C.fur, { lw: 1.6 });
    shape(ctx, M('foot', st), C.fur, { shadow: M('foot', st).map(p => [p[0], p[1] + 5]), shadowCol: C.sh, lw: 1.6 });
    shape(ctx, M('paw', st), C.fur, { lw: 1.5 });
    shape(ctx, head, C.fur, { shadow: head.map(p => [p[0], p[1] + 8]), shadowCol: C.sh, lw: 1.8 });
    ear(30, P.ears ? P.ears[0] : 0);
    dot(ctx, 47 + ho[0], -62 + ho[1], 2.4, C.nose);
    eye(ctx, 36 + ho[0], -68 + ho[1], 2.8, P.blink === undefined ? 1 : P.blink);
    ctx.restore();
  }
  return { draw, LINE: C.line };
})();

const Robin = (() => {
  const C = { back: '#7a5a43', breast: '#e0662f', belly: '#f2e4cf', beak: '#3b2a22' };
  const { shape, eye } = Ink;
  // Pose: flap (phase, radians) when flying (fly 0..1), else perched. look (rad).
  function draw(ctx, P) {
    const fly = P.fly || 0;
    ctx.save(); ctx.scale(1.25, 1.25);
    if (!fly) { ctx.strokeStyle = Ink.LINE; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(-2, -2); ctx.lineTo(-3, 2); ctx.moveTo(3, -2); ctx.lineTo(4, 2); ctx.stroke(); }
    shape(ctx, [[-12, -10], [-26, -18], [-26, -8]], C.back, { id: 90, lw: 1.4 });
    shape(ctx, [[-12, -8], [-9, -18], [3, -23], [12, -19], [14, -11], [9, -3], [-3, -1], [-12, -4]], C.back, { id: 91, lw: 1.6 });
    shape(ctx, [[2, -16], [12, -18], [14, -10], [8, -3], [-2, -2], [-2, -10]], C.breast, { id: 92, lw: 0 });
    shape(ctx, [[-6, -3], [4, -3], [0, -1]], C.belly, { id: 93, lw: 0 });
    shape(ctx, [[13, -18], [19, -16.5], [13, -15]], C.beak, { id: 94, lw: 0.8 });
    eye(ctx, 8, -18.5, 1.4, P.blink === undefined ? 1 : P.blink);
    const a = P.wing !== undefined ? P.wing : fly ? Math.sin(P.flap || 0) * 1.1 - 0.3 : 0.1;
    ctx.save(); ctx.translate(-3, -14); ctx.rotate(-a);
    shape(ctx, [[0, 0], [-6, -4], [-18, -2], [-14, 4], [-2, 4]], '#6a4a36', { id: 95, lw: 1.3 });
    ctx.restore(); ctx.restore();
  }
  return { draw };
})();

const Lantern = (() => {
  // drawn hanging from its handle at (0,0), swinging by `swing` radians. glow 0..2 lights the glass.
  function draw(ctx, swing, glow) {
    ctx.save(); ctx.rotate(swing);
    ctx.strokeStyle = '#2d241f'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(0, 6, 6, Math.PI, 0); ctx.stroke();
    Ink.shape(ctx, [[-8, 6], [8, 6], [11, 12], [-11, 12]], '#3d3430', { id: 97, lw: 1.4 });
    const g = clamp(glow / 1.4); const glass = css(mixC(hex('#8a6a4a'), hex('#ffe2a0'), g));
    Ink.shape(ctx, [[-9, 12], [9, 12], [10, 32], [-10, 32]], glass, { id: 98, lw: 1.6 });
    ctx.fillStyle = css(hex('#fff6d8'), 0.85 * g); ctx.beginPath(); ctx.ellipse(0, 23, 2.6, 5.5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#2d241f'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-3.5, 12); ctx.lineTo(-3.5, 32); ctx.moveTo(3.5, 12); ctx.lineTo(3.5, 32); ctx.stroke();
    Ink.shape(ctx, [[-12, 32], [12, 32], [9, 37], [-9, 37]], '#3d3430', { id: 99, lw: 1.4 });
    ctx.restore();
    return [-22 * Math.sin(swing), 22 * Math.cos(swing)];   // flame offset from the handle
  }
  return { draw };
})();
