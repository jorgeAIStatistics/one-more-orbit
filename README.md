# ONE MORE ORBIT

A one-button rhythm game. A ball rides a ring in time with the music. Tap on each white mark to hop to the next ring; tap the gold notes to stay in flow and charge the drop. Four levels, each with its own mode.

**Version:** 1.0 release candidate 1 (`v1.0-rc1`).

**Music licence.** The five tracks are NCS releases, used under a game licence from NoCopyrightSounds (ncs.io); the owner holds the licence and confirmed on 2026-11-23 that it covers Royalty, the track of the level behind the gate. Each song is one entry in `levels/manifest.json` and one in `src/game/packs.ts`, so a track can be swapped without touching the rest. Credits are shown in Settings as "Song – Artist [NCS Release] · Music provided by NoCopyrightSounds".

## The game

| Level | Difficulty | Mode it introduces |
|---|---|---|
| Heroes Tonight | Easy | Planet hop: slingshots from planet to planet |
| Sky High | Normal | Weave: gravity flips that bounce the ball between two rings |
| Blank | Hard | Spin gates: the opening is a gap in a turning ring; with turns and speed changes |
| Invincible | Insane | Twin orbit: one tap moves two mirrored balls; plus every mode before |
| Royalty (behind the gate) | Singularity | Tethers: red rails you must hold; with weave, spin gates and planet hops |

- **Two layers of notes.** *Survival presses* (white marks) sit on strong beats only, never closer than a beat. A tap on one hops the ball to the next ring. *Flow notes* (gold) are every faster note in the music: optional, and they can never end the run.
- **Survival is generous.** An opening is clearable within ±120 ms of its note (±160 ms for the big gold presses and the first press after a planet hop). Riding past a mark, or tapping early right next to one, ends the run. Taps away from any opening, or near a flow note, are free.
- **Flow is rhythm.** Taps within ±40 ms of a note build the flow meter (the gold arc round the core). After three off-beat presses in a row the music starts to muffle; two on-beat taps clear it. Mashing earns no flow.
- **Holds** (`"holds": true` in the level file; all four levels). A hop that flies two beats becomes a *gold rail*: tap the white mark as usual and keep holding through the flight (planet hops and long gravity flips too; in the twin orbit both balls ride it). An empty stretch of ring gets a *gold line*: hold from its first gold note and the ball floats along it. Gold along a hold is collected while the button is down; letting go right on the white end bar counts like an on-beat tap. A hold can never end the run, and each one ends at least half a beat before the next white mark. Holding anywhere lifts the ball off its ring. A bar marked `long` is played in two long strides: its presses on beats 2 and 4 fold into the rail before them.
- **Stars.** Each level has three *star trails* (`"stars": [[from, to], …]` in beats): a stretch marked by a dotted line under the ring, with a star on its last piece of gold. Play it clean (every gold note and every piece of gold along its holds, with no tap that meets nothing) and the star is collected. One slip loses that star for the attempt; it never ends the run. A star is kept only when the run that collected it clears the level (not in practice or autoplay). Kept stars show beside each planet on the map, with the total at the top.
- **The build-up is a charge.** Nothing can end the run there. Each note you touch fills the drop's charge.
- **The drop is as big as you made it:** charge times flow scales the whole set piece. Chaos stays in the background; the ball, marks and openings are always drawn last on a clean band.
- **Planet hops are fair by rule.** They launch on a strong beat at a phrase boundary, fly for two beats, and nothing can end the run for at least 1.5 beats after landing. The camera arrives first and the landing spot is shown ahead.
- **Entry, crash, finish.** A level opens with a title card and a 3-2-1 on the beat. A crash shows the percent reached and restarts in half a second (a tap restarts at once). The last press launches the ball out through every ring, LEVEL COMPLETE fills to 100 while the music plays out, then the results appear.
- **Practice** restarts from the section you reached, and the game plays the run-in for you. "Practice the build-up and drop" starts two bars before the charge.
- **Orbs and badges.** Clearing levels and playing well earn ball colours and ten badges.

## Screens

Title, the World 1 map, play, pause, results, Orbs, Badges, Quests, Settings, the 10-second sync check and a short tutorial on the first run of level 1. Phone portrait, phone landscape and desktop each have their own layout. One design system in `src/style.css` (Unbounded for display type); icons and each level's artwork are SVG in `src/ui/art.ts`.

