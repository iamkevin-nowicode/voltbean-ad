"""
Tiny 2D animation engine on top of pycairo.

Everything is a pure function of time t (seconds) -> deterministic frames.
Holds: easing, colors, text, math formulas (via matplotlib mathtext),
background, and the cast of characters.
"""
import io
import math
import functools

import cairo
import numpy as np

W, H = 1920, 1080
FPS = 60
TAU = math.tau

# ----------------------------------------------------------------- easing
def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def lerp(a, b, t):
    return a + (b - a) * t


def seg(t, a, b):
    """0..1 progress of t through [a, b]."""
    if b <= a:
        return 1.0 if t >= a else 0.0
    return clamp((t - a) / (b - a))


def smooth(t):
    t = clamp(t)
    return t * t * t * (t * (6 * t - 15) + 10)  # smootherstep


def ease_out(t):
    t = clamp(t)
    return 1 - (1 - t) ** 3


def ease_in(t):
    t = clamp(t)
    return t ** 3


def ease_back(t, s=1.6):
    t = clamp(t)
    c3 = s + 1
    return 1 + c3 * (t - 1) ** 3 + s * (t - 1) ** 2


def ease_elastic(t):
    t = clamp(t)
    if t in (0.0, 1.0):
        return t
    return 2 ** (-10 * t) * math.sin((t * 10 - 0.75) * (TAU / 3)) + 1


def pop(t, a, d=0.55):
    """Springy 0->1 'pop in' starting at a."""
    return ease_back(seg(t, a, a + d))


def fade(t, a, b, fin=0.45, fout=0.45):
    """Visibility envelope for something living in [a, b]."""
    if t < a or t > b:
        return 0.0
    return smooth(seg(t, a, a + fin)) * (1 - smooth(seg(t, b - fout, b)))


# ----------------------------------------------------------------- color
@functools.lru_cache(None)
def C(hexs):
    hexs = hexs.lstrip("#")
    return tuple(int(hexs[i:i + 2], 16) / 255 for i in (0, 2, 4))


def rgba(ctx, col, a=1.0):
    if isinstance(col, str):
        col = C(col)
    ctx.set_source_rgba(col[0], col[1], col[2], a)


def mix(c1, c2, t):
    c1 = C(c1) if isinstance(c1, str) else c1
    c2 = C(c2) if isinstance(c2, str) else c2
    return tuple(lerp(a, b, t) for a, b in zip(c1, c2))


PAL = dict(
    bg_top="#17133A", bg_bot="#38204F",
    cream="#FFF4E6", ink="#2B1D3F", dim="#B9AEDB",
    gold="#FFD66B", gold_d="#E5A43A",
    teal="#5ED6C8", teal_d="#2C9C9A",
    coral="#FF8FA3", coral_d="#D9607A",
    lav="#C7A6FF", lav_d="#8C67D9",
    pink="#FF9ED8", pink_d="#D768AE",
    mint="#94E8BE", mint_d="#47B387",
    sky="#8FD3FF", sky_d="#4A9BD6",
    red="#FF7A7A",
)

# ----------------------------------------------------------------- shapes
def rrect(ctx, x, y, w, h, r):
    r = min(r, w / 2, h / 2)
    ctx.new_sub_path()
    ctx.arc(x + w - r, y + r, r, -TAU / 4, 0)
    ctx.arc(x + w - r, y + h - r, r, 0, TAU / 4)
    ctx.arc(x + r, y + h - r, r, TAU / 4, TAU / 2)
    ctx.arc(x + r, y + r, r, TAU / 2, 3 * TAU / 4)
    ctx.close_path()


def ellipse(ctx, x, y, rx, ry):
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(max(rx, 1e-4), max(ry, 1e-4))
    ctx.new_sub_path()
    ctx.arc(0, 0, 1, 0, TAU)
    ctx.restore()


