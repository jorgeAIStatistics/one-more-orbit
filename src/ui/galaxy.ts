// The galaxy's own pictures and words: the planets' names and palettes, the map's pieces, the planet card, the title
// and the story cards. Everything is drawn by src/art/atlas.ts in one hand: an engraved star atlas, ink and gold leaf
// on dark paper. Colour is what the Hush took: a planet is an engraving until its song is home, then it is painted.
import { INK, LEAF, NOTE, TITLE, flame, globe, glow, hush, ink, jar, lighthouse, line, moth, note, picture, plate, rgba, rng, sphere, star, text, tooth, type RGB } from '../art/atlas';

type Ctx = CanvasRenderingContext2D;
/** Each level's planet: its name, and its palette once restored ([lit, body, shade]); `col` is the lit colour for the page. */
export const PLANETS: Record<string, { name: string; col: string; rgb: [RGB, RGB, RGB] }> = {
  heroes: { name: 'Emberwick', col: '#ffb37a', rgb: [[255, 200, 150], [226, 100, 60], [96, 30, 52]] },
  skyhigh: { name: 'Cirra', col: '#ff9fe0', rgb: [[255, 214, 240], [222, 120, 204], [92, 44, 130]] },
  blank: { name: 'Glassmere', col: '#9fd0ff', rgb: [[232, 244, 255], [120, 168, 240], [34, 52, 128]] },
  invincible: { name: 'Verdance', col: '#a8ff8a', rgb: [[216, 255, 170], [78, 178, 116], [14, 70, 72]] },
  royalty: { name: 'The Hollow', col: '#c9b8ff', rgb: [[255, 214, 160], [150, 96, 190], [40, 22, 84]] }
};
const SONGS: Record<string, string> = { heroes: 'Heroes Tonight', skyhigh: 'Sky High', blank: 'Blank', invincible: 'Invincible' };
/** A level's planet name ("Emberwick"); for a B-side, its planet's. */
export const planetName = (id: string): string => (PLANETS[id.replace(/-b$/, '')] ?? PLANETS.heroes).name;

const cache = new Map<string, string>();
const once = (key: string, make: () => string): string => { let v = cache.get(key); if (!v) { v = make(); cache.set(key, v); } return v; };
/** A planet for the map: an engraving, or (its song home) the same globe in its own colour. The picture leaves room for its glow. */
export const planetPic = (id: string, colour: boolean): string => once(`pl:${id}:${colour}`, () => picture(220, 220, (c) => {
  if (colour) sphere(c, 110, 110, 74, (PLANETS[id] ?? PLANETS.heroes).rgb, 215, rng(id.length * 7 + 3)); else globe(c, 110, 110, 74, 215, rng(id.length * 7 + 3));
}));
/** The Hollow for the map: the eclipse, sewn shut; or, once the Hush sleeps, open and giving its light back. */
export const hollowPic = (open: boolean): string => once(`hollow:${open}`, () => picture(220, 220, (c) => hush(c, 110, 110, 62, rng(9), { seed: 9, open: open ? 1 : 0 })));
/** The Lantern for the map: 168 by 190, its foot at (84, 134). */
export const lanternPic = (): string => once('lantern', () => picture(168, 190, (c) => lighthouse(c, 84, 134, 1, rng(4))));
/** Eko as a small picture, wearing a Glow. */
export const ekoPic = (col: RGB): string => once(`eko:${col.join(',')}`, () => picture(200, 220, (c) => flame(c, 100, 136, 0.62, rng(2), { rays: false, tail: false, hoop: rgba(col), warm: 0.8, halo: 0.48 })));

