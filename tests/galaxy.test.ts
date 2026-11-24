// The galaxy's words and pictures: the planets' names, the story's chapters, and the mastery badges.
import { describe, expect, it } from 'vitest';
import { BADGES } from '../src/game/extras';
import { FINAL, PACKS } from '../src/game/packs';
import { PLANETS, STORY, planetCard, planetName, titleArt } from '../src/ui/galaxy';
import { GALAXY_DEFS } from '../src/ui/galaxy-art';

const symbols = new Set([...GALAXY_DEFS.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
const used = (svg: string) => [...svg.matchAll(/(?:href="#|url\(#)([^")]+)/g)].map((m) => m[1]);

describe('the galaxy', () => {
  it('every level is a planet with its own name, picture and colour', () => {
    const ids = [...PACKS, FINAL].map((p) => p.level.id);
    expect(Object.keys(PLANETS)).toEqual(ids);
    expect(new Set(ids.map(planetName)).size).toBe(5);
    expect(ids.map(planetName)).toEqual(['Emberwick', 'Cirra', 'Glassmere', 'Verdance', 'The Hollow']);
    expect(planetName('skyhigh-b')).toBe('Cirra'); // a moon belongs to its planet
    for (const id of ids) { expect(symbols.has(PLANETS[id].sym), id).toBe(true); expect(PLANETS[id].col).toMatch(/^#[0-9a-f]{6}$/); }
  });

  it('the story is twelve short cards in seven chapters, plus one for the mended lens, and every picture is made of drawings that exist', () => {
    expect(Object.keys(STORY)).toEqual(['open', 'heroes', 'skyhigh', 'blank', 'invincible', 'hollow', 'end', 'lens']);
    expect(STORY.open.length).toBe(3);
    for (const p of PACKS) expect(STORY[p.level.id].length, p.level.id).toBe(1); // one card when its planet is restored
    expect(STORY.hollow.length).toBe(2);
    expect(STORY.end.length).toBe(3);
    const main = Object.entries(STORY).filter(([k]) => k !== 'lens').flatMap(([, f]) => f);
    expect(main.length).toBe(12);
    for (const f of Object.values(STORY).flat()) {
      expect(f.text.length, f.text).toBeGreaterThan(40);
      expect(f.text.length, f.text).toBeLessThanOrEqual(170); // a card is read in a few seconds
      expect(f.art.startsWith('<svg')).toBe(true);
      for (const id of used(f.art)) expect(symbols.has(id) || id === 'dim' || id === 'mw', `picture uses #${id}`).toBe(true);
    }
    // each restored planet's card names that planet
    for (const p of PACKS) expect(STORY[p.level.id][0].text).toContain(planetName(p.level.id));
    for (const svg of [titleArt(), planetCard('blank'), planetCard('royalty', true)]) for (const id of used(svg)) expect(symbols.has(id) || id === 'dim', `#${id}`).toBe(true);
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
      expect(BADGES.find((b) => b.id === `mender_${id}`)?.name).toBe(`Lens Mender: ${planetName(id)}`);
    }
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
    expect(BADGES.length).toBe(21);
  });
});
