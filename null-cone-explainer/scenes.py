"""
The story, scene by scene. Each scene is draw(ctx, t) with t = local seconds.
Top card = expert note, bottom caption = plain-language narration.
"""
import math

import cairo
import numpy as np

from engine import (W, H, TAU, PAL, C, clamp, lerp, seg, smooth, ease_out, ease_in, ease_back,
                    pop, fade, rgba, mix, rrect, ellipse, glow, shadow, arrow, group_alpha,
                    text, text_w, pop_text, caption, expert, formula, math_img, draw_img,
                    img_size, background, face, pip, gravi, tick, hush, planet, sparkle)

SFX = []  # (absolute_time, kind) filled by the timeline


# ====================================================================== shared visuals
def sparkle_burst(ctx, x, y, t, t0, n=10, R=90, col="#FFE79A"):
    p = seg(t, t0, t0 + 0.9)
    if p <= 0 or p >= 1:
        return
    e = ease_out(p)
    for i in range(n):
        an = i * TAU / n + 0.3
        d = R * e
        sparkle(ctx, x + math.cos(an) * d, y + math.sin(an) * d, 12 * (1 - p) + 2, col, 1 - p, rot=p)
    glow(ctx, x, y, R * 0.9 * e + 10, col, 0.5 * (1 - p))


def label(ctx, s, x, y, size=28, col=None, a=1.0):
    col = col or PAL["cream"]
    text(ctx, s, x, y, size, col, a, outline="#120C2A", ow=7)


def math_label(ctx, s, x, y, size=34, col="#FFF4E6", a=1.0, scale=1.0):
    draw_img(ctx, math_img(s, size, col), x, y, scale, a)


def E_PT(cx, yc, r, th, e):
    return cx + r * math.cos(th), yc + r * e * math.sin(th)


def ring_path(ctx, cx, yc, r, e, a0=0, a1=TAU):
    ctx.save()
    ctx.translate(cx, yc)
    ctx.scale(max(r, 1e-3), max(r * e, 1e-3))
    ctx.arc(0, 0, 1, a0, a1)
    ctx.restore()


def gen_point(cx, cy, h, R, th, s, upper=False, e=0.26):
    """Point a fraction s from the apex along the generator that ends at angle th on S."""
    ax, ay = cx, (cy - h if upper else cy + h)
    ex, ey = E_PT(cx, cy, R, th, e)
    return lerp(ax, ex, s), lerp(ay, ey, s)


def cone(ctx, cx, cy, h, R, f, upper, t, a=1.0, e=0.26, ngen=12, col="teal", rot=0.0,
         bend=0.0, hl_gen=None):
    if f <= 0.002 or a <= 0:
        return
    base, dark = C(PAL[col]), C(PAL[col + "_d"])
    ax, ay = cx, (cy - h if upper else cy + h)
    yc = (cy - h * (1 - f)) if upper else (cy + h * (1 - f))
    r = R * f
    # back generators
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)

    def gen_line(th, alpha, w):
        ex, ey = E_PT(cx, yc, r, th, e)
        mx, my = (ax + ex) / 2, (ay + ey) / 2
        # focusing: bow toward the axis
        bx = mx + (cx - mx) * bend
        rgba(ctx, mix(base, "#FFFFFF", 0.35), alpha * a)
        ctx.set_line_width(w)
        ctx.move_to(ax, ay)
        ctx.curve_to(lerp(ax, bx, 0.7), lerp(ay, my, 0.7), lerp(ex, bx, 0.6), lerp(ey, my, 0.6), ex, ey)
        ctx.stroke()

    ths = [rot + i * TAU / ngen for i in range(ngen)]
    for th in ths:
        if math.sin(th) < 0:
            gen_line(th, 0.22, 2)
    # back rim
    ring_path(ctx, cx, yc, r, e, TAU / 2, TAU)
    rgba(ctx, base, 0.45 * a)
    ctx.set_line_width(2.5)
    ctx.stroke()
    # fill
    ctx.move_to(ax, ay)
    ctx.line_to(cx + r, yc)
    ring_path(ctx, cx, yc, r, e, 0, TAU / 2)
    ctx.close_path()
    g = cairo.LinearGradient(ax, ay, cx, yc)
    g.add_color_stop_rgba(0, *base, 0.55 * a)
    g.add_color_stop_rgba(1, *base, 0.18 * a)
    ctx.set_source(g)
    ctx.fill()
    # light-front disk
    if f < 0.999:
        ring_path(ctx, cx, yc, r, e)
        rgba(ctx, base, 0.12 * a)
        ctx.fill()
    # silhouette
    rgba(ctx, dark, 0.9 * a)
    ctx.set_line_width(3)
    ctx.set_line_join(cairo.LINE_JOIN_ROUND)
    ctx.move_to(cx - r, yc)
    ctx.line_to(ax, ay)
    ctx.line_to(cx + r, yc)
    ctx.stroke()
    for th in ths:
        if math.sin(th) >= 0:
            gen_line(th, 0.6, 2.4)
    ring_path(ctx, cx, yc, r, e, 0, TAU / 2)
    rgba(ctx, mix(base, "#FFFFFF", 0.3), 0.95 * a)
    ctx.set_line_width(3.5)
    ctx.stroke()
    if f < 0.999:  # glowing light-front
        ring_path(ctx, cx, yc, r, e)
        rgba(ctx, "#FFF2B8", 0.55 * a)
        ctx.set_line_width(5)
        ctx.stroke()


def corner(ctx, cx, cy, R, t, a=1.0, e=0.26, w=5):
    if a <= 0:
        return
    pulse = 0.5 + 0.5 * math.sin(t * 3)
    for lw, al in ((22, 0.10), (12, 0.22), (w, 1.0)):
        ring_path(ctx, cx, cy, R, e)
        rgba(ctx, PAL["gold"], al * a * (0.8 + 0.2 * pulse))
        ctx.set_line_width(lw)
        ctx.stroke()


def cap(ctx, cx, cy, h, R, c, upper, a=1.0, e=0.26, col="mint"):
    if a <= 0:
        return
    yc = (cy - h * (1 - c)) if upper else (cy + h * (1 - c))
    r = R * c
    ring_path(ctx, cx, yc, r, e)
    rgba(ctx, PAL[col], 0.85 * a)
    ctx.fill_preserve()
    rgba(ctx, PAL[col + "_d"], a)
    ctx.set_line_width(3)
    ctx.stroke()
    return yc


def diamond3d(ctx, cx, cy, h, R, t, low=1.0, up=1.0, a=1.0, e=0.26, ngen=12, corner_a=None,
              caps=0.0, capc=0.14, bend=0.0, rot=0.0):
    group = a < 0.999
    if group:
        ctx.push_group()
    cone(ctx, cx, cy, h, R, up, True, t, 1, e, ngen, "coral", rot)
    cone(ctx, cx, cy, h, R, low, False, t, 1, e, ngen, "teal", rot + 0.13, bend)
    ca = corner_a if corner_a is not None else (1.0 if (low >= 0.999 and up >= 0.999) else 0.0)
    corner(ctx, cx, cy, R, t, ca, e)
    if caps > 0:
        for upper in (False, True):
            # dim the excised tip
            yc = (cy - h * (1 - capc)) if upper else (cy + h * (1 - capc))
            ax, ay = cx, (cy - h if upper else cy + h)
            r = R * capc
            ctx.move_to(ax, ay)
            ctx.line_to(cx + r, yc)
            ring_path(ctx, cx, yc, r, e, 0, TAU / 2)
            ctx.close_path()
            rgba(ctx, PAL["bg_top"], 0.75 * caps)
            ctx.fill()
            cap(ctx, cx, cy, h, R, capc, upper, caps, e)
    if group:
        ctx.pop_group_to_source()
        ctx.paint_with_alpha(a)


def tile(ctx, x, y, s, t, a=1.0, seed=0, eyes=True, glow_edge=0.0):
    """Flat causal-diamond tile (light walls at 45 degrees) with a tiny face."""
    if a <= 0 or s <= 1:
        return
    ctx.save()
    ctx.translate(x, y)
    ctx.move_to(-s, 0)
    ctx.line_to(0, s)
    ctx.line_to(s, 0)
    ctx.close_path()
    g = cairo.LinearGradient(0, s, 0, 0)
    g.add_color_stop_rgba(0, *C(PAL["teal"]), 0.75 * a)
    g.add_color_stop_rgba(1, *C(PAL["teal"]), 0.35 * a)
    ctx.set_source(g)
    ctx.fill()
    ctx.move_to(-s, 0)
    ctx.line_to(0, -s)
    ctx.line_to(s, 0)
    ctx.close_path()
    g = cairo.LinearGradient(0, -s, 0, 0)
    g.add_color_stop_rgba(0, *C(PAL["coral"]), 0.75 * a)
    g.add_color_stop_rgba(1, *C(PAL["coral"]), 0.35 * a)
    ctx.set_source(g)
    ctx.fill()
    ctx.move_to(0, -s)
    ctx.line_to(s, 0)
    ctx.line_to(0, s)
    ctx.line_to(-s, 0)
    ctx.close_path()
    rgba(ctx, PAL["gold"], (0.85 + 0.15 * glow_edge) * a)
    ctx.set_line_width(2.5 + 3 * glow_edge)
    ctx.set_line_join(cairo.LINE_JOIN_ROUND)
    ctx.stroke()
    if eyes and s > 30:
        face(ctx, s * 0.42, t, seed, mood="smile", a=a)
    ctx.restore()