**The map** (`src/game/world.ts` holds its rules, `tests/world.test.ts` checks them). The four levels are planets on one route: Low Orbit, High Orbit, Escape Velocity, Deep Space. Tapping a place moves you there and fills the panel under the map; tapping it again, or PLAY, goes in.

- **Planets** open when the one before is cleared.
- **Moons** are hidden levels, one per planet: its *B-side*. A moon appears when all three of its planet's stars are kept. A B-side is the same song and notes on the night side (`levels/<id>/bside.json`): openings of ±90 ms instead of ±120, two beats of course shown instead of three, the orbit mirrored and faster, the lights down, and the bars re-dealt with mechanics that level never had (the twin orbit stays in Invincible). No star trails. Clearing one gives an orb.
- **The gate** at the end opens on 9 stars, and the last level is behind it: **Royalty**, tier *Singularity* (`levels/royalty/`, `FINAL` in `src/game/packs.ts`; it is not on the route, so stars open it, not a clear). Its rules are harder (`"rules"` in its level file: openings of ±100 ms, 2.5 beats of course shown), it may ask for a press on every beat (2.7 a second at its 160 BPM), and it has three star trails of its own, which makes 15.
- **Tethers** are that level's own mechanic (bar word `tether`): a red rail that must be held. Let go more than 120 ms before its end and the run is over; it is the only hold in the game that can end a run. A tether always starts on a white mark on the beat and is never a planet hop.
- **Quests**: two per level (`src/game/quests.ts`), each a way of clearing it well (the drop at 100%, every hold, 90% on the beat, no stray taps, a streak of 80). A quest is done by a clear that counts. Both quests of a level give an orb.
- **"All levels open"** in Settings is a playtest switch, off by default: it opens every planet and shows every moon; the gate always needs its stars. (`?unlock=1` on the address does the same for one visit.)

## Sync

- The audio clock is the only game clock. A tap is judged at its input timestamp mapped onto the audio clock, minus the output delay the device reports, minus the player's audio offset. The picture is drawn at that time plus the visual offset.
- The **sync check** (tap along to 8 clicks) runs before the first level, and is asked for again when the audio output changes. Bluetooth adds 150 to 250 ms.
- Every tap that meets a note is logged as milliseconds early or late. Results and pause show the average and spread, with a one-tap fix when the taps are consistently off. Settings has a live sync overlay.
- `python tools/audit.py` measures the onset under every generated survival press and moves a weak one to a clearly stronger sound nearby (`levels/<id>/audit.json`). The audio's own onsets sit within about 0 to 8 ms of the grid on all four levels.

## Run it

Needs Node 20 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

On a phone (same Wi-Fi as the computer):

```bash
npm run phone
```

It prints a `Network:` address such as `http://192.168.1.20:4173`. Open that in Safari on the phone.

## Test it

```bash
npm test
```

