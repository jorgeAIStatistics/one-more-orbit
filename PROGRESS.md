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

## In progress / next
- 3. The ambush on Darkness (cut: levels/darkness, 32 bars, 150 BPM, drop at bar 16 = 27.2 s). Plan: the Landing
  (the planetoid) -> the debris bridge (leap at bar 4) -> the twin wrecks (eight, leap at bar 11) -> the dead moon
  (drop, leap at 16@2) -> escape to the Landing (leap4 at bar 29). Hazards: frozen stretches (holds), skips (vents),
  colour draining in waves; the Stillness mass chasing and swallowing places. Wire it after Cirra's first clear and
  as a map node before Glassmere.

## Open issues
- The owner's iPhone frame times (?phonecheck) have never been sent.
- Two one-off frame spikes seen once (Drifting Edge 17.5 s, Emberwick finale), not reproduced.
- Darkness (the ambush) is sung; the brief says switch to "Dead of Night" (instrumental) if the vocals clash.
