# ONE MORE ORBIT

A one-button rhythm game. A ball rides a ring in time with the music. Tap on each white mark to hop to the next ring; tap the gold notes to stay in flow and charge the drop. Four levels, each with its own mode.

**Version:** 1.0 release candidate 1 (`v1.0-rc1`).

**Music licence.** The four tracks are NCS releases. NoCopyrightSounds requires a game licence before a game using them is published (ncs.io). Each song is one entry in `levels/manifest.json` and one in `src/game/packs.ts`, so a track can be swapped without touching the rest. Credits are shown in Settings as "Song – Artist [NCS Release] · Music provided by NoCopyrightSounds".

## The game

| Level | Difficulty | Mode it introduces |
|---|---|---|
| Heroes Tonight | Easy | Planet hop: slingshots from planet to planet |
| Sky High | Normal | Weave: gravity flips that bounce the ball between two rings |
| Blank | Hard | Spin gates: the opening is a gap in a turning ring; with turns and speed changes |
| Invincible | Insane | Twin orbit: one tap moves two mirrored balls; plus every mode before |

- **Two layers of notes.** *Survival presses* (white marks) sit on strong beats only, never closer than a beat. A tap on one hops the ball to the next ring. *Flow notes* (gold) are every faster note in the music: optional, and they can never end the run.
- **Survival is generous.** An opening is clearable within ±120 ms of its note (±160 ms for the big gold presses and the first press after a planet hop). Riding past a mark, or tapping early right next to one, ends the run. Taps away from any opening, or near a flow note, are free.
- **Flow is rhythm.** Taps within ±40 ms of a note build the flow meter (the gold arc round the core). After three off-beat presses in a row the music starts to muffle; two on-beat taps clear it. Mashing earns no flow.
- **The build-up is a charge.** Nothing can end the run there. Each note you touch fills the drop's charge.
- **The drop is as big as you made it:** charge times flow scales the whole set piece. Chaos stays in the background; the ball, marks and openings are always drawn last on a clean band.
- **Planet hops are fair by rule.** They launch on a strong beat at a phrase boundary, fly for two beats, and nothing can end the run for at least 1.5 beats after landing. The camera arrives first and the landing spot is shown ahead.
- **Entry, crash, finish.** A level opens with a title card and a 3-2-1 on the beat. A crash shows the percent reached and restarts in half a second (a tap restarts at once). The last press launches the ball out through every ring, LEVEL COMPLETE fills to 100 while the music plays out, then the results appear.
- **Practice** restarts from the section you reached, and the game plays the run-in for you. "Practice the build-up and drop" starts two bars before the charge.
- **Orbs and badges.** Clearing levels and playing well earn ball colours and ten badges.

## Screens

Title, level select (swipeable cards with Best and Practice bars, locks, song preview), play, pause, results, Orbs, Badges, Settings, the 10-second sync check and a short tutorial on the first run of level 1. Phone portrait, phone landscape and desktop each have their own layout. One design system in `src/style.css` (Unbounded for display type); icons and each level card's artwork are SVG in `src/ui/art.ts`.

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

`tests/gd.test.ts` runs on all four levels: autoplay in full flow and full charge, press spacing (at least a beat apart, at most 2.5 a second), opening sizes, every note in exactly one layer, nothing can crash in the build-up, flow notes never hurt, uneven timing, the muffle steps, mash bots, practice run-ins, variety (no mode longer than 8 bars, each level's mode before and in its drop), fair planet hops, and the smooth clock. `tests/charts.test.ts` checks the note data.

## Build it

```bash
npm run build          # static site in dist/
npm run build:single   # one self-contained file: ../one_more_orbit_v4.html
```

The site uses relative paths (`base: './'`), so `dist/` works from any folder.

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
  record.ts           Record Mode (dev server only)
levels/
  manifest.json       tracks, credit lines, licence note
  <id>/level.json     sections and how each bar plays (core.bars)
  <id>/audio.json     generated: bar-1 offset, length, drop time
  <id>/chart.json     the notes, from the audio analysis
  <id>/presses.json   hand-recorded bars (kept by every tool)
  <id>/audit.json     presses moved to stronger sounds
public/audio/         the cut excerpts
tools/                Python and dev tools (see tools/README.md)
tests/
```

`src/game/engine.ts`, `bot.ts`, `rules.ts`, `run.ts`, `src/render/renderer.ts` and `tests/bot.test.ts` belong to the earlier judged one-button game. The current game does not use them.

## Editing a level

Each section in `levels/<id>/level.json` has `bars` (its length) and `core`:

- `bars`: how each bar plays, repeated to fill the section. A bar is words joined by `+`: `up` / `down` / `weave`, `spin`, `twin`, `sling` (planet hop), `turn`, `fast` / `slow` / `normal`.
- `charge` (a build-up), `smash` (the section opens with the drop's big press), `pulse`, `record` (a passage worth recording by hand).

Heroes Tonight, Blank and Invincible are generated by `tools/_levels.py`; Sky High's file is hand-kept. Run `npm test` after any change.

## Dev tools

- **Record Mode** (`npm run dev`, then Settings): record survival presses or flow notes by tapping along at 100, 75 or 50% speed, snapped to a grid. Saved bars go to `levels/<id>/presses.json` marked `by: hand`; no tool overwrites them.
- **Listening previews:** `npx vite-node tools/export-layers.ts`, then `python tools/preview.py <id>` renders the song with a click on every press and a tick on every flow note.
- **Screenshots:** with the dev server running, in the page's console: `await import('/tools/stage-shots.js'); await __stage('levels')`. It stages each screen with sample progress, muted, and saves nothing.
- `python tools/intensity.py` measures each excerpt for the setlist order.

## History

Tags: `v4-two-hand-slice` (two-hand prototype), `gd-hop-slice` (first hop prototype), `v1.0-rc1`. The `one-button` branch holds the earlier judged game.