def glow(ctx, x, y, r, col, a=0.5):
    col = C(col) if isinstance(col, str) else col
    g = cairo.RadialGradient(x, y, 0, x, y, r)
    g.add_color_stop_rgba(0, *col, a)
    g.add_color_stop_rgba(0.35, *col, a * 0.45)
    g.add_color_stop_rgba(1, *col, 0)
    ctx.set_source(g)
    ctx.arc(x, y, r, 0, TAU)
    ctx.fill()


def shadow(ctx, x, y, rx, ry, a=0.3):
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(1, ry / rx)
    g = cairo.RadialGradient(0, 0, 0, 0, 0, rx)
    g.add_color_stop_rgba(0, 0.05, 0.02, 0.12, a)
    g.add_color_stop_rgba(1, 0.05, 0.02, 0.12, 0)
    ctx.set_source(g)
    ctx.arc(0, 0, rx, 0, TAU)
    ctx.fill()
    ctx.restore()


def sparkle(ctx, x, y, r, col="#FFF4E6", a=1.0, rot=0.0):
    """4-point twinkle star."""
    if r <= 0.2 or a <= 0:
        return
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rot)
    rgba(ctx, col, a)
    ctx.move_to(0, -r)
    for i in range(4):
        ang = -TAU / 4 + i * TAU / 4
        mid = ang + TAU / 8
        cx_, cy_ = r * 0.14 * math.cos(mid), r * 0.14 * math.sin(mid)
        nx, ny = r * math.cos(ang + TAU / 4), r * math.sin(ang + TAU / 4)
        ctx.curve_to(cx_, cy_, cx_, cy_, nx, ny)
    ctx.close_path()
    ctx.fill()
    ctx.restore()


def arrow(ctx, x0, y0, x1, y1, col, a=1.0, w=4, head=14):
    rgba(ctx, col, a)
    ctx.set_line_width(w)
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    ang = math.atan2(y1 - y0, x1 - x0)
    L = math.hypot(x1 - x0, y1 - y0)
    hd = min(head, L * 0.45)
    ctx.move_to(x0, y0)
    ctx.line_to(x1 - math.cos(ang) * hd * 0.6, y1 - math.sin(ang) * hd * 0.6)
    ctx.stroke()
    ctx.move_to(x1, y1)
    ctx.line_to(x1 - hd * math.cos(ang - 0.45), y1 - hd * math.sin(ang - 0.45))
    ctx.line_to(x1 - hd * math.cos(ang + 0.45), y1 - hd * math.sin(ang + 0.45))
    ctx.close_path()
    ctx.fill()


def group_alpha(ctx, a, fn, *args, **kw):
    """Draw fn() into a layer and composite it with opacity a."""
    if a <= 0.001:
        return
    if a >= 0.999:
        fn(*args, **kw)
        return
    ctx.push_group()
    fn(*args, **kw)
    ctx.pop_group_to_source()
    ctx.paint_with_alpha(a)


# ----------------------------------------------------------------- text
FONT = "Quicksand"
_FO = cairo.FontOptions()
_FO.set_antialias(cairo.ANTIALIAS_GRAY)
_FO.set_hint_style(cairo.HINT_STYLE_NONE)
_FO.set_hint_metrics(cairo.HINT_METRICS_OFF)


def set_font(ctx, size, bold=True, family=FONT):
    ctx.select_font_face(family, cairo.FONT_SLANT_NORMAL,
                         cairo.FONT_WEIGHT_BOLD if bold else cairo.FONT_WEIGHT_NORMAL)
    ctx.set_font_size(size)
    ctx.set_font_options(_FO)


def text_w(ctx, s, size, bold=True, family=FONT):
    set_font(ctx, size, bold, family)
    return ctx.text_extents(s).x_advance