def fabric(ctx, cx, cy, w, h, t, well=0.0, wobble=0.0, col="sky", a=0.6, n=15, wx=0.0, wy=0.0,
           ripple=0.0):
    def P(u, v):
        persp = 0.72 + 0.28 * (v + 1) / 2
        x = cx + u * w * persp
        y = cy + v * h
        d = well * math.exp(-((u - wx) ** 2 + ((v - wy) * 1.4) ** 2) / 0.10)
        wob = wobble * (math.sin(u * 4.6 + t * 2.3) * math.cos(v * 3.7 - t * 1.9)) * 26
        rip = ripple * math.sin(u * 9 - t * 4) * math.exp(-v * v) * 6
        return x, y + d * 125 + wob + rip

    base = C(PAL[col])
    ctx.set_line_width(2)
    for i in range(n):
        u = -1 + 2 * i / (n - 1)
        for j in range(40):
            v0, v1 = -1 + 2 * j / 40, -1 + 2 * (j + 1) / 40
            x0, y0 = P(u, v0)
            x1, y1 = P(u, v1)
            rgba(ctx, base, a * (0.35 + 0.65 * (v0 + 1) / 2))
            ctx.move_to(x0, y0)
            ctx.line_to(x1, y1)
            ctx.stroke()
    for j in range(n):
        v = -1 + 2 * j / (n - 1)
        rgba(ctx, base, a * (0.35 + 0.65 * (v + 1) / 2))
        for i in range(40):
            u0, u1 = -1 + 2 * i / 40, -1 + 2 * (i + 1) / 40
            x0, y0 = P(u0, v)
            x1, y1 = P(u1, v)
            ctx.move_to(x0, y0)
            ctx.line_to(x1, y1)
        ctx.stroke()
    return P


def card(ctx, x, y, w, h, a=1.0, col="#1A1238", border=None):
    rrect(ctx, x - w / 2 + 6, y - h / 2 + 10, w, h, 30)
    rgba(ctx, "#05020F", 0.35 * a)
    ctx.fill()
    rrect(ctx, x - w / 2, y - h / 2, w, h, 30)
    rgba(ctx, col, 0.82 * a)
    ctx.fill_preserve()
    rgba(ctx, border or PAL["lav"], 0.45 * a)
    ctx.set_line_width(2)
    ctx.stroke()


# ====================================================================== 0. title
def s_title(ctx, t):
    cx, cy, s = 960, 420, 230
    verts = [(cx, cy + s), (cx + s, cy), (cx, cy - s), (cx - s, cy), (cx, cy + s)]
    trace = smooth(seg(t, 0.4, 3.6)) * 4
    k = min(int(trace), 3)
    fr = trace - k
    # filled tile once traced
    fill_a = smooth(seg(t, 3.4, 4.4))
    if fill_a > 0:
        tile(ctx, cx, cy, s, t, fill_a, seed=4, eyes=False)
    # glowing trail
    pts = verts[:k + 1] + [(lerp(verts[k][0], verts[k + 1][0], fr), lerp(verts[k][1], verts[k + 1][1], fr))]
    if trace > 0:
        for lw, al in ((18, 0.12), (9, 0.3), (4, 1.0)):
            rgba(ctx, PAL["gold"], al)
            ctx.set_line_width(lw)
            ctx.set_line_cap(cairo.LINE_CAP_ROUND)
            ctx.set_line_join(cairo.LINE_JOIN_ROUND)
            ctx.move_to(*pts[0])
            for p in pts[1:]:
                ctx.line_to(*p)
            ctx.stroke()
    # Pip runs the outline then hops to the middle
    if t < 3.6:
        px, py = pts[-1]
        dx, dy = verts[k + 1][0] - verts[k][0], verts[k + 1][1] - verts[k][1]
        pip(ctx, px, py, 30, t, look=(dx / 230, dy / 230), squash=0.15, ang=math.atan2(dy, dx),
            a=smooth(seg(t, 0.1, 0.5)))
    else:
        j = seg(t, 3.6, 4.4)
        px = lerp(cx, cx, j)
        py = lerp(cy + s, cy + 10, ease_out(j)) - math.sin(j * math.pi) * 120
        bob = math.sin(t * 2.4) * 8 if j >= 1 else 0
        pip(ctx, px, py + bob, lerp(30, 54, ease_back(j)), t, mood="open" if j < 1 else "smile")
    sparkle_burst(ctx, cx, cy, t, 4.4, 12, 150)
    # Gravi peeks in from the corner
    gx = lerp(-200, 330, ease_out(seg(t, 4.6, 6.4)))
    gravi(ctx, gx, 560 + math.sin(t * 1.5) * 16, 0.0, 170, t, "lav", seed=1)
    tx = lerp(2120, 1610, ease_out(seg(t, 5.0, 6.6)))
    tick(ctx, tx, 560 + abs(math.sin(t * 3)) * -10, 48, t, (t * 0.15) % 1)
    pop_text(ctx, "Gravity, one light-cone at a time", 960, 762, 78, t, 4.3,
             col=PAL["cream"], outline="#120C2A", ow=10)
    a2 = smooth(seg(t, 5.6, 6.4))
    text(ctx, "A friendly tour of a brand-new idea for quantum gravity", 960, 840, 34, PAL["dim"], a2)
    a3 = smooth(seg(t, 6.2, 7.0))
    text(ctx, "Based on  V. Chandrasekaran,  “An algebraic quantization of gravity from the null cone”"
              "  ·  arXiv:2611.34924 (2026)", 960, 900, 22, PAL["dim"], a3 * 0.85, bold=False)


s_title.dur = 9.0
s_title.sfx = [(0.4, "whoosh"), (4.35, "chime"), (4.6, "pop"), (5.0, "pop")]


