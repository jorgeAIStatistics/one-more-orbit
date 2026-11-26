# World 1, complete: progress and handoff

The owner's brief of 2026-11-26 ("WORLD 1, COMPLETE: build every remaining level as a journey, then refine
everything"). Work on the local branch `galaxy`; commit after each level; never push. Reports go to
`../v4-screenshots/world 1/18 World 1 complete/` (one folder per level plan and build). Keypoint from the owner:
prioritise smoothness in gameplay, in Orbin's movements and animation and his interactions with each level's objects.

## Order (Part 3 of the brief)
1. Cirra as a journey: plan, build, checks.
2. The Stillness redesigned (3 concepts as stills plus motion tests, recommend one, apply everywhere: the cold open,
   residue in levels, the ambush, the shadow rings, the guardian's corruption).
3. The ambush (Darkness, Lost Sky ft. She Is Jules): a chase, no new mode, 45-60 s, no embers.
4. Glassmere as a journey.
5. Verdance as a journey.
6. The last memory (memory 5), then the guardian (Throne, three phases).
7. The ending (The Long Road Home).
8. The Landing, the map and the menus (Part 4B 2-4): the after-level transition storyboard and rebuild, the map
   redesign (stills at 0, 2 and all stars first), buttons and typography.
9. The refinement pass (Part 4, and Part 4B 5: Emberwick's heart rebuilt, no empty frames, wide screens).

## The table (hard limits on timing)
| Level | Calm | Peak | Window | Buffer | Shortest gap | Longest quick run | Embers |
|---|---|---|---|---|---|---|---|
| Drifting Edge | 0.7 | 1.5 | 160 | 150 | 0.4 (doubles) | 2 | every section |
| Emberwick | 1 | 2 | 140 | 150 | 0.3 (one double at a time) | 2 | every section |
| Cirra | 1.2 | 2.4 | 125 | 130 | 0.35 (except one double) | 3 | 1, at the drop |
| The ambush | 1.2 | 2.5 | 120 | 125 | 0.33 | 3 | 0 |
| Glassmere | 1.3 | 2.7 | 110 | 120 | 0.3 | 4 | 1, at the drop |
| Verdance | 1.4 | 3 | 100 | 100 | 0.25 | 4 | 0 |
| The guardian | 1.5 | 3.5 (bursts) | 90 | 90 | 0.2 | 6 | 0 (practice: each phase) |
A quick run is a run of taps each under 0.45 s after the one before. Never stack a speed change, mode change, turn,
gravity change or launch within 2 beats. Every flight in a drop has a tap; the first tap after a landing is at least a
beat later.

## How things are built (for a new session)
- Charts: `tools/journey.py <folder>` (specs in `tools/journeys.py`) writes a level's segments and hand bars from a
  spec (places, leaps, sections, taps per bar), picks the taps on the strongest measured sounds within the table, then
  run `tools/.venv/bin/python tools/chart.py <folder>`. Edge and Emberwick were tuned by hand (their presses.json).
- Places and path shapes: `src/gd/shapes.ts` (circle, ellipse, eight, line, circle with a spiral window); a level's
  `places` in its level.json; leaps are the bar word `leapN@b` (src/gd/course.ts), taps inside a flight are embers.
- Worlds: `src/ui/worlds.ts` (Emberwick, the Drifting Edge), `src/ui/worlds2.ts` (Cirra, Glassmere, Verdance);
  paintings in `src/art/worldpaint.js`, `src/art/world2paint.js`, painted ahead in the worker (`src/art/paintworker.ts`).
- Checks: `npx vite-node tools/variety.ts <ids>` (audit: rates, gaps, quick runs, phrases, objects, places, plain
  stretch), `npx vitest run` (tests/forgive.test.ts covers every level: on time, early, real players, close pairs, spam),
  frame times and recordings with the Playwright scripts in the session scratchpad (`hitch.mjs`, `rec5.mjs` + `mux.py`;
  copies kept in `tools/check/`).
- Dev server on port 5199 (`node_modules/.bin/vite --port 5199 --strictPort --host`); production preview on 4173
  (`npm run build`, then `vite preview --host --port 4173`). The owner's phone: http://10.0.0.166:4173.
- Never clear or overwrite the owner's save (`one_more_orbit_v4`); tests stub Storage.setItem; mute audio in tests.

## Done
- (2026-11-26) Emberwick and the Drifting Edge as journeys; fair input (sustained anti-mash, close presses never
  dropped, tap log in Settings); density, spacing, framing (commits up to 964acf6).

- (2026-11-26) 1. Cirra as a journey: the Still Rim, the kite strings, the Gust Spiral (outward at 2x), the Cloud Shelves
  (mini), Seo's sky; Seo in the world; kites, gusts, wind chimes, residue knots in three beats. Checks passed (report:
  18/1 Cirra). Tools: tools/journey.py + tools/journeys.py (charts), tools/plan_page.py, tools/level_report.py,
  tools/check/level.sh (all of a level's checks).
- (2026-11-26) 2. The Stillness: three concepts (18/2 the Stillness), B the ink tide chosen (src/art/stillness.js), now
  in the cold open, memories, world skies, the shadow rings and every residue stain. Still to use it: the ambush, the
  guardian's corruption, the residue walls on the course.
- Pictures not ready from the worker fade in when they come (paintcache pairNow) instead of being painted on the page.

- (2026-11-26) 3. The ambush on Darkness: a loop out from the Landing and back (the Landing -> the debris bridge -> the
  twin wrecks -> the dead moon -> home); the Stillness follows his trail (src/ui/worldamb.ts) and swallows each place he
  leaves; freezes (holds), skips (vents: the picture tears and the music drops out for 90 ms, audio.skip), colour
  draining in waves; the light holds, the Kindlings by the fire, Helion's pulse. Starts after Cirra's first clear (after
  its memory), replayable from Settings ("The ambush, again"); hooks: __omo.ambush(bot, from). Note: in the game's time
  bar k of a cut starts at k bars (the audio offset is taken off): the ambush's bar k is at 1.6k s.

- (2026-11-26) 4. Glassmere as a journey (rim -> ice stones -> the looking-lake -> the Underlake spiral -> back up);
  Vell under the waterline between the lake and its reflection; ripples, mirror portals, droplets, ice shards. Worlds
  with `lead: true` (PlanetWorld) have the camera lead each flight; a world's own pull-back wins over it.

- (2026-11-26) 5. Verdance climbs the great tree (roots -> trunk spiral -> branches, an eight -> canopy -> crown, dual);
  Morrow climbs beside him; seed pods, vines, seed-lights, thorn knots. Lesson: a line place ridden for many bars grows
  very long (its span is the time spent on it) and throws launches off screen; keep lines to a few bars.

- (2026-11-26) The owner's two additions: the Ufotable pass (smoothness audit tools/check/smooth.mjs + smooth.py; camera,
  zoom and flight springs; under-course drawing; parallax; Orbin's plume) and Verdance's readability.
- (2026-11-26) 6. The last memory (memory film chapter 5, 'royalty'), then the guardian on Throne (levels/throne,
  src/ui/worldguard.ts; FINAL now points there, id 'royalty'); 7. the ending on The Long Road Home (src/ui/skyending.ts).
- (2026-11-26) 8. The map (Play/Practice/Dare buttons, systems and inhabitants, the ambush on the road, drag/pinch) and
  the menus (clean upright face, 44 pt); one continuous rise after a replay's star. 9. Emberwick's heart rebuilt.
- Checks run against a frozen build: tools/check/snap.sh <dir> then OMO_PORT=5300 tools/check/allcheck.sh <out>.
- Final report: tools/final_report.py <report dir> (notes in final-notes.html there).

## In progress / next
- Done: every check re-run after the Ufotable pass (18/6 the Ufotable pass, the guardian included), the final report
  (18/0 World 1, complete (final report).html). Waiting for the owner's playtest of all of World 1 and their two
  decisions (Darkness vs Dead of Night; the guardian's restart rule, built as the whole fight).

## Open issues
- Not done from the Ufotable list: true 3D per place with depth of field, one light direction per place, a colour
  grade, smears on the fastest frames. A failed run still goes to the results screen.
- The owner's iPhone frame times (?phonecheck) have never been sent.
- Two one-off frame spikes seen once (Drifting Edge 17.5 s, Emberwick finale), not reproduced.
- Darkness (the ambush) is sung; the brief says switch to "Dead of Night" (instrumental) if the vocals clash.
