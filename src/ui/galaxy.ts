// The galaxy's own pictures and words: the planets' names, the map's pieces, the planet card and the story cards.
// The drawings themselves (Eko, Marlow, the Hush, the Lantern, the planets) come from the approved design doc and
// live in galaxy-art.ts as shared SVG symbols; everything here is built from them with <use>.
import { FIG_HUSH, FIG_MARLOW, GALAXY_DEFS } from './galaxy-art';

/** Each level's planet: its name, its symbol, its colour (the Lantern's beam lands on it in this colour). */
export const PLANETS: Record<string, { name: string; sym: string; col: string; rgb: [[number, number, number], [number, number, number], [number, number, number]] }> = {
  heroes: { name: 'Emberwick', sym: 'pl-ember', col: '#ffb37a', rgb: [[255, 200, 150], [233, 104, 63], [184, 69, 47]] },
  skyhigh: { name: 'Cirra', sym: 'pl-cirra', col: '#ff9fe0', rgb: [[255, 205, 240], [220, 120, 205], [150, 84, 190]] },
  blank: { name: 'Glassmere', sym: 'pl-glass', col: '#9fd0ff', rgb: [[232, 244, 255], [140, 180, 245], [92, 124, 214]] },
  invincible: { name: 'Verdance', sym: 'pl-verd', col: '#a8ff8a', rgb: [[214, 255, 170], [86, 186, 116], [40, 122, 92]] },
  royalty: { name: 'The Hollow', sym: 'pl-hollow', col: '#9a7cff', rgb: [[98, 76, 160], [44, 28, 90], [18, 11, 44]] }
};
/** A level's planet name ("Emberwick"); for a B-side, its planet's. */
export const planetName = (id: string): string => (PLANETS[id.replace(/-b$/, '')] ?? PLANETS.heroes).name;

/** Puts the shared symbols in the page once, so any SVG in the game can <use> them. */
export function installDefs(): void {
  if (document.getElementById('galaxyDefs')) return;
  const holder = document.createElement('div');
  holder.innerHTML = `<svg id="galaxyDefs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${GALAXY_DEFS}${DIM}</defs></svg>`;
  document.body.prepend(holder.firstElementChild!);
}

const DIM = '<filter id="dim"><feColorMatrix type="matrix" values=".13 .2 .07 0 0  .13 .2 .07 0 0  .2 .3 .1 0 .03  0 0 0 1 0"/></filter>';
const use = (id: string, x: number, y: number, s = 1, extra = '') => `<use href="#${id}" transform="translate(${x},${y}) scale(${s})" ${extra}/>`;
/** A planet as a round picture, with room for its glow. */
export const planetSvg = (id: string): string => `<svg class="pl" viewBox="-74 -74 148 148" aria-hidden="true"><use href="#${(PLANETS[id] ?? PLANETS.heroes).sym}"/></svg>`;
/** Eko. The hoop takes the current text colour (the Glow the player has chosen). */
export const ekoSvg = (): string => '<svg class="eko-svg" viewBox="-100 -104 200 204" aria-hidden="true"><use href="#eko"/></svg>';
/** The Lantern, the crooked lighthouse at the middle of the map. */
export const lanternSvg = (): string => '<svg class="lantern-svg" viewBox="-84 -134 168 190" aria-hidden="true"><use href="#lantern"/></svg>';