def text(ctx, s, x, y, size, col="#FFF4E6", a=1.0, align="center", bold=True,
         family=FONT, outline=None, ow=6):
    """y is the visual middle of the text line."""
    if a <= 0:
        return
    set_font(ctx, size, bold, family)
    ext = ctx.text_extents(s)
    if align == "center":
        x0 = x - ext.x_advance / 2
    elif align == "right":
        x0 = x - ext.x_advance
    else:
        x0 = x
    y0 = y + size * 0.36
    if outline:
        ctx.move_to(x0, y0)
        ctx.text_path(s)
        rgba(ctx, outline, a)
        ctx.set_line_width(ow)
        ctx.set_line_join(cairo.LINE_JOIN_ROUND)
        ctx.stroke()
    ctx.move_to(x0, y0)
    rgba(ctx, col, a)
    ctx.show_text(s)


def pop_text(ctx, s, x, y, size, t, t0, col="#FFF4E6", a=1.0, outline=None, ow=8,
             stagger=0.035, bold=True):
    """Letters bounce in one by one (centered)."""
    set_font(ctx, size, bold)
    total = ctx.text_extents(s).x_advance
    cx = x - total / 2
    for i, ch in enumerate(s):
        adv = text_w(ctx, ch, size, bold)
        p = pop(t, t0 + i * stagger, 0.5)
        if p > 0.001 and ch != " ":
            ctx.save()
            ctx.translate(cx + adv / 2, y + (1 - p) * 30)
            ctx.scale(max(p, 0.001), max(p, 0.001))
            text(ctx, ch, 0, 0, size, col, a * clamp(p * 1.4), outline=outline, ow=ow, bold=bold)
            ctx.restore()
        cx += adv


def wrap_words(ctx, words, size, maxw):
    lines, cur, curw = [], [], 0
    sp = text_w(ctx, " ", size)
    for wd in words:
        ww = text_w(ctx, wd[0], size)
        if cur and curw + sp + ww > maxw:
            lines.append(cur)
            cur, curw = [], 0
        curw += (sp if cur else 0) + ww
        cur.append(wd)
    if cur:
        lines.append(cur)
    return lines


def caption(ctx, s, t, t0, t1, y=968, size=44, maxw=1560):
    """Novice-friendly caption: words drift in one by one. *word* = highlighted."""
    env = fade(t, t0, t1, 0.35, 0.35)
    if env <= 0:
        return
    words = []
    for raw in s.split():
        hl = raw.startswith("*")
        words.append((raw.replace("*", ""), hl))
    lines = wrap_words(ctx, words, size, maxw)
    lh = size * 1.32
    sp = text_w(ctx, " ", size)
    block_h = lh * len(lines)
    widths = [sum(text_w(ctx, w[0], size) for w in ln) + sp * (len(ln) - 1) for ln in lines]
    bw = max(widths) + 80
    ytop = y - block_h / 2
    # soft backdrop
    rrect(ctx, W / 2 - bw / 2, ytop - 18, bw, block_h + 36, 30)
    rgba(ctx, "#120C2A", 0.55 * env)
    ctx.fill()
    k = 0
    for li, ln in enumerate(lines):
        x = W / 2 - widths[li] / 2
        ly = ytop + lh * (li + 0.5)
        for wd, hl in ln:
            ww = text_w(ctx, wd, size)
            p = ease_out(seg(t, t0 + 0.05 + k * 0.045, t0 + 0.45 + k * 0.045))
            col = PAL["gold"] if hl else PAL["cream"]
            text(ctx, wd, x, ly + (1 - p) * 16, size, col, env * p, align="left")
            x += ww + sp
            k += 1


# ----------------------------------------------------------------- math (matplotlib mathtext)
_MPL = None


def _mpl():
    global _MPL
    if _MPL is None:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        matplotlib.rcParams["font.family"] = "Inter"
        matplotlib.rcParams["mathtext.fontset"] = "cm"
        _MPL = plt
    return _MPL


@functools.lru_cache(None)
def math_img(s, size=40, col="#FFF4E6", fontset="cm", family="Inter", weight="normal",
             linespacing=1.35):
    """Render text/mathtext to a cairo surface at 2x resolution."""
    plt = _mpl()
    import matplotlib
    matplotlib.rcParams["mathtext.fontset"] = fontset
    fig = plt.figure(figsize=(0.01, 0.01), dpi=144)
    fig.text(0, 0, s, fontsize=size, color=col, family=family, weight=weight,
             linespacing=linespacing)
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=144, transparent=True, bbox_inches="tight", pad_inches=0.06)
    plt.close(fig)
    buf.seek(0)
    return cairo.ImageSurface.create_from_png(buf)