// ---------------------------------------------------------------- scenes, drawn 1200 by 750
const SPOTS: Array<[string, number, number, number]> = [['heroes', 250, 572, 56], ['skyhigh', 950, 552, 52], ['blank', 290, 214, 48], ['invincible', 925, 210, 54]];
const small = (c: Ctx, n: string, sub: string, x: number, y: number, a = 1) => { text(c, n.toUpperCase(), x, y, `500 23px ${TITLE}`, ink(a), { ls: 6 }); if (sub) text(c, sub, x, y + 25, `italic 500 21px ${NOTE}`, ink(a * 0.8)); };
const heading = (c: Ctx, t: string, sub: string, w: number, h: number) => { text(c, t.toUpperCase(), w / 2, h - 80, `500 44px ${TITLE}`, ink(1), { ls: 22 }); line(c, w / 2 - 170, h - 64, w / 2 + 170, h - 64, 0.5, 0.8); text(c, sub, w / 2, h - 38, `italic 500 23px ${NOTE}`, ink(0.85)); };
/** The whole galaxy as a plate of the atlas: the Lantern, its beams, the road as a constellation; `lit` planets are in colour. */
function galaxy(c: Ctx, w: number, h: number, lit: string[], o: { no?: string; hollow?: boolean; guest?: boolean; marlow?: boolean; eko?: [number, number]; names?: boolean; lamp?: boolean } = {}): void {
  const r = rng(37);
  const L: [number, number] = [600, 410], lamp: [number, number] = [588, 292];
  plate(c, w, h, r, { no: o.no ?? '', cx: L[0], cy: L[1], radii: [110, 200, 290], ticks: 290, stars: 150, clear: (x, y) => Math.hypot(x - 600, y - 84) < 120 });
  const all = lit.length >= 4;
  if (all) { glow(c, 600, 400, 760, [150, 84, 120], 0.28, 'screen'); glow(c, lamp[0], lamp[1], 420, [255, 190, 120], 0.22, 'screen'); } // every song home: colour floods the sheet
  for (const [id, x, y, R] of SPOTS) {
    if (!lit.includes(id)) continue;
    const a = Math.atan2(y - lamp[1], x - lamp[0]), d = Math.hypot(x - lamp[0], y - lamp[1]);
    c.save(); c.globalCompositeOperation = 'screen'; // the beam: a soft cone in the planet's colour, with ruled gold lines in it
    const g = c.createLinearGradient(lamp[0], lamp[1], x, y); g.addColorStop(0, rgba(PLANETS[id].rgb[0], 0.3)); g.addColorStop(1, rgba(PLANETS[id].rgb[0], 0.06));
    c.fillStyle = g; c.beginPath(); c.moveTo(lamp[0], lamp[1]); c.lineTo(lamp[0] + Math.cos(a - 0.15) * d, lamp[1] + Math.sin(a - 0.15) * d); c.lineTo(lamp[0] + Math.cos(a + 0.15) * d, lamp[1] + Math.sin(a + 0.15) * d); c.closePath(); c.fill(); c.restore();
    for (let k = -4; k <= 4; k++) line(c, lamp[0] + Math.cos(a + k * 0.022) * 16, lamp[1] + Math.sin(a + k * 0.022) * 16, lamp[0] + Math.cos(a + k * 0.022) * (d - R - 6), lamp[1] + Math.sin(a + k * 0.022) * (d - R - 6), 0.55 - Math.abs(k) * 0.08, 0.8, LEAF);
  }
  const road: Array<[number, number, string]> = [...SPOTS.map(([id, x, y]): [number, number, string] => [x, y, id]), [600, 84, 'royalty']];
  for (let i = 0; i + 1 < road.length; i++) {
    const [x0, y0, a] = road[i], [x1, y1, b] = road[i + 1], d = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / d, uy = (y1 - y0) / d;
    c.save(); c.setLineDash(lit.includes(a) && lit.includes(b) ? [] : [2, 7]); line(c, x0 + ux * 66, y0 + uy * 66, x1 - ux * 74, y1 - uy * 74, 0.6, 1); c.restore();
  }
  if (o.hollow !== false) hush(c, 600, 84, 52, r, { seed: 9, open: all && o.guest ? 1 : 0 });
  for (const [id, x, y, R] of SPOTS) {
    const la = Math.atan2(lamp[1] - y, lamp[0] - x) * 180 / Math.PI;
    if (lit.includes(id)) sphere(c, x, y, R, PLANETS[id].rgb, la, r); else globe(c, x, y, R, la, r, { a: 0.6 });
    if (o.names !== false) small(c, PLANETS[id].name, lit.includes(id) ? SONGS[id] : 'dark and silent', x, y + R + 32, lit.includes(id) ? 1 : 0.6);
  }
  if (lit.length || o.lamp) glow(c, lamp[0], lamp[1], 120, [255, 214, 150], 0.5);
  lighthouse(c, L[0], L[1], 0.92, r, lit.length > 0 || !!o.lamp);
  if (o.marlow) { moth(c, 470, 330, 0.24, r); note(c, 'Marlow, at his lamp', 330, 300, 446, 322, 'right'); }
  if (o.guest) { hush(c, 742, 430, 26, r, { seed: 5 }); note(c, 'asleep, at last', 860, 470, 770, 440); }
  if (o.eko) flame(c, o.eko[0], o.eko[1], 0.2, r, { rays: false, tail: false, warm: lit.length ? 0.8 : 0 });
  tooth(c, w, h, 0.8);
}
function ekoPlate(c: Ctx, w: number, h: number): void {
  const r = rng(5);
  plate(c, w, h, r, { no: 'PLATE I.', cx: 600, cy: 340, radii: [150, 232, 314], ticks: 314, stars: 150, clear: (x, y) => Math.hypot(x - 600, y - 340) < 322 || y > 610 });
  flame(c, 600, 362, 1, r, { warm: 0.55 });
  note(c, 'the seed: the only gold on him', 800, 392, 612, 374);
  note(c, 'the ring he wears, an orbit', 250, 350, 514, 388, 'right');
  note(c, 'the wisp follows a beat behind', 310, 572, 470, 548, 'right');
  heading(c, 'Eko', 'the youngest spark of the Lantern\'s lamp', w, h);
  tooth(c, w, h, 0.8);
}
function hushPlate(c: Ctx, w: number, h: number, open = 0): void {
  const r = rng(17);
  plate(c, w, h, r, { no: 'PLATE VII.', cx: 600, cy: 310, radii: [240, 318, 396], stars: 0 });
  for (let i = 0; i < 190; i++) { const x = 50 + r() * 1100, y = 50 + r() * 560, d = Math.hypot(x - 600, y - 310); if (d < 205) continue; star(c, x, y, 0.8 + r() * r() * 3, open > 0.5, !open && d < 400 && r() < 0.8); } // near it, the stars are out
  const jars: Array<[number, number]> = [[330, 600], [465, 634], [600, 648], [735, 634], [870, 600]];
  if (!open) for (const [x, y] of jars) { c.strokeStyle = rgba([226, 72, 58], 0.75); c.lineWidth = 0.9; c.beginPath(); c.moveTo(600 + (x - 600) * 0.5, 470); c.quadraticCurveTo(x + (600 - x) * 0.12, 556, x, y - 30); c.stroke(); }
  hush(c, 600, 310, 186, r, { open });
  if (!open) { for (const [x, y] of jars) jar(c, x, y); note(c, 'sewn shut', 846, 282, 742, 306); note(c, 'a hair of light, under the lid', 336, 396, 548, 366, 'right'); note(c, 'the songs it took, and their colours', 960, 560, 882, 596); }
  else { note(c, 'the seam, undone', 846, 282, 700, 300); note(c, 'small, after all', 336, 420, 470, 380, 'right'); }
  heading(c, 'The Hush', open ? 'it only ever wanted quiet' : 'it cannot bear a sound', w, h);
  tooth(c, w, h, 0.8);
}
function marlowPlate(c: Ctx, w: number, h: number, under: boolean): void {
  const r = rng(23);
  plate(c, w, h, r, { no: 'PLATE II.', cx: 600, cy: 330, radii: [250, 330], stars: under ? 60 : 140, clear: (x, y) => Math.hypot(x - 600, y - 330) < 300 });
  if (!under) glow(c, 676, 478, 150, [255, 200, 120], 0.3);
  moth(c, 600, 320, 1.18, r, under);
  note(c, 'eye-spots, ringed in leaf', 930, 250, 752, 262);
  note(c, 'his hand lantern', 900, 500, 690, 462);
  if (under) note(c, 'he taps the glass: one, two, three, four', 270, 560, 380, 500, 'right'); else note(c, 'keeper of the lamp', 270, 400, 420, 330, 'right');
  heading(c, 'Marlow', under ? 'a lampmoth, under glass in the Hollow' : 'a lampmoth, keeper of the Lantern', w, h);
  tooth(c, w, h, 0.8);
}
function restoredPlate(c: Ctx, w: number, h: number, id: string, n: number): void {
  const r = rng(41 + n), p = PLANETS[id];
  plate(c, w, h, r, { no: `PLATE ${['IV', 'V', 'VI', 'VIII'][n - 1]}.`, cx: 790, cy: 330, radii: [230, 300, 370], ticks: 370, stars: 130, clear: (x, y) => Math.hypot(x - 790, y - 330) < 240 });
  glow(c, 790, 330, 520, p.rgb[1], 0.3, 'screen'); // its colour, home: it spills over the plate
  for (let k = -5; k <= 5; k++) line(c, 40, 372 + k * 5, 610, 340 + k * 9, 0.5 - Math.abs(k) * 0.06, 0.8, LEAF);
  sphere(c, 790, 330, 178, p.rgb, 176, r);
  flame(c, 330, 380, 0.6, r, { rays: false, warm: 1 });
  for (let i = 0; i < 4; i++) star(c, 70 + i * 26, 76, 4.4, i < n, i >= n);
  note(c, 'its song is home, and its colour with it', 300, 150, 640, 232);
  heading(c, p.name, `${SONGS[id]}, restored`, w, h);
  tooth(c, w, h, 0.8);
}

