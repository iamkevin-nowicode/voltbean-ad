"""Render still frames: python preview.py OUTDIR t1 t2 ... (global seconds)."""
import os
import sys
import time

import cairo

from engine import W, H
from scenes import render_frame, TOTAL, STARTS, SCENES

out = sys.argv[1]
os.makedirs(out, exist_ok=True)
print("total", TOTAL, "starts", [round(s, 1) for s in STARTS])
for ts in sys.argv[2:]:
    t = float(ts)
    s = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    c = cairo.Context(s)
    t0 = time.time()
    render_frame(c, t)
    dt = time.time() - t0
    s.write_to_png(os.path.join(out, f"f_{t:07.2f}.png"))
    print(f"t={t:.2f} {dt*1000:.0f}ms")
