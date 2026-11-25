// The galaxy's words and pictures: the planets' names and palettes, the story's chapters, and the mastery badges.
import { describe, expect, it } from 'vitest';
import { BADGES, ORBS } from '../src/game/extras';
import { FINAL, MEMORIES, PACKS } from '../src/game/packs';
import { STARS } from '../src/game/stars';
import { LOGBOOK } from '../src/game/logbook';
import { SCENES as WORLD } from '../src/ui/scenes';
import { STORIES } from '../src/art/storypaint.js';
import { PLANETS, STORY, planetName } from '../src/ui/galaxy';
import { RESULTS } from '../src/art/resultpaint.js';

describe('the galaxy', () => {
  it('every level is a planet with its own name and its own palette for when its colour is home', () => {
    const ids = [...PACKS, FINAL].map((p) => p.level.id);
    expect(Object.keys(PLANETS)).toEqual(ids);
    expect(ids.map(planetName)).toEqual(['Emberwick', 'Cirra', 'Glassmere', 'Verdance', 'The guardian']);
    expect(planetName('skyhigh-b')).toBe('Cirra'); // a moon belongs to its planet
    const hue = (c: number[]) => { const mx = Math.max(...c), mn = Math.min(...c); if (mx === mn) return 0; const d = mx - mn; const h = mx === c[0] ? ((c[1] - c[2]) / d) % 6 : mx === c[1] ? (c[2] - c[0]) / d + 2 : (c[0] - c[1]) / d + 4; return ((h * 60) + 360) % 360; };
    const hues = ids.slice(0, 4).map((id) => hue(PLANETS[id].rgb[1]));
    // no two planets share a colour: their body hues are at least 40 degrees apart
    for (let i = 0; i < hues.length; i++) for (let j = i + 1; j < hues.length; j++) { const d = Math.abs(hues[i] - hues[j]); expect(Math.min(d, 360 - d), `${ids[i]} and ${ids[j]}`).toBeGreaterThanOrEqual(40); }
    for (const id of ids) { expect(PLANETS[id].col).toMatch(/^#[0-9a-f]{6}$/); expect(PLANETS[id].rgb.length).toBe(3); }
  });

  it('the story cards: one for each later world woken, the galaxy\'s edge, the ending, the shards (Emberwick\'s first clear is told by live moments and a memory instead)', () => {
    expect(Object.keys(STORY)).toEqual(['skyhigh', 'blank', 'invincible', 'hollow', 'end', 'lens']);
    for (const p of PACKS.slice(1)) expect(STORY[p.level.id].length, p.level.id).toBe(1); // one card when its world wakes (until its own step)
    for (const f of Object.values(STORY).flat()) {
      // its painted scene exists, for a phone and a desktop: one of the older scenes, or one of World 1's own
      const B = (dev: 'phone' | 'desktop') => (WORLD[f.scene] ? WORLD[f.scene][dev] : STORIES.SCENES[f.scene]?.[dev].B);
      for (const dev of ['phone', 'desktop'] as const) expect(B(dev)?.size, `scene ${f.scene}`).toBeGreaterThanOrEqual(18);
      expect(f.text.length, f.text).toBeGreaterThan(25);
      expect(f.text.length, f.text).toBeLessThanOrEqual(175); // a card is read in a few seconds
    }
    for (const p of PACKS.slice(1)) expect(STORY[p.level.id][0].text).toContain(planetName(p.level.id));
    expect(MEMORIES[PACKS[0].level.id]).toBeTruthy(); // Emberwick gives a memory of Helion back
  });

  it('the canon: Orbin and Helion. Nothing of the old story is left in any words the game shows', () => {
    const words = [...Object.values(STORY).flat().map((f) => f.text), ...Object.values(PLANETS).map((p) => p.name), ...LOGBOOK.flatMap((c) => [c.title, ...c.pages.flat()]), ...ORBS.flatMap((o) => [o.name, o.says, o.how]), ...STARS.flatMap((x) => [x.name, x.what]), ...BADGES.flatMap((b) => [b.name, b.desc])].join(' ');
    for (const w of ['Marlow', 'Lantern', 'Hush', 'Eko', 'Snuffer', 'Keeper', 'lampmoth', 'Hollow']) expect(words.includes(w), w).toBe(false);
    expect(words).toContain('Orbin'); expect(words).toContain('Helion'); expect(words).toContain('the Stillness');
  });

  it('it is our own: no borrowed names anywhere in the story or the planets', () => {
    const words = [...Object.values(STORY).flat().map((f) => f.text), ...Object.values(PLANETS).map((p) => p.name)].join(' ').toLowerCase();
    for (const w of ['mario', 'luma', 'rosalina', 'nintendo', 'bowser', 'peach', 'geometry dash', 'observatory']) expect(words.includes(w), w).toBe(false);
  });

  it('mastery: two badges per planet on top of its clear (every piece of gold, all three shards)', () => {
    for (const p of [...PACKS, FINAL]) {
      const id = p.level.id;
      expect(BADGES.some((b) => b.id === `clear_${id}`)).toBe(true);
      expect(BADGES.find((b) => b.id === `tune_${id}`)?.name).toBe(`In Tune: ${planetName(id)}`);
      expect(BADGES.find((b) => b.id === `mender_${id}`)?.name).toBe(`Shard Finder: ${planetName(id)}`);
    }
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
    expect(BADGES.length).toBe(21);
  });
});

describe('the painted results', () => {
  it('has a sky and a ground for every world a run can end on', () => {
    for (const id of Object.keys(PLANETS)) expect(RESULTS.LAYERS.has(id), id).toBe(true);
    for (const dev of ['phone', 'desktop'] as const) { const L = RESULTS.LAYERS.lay(dev); expect(L.horizon).toBeGreaterThan(0.6); expect(L.B.x + L.B.w).toBeLessThan(1); }
  });
});

describe('the still pool', () => {
  it('opens with the story so far (the owner\'s own text, whole) and gains a chapter with Emberwick; pages are short enough to read in a breath', () => {
    expect(LOGBOOK.map((c) => c.after)).toEqual(['prologue', 'heroes']);
    expect(LOGBOOK[0].title).toBe('The story so far');
    const story = LOGBOOK[0].pages.flat().join(' ');
    expect(story.startsWith('Long before the stars fell silent, the Harmonic Nebula spun to a single, golden pulse.')).toBe(true);
    expect(story.endsWith('Tap to the pulse. Wake the stars. Bring him home.')).toBe(true);
    for (const c of LOGBOOK) {
      expect(c.pages.length, c.title).toBeGreaterThanOrEqual(3);
      expect(c.pages.length, c.title).toBeLessThanOrEqual(6);
      for (const page of c.pages) expect(page.join(' ').split(/\s+/).length, `${c.title}: words on a page`).toBeLessThanOrEqual(90);
    }
    expect(new Set(LOGBOOK.map((c) => c.id)).size).toBe(LOGBOOK.length);
  });
});