/** scene: the painted scene (Afterglow) this card is, by its name in src/art/storypaint.js. draw: the Star Atlas plate, kept with that look. */
export interface Frame { scene: string; draw: (c: Ctx, w: number, h: number) => void; text: string }
const ALL4 = ['heroes', 'skyhigh', 'blank', 'invincible'];
/** The story, in chapters. Each plays once, at its moment, and can be skipped. */
export const STORY: Record<string, Frame[]> = {
  open: [
    { scene: 'lantern', draw: (c, w, h) => galaxy(c, w, h, ALL4, { no: 'PLATE III.', marlow: true, eko: [690, 250] }), text: 'In the middle of a small galaxy stands the Lantern, a crooked old lighthouse. Its lamp hums, and every planet hums back in its own colour.' },
    { scene: 'eko', draw: ekoPlate, text: 'Marlow the lampmoth keeps the lamp. Eko is its youngest spark, and likes nothing better than riding the beam.' },
    { scene: 'hush', draw: (c, w, h) => hushPlate(c, w, h), text: 'Then the Hush came, which cannot bear a sound. It took every planet\'s song, and the colour went with it. It carried Marlow off to the Hollow.' }
  ],
  heroes: [{ scene: 'ember', draw: (c, w, h) => restoredPlate(c, w, h, 'heroes', 1), text: 'Emberwick sings again, and its embers are warm again. One song is home, and the Lantern\'s beam finds its way there.' }],
  skyhigh: [{ scene: 'cirra', draw: (c, w, h) => restoredPlate(c, w, h, 'skyhigh', 2), text: 'Cirra has its tune back, and its clouds are rose again. Two songs are home.' }],
  blank: [{ scene: 'glass', draw: (c, w, h) => restoredPlate(c, w, h, 'blank', 3), text: 'Glassmere rings like a bell, blue to its heart. Three songs are home.' }],
  invincible: [{ scene: 'verd', draw: (c, w, h) => restoredPlate(c, w, h, 'invincible', 4), text: 'Verdance is loud with leaves, and green again. Four songs are home, and at the edge of the galaxy something has noticed.' }],
  hollow: [
    { scene: 'hollow', draw: (c, w, h) => galaxy(c, w, h, ALL4, { no: 'PLATE IX.', eko: [640, 170], names: false }), text: 'The Hollow hangs where no beam reaches and no colour has ever come back. The last jar is there, and in it, the keeper of the lamp.' },
    { scene: 'marlow', draw: (c, w, h) => marlowPlate(c, w, h, true), text: 'Marlow taps on the glass: one, two, three, four. Even here, he keeps the beat. Go on, little spark.' }
  ],
  end: [
    { scene: 'unstitch', draw: (c, w, h) => hushPlate(c, w, h, 1), text: 'The last stitch comes loose, and the light it was holding pours out. Without its seam the Hush is small after all, and very tired.' },
    { scene: 'relight', draw: (c, w, h) => marlowPlate(c, w, h, false), text: 'Marlow lights the lamp. Every planet hums back, and colour runs through the whole galaxy like ink through water.' },
    { scene: 'dawn', draw: (c, w, h) => galaxy(c, w, h, ALL4, { no: 'PLATE X.', guest: true, marlow: true, eko: [690, 250] }), text: 'The Hush is given the quietest song there is, and falls asleep beside the lamp. One more orbit, Eko?' }
  ],
  lens: [
    { scene: 'lens', draw: (c, w, h) => { galaxy(c, w, h, ALL4, { no: 'PLATE XI.', guest: true, names: false }); glow(c, 588, 292, 520, [255, 226, 170], 0.5, 'screen'); }, text: 'Fifteen shards, and the lens is whole. The Lantern\'s beam reaches further than it ever has.' }
  ]
};

