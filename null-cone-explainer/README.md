# Gravity, one light-cone at a time

A ~3-minute animated explainer of
**V. Chandrasekaran, "An algebraic quantization of gravity from the null cone"** (arXiv:2611.34924, Nov 2026).

Made entirely in **Python** — no HyperFrames. Vector art is drawn frame-by-frame with
`pycairo`, math is typeset with `matplotlib` mathtext, and the music + sound effects are
synthesized with `numpy`. `ffmpeg` just stitches the frames and audio into an MP4.

## Two layers of explanation
- **Bottom caption** — plain language for newcomers.
- **"For experts" card (top)** — the precise technical statement from the paper.

## The cast
| Character | Who they are | What they stand for |
|---|---|---|
| **Pip** | a glowing sun-bean | light (photons), which builds the "light walls" |
| **Gravi** | a wiggly ripple-noodle | gravitational waves / gravitons |
| **Tick** | a little mint clock | the paper's "gravitational clock" |
| **Hush** | a sleepy black hole | the black hole whose entropy gets counted |
| **Orbi** | a ringed planet | ordinary, smooth Einstein gravity |

## Story beats
1. Title
2. Two rulebooks (gravity vs. quantum)
3. Why the usual approach breaks (infinities, frozen stage)
4. Causal diamonds and their light walls (null cones)
5. Gravity's data lives on the walls → quantum upgrade
6. The gravitational clock
7. Gluing diamonds → path integral with finite sums
8. Test: graviton pair → finite answer (vs. old infinity)
9. A diamond holds finitely many states → area comes in steps
10. Black hole entropy + the 106/45 log correction (matches Sen)
11. Einstein's equations come back
12. Recap + credits

## Files
- `engine.py` — easing, text, math, background, characters
- `scenes.py` — the 12 scenes and the timeline
- `audio.py` — synthesized soundtrack and sound effects
- `render.py` — parallel renderer → `null_cone_explainer.mp4`
- `preview.py` — render still frames for checking

## Re-render
```bash
pip install pycairo matplotlib numpy     # plus ffmpeg and the Quicksand + Inter fonts
python render.py                          # 1080p / 60fps  (~10 min on 4 cores)
python render.py --fps 30 --out draft.mp4 # faster draft
python preview.py stills/ 51 115 148      # still frames at given seconds
```
