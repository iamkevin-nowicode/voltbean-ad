"""
Render the explainer to MP4.
  python render.py                 -> null_cone_explainer.mp4 (1080p60)
  python render.py --fps 30 --out draft.mp4
Frames are drawn with pycairo in parallel worker processes, piped to ffmpeg,
then joined with the synthesized soundtrack.
"""
import argparse
import os
import subprocess
import sys
import time
from multiprocessing import Pool

HERE = os.path.dirname(os.path.abspath(__file__))


def render_chunk(job):
    idx, f0, f1, fps, tmp = job
    import cairo
    from engine import W, H
    from scenes import render_frame
    path = os.path.join(tmp, f"chunk_{idx:02d}.mp4")
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "bgra",
           "-s", f"{W}x{H}", "-r", str(fps), "-i", "-",
           "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-tune", "animation",
           "-pix_fmt", "yuv420p", "-g", str(fps * 2), path]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    ctx = cairo.Context(surf)
    for f in range(f0, f1):
        ctx.save()
        ctx.set_operator(cairo.OPERATOR_SOURCE)
        ctx.set_source_rgba(0, 0, 0, 1)
        ctx.paint()
        ctx.restore()
        render_frame(ctx, f / fps)
        surf.flush()
        p.stdin.write(bytes(surf.get_data()))
    p.stdin.close()
    p.wait()
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fps", type=int, default=60)
    ap.add_argument("--out", default=os.path.join(HERE, "null_cone_explainer.mp4"))
    ap.add_argument("--workers", type=int, default=os.cpu_count() or 4)
    ap.add_argument("--tmp", default=os.path.join(HERE, "_build"))
    args = ap.parse_args()
    sys.path.insert(0, HERE)
    from scenes import TOTAL
    os.makedirs(args.tmp, exist_ok=True)

    t0 = time.time()
    wav = os.path.join(args.tmp, "soundtrack.wav")
    subprocess.run([sys.executable, os.path.join(HERE, "audio.py"), wav], check=True, cwd=HERE)

    nframes = int(round(TOTAL * args.fps))
    n = max(1, args.workers * 3)
    bounds = [round(i * nframes / n) for i in range(n + 1)]
    jobs = [(i, bounds[i], bounds[i + 1], args.fps, args.tmp) for i in range(n)]
    print(f"rendering {nframes} frames at {args.fps}fps with {args.workers} workers...")
    with Pool(args.workers) as pool:
        paths = []
        for k, pth in enumerate(pool.imap(render_chunk, jobs)):
            paths.append(pth)
            print(f"  chunk {k + 1}/{n} done ({time.time() - t0:.0f}s)", flush=True)

    lst = os.path.join(args.tmp, "list.txt")
    with open(lst, "w") as fh:
        for pth in paths:
            fh.write(f"file '{pth}'\n")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst,
                    "-i", wav, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest",
                    "-movflags", "+faststart", args.out], check=True)
    print(f"done: {args.out}  ({time.time() - t0:.0f}s)")


if __name__ == "__main__":
    main()