`tests/gd.test.ts` runs on all four levels: autoplay in full flow and full charge, press spacing (at least a beat apart, at most 2.5 a second), opening sizes, every note in exactly one layer, nothing can crash in the build-up, flow notes never hurt, uneven timing, the muffle steps, mash bots, practice run-ins, variety (no mode longer than 8 bars, each level's mode before and in its drop), fair planet hops, holds (never lethal, time to let go), busy drops (never more than two beats idle, no bar rhythm more than twice running), the star trails (a clean run collects all three; a stray tap, a missed note, a hold let go or mashing loses that one star) and the smooth clock. The same suite runs on the final level (with tether tests) and on the four B-sides, with their tighter openings. `tests/world.test.ts` covers the map's rules and the quests. `tests/charts.test.ts` checks the note data.

## Build it

```bash
npm run build          # static site in dist/
npm run build:single   # one self-contained file: ../one_more_orbit_v4.html
```

The site uses relative paths (`base: './'`), so `dist/` works from any folder.

## Release

- **Website (installable):** `npm run build` writes `dist/` with a web-app manifest, icons, iPhone launch images, a share preview and `sw.js`, which keeps every file (music included) so the game opens offline after the first visit. `.github/workflows/pages.yml` deploys `dist/` to GitHub Pages on every push to `main`. The site's address is `VITE_SITE_URL` in `.env`. `public/privacy.html` and `public/support.html` are the privacy policy and support page.
- **iPhone app:** `npm run ios:sync` builds the site and copies it into the Xcode project in `ios/` (Capacitor 8); `npm run ios:open` opens Xcode. Nothing is loaded from the web. `src/native.ts` is the game's side of haptics, Game Center and backgrounding; `plugins/game-center/` is the Swift plugin. The iOS project has not been compiled yet (it needs Xcode 26 or later).
- **Art:** `npm run icons` redraws the icons, launch images and share preview (`tools/make-icons.py`, needs Pillow).
- **Store material:** `release/app-store-listing.md` (text, Game Center IDs, screenshot notes), `release/screenshots/`, `release/achievements/`, and `release/CHECKLIST.md` (the steps that need your accounts).

## Layout

```
src/
  main.ts             app controller: screens, input, HUD, results, settings, sync check, tutorial
  style.css           the design system
  ui/art.ts           icons and level-card artwork
  save.ts             settings and bests in localStorage (key one_more_orbit_v4)
  audio/audio.ts      audio context, clock mapping, track loading, previews, tap sounds, muffle
  gd/course.ts        notes to rings: presses, flow notes, modes per bar, planet hops
  gd/sim.ts           fixed 240 Hz steps: survival, flow, charge
  gd/run.ts           one attempt: music + clock + sim, crash and finish
  gd/render.ts        canvas drawing: course, camera, equalizer core, drop effects, menu scene
  gd/presses.ts       the two note layers (generated, audited, hand-recorded)
  gd/clock.ts         smooth clock that follows the audio without stepping
  game/packs.ts       the list of levels (one entry per song)
  game/level.ts       sections and timeline of a level
  game/extras.ts      orbs and badges
  native.ts           haptics, Game Center, backgrounding (through Capacitor in the app)
  record.ts           Record Mode (dev server only)
levels/
  manifest.json       tracks, credit lines, licence note
  <id>/level.json     sections and how each bar plays (core.bars)
  <id>/audio.json     generated: bar-1 offset, length, drop time
  <id>/chart.json     the notes, from the audio analysis
  <id>/presses.json   hand-recorded bars (kept by every tool)
  <id>/audit.json     presses moved to stronger sounds
public/audio/         the cut excerpts
plugins/game-center/  the Game Center plugin for the iPhone app (Swift)
ios/                  the Xcode project (Capacitor)
release/              store listing, screenshots, checklist
tools/                Python and dev tools (see tools/README.md)
tests/
```

`src/game/engine.ts`, `bot.ts`, `rules.ts`, `run.ts`, `src/render/renderer.ts` and `tests/bot.test.ts` belong to the earlier judged one-button game. The current game does not use them.

## Editing a level

Each section in `levels/<id>/level.json` has `bars` (its length) and `core`:

- `bars`: how each bar plays, repeated to fill the section. A bar is words joined by `+`: `up` / `down` / `weave`, `spin`, `twin`, `sling` (planet hop), `turn`, `fast` / `slow` / `normal`, `long` (two long strides to hold, for a bar with a press on every beat).
- `charge` (a build-up), `smash` (the section opens with the drop's big press), `pulse`, `record` (a passage worth recording by hand).

Heroes Tonight, Blank and Invincible are generated by `tools/_levels.py`; Sky High's and Royalty's files are hand-kept. Run `npm test` after any change.

## Dev tools

- **Record Mode** (`npm run dev`, then Settings): record survival presses or flow notes by tapping along at 100, 75 or 50% speed, snapped to a grid. Saved bars go to `levels/<id>/presses.json` marked `by: hand`; no tool overwrites them.
- **Listening previews:** `npx vite-node tools/export-layers.ts`, then `python tools/preview.py <id>` renders the song with a click on every press and a tick on every flow note.
- **Screenshots:** with the dev server running, in the page's console: `await import('/tools/stage-shots.js'); await __stage('levels')`. It stages each screen with sample progress, muted, and saves nothing.
- `python tools/intensity.py` measures each excerpt for the setlist order.
- `npx vite-node tools/activity.ts` prints, per section, the presses per second, the longest wait and how often a bar repeats; `node tools/smooth-check.mjs` (dev server running, needs `playwright-core` and Chrome) records the ball's position every frame and reports any one-frame jump.

## History

Tags: `v4-two-hand-slice` (two-hand prototype), `gd-hop-slice` (first hop prototype), `v1.0-rc1`. The `one-button` branch holds the earlier judged game.
