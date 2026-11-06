# REVIEW — "Tomorrow's Morning, Today!" (v2, storyline B)

Read this before changing anything.

## What was built

A 30 s, 1920×1080, 30 fps fully animated spot in 1950s limited-animation style (UPA / atomic-age print ads), replacing the old 13-slide kinetic-type ad. The old version is in git history (commit `656c1df`, `index.html`).

| Time | Scene file | What happens |
| ---- | ---------- | ------------ |
| 0–5 s | `compositions/morning.html` | Starburst alarm clock, "MONDAY, 7:04 A.M.", Dad frozen mid-yawn with an upside-down toothbrush, "Rise and… shine?". A doorway pillar wipes to the kitchen. |
| 5–10.5 s | `compositions/kitchen.html` | Dusty kitchen. Toast pops onto sleeping Dad's head, Mom pours weak coffee past the cup. "ORDINARY COFFEE." / "ORDINARY MONDAY." The camera stops on the only full-colour thing: the can. |
| 10.5–14.5 s | `compositions/zap.html` | Close-up. "1000 MG!" starburst, "Electrified cold brew." Ring-pull cracks, a bolt leaves the can, and an iris floods the world from dusty to full Voltbean colour. Dad bolts up, hair spiked. Whip out. |
| 14.5–22.5 s | `compositions/rush.html` | Triple speed: Dad runs in place while the house rushes past. He catches toast in his mouth, his tie spins tight, a briefcase snaps to hand, a hat drops on, the door flies open, and he lands in a convertible that takes off. Banner: "Tomorrow's morning, today!" Camera tilts up. |
| 22.5–30 s | `compositions/endcard.html` | Rooftop skyline. The can lands like an atomic-age rocket, then VOLTBEAN, "Coffee is dead. / Long live VOLTAGE.", "Drink at your own risk." and small print. Holds from about 27 s. |

## Creative calls

- **One medium, strictly:** flat shapes, no gradients, ink lines printed off-register (−10, −7 px) from their fills, paper grain over everything. Characters animate on 2s and 3s (`steps()` eases) while the camera moves smoothly: the classic limited-animation contrast.
- **Before and after is told with colour:** dusty inks before, full brand inks after. The can is the only full-colour object in the before-world.
- **Every cut has a cause:** the pillar wipe, a punch-in on the can, the iris from the ring-pull, the whip, and the tilt up to the sky. That's five transition kinds.
- **Brand accents are rationed:** pink marks the bolt, the starburst, the banner and the single word "VOLTAGE." in the claim, which sits as white on a pink block for contrast.
- **No voiceover.** Big titles and sound effects carry it.
- **Not built:** storylines A ("Bean Me Up", rubber-hose mascot) and C ("SIP.", anime). See `STORYLINES.md`.

## What was measured vs. only looked at

- `npx hyperframes check`: **0 errors, 0 warnings** across lint, runtime, layout, motion, contrast, craft and audio.
- `snapshot --review`: beat, seam and phone sheets looked at. Fixed from review: the end-card seam went black, so the rooftop now rises from below after the sky.
- **Sound was measured, not heard:** 25 timed effects from the bundled Pixabay library (free commercial use; credits in `assets/sfx/CREDITS.md`).
- **No music yet.** HeyGen isn't signed in, and the online sound search was blocked on this network. There's a commented music slot in `index.html` (a 120 BPM grid; hits land on half-second beats).

## Weakest shots and what to do with more time

1. **Music.** It's the biggest missing piece. Add a lounge-exotica bed that tape-stops at the can (around 10.5 s), then a fast swing for the rush. The sound line in `SPEC.md` describes it.
2. **The kitchen-to-zap seam (10.5 s)** is a plain hard cut, the one hard cut between scenes. A push-in from the wide shot would carry it better.
3. **Zap to rush:** Dad goes from pajamas to a suit across the whip. It's cartoon logic, but a one-frame "spin-change" smear would sell it.
4. **Mom** only appears in the kitchen. She could wave from the doorway in the rush for a callback.

## Kept on purpose

- `1000 MG` is the brand's own parody claim from v1. It's far above safe daily caffeine guidance, so change it if this is ever used for a real product.
- GSAP is vendored at `assets/vendor/gsap.min.js` instead of the CDN, because this environment can't reach the CDN. It renders the same anywhere.
