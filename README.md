# ONE MORE ORBIT

A rhythm game on a ring: a ball orbits in time with the music and you tap, hold, dodge and spin exactly on the beat.

**Status: vertical slice.** One level (Sky High) with NORMAL / HARD / INSANE charts and every mechanic, for playtesting. Not yet in: the other three levels, mods, practice mode, skins and badges.

**Music licence.** The tracks are NCS releases and are here for private testing only. Releasing the game needs a game licence from NoCopyrightSounds (ncs.io). Credits and that note are in `levels/manifest.json` and shown in the game.

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

It prints a `Network:` address such as `http://192.168.1.20:4173`. Open that on the phone. Add `?bot=1` to any address to start in autoplay.

## Test it

```bash
npm test
```

- `tests/charts.test.ts`: every note on the grid, no overlaps, hazards and spinners in the right sections, level at most 2:00, the variety rules (enough mechanics for the length, something new at least every 20 s, no 4-bar pattern repeated unchanged).
- `tests/bot.test.ts`: the autoplay bot plays every chart and must score 100% PERFECT with zero error; a player within ±20 ms must clear without a miss; doing nothing must fail.

## Build it

```bash
npm run build          # static site in dist/ (GitHub Pages, PWA, Capacitor webDir)
npm run build:single   # one self-contained file: ../one_more_orbit_v4.html
```

The site uses relative paths (`base: './'`), so `dist/` works from any folder or inside a Capacitor web view.

## Layout

```
src/
  audio/audio.ts      audio context, clock mapping (tap timestamp -> audio time), track loading, hitsounds
  game/types.ts       level and chart file shapes
  game/rules.ts       timing windows, health, accuracy weights, grades
  game/level.ts       timeline: sections in seconds, ring angle at any beat
  game/engine.ts      judging (taps, holds, colours, dodge, spinner). Pure: no DOM, no audio
  game/bot.ts         the perfect inputs for a chart
  game/run.ts         one attempt: music + clock + engine + bot
  game/packs.ts       the list of playable levels
  render/renderer.ts  canvas drawing, section looks, build-up and drop effects
  main.ts             menus, input, HUD, results, settings, calibration
  save.ts             settings and bests in localStorage
levels/
  manifest.json       tracks, credit lines, licence note
  <id>/level.json     the layout you edit: sections, modes, looks, chart rules
  <id>/audio.json     generated: bar-1 offset, length, sample count, drop time
  <id>/normal.json    generated charts (hard.json, insane.json)
public/audio/         the cut excerpts
tools/                Python: cut excerpts, measure audio, compose charts, audit sync (see tools/README.md)
tests/                chart checks and the autoplay bot
```

## Tuning a level's pacing

Open `levels/<id>/level.json`. Each section has `bars` (its length), `mode` (tap, hold, colour, dodge, spinner, dual), `lap` (beats per trip round the ring), a `look`, and `gen` rules per difficulty. Change `bars` to make a set piece longer or shorter (keep the total the same), then regenerate the charts:

```bash
python tools/chart.py skyhigh
npm test
```

## Adding a level

1. Add the song to `tools/tracks.json` and follow `tools/README.md` to measure it, cut the excerpt and analyse it.
2. Write `levels/<id>/level.json` (copy Sky High's and change the sections).
3. `python tools/chart.py <id>`
4. Add the track to `levels/manifest.json` and one entry to `src/game/packs.ts`.
5. `npm test`

## Sync, in short

- The decoded audio buffer's clock is the only game clock. Song time 0 is bar 1 of the audio file.
- A tap is judged at its input-event timestamp mapped onto the audio clock, minus the output latency the device reports, minus the player's audio offset.
- The picture is drawn at that time plus the player's visual offset.
- Excerpts are MP3s with the gapless header, so decoders return exactly `frames` samples; the loader checks this and measures the start padding if a decoder ignores it.
