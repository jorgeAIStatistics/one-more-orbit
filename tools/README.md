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

   It prints note counts per section and the star rating for each difficulty. Re-run it whenever the layout changes, then run `npm test`.

## How charts follow the music

- Cyan / left follows low sounds (kick, bass). Pink / right follows high sounds (clap, snare, lead, arpeggio).
- A note is only placed where that bar has a measured hit in the layer it follows, on the grid the difficulty allows.
- Hold arcs cover runs of four or more consecutive 16th-note hits: press on the first, release on the last.
- Dodge hazards land on kicks. The spinner covers the whole spinner section.
- `gen` in the layout sets, per difficulty, the finest note value (`grid`), notes per bar (`n`, `nL`, `nR`), the longest burst (`run`), whether hands alternate (`alt`) or may hit together (`chords`).