/** The picture on a planet's card: its globe on a corner of the plate, engraved or in colour, darker for its moon. */
export const cardPic = (id: string, colour: boolean, moon = false): string => once(`card:${id}:${colour}:${moon}`, () => picture(400, 300, (c, w, h) => {
  const r = rng(61);
  plate(c, w, h, r, { cx: 250, cy: 150, radii: [120, 170], ticks: 170, stars: 40, clear: (x, y) => Math.hypot(x - 250, y - 150) < 110 });
  if (id === 'royalty') hush(c, 250, 150, 78, r, { seed: 9, open: colour ? 1 : 0 });
  else if (colour) { glow(c, 250, 150, 240, PLANETS[id].rgb[1], 0.3, 'screen'); sphere(c, 250, 150, 96, PLANETS[id].rgb, 200, r); } else globe(c, 250, 150, 96, 200, r);
  if (moon) { c.fillStyle = 'rgba(5,4,16,0.5)'; c.fillRect(0, 0, w, h); }
  flame(c, 78, 196, 0.3, r, { rays: false, tail: false, warm: colour ? 0.8 : 0 });
  tooth(c, w, h, 0.8);
}, 1.5));
/** The title's picture: the galaxy as it stands, with the planets whose songs are home in colour. */
export const titlePic = (lit: string[]): string => once(`title:${lit.join(',')}`, () => picture(1200, 750, (c, w, h) => galaxy(c, w, h, lit, { names: false, lamp: true }), 1));
export { INK };
