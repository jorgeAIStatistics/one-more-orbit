// The galaxy map, Afterglow: one painted sky (the Ascent). The planetoid where Orbin fell (the Landing) is at the
// bottom; the road climbs past the four sleeping worlds to the galaxy's edge at the top, where the guardian kneels
// under the three shattered rings. There are no cards, buttons or bars: names are written beside the
// planets, the chosen planet's few lines fade in beside it, and the other places (the Lantern, the constellations)
// are things in the picture you tap. The sky is painted once; planets, light, words and Eko are laid over it live.
import { DUSK, K } from '../art/painter.js';
import { CANON } from '../art/canonpaint.js';
import { UI } from '../art/uipaint.js';
import { Actor } from './actor';

type RGB = [number, number, number];
export interface SkyNode {
  /** a level id, a moon's ("heroes-b"), or "gate" for the Hollow */
  id: string; kind: 'planet' | 'moon' | 'hollow'; of: string; name: string; song: string; by: string;
  /** home: its song and colour are back. open: playable, still waking. dark: silent, not yet reachable. */
  state: 'home' | 'open' | 'dark'; best: number; shards: boolean[]; why: string;
  /** it can be flown as a daredevil ('open'), or already has been ('done'); nothing where it cannot */
  dare?: 'open' | 'done';
  /** a few words in place of its shards while it is not chosen: the next world, stirring ("is waking…") */
  hook?: string;
}
export interface SkyInfo {
  nodes: SkyNode[]; lens: string;
  /** the stars lit so far, in words; nothing until the gallery is open */
  lit: string;
  /** the Lantern relights room by room: the hearth (Eko's glows) with the first song home, the gallery (the star chart) with the second */
  rooms: { glows: boolean; stars: boolean };
}
/**
 * A scene played in this sky instead of the map (the prologue): it says where the camera looks and how much of its
 * colour each world has, and paints its own things over the worlds. No names are written and nothing can be tapped.
 */
export interface SkyStage {
  x: number; y: number; z: number;
  /** each world's colour, 0 (dark and silent) to 1 (its song is home) */
  planets: Record<string, number>;
  /** drawn over the worlds, in the painting's own coordinates (the camera is already applied) */
  paint: (c: CanvasRenderingContext2D) => void;
}
export type SkyHit = { kind: 'node'; id: string } | { kind: 'practise' | 'dare' | 'glows' | 'settings' | 'stars' | 'pool' | 'title' | 'sky' };

