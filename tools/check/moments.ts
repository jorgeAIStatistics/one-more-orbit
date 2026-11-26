// The moments worth a freeze-frame in a level (the owner's checks): every launch (just before, its landing shown), every
// landing, every eight's crossing, and every cluster of quick taps (just before its second tap). Prints JSON:
// [{ t: song seconds, what }]. Usage: npx vite-node tools/check/moments.ts <level id>
import { FIRST, PACKS } from '../../src/game/packs';
import { Level } from '../../src/game/level';
import { buildCourse } from '../../src/gd/course';
import { accentBeats, layers, pitchLookup } from '../../src/gd/presses';
const id = process.argv[2];
const p = id === FIRST.level.id ? FIRST : PACKS.find((q) => q.level.id === id)!;
const c = buildCourse(new Level(p.level, p.audio, p.chart), layers(p), pitchLookup(p), p.level.lab, accentBeats(p));
const out: Array<{ t: number; what: string }> = [];
for (const q of c.presses) if (q.leap && !q.leap.ember) { out.push({ t: q.beat * c.spb - 0.25, what: 'launch, landing shown' }); out.push({ t: q.leap.b1 * c.spb + 0.05, what: 'landing' }); }
for (const pl of p.level.places ?? []) if (pl.shape === 'eight' && pl.cross !== undefined) out.push({ t: pl.cross * c.spb, what: 'the crossing' });
const ps = c.presses.filter((q) => !q.auto);
for (let i = 1; i < ps.length; i++) { const g = (ps[i].beat - ps[i - 1].beat) * c.spb; const before = i > 1 ? (ps[i - 1].beat - ps[i - 2].beat) * c.spb : 9; if (g < 0.45 && before >= 0.45) out.push({ t: ps[i].beat * c.spb - 0.3, what: 'a cluster of quick taps' }); }
out.sort((a, b) => a.t - b.t);
const kept: typeof out = [];
for (const m of out) if (!kept.length || m.t - kept[kept.length - 1].t > 0.12) kept.push({ t: +m.t.toFixed(2), what: m.what }); else kept[kept.length - 1].what += ' + ' + m.what;
console.log(JSON.stringify(kept));
