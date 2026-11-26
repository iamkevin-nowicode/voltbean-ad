'use strict';
// ---- FRIENDS: a snowshoe hare in its white winter coat, a robin, and the little lantern. ----
const Hare = (() => {
  const C = { fur: '#f4f1ea', sh: 'rgba(90,100,150,0.28)', tip: '#4a3a33', inner: '#e9b9b0', nose: '#d98a8a' };
  const { tr, shape, eye, dot } = Ink;
  // Pose: emerge (0 under the snow .. 1 out), hop (px), stretch, perk (ears 0 back .. 1 up), blink
  function draw(ctx, P) {
    const em = P.emerge === undefined ? 1 : P.emerge, sink = (1 - em) * 110, hop = P.hop || 0, st = P.stretch || 0;
    ctx.save(); ctx.beginPath(); ctx.rect(-200, -400, 400, 404); ctx.clip();
    ctx.translate(0, sink - hop); ctx.scale(1 - st * 0.08, 1 + st * 0.14);
    const perk = P.perk === undefined ? 1 : P.perk;
    const ear = (bx, tipUp, tipBack, id) => { const tp = [lerp(tipBack[0], tipUp[0], perk), lerp(tipBack[1], tipUp[1], perk)];
      const mid = [lerp(bx, tp[0], 0.5), lerp(-76, tp[1], 0.5)], n = [tp[1] - -76, -(tp[0] - bx)], l = Math.hypot(n[0], n[1]) || 1, w = 7;
      const pts = [[bx - 5, -74], [mid[0] - n[0] / l * w, mid[1] - n[1] / l * w], tp, [mid[0] + n[0] / l * w, mid[1] + n[1] / l * w], [bx + 5, -74]];
      shape(ctx, pts, C.fur, { id, shadow: [[bx, -74], mid, tp, [mid[0] + n[0] / l * w, mid[1] + n[1] / l * w], [bx + 5, -74]], shadowCol: C.sh });
      shape(ctx, [[lerp(mid[0], tp[0], 0.55) - 5, lerp(mid[1], tp[1], 0.55)], tp, [lerp(mid[0], tp[0], 0.55) + 5, lerp(mid[1], tp[1], 0.55)]], C.tip, { id: id + 1, lw: 1.2 });
    };
    ear(20, [6, -132], [-30, -96], 80);
    shape(ctx, [[-30, -4], [-36, -30], [-22, -54], [4, -60], [24, -50], [32, -26], [26, -4], [0, 2]], C.fur, { id: 82, shadow: [[-40, -18], [34, -14], [34, 6], [-40, 6]], shadowCol: C.sh });
    shape(ctx, [[-40, -20], [-48, -26], [-46, -14], [-36, -12]], C.fur, { id: 83 });
    shape(ctx, [[-14, -2], [-12, -12], [18, -10], [30, -4], [26, 2], [-12, 2]], C.fur, { id: 84, shadow: [[-14, -4], [32, -4], [32, 4], [-14, 4]], shadowCol: C.sh });
    shape(ctx, [[8, -58], [14, -76], [30, -82], [44, -72], [48, -60], [40, -52], [22, -50]], C.fur, { id: 85, shadow: [[6, -58], [50, -58], [50, -48], [6, -48]], shadowCol: C.sh });
    ear(30, [36, -132], [0, -100], 86);
    dot(ctx, 47, -62, 2.4, C.nose);
    eye(ctx, 36, -68, 2.8, P.blink ? 0 : 1);
    ctx.restore();
  }
  return { draw };
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
    eye(ctx, 8, -18.5, 1.4, 1);
    const a = fly ? Math.sin(P.flap || 0) * 1.1 - 0.3 : 0.1;
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