const T = DUSK.tools;
const SERIF = '"Cormorant Garamond", "Hoefler Text", Baskerville, Palatino, Georgia, serif';
const CREAM = '#fff1d8', SAND = '#e6cfae';
const PAL: Record<string, { base: RGB; lit: RGB; dark: RGB; bands: unknown[] }> = {
  heroes: { base: [214, 96, 60], lit: [255, 190, 120], dark: [70, 26, 50], bands: [[-0.2, 0.22, [255, 200, 140], 0.14], [0.3, 0.25, [150, 50, 50], 0.16]] },
  skyhigh: { base: [220, 110, 190], lit: [255, 196, 232], dark: [80, 36, 110], bands: [[-0.1, 0.3, [255, 236, 248], 0.2], [0.4, 0.2, [255, 220, 240], 0.14]] },
  blank: { base: [110, 160, 230], lit: [226, 242, 255], dark: [30, 44, 110], bands: [[0, 0.16, [240, 250, 255], 0.2]] },
  invincible: { base: [70, 160, 110], lit: [196, 250, 160], dark: [14, 60, 66], bands: [[-0.25, 0.25, [220, 255, 170], 0.14]] }
};
const NIGHT: RGB = [22, 18, 56];
const SKY = [[0, [9, 10, 34]], [0.42, [34, 28, 84]], [0.72, [96, 50, 104]], [0.9, [206, 104, 92]], [1, [248, 178, 122]]];
type Side = 'left' | 'right' | 'below';
interface Lay { w: number; h: number; horizon: number; lantern: [number, number, number]; nodes: Record<string, [number, number, number, Side]>; hollow: [number, number, number, number]; hollowAt: [number, number, CanvasTextAlign]; stars: Array<[number, number]>; starsAt: [number, number, CanvasTextAlign]; words: [number, number, CanvasTextAlign]; down: [number, number] }
// Positions on a design sheet (a 390 x 844 phone, a 1440 x 900 desktop), from the approved stills.
const LAYS: Record<'tall' | 'wide', Lay> = {
  tall: { w: 390, h: 844, horizon: 0.93, lantern: [58, 805, 0.52], nodes: { heroes: [112, 646, 40, 'right'], skyhigh: [270, 470, 50, 'left'], blank: [104, 300, 32, 'right'], invincible: [286, 182, 27, 'left'], gate: [200, 44, 30, 'below'] }, hollow: [200, 18, 240, 80], hollowAt: [30, 128, 'left'], stars: [[282, 628], [322, 662], [302, 706], [352, 724], [346, 612]], starsAt: [366, 754, 'right'], words: [98, 772, 'left'], down: [0, 0] },
  wide: { w: 1440, h: 900, horizon: 0.9, lantern: [130, 836, 1.1], nodes: { heroes: [330, 640, 62, 'right'], skyhigh: [640, 462, 84, 'right'], blank: [960, 300, 56, 'right'], invincible: [1170, 160, 46, 'left'], gate: [1300, 70, 46, 'left'] }, hollow: [1440, 0, 330, 230], hollowAt: [1180, 276, 'left'], stars: [[90, 130], [180, 200], [150, 300], [270, 280], [330, 150]], starsAt: [96, 352, 'left'], words: [210, 770, 'left'], down: [0, 0] }
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const cvs = (w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return [c, c.getContext('2d')!]; };

export class SkyMap {
  info: SkyInfo = { nodes: [], lens: '', lit: '', rooms: { glows: true, stars: true } };
  /** the place the camera has come to: a node's id, "lantern", or nothing (the whole sky) */
  chosen: string | null = null;
  private ctx: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement | null = null;
  private key = '';
  private sprites = new Map<string, HTMLCanvasElement>();
  private eko: HTMLCanvasElement | null = null;
  private w = 0; private h = 0; private u = 1; private dpr = 1;
  private L: Lay = LAYS.tall;
  private pos = new Map<string, { x: number; y: number; r: number; side: Side }>();
  private lamp: [number, number] = [0, 0];
  /** where his brother's signal shows, behind the rings; where Ossa's fire is, once it burns */
  private edge: [number, number] = [0, 0];
  private fire: [number, number] | null = null;
  private orbin = new Actor('orbin');
  /** a line the hub says once, on coming home ("One star awake. He's a little clearer.") */
  private said = { text: '', at: -1 };
  say(text: string): void { this.said = { text, at: -1 }; }
  private z = 1; private fx = 0; private fy = 0; private ex = 0; private ey = 0;
  private shown = ''; private fade = 0; private launchAt = -1; private t = 0;
  private hits: Array<{ x: number; y: number; w: number; h: number; hit: SkyHit }> = [];
  private screenHits: Array<{ x: number; y: number; w: number; h: number; hit: SkyHit }> = [];

  constructor(private canvas: HTMLCanvasElement) { this.ctx = canvas.getContext('2d')!; }

  /** a scene that has taken the sky over (the prologue), or nothing */
  stage: SkyStage | null = null;
  /** Where things are in the painting at this screen size: its size, its unit, the lamp, and each world. */
  geo(): { w: number; h: number; u: number; tall: boolean; lamp: [number, number]; at: (id: string) => { x: number; y: number; r: number } } {
    this.layout();
    return { w: this.w, h: this.h, u: this.u, tall: this.L === LAYS.tall, lamp: this.lamp, at: (id) => this.pos.get(id) ?? { x: this.w / 2, y: this.h / 2, r: 30 * this.u } };
  }
  /** The sky as a stage: the painting, the worlds in as much colour as the scene gives them, and the scene's own things. */
  private drawStage(now: number): void {
    const S = this.stage!, c = this.ctx, { w, h } = this;
    this.t = now / 1000;
    this.z = Math.max(1, S.z);
    const hw = w / (2 * this.z), hh = h / (2 * this.z);
    this.fx = Math.max(hw, Math.min(w - hw, S.x)); this.fy = Math.max(hh, Math.min(h - hh, S.y));
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.shadowBlur = 0;
    c.fillStyle = '#0b0a22'; c.fillRect(0, 0, w, h);
    c.save();
    c.translate(w / 2, h / 2); c.scale(this.z, this.z); c.translate(-this.fx, -this.fy);
    if (this.bg) c.drawImage(this.bg, 0, 0, w, h);
    c.save(); c.globalCompositeOperation = 'screen';
    for (const id of Object.keys(PAL)) { // the Lantern's beam to each world, as bright as its song is home
      const p = this.pos.get(id)!, a = 0.2 * (S.planets[id] ?? 0);
      if (a <= 0.004) continue;
      const col = PAL[id].lit, ang = Math.atan2(p.y - this.lamp[1], p.x - this.lamp[0]), d = Math.hypot(p.x - this.lamp[0], p.y - this.lamp[1]) + p.r;
      for (const f of [1, 0.62, 0.3]) {
        const hwid = Math.min(0.3, (p.r * 1.3) / d) * f;
        const g = c.createLinearGradient(this.lamp[0], this.lamp[1], p.x, p.y); g.addColorStop(0, K.rgba(col, a * 0.5)); g.addColorStop(1, K.rgba(col, a * 0.14));
        c.fillStyle = g; c.beginPath(); c.moveTo(this.lamp[0], this.lamp[1]); c.lineTo(this.lamp[0] + Math.cos(ang - hwid) * d, this.lamp[1] + Math.sin(ang - hwid) * d); c.lineTo(this.lamp[0] + Math.cos(ang + hwid) * d, this.lamp[1] + Math.sin(ang + hwid) * d); c.closePath(); c.fill();
      }
    }
    c.restore();
    for (const id of Object.keys(PAL)) {
      const p = this.pos.get(id)!, k = Math.max(0, Math.min(1, S.planets[id] ?? 0)), size = p.r * 3.7;
      const dark = this.sprites.get(`${id}:dark`), home = this.sprites.get(`${id}:home`);
      if (dark && k < 1) c.drawImage(dark, p.x - size / 2, p.y - size / 2, size, size);
      if (home && k > 0) { c.globalAlpha = k; c.drawImage(home, p.x - size / 2, p.y - size / 2, size, size); c.globalAlpha = 1; }
    }
    S.paint(c);
    c.restore();
  }

  /** Eko flies into the chosen planet: the camera follows him in. */
  launch(): void { this.launchAt = this.t; }

  private layout(): void {
    const w = window.innerWidth, h = window.innerHeight, dpr = this.canvas.width / Math.max(1, w);
    const home = this.info.nodes.filter((n) => n.kind === 'planet' && n.state === 'home').length;
    const key = `${w}x${h}@${dpr.toFixed(2)}:${home}`;
    if (key === this.key) return;
    this.key = key; this.w = w; this.h = h; this.dpr = dpr;
    const L = (this.L = w > h * 1.15 ? LAYS.wide : LAYS.tall);
    const sx = w / L.w, sy = h / L.h, u = (this.u = Math.min(sx, sy));
    this.pos.clear();
    for (const [id, [x, y, r, side]] of Object.entries(L.nodes)) this.pos.set(id, { x: x * sx, y: y * sy, r: r * u, side });
    const lx = L.lantern[0] * sx, ly = L.lantern[1] * sy, ls = L.lantern[2] * u;
    this.lamp = [lx - 10 * ls, ly - 132 * ls];
    // ---- the sky, painted once: air, stars, the Hollow's curtains, the land, the Lantern, paper grain
    const [bg, c] = cvs(w * dpr, h * dpr);
    c.scale(dpr, dpr);
    const r = K.RNG(211);
    const warm = home / 4; // every song that is home leaves the dusk a little warmer
    const stops = SKY.map(([t, col]) => [t, K.mix(col, [255, 170, 120], (t as number) > 0.6 ? warm * 0.16 : 0)]);
    T.sky(c, w, h, stops, r, 150);
    T.stars(c, w, h * L.horizon, r, Math.round((w * h) / 520), 211);
    // the galaxy's edge: the wall of creeping shadow, the three shattered rings (the three trials), and under them
    // the guardian, kneeling. It answers every star that is reignited: head bowed; head up, its slit lit cold; turned
    // on you when all four are awake; gold, bowed again, when its own star is lit.
    const [hx, hy, hrx, hry] = [L.hollow[0] * sx, L.hollow[1] * sy, L.hollow[2] * u, L.hollow[3] * u];
    c.save(); c.filter = `blur(${18 * u}px)`; c.fillStyle = 'rgba(3,3,10,0.9)'; c.beginPath(); c.ellipse(hx, hy, hrx, hry, 0, 0, Math.PI * 2); c.fill(); c.restore();
    for (let i = 0; i < 30; i++) { const x0 = hx - hrx * 0.95 + r() * hrx * 1.9, len = hry * (0.7 + r() * 1.0); K.brush(c, [[x0, hy - hry * 0.4], [x0 + (hx - x0) * 0.08, hy + len * 0.4], [x0 + (r() - 0.5) * 40 * u, hy + len]], (14 + r() * 28) * u, K.mix([8, 7, 20], [70, 56, 120], r() * r()), r, { passes: 3, alpha: 0.18 }); }
    const gate = this.pos.get('gate')!, gs = gate.r / (30 * u), won = this.info.nodes.some((n) => n.kind === 'hollow' && n.state === 'home');
    this.edge = [gate.x + 6 * u * gs, gate.y - 12 * u * gs];
    CANON.parts.trials(c, gate.x - 14 * u * gs, gate.y - 4 * u * gs, 0.5 * u * gs, K.RNG(41), won ? 0.5 : 0.95);
    CANON.parts.guardian(c, gate.x, gate.y + 84 * u * gs, 0.15 * u * gs, K.RNG(42), won ? 3 : home >= 4 ? 2 : home >= 1 ? 1 : 0);
    // the Landing: the planetoid he fell on. Cold stone and a crater; warmer with every star awake; Ossa's fire by the
    // crater once Emberwick is awake. (The others bring theirs as their worlds wake.)
    const horizon = h * L.horizon, gy = horizon - 30 * u;
    c.save(); c.filter = `blur(${28 * u}px)`; c.fillStyle = `rgba(248,178,122,${0.06 + 0.2 * warm})`; c.fillRect(-40, gy - 30 * u, w + 80, 70 * u); c.restore();
    CANON.parts.ground(c, w, h, gy, K.RNG(17), 0.1 + 0.6 * warm, 5);
    const cx = lx + 34 * u, cy = gy + 44 * u;
    c.fillStyle = 'rgba(6,7,18,0.75)'; c.beginPath(); c.ellipse(cx, cy, 44 * u, 9 * u, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(170,186,230,0.45)'; c.lineWidth = 1.4 * u; c.beginPath(); c.ellipse(cx, cy, 44 * u, 9 * u, 0, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
    this.lamp = [lx + 6 * u, gy + 8 * u];
    if (home >= 1) { const fx = cx + 62 * u, fy = cy - 2 * u; K.glow(c, fx, fy - 8 * u, 70 * u, [255, 150, 80], 0.6); UI.C.flame(c, fx, fy, 1.5 * u, [255, 150, 90], 1); this.fire = [fx, fy]; } else this.fire = null;
    T.finish(c, w, h, 220, 0.5);
    this.bg = bg;
    // ---- each world, painted in each of its three states, lit from the Lantern
    this.sprites.clear();
    for (const id of Object.keys(PAL)) {
      const p = this.pos.get(id)!, P = PAL[id], R = p.r * 1.55, S = R * 3.7;
      const la = (Math.atan2(this.lamp[1] - p.y, this.lamp[0] - p.x) * 180) / Math.PI;
      for (const [st, k, haze, rim] of [['home', 0, 0.34, 0.9], ['open', 0.42, 0.16, 0.55], ['dark', 0.78, 0.04, 0.14]] as Array<[string, number, number, number]>) {
        const [sp, sc] = cvs(S * dpr, S * dpr);
        sc.scale(dpr, dpr);
        T.sphere(sc, S / 2, S / 2, R, K.mix(P.base, NIGHT, k), K.mix(P.lit, [40, 34, 90], k), P.dark, la, K.RNG(id.length * 31 + 7), { bands: st === 'dark' ? [] : P.bands, haze, rim });
        this.sprites.set(`${id}:${st}`, sp);
      }
    }
    const [ek, ec] = cvs(240 * dpr * u, 320 * dpr * u);
    ec.scale(dpr * u, dpr * u);
    T.eko(ec, 150, 120, 0.3, K.RNG(5), { wisp: true });
    this.eko = ek;
    const at = this.pos.get(this.chosen ?? '') ?? this.pos.get('heroes')!;
    this.ex = at.x; this.ey = at.y; this.fx = w / 2; this.fy = h / 2;
  }

  private text(s: string, x: number, y: number, size: number, a: number, align: CanvasTextAlign, col = CREAM, weight = 500): number {
    const c = this.ctx;
    c.font = `italic ${weight} ${size}px ${SERIF}`;
    c.textAlign = align; c.textBaseline = 'alphabetic';
    c.globalAlpha = a; c.fillStyle = col; c.shadowColor = 'rgba(8,6,24,0.75)'; c.shadowBlur = size * 0.5;
    c.fillText(s, x, y);
    c.shadowBlur = 0; c.globalAlpha = 1;
    return c.measureText(s).width;
  }
  /** A shard as a small star of paint: lit, or only the place where one will be. */
  private dab(x: number, y: number, s: number, on: boolean, a = 1): void {
    const c = this.ctx;
    c.globalAlpha = a;
    if (on) { K.glow(c, x, y, s * 5, [255, 220, 150], 0.5 * a); c.fillStyle = 'rgba(255,240,206,0.98)'; c.beginPath(); c.ellipse(x, y, s, s * 0.9, 0.4, 0, Math.PI * 2); c.fill(); }
    else { c.strokeStyle = 'rgba(255,236,206,0.5)'; c.lineWidth = Math.max(1, s * 0.28); c.beginPath(); c.arc(x, y, s * 0.85, 0, Math.PI * 2); c.stroke(); }
    c.globalAlpha = 1;
  }
  private place(n: SkyNode): { x: number; y: number; r: number; side: Side } | undefined {
    if (n.kind !== 'moon') return this.pos.get(n.id);
    const p = this.pos.get(n.of);
    return p && { x: p.x + (p.side === 'left' ? 1 : -1) * p.r * 1.5, y: p.y - p.r * 1.45, r: Math.max(7, p.r * 0.3), side: p.side === 'left' ? 'right' : 'left' };
  }

  draw(now: number, dt: number): void {
    this.layout();
    if (this.stage) { this.drawStage(now); return; }
    const c = this.ctx, { w, h, u } = this, L = this.L;
    const t = (this.t = now / 1000);
    const node = this.info.nodes.find((n) => n.id === this.chosen);
    const at = node && this.place(node);
    const lanternAt = { x: L.lantern[0] * (w / L.w), y: (L.lantern[1] - 60) * (h / L.h) };
    const focus = this.chosen === 'landing' ? lanternAt : at;
    // the camera glides toward the place chosen and leans in a little; quick, never slow
    const fly = this.launchAt >= 0 ? Math.min(1, (t - this.launchAt) / 0.42) : 0;
    const wantZ = fly > 0 ? 1.16 + fly * fly * 3.2 : focus ? 1.16 : 1;
    const k = Math.min(1, dt * (fly > 0 ? 14 : 7));
    const tx = focus ? lerp(w / 2, focus.x, fly > 0 ? 1 : 0.5) : w / 2, ty = focus ? lerp(h / 2, focus.y, fly > 0 ? 1 : 0.5) : h / 2;
    this.z += (wantZ - this.z) * k; this.fx += (tx - this.fx) * k; this.fy += (ty - this.fy) * k;
    // the camera never looks past the edge of the painting
    const hw = w / (2 * this.z), hh = h / (2 * this.z);
    this.fx = Math.max(hw, Math.min(w - hw, this.fx)); this.fy = Math.max(hh, Math.min(h - hh, this.fy));
    if ((this.chosen ?? '') !== this.shown) { this.shown = this.chosen ?? ''; this.fade = 0; }
    this.fade = Math.min(1, this.fade + dt / 0.28);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = '#0b0a22'; c.fillRect(0, 0, w, h);
    c.save();
    c.translate(w / 2, h / 2); c.scale(this.z, this.z); c.translate(-this.fx, -this.fy);
    if (this.bg) c.drawImage(this.bg, 0, 0, w, h);
    this.hits = [];
    const planets = this.info.nodes.filter((n) => n.kind === 'planet');
    // his brother's signal, far behind the rings: thump-thump, a faint gold answer, a little clearer with every star
    { const awake = planets.filter((n) => n.state === 'home').length, ph = (t * 0.55) % 1, beat = Math.max(Math.exp(-ph * 9), ph > 0.18 ? Math.exp(-(ph - 0.18) * 9) : 0), a = 0.16 + 0.11 * awake;
      K.glow(c, this.edge[0], this.edge[1], (16 + 10 * awake + 14 * beat) * u, [255, 206, 120], a * (0.5 + 0.5 * beat)); c.fillStyle = `rgba(255,243,207,${Math.min(1, a * 1.6) * (0.5 + 0.5 * beat)})`; c.beginPath(); c.arc(this.edge[0], this.edge[1], 1.6 * u, 0, Math.PI * 2); c.fill(); }
    if (this.fire) K.glow(c, this.fire[0], this.fire[1] - 8 * u, (46 + 10 * Math.sin(t * 7.3) * Math.sin(t * 3.1)) * u, [255, 150, 80], 0.35);
    // the road: lights from the Landing to world after world and on to the galaxy's edge. A stretch is bright once
    // the star at its near end is awake (the first, from where he fell, always is).
    const stops = [{ x: this.lamp[0] + 20 * u, y: this.lamp[1] - 30 * u, r: 0 }, ...planets.map((n) => this.pos.get(n.id)!), this.pos.get('gate')!];
    for (let i = 0; i + 1 < stops.length; i++) {
      const a = stops[i], b = stops[i + 1], n = Math.round(Math.hypot(b.x - a.x, b.y - a.y) / (15 * u)), done = i === 0 || planets[i - 1]?.state === 'home';
      for (let j = 1; j < n; j++) { const q = j / n, bend = Math.sin(q * Math.PI) * 34 * u * (i % 2 ? -1 : 1), tw = 0.75 + 0.25 * Math.sin(t * 2 + j * 0.7 + i); c.fillStyle = K.rgba([255, 226, 170], (done ? 0.7 : 0.22) * tw); c.beginPath(); c.ellipse(lerp(a.x, b.x, q) + bend * 0.4, lerp(a.y, b.y, q) + bend, 2.3 * u, 1.7 * u, j, 0, Math.PI * 2); c.fill(); }
    }
    // the stars lit so far (the chart is read from the rim) and the Landing's words: places in the picture
    const sx = w / L.w, sy = h / L.h;
    if (this.info.rooms.stars) { // (the constellation is seen once the rim is open)
      c.strokeStyle = 'rgba(255,236,206,0.35)'; c.lineWidth = 1; c.beginPath();
      L.stars.forEach(([x, y], i) => (i ? c.lineTo(x * sx, y * sy) : c.moveTo(x * sx, y * sy))); c.stroke();
      L.stars.forEach(([x, y], i) => this.dab(x * sx, y * sy, (i % 2 ? 2.2 : 3) * u + 0.6, true, 0.75 + 0.25 * Math.sin(t * 1.6 + i * 2)));
    }
    const quiet = this.chosen && this.chosen !== 'landing' ? 0.66 : 0.9; // (small lines have to be read on a phone: never faint)
    // (on a tall screen the count sits low on the right: it steps aside while the lowest world's lines are written there)
    if (!(at && L === LAYS.tall && at.y > h * 0.6)) this.text(this.info.lit, L.starsAt[0] * sx, L.starsAt[1] * sy, 15.5, quiet, L.starsAt[2], SAND);
    const sxs = L.stars.map((p) => p[0] * sx), sys = L.stars.map((p) => p[1] * sy);
    if (this.info.rooms.stars) this.hits.push({ x: Math.min(...sxs) - 20, y: Math.min(...sys) - 20, w: Math.max(...sxs) - Math.min(...sxs) + 40, h: L.starsAt[1] * sy + 4 - Math.min(...sys) + 20, hit: { kind: 'stars' } });
    const [wx, wy, wa] = [L.words[0] * sx, L.words[1] * sy, L.words[2]];
    // (the Lantern itself first: its rooms' words lie over it, and a later place is the one a tap finds)
    this.hits.push({ x: 0, y: lanternAt.y - 60 * u, w: Math.max(190, wx + 170), h: h - lanternAt.y + 60 * u, hit: { kind: 'node', id: 'landing' } });
    if (this.chosen === 'landing') {
      // at the Landing: its places, written large enough to tap
      this.text('the Landing', wx, wy - 88, 26, this.fade, wa, CREAM, 600);
      const rooms: Array<['pool' | 'glows' | 'settings' | 'stars', string, string]> = [['pool', 'the still pool', 'the story so far'], ['glows', 'Ossa’s fire', 'Orbin’s glows'], ['settings', 'the crater', 'settings'], ['stars', 'the rim', 'the stars']];
      rooms.forEach(([kind, room, what], i) => {
        // a place that is not there yet is named, and says what will bring it
        const open = kind === 'settings' || kind === 'pool' || (kind === 'glows' ? this.info.rooms.glows : this.info.rooms.stars);
        const y = wy - 57 + i * 30, rw = this.text(open || kind !== 'glows' ? room : 'a cold hearth', wx, y, 20, this.fade * (open ? 1 : 0.6), wa);
        this.text(open ? what : kind === 'glows' ? 'until Emberwick wakes' : 'dark, until Cirra wakes', wx + rw + 10, y, 15, this.fade * (open ? 0.86 : 0.7), wa, SAND);
        if (open) this.hits.push({ x: wx - 8, y: y - 21, w: 230, h: 30, hit: { kind } });
      });
      this.text(this.info.lens, wx, wy + 56, 15, this.fade * 0.86, wa, SAND);
    } else {
      this.text('the Landing', wx, wy, 18, quiet + 0.1, wa, CREAM, 600);
      this.text(['the still pool', this.info.rooms.glows ? 'Ossa’s fire' : '', 'the crater', this.info.rooms.stars ? 'the rim' : ''].filter(Boolean).join('  ·  '), wx, wy + 19, 14.5, quiet * 0.95, wa, SAND);
      this.text(this.info.lens, wx, wy + 37, 14.5, quiet * 0.95, wa, SAND);
    }
    // what the hub says, once, on coming home
    if (this.said.text) {
      if (this.said.at < 0) this.said.at = t;
      const age = t - this.said.at, a = Math.min(1, age / 1.2) * (1 - Math.max(0, Math.min(1, (age - 7) / 1.5)));
      if (age > 8.5) this.said.text = ''; else this.text(this.said.text, L === LAYS.tall ? w / 2 : wx, wy - (L === LAYS.tall ? 52 : 44), 20, a, L === LAYS.tall ? 'center' : wa, CREAM);
    }

    // the worlds: far ones first, the chosen one last and larger, each with what is written beside it
    const order = [...this.info.nodes].sort((a, b) => Number(a.id === this.chosen) - Number(b.id === this.chosen) || (this.place(a)?.r ?? 0) - (this.place(b)?.r ?? 0));
    for (const n of order) {
      const p = this.place(n);
      if (!p) continue;
      const on = n.id === this.chosen, grow = on ? 1 + 0.5 * this.fade : 1, R = p.r * grow;
      if (n.kind === 'planet') {
        const sp = this.sprites.get(`${n.id}:${n.state}`);
        if (sp) { const S = R * 3.7; c.drawImage(sp, p.x - S / 2, p.y - S / 2, S, S); }
      } else if (n.kind === 'moon') {
        K.glow(c, p.x, p.y, R * 3, [255, 230, 190], n.state === 'home' ? 0.5 : 0.25);
        c.fillStyle = n.state === 'home' ? 'rgba(255,240,214,0.95)' : 'rgba(190,180,210,0.85)'; c.beginPath(); c.arc(p.x, p.y, R, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(20,14,44,0.55)'; c.beginPath(); c.arc(p.x + R * 0.35, p.y - R * 0.1, R * 0.92, 0, Math.PI * 2); c.fill(); // its night side
      } else if (n.state !== 'dark') K.glow(c, p.x, p.y, 70 * u, n.state === 'home' ? [255, 200, 130] : [190, 176, 255], 0.3 + 0.1 * Math.sin(t * 1.4)); // the Hollow, once it can be reached: its eclipse stirs
      const tap = Math.max(R, 30);
      this.hits.push({ x: p.x - tap, y: p.y - tap, w: tap * 2, h: tap * 2, hit: { kind: 'node', id: n.id } });
      const left = p.side === 'left', below = p.side === 'below';
      const al: CanvasTextAlign = below ? 'center' : left ? 'right' : 'left', dir = left ? -1 : 1;
      const x0 = below ? p.x : p.x + dir * (R + 12 * u + 4), dim = n.state === 'dark' ? 0.74 : 0.97;
      if (!on) {
        if (n.kind === 'moon') continue;
        if (n.kind === 'hollow') { this.text(n.name, L.hollowAt[0] * sx, L.hollowAt[1] * sy, 19, n.state === 'dark' ? 0.72 : 0.9, L.hollowAt[2], CREAM, 600); continue; }
        this.text(n.name, x0, p.y + 3, 20, dim * (this.chosen ? 0.82 : 1), al, CREAM, 600);
        if (n.state === 'dark') this.text('asleep', x0, p.y + 21, 14.5, 0.8, al, SAND);
        else if (n.hook) this.text(n.hook, x0, p.y + 22, 15.5, 0.7 + 0.2 * Math.sin(t * 1.7), al);
        else for (let i = 0; i < 3; i++) this.dab(x0 + dir * (6 + i * 14), p.y + 17, 3, n.shards[i], 0.9);
        continue;
      }
      // the chosen one: its few soft lines, fading in beside it
      const a = this.fade, y0 = below ? p.y + R + 40 * u + 20 : p.y - 26;
      this.text(n.name, x0, y0, 34, a, al, CREAM, 600);
      this.text(n.song, x0, y0 + 25, 18, a * 0.92, al);
      this.text(`by ${n.by}`, x0, y0 + 43, 15, a * 0.88, al, SAND);
      if (n.state === 'dark') { this.text('asleep', x0, y0 + 72, 18, a * 0.8, al); this.text(n.why, x0, y0 + 94, 15.5, a * 0.86, al, SAND); continue; }
      const bw = this.text(n.best >= 100 ? 'awake' : n.best > 0 ? `best ${n.best}%` : 'not yet played', x0, y0 + 74, 19, a * 0.95, al);
      if (n.kind !== 'moon') for (let i = 0; i < 3; i++) this.dab(below ? p.x - 16 + i * 16 : x0 + dir * (bw + 16 + i * 16), below ? y0 + 92 : y0 + 68, 4, n.shards[i], a);
      const y1 = y0 + (below ? 118 : 104);
      this.text('tap again to fly in', x0, y1, 16.5, a * 0.9, al);
      if (!n.dare) {
        this.text('or practise', x0, y1 + 30, 15.5, a * 0.88, al, SAND);
        this.hits.push({ x: below ? x0 - 70 : left ? x0 - 130 : x0 - 10, y: y1 + 8, w: 140, h: 40, hit: { kind: 'practise' } });
      } else {
        // a world whose song is home can also be dared: one attempt, and a fall sends you back here (its Daredevil star).
        // The two quiet ways in share a line, each word its own place to tap.
        const dareIt = n.dare === 'done' ? 'or dare it again' : 'or dare it', gap = 26;
        c.font = `italic 500 15.5px ${SERIF}`;
        const pw = c.measureText('or practise').width, dw = c.measureText(dareIt).width, xs = below ? x0 - (pw + gap + dw) / 2 : left ? x0 - (pw + gap + dw) : x0;
        this.text('or practise', xs, y1 + 30, 15.5, a * 0.88, 'left', SAND);
        this.text(dareIt, xs + pw + gap, y1 + 30, 15.5, a * 0.88, 'left', SAND);
        this.hits.push({ x: xs - 12, y: y1 + 8, w: pw + 12 + gap / 2, h: 40, hit: { kind: 'practise' } }, { x: xs + pw + gap / 2, y: y1 + 8, w: dw + gap / 2 + 12, h: 40, hit: { kind: 'dare' } });
      }
    }
    // Eko waits by the place chosen (or the furthest world reached), and drifts
    const base = at ?? this.pos.get([...planets].reverse().find((n) => n.state !== 'dark')?.id ?? 'heroes')!;
    const wantX = fly > 0 ? base.x : base.x + (base.side === 'left' ? 1 : -1) * base.r * (at ? 1.5 : 1) * 0.9, wantY = fly > 0 ? base.y : base.y + base.r * (at ? 1.5 : 1) * (base.y > h * 0.68 ? -1.25 : 1.25); // (above a low world, so he is never over the Lantern's words)
    const ke = Math.min(1, dt * (fly > 0 ? 12 : 3.2));
    this.ex += (wantX - this.ex) * ke; this.ey += (wantY - this.ey) * ke;
    // Orbin waits by the place chosen (at the Landing, on the stone where he fell), and looks up the road
    { const o = this.orbin, home = this.chosen === 'landing' || !this.chosen && false; o.rate = 3; o.set({ x: home ? this.lamp[0] : this.ex + Math.sin(t * 0.9) * 3, y: home ? this.lamp[1] - 26 * u : this.ey + Math.sin(t * 1.5) * 4, s: (fly > 0 ? 1 - fly * 0.6 : 1) * 0.2 * u, lean: fly > 0 ? -0.5 : 0, crest: fly > 0 ? 1 : 0.7, arms: fly > 0 ? 'back' : 'rest', eyes: 'open', look: [0.5, -0.7], glow: 1, beat: 0.5 }, o.s === 1); o.step(dt); o.draw(c); }
    c.restore();
    // the way back down to the title: a quiet word in the corner of the screen itself, so the camera never hides it
    this.screenHits = [];
    if (fly === 0) { this.text('down to the horizon', w - 14, h - 14, 15, 0.84, 'right', SAND); this.screenHits.push({ x: w - 170, y: h - 46, w: 170, h: 46, hit: { kind: 'title' } }); }
    if (fly > 0) { c.fillStyle = `rgba(255,226,180,${Math.min(1, fly * fly) * 0.9})`; c.fillRect(0, 0, w, h); if (fly >= 1 && t - this.launchAt > 1.2) this.launchAt = -1; }
  }

  /** What is under a tap at screen x, y. */
  hit(x: number, y: number): SkyHit {
    for (const b of this.screenHits) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.hit;
    const wx = (x - this.w / 2) / this.z + this.fx, wy = (y - this.h / 2) / this.z + this.fy;
    for (let i = this.hits.length - 1; i >= 0; i--) { const b = this.hits[i]; if (wx >= b.x && wx <= b.x + b.w && wy >= b.y && wy <= b.y + b.h) return b.hit; }
    return { kind: 'sky' };
  }
  /** Back from the play field: the camera is by the planet again, not inside it. */
  settle(): void { this.launchAt = -1; this.z = 1.16; }
}
