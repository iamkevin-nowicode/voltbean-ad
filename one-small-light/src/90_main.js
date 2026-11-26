'use strict';
// ---- MAIN: load, paint the sheets, then play. ?render switches to frame-exact mode for the video renderer. ----
(() => {
  const q = new URLSearchParams(location.search), RENDER = q.has('render');
  const cv = document.getElementById('c'), ld = document.getElementById('ld'), st = document.getElementById('st'), bar = document.querySelector('#bar s'), hud = document.getElementById('hud');
  const mk = s => { const c = document.createElement('canvas'); c.width = W * s; c.height = H * s; const ctx = c.getContext('2d'); ctx._s = s; return ctx; };
  const A = { actors: mk(1), sky: mk(0.5), back: mk(0.5), front: mk(0.5), light: mk(0.25) };
  function frame(t) {
    t = clamp(t, 0, FILM - 1e-4);
    const c = Story.camera(t), F = Actors.draw(t, c, A);
    Glow.sky(A.sky, t, c); Glow.back(A.back, t, c, F); Glow.front(A.front, t, c, F); Glow.lightmap(A.light, t, c, F);
    Stage.render(t, c, F, A);
  }
  const tick = () => new Promise(r => setTimeout(r, 0));
  const say = (s, k) => { if (st) st.textContent = s; if (bar) bar.style.width = (k * 100) + '%'; };
  async function boot() {
    if (!RENDER) Sound.prepare();
    say('stretching the paper', 0.1); await tick();
    World.build(); say('mixing the colours', 0.7); await tick();
    Stage.init(cv, A, RENDER); frame(0); say('ready', 1); await tick();
  }
  const ready = boot();
  if (RENDER) { window.__film = { ready, duration: FILM, frame: t => { frame(t); return cv.toDataURL('image/jpeg', 0.93); } }; return; }

  // ---- the player
  let playing = false, paused = false, clock = 0, last = 0, usingAudio = false;
  const hint = (s, ms) => { hud.textContent = s; hud.style.opacity = 1; clearTimeout(hint.k); hint.k = setTimeout(() => (hud.style.opacity = 0), ms || 2600); };
  async function begin() {
    if (playing) return; playing = true; ld.style.opacity = 0; setTimeout(() => (ld.style.display = 'none'), 900);
    usingAudio = await Sound.start(0); clock = 0; last = performance.now();
    hint('space  pause   ·   ← →  a bar   ·   M  mute   ·   R  restart', 4200);
    requestAnimationFrame(loop);
  }
  function loop(now) {
    const dt = (now - last) / 1000; last = now;
    if (!paused) { const at = usingAudio ? Sound.time() : null; clock = at !== null ? at : (clock + dt) % FILM; }
    frame(clock); requestAnimationFrame(loop);
  }
  async function seek(t) { clock = ((t % FILM) + FILM) % FILM; if (usingAudio && !paused) await Sound.start(clock); }
  ready.then(() => { ld.classList.add('go'); say('press anywhere to begin, with sound', 1); });
  addEventListener('pointerdown', () => ready.then(begin));
  addEventListener('keydown', e => {
    if (!playing) { ready.then(begin); return; }
    if (e.code === 'Space') { paused = !paused; if (paused) Sound.stop(); else seek(clock); hint(paused ? 'paused' : 'playing'); e.preventDefault(); }
    else if (e.code === 'ArrowRight') seek(clock + BAR); else if (e.code === 'ArrowLeft') seek(clock - BAR);
    else if (e.code === 'KeyM') hint(Sound.mute() ? 'muted' : 'sound on'); else if (e.code === 'KeyR') seek(0);
  });
})();