def draw_img(ctx, surf, x, y, scale=1.0, a=1.0, anchor="center"):
    """Images are 2x; scale=1 draws at nominal size."""
    if a <= 0 or scale <= 0:
        return
    w, h = surf.get_width() / 2 * scale, surf.get_height() / 2 * scale
    ox = {"center": -w / 2, "left": 0, "right": -w}[anchor]
    ctx.save()
    ctx.translate(x + ox, y - h / 2)
    ctx.scale(scale / 2, scale / 2)
    ctx.set_source_surface(surf, 0, 0)
    ctx.get_source().set_filter(cairo.FILTER_BEST)
    ctx.paint_with_alpha(a)
    ctx.restore()


def img_size(surf, scale=1.0):
    return surf.get_width() / 2 * scale, surf.get_height() / 2 * scale


def formula(ctx, s, x, y, size, t, t0, col="#FFF4E6", a=1.0, anchor="center", grow=True):
    p = pop(t, t0, 0.6) if grow else 1
    if p <= 0.001:
        return
    surf = math_img(s, size, col)
    ctx.save()
    ctx.translate(x, y)
    sc = 0.6 + 0.4 * p if grow else 1
    draw_img(ctx, surf, 0, 0, sc, a * clamp(p * 1.3), anchor)
    ctx.restore()


def expert(ctx, s, t, t0, t1, y=88):
    """'For experts' card across the top. s is mathtext (may contain \\n)."""
    env = fade(t, t0, t1, 0.4, 0.4)
    if env <= 0:
        return
    surf = math_img(s, 17, "#E9E2FF", "dejavusans", "Inter")
    iw, ih = img_size(surf)
    chip_w = 168
    bw = iw + chip_w + 56
    bh = max(ih + 26, 62)
    x0 = W / 2 - bw / 2
    yy = y - bh / 2 + (1 - ease_out(seg(t, t0, t0 + 0.5))) * -14
    rrect(ctx, x0, yy, bw, bh, 22)
    rgba(ctx, "#0E0926", 0.62 * env)
    ctx.fill_preserve()
    rgba(ctx, PAL["sky"], 0.35 * env)
    ctx.set_line_width(1.6)
    ctx.stroke()
    # chip
    rrect(ctx, x0 + 14, yy + bh / 2 - 17, chip_w - 10, 34, 17)
    rgba(ctx, PAL["sky"], 0.18 * env)
    ctx.fill()
    # little magnifier icon
    mx, my = x0 + 36, yy + bh / 2
    rgba(ctx, PAL["sky"], env)
    ctx.set_line_width(2.6)
    ctx.arc(mx - 2, my - 2, 7, 0, TAU)
    ctx.stroke()
    ctx.move_to(mx + 3, my + 3)
    ctx.line_to(mx + 9, my + 9)
    ctx.stroke()
    text(ctx, "FOR EXPERTS", x0 + 52, my, 16, PAL["sky"], env, align="left")
    draw_img(ctx, surf, x0 + chip_w + 30, yy + bh / 2, 1.0, env, anchor="left")


# ----------------------------------------------------------------- background
_BG = None


