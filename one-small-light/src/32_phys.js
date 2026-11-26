'use strict';
// ---- PHYSICS: springs (for weight, overlap and follow-through), ballistic jumps under real gravity, smooth
// accelerate-cruise-decelerate travel, and a stepping system that plants feet on the ground and keeps them there.
const Phys = (() => {
  const G = 2150;                     // gravity in px/s^2 (a fox kit is about 0.5 m, 1 m is about 220 px)
  class Spring {
    constructor(x, f, z) { this.x = x; this.v = 0; this.set(f, z); }
    set(f, z) { const w = TAU * f; this.k = w * w; this.c = 2 * z * w; return this; }
    step(target, dt, extra = 0) { const a = this.k * (target - this.x) - this.c * this.v + extra; this.v += a * dt; this.x += this.v * dt; return this.x; }
  }
  // a jump from p0 at t0 to p1 at t1 under gravity: [x, y, vy]
  function ballistic(p0, p1, t0, t1, t) {
    const T = t1 - t0, tau = clamp(t - t0, 0, T), vy = (p1[1] - p0[1] - 0.5 * G * T * T) / T;
    return [lerp(p0[0], p1[0], tau / T), p0[1] + vy * tau + 0.5 * G * tau * tau, vy + G * tau];
  }
  const apex = T => G * T * T / 8;
  // travel from x0 to x1 between t0 and t1: speed eases up over `ramp` s, cruises, eases down. Returns [x, v].
  function cruise(t, t0, t1, x0, x1, ramp) {
    const T = t1 - t0, a = Math.min(ramp, T / 2), V = (x1 - x0) / (T - a), tau = clamp(t - t0, 0, T);
    const S = q => q * q * q - q * q * q * q / 2, s = q => q * q * (3 - 2 * q);
    if (tau <= a) return [x0 + V * a * S(tau / a), V * s(tau / a)];
    if (tau < T - a) return [x0 + V * (a / 2 + tau - a), V];
    const q = (T - tau) / a; return [x0 + V * (T - a - a * S(q)), V * s(q)];
  }

  // ---- feet. Each foot is planted on the ground in world space and stays there while the body passes over it.
  // When the body has moved far enough that a foot is stretched behind, it lifts, swings forward in an arc and lands
  // ahead. Trot: diagonal pairs swing together. Walk: one foot at a time, hind-fore-hind-fore. Stopping = settle steps.
  class Gait {
    constructor(o) { this.o = o; this.feet = o.feet.map(f => Object.assign({ p: null, sw: null, lift: 0 }, f)); this.events = []; this.seq = 0; this.lastStart = -9; }
    ideal(f, b) { const x = b.x + b.face * f.home + b.vx * this.o.lead; return [x, hillY(x)]; }
    plant(b) { for (const f of this.feet) { const x = b.x + b.face * f.home; f.p = [x, hillY(x)]; f.sw = null; f.lift = 0; } }
    update(t, dt, b) {
      const o = this.o, moving = Math.abs(b.vx) > 6;
      for (const f of this.feet) if (f.sw) {      // swinging feet
        const u = (t - f.sw.t0) / f.sw.dur;
        if (u < 0.7) f.sw.to = this.ideal(f, b);
        if (u >= 1) { f.p = [f.sw.to[0], hillY(f.sw.to[0])]; f.sw = null; f.lift = 0; this.events.push({ t, x: f.p[0], y: f.p[1], who: o.who, id: f.id }); continue; }
        const e = ease.sine(u), x = lerp(f.sw.from[0], f.sw.to[0], e), d = Math.abs(f.sw.to[0] - f.sw.from[0]);
        f.lift = Math.sin(Math.PI * u);
        const h = o.lift * clamp(d / o.stride + 0.25, 0.3, 1) * Math.pow(f.lift, 0.85);
        f.p = [x, Math.min(lerp(f.sw.from[1], f.sw.to[1], e) - h, hillY(x) - 0.5)];
      }
      const err = f => Math.abs(this.ideal(f, b)[0] - f.p[0]);
      const thr = moving ? o.stride * 0.5 : o.settle, start = f => { f.sw = { t0: t, dur: o.dur * (moving ? 1 : 0.8), from: f.p.slice(), to: this.ideal(f, b) }; this.lastStart = t; };
      if (o.pattern === 'trot') {
        if (this.feet.some(f => f.sw) || t - this.lastStart < o.dur * 0.6) return;
        const g = [0, 1].map(k => Math.max(...this.feet.filter(f => f.group === k).map(err)));
        const k = g[0] >= g[1] ? 0 : 1;
        if (g[k] > thr) this.feet.filter(f => f.group === k).forEach(start);
      } else {
        const sw = this.feet.filter(f => f.sw);
        if (sw.length >= 2) return;
        if (sw.length && sw.some(f => (t - f.sw.t0) / f.sw.dur < o.overlap)) return;
        const free = f => !f.sw && !this.feet.some(q => q.sw && q.side === f.side);
        if (moving) {                    // walking: strictly hind, fore, hind, fore (a fore foot may lift as its hind foot lands)
          if (t - this.lastStart > o.dur * 1.5) {     // setting off: begin with whichever foot is most stretched
            let k = 0; o.order.forEach((fi, j) => { if (err(this.feet[fi]) > err(this.feet[o.order[k]])) k = j; }); this.seq = k; }
          const f = this.feet[o.order[this.seq]];
          if (!f.sw && err(f) > thr) { start(f); this.seq = (this.seq + 1) % 4; }
          else { const over = this.feet.filter(q => !q.sw && err(q) > thr * 1.5).sort((p, q) => err(q) - err(p))[0];   // a foot left far behind catches up
            if (over) { start(over); this.seq = (o.order.indexOf(this.feet.indexOf(over)) + 1) % 4; } }
        } else {                         // standing: tidy up whichever feet were left stretched
          for (let k = 0; k < 4; k++) { const f = this.feet[o.order[(this.seq + k) % 4]];
            if (free(f) && err(f) > thr) { start(f); this.seq = (this.seq + k + 1) % 4; break; } }
        }
      }
    }
  }
  return { G, Spring, ballistic, apex, cruise, Gait };
})();
