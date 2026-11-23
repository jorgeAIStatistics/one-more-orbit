# Level tools

Python scripts that turn a song into a level's audio and charts. They are only needed when adding or re-cutting a song; the game itself does not use Python.

## Setup (once)

```bash
python3 -m venv tools/.venv
tools/.venv/bin/pip install -r tools/requirements.txt
```

`imageio-ffmpeg` brings its own ffmpeg, so nothing else needs installing. Run every script from the project root with `tools/.venv/bin/python`.

The original songs are not in the repo. `tools/tracks.json` points at them (`sourceDir` is relative to the project root; by default the folder above it).

## Steps for a new song

1. **Measure the song.** Add an entry to `tools/tracks.json` with your best guess for `bpm`, then:

   ```bash
   tools/.venv/bin/python tools/sync_report.py --source <id>
   ```

   It scans tempo in 0.01 BPM steps and prints the beat phase. Set `bpm` to the best value and `sourceOffset` to the time of bar 1 (the phase plus a whole number of beats). Check half and double time by ear or by where the snare falls.

2. **Choose the excerpt.** In `tracks.json`, `segments` lists `[first bar, end bar)` ranges of the source (bars count from 0). One range means no cuts; several ranges are spliced on bar lines with a 10 ms crossfade just ahead of the downbeat. `pickupBars` fades in music before level bar 1, `tail` keeps extra seconds after the last bar, `fadeOut` is the closing fade, `dropBar` is the source bar of the main drop.

3. **Cut and encode it.**

   ```bash
   tools/.venv/bin/python tools/excerpt.py <id>
   ```

   Writes `public/audio/<id>.mp3`, `tools/cache/<id>.wav` and `levels/<id>/audio.json`.

4. **Audit the sync** of the cut audio. Mean error should be under 5 ms and flat across the three thirds:

   ```bash
   tools/.venv/bin/python tools/sync_report.py <id>
   ```

5. **Measure what can be heard** at every grid position (kick, snare, lead, sustain):

   ```bash
   tools/.venv/bin/python tools/analyze.py <id>
   ```

6. **Write the layout** in `levels/<id>/level.json`, then **compose the charts**:

   ```bash
   tools/.venv/bin/python tools/chart.py <id>
   ```

   It prints note counts, star ratings and any note with no measured sound under it. Re-run it whenever the layout changes, then run `npm test`.

## How charts follow the music

- The game has one button, so every note is a tap. Two voices are composed and merged: `B` follows low sounds (kick, bass), `L` follows high sounds (lead, arpeggio, clap). Gate colour shows the voice.
- Sections that share a `motif` name are one repeating figure. Per voice, the 16th positions that are hit hard in most repeats are the motif; weaker or occasional hits are ornaments.
- Each bar's `plan` says how each voice is played (`beat`, `8`, `16`, `all`, `half`, `tail`, `off`, or an explicit shape `@x.x.xxx.x.x.xxx.`) plus `stack` (accent on beat 1), `hop` (the bar's bass notes are spike hops), `ghost=B|L|BL` (those gates fade out; `late` for a teaching bar) and `run=`. A note is only kept where the audio really has that sound.
- The result is `levels/<id>/sheet.json`. Hand-edit any bar and mark it `"by": "hand"`; the tool will not touch it again.
- `lap` in the layout is the ring speed: smaller is faster (double-time), larger is slower (half-time).
