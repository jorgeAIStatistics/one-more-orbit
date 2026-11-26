# Checks (Playwright, Chrome)

Run from this folder with the dev server on port 5199. They need `playwright-core` (installed in the project).

- `node hitch.mjs 5199 <label>`: frame times of every level, the cold open and the Landing (a real Chrome window placed off-screen).
- `node jshots2.mjs <outDir> "<t1,t2,...>" <first|0|1|2|3>`: screenshots of a level (bot playing) at song times (phone size).
- `node frame6.mjs <heroes|first|1|2|3>`: readability over a whole level (closest lit marks, Orbin's distance to the edge, path 1.5 s ahead).
- `node rec5.mjs <first|heroes|l1|l2|l3> <outDir> <from> <to>`, then `python mux.py <outDir> <out.mp4> level public/audio/<song>.mp3 0` (with tools/.venv): a recording with its sound.
- `node lvprof.mjs <which> <t0> <t1>`: a CPU profile of a stretch.
