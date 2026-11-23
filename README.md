# ONE MORE ORBIT

A one-button rhythm game: a ball orbits a ring in time with the music, you tap as it crosses each gate, and the last gate on a ring launches it to the next while the camera zooms out. All variety comes from the world around that one tap.

**Status:** four levels on the `one-button` branch (Heroes Tonight, Sky High, Blank, Invincible), one chart each, unlocked in order, with orbs and badges. Still planned: mods, the art-direction pass, the PWA and the native wrapper. The earlier two-hand version is tagged `v4-two-hand-slice`.

**Music licence.** The tracks are NCS releases and are here for private testing only. Releasing the game needs a game licence from NoCopyrightSounds (ncs.io). Credits and that note are in `levels/manifest.json` and shown in the game.

## Ring-hop core on the `gd-core` branch (Sky High feel lab)

The current direction mixes Geometry Dash's forgiving survival structure with the orbit rhythm game. Built so far: a feel lab, Sky High from 0:30 to 1:02 (the build-up into the first drop), plus Record Mode.

- **Two layers of notes.** *Survival presses* (white marks) are the strong beats only, never closer than a beat: a tap on one hops the ball to the next ring, and the flight lasts until the next press (two beats at most, then it rides). *Flow notes* (gold) are every faster note in the music: optional taps on the ring or in mid-flight that can never end the run.
- **Survival is geometry.** An opening is clearable within ±120 ms of its note. Ride past the mark and the ring ends; tap too early near an opening with no flow note around and the ball hits the ring above. Taps far from any opening, or anywhere near a flow note, are free. A crash restarts at once; practice restarts from the section, and the game plays the run-in for you.
- **Flow is rhythm.** Taps within ±40 ms of a note of either layer build the flow meter (the gold arc round the core) and sparkle. An off-beat press takes a notch off; a flow note that goes by untapped costs a sliver. After three off-beat presses in a row the music starts to muffle and the colours drain, a step per further one; two on-beat taps clear it. On hook sections an on-beat tap also plays the hook's pitch.
- **The build-up is a charge.** In sections marked `charge` nothing can end the run. Every note is a flow note, and each one you touch fills the drop's charge (the white arc round the core; three notes in four fills it) while the ring, core and equalizer wind up. Mashing is safe there but leaks charge.
- **The drop is as big as you made it.** A section marked `launch` opens with a press the game takes itself, so the drop cannot be missed. Its size is charge times flow: full gives the flash, shockwave, shattering rings and camera kick; less gives less.
- **Generated layers.** For bars without a hand recording, `autoLayers` in `src/gd/course.ts` picks the presses: notes on the beat first, then off-beat accents with a clear beat either side; everything else becomes a flow note.
- **Per-section settings** live in `levels/<id>/level.json` under `core`: `pulse` (marks breathe with the kick), `charge`, `launch`, `flip` (gravity turns over on the section's first press: you ride the inside and hop inward), `speed` (orbit speed; unused in the lab). `lab` at the top of the file is the stretch that is built.
- **Start at the build-up** on the menu starts runs at the first charge section (not saved), to reach the drop quickly.
- Code: `src/gd/course.ts` (notes to rings), `src/gd/sim.ts` (fixed 240 Hz steps, survival, flow and charge), `src/gd/clock.ts` (smooth clock), `src/gd/run.ts`, `src/gd/render.ts`. `tests/gd.test.ts` covers autoplay in full flow, press spacing and window sizes, "nothing can crash in the build-up", the charge, flow notes never hurting, uneven timing, the muffle steps, mash bots at 8, 10 and 12 taps a second, and the clock.

### Record Mode (dev tool)

Run `npm run dev`, open the menu and choose **Record mode**. Pick a section, a speed (100, 75 or 50%; slower also lowers the pitch) and a snap grid (1/4, 1/8, 1/16, triplets). Choose which layer you are recording (survival presses or flow notes), press Record, wait one bar of count-in and tap what you hear (the pad or any key). The take, snapped to the grid, replaces that layer in the section and leaves the other layer alone. Clicking a square steps it through empty, survival press (blue), flow note (gold). Listen plays the section with a high click on presses and a low one on flow notes; Play this section starts it in practice. In a charge section every note plays as a flow note whatever its layer. **Save** writes `levels/<id>/presses.json` (`t` = presses, `f` = flow notes per bar); bars in it are marked `by: hand` and nothing in `tools/` ever rewrites that file. Bars without a hand recording use the generated chart. Outside the dev server (the single-file build) Save keeps the bars in the browser and shows the JSON to copy.

The earlier one-beat-hop slice of Heroes Tonight is tagged `gd-hop-slice`; the judged one-button game is on the `one-button` branch.

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

Tap gates (accent gates on big hits), bursts of two or three gates on one ring, flip gates (tapping one reverses the ball), portals (jump across the ring), hops over spikes or sweeping beams, slingshots to a new planet, mini mode, speed changes (`lap`), inward jumps and rockets, orbit shapes (circle, ellipse, rounded square), camera rotation, tilt and flips, and a look per section. All are set per section or per bar in `levels/<id>/level.json`.

Judging is strict: a tap up to 180 ms before a gate but outside its window is an early miss for that gate, a tap nowhere near a gate breaks the combo and costs health, and each gate is judged once.

## How charts are made (rhythm first)

1. **One followed sound per section.** `follow` in `levels/<id>/level.json` names it (arp, kick, snare, lead); gate colour shows it. Voices are never merged.
2. **Same music = same taps.** Sections sharing a `motif` name are one repeating figure of `cycle` bars and are charted identically every time. Variety comes from the world (shape, speed, camera, look), not the rhythm.
3. **The lead comes from a pitch transcription.** `python tools/lead.py <id> <first bar> <last bar>` finds where each melody note starts and its pitch; the chart uses that rhythm, and the hitsounds play those pitches.
4. `python tools/chart.py <id>` composes every bar from its `plan`, writes `levels/<id>/sheet.json` (one readable line per bar; set `"by": "hand"` on a bar you edit and it is kept), compiles `chart.json`, and **warns** about any tap where the followed sound is weak and any repeat charted differently.
5. `python tools/preview.py <id>` renders the excerpt with a click on every tap to `../v4-chart-previews/<id>.mp3`, to check the chart by ear.
6. Ring speed (`lap`) is constant within a section, so the gap between two gates always reads as time.

```bash
python tools/lead.py skyhigh 1 42 C4 A6       # transcribe the melody (once per song)
python tools/chart.py skyhigh                 # compose + compile + warnings
python tools/chart.py skyhigh --motifs        # show the motifs it found
python tools/chart.py skyhigh --explain 26 42 # bar by bar
python tools/preview.py skyhigh               # listening preview
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