def _make_bg():
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    c = cairo.Context(surf)
    g = cairo.LinearGradient(0, 0, 0, H)
    g.add_color_stop_rgb(0, *C(PAL["bg_top"]))
    g.add_color_stop_rgb(1, *C(PAL["bg_bot"]))
    c.set_source(g)
    c.paint()
    rng = np.random.default_rng(7)
    for (x, y, r, col, a) in [(300, 250, 620, "#5B3B9C", 0.30), (1650, 300, 560, "#2D6B92", 0.25),
                              (1100, 900, 700, "#8C3B78", 0.20), (500, 950, 500, "#3E4FA0", 0.18)]:
        glow(c, x, y, r, col, a)
    # far stars (static)
    for _ in range(420):
        x, y = rng.uniform(0, W), rng.uniform(0, H)
        r = rng.uniform(0.5, 1.5)
        rgba(c, "#FFFFFF", rng.uniform(0.15, 0.55))
        c.arc(x, y, r, 0, TAU)
        c.fill()
    # vignette
    v = cairo.RadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05)
    v.add_color_stop_rgba(0, 0, 0, 0, 0)
    v.add_color_stop_rgba(1, 0.03, 0.0, 0.08, 0.55)
    c.set_source(v)
    c.paint()
    return surf


_RNG = np.random.default_rng(11)
TWINKLE = [(_RNG.uniform(0, W), _RNG.uniform(0, H), _RNG.uniform(1.5, 4.0),
            _RNG.uniform(0, TAU), _RNG.uniform(0.6, 1.6)) for _ in range(70)]
DUST = [(_RNG.uniform(0, W), _RNG.uniform(0, H), _RNG.uniform(1, 2.6), _RNG.uniform(6, 18),
         _RNG.uniform(0, TAU)) for _ in range(40)]


def background(ctx, t):
    global _BG
    if _BG is None:
        _BG = _make_bg()
    ctx.set_source_surface(_BG, 0, 0)
    ctx.paint()
    for (x, y, r, ph, sp) in TWINKLE:
        k = 0.5 + 0.5 * math.sin(t * sp * 2 + ph)
        a = 0.25 + 0.75 * k * k
        glow(ctx, x, y, r * 4, "#CFC4FF", 0.18 * a)
        sparkle(ctx, x, y, r * (0.7 + 0.5 * k), "#FFFFFF", a * 0.9, rot=0)
    for (x, y, r, sp, ph) in DUST:
        yy = (y - t * sp) % H
        xx = x + 14 * math.sin(t * 0.4 + ph)
        rgba(ctx, "#E8DDFF", 0.22)
        ctx.arc(xx, yy, r, 0, TAU)
        ctx.fill()


# ----------------------------------------------------------------- face helpers
def blink(t, seed=0):
    period = 3.3 + (seed % 5) * 0.41
    ph = (t + seed * 0.77) % period
    if ph < 0.16:
        return abs(ph - 0.08) / 0.08
    return 1.0


def face(ctx, r, t, seed=0, look=(0, 0), eye_sp=0.34, eye_y=-0.06, eye_r=0.13,
         ink="#2B1D3F", cheek="#FF7FA8", mood="smile", sleepy=False, a=1.0):
    """Cute face centered at origin for a body of radius r."""
    lx, ly = look
    op = blink(t, seed)
    for sx in (-1, 1):
        ex, ey = sx * eye_sp * r + lx * r * 0.08, eye_y * r + ly * r * 0.08
        if sleepy:
            rgba(ctx, ink, a)
            ctx.set_line_width(r * 0.06)
            ctx.set_line_cap(cairo.LINE_CAP_ROUND)
            ctx.arc(ex, ey - r * 0.02, eye_r * r * 0.9, TAU * 0.08, TAU * 0.42)
            ctx.stroke()
            continue
        if op < 0.2:
            rgba(ctx, ink, a)
            ctx.set_line_width(r * 0.055)
            ctx.set_line_cap(cairo.LINE_CAP_ROUND)
            ctx.arc(ex, ey - eye_r * r * 0.3, eye_r * r, TAU * 0.1, TAU * 0.4)
            ctx.stroke()
        else:
            ellipse(ctx, ex, ey, eye_r * r * 0.82, eye_r * r * 1.08 * op)
            rgba(ctx, ink, a)
            ctx.fill()
            rgba(ctx, "#FFFFFF", a)
            ctx.arc(ex - eye_r * r * 0.3, ey - eye_r * r * 0.42 * op, eye_r * r * 0.32, 0, TAU)
            ctx.fill()
            ctx.arc(ex + eye_r * r * 0.25, ey + eye_r * r * 0.35 * op, eye_r * r * 0.14, 0, TAU)
            ctx.fill()
    for sx in (-1, 1):
        ellipse(ctx, sx * (eye_sp + 0.2) * r, (eye_y + 0.22) * r, r * 0.12, r * 0.075)
        rgba(ctx, cheek, 0.55 * a)
        ctx.fill()
    rgba(ctx, ink, a)
    ctx.set_line_width(r * 0.06)
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    my = (eye_y + 0.2) * r
    if mood == "smile":
        ctx.arc(0, my - r * 0.04, r * 0.11, TAU * 0.08, TAU * 0.42)
        ctx.stroke()
    elif mood == "open":
        ellipse(ctx, 0, my + r * 0.03, r * 0.09, r * 0.1)
        ctx.fill()
        ellipse(ctx, 0, my + r * 0.07, r * 0.05, r * 0.04)
        rgba(ctx, "#FF7F9E", a)
        ctx.fill()
    elif mood == "o":
        ctx.arc(0, my + r * 0.02, r * 0.05, 0, TAU)
        ctx.stroke()
    elif mood == "worry":
        ctx.arc(0, my + r * 0.1, r * 0.09, TAU * 0.58, TAU * 0.92)
        ctx.stroke()


