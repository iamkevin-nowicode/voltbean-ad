'use strict';
// ---- TITLES: hand-lettered words and the red seal, painted once into small canvases. ----
const Titles = (() => {
  const SERIF = '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Liberation Serif", "DejaVu Serif", serif';
  // ink lettering: a soft bleed underneath, a few slightly offset passes, then the line itself
  function letter(text, size, col, o = {}) {
    const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
    const font = `italic ${o.weight || 400} ${size}px ${SERIF}`; ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width + size), h = Math.ceil(size * 1.6);
    cv.width = w; cv.height = h; ctx.font = font; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    const R = rng(text.length * 31);
    ctx.save(); ctx.filter = `blur(${size * 0.05}px)`; ctx.fillStyle = css(col, 0.35); ctx.fillText(text, w / 2, h / 2 + 2); ctx.restore();
    for (let i = 0; i < 4; i++) { ctx.fillStyle = css(col, 0.32); ctx.fillText(text, w / 2 + (R() - 0.5) * size * 0.025, h / 2 + (R() - 0.5) * size * 0.025); }
    if (o.sub) { ctx.font = `${Math.round(size * 0.24)}px ${SERIF}`; ctx.fillStyle = css(col, 0.8); ctx.letterSpacing = `${size * 0.04}px`; }
    return cv;
  }
  function stacked(lines) {   // [[canvas, gap]] stacked and centred
    const w = Math.max(...lines.map(l => l[0].width)), h = lines.reduce((a, l) => a + l[0].height + (l[1] || 0), 0);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const ctx = cv.getContext('2d'); let y = 0;
    for (const [c, g] of lines) { ctx.drawImage(c, (w - c.width) / 2, y); y += c.height + (g || 0); }
    return cv;
  }
  function small(text, size, col, spacing) {
    const cv = document.createElement('canvas'), ctx = cv.getContext('2d'), font = `${size}px ${SERIF}`; ctx.font = font;
    const sp = spacing || 0, w = Math.ceil(ctx.measureText(text).width + sp * text.length + size), h = Math.ceil(size * 1.8);
    cv.width = w; cv.height = h; ctx.font = font; ctx.textBaseline = 'middle'; ctx.fillStyle = css(col, 0.85);
    let x = size / 2; for (const ch of text) { ctx.fillText(ch, x, h / 2); x += ctx.measureText(ch).width + sp; }
    return cv;
  }
  function seal() {
    const s = 128, cv = document.createElement('canvas'); cv.width = cv.height = s; const ctx = cv.getContext('2d');
    ctx.fillStyle = '#c23b2a'; ctx.beginPath(); ctx.roundRect(8, 8, s - 16, s - 16, 14); ctx.fill();
    // a little fox face cut out of the red, like a carved stamp
    ctx.globalCompositeOperation = 'destination-out'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(34, 40); ctx.lineTo(50, 62); ctx.lineTo(78, 62); ctx.lineTo(94, 40); ctx.lineTo(90, 72); ctx.lineTo(64, 100); ctx.lineTo(38, 72); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#c23b2a';
    ctx.beginPath(); ctx.arc(52, 74, 4.5, 0, TAU); ctx.arc(76, 74, 4.5, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(64, 92, 4, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out'; const R = rng(9);   // ink that didn't take
    for (let i = 0; i < 260; i++) { ctx.globalAlpha = 0.25 + R() * 0.5; ctx.beginPath(); ctx.arc(R() * s, R() * s, R() * 1.8, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    return cv;
  }
  let T = null;
  function build() {
    const ink = hex('#2a3263'), warm = hex('#fff0d2');
    T = {
      title: stacked([[letter('Room for One More', 112, warm)], [small('A  WINTER  TALE  FROM  THE  HILL', 30, warm, 4)]]),
      greet: stacked([[letter('Merry Christmas', 104, warm)], [small('THERE\'S  ALWAYS  ROOM  FOR  ONE  MORE', 30, warm, 4)]]),
      seal: seal(),
    };
    return T;
  }
  // [x, y (centre, screen px), opacity] for each at time t
  function state(t) {
    return {
      title: [560, 180, smooth(2.3, 3.1, t) * (1 - smooth(5.2, 6.0, t))],
      greet: [960, 190, smooth(55.6, 56.8, t) * (1 - smooth(59.3, 59.9, t))],
      seal: [1772, 950, smooth(0.0, 0.01, t) * (1 - smooth(2.4, 3.2, t)) + (Score.since('seal', undefined, t) === Infinity ? 0 : smooth(58.75, 58.8, t))],
    };
  }
  return { build, state };
})();