# ====================================================================== 1. two theories
def s_two(ctx, t):
    # Left: Einstein's gravity
    la = smooth(seg(t, 0.2, 1.0))
    if la > 0:
        def left():
            P = fabric(ctx, 500, 520, 330, 150, t, well=1.0, col="sky", a=0.55, n=13)
            px, py = P(0, 0)
            planet(ctx, px, py - 30, 62, t)
            an = t * 1.6
            mx, my = px + math.cos(an) * 150, py - 30 + math.sin(an) * 44
            pip(ctx, mx, my, 16, t, seed=3, look=(-math.sin(an), 0))
            label(ctx, "Einstein's gravity", 500, 300, 40, PAL["sky"])
            text(ctx, "big · smooth · bendy", 500, 350, 28, PAL["dim"])
        group_alpha(ctx, la, left)
    ra = smooth(seg(t, 5.8, 6.6))
    if ra > 0:
        def right():
            bx, by = 1420, 540
            rrect(ctx, bx - 230, by - 160, 460, 320, 40)
            rgba(ctx, PAL["pink"], 0.08)
            ctx.fill_preserve()
            ctx.set_dash([14, 10])
            rgba(ctx, PAL["pink"], 0.6)
            ctx.set_line_width(3)
            ctx.stroke()
            ctx.set_dash([])
            for i in range(6):
                ox = bx - 150 + (i % 3) * 150
                oy = by - 60 + (i // 3) * 120
                jx = 26 * math.sin(t * 9.1 + i * 2.1) * math.cos(t * 5.3 + i)
                jy = 22 * math.cos(t * 8.3 + i * 1.3) * math.sin(t * 6.1 + i * 0.7)
                glow(ctx, ox, oy, 60, PAL["pink"], 0.32)
                pip(ctx, ox + jx, oy + jy, 15, t * 1.3, seed=i, glow_amt=0.4,
                    mood="open" if i % 2 else "smile")
            label(ctx, "Quantum physics", 1420, 300, 40, PAL["pink"])
            text(ctx, "tiny · jumpy · chancy", 1420, 350, 28, PAL["dim"])
        group_alpha(ctx, ra, right)
    # the clash
    q = pop(t, 8.4, 0.7)
    if q > 0:
        ctx.save()
        ctx.translate(960, 520)
        ctx.scale(max(q, 0.01), max(q, 0.01))
        ctx.rotate(math.sin(t * 5) * 0.06)
        glow(ctx, 0, 0, 120, PAL["gold"], 0.35)
        ctx.arc(0, 0, 66, 0, TAU)
        rgba(ctx, "#2A1C4E")
        ctx.fill_preserve()
        rgba(ctx, PAL["gold"])
        ctx.set_line_width(5)
        ctx.stroke()
        text(ctx, "?!", 4, 0, 70, PAL["gold"])
        ctx.restore()
    caption(ctx, "Physics has two superstar rulebooks. *Einstein's* *gravity* says mass bends space and time.",
            t, 0.3, 5.8)
    caption(ctx, "*Quantum* *physics* runs the tiny, jumpy world. Making gravity quantum is a famous unsolved puzzle.",
            t, 6.0, 11.6)
    expert(ctx, r"Goal: a nonperturbative, background-independent quantization of vacuum general relativity"
                r" on 4D Lorentzian spacetimes.", t, 0.8, 11.6)


s_two.dur = 12.0
s_two.sfx = [(0.3, "pop"), (6.0, "pop"), (8.4, "boing")]


# ====================================================================== 2. old problem
def s_old(ctx, t):
    wob = smooth(seg(t, 9.6, 11.0)) * (1 + 0.3 * math.sin(t * 2))
    P = fabric(ctx, 820, 560, 560, 190, t, wobble=wob, col="lav", a=0.6, n=17, ripple=0.6)
    # lock (frozen stage), pops off when the stage wobbles
    lp = seg(t, 9.6, 10.8)
    lx, ly = 360, 380 - ease_in(lp) * 40 + lp * lp * 500
    la = smooth(seg(t, 0.3, 0.9)) * (1 - smooth(seg(t, 10.2, 10.8)))
    if la > 0:
        ctx.save()
        ctx.translate(lx, ly)
        ctx.rotate(lp * 2.5)
        rgba(ctx, PAL["sky"], la)
        ctx.set_line_width(7)
        ctx.arc(0, -24, 22, TAU / 2, TAU)
        ctx.stroke()
        rrect(ctx, -34, -26, 68, 56, 12)
        ctx.fill()
        rgba(ctx, "#1B1640", la)
        ctx.arc(0, 0, 7, 0, TAU)
        ctx.fill()
        ctx.restore()
        text(ctx, "frozen stage", lx, ly + 58, 26, PAL["sky"], la)
    # ripples on the stage
    for i, (u0, v0, col) in enumerate([(-0.55, 0.3, "lav"), (0.05, -0.2, "pink"), (0.4, 0.45, "lav")]):
        u = u0 + 0.06 * math.sin(t * 0.7 + i)
        x, y = P(u, v0)
        gravi(ctx, x + 40, y - 18, 0.0, 90, t, col, seed=i * 2, thick=8,
              a=smooth(seg(t, 0.8 + i * 0.4, 1.4 + i * 0.4)))
    # magnifier with tinier ripples and infinities
    mp = pop(t, 4.6, 0.7)
    if mp > 0:
        mx, my, mr = 1430, 470, 200 * mp
        ctx.save()
        ctx.arc(mx, my, mr, 0, TAU)
        ctx.clip()
        rgba(ctx, "#1E1546", 0.92)
        ctx.paint()
        for j in range(5):
            yy = my - 130 + j * 65
            for i in range(3):
                xx = mx - 120 + i * 120 + (j % 2) * 50
                gravi(ctx, xx + 30, yy, 0.0, 60, t * 1.6, "pink" if (i + j) % 2 else "lav",
                      seed=i + j * 3, thick=5, speed=14, amp=4)
        ctx.restore()
        rgba(ctx, PAL["cream"], 0.9)
        ctx.set_line_width(10)
        ctx.arc(mx, my, mr, 0, TAU)
        ctx.stroke()
        ctx.set_line_width(18)
        ctx.set_line_cap(cairo.LINE_CAP_ROUND)
        ctx.move_to(mx - mr * 0.72, my + mr * 0.72)
        ctx.line_to(mx - mr * 1.05, my + mr * 1.05)
        ctx.stroke()
        # infinities bubbling out
        for k in range(7):
            t0 = 6.0 + k * 0.5
            p = seg(t, t0, t0 + 2.6)
            if 0 < p < 1:
                bx = mx - 140 + (k * 97) % 300
                by = my - 120 - ease_out(p) * 200
                br = 30 * pop(t, t0, 0.4)
                a = 1 - smooth(seg(p, 0.75, 1))
                ctx.arc(bx, by, br, 0, TAU)
                rgba(ctx, PAL["red"], 0.85 * a)
                ctx.fill()
                text(ctx, "∞", bx, by - 3, 40 * br / 30, "#FFFFFF", a, family="DejaVu Sans")
    caption(ctx, "The usual trick: *freeze* *the* *stage* (space and time), then add tiny gravity ripples on top.",
            t, 0.3, 4.6)
    caption(ctx, "Zoom in to tinier and tinier ripples... and the math explodes into *infinities*.", t, 4.8, 9.4)
    caption(ctx, "Worse: in quantum gravity the stage *itself* should wobble. Nothing can be frozen.", t, 9.6, 13.6)
    expert(ctx, "Perturbative GR about a fixed background is non-renormalizable: two-loop UV divergence needs a "
                r"$\mathrm{Riemann}^3$ counterterm (Goroff$-$Sagnotti)." "\n"
                r"Nonperturbatively, background independence forbids singling out any fixed metric $g_{ab}$.",
           t, 0.6, 13.6)


s_old.dur = 14.0
s_old.sfx = [(4.6, "pop")] + [(6.0 + k * 0.5, "blip") for k in range(7)] + [(9.6, "wobble")]


# ====================================================================== 3. causal diamond
DCX, DCY, DH, DR = 960, 500, 280, 330


def s_diamond(ctx, t):
    cx, cy, h, R = DCX, DCY, DH, DR
    low = smooth(seg(t, 1.4, 4.4))
    up = smooth(seg(t, 5.0, 8.0))
    caps = smooth(seg(t, 13.6, 14.6))
    ia = smooth(seg(t, 9.6, 10.6))
    diamond3d(ctx, cx, cy, h, R, t, low, up, caps=caps, capc=0.14, rot=t * 0.05)
    if ia > 0:  # glow the interior
        ctx.move_to(cx, cy + h)
        ctx.line_to(cx + R, cy)
        ctx.line_to(cx, cy - h)
        ctx.line_to(cx - R, cy)
        ctx.close_path()
        rgba(ctx, "#FFF2B8", 0.07 * ia * (0.8 + 0.2 * math.sin(t * 2)))
        ctx.fill()
    sparkle_burst(ctx, cx + R, cy, t, 8.0, 10, 80)
    sparkle_burst(ctx, cx - R, cy, t, 8.0, 10, 80)
    # start / end events
    pa = pop(t, 0.3)
    if pa > 0 and caps < 1:
        glow(ctx, cx, cy + h, 40 * pa, PAL["gold"], 0.8 * (1 - caps))
        label(ctx, "start", cx + 70, cy + h + 4, 30, PAL["teal"], pa * (1 - caps))
    qa = pop(t, 4.8)
    if qa > 0 and caps < 1:
        glow(ctx, cx, cy - h, 40 * qa, PAL["gold"], 0.8 * (1 - caps))
        label(ctx, "end", cx + 60, cy - h - 4, 30, PAL["coral"], qa * (1 - caps))
    # light runners on the lower cone
    if 1.4 < t < 5.0:
        for i in range(6):
            th = 0.4 + i * TAU / 6 + t * 0.05
            if math.sin(th) > -0.2:
                x, y = gen_point(cx, cy, h, R, th, low)
                pip(ctx, x, y, 9, t, seed=i, glow_amt=0.6, a=1 - smooth(seg(t, 4.4, 5.0)))
    # Pip rides a front generator
    if t < 4.6:
        x, y = gen_point(cx, cy, h, R, 0.9, low)
        pip(ctx, x, y, 26, t, look=(0.5, -1), squash=0.1 * (0 < low < 1), ang=-1.0)
    else:
        x, y = gen_point(cx, cy, h, R, 0.9, 1.0)
        pip(ctx, x, y + math.sin(t * 2.5) * 5, 26, t, look=(-0.6, -0.4), mood="open" if t < 9 else "smile")
    # incoming runners on the upper cone
    if 5.0 < t < 8.6:
        for i in range(6):
            th = 0.2 + i * TAU / 6
            if math.sin(th) > -0.2:
                x, y = gen_point(cx, cy, h, R, th, up, upper=True)
                pip(ctx, x, y, 9, t, seed=i + 7, glow_amt=0.6, a=1 - smooth(seg(t, 8.0, 8.6)))
    # labels
    ca = smooth(seg(t, 8.3, 9.0))
    if ca > 0:
        math_label(ctx, r"$S$", cx - R - 50, cy - 6, 40, PAL["gold"], ca)
        label(ctx, "corner", cx - R - 60, cy + 40, 26, PAL["gold"], ca)
    da = smooth(seg(t, 10.0, 10.8)) * (1 - smooth(seg(t, 13.4, 13.9)))
    label(ctx, "causal diamond", cx, cy - 40, 40, PAL["cream"], da)
    if caps > 0:
        math_label(ctx, r"$\Sigma_0$", cx + 105, cy + h * 0.86, 36, PAL["mint"], caps)
        math_label(ctx, r"$\Sigma_1$", cx + 105, cy - h * 0.86, 36, PAL["mint"], caps)
        na = smooth(seg(t, 14.2, 15.0))
        math_label(ctx, r"$H_p$", cx + R * 0.62 + 70, cy + h * 0.45, 36, PAL["teal"], na)
        math_label(ctx, r"$H_q$", cx + R * 0.62 + 70, cy - h * 0.45, 36, PAL["coral"], na)
        label(ctx, "light wall", cx - R * 0.62 - 110, cy + h * 0.45, 26, PAL["teal"], na)
        label(ctx, "light wall", cx - R * 0.62 - 110, cy - h * 0.45, 26, PAL["coral"], na)
    caption(ctx, "New idea: pick two moments, a *start* and an *end*. Light flashes outward from the start...",
            t, 0.3, 4.6)
    caption(ctx, "...and light that can reach the end streams in from all around. Where they meet: a glowing *corner*.",
            t, 4.8, 9.4)
    caption(ctx, "The overlap is a *causal* *diamond*: everything that can happen between the two moments.",
            t, 9.6, 13.4)
    caption(ctx, "Its walls are made of pure light paths, called *null* *cones*. They're the heroes of this paper.",
            t, 13.6, 17.6)
    expert(ctx, r"Subregion $D$ bounded by intersecting null cones $H_p$, $H_q$ meeting at a spacelike corner $S\cong S^2$;"
                "\n" r"tips excised by small spacelike caps $\Sigma_0,\ \Sigma_1$ on which incoming / outgoing states are prepared.",
           t, 9.8, 17.6)


s_diamond.dur = 18.0
s_diamond.sfx = [(0.3, "pop"), (1.4, "whoosh"), (4.8, "pop"), (5.0, "whoosh"), (8.0, "chime"),
                 (10.0, "pop"), (13.6, "pop")]


# ====================================================================== 4. data on the walls + quantize
def gaussian_bump(ctx, x, y, w, hgt, t, col, a=1.0, ph=0.0):
    wob = 1 + 0.12 * math.sin(t * 3 + ph)
    sig = w * 0.18 * wob
    mu = 8 * math.sin(t * 1.7 + ph)
    ctx.move_to(x - w / 2, y)
    for i in range(61):
        xx = x - w / 2 + w * i / 60
        yy = y - hgt / wob * math.exp(-((xx - x - mu) ** 2) / (2 * sig * sig))
        ctx.line_to(xx, yy)
    ctx.line_to(x + w / 2, y)
    ctx.close_path()
    rgba(ctx, col, 0.35 * a)
    ctx.fill_preserve()
    rgba(ctx, col, a)
    ctx.set_line_width(3.5)
    ctx.stroke()


def s_walls(ctx, t):
    cx, cy, h, R = 600, 520, 250, 270
    diamond3d(ctx, cx, cy, h, R, t, 1, 1, caps=1, capc=0.14, rot=t * 0.05)
    # Gravis surf up the lower wall along generators
    for i, (th, col, ph) in enumerate([(0.55, "lav", 0.0), (1.6, "pink", 0.37), (2.5, "lav", 0.71)]):
        s = 0.34 + 0.6 * ((t * 0.16 + ph) % 1)
        x, y = gen_point(cx, cy, h, R, th, s)
        ex, ey = gen_point(cx, cy, h, R, th, 1)
        ax, ay = cx, cy + h
        ang = math.atan2(ey - ay, ex - ax)
        a = smooth(seg(t, 0.8 + i * 0.4, 1.4 + i * 0.4)) * smooth(clamp((1 - s) * 8))
        gravi(ctx, x, y, ang, 60, t, col, a=a, seed=i * 3, thick=7)
    # corner size + frame (edge modes)
    fa = smooth(seg(t, 5.6, 6.4))
    if fa > 0:
        fx, fy = cx + R, cy
        for (dx, dy, col) in ((46, 0, PAL["red"]), (0, -46, PAL["mint"]), (-26, 22, PAL["sky"])):
            arrow(ctx, fx, fy, fx + dx * fa, fy + dy * fa, col, 1, 4, 13)
        glow(ctx, fx, fy, 20, PAL["gold"], 0.9 * fa)
        label(ctx, "area A", cx, cy + R * 0.26 + 36, 28, PAL["gold"], fa)
    # notebook card
    na = smooth(seg(t, 0.6, 1.3))
    if na > 0:
        def note():
            card(ctx, 1390, 470, 760, 500, 1)
            text(ctx, "Gravity's notes, written on the light wall", 1390, 262, 30, PAL["gold"])
            items = [("ripples sliding along the wall", "lav", 1.6),
                     ("the corner's size (its area)", "gold", 5.6),
                     ("where it is & which way it faces", "sky", 6.6)]
            for k, (s_, col, t0) in enumerate(items):
                p = pop(t, t0, 0.5)
                if p <= 0:
                    continue
                yy = 345 + k * 86
                qa = 1 - smooth(seg(t, 9.6, 10.4))
                ctx.save()
                ctx.translate(1080, yy)
                ctx.scale(max(p, 0.01), max(p, 0.01))
                if k == 0:
                    gravi(ctx, 28, 0, 0, 56, t, "lav", a=qa, thick=6)
                elif k == 1:
                    ctx.new_path()
                    ring_path(ctx, 0, 0, 30, 0.35)
                    rgba(ctx, PAL["gold"], qa)
                    ctx.set_line_width(5)
                    ctx.stroke()
                else:
                    for (dx, dy, c2) in ((26, 0, PAL["red"]), (0, -26, PAL["mint"]), (-15, 13, PAL["sky"])):
                        arrow(ctx, 0, 0, dx, dy, c2, qa, 3.5, 10)
                ctx.restore()
                text(ctx, s_, 1140, yy, 30, PAL["cream"], p * qa, align="left")
            # quantum upgrade
            qp = pop(t, 10.0, 0.7)
            if qp > 0:
                formula(ctx, r"$\{q,p\}=1\quad\longrightarrow\quad[\hat q,\hat p]=i\hbar$", 1390, 360, 46,
                        t, 10.0, PAL["cream"])
                sparkle_burst(ctx, 1390, 360, t, 10.1, 10, 220)
            for k in range(3):
                bp = pop(t, 14.4 + k * 0.35, 0.6)
                if bp > 0:
                    ctx.save()
                    ctx.translate(1180 + k * 210, 600)
                    ctx.scale(max(1, 0.01), max(bp, 0.01))
                    gaussian_bump(ctx, 0, 0, 170, 130, t, [PAL["lav"], PAL["gold"], PAL["sky"]][k], 1, k * 1.7)
                    ctx.restore()
            if t > 14.6:
                text(ctx, "fuzzy waves of possibility", 1390, 650, 26, PAL["dim"], smooth(seg(t, 15.0, 15.6)))
        group_alpha(ctx, na, note)
    caption(ctx, "Here's the trick: everything gravity does inside the diamond is *written* *on* *its* *light* *walls*.",
            t, 0.3, 5.2)
    caption(ctx, "The notes: gravity *ripples* sliding along the walls, plus the corner's *size* and *direction*.",
            t, 5.4, 9.6)
    caption(ctx, "Then the *quantum* *upgrade*: turn those notes into quantum rules, with no frozen stage underneath.",
            t, 9.8, 14.2)
    caption(ctx, "Each note becomes a fuzzy *wave* *of* *possibilities*, so spacetime itself can be uncertain.",
            t, 14.4, 18.6)
    expert(ctx, r"First-order (tetrad) gravity: solve the null constraints on intersecting null cones $\to$ reduced phase space at finite $G_N$"
                "\n" r"(free radiative/shear data along generators + corner data, incl. area and edge modes for position and Lorentz frame).",
           t, 0.6, 9.6)
    expert(ctx, r"Poisson brackets $\to$ commutators; deformations of the reduced action define the algebra of observables."
                "\n" r"Gaussian wavefunctions of canonical pairs build a nonperturbative Hilbert space on which it generates a type I factor.",
           t, 9.8, 18.6)


s_walls.dur = 19.0
s_walls.sfx = [(0.6, "pop"), (1.6, "pop"), (5.6, "pop"), (6.6, "pop"), (10.0, "chime"),
               (14.4, "blip"), (14.75, "blip"), (15.1, "blip")]


# ====================================================================== 5. gravitational clock
def s_clock(ctx, t):
    cx, cy, h, R = 700, 520, 270, 300
    capc = 0.14
    bend = 0.32 * smooth(seg(t, 7.6, 8.6))
    diamond3d(ctx, cx, cy, h, R, t, 1, 1, caps=1, capc=capc, bend=bend, rot=0.0)
    th = 0.75
    # highlighted generator from the cap to S
    s0 = capc
    run1 = smooth(seg(t, 1.2, 4.6))
    run2 = smooth(seg(t, 8.8, 12.0))
    run = run2 if t > 8.8 else run1
    ax, ay = cx, cy + h
    ex, ey = E_PT(cx, cy, R, th, 0.26)
    mx, my = (ax + ex) / 2, (ay + ey) / 2
    bx = mx + (cx - mx) * bend

    def bez(u):
        p0 = (ax, ay)
        p1 = (lerp(ax, bx, 0.7), lerp(ay, my, 0.7))
        p2 = (lerp(ex, bx, 0.6), lerp(ey, my, 0.6))
        p3 = (ex, ey)
        k = 1 - u
        return (k ** 3 * p0[0] + 3 * k * k * u * p1[0] + 3 * k * u * u * p2[0] + u ** 3 * p3[0],
                k ** 3 * p0[1] + 3 * k * k * u * p1[1] + 3 * k * u * u * p2[1] + u ** 3 * p3[1])
    for lw, al in ((14, 0.15), (6, 0.9)):
        rgba(ctx, PAL["gold"], al)
        ctx.set_line_width(lw)
        ctx.set_line_cap(cairo.LINE_CAP_ROUND)
        x0, y0 = bez(s0)
        ctx.move_to(x0, y0)
        for i in range(1, 41):
            ctx.line_to(*bez(lerp(s0, 1, i / 40)))
        ctx.stroke()
    # gravitational ripples squeezing the rays
    for i in range(2):
        p = seg(t, 6.2 + i * 0.5, 9.4 + i * 0.5)
        if 0 < p < 1:
            gx = lerp(cx - 420, cx + 420, p)
            gy = cy + h * 0.45 + (i - 0.5) * 70
            gravi(ctx, gx, gy, 0.0, 120, t, ["lav", "pink"][i], seed=i * 5, thick=10,
                  a=math.sin(p * math.pi) * 1.4 if p < 0.5 else 1 - smooth(seg(p, 0.8, 1)))
    reading = lerp(0, 0.5, run1) if t <= 8.8 else lerp(0, 0.78, run2)
    x, y = bez(lerp(s0, 1, run))
    tick(ctx, x, y - 42, 32, t, reading, seed=4, mood="open" if 0 < run < 1 else "smile")
    # big readout
    ba = pop(t, 0.6, 0.6)
    if ba > 0:
        ctx.save()
        ctx.translate(1450, 470)
        ctx.scale(max(ba, 0.01), max(ba, 0.01))
        tick(ctx, 0, 0, 130, t, reading, seed=4, mood="open" if t > 11.8 else "smile")
        ctx.restore()
        if t > 8.8:
            an = -TAU / 4 + TAU * 0.5
            rgba(ctx, PAL["cream"], 0.45)
            ctx.set_line_width(5)
            ctx.set_dash([8, 8])
            ctx.move_to(1450, 470)
            ctx.line_to(1450 + math.cos(an) * 80, 470 + math.sin(an) * 80)
            ctx.stroke()
            ctx.set_dash([])
        math_label(ctx, r"clock reading $u_*$", 1450, 670, 32, PAL["cream"], ba)
        ra = smooth(seg(t, 11.8, 12.4))
        label(ctx, "more!", 1640, 330, 40, PAL["gold"], ra)
    caption(ctx, "With no frozen stage, how do you tell time? Gravity carries its *own* *clock*. Meet Tick!",
            t, 0.3, 4.8)
    caption(ctx, "Tick measures how far light travels from the *bottom* *cap* up to the *corner*.", t, 5.0, 8.6)
    caption(ctx, "Ripples squeeze light rays together, so Tick reads *more*, even when the corner stays the same size.",
            t, 8.8, 12.6)
    expert(ctx, r"Gravitational clock: affine parameter $u_*$ along an incoming generator from $\Sigma_0$ (normalized there) to $S$."
                "\n" r"Shear focuses generators (Raychaudhuri), raising $u_*$ at fixed corner area $-$ so bounding $u_*$ bounds graviton states.",
           t, 0.6, 12.6)


s_clock.dur = 13.0
s_clock.sfx = [(0.6, "pop"), (1.2, "tick"), (6.2, "whoosh"), (8.8, "tick"), (11.8, "chime")]


# ====================================================================== 6. gluing
def lattice(n=3, cx=960, cy=520, a=118):
    out = []
    for i in range(n):
        for j in range(n):
            out.append((i, j, cx + (i - j) * a, cy + a * (n - 1) - (i + j) * a))
    return out


def s_glue(ctx, t):
    a = 104
    tiles = lattice(3, 960, 450, a)
    for k, (i, j, x, y) in enumerate(tiles):
        t0 = 0.4 + k * 0.32
        p = ease_back(seg(t, t0, t0 + 0.8))
        if p <= 0:
            continue
        sx = lerp([-300, 2200, 960, -300, 2200, 960, -300, 2200, 960][k], x, p)
        sy = lerp([200, 300, 1300, 900, 100, -200, 500, 900, 1300][k], y, p)
        sh = 1 if (t > 5.2 and (i, j) in ((1, 1), (2, 1))) else 0
        tile(ctx, sx, sy, a * clamp(p, 0, 1.1) - 4, t, 1, seed=k, glow_edge=sh * (0.5 + 0.5 * math.sin(t * 4)))
    # shared wall between (1,1) and (2,1): upper-right edge of (1,1)
    _, _, x11, y11 = tiles[1 * 3 + 1]
    wa = smooth(seg(t, 5.4, 6.0))
    if wa > 0:
        p0 = (x11, y11 - a)
        p1 = (x11 + a, y11)
        for lw, al in ((22, 0.15), (8, 0.9)):
            rgba(ctx, PAL["gold"], al * wa)
            ctx.set_line_width(lw)
            ctx.move_to(*p0)
            ctx.line_to(*p1)
            ctx.stroke()
        # beads = intermediate states being summed over
        cols = [PAL["lav"], PAL["pink"], PAL["sky"], PAL["mint"], PAL["gold"], PAL["coral"]]
        for b in range(5):
            u = (b + 0.5) / 5
            bx, by = lerp(p0[0], p1[0], u), lerp(p0[1], p1[1], u)
            ci = int(t * 5 + b * 2) % len(cols)
            r = 11 * pop(t, 5.6 + b * 0.12, 0.4)
            ctx.arc(bx, by, r, 0, TAU)
            rgba(ctx, cols[ci], wa)
            ctx.fill_preserve()
            rgba(ctx, "#FFFFFF", 0.8 * wa)
            ctx.set_line_width(2)
            ctx.stroke()
        bub = pop(t, 6.4, 0.6)
        if bub > 0:
            qx, qy = p1[0] + 150, p0[1] - 30
            ctx.save()
            ctx.translate(qx, qy)
            ctx.scale(max(bub, 0.01), max(bub, 0.01))
            rrect(ctx, -110, -40, 220, 80, 40)
            rgba(ctx, "#1A1238", 0.92)
            ctx.fill_preserve()
            rgba(ctx, PAL["gold"])
            ctx.set_line_width(3)
            ctx.stroke()
            text(ctx, "add up every", 0, -12, 24, PAL["cream"])
            text(ctx, "way to match", 0, 16, 24, PAL["cream"])
            ctx.restore()
    fp = smooth(seg(t, 10.4, 11.0))
    if fp > 0:
        formula(ctx, r"$\sum_\beta\ \langle a|\,U_2\,|e_\beta\rangle\langle e_\beta|\,U_1\,|b\rangle\;=\;\langle a|\,U_2U_1\,|b\rangle$",
                960, 840, 46, t, 10.4, PAL["cream"])
        cp = pop(t, 12.2, 0.6)
        if cp > 0:
            ctx.save()
            ctx.translate(1560, 840)
            ctx.scale(max(cp, 0.01), max(cp, 0.01))
            rrect(ctx, -105, -32, 210, 64, 32)
            rgba(ctx, PAL["mint"], 0.95)
            ctx.fill()
            text(ctx, "finite ✓", 0, 0, 32, PAL["ink"], family="DejaVu Sans")
            ctx.restore()
    caption(ctx, "Now *snap* *diamonds* *together* like tiles to build a bigger chunk of spacetime.", t, 0.3, 5.2)
    caption(ctx, "Where two tiles touch, add up *every* *possible* *way* their shared wall can match.", t, 5.4, 10.2)
    caption(ctx, "That sum stitches together the whole movie of spacetime, and every sum gives a *sensible,* *finite* number.",
            t, 10.4, 15.6, y=980)
    expert(ctx, r"Gluing: identify outgoing and incoming boundaries, matching tetrad and spin connection; summing over a basis of"
                "\n" r"intermediate states composes amplitudes into a Lorentzian path integral. At finite $G_N$ each sum converges absolutely.",
           t, 0.6, 15.6)


s_glue.dur = 16.0
s_glue.sfx = [(0.4 + k * 0.32 + 0.5, "blip") for k in range(9)] + [(5.4, "chime"), (6.4, "pop"),
                                                                   (10.4, "pop"), (12.2, "chime")]


# ====================================================================== 7. graviton pair test
S_TOY = 9.0
_K = np.arange(1, 241)
_Z = np.concatenate([[0], np.cumsum(np.exp(-2j * _K / S_TOY) / _K)])
_HN = np.concatenate([[0], np.cumsum(1.0 / _K)])
# fit the spiral into the right-hand card (x 1060..1740, y 340..680)
_xs, _ys = _Z.real, -_Z.imag
_SP_SC = min(620 / (_xs.max() - _xs.min()), 300 / (_ys.max() - _ys.min()))
_SP_OX = 1400 - (_xs.max() + _xs.min()) / 2 * _SP_SC
_SP_OY = 510 - (_ys.max() + _ys.min()) / 2 * _SP_SC


def s_pair(ctx, t):
    # --- part A: pair pops out of the light wall and back
    aA = 1 - smooth(seg(t, 5.2, 5.9))
    if aA > 0:
        def partA():
            cx, cy, h, R = 960, 500, 230, 280
            diamond3d(ctx, cx, cy, h, R, t, 1, 1, caps=1, capc=0.14)
            ox, oy = gen_point(cx, cy, h, R, 1.57, 0.55)
            p = seg(t, 1.0, 4.4)
            if 0 < p < 1:
                d = math.sin(p * math.pi) * 170
                for sgn, col in ((-1, "lav"), (1, "pink")):
                    gravi(ctx, ox + sgn * d, oy - math.sin(p * math.pi) * 40, 0.0 if sgn > 0 else math.pi,
                          80, t, col, seed=2 + sgn, thick=9, flip=sgn < 0)
            sparkle_burst(ctx, ox, oy, t, 1.0, 8, 70, PAL["pink"])
            sparkle_burst(ctx, ox, oy, t, 4.4, 12, 110)
        group_alpha(ctx, aA, partA)
    # --- part B: old way vs new way
    aB = smooth(seg(t, 5.6, 6.4))
    if aB > 0:
        def partB():
            # left card
            card(ctx, 520, 530, 780, 560, 1, border=PAL["red"])
            text(ctx, "Old way: shrink gravity's strength first", 520, 290, 30, PAL["red"])
            gx0, gy0, gw, gh = 190, 760, 640, 400
            rgba(ctx, PAL["dim"], 0.6)
            ctx.set_line_width(2.5)
            ctx.move_to(gx0, gy0 - gh)
            ctx.line_to(gx0, gy0)
            ctx.line_to(gx0 + gw, gy0)
            ctx.stroke()
            text(ctx, "tinier and tinier ripple pairs", gx0 + gw / 2, gy0 + 28, 22, PAL["dim"])
            nmax = 240
            prog = smooth(seg(t, 6.6, 12.6))
            n = max(1, int(prog * nmax))
            ymax = 7.0
            ctx.move_to(gx0, gy0)
            for k in range(1, n + 1):
                x = gx0 + gw * (k / nmax) ** 0.5
                y = gy0 - gh * 0.92 * _HN[k] / ymax
                ctx.line_to(x, y)
            rgba(ctx, PAL["red"])
            ctx.set_line_width(5)
            ctx.stroke()
            hx = gx0 + gw * (n / nmax) ** 0.5
            hy = gy0 - gh * 0.92 * _HN[n] / ymax
            glow(ctx, hx, hy, 30, PAL["red"], 0.6)
            math_label(ctx, r"$1+\frac{1}{2}+\frac{1}{3}+\cdots$", gx0 + 190, gy0 - gh + 30, 34, PAL["cream"])
            ia = pop(t, 11.0, 0.6)
            if ia > 0:
                ctx.save()
                ctx.translate(hx + 30, hy - 70)
                ctx.scale(max(ia, 0.01), max(ia, 0.01))
                ctx.rotate(math.sin(t * 6) * 0.1)
                ctx.arc(0, 0, 40, 0, TAU)
                rgba(ctx, PAL["red"])
                ctx.fill()
                text(ctx, "∞", 0, -4, 52, "#FFFFFF", family="DejaVu Sans")
                ctx.restore()
            # right card
            card(ctx, 1400, 530, 780, 560, 1, border=PAL["mint"])
            text(ctx, "New way: keep gravity's real strength", 1400, 290, 30, PAL["mint"])
            prog2 = smooth(seg(t, 7.4, 13.0))
            m = max(1, int(prog2 * 240))
            zs = _Z[:m + 1]
            sc, ox, oy = _SP_SC, _SP_OX, _SP_OY
            for k in range(min(m, 30)):
                x0_, y0_ = ox + zs[k].real * sc, oy - zs[k].imag * sc
                x1_, y1_ = ox + zs[k + 1].real * sc, oy - zs[k + 1].imag * sc
                hue = mix(PAL["sky"], PAL["lav"], k / 30)
                arrow(ctx, x0_, y0_, x1_, y1_, hue, 1, 5 * (1 - k / 45), 16 * (1 - k / 40))
            if m > 30:
                ctx.move_to(ox + zs[30].real * sc, oy - zs[30].imag * sc)
                for k in range(31, m + 1):
                    ctx.line_to(ox + zs[k].real * sc, oy - zs[k].imag * sc)
                rgba(ctx, PAL["lav"], 0.9)
                ctx.set_line_width(2.5)
                ctx.stroke()
            ctx.arc(ox, oy, 6, 0, TAU)
            rgba(ctx, PAL["sky"])
            ctx.fill()
            ex, ey = ox + zs[m].real * sc, oy - zs[m].imag * sc
            glow(ctx, ex, ey, 34, PAL["gold"], 0.8)
            ctx.arc(ex, ey, 8, 0, TAU)
            rgba(ctx, PAL["gold"])
            ctx.fill()
            fa = pop(t, 12.6, 0.6)
            if fa > 0:
                ctx.save()
                ctx.translate(1400, 728)
                ctx.scale(max(fa, 0.01), max(fa, 0.01))
                rrect(ctx, -150, -34, 300, 68, 34)
                rgba(ctx, PAL["mint"], 0.95)
                ctx.fill()
                text(ctx, "settles: finite!", 0, 0, 32, PAL["ink"])
                ctx.restore()
            text(ctx, "toy picture: each pair gets a twist", 1400, 785, 21, PAL["dim"], bold=False)
        group_alpha(ctx, aB, partB)
    caption(ctx, "Test drive! A pair of gravity ripples pops out of the light wall... then vanishes again.",
            t, 0.3, 5.4)
    caption(ctx, "The old way adds up tinier and tinier ripple pairs *forever*. The total climbs to infinity.",
            t, 5.6, 11.4)
    caption(ctx, "Keep gravity's real strength, and the tiniest ripples *twist* *and* *cancel*. The total settles: *finite!*",
            t, 11.6, 17.6)
    expert(ctx, r"Graviton pair creation/annihilation on a null cone, summed nonperturbatively in $G_N$: finite closed form."
                "\n" r"Modes with $k\sim s=A/4G_N\hbar$ acquire $O(1)$ phases $e^{-2ik/s}$, turning the $\log N$ divergence of the"
                r" $G_N$-expansion into $-i\,\log s/s^3$.",
           t, 0.6, 17.6)


s_pair.dur = 18.0
s_pair.sfx = [(1.0, "pop"), (4.4, "chime"), (5.6, "whoosh"), (11.0, "boing"), (12.6, "chime")]


# ====================================================================== 8. finite room
def s_finite(ctx, t):
    # diamond with a max-size ruler
    cx, cy, h, R = 400, 500, 220, 230
    diamond3d(ctx, cx, cy, h, R, t, 1, 1, caps=1, capc=0.14)
    ra = smooth(seg(t, 0.6, 1.2))
    rx = cx + R + 50
    for lw, col in ((5, PAL["gold"]),):
        rgba(ctx, col, ra)
        ctx.set_line_width(lw)
        ctx.move_to(rx, cy - h)
        ctx.line_to(rx, cy + h)
        ctx.stroke()
        for yy in (cy - h, cy + h):
            ctx.move_to(rx - 14, yy)
            ctx.line_to(rx + 14, yy)
            ctx.stroke()
    label(ctx, "max size", rx, cy - h - 34, 26, PAL["gold"], ra)
    # the jar of states
    jx, jy, jw, jh = 980, 530, 320, 400
    ja = smooth(seg(t, 0.8, 1.4))
    if ja > 0:
        rrect(ctx, jx - jw / 2, jy - jh / 2, jw, jh, 50)
        rgba(ctx, "#FFFFFF", 0.07 * ja)
        ctx.fill_preserve()
        rgba(ctx, PAL["cream"], 0.7 * ja)
        ctx.set_line_width(4)
        ctx.stroke()
        rgba(ctx, "#FFFFFF", 0.25 * ja)
        ctx.set_line_width(10)
        ctx.set_line_cap(cairo.LINE_CAP_ROUND)
        ctx.move_to(jx - jw / 2 + 30, jy - jh / 2 + 70)
        ctx.line_to(jx - jw / 2 + 30, jy + jh / 2 - 120)
        ctx.stroke()
        cols = [PAL["lav"], PAL["pink"], PAL["sky"], PAL["mint"], PAL["gold"], PAL["coral"]]
        n = 0
        for row in range(6):
            for col in range(5):
                k = row * 5 + col
                t0 = 1.6 + k * 0.17
                p = seg(t, t0, t0 + 0.45)
                if p <= 0:
                    continue
                n += 1
                bx = jx - jw / 2 + 52 + col * 54
                by_end = jy + jh / 2 - 40 - row * 56
                by = lerp(jy - jh / 2 - 120, by_end, ease_out(p) if p < 1 else 1)
                sq = 1 + 0.25 * math.sin(clamp((p - 0.7) / 0.3) * math.pi)
                ctx.save()
                ctx.translate(bx, by)
                ctx.scale(sq, 1 / sq)
                ctx.arc(0, 0, 22, 0, TAU)
                rgba(ctx, cols[(k * 7) % 6], ja)
                ctx.fill()
                ctx.arc(-7, -8, 6, 0, TAU)
                rgba(ctx, "#FFFFFF", 0.5 * ja)
                ctx.fill()
                ctx.restore()
        # lid
        lp = ease_back(seg(t, 7.0, 7.6))
        if lp > 0:
            ly = lerp(jy - jh / 2 - 200, jy - jh / 2 - 10, lp)
            rrect(ctx, jx - jw / 2 - 18, ly - 22, jw + 36, 40, 18)
            rgba(ctx, PAL["lav_d"])
            ctx.fill()
        st = pop(t, 7.7, 0.5)
        if st > 0:
            ctx.save()
            ctx.translate(jx + 100, jy - 150)
            ctx.rotate(-0.18)
            ctx.scale(max(st * 1.0, 0.01), max(st * 1.0, 0.01))
            rrect(ctx, -110, -38, 220, 76, 20)
            rgba(ctx, PAL["coral"])
            ctx.fill()
            text(ctx, "FULL!", 0, 0, 44, "#FFFFFF")
            ctx.restore()
    # area ladder
    lx, ly0, lh = 1540, 760, 520
    la = smooth(seg(t, 6.8, 7.4))
    if la > 0:
        rgba(ctx, PAL["sky"], la)
        ctx.set_line_width(8)
        ctx.set_line_cap(cairo.LINE_CAP_ROUND)
        for sx in (-90, 90):
            ctx.move_to(lx + sx, ly0)
            ctx.line_to(lx + sx, ly0 - lh)
            ctx.stroke()
        rungs = 6
        for i in range(rungs):
            yy = ly0 - 40 - i * 82
            ctx.move_to(lx - 90, yy)
            ctx.line_to(lx + 90, yy)
            ctx.stroke()
            math_label(ctx, r"$A_{%d}$" % (i + 1), lx + 140, yy, 30, PAL["cream"], la)
        label(ctx, "area", lx, ly0 - lh - 30, 30, PAL["sky"], la)
        hop = clamp((t - 8.0) / 0.75, 0, 4.999)
        i0 = int(hop)
        fr = hop - i0
        y_a = ly0 - 40 - i0 * 82
        y_b = ly0 - 40 - (i0 + 1) * 82
        e = smooth(fr)
        py = lerp(y_a, y_b, e) - math.sin(fr * math.pi) * 60 - 30
        pip(ctx, lx, py, 26, t, mood="open" if 0.05 < fr < 0.95 else "smile",
            squash=0.12 * math.sin(fr * math.pi), ang=-TAU / 4, a=la)
    caption(ctx, "Big surprise: a diamond of a given size can only hold a *limited* *number* of quantum states. The jar fills up!",
            t, 0.3, 6.6)
    caption(ctx, "So its area can't take just any value: it comes in *steps,* like rungs on a ladder.", t, 6.8, 12.6)
    expert(ctx, r"Bounding the clock reading by the maximum size $\ell(D)$ restricts graviton states: $\dim\mathcal{H}_D<\infty$ for a"
                "\n" r"macroscopic causal diamond, so its area operator has a discrete spectrum (unlike the infinite-dimensional JT case).",
           t, 0.6, 12.6)


s_finite.dur = 13.0
s_finite.sfx = [(1.6 + k * 0.17 + 0.4, "tink") for k in range(30)] + [(7.0, "thud"), (7.7, "boing")] + \
               [(8.0 + k * 0.75 + 0.6, "hop") for k in range(5)]


# ====================================================================== 9. black hole entropy
def s_bh(ctx, t):
    hx, hy, hr = 600, 500, 190
    awake = 1.0 if t > 12.0 else 0.0
    yb = hy + math.sin(t * 1.2) * 8
    cnt = seg(t, 5.8, 10.0)

    def inner(r):
        # patches of horizon area being counted, drawn under the face
        if cnt <= 0:
            return
        ctx.save()
        ctx.arc(0, 0, r - 2, 0, TAU)
        ctx.clip()
        n = 9
        step = 2 * r / n
        order = 0
        for j in range(n):
            for i in range(n):
                x = -r + (i + 0.5) * step
                y = -r + (j + 0.5) * step
                if math.hypot(x, y) > r:
                    continue
                order += 1
                on = clamp(cnt * 70 - order)
                if on > 0:
                    rrect(ctx, x - step / 2 + 3, y - step / 2 + 3, step - 6, step - 6, 8)
                    rgba(ctx, PAL["lav"], 0.22 * on)
                    ctx.fill_preserve()
                    rgba(ctx, PAL["gold"], 0.45 * on)
                    ctx.set_line_width(1.5)
                    ctx.stroke()
        ctx.restore()

    hush(ctx, hx, yb, hr, t, a=smooth(seg(t, 0.2, 0.9)), awake=awake, inner=inner)
    # horizon = corner where light barely hovers
    ha = smooth(seg(t, 1.6, 2.4))
    if ha > 0:
        for lw, al in ((24, 0.12), (10, 0.3), (4, 1)):
            rgba(ctx, PAL["gold"], al * ha)
            ctx.set_line_width(lw)
            ctx.arc(hx, yb, hr + 14, 0, TAU)
            ctx.stroke()
        for i in range(5):
            an = i * TAU / 5 + t * 0.15
            pip(ctx, hx + math.cos(an) * (hr + 14), yb + math.sin(an) * (hr + 14), 11, t, seed=i,
                glow_amt=0.5, a=ha)
    # formulas
    formula(ctx, r"$S\;=\;\frac{A}{4G\hbar}$", 1180, 380, 64, t, 6.4, PAL["cream"], anchor="left")
    la = smooth(seg(t, 7.0, 7.6))
    text(ctx, "Bekenstein–Hawking entropy", 1180, 480, 26, PAL["dim"], la, align="left")
    if t > 11.4:
        formula(ctx, r"$+\;\frac{106}{45}\,\log\frac{A}{4G\hbar}$", 1430, 380, 64, t, 11.6, PAL["gold"], anchor="left")
        sparkle_burst(ctx, 1600, 380, t, 11.7, 10, 160)
    rp = smooth(seg(t, 13.0, 13.8))
    if rp > 0:
        def routes():
            y = 660
            for k, (s1, col) in enumerate([("this paper: real-time light cones", PAL["teal"]),
                                           ("Sen (2013): imaginary-time route", PAL["coral"])]):
                yy = y + k * 90
                rrect(ctx, 1010, yy - 30, 470, 60, 30)
                rgba(ctx, col, 0.2)
                ctx.fill_preserve()
                rgba(ctx, col, 0.9)
                ctx.set_line_width(2.5)
                ctx.stroke()
                text(ctx, s1, 1245, yy, 24, PAL["cream"])
                arrow(ctx, 1490, yy, 1610, y + 45, col, 1, 4, 14)
            cp = pop(t, 14.2, 0.6)
            if cp < 0.01:
                return
            ctx.save()
            ctx.translate(1700, y + 45)
            ctx.scale(max(cp, 0.01), max(cp, 0.01))
            ctx.arc(0, 0, 70, 0, TAU)
            rgba(ctx, PAL["mint"])
            ctx.fill()
            math_label(ctx, r"$\frac{106}{45}$", 0, -10, 40, PAL["ink"])
            text(ctx, "✓ match", 0, 38, 20, PAL["ink"], family="DejaVu Sans")
            ctx.restore()
        group_alpha(ctx, rp, routes)
    caption(ctx, "Now aim this at a *black* *hole*. Its edge is a corner where outgoing light can only hover in place.",
            t, 0.3, 5.6)
    caption(ctx, "Counting the quantum states there gives the famous *black* *hole* *entropy*: a quarter of its area (in Planck units).",
            t, 5.8, 11.2)
    caption(ctx, "It even nails the tiny *correction* found earlier by a totally different method. Two routes, one answer!",
            t, 11.4, 17.6)
    expert(ctx, r"Lorentzian trace over interior states at a marginally trapped corner: $S(\rho_D)=\langle A\rangle/4G_N\hbar+\log Z_{D,1}$;"
                "\n" r"large Schwarzschild at fixed mass: one-loop coefficient $106/45$ of $\log(A/4G_N\hbar)$, matching Sen's Euclidean result.",
           t, 0.6, 17.6)


s_bh.dur = 18.0
s_bh.sfx = [(0.2, "whoosh"), (1.6, "chime"), (6.4, "pop"), (11.6, "chime"), (13.0, "pop"), (14.2, "boing")]


# ====================================================================== 10. Einstein returns
def s_einstein(ctx, t):
    z = smooth(seg(t, 0.3, 3.4))
    ta = 1 - smooth(seg(t, 2.4, 3.8))
    if ta > 0:
        a = 104 * (22 / 104) ** z          # exponential zoom feels like a camera pull-back
        n = 15
        c = (n - 1) / 2
        reach = 1 + 6.5 * z                # how many rings of tiles are revealed
        for i in range(n):
            for j in range(n):
                d = max(abs(i - c), abs(j - c))
                ra = clamp(reach - d + 1)
                if ra <= 0:
                    continue
                x = 960 + (i - j) * a
                y = 520 - ((i + j) - (n - 1)) * a
                edge = clamp((700 - abs(x - 960)) / 160) * clamp((310 - abs(y - 520)) / 90)
                al = ta * ra * edge
                if al > 0.01:
                    tile(ctx, x, y, a - 3 * (a / 104) ** 0.5, t, al, seed=i * n + j, eyes=a > 45)
    fa = smooth(seg(t, 2.2, 4.0))
    if fa > 0:
        def smoothworld():
            P = fabric(ctx, 960, 600, 620, 200, t, well=1.0, col="sky", a=0.6, n=17)
            px, py = P(0, 0)
            planet(ctx, px, py - 34, 70, t)
            an = t * 1.4
            pip(ctx, px + math.cos(an) * 190, py - 34 + math.sin(an) * 56, 18, t, seed=2)
        group_alpha(ctx, fa, smoothworld)
    formula(ctx, r"$E_{ab}[\bar g]\;+\;\langle E^{(2)}_{ab}[h,h]\rangle\;=\;O(\hbar^2)$", 960, 300, 60, t, 5.6, PAL["cream"])
    la = smooth(seg(t, 6.4, 7.0))
    if la > 0:
        text(ctx, "Einstein's equation", 760, 380, 26, PAL["sky"], la)
        text(ctx, "+ first quantum nudge", 1130, 380, 26, PAL["gold"], la)
    caption(ctx, "Zoom way out, and the tiny tiles blur into smooth, bendy spacetime...", t, 0.3, 5.4)
    caption(ctx, "...and *Einstein's* *equations* come right back, plus their first quantum correction.", t, 5.6, 10.6)
    expert(ctx, r"Low-energy limit: the semiclassical Einstein equations through one loop for coherent incoming states;"
                "\n" r"the one-loop generating functional agrees with that of constrained general relativity.",
           t, 0.6, 10.6)


s_einstein.dur = 11.0
s_einstein.sfx = [(0.2, "whoosh"), (5.6, "chime")]


# ====================================================================== 11. recap
def icon(ctx, k, t):
    if k == 0:
        diamond3d(ctx, 0, 0, 70, 80, t, 1, 1)
    elif k == 1:
        gaussian_bump(ctx, 0, 40, 160, 100, t, PAL["lav"])
    elif k == 2:
        for (i, j, x, y) in lattice(2, 0, -25, 42):
            tile(ctx, x, y, 40, t, 1, seed=i + j, eyes=True)
    else:
        hush(ctx, 0, 0, 52, t, awake=1)


def s_recap(ctx, t):
    out = 1 - smooth(seg(t, 9.6, 10.4))
    pop_text(ctx, "In a nutshell", 960, 190, 64, t, 0.2, outline="#120C2A", ow=9, a=out)
    items = [("Chop spacetime", "into light-walled", "diamonds"),
             ("Turn gravity's", "wall-notes into", "quantum rules"),
             ("Glue the tiles:", "every sum stays", "finite"),
             ("Out pop black hole", "entropy and", "Einstein's laws")]
    for k, lines in enumerate(items):
        p = pop(t, 0.8 + k * 0.9, 0.6) * out
        if p <= 0:
            continue
        x = 300 + k * 440
        ctx.save()
        ctx.translate(x, 540)
        ctx.scale(max(p, 0.01), max(p, 0.01))
        card(ctx, 0, 0, 380, 440, 1)
        ctx.arc(-150, -180, 32, 0, TAU)
        rgba(ctx, PAL["gold"])
        ctx.fill()
        text(ctx, str(k + 1), -150, -180, 36, PAL["ink"])
        ctx.save()
        ctx.translate(0, -70)
        icon(ctx, k, t)
        ctx.restore()
        for i, ln in enumerate(lines):
            text(ctx, ln, 0, 80 + i * 44, 32, PAL["cream"] if i < 2 else PAL["gold"])
        ctx.restore()
    caption(ctx, "A bold new proposal (Nov 2026). Like every quantum gravity idea, it still needs *independent* *checks*.",
            t, 5.0, 10.0)
    # end card
    ea = smooth(seg(t, 10.4, 11.2))
    if ea > 0:
        def endcard():
            bob = math.sin(t * 2.5) * 10
            pip(ctx, 560, 470 + bob, 54, t, mood="open")
            gravi(ctx, 830, 480 - bob, 0.0, 150, t, "lav", seed=1, thick=14)
            tick(ctx, 1040, 470 + bob, 62, t, (t * 0.2) % 1)
            hush(ctx, 1350, 470 - bob, 80, t, awake=1)
            text(ctx, "Thanks for watching!", 960, 690, 60, PAL["cream"], outline="#120C2A", ow=9)
            text(ctx, "Paper: V. Chandrasekaran, “An algebraic quantization of gravity from the null cone”,"
                      " arXiv:2611.34924", 960, 770, 24, PAL["dim"], bold=False)
            text(ctx, "Animated entirely in Python (pycairo + numpy)", 960, 812, 22, PAL["dim"], 0.8, bold=False)
        group_alpha(ctx, ea, endcard)


s_recap.dur = 16.0
s_recap.sfx = [(0.2, "whoosh")] + [(0.8 + k * 0.9, "pop") for k in range(4)] + [(10.4, "chime")]


SCENES = [s_title, s_two, s_old, s_diamond, s_walls, s_clock, s_glue, s_pair, s_finite, s_bh,
          s_einstein, s_recap]
XF = 0.5  # crossfade seconds

STARTS = []
_acc = 0.0
for sc in SCENES:
    STARTS.append(_acc)
    _acc += sc.dur
TOTAL = _acc
for st, sc in zip(STARTS, SCENES):
    for (lt, kind) in getattr(sc, "sfx", []):
        SFX.append((st + lt, kind))


def render_frame(ctx, t):
    background(ctx, t)
    for st, sc in zip(STARTS, SCENES):
        lt = t - st
        if -XF <= lt <= sc.dur:
            a_in = 1.0 if st == 0 else smooth(seg(lt, 0, XF))
            a_out = 1.0 - smooth(seg(lt, sc.dur - XF, sc.dur))
            a = a_in * a_out
            if a > 0 and lt >= 0:
                group_alpha(ctx, a, sc, ctx, lt)
    # global fade in/out
    fin = smooth(seg(t, 0, 0.6))
    fout = 1 - smooth(seg(t, TOTAL - 1.2, TOTAL))
    k = fin * fout
    if k < 1:
        rgba(ctx, "#000000", 1 - k)
        ctx.paint()
