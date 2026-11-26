// The map, redesigned (the owner's brief of 2026-11-26, after Super Mario 3D World's World Star map: its structure and
// clarity, our Afterglow look). The whole of World 1 in one view on a phone: one road of light climbing from the
// Landing at the bottom to the guardian's gate at the top, zig-zagging past each world; every stop a floating
// miniature of its level (asleep: grey and still; relit: glowing, moving, its inhabitant standing on it, its star above
// with its earned stars as small lights). Orbin is on the map and travels the road; a tap on a stop sends him there, a
// tap on the stop he is on (or its Play) opens its card. Two buttons only, Menu and Stars, in a corner. After a first
// clear, the map plays a short story beat (skippable, once).
import { CANON } from '../art/canonpaint.js';
import { COMPANIONS } from '../art/companions.js';
import { DUSK, K } from '../art/painter.js';
import { LANDING } from '../art/landingpaint.js';
import { mass, rings } from '../art/stillness.js';
import { WORLDS as W } from '../art/worldpaint.js';
import { WORLDS2 as W2 } from '../art/world2paint.js';
import { pairNow, type LayerName } from '../art/paintcache';
import { Actor } from './actor';

type RGB = [number, number, number];
const TAU = Math.PI * 2;
const sm = (x: number) => { const t = x < 0 ? 0 : x > 1 ? 1 : x; return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const SERIF = '"Cormorant Garamond", "Hoefler Text", Baskerville, Palatino, Georgia, serif';
const PLAIN = '"Source Sans 3", system-ui, -apple-system, "Segoe UI", sans-serif';
const CREAM = '#fff1d8', SAND = '#e6cfae';

/** one stop on the road, as the game tells the map about it */
export interface StopInfo {
  name: string; song: string; by: string;
  /** home: cleared (relit). open: can be played. dark: not yet */
  state: 'home' | 'open' | 'dark';
  best: number;
  /** its stars (the five of a world's constellation; fewer elsewhere): lit or not */
  lights: boolean[];
  why: string;
  dare?: 'open' | 'done';
  /** a moon: the stop it circles (Orbin flies to that stop; its card is the moon's) */
  of?: string;
  /** false: no practice (the ambush) */
  practise?: boolean;
}
export interface RoadInfo {
  stops: Record<string, StopInfo>;
  /** stars awake (the four worlds), for Helion's signal and the guardian */
  awake: number;
  /** the memories of Helion: small embers by the fire */
  memories: Array<{ id: string; seen: boolean }>;
  /** the Landing's places that are open */
  rooms: { glows: boolean; stars: boolean };
}
export type RoadHit = { kind: 'stop'; id: string } | { kind: 'memory'; id: string } | { kind: 'open' | 'play' | 'practise' | 'dare' | 'menu' | 'stars' | 'close' | 'pool' | 'glows' | 'settings' | 'title' | 'sky' };
export type Beat = 'started' | 'heroes' | 'skyhigh' | 'ambush' | 'blank' | 'invincible';

/** the road's stops, bottom to top, on a 390 x 844 sheet (a phone in portrait); r: the diorama's size */
const STOPS: Array<{ id: string; x: number; y: number; r: number }> = [
  { id: 'landing', x: 196, y: 772, r: 30 }, { id: 'started', x: 92, y: 686, r: 25 }, { id: 'heroes', x: 288, y: 600, r: 33 },
  { id: 'skyhigh', x: 100, y: 508, r: 33 }, { id: 'ambush', x: 246, y: 438, r: 20 }, { id: 'blank', x: 290, y: 340, r: 33 },
  { id: 'invincible', x: 96, y: 246, r: 33 }, { id: 'gate', x: 198, y: 132, r: 36 }
];
const ORDER = STOPS.map((s) => s.id);
const PAL: Record<string, RGB> = { landing: [255, 190, 120], started: [150, 235, 220], heroes: [255, 170, 110], skyhigh: [255, 200, 240], ambush: [190, 180, 230], blank: [170, 215, 255], invincible: [170, 240, 160], gate: [255, 214, 150] };
const LAYERS: Record<string, [LayerName, (hot: boolean) => HTMLCanvasElement]> = {
  started: ['edgeLayer', W.edgeLayer], heroes: ['emberLayer', W.emberLayer], skyhigh: ['cirraLayer', W2.cirraLayer], blank: ['glassLayer', W2.glassLayer], invincible: ['verdLayer', W2.verdLayer], ambush: ['ashLayer', W.ashLayer], landing: ['rocksLayer', W.rocksLayer]
};

export class RoadMap {
  info: RoadInfo = { stops: {}, awake: 0, memories: [], rooms: { glows: false, stars: false } };
  /** the stop Orbin is at (or flying to) */
  at = 'landing';
  /** the stop whose card is open */
  card: string | null = null;
  private ctx: CanvasRenderingContext2D;
  private w = 0; private h = 0; private u = 1; private ox = 0; private oy = 0; private dpr = 1; private key = '';
  private bg: HTMLCanvasElement | null = null;
  private pts: Array<[number, number]> = []; private cum: number[] = []; private sAt: Record<string, number> = {};
  private orbin = new Actor('orbin');
  private s = 0; private sFrom = 0; private sTo = 0; private tGo = -1; private goDur = 0.6; private goSign = 1;
  private z = 1; private zV = 0; private fx = 195; private fy = 422; private fxV = 0; private fyV = 0;
  private userX = 0; private userY = 0; private userZ = 1;
  private t = 0; private cardT = -9; private launchAt = -1; private said = { text: '', at: -1 };
  private hits: Array<{ x: number; y: number; w: number; h: number; hit: RoadHit }> = [];
  private screenHits: Array<{ x: number; y: number; w: number; h: number; hit: RoadHit }> = [];
  private pics = new Map<string, [HTMLCanvasElement | ImageBitmap, HTMLCanvasElement | ImageBitmap]>();
  /** a story beat playing (its kind, its start, what follows), or none */
  private beat: { kind: Beat; t0: number; then: () => void; len: number } | null = null;
  /** how far the road is lit, as a stop index plus a share of the next stretch (animated by the beats) */
  private litTo = 0;

  constructor(private canvas: HTMLCanvasElement) { this.ctx = canvas.getContext('2d')!; }

  // ---------------------------------------------------------------- layout
  private layout(): void {
    const w = window.innerWidth, h = window.innerHeight, dpr = this.canvas.width / Math.max(1, w), key = `${w}x${h}@${dpr.toFixed(2)}`;
    if (key === this.key) return;
    this.key = key; this.w = w; this.h = h; this.dpr = dpr;
    // the whole map fits the height (a phone in portrait); wider screens show more of the galaxy round it, never smaller stops
    this.oy = 58; this.u = Math.min((h - this.oy) / 830, w / 360); this.ox = (w - 390 * this.u) / 2;
    // the road: a smooth curve through the stops (Catmull-Rom), as many points as it needs, with its length along it
    const P = STOPS.map((s) => [s.x, s.y] as [number, number]);
    this.pts = []; this.cum = [0];
    for (let i = 0; i + 1 < P.length; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
      for (let k = 0; k < 24; k++) { const t = k / 24, t2 = t * t, t3 = t2 * t; const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3); this.pts.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]); }
    }
    this.pts.push(P[P.length - 1]);
    for (let i = 1; i < this.pts.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(this.pts[i][0] - this.pts[i - 1][0], this.pts[i][1] - this.pts[i - 1][1]));
    STOPS.forEach((s, i) => { this.sAt[s.id] = this.cum[i * 24]; });
    this.s = this.sFrom = this.sTo = this.sAt[this.at] ?? 0;
    // the galaxy behind it all, painted once: deep air, a spiral of far stars, dust lanes, grain
    const cv = document.createElement('canvas'); cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const c = cv.getContext('2d')!; c.scale(dpr, dpr);
    const r = K.RNG(303);
    DUSK.tools.sky(c, w, h, [[0, [6, 6, 22]], [0.45, [20, 16, 52]], [0.8, [44, 26, 70]], [1, [90, 46, 70]]] as never, r, 60);
    const cx = w / 2, cy = h * 0.45, R = Math.hypot(w, h) * 0.55;
    c.save(); c.globalCompositeOperation = 'screen';
    for (let i = 0; i < 900; i++) { const arm = i % 2, d = Math.pow(r(), 0.8), a = arm * Math.PI + d * 5 + (r() - 0.5) * 0.6; K.glow(c, cx + Math.cos(a) * d * R, cy + Math.sin(a) * d * R * 0.55, (0.6 + 1.6 * r()) * this.u, d < 0.25 ? [255, 230, 200] : [170, 170, 240], 0.18 + 0.4 * r() * (1 - d)); }
    K.glow(c, cx, cy, R * 0.35, [150, 120, 220], 0.18); K.glow(c, cx, h * 0.95, R * 0.4, [255, 150, 110], 0.16);
    c.restore();
    DUSK.tools.stars(c, w, h, r, Math.round((w * h) / 700), 3);
    DUSK.tools.finish(c, w, h, 222, 0.35);
    this.bg = cv;
  }
  private X(x: number): number { return this.ox + x * this.u; }
  private Y(y: number): number { return this.oy + y * this.u; }
  private stop(id: string) { return STOPS.find((s) => s.id === id)!; }
  /** a point on the road at length s (sheet units) */
  private along(s: number): [number, number] {
    const c = this.cum; let lo = 0, hi = c.length - 1;
    s = Math.max(0, Math.min(c[hi], s));
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] <= s) lo = m; else hi = m; }
    const f = (s - c[lo]) / Math.max(1e-6, c[hi] - c[lo]);
    return [lerp(this.pts[lo][0], this.pts[hi][0], f), lerp(this.pts[lo][1], this.pts[hi][1], f)];
  }
  private pic(id: string, hot: boolean): HTMLCanvasElement | ImageBitmap | null {
    const L = LAYERS[id]; if (!L) return null;
    let p = this.pics.get(id); if (!p) { const q = pairNow(L[0], L[1]); if (q) { p = q; this.pics.set(id, q); } }
    return p ? p[hot ? 1 : 0] : null;
  }

  // ---------------------------------------------------------------- what the game asks of it
  /** where Orbin is, at once (no flight) */
  place(id: string): void { this.layout(); this.at = id; this.s = this.sFrom = this.sTo = this.sAt[id] ?? 0; this.tGo = -1; }
  /** send Orbin along the road to a stop: a quick, smooth flight through the stops between */
  go(id: string): void {
    this.layout(); id = this.info.stops[id]?.of ?? id; if (!(id in this.sAt)) return;
    this.card = null; this.intro = null;
    if (id === this.at && this.tGo < 0) return;
    this.sFrom = this.s; this.sTo = this.sAt[id]; this.at = id; this.tGo = this.t;
    this.goDur = 0.45 + Math.min(1.4, Math.abs(this.sTo - this.sFrom) / 700); this.goSign = this.sTo >= this.sFrom ? 1 : -1;
  }
  get travelling(): boolean { return this.tGo >= 0; }
  /** its card; the first time at a world, a short arrival first (the camera comes in close, its name and who is there) */
  openCard(id: string, intro?: [string, string]): void { if (intro) { this.intro = { id, t0: this.t, lines: intro }; this.card = null; } else { this.card = id; this.cardT = this.t; } }
  closeCard(): void { this.card = null; this.intro = null; }
  /** the arrival before a first card, or none */
  private intro: { id: string; t0: number; lines: [string, string] } | null = null;
  say(text: string): void { this.said = { text, at: -1 }; }
  launch(): void { this.launchAt = this.t; }
  settle(): void { this.launchAt = -1; }
  /** out of a level straight into the map: the camera starts in close on the stop, and pulls back */
  arrive(id: string): void { this.place(id); const s = this.stop(id); if (s) { this.fx = s.x; this.fy = s.y; } this.z = 3; this.zV = 0; this.card = null; }
  dragBy(dx: number, dy: number): void { this.userX -= dx / (this.u * this.z); this.userY -= dy / (this.u * this.z); }
  pinch(f: number): void { this.userZ = Math.max(1, Math.min(2.6, this.userZ * f)); }
  /** how far the road is lit: through stop index i (and a share of the stretch after it) */
  lightTo(i: number): void { this.litTo = i; }
  /** a story beat on the map (after a first clear): plays once, a tap skips it; `then` follows */
  playBeat(kind: Beat, then: () => void): void { this.layout(); this.card = null; this.beat = { kind, t0: this.t, then, len: BEAT_LEN[kind] }; }
  get playing(): boolean { return !!this.beat || !!this.intro; }
  skip(): void { if (this.intro) { this.openCard(this.intro.id); this.intro = null; return; } const b = this.beat; if (!b) return; this.beat = null; this.endBeat(b.kind); b.then(); }
  private endBeat(kind: Beat): void {
    const i = ORDER.indexOf(kind === 'started' ? 'heroes' : kind === 'heroes' ? 'skyhigh' : kind === 'skyhigh' ? 'skyhigh' : kind === 'ambush' ? 'blank' : kind === 'blank' ? 'invincible' : 'gate');
    this.litTo = Math.max(this.litTo, i);
    if (kind === 'heroes') this.place('skyhigh');
  }

  // ---------------------------------------------------------------- taps
  hit(x: number, y: number): RoadHit {
    if (this.beat || this.intro) return { kind: 'sky' };
    for (const b of this.screenHits) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.hit;
    const [wx, wy] = this.toSheet(x, y);
    for (let i = this.hits.length - 1; i >= 0; i--) { const b = this.hits[i]; if (wx >= b.x && wx <= b.x + b.w && wy >= b.y && wy <= b.y + b.h) return b.hit; }
    return { kind: 'sky' };
  }
  private toSheet(x: number, y: number): [number, number] {
    const sx = (x - this.w / 2) / this.z + this.X(this.fx), sy = (y - this.h / 2) / this.z + this.Y(this.fy);
    return [(sx - this.ox) / this.u, (sy - this.oy) / this.u];
  }

  // ---------------------------------------------------------------- drawing
  draw(now: number, dt: number): void {
    this.layout();
    const c = this.ctx, { w, h, u } = this, t = (this.t = now / 1000), sdt = Math.min(dt, 0.034);
    // Orbin's flight along the road: eased in and out, a little lift in the middle
    let flyK = 0;
    if (this.tGo >= 0) { const q = Math.min(1, (t - this.tGo) / this.goDur); const e = q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2; this.s = lerp(this.sFrom, this.sTo, e); flyK = Math.sin(q * Math.PI); if (q >= 1) this.tGo = -1; }
    const [px, py] = this.along(this.s);
    // the camera: the whole map, or in a little on a card, or following a beat; on springs (never a cut)
    const beat = this.beat, bq = beat ? Math.min(1, (t - beat.t0) / beat.len) : 0, bt = beat ? t - beat.t0 : 0;
    const fly = this.launchAt >= 0 ? Math.min(1, (t - this.launchAt) / 0.42) : 0;
    let tz = 1, tx = 195, ty = 422;
    if (this.card) { const s = this.stop(this.card); tz = 1.25; tx = lerp(195, s.x, 0.6); ty = lerp(422, s.y, 0.6) + 120; }
    const intro = this.intro, it = intro ? t - intro.t0 : 0;
    if (intro) { const s = this.stop(this.info.stops[intro.id]?.of ?? intro.id); tz = 2.1; tx = s.x; ty = s.y - 10; if (it > 2.8) { this.intro = null; this.openCard(intro.id); } }
    if (beat) [tx, ty, tz] = beatCam(beat.kind, bt, (id) => this.stop(id));
    // after Emberwick: Orbin flies the newly lit road to Cirra
    if (beat?.kind === 'heroes' && bt > 4.4 && this.at !== 'skyhigh') { this.go('skyhigh'); this.goDur = 1.7; }
    if (fly > 0) { tz = 1.25 + fly * fly * 3.5; tx = px; ty = py; }
    if (!beat && !this.card && !intro && fly === 0) { tz *= this.userZ; tx += this.userX; ty += this.userY; }
    const om = fly > 0 ? 16 : 4.5;
    this.zV += (om * om * (tz - this.z) - 2 * om * this.zV) * sdt; this.z += this.zV * sdt;
    this.fxV += (om * om * (tx - this.fx) - 2 * om * this.fxV) * sdt; this.fx += this.fxV * sdt;
    this.fyV += (om * om * (ty - this.fy) - 2 * om * this.fyV) * sdt; this.fy += this.fyV * sdt;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#05060f'; c.fillRect(0, 0, w, h);
    // the galaxy (it moves least: parallax), and dust drifting at its own depth
    const pz = 1 + (this.z - 1) * 0.15;
    c.save(); c.translate(w / 2, h / 2); c.scale(pz, pz); c.translate(-w / 2 - (this.X(this.fx) - w / 2) * 0.08, -h / 2 - (this.Y(this.fy) - h / 2) * 0.08);
    if (this.bg) c.drawImage(this.bg, -w * 0.05 + Math.sin(t * 0.03) * w * 0.03, -h * 0.05 + Math.cos(t * 0.023) * h * 0.02, w * 1.1, h * 1.1);
    c.restore();
    for (let i = 0; i < 40; i++) { const r = K.RNG(i * 11 + 5), x = ((r() * w * 1.3 + t * (2 + 4 * r()) * u) % (w * 1.3)) - w * 0.15 - (this.X(this.fx) - w / 2) * 0.3, y = r() * h - (this.Y(this.fy) - h / 2) * 0.3; K.glow(c, x, y, (2 + 5 * r()) * u, [200, 190, 255], 0.12 + 0.18 * Math.sin(t * 0.6 + i) ** 2); }
    // the map itself, through the camera
    c.save(); c.translate(w / 2, h / 2); c.scale(this.z, this.z); c.translate(-this.X(this.fx), -this.Y(this.fy));
    this.hits = [];
    const I = this.info, awake = I.awake;
    // the gate's backdrop: the shadow rings at the top, Helion's signal beyond them (brighter with every star), the guardian
    this.gate(c, t, beat, bt);
    // the road
    this.road(c, t, beat, bt);
    // the memories: small embers by the fire, off the road
    I.memories.forEach((m, i) => {
      const x = this.X(300 + i * 18), y = this.Y(800 - (i % 2) * 16);
      K.glow(c, x, y, (m.seen ? 9 : 5) * u, [255, 190, 120], m.seen ? 0.7 + 0.2 * Math.sin(t * 2 + i) : 0.2);
      if (m.seen) this.hits.push({ x: 300 + i * 18 - 12, y: 800 - (i % 2) * 16 - 14, w: 24, h: 28, hit: { kind: 'memory', id: m.id } });
    });
    // the stops, each a diorama
    for (const s of STOPS) this.diorama(c, s, t, beat, bt);
    // Orbin, on the road (he leans into his flight; the Kindlings of awake worlds keep near him)
    const o = this.orbin; o.rate = 6;
    o.set({ x: this.X(px), y: this.Y(py) - (14 + 10 * flyK) * u, s: 0.13 * u, lean: flyK * 0.6 * this.goSign, crest: 0.8, arms: flyK > 0.2 ? 'back' : 'rest', eyes: 'open', look: [0.3, -0.6], glow: 1, beat: 0.5 }, o.s === 1);
    o.step(dt); o.draw(c);
    const KD = COMPANIONS.KINDLE as Record<string, number[]>;
    const kin = ['heroes', 'skyhigh', 'blank', 'invincible'].filter((id) => I.stops[id]?.state === 'home' || (beat?.kind === 'ambush' && (id === 'heroes' || id === 'skyhigh')));
    kin.forEach((id, i) => { const a = t * 1.3 + (i / Math.max(1, kin.length)) * TAU; COMPANIONS.kindling(c, this.X(px) + Math.cos(a) * 20 * u, this.Y(py) - 18 * u + Math.sin(a) * 9 * u, 0.12 * u, KD[id], { flap: 0.5 + 0.5 * Math.sin(t * 6 + i), alpha: beat?.kind === 'ambush' ? sm(bt / 2) : 0.9 }); });
    // a stop he is on, with no card: its Play button, under it
    const here = this.stop(this.at);
    if (!beat && !intro && !this.card && !this.travelling && fly === 0 && here && this.at !== 'landing' && I.stops[this.at] && I.stops[this.at].state !== 'dark') {
      const b = this.button('Play', this.X(here.x), this.Y(here.y + here.r * 1.25 + 42), 'center', 1, true, 0.85);
      this.hits.push({ x: (b.x - this.ox) / u, y: (b.y - this.oy) / u, w: b.w / u, h: b.h / u, hit: { kind: 'open' } });
    }
    c.restore();
    // over the camera: the story beat's darkness and words, the card, the two buttons, what the hub says
    this.screenHits = [];
    if (beat) this.beatOver(c, beat.kind, bt);
    if (intro) { const a = sm(it / 0.6) * (1 - sm((it - 2.3) / 0.5)), px = Math.min(1.25, u * 1.15); this.words(intro.lines[0], w / 2, h * 0.2, 26 * px, a); this.words(intro.lines[1], w / 2, h * 0.2 + 30 * px, 19 * px, a * sm((it - 0.5) / 0.6)); }
    if (this.card) this.cardDraw(c, t);
    if (!beat && !intro && !this.card && fly === 0) {
      const m = this.button('Menu', w - 14, 34, 'right', 1, false, 1, true); this.screenHits.push({ ...m, hit: { kind: 'menu' } });
      if (I.rooms.stars) { const st = this.button('Stars', m.x - 10, 34, 'right', 1, false, 1, true); this.screenHits.push({ ...st, hit: { kind: 'stars' } }); }
    }
    if (this.said.text && !beat && !intro && !this.card) {
      if (this.said.at < 0) this.said.at = t;
      const age = t - this.said.at, a = Math.min(1, age / 1.2) * (1 - sm((age - 6) / 1.5));
      if (age > 7.5) this.said.text = ''; else this.words(this.said.text, w / 2, h * 0.16, 20 * Math.min(1.2, u * 1.1), a);
    }
    if (beat && bq >= 1) { this.beat = null; this.endBeat(beat.kind); beat.then(); }
    if (fly > 0) { c.fillStyle = `rgba(255,226,180,${Math.min(1, fly * fly) * 0.9})`; c.fillRect(0, 0, w, h); if (fly >= 1 && t - this.launchAt > 1.2) this.launchAt = -1; }
  }

  /** the gate: the shadow rings, Helion's signal beyond them, the guardian kneeling under them (it answers the stars) */
  private gate(c: CanvasRenderingContext2D, t: number, beat: RoadMap['beat'], bt: number): void {
    const s = this.stop('gate'), x = this.X(s.x), y = this.Y(s.y), u = this.u, awake = this.info.awake;
    const cracked = (this.info.stops.gate?.state ?? 'dark') !== 'dark' ? 1 : beat?.kind === 'invincible' ? sm((bt - 3.5) / 1.5) : 0;
    const won = this.info.stops.gate?.state === 'home';
    // Helion's signal beyond the rings: thump-thump, brighter with every star
    const ph = (t * 0.55) % 1, pulse = Math.max(Math.exp(-ph * 9), ph > 0.18 ? Math.exp(-(ph - 0.18) * 9) : 0) * (beat && (beat.kind === 'heroes' || beat.kind === 'blank' || beat.kind === 'started') && bt > (beat.kind === 'heroes' ? 6.4 : 3) ? 2.2 : 1);
    const sy = y - 96 * u;
    K.glow(c, x + 4 * u, sy - 8 * u, (16 + 9 * awake + 12 * pulse) * u, [255, 206, 120], (0.35 + 0.13 * awake) * (0.55 + 0.45 * pulse));
    c.fillStyle = `rgba(255,243,207,${0.6 + 0.4 * pulse})`; c.beginPath(); c.arc(x + 4 * u, sy - 8 * u, (1.4 + 0.3 * awake) * u, 0, TAU); c.fill();
    c.save(); c.globalAlpha = 1 - 0.6 * cracked; rings(c, x, sy, 74 * u, 20 * u, 0.9, t); c.restore();
    if (cracked > 0) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(255,220,160,${0.6 * cracked})`; c.lineWidth = 1.5 * u; for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU + 0.3; c.beginPath(); c.moveTo(x, sy); c.lineTo(x + Math.cos(a) * 96 * u * cracked, sy + Math.sin(a) * 30 * u * cracked); c.stroke(); } c.restore(); }
    // the guardian: bowed asleep; head up once Glassmere wakes (it stirs in that beat); turned on you at four; gold when lit
    const stir = awake >= 3 ? 1 : beat?.kind === 'blank' ? sm((bt - 1.5) / 2.5) : 0;
    const st = won ? 3 : awake >= 4 ? 2 : stir;
    const shiver = beat?.kind === 'blank' ? Math.sin(bt * 40) * sm((bt - 1.5) / 0.5) * (1 - sm((bt - 3) / 0.6)) * 1.5 * u : 0;
    c.save(); CANON.parts.guardian(c, x + 34 * u + shiver, y + 22 * u, 0.15 * u, K.RNG(42), st); c.restore();
    const eyes = won ? 0 : Math.max(awake >= 3 ? 0.7 : 0, beat?.kind === 'blank' ? sm((bt - 1.6) / 1.4) : 0);
    if (eyes > 0) { const ex = x + 34 * u + shiver + (10 + 14 * stir) * 0.15 * u, ey = y + 22 * u - (614 + 34 * stir) * 0.15 * u; for (const d of [-1, 0, 1]) K.glow(c, ex + d * 3.5 * u, ey, 5 * u, [170, 200, 255], 0.9 * eyes); K.glow(c, ex, ey, 22 * u, [140, 170, 255], 0.25 * eyes); } // (its helm's one slit)
    this.label('The guardian', x, y + 44 * u, this.info.stops.gate?.state ?? 'dark');
    const g = this.info.stops.gate;
    if (g && g.state !== 'dark') this.hits.push({ x: s.x - 60, y: s.y - 110, w: 130, h: 160, hit: { kind: 'stop', id: 'gate' } });
    if (won) this.starAbove({ x: s.x - 60, y: s.y - 20, r: 20 }, [255, 214, 150], g!.lights, t);
  }
  /** the road: gold where it is open, dark broken stone where it is not; small waypoints along it */
  private road(c: CanvasRenderingContext2D, t: number, beat: RoadMap['beat'], bt: number): void {
    const u = this.u, open = this.openTo(beat, bt), total = this.cum[this.cum.length - 1];
    // the Stillness sweeping down the road (after Cirra): the road behind it goes dark for a moment
    const sweep = beat?.kind === 'skyhigh' ? sm((bt - 0.8) / 4) : -1, sweepS = sweep >= 0 ? lerp(total, 0, sweep) : -1;
    for (let s = 0; s < total; s += 9) {
      const [x, y] = this.along(s), [x2, y2] = this.along(s + 6), lit = s <= open && !(sweepS >= 0 && s >= sweepS);
      if (lit) {
        c.strokeStyle = `rgba(255,214,140,${0.85})`; c.lineWidth = 3.2 * u; c.lineCap = 'round';
        c.beginPath(); c.moveTo(this.X(x), this.Y(y)); c.lineTo(this.X(x2), this.Y(y2)); c.stroke();
      } else {
        const r = K.RNG(Math.round(s)); if (r() < 0.22) continue; // (broken: stones missing)
        c.fillStyle = 'rgba(60,56,86,0.85)'; c.strokeStyle = 'rgba(140,130,180,0.25)'; c.lineWidth = 1;
        c.save(); c.translate(this.X((x + x2) / 2), this.Y((y + y2) / 2)); c.rotate(Math.atan2(y2 - y, x2 - x) + (r() - 0.5) * 0.4); c.beginPath(); c.rect(-3 * u, -1.6 * u, 6 * u, 3.2 * u); c.fill(); c.stroke(); c.restore();
      }
    }
    // the glow under the lit road, and its waypoints
    c.save(); c.globalCompositeOperation = 'screen';
    for (let s = 0; s < Math.min(open, sweepS >= 0 ? sweepS : open); s += 44) { const [x, y] = this.along(s); K.glow(c, this.X(x), this.Y(y), 10 * u, [255, 190, 110], 0.22 + 0.1 * Math.sin(t * 2 + s * 0.05)); }
    c.restore();
    for (let s = 22; s < total; s += 44) { const [x, y] = this.along(s); const lit = s <= open; c.fillStyle = lit ? 'rgba(255,236,190,0.95)' : 'rgba(110,104,140,0.7)'; c.beginPath(); c.arc(this.X(x), this.Y(y), (lit ? 2.6 : 2) * u, 0, TAU); c.fill(); }
    if (sweepS >= 0 && sweep > 0) {
      for (let k = 0; k < 7; k++) { const sk = sweepS + k * 70; if (sk > total) break; const [x, y] = this.along(sk); c.save(); c.globalAlpha = 0.85 * (1 - k / 8); mass(c, this.X(x), this.Y(y), (60 - k * 4) * u, (40 - k * 3) * u, { near: 0.9, seed: 5 + k, t }); c.restore(); }
      const [x, y] = this.along(sweepS); c.save(); mass(c, this.X(x), this.Y(y), 95 * u, 70 * u, { near: 1, seed: 5, t }); c.restore();
    }
  }
  /** how far the road is open now (its length), animated by the beats: the next stretch lights stone by stone */
  private openTo(beat: RoadMap['beat'], bt: number): number {
    const base = this.sAt[ORDER[Math.min(ORDER.length - 1, this.litTo)]] ?? 0;
    if (!beat) return base;
    const next = (from: string, to: string, t0: number, len: number) => lerp(this.sAt[from], this.sAt[to], sm((bt - t0) / len));
    switch (beat.kind) {
      case 'started': return next('landing', 'heroes', 1.2, 3);
      case 'heroes': return next('heroes', 'skyhigh', 2.6, 2.4);
      case 'ambush': return next('skyhigh', 'blank', 1.5, 3);
      case 'invincible': return next('invincible', 'gate', 1, 2.6);
      default: return base;
    }
  }
  /** a stop's miniature: asleep (grey, still) or relit (glowing, turning, its inhabitant on it); its star and lights */
  private diorama(c: CanvasRenderingContext2D, s: { id: string; x: number; y: number; r: number }, t: number, beat: RoadMap['beat'], bt: number): void {
    if (s.id === 'gate') return;
    const I = this.info.stops[s.id], u = this.u, x = this.X(s.x), y0 = this.Y(s.y), R = s.r * u, state = s.id === 'landing' ? 'home' : I?.state ?? 'dark';
    const relit = state === 'home', col = PAL[s.id];
    const bob = relit ? Math.sin(t * 1.1 + s.x) * 2.5 * u : 0, y = y0 + bob;
    // its glow, and a shadow of stone under it (it floats)
    if (relit) K.glow(c, x, y, R * 2.2, col, 0.22 + 0.06 * Math.sin(t * 1.4 + s.y), 'screen');
    c.fillStyle = 'rgba(4,4,12,0.35)'; c.beginPath(); c.ellipse(x, y0 + R * 1.15, R * 0.8, R * 0.18, 0, 0, TAU); c.fill();
    const p = this.pic(s.id, relit);
    if (s.id === 'ambush') {
      // a dead moon swallowed in dark (the dark eases back once it has been come through)
      if (p) { const S = (p.width * R * 0.9) / W.R0; c.drawImage(p, x - S / 2, y - S / 2, S, S); }
      c.save(); c.globalAlpha = state === 'home' ? 0.45 : 0.95; mass(c, x + R * 0.2, y - R * 0.1, R * 1.1, R * 0.9, { near: 0.7, seed: 9, t: t * 0.6 }); c.restore();
    } else if (s.id === 'landing') {
      // home: the planetoid with the fire and the vessel's six sockets, lit one per star awake
      if (p) { const S = (p.width * R * 1.1) / W.R0; c.drawImage(p, x - S / 2, y - S / 2, S, S); }
      K.glow(c, x, y - R * 0.7, R * 0.9, [255, 150, 70], 0.55 + 0.12 * Math.sin(t * 7) * Math.sin(t * 3));
      c.fillStyle = 'rgba(255,200,120,0.9)'; c.beginPath(); c.ellipse(x, y - R * 0.72, R * 0.12, R * 0.2, 0, 0, TAU); c.fill();
      for (let i = 0; i < 6; i++) { const a = Math.PI + (i / 5) * Math.PI, sx = x + Math.cos(a) * R * 1.05, sy = y + Math.sin(a) * R * 0.5 + R * 0.25, lit = i < 1 + this.info.awake + (this.info.stops.gate?.state === 'home' ? 1 : 0); K.glow(c, sx, sy, R * 0.14, lit ? (LANDING.STAR_COLS[i % LANDING.STAR_COLS.length] as RGB) : [90, 90, 120], lit ? 0.9 : 0.35); }
    } else if (p) {
      const S = (p.width * R) / W.R0, spin = relit ? Math.sin(t * 0.2 + s.x) * 0.05 : 0;
      c.save(); c.translate(x, y); c.rotate(spin); if (!relit) c.globalAlpha = 0.8; c.drawImage(p, -S / 2, -S / 2, S, S); c.restore();
      if (!relit) { c.save(); c.globalCompositeOperation = 'saturation'; c.fillStyle = 'rgba(128,128,128,0.75)'; c.beginPath(); c.arc(x, y, R * 1.02, 0, TAU); c.fill(); c.restore(); }
      this.details(c, s.id, x, y, R, relit, t, beat, bt);
    }
    // its name, and how it stands; its star above it once relit, its stars as small lights under it
    if (s.id === 'landing') this.label('The Landing', x, y0 + R * 1.25 + 14 * u, 'home');
    else if (I) { this.label(I.name, x, y0 + R * 1.25 + 14 * u, state); if (relit) this.starAbove(s, col, I.lights, t); else if (state === 'open' && I.lights.length) this.slots(x, y0 - R * 1.35, I.lights, t); }
    // its moon, once found: a small grey-blue moon on a slow orbit, a stop of its own (its card is the moon's)
    for (const [mid, M] of Object.entries(this.info.stops)) {
      if (M.of !== s.id) continue;
      const side = s.x < 195 ? -1 : 1, mx = x + side * R * 1.55, my = y0 + R * 0.75 + Math.sin(t * 0.9 + s.y) * 2 * u, mr = R * 0.28;
      K.glow(c, mx, my, mr * 2.4, M.state === 'home' ? [220, 220, 255] : [150, 160, 210], 0.3);
      c.fillStyle = M.state === 'home' ? 'rgba(220,222,246,0.95)' : 'rgba(120,124,160,0.95)'; c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.fill();
      c.fillStyle = 'rgba(10,10,30,0.35)'; c.beginPath(); c.arc(mx + mr * 0.35, my - mr * 0.1, mr * 0.8, 0, TAU); c.fill();
      this.hits.push({ x: (mx - this.ox) / u - 18, y: (my - this.oy) / u - 18, w: 36, h: 36, hit: { kind: 'stop', id: mid } });
    }
    const tap = Math.max(R * 1.4, 30 * u);
    if (s.id === 'landing' || state !== 'dark') this.hits.push({ x: s.x - tap / u, y: s.y - tap / u, w: (tap * 2) / u, h: (tap * 2.2) / u, hit: { kind: 'stop', id: s.id } });
  }
  /** each world's own small things: Ossa and the lava moons, kites over Cirra, the lake's reflection, the great tree */
  private details(c: CanvasRenderingContext2D, id: string, x: number, y: number, R: number, relit: boolean, t: number, beat: RoadMap['beat'], bt: number): void {
    const s = R * 0.0042, br = (t * 0.25) % 1, appear = beat?.kind === 'heroes' && id === 'heroes' ? sm((bt - 0.6) / 1.4) : 1;
    if (id === 'heroes') {
      for (let i = 0; i < 3; i++) { const a = t * (relit ? 0.4 : 0) + i * 2.1; K.glow(c, x + Math.cos(a) * R * 1.55, y + Math.sin(a) * R * 0.5, R * 0.12, relit ? [255, 140, 70] : [90, 80, 90], 0.8); }
      if (relit) { c.save(); c.globalAlpha = appear; W.ossa(c, x + R * 0.95, y - R * 0.55 + (1 - appear) * 10, s * 1.25, { rise: 0.2 + 0.6 * appear, rear: 0, head: 0.2, antler: 0, tail: 0, breath: br, lit: 1, flicker: 0.6, face: -1 } as never); c.restore(); }
    } else if (id === 'skyhigh') {
      if (relit) { for (let i = 0; i < 4; i++) { const a = t * 0.5 + (i / 4) * TAU; W2.kite(c, x + Math.cos(a) * R * 1.4, y - R * 0.6 + Math.sin(a) * R * 0.4, R * 0.0045, 0.3 * Math.sin(t * 1.5 + i), true, i % 2 ? [255, 170, 220] : [220, 180, 255]); } W2.seo(c, x - R * 1.1, y + R * 0.9, s, { wake: 1, fly: 1, sway: 0.2 * Math.sin(t), flap: Math.sin(t * 3) * 0.5, lit: 1, t, face: 1 }); }
    } else if (id === 'blank') {
      // the lake's reflection under it (upside down, cool), and Vell under the waterline
      const p = this.pic('blank', relit); if (p) { const S = (p.width * R) / W.R0; c.save(); c.globalAlpha = relit ? 0.35 : 0.18; c.translate(x, y + R * 2.15); c.scale(1, -0.55); c.drawImage(p, -S / 2, -S / 2, S, S); c.restore(); }
      c.strokeStyle = `rgba(200,235,255,${relit ? 0.5 : 0.2})`; c.lineWidth = 1; c.beginPath(); c.moveTo(x - R * 1.4, y + R * 1.25); c.lineTo(x + R * 1.4, y + R * 1.25); c.stroke();
      if (relit) W2.vell(c, x + R * 1.25, y + R * 1.25, s * 0.9, { wake: 1, mirror: 0, bow: 0, ripple: 0.3, lit: 1, t });
    } else if (id === 'invincible') {
      // the great tree rising out of it
      c.save(); c.strokeStyle = relit ? 'rgba(70,52,40,0.95)' : 'rgba(50,50,60,0.9)'; c.lineCap = 'round'; c.lineWidth = R * 0.22; c.beginPath(); c.moveTo(x, y - R * 0.6); c.quadraticCurveTo(x + R * 0.2, y - R * 1.3, x - R * 0.05, y - R * 1.9); c.stroke(); c.restore();
      for (let i = 0; i < 9; i++) { const r = K.RNG(i + 3), a = r() * TAU; c.fillStyle = relit ? `rgba(${80 + 60 * r()},${150 + 60 * r()},${80},0.9)` : 'rgba(70,74,80,0.85)'; c.beginPath(); c.ellipse(x + Math.cos(a) * R * 0.55, y - R * 2 + Math.sin(a) * R * 0.32 + (relit ? Math.sin(t + i) * 1.2 : 0), R * 0.28, R * 0.18, a, 0, TAU); c.fill(); }
      if (relit) W2.morrow(c, x - R * 1.2, y + R * 0.95, s, { climb: 0.3, reach: 0.5 + 0.5 * Math.sin(t * 0.6), lights: 1, breath: br, lit: 1, t });
    } else if (id === 'started') {
      // the planetoid's fragments, and the Sleeper's hand reaching
      for (let i = 0; i < 2; i++) { const p = this.pic(i ? 'landing' : 'ambush', false); if (!p) continue; const a = t * (relit ? 0.3 : 0) + i * 2.6, S = (p.width * R * 0.32) / W.R0; c.drawImage(p, x + Math.cos(a) * R * 1.5 - S / 2, y + Math.sin(a) * R * 0.6 - S / 2, S, S); }
    }
  }
  private label(text: string, x: number, y: number, state: string): void {
    const c = this.ctx, px = 13.5 * Math.min(1.25, this.u * 1.05);
    c.save(); c.font = `italic 600 ${px}px ${SERIF}`; c.textAlign = 'center'; c.shadowColor = 'rgba(4,4,14,0.9)'; c.shadowBlur = px * 0.6; c.globalAlpha = state === 'dark' ? 0.55 : 0.95; c.fillStyle = state === 'dark' ? SAND : CREAM; c.fillText(text, x, y); c.restore();
  }
  /** a relit stop's star, hovering above it, and under it its earned stars as small lights */
  private starAbove(s: { x: number; y: number; r: number }, col: RGB, lights: boolean[], t: number): void {
    const u = this.u, x = this.X(s.x), y = this.Y(s.y) - s.r * u * 1.55 + Math.sin(t * 1.6 + s.x) * 2 * u;
    K.glow(this.ctx, x, y, 14 * u, col, 0.5);
    LANDING.star(this.ctx, x, y, 0.22 * u, col, 1, t * 0.3);
    this.slots(x, y + 13 * u, lights, t);
  }
  private slots(x: number, y: number, lights: boolean[], t: number): void {
    const c = this.ctx, u = this.u, n = lights.length;
    lights.forEach((on, i) => { const lx = x + (i - (n - 1) / 2) * 7 * u; if (on) { K.glow(c, lx, y, 4 * u, [255, 226, 150], 0.7 + 0.2 * Math.sin(t * 2 + i)); c.fillStyle = 'rgba(255,242,206,1)'; c.beginPath(); c.arc(lx, y, 1.7 * u, 0, TAU); c.fill(); } else { c.strokeStyle = 'rgba(255,236,206,0.45)'; c.lineWidth = 1; c.beginPath(); c.arc(lx, y, 1.7 * u, 0, TAU); c.stroke(); } });
  }
  /** a button: a capsule with its word in the clean face, at least 44 points tall (k: its size in sheet terms) */
  private button(s: string, x: number, y: number, align: CanvasTextAlign, a: number, main: boolean, k = 1, screen = false): { x: number; y: number; w: number; h: number } {
    const c = this.ctx, zz = screen ? 1 : this.z, px = 16 / zz * k, hgt = Math.max(44 / zz, 34 * k / zz), padX = 18 / zz;
    c.font = `600 ${px}px ${PLAIN}`; const tw = c.measureText(s).width, bw = tw + padX * 2;
    const bx = align === 'right' ? x - bw : align === 'center' ? x - bw / 2 : x, by = y - hgt / 2;
    c.save(); c.globalAlpha = a;
    c.fillStyle = main ? 'rgba(255,208,106,0.22)' : 'rgba(10,10,26,0.55)'; c.strokeStyle = main ? 'rgba(255,208,106,0.95)' : 'rgba(255,241,216,0.6)'; c.lineWidth = 1.4 / zz;
    c.beginPath(); c.roundRect(bx, by, bw, hgt, hgt / 2); c.fill(); c.stroke();
    c.fillStyle = main ? '#ffe2a0' : CREAM; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, bx + bw / 2, y + 0.5 / zz); c.restore();
    return { x: bx, y: by, w: bw, h: hgt };
  }
  private words(s: string, x: number, y: number, px: number, a: number, italic = true): void {
    if (a <= 0.004) return;
    const c = this.ctx; c.save(); c.font = `${italic ? 'italic ' : ''}500 ${px}px ${SERIF}`; c.textAlign = 'center'; c.shadowColor = 'rgba(4,4,14,0.9)'; c.shadowBlur = px * 0.6; c.globalAlpha = a; c.fillStyle = CREAM; c.fillText(s, x, y); c.restore();
  }

  /** the level card: name, song, stars, best, and Play and Practice (and Dare) */
  private cardDraw(c: CanvasRenderingContext2D, t: number): void {
    const id = this.card!, I = this.info.stops[id], { w, h } = this, k = Math.min(1.15, Math.max(0.9, Math.min(w / 390, h / 844))), a = sm((t - this.cardT) / 0.3);
    const cw = Math.min(w - 32, 360 * k), ch = 196 * k, cx = w / 2 - cw / 2, cy = h - ch - Math.max(16, 20 * k) + (1 - a) * 30;
    c.save(); c.globalAlpha = a;
    // (no box: the night thickens up from the bottom edge, and the words sit in it)
    const g = c.createLinearGradient(0, cy - 90 * k, 0, h); g.addColorStop(0, 'rgba(5,5,16,0)'); g.addColorStop(0.35, 'rgba(5,5,16,0.82)'); g.addColorStop(1, 'rgba(5,5,16,0.96)');
    c.fillStyle = g; c.fillRect(0, cy - 90 * k, w, h - cy + 90 * k);
    K.glow(c, cx + 40 * k, cy + 30 * k, 120 * k, PAL[id] ?? [255, 214, 150], 0.12);
    const close = { x: cx + cw - 44, y: cy, w: 44, h: 44 };
    c.strokeStyle = 'rgba(255,241,216,0.7)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(close.x + 15, close.y + 15); c.lineTo(close.x + 29, close.y + 29); c.moveTo(close.x + 29, close.y + 15); c.lineTo(close.x + 15, close.y + 29); c.stroke();
    this.screenHits.push({ ...close, hit: { kind: 'close' } });
    const L = cx + 22 * k;
    if (id === 'landing') {
      c.font = `italic 600 ${28 * k}px ${SERIF}`; c.fillStyle = CREAM; c.textAlign = 'left'; c.fillText('The Landing', L, cy + 44 * k);
      c.font = `italic 500 ${15 * k}px ${SERIF}`; c.fillStyle = SAND; c.fillText('home: the fire, the vessel, the still pool', L, cy + 66 * k);
      const rows: Array<[string, RoadHit['kind'], boolean]> = [['Down to the fire', 'title', true], ['The story so far', 'pool', true], ['Ossa’s fire', 'glows', this.info.rooms.glows]];
      // two to a row
      let yy = cy + 112 * k, xx = L;
      c.font = `600 16px ${PLAIN}`;
      for (const [label, kind, on] of rows) { if (!on) continue; if (xx > L && xx + c.measureText(label).width + 36 > cx + cw) { yy += 54; xx = L; } const b = this.button(label, xx, yy, 'left', a, kind === 'title', 1, true); this.screenHits.push({ ...b, hit: { kind } as RoadHit }); xx = b.x + b.w + 10; c.font = `600 16px ${PLAIN}`; }
      c.restore(); return;
    }
    c.textAlign = 'left';
    c.font = `italic 600 ${30 * k}px ${SERIF}`; c.fillStyle = CREAM; c.fillText(I.name, L, cy + 46 * k);
    c.font = `italic 500 ${17 * k}px ${SERIF}`; c.fillStyle = SAND; c.fillText(`${I.song}  ·  ${I.by}`, L, cy + 70 * k);
    c.font = `600 ${14 * k}px ${PLAIN}`; c.fillStyle = CREAM;
    const said = I.state === 'home' ? 'Awake' : I.best > 0 ? `Best ${I.best}%` : 'Not yet flown';
    c.fillText(said, L, cy + 100 * k);
    if (I.lights.length) { const sx = L + c.measureText(said).width + 22; c.fillStyle = SAND; const st = `Stars ${I.lights.filter(Boolean).length} of ${I.lights.length}`; c.fillText(st, sx, cy + 100 * k); this.slots(sx + c.measureText(st).width + 14 + (I.lights.length - 1) * 3.5 * this.u, cy + 95 * k, I.lights, t); }
    const by = cy + ch - 46 * k;
    if (I.state === 'dark') { c.font = `italic 500 ${17 * k}px ${SERIF}`; c.fillStyle = SAND; c.fillText(I.why, L, by); c.restore(); return; }
    const play = this.button(I.state === 'home' ? 'Play again' : 'Play', L, by, 'left', a, true, 1.05, true); this.screenHits.push({ ...play, hit: { kind: 'play' } });
    let nx = play.x + play.w + 10;
    if (I.practise !== false) { const pr = this.button('Practice', nx, by, 'left', a, false, 1.05, true); this.screenHits.push({ ...pr, hit: { kind: 'practise' } }); nx = pr.x + pr.w + 10; }
    if (I.dare) { const label = I.dare === 'done' ? 'Dare again' : 'Dare'; c.font = `600 ${16 * 1.05}px ${PLAIN}`; if (nx + c.measureText(label).width + 36 <= cx + cw - 12) { const dr = this.button(label, nx, by, 'left', a, false, 1.05, true); this.screenHits.push({ ...dr, hit: { kind: 'dare' } }); } }
    c.restore();
  }
  /** a beat's own layer over the map: the dark, the mist, its words */
  private beatOver(c: CanvasRenderingContext2D, kind: Beat, bt: number): void {
    const { w, h } = this, len = BEAT_LEN[kind];
    let dark = 0, text = '', ta = 0;
    if (kind === 'started') { text = 'Wake the stars.'; ta = sm((bt - 2.6) / 0.8) * (1 - sm((bt - len + 0.8) / 0.8)); }
    if (kind === 'skyhigh') dark = 0.3 * sm((bt - 0.3) / 1.5) + 0.5 * sm((bt - 5) / 1.3);
    if (kind === 'ambush') { dark = 0.55 * (1 - sm((bt - 0.2) / 2.5)); for (let i = 0; i < 8; i++) { const r = K.RNG(i * 7), q = sm((bt - 1 - i * 0.2) / 2); K.glow(c, w * r(), h * (0.3 + 0.3 * r()), (60 + 60 * r()) * this.u, [180, 180, 210], 0.25 * (1 - q)); } }
    if (dark > 0) { c.fillStyle = `rgba(3,3,10,${dark})`; c.fillRect(0, 0, w, h); }
    if (kind === 'invincible') { const g = sm((bt - len + 1.4) / 1.4); if (g > 0) { c.fillStyle = `rgba(255,228,180,${g})`; c.fillRect(0, 0, w, h); } }
    if (text) this.words(text, w / 2, h * 0.5, 26 * Math.min(1.3, this.u * 1.2), ta);
    this.words('tap to skip', w / 2, h - 22, 13, 0.5 * sm(bt / 1.5), false);
  }
}

const BEAT_LEN: Record<Beat, number> = { started: 7, heroes: 9, skyhigh: 6.5, ambush: 7, blank: 6.5, invincible: 8 };
/** where a beat's camera looks (sheet x, y, zoom) at its second bt */
function beatCam(kind: Beat, bt: number, at: (id: string) => { x: number; y: number }): [number, number, number] {
  const L = at('landing'), E = at('heroes'), C = at('skyhigh'), G = at('gate'), B = at('blank'), V = at('invincible');
  const mid: [number, number, number] = [195, 422, 1];
  const ease = (a: [number, number, number], b: [number, number, number], q: number): [number, number, number] => [lerp(a[0], b[0], sm(q)), lerp(a[1], b[1], sm(q)), lerp(a[2], b[2], sm(q))];
  switch (kind) {
    case 'started': return ease([L.x, L.y - 60, 2.2], mid, (bt - 0.4) / 3.5);
    // close on Ossa standing on her world; along the road as it lights; with Orbin to Cirra; back to the whole map, the signal pulsing
    case 'heroes': return bt < 2.4 ? [E.x + 14, E.y - 12, 2.6] : bt < 6.2 ? ease([E.x + 14, E.y - 12, 2.6], [lerp(E.x, C.x, 0.55), lerp(E.y, C.y, 0.55), 1.6], (bt - 2.4) / 2.6) : ease([lerp(E.x, C.x, 0.55), lerp(E.y, C.y, 0.55), 1.6], mid, (bt - 6.2) / 2);
    // the map darkens; the camera looks up to the rings as the Stillness pours out of them and down the road, onto Orbin
    case 'skyhigh': return bt < 2.2 ? ease([C.x, C.y, 1.5], [195, 300, 1.1], (bt - 0.2) / 2) : ease([195, 300, 1.1], [C.x, C.y, 1.9], (bt - 2.2) / 3.2);
    case 'ambush': return ease([lerp(C.x, B.x, 0.5), lerp(C.y, B.y, 0.5), 1.6], [B.x, B.y, 1.4], (bt - 1) / 3.5);
    case 'blank': return bt < 4.6 ? ease([B.x, B.y, 1.4], [G.x + 30, G.y - 40, 2.6], (bt - 0.4) / 1.8) : ease([G.x + 30, G.y - 40, 2.6], mid, (bt - 4.6) / 1.8);
    case 'invincible': return ease([V.x, V.y, 1.5], [G.x, G.y + 40, 1.8], (bt - 0.8) / 3);
  }
}
