# ONE MORE ORBIT

A one-button rhythm game: a ball orbits a ring in time with the music, you tap as it crosses each gate, and the last gate on a ring launches it to the next while the camera zooms out. All variety comes from the world around that one tap.

**Status: vertical slice** on the `one-button` branch. One level (Sky High, one chart) for playtesting. Still planned, not built yet: the other three levels, mods (Hidden, Sudden Death, Mirror, Double Time), skins and badges, and the art-direction pass. The earlier two-hand version is tagged `v4-two-hand-slice`.

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

- `tests/charts.test.ts`: every note on the grid, no overlaps, gates at least 22 degrees apart, accents on the drop, hazards and spinners in the right sections, level at most 2:00, the variety rules (enough mechanics for the length, something new at least every 20 s, no 4-bar pattern repeated unchanged).
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
  game/level.ts       timeline: sections, the chain of rings the ball jumps through, orbit shapes
  game/engine.ts      judging for the one tap. Pure: no DOM, no audio
  game/bot.ts         the perfect inputs for a chart
  game/run.ts         one attempt: music + clock + engine + bot
  game/packs.ts       the list of playable levels
  render/renderer.ts  canvas drawing: rings, camera, audio-reactive equalizer, build-up and drop effects
  main.ts             menus, input, HUD, results, settings, calibration
  save.ts             settings and bests in localStorage
levels/
  manifest.json       tracks, credit lines, licence note
  <id>/level.json     the layout you edit: sections, modes, looks, chart rules
  <id>/audio.json     generated: bar-1 offset, length, sample count, drop time
  <id>/sheet.json     the charts as readable bars: composed by the tool, hand-edited bars are kept
  <id>/chart.json     the compiled chart (one per level) plus baked kick/snare energy
public/audio/         the cut excerpts
tools/                Python: cut excerpts, measure audio, compose charts, audit sync (see tools/README.md)
tests/                chart checks and the autoplay bot
```

## One-button elements

Tap gates (accent gates on big hits), bursts of two or three gates on one ring, reversals, speed changes (`lap`), ghost gates that fade before you reach them, spike hops (tap the pad, land on the beat), inward jumps and a rocket outward, orbit shapes (circle, ellipse, square), camera rotation and flips, and a look per section (palette, background, equalizer style). All of them are set per section in `levels/<id>/level.json`.

## How charts are made

Charts are designed from the song's motifs, not picked note by note.

1. `levels/<id>/level.json` is the layout: sections (`bars`, `lap`, `shape`, `jump`, `look`, ...) and a `plan` with one named pattern per bar, e.g. `"B=16 L=8 stack run=3"` (the whole bass riff, the lead on 8ths, an accent on beat 1, bursts of at most three). The vocabulary is listed at the top of `tools/chart.py`.
2. `python tools/chart.py <id>` finds the motifs, composes every bar and writes `levels/<id>/sheet.json`: one readable line per bar with two voices, `B` (bass/kick) and `L` (lead), using `x` tap, `X` accent, `g` ghost, `^` spike hop.
3. Edit any bar in the sheet by hand and set its `"by"` to `"hand"`. Re-running the tool keeps hand-edited bars and recomposes the rest.
4. The tool merges the two voices into one tap stream (never two taps at once, at most three 16ths in a row), checks every note against the audio, bakes the kick/snare energy the visuals react to, and writes `levels/<id>/chart.json` with a difficulty rating.

```bash
python tools/chart.py skyhigh                 # compose + compile
python tools/chart.py skyhigh --motifs        # show the motifs it found
python tools/chart.py skyhigh --explain 26 42 # bar by bar: pattern and voices
```

## Tuning a level's pacing

Each section in `level.json` has `bars` (its length). Change it to make a set piece longer or shorter (keep the total the same), re-run `tools/chart.py`, then `npm test`.

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