# ----------------------------------------------------------------- cast
def pip(ctx, x, y, r, t, seed=0, look=(0, 0), squash=0.0, ang=0.0, a=1.0, mood="smile",
        glow_amt=1.0):
    """Pip the photon: a glowing little sun-bean that lives on light rays."""
    if a <= 0 or r <= 0.5:
        return
    ctx.save()
    ctx.translate(x, y)
    glow(ctx, 0, 0, r * 3.4, "#FFD66B", 0.42 * glow_amt * a)
    # rays
    ctx.save()
    ctx.rotate(t * 0.8 + seed)
    for i in range(8):
        ctx.rotate(TAU / 8)
        rgba(ctx, "#FFE79A", 0.5 * a)
        ctx.set_line_width(r * 0.12)
        ctx.set_line_cap(cairo.LINE_CAP_ROUND)
        ln = 1.32 + 0.1 * math.sin(t * 6 + i)
        ctx.move_to(r * 1.12, 0)
        ctx.line_to(r * ln, 0)
        ctx.stroke()
    ctx.restore()
    ctx.rotate(ang)
    ctx.scale(1 + squash, 1 / (1 + squash))
    ctx.rotate(-ang)
    g = cairo.RadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05)
    g.add_color_stop_rgba(0, *C("#FFF8D6"), a)
    g.add_color_stop_rgba(0.55, *C("#FFD66B"), a)
    g.add_color_stop_rgba(1, *C("#FFB347"), a)
    ctx.arc(0, 0, r, 0, TAU)
    ctx.set_source(g)
    ctx.fill_preserve()
    rgba(ctx, "#E59A34", a)
    ctx.set_line_width(r * 0.07)
    ctx.stroke()
    ellipse(ctx, -r * 0.38, -r * 0.5, r * 0.22, r * 0.12)
    rgba(ctx, "#FFFFFF", 0.7 * a)
    ctx.fill()
    face(ctx, r, t, seed, look, mood=mood, a=a)
    ctx.restore()