const SKY = (w: number, h: number) => `<rect width="${w}" height="${h}" fill="url(#gSky)"/><rect width="${w}" height="${h}" fill="url(#stars)"/>`;
const scene = (inner: string, w = 640, h = 400) => `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${SKY(w, h)}${inner}</svg>`;
const noLabel = (fig: string) => fig.replace(/<text[^>]*>[^<]*<\/text>/g, '');
/** Marlow with the bell jar taken away (everything from the jar's glass on is the jar). */
const MARLOW_FREE = noLabel(FIG_MARLOW).replace(/<path d="M112 396 V196[\s\S]*$/, '');
const inset = (fig: string, vb: string, x: number, y: number, w: number, h: number) => `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${vb}">${fig}</svg>`;
const beam = (x: number, y: number, col: string, a = 0.3) => `<path d="M330 150 L${x - 14} ${y - 26} L${x + 14} ${y + 26} Z" fill="${col}" opacity="${a}"/>`;
const note = (x: number, y: number, s = 30, rot = 0) => `<text x="${x}" y="${y}" font-size="${s}" fill="#fff1d6" opacity=".9" transform="rotate(${rot} ${x} ${y})">&#9834;</text>`;
/** The Lantern in the middle with its four planets round it; `lit` of them have their beam and their colour back. */
const galaxy = (lit: number, eko = '') => {
  const spots: Array<[string, number, number]> = [['heroes', 96, 118], ['skyhigh', 548, 100], ['blank', 104, 300], ['invincible', 540, 296]];
  return spots.map(([id, x, y], i) => (i < lit ? beam(x, y, PLANETS[id].col) : '')).join('') +
    use('lantern', 320, 300, 1.45, lit === 0 ? 'opacity=".7"' : '') +
    spots.map(([id, x, y], i) => `<g ${i < lit ? '' : 'filter="url(#dim)"'}>${use(PLANETS[id].sym, x, y, 0.62)}</g>`).join('') + eko;
};
const restored = (id: string, n: number) => scene(
  `<path d="M0 360 L0 400 L430 250 L400 150 Z" fill="${PLANETS[id].col}" opacity=".22"/>` + use(PLANETS[id].sym, 410, 200, 2.3) +
  note(250, 120, 34, -12) + note(540, 96, 28, 14) + note(292, 300, 26, 8) + `<g color="#19e3ff">${use('eko', 150, 262, 0.72)}</g>` +
  Array.from({ length: 4 }, (_, i) => `<circle cx="${40 + i * 26}" cy="40" r="8" fill="${i < n ? '#ffd65a' : 'none'}" stroke="#ffd65a" stroke-width="2.5"/>`).join(''));

export interface Frame { art: string; text: string }
/** The story, in chapters. Each plays once, at its moment, and can be skipped. */
export const STORY: Record<string, Frame[]> = {
  open: [
    { art: scene(galaxy(4)), text: 'In the middle of a small galaxy stands the Lantern, a crooked old lighthouse. Its lamp hums, and every planet hums back.' },
    { art: scene(`<path d="M300 150 L640 40 L640 190 Z" fill="#ffe9a6" opacity=".2"/>` + use('lantern', 210, 300, 1.5) + `<g color="#19e3ff">${use('eko', 450, 160, 0.95)}</g>` + note(560, 250, 30, 10)), text: 'Marlow the lampmoth keeps the lamp. Eko is its youngest spark, and likes nothing better than riding the beam.' },
    { art: scene(inset(noLabel(FIG_HUSH), '0 0 640 470', 0, -30, 640, 470)), text: 'Then the Hush came: a quilt of fog that cannot bear a sound. It cracked the lens, jarred every planet\'s song, and carried Marlow off to the Hollow.' }
  ],
  heroes: [{ art: restored('heroes', 1), text: 'The lantern hills of Emberwick are singing again. One song is home, and the Lantern\'s beam finds its way there.' }],
  skyhigh: [{ art: restored('skyhigh', 2), text: 'Cirra\'s clouds have their tune back, and drift in time. Two songs are home.' }],
  blank: [{ art: restored('blank', 3), text: 'Glassmere rings like a bell again, every crystal of it. Three songs are home.' }],
  invincible: [{ art: restored('invincible', 4), text: 'Verdance is loud with leaves. Four songs are home, and at the edge of the galaxy something has noticed.' }],
  hollow: [
    { art: scene(`<rect width="640" height="400" fill="#07041a" opacity=".45"/>` + use('pl-hollow', 350, 190, 3.1) + `<g color="#19e3ff">${use('eko', 96, 318, 0.5)}</g>`), text: 'The Hollow hangs where no beam reaches. The last jar is here, and in it, the keeper of the lamp.' },
    { art: scene(inset(noLabel(FIG_MARLOW), '0 0 640 440', 0, -20, 640, 440)), text: 'Marlow taps on the glass: one, two, three, four. Even here, he keeps the beat. Go on, little spark.' }
  ],
  end: [
    { art: scene(inset(noLabel(FIG_HUSH), '0 0 640 470', 190, 40, 320, 235) + `<g color="#19e3ff">${use('eko', 130, 300, 0.7)}</g>` + note(420, 320, 28, -8)), text: 'The last stitch comes loose. Without its quilt of fog the Hush is small after all, and very, very tired.' },
    { art: scene(galaxy(4, inset(MARLOW_FREE, '0 0 640 440', 372, 150, 250, 172) + `<g color="#19e3ff">${use('eko', 250, 150, 0.5)}</g>`)), text: 'Marlow lights the lamp. Every planet hums back, and this time nothing is put in a jar.' },
    { art: scene(use('lantern', 210, 300, 1.5) + inset(noLabel(FIG_HUSH), '0 0 640 470', 380, 200, 230, 170) + `<text x="560" y="190" font-size="26" fill="#e9e0ff" opacity=".85">z z z</text>` + `<g color="#19e3ff">${use('eko', 96, 120, 0.5)}</g>`), text: 'The Hush is given the quietest song there is, and falls asleep beside the lamp. One more orbit, Eko?' }
  ],
  lens: [
    { art: scene(`<circle cx="330" cy="150" r="230" fill="url(#gAura)"/>` + galaxy(4) + Array.from({ length: 5 }, (_, i) => use('shard', 250 + i * 40, 60 + Math.abs(i - 2) * 14, 1.5)).join('')), text: 'Fifteen shards, and the lens is whole. The Lantern\'s beam reaches further than it ever has.' }
  ]
};
/** The picture on a planet's card: the planet in its own sky, with Eko arriving. */
export function planetCard(id: string, moon = false): string {
  const p = PLANETS[id] ?? PLANETS.heroes;
  return `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${SKY(400, 300)}${use(p.sym, 236, 150, 2)}${moon ? '<rect width="400" height="300" fill="#07041a" opacity=".5"/>' : ''}<g color="#19e3ff">${use('eko', 86, 214, 0.42)}</g></svg>`;
}

/** The title's picture: the Lantern with the four planets round it. Eko's orbit is drawn over it by the page. */
export const titleArt = (): string => `<svg viewBox="60 20 520 340" aria-hidden="true">${galaxy(4)}</svg>`;
