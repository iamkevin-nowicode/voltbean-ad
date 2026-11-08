# REVIEW — "Tomorrow's Morning, Today!" v3

Read this before changing anything.

## History

- **v1** (commit `656c1df`): 13 kinetic-type slides with glitch effects.
- **v2** (commit `5e1bec7`): 1950s cartoon with hand-coded characters. **Rejected:** the characters looked crude ("weak shapes cobbled together"). Lesson: characters drawn by typing coordinates for basic shapes won't reach professional quality. Use real illustrated art for characters, or don't use characters.
- **v3** (this version): a graphic-design poster with no characters, built only from shapes that look intentional in flat code: circles, ellipses, type, strokes.

## Scenes

| Time | File | What happens |
| ---- | ---- | ------------ |
| 0–4.5 s | `compositions/clock.html` | Sunburst clock ticks to 7:04 on a Monday. |
| 4.5–9.5 s | `compositions/cup.html` | The face becomes weak coffee. "ORDINARY COFFEE." rolls over to "ORDINARY MONDAY.", then the cup drains to a dot. |
| 9.5–15 s | `compositions/can.html` | The dot becomes a can lid. Ring-pull, bolt, yellow flood, the can turns to face us, then "1000 MG!". |
| 15–23 s | `compositions/effects.html` | Inbox runs to 0, Monday ticked off on a calendar, heartbeat line, then the banner. |
| 23–30 s | `compositions/endcard.html` | The can, VOLTBEAN, the claim and the sign-off. |

## Checked

- `npx hyperframes check`: 0 errors, 0 warnings.
- Every scene was reviewed as a strip of frames, and every seam was checked: the circle matches across the clock→cup and cup→can cuts.
- Sound was measured, not heard: 25 bundled effects (Pixabay license), timed to on-screen causes.

## Open items

1. **Music.** Still none. It needs a HeyGen sign-in (`npx hyperframes auth login`) or the client's own track. There's a slot in `index.html`.
2. **Hold at the start of the effects section (14.6–15.0 s):** 0.3 s of plain pink before the inbox panel arrives. It reads as a breath; trim it if it drags.
3. **The 1000 MG claim** is parody from v1 and far above safe caffeine guidance.