def gravi(ctx, x, y, ang, length, t, col="lav", a=1.0, seed=0, thick=14, amp=None, speed=7.0,
          mood="smile", flip=False):
    """Gravi the graviton: a wiggly ripple-noodle. Head at (x, y), body trails behind."""
    if a <= 0:
        return
    base, dark = C(PAL[col]), C(PAL[col + "_d"])
    amp = thick * 0.9 if amp is None else amp
    N = 46
    pts = []
    for i in range(N + 1):
        s = i / N
        lx = -s * length
        ly = amp * math.sin(s * TAU * 1.25 - t * speed + seed) * (0.25 + 0.75 * s)
        if flip:
            ly = -ly
        rr = thick * (1.0 - 0.62 * s)
        pts.append((lx, ly, rr))
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(ang)
    for (lx, ly, rr) in reversed(pts):
        rgba(ctx, dark, a)
        ctx.arc(lx, ly, rr + 2.8, 0, TAU)
        ctx.fill()
    for (lx, ly, rr) in reversed(pts):
        rgba(ctx, base, a)
        ctx.arc(lx, ly, rr, 0, TAU)
        ctx.fill()
    for (lx, ly, rr) in pts[3:-6]:
        rgba(ctx, "#FFFFFF", 0.28 * a)
        ctx.arc(lx, ly - rr * 0.42, rr * 0.3, 0, TAU)
        ctx.fill()
    hr = thick * 1.45
    hx, hy = pts[0][0] + 2, pts[0][1]
    rgba(ctx, dark, a)
    ctx.arc(hx, hy, hr + 2.8, 0, TAU)
    ctx.fill()
    g = cairo.RadialGradient(hx - hr * 0.3, hy - hr * 0.4, 1, hx, hy, hr)
    g.add_color_stop_rgba(0, *mix("#FFFFFF", base, 0.55), a)
    g.add_color_stop_rgba(1, *base, a)
    ctx.set_source(g)
    ctx.arc(hx, hy, hr, 0, TAU)
    ctx.fill()
    ctx.translate(hx, hy)
    # keep face upright-ish
    ctx.rotate(-ang * 0.85)
    face(ctx, hr, t, seed + 3, (0.6, 0), eye_sp=0.32, mood=mood, a=a)
    ctx.restore()


def tick(ctx, x, y, r, t, reading=0.0, a=1.0, seed=2, mood="smile"):
    """Tick the gravitational clock."""
    if a <= 0:
        return
    ctx.save()
    ctx.translate(x, y)
    shadow(ctx, 0, r * 1.12, r * 0.9, r * 0.2, 0.35 * a)
    for sx in (-1, 1):  # feet
        ellipse(ctx, sx * r * 0.38, r * 1.0, r * 0.22, r * 0.12)
        rgba(ctx, PAL["mint_d"], a)
        ctx.fill()
    # crown
    rrect(ctx, -r * 0.14, -r * 1.22, r * 0.28, r * 0.22, r * 0.06)
    rgba(ctx, PAL["gold_d"], a)
    ctx.fill()
    ctx.arc(0, -r * 1.3, r * 0.1, 0, TAU)
    rgba(ctx, PAL["gold"], a)
    ctx.fill()
    ctx.arc(0, 0, r * 1.04, 0, TAU)
    rgba(ctx, PAL["mint_d"], a)
    ctx.fill()
    g = cairo.RadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r)
    g.add_color_stop_rgba(0, *C("#E6FFF2"), a)
    g.add_color_stop_rgba(1, *C(PAL["mint"]), a)
    ctx.set_source(g)
    ctx.arc(0, 0, r * 0.9, 0, TAU)
    ctx.fill()
    for i in range(12):
        an = i * TAU / 12
        rgba(ctx, PAL["mint_d"], 0.8 * a)
        ctx.set_line_width(r * (0.06 if i % 3 == 0 else 0.035))
        ctx.move_to(math.cos(an) * r * 0.72, math.sin(an) * r * 0.72)
        ctx.line_to(math.cos(an) * r * 0.82, math.sin(an) * r * 0.82)
        ctx.stroke()
    # sweep arc showing reading
    if reading > 0.002:
        ctx.move_to(0, 0)
        ctx.arc(0, 0, r * 0.66, -TAU / 4, -TAU / 4 + TAU * min(reading, 0.999))
        ctx.close_path()
        rgba(ctx, PAL["gold"], 0.45 * a)
        ctx.fill()
    an = -TAU / 4 + TAU * reading
    rgba(ctx, PAL["coral_d"], a)
    ctx.set_line_width(r * 0.08)
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    ctx.move_to(0, 0)
    ctx.line_to(math.cos(an) * r * 0.6, math.sin(an) * r * 0.6)
    ctx.stroke()
    ctx.arc(0, 0, r * 0.08, 0, TAU)
    ctx.fill()
    ctx.translate(0, r * 0.2)
    face(ctx, r * 0.7, t, seed, eye_sp=0.42, eye_y=-0.02, mood=mood, a=a)
    ctx.restore()


