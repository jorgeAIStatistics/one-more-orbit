// The galaxy's words and pictures: the planets' names and palettes, the story's chapters, and the mastery badges.
import { describe, expect, it } from 'vitest';
import { BADGES } from '../src/game/extras';
import { FINAL, PACKS } from '../src/game/packs';
import { STORIES } from '../src/art/storypaint.js';
import { PLANETS, STORY, planetName } from '../src/ui/galaxy';

describe('the galaxy', () => {
  it('every level is a planet with its own name and its own palette for when its colour is home', () => {
    const ids = [...PACKS, FINAL].map((p) => p.level.id);
    expect(Object.keys(PLANETS)).toEqual(ids);
    expect(ids.map(planetName)).toEqual(['Emberwick', 'Cirra', 'Glassmere', 'Verdance', 'The Hollow']);
    expect(planetName('skyhigh-b')).toBe('Cirra'); // a moon belongs to its planet
    const hue = (c: number[]) => { const mx = Math.max(...c), mn = Math.min(...c); if (mx === mn) return 0; const d = mx - mn; const h = mx === c[0] ? ((c[1] - c[2]) / d) % 6 : mx === c[1] ? (c[2] - c[0]) / d + 2 : (c[0] - c[1]) / d + 4; return ((h * 60) + 360) % 360; };
    const hues = ids.slice(0, 4).map((id) => hue(PLANETS[id].rgb[1]));
    // no two planets share a colour: their body hues are at least 40 degrees apart
    for (let i = 0; i < hues.length; i++) for (let j = i + 1; j < hues.length; j++) { const d = Math.abs(hues[i] - hues[j]); expect(Math.min(d, 360 - d), `${ids[i]} and ${ids[j]}`).toBeGreaterThanOrEqual(40); }
    for (const id of ids) { expect(PLANETS[id].col).toMatch(/^#[0-9a-f]{6}$/); expect(PLANETS[id].rgb.length).toBe(3); }
  });

  it('the story is twelve short cards in seven chapters, plus one for the mended lens; every card is a plate to draw and a line to read', () => {
    expect(Object.keys(STORY)).toEqual(['open', 'heroes', 'skyhigh', 'blank', 'invincible', 'hollow', 'end', 'lens']);
    expect(STORY.open.length).toBe(3);
    for (const p of PACKS) expect(STORY[p.level.id].length, p.level.id).toBe(1); // one card when its planet is restored
    expect(STORY.hollow.length).toBe(2);
    expect(STORY.end.length).toBe(3);
    expect(Object.entries(STORY).filter(([k]) => k !== 'lens').flatMap(([, f]) => f).length).toBe(12);
    expect(new Set(Object.values(STORY).flat().map((f) => f.scene)).size).toBe(13); // every card has a scene of its own
    for (const f of Object.values(STORY).flat()) {
      expect(typeof f.draw).toBe('function');
      expect(STORIES.SCENES[f.scene], `scene ${f.scene}`).toBeTruthy(); // its painted scene exists, for a phone and a desktop
      for (const dev of ['phone', 'desktop']) expect(STORIES.SCENES[f.scene][dev].B.size).toBeGreaterThanOrEqual(18);
      expect(f.text.length, f.text).toBeGreaterThan(40);
      expect(f.text.length, f.text).toBeLessThanOrEqual(175); // a card is read in a few seconds
    }
    for (const p of PACKS) expect(STORY[p.level.id][0].text).toContain(planetName(p.level.id));
    // colour is part of the story: it is taken in the opening and comes back at the end
    expect(STORY.open[2].text).toMatch(/colour/);
    expect(STORY.end[1].text).toMatch(/colour/);
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
