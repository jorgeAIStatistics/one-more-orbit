// Writes each level's two note layers, as the game builds them, to tools/cache/<id>.layers.json (for the listening
// previews) and prints a section-by-section summary.   Usage: npx vite-node tools/export-layers.ts
import { writeFileSync } from 'node:fs';
import { PACKS, SLICE } from '../src/game/packs';
import { Level } from '../src/game/level';
import { buildCourse } from '../src/gd/course';
import { accentBeats, handBars, layers, pitchLookup } from '../src/gd/presses';

for (const pack of PACKS.filter((p) => SLICE.includes(p.level.id))) {
  const id = pack.level.id;
  const level = new Level(pack.level, pack.audio, pack.chart);
  const c = buildCourse(level, layers(pack), pitchLookup(pack), pack.level.lab, accentBeats(pack));
  writeFileSync(new URL(`./cache/${id}.layers.json`, import.meta.url), JSON.stringify({
    survival: c.presses.map((p) => ({ beat: p.beat, big: p.smash || p.accent })),
    flow: c.flow.map((f) => ({ beat: f.beat, charge: f.charge }))
  }));
  const hand = handBars(pack).bars;
  console.log(`\n${id}: ${pack.level.difficulty}, ${(level.endTime).toFixed(0)} s, ${pack.audio.bpm} BPM, drop at ${level.dropTime.toFixed(1)} s`);
  for (const s of level.segments) {
    const ps = c.presses.filter((p) => p.beat >= s.beat0 && p.beat < s.beat1);
    const fl = c.flow.filter((f) => f.beat >= s.beat0 && f.beat < s.beat1);
    const off = ps.filter((p) => Math.abs(p.beat - Math.round(p.beat)) > 0.01).length;
    const handBarsIn = Array.from({ length: s.bars }, (_, k) => s.bar0 + k).filter((b) => hand[String(b)]).length;
    const what = Object.entries(s.core ?? {}).filter(([k]) => k !== 'pulse').map(([k, v]) => (v === true ? k : `${k} ${v}`)).join(', ');
    console.log(`  ${s.id.padEnd(8)} ${String(s.t0.toFixed(1)).padStart(5)}s ${s.label.padEnd(7)} follows ${String(s.follow).padEnd(5)} presses ${String(ps.length).padStart(2)} (${off} off the beat)  flow ${String(fl.length).padStart(2)}  ${handBarsIn ? `${handBarsIn} bars by hand` : 'generated'}  ${what}`);
  }
}