def hush(ctx, x, y, r, t, a=1.0, awake=0.0, inner=None):
    """Hush the sleepy black hole."""
    if a <= 0:
        return
    ctx.save()
    ctx.translate(x, y)
    glow(ctx, 0, 0, r * 2.1, "#B48CFF", 0.35 * a)
    # photon ring / disk behind
    ctx.save()
    ctx.scale(1, 0.32)
    for i, (rr, col, al) in enumerate([(1.75, "#FFB46B", 0.35), (1.55, "#FFD66B", 0.6), (1.4, "#FF9ED8", 0.4)]):
        rgba(ctx, col, al * a)
        ctx.set_line_width(r * 0.12 / 0.32 * 0.4)
        ctx.arc(0, 0, r * rr, TAU / 2, TAU)
        ctx.stroke()
    ctx.restore()
    g = cairo.RadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r)
    g.add_color_stop_rgba(0, *C("#4A3470"), a)
    g.add_color_stop_rgba(1, *C("#140B26"), a)
    ctx.set_source(g)
    ctx.arc(0, 0, r, 0, TAU)
    ctx.fill_preserve()
    rgba(ctx, "#D6B8FF", 0.9 * a)
    ctx.set_line_width(r * 0.035)
    ctx.stroke()
    ctx.save()
    ctx.scale(1, 0.32)
    for i, (rr, col, al) in enumerate([(1.75, "#FFB46B", 0.35), (1.55, "#FFD66B", 0.6), (1.4, "#FF9ED8", 0.4)]):
        rgba(ctx, col, al * a)
        ctx.set_line_width(r * 0.12 / 0.32 * 0.4)
        ctx.arc(0, 0, r * rr, 0, TAU / 2)
        ctx.stroke()
    ctx.restore()
    if inner:
        inner(r)
    ellipse(ctx, -r * 0.4, -r * 0.5, r * 0.22, r * 0.11)
    rgba(ctx, "#FFFFFF", 0.18 * a)
    ctx.fill()
    face(ctx, r * 0.8, t, 9, ink="#F3E8FF", cheek="#FF8FC8",
         sleepy=awake < 0.5, mood="smile" if awake >= 0.5 else "o", a=a)
    ctx.restore()


def planet(ctx, x, y, r, t, a=1.0):
    """Orbi the ringed planet."""
    if a <= 0:
        return
    ctx.save()
    ctx.translate(x, y)
    glow(ctx, 0, 0, r * 2.0, "#8FD3FF", 0.25 * a)

    def ring(front):
        ctx.save()
        ctx.rotate(-0.25)
        ctx.scale(1, 0.3)
        rgba(ctx, "#FFD66B", 0.9 * a)
        ctx.set_line_width(r * 0.14 / 0.3 * 0.45)
        if front:
            ctx.arc(0, 0, r * 1.55, 0, TAU / 2)
        else:
            ctx.arc(0, 0, r * 1.55, TAU / 2, TAU)
        ctx.stroke()
        ctx.restore()
    ring(False)
    g = cairo.RadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r)
    g.add_color_stop_rgba(0, *C("#D2F0FF"), a)
    g.add_color_stop_rgba(1, *C("#5FA8E6"), a)
    ctx.set_source(g)
    ctx.arc(0, 0, r, 0, TAU)
    ctx.fill_preserve()
    rgba(ctx, "#3C7FC0", a)
    ctx.set_line_width(r * 0.06)
    ctx.stroke()
    face(ctx, r, t, 5, a=a)
    ring(True)
    ctx.restore()
