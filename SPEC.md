# SPEC — "Tomorrow's Morning, Today!" (Voltbean, storyline B)

```text
GOAL:    The viewer laughs at a 1950s household too asleep to function, sees one Voltbean
         can zap it into full colour and triple speed, and leaves with:
         "One can and Monday doesn't stand a chance."
OUTPUT:  HyperFrames, 1920 x 1080, 30 fps
TIME:    30 s x 30 fps = 900 frames. Silent-music build on a 120 BPM grid (15 frames a beat,
         60 a bar) so a bed drops in later with hits on beats.
LOOK:    Medium = 1950s limited-animation advertising cartoon (UPA / atomic-age print).
         Its parts, and nothing else:
         - paper: flat colour fields, no gradients, 256 px grain tile at 7% multiply over all;
         - shapes: flat, hard-edged, no outlines on fills;
         - ink line: #2B2724 (before) / #0A0A0A (after), 5 px round-capped, drawn
           6 px OFF REGISTER from its fill (fill shifted +6x, +4y) — the signature;
         - BEFORE palette (dusty): wall rose #C79AA2, wall teal #8FA9A3, mustard #C9B84A,
           floor #A89A86, skin #D6B49B, cloth #9C8C9A, paper #E9E1D3;
         - AFTER palette (full): voltage #FFE600, chaos #FF1F7A, atomic teal #1FB5A8,
           arc white #FAFAFA, ink #0A0A0A, skin #F2B48C;
         - the Voltbean can is the ONLY full-colour object before the zap.
         Type: display League Gothic 400, caps, 120–260 px, tracking +1%;
               script Yellowtail 400 (assets/fonts) 96–200 px for the announcer lines;
               small print League Gothic 34 px, tracking +4%.
         Light/depth: none — flat medium. Shadows only as flat offset shapes (12 px, 100%).
OBJECTS: starburst wall clock (8-point star, hands at 7:04, two bells on top);
         Dad (tall trapezoid torso, oval head, flat hair with one curl, tiny legs, striped
         pajamas BEFORE / grey suit + pink tie AFTER, hair spiked AFTER);
         Mom (bell skirt, beehive hair, holding a percolator);
         chrome-fin toaster; percolator; boomerang-pattern counter; kidney table;
         finned convertible; atomic-orbit sign; flat skyline.
         Voltbean can: yellow body, ink top band, pink bolt, "VOLTBEAN" vertical, "1000 MG".
MOTION:  Characters on 2s-and-3s (GSAP steps() eases, 10–12 drawings/s) = limited animation.
         Camera = smooth 30 fps truck (linear at constant speed is the point; power2.inOut
         into and out of stops).
         Enter: expo.out / back.out(1.6) for stamps; exit: power3.in, 40–50% of entry.
         Starbursts land with back.out(2) scale 0.2→1 in 9 frames, then hold dead still.
         Titles: script lines wipe on left→right (clip-path) in 10–14 frames; caps lines
         drop per word, 3 frames apart. Landed titles never move.
SHOTS:   S1 morning  0–150    truck right across bedroom → hall. f0: starburst clock 7:04 fills
                              left third, bells shake on 2s (click). "MONDAY, 7:04 A.M." caps.
                              Dad frozen mid-yawn, mouth oval opens 3 drawings. Script line
                              "Rise and… shine?" A doorway pillar crosses camera = wipe.
         S2 kitchen  150–315  pillar exits, dusty kitchen. Mom pours pale coffee past the cup
                              (puddle grows). Toaster pops (pop) — toast arcs onto sleeping Dad's
                              head. "ORDINARY COFFEE." / "ORDINARY MONDAY." Truck eases to a stop
                              on the full-colour can on the counter (f300).
         S3 zap      315–435  punch-in: can fills 62% height. Starburst "1000 MG!" (ping).
                              Tab cracks (click) → bolt zigzags up (zap) → iris of full colour
                              opens from the tab (sparkle): kitchen goes dusty → full. Pull back:
                              Dad bolt-upright, hair spiked. Whip right (whoosh).
         S4 rush     435–675  triple-speed truck, full colour, motion blur: Dad catches toast in
                              mouth (pop) → tie spins tight, briefcase snaps to hand (click) →
                              door bursts → convertible zooms off (whoosh), speed lines →
                              starburst title "Tomorrow's morning, today!" holds 2 s.
         S5 endcard  675–900  sky, then the camera settles down onto a rooftop skyline; the can drops in on
                              retro-flames like an atomic-age rocket and lands
                              centre-left (impact). "VOLTBEAN" wipes in beside it. "Coffee is
                              dead." / "Long live voltage." Script "Drink at your own risk."
                              Small print. Holds from f810 to f900.
BANNED:  dark/black void ground; glow, bloom, neon, lens flares, particles; gradients of any
         kind; cream ground + serif + italic accent; everything centred; fade-and-slide-up;
         titles that drift after landing; corner labels/HUD; docked logo; glitch/RGB-split
         (the old spot's crutch); outlines ON fills (lines must sit off register); 3D tilt.
QA:      f0 clock+title readable as a thumbnail; f75 Dad yawn; f230 toast mid-arc; f300 can
         alone in colour; f380 iris half open; f420 Dad spiked hair; f500 toast catch;
         f590 car + speed lines; f650 title held; f740 can landing; f800 claim; f890 final.
```
