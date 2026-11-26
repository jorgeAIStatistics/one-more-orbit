// The worlds after Emberwick (the owner's brief of 2026-11-25): Cirra, Glassmere and Verdance, each built to the
// standard Emberwick meets. The level is the story: the planet in the middle of the ring starts cold, with the
// Stillness's residue on it; good taps relight it zone by zone; the inhabitant (beside it, never on the course) wakes,
// reacts and joins in on the drop; Helion's moment comes on a thin bar of the build; the Kindling gives the new mode as
// the song brings in its sound; set pieces change the feel on the big musical moments; the last wall is the Stillness's
// seal on the star. The atmosphere darkens toward the guardian (the Stillness's presence grows, Helion's signal too).
//
// Timelines are in song seconds of each cut (tools/tracks.json: flutter, luna, willow).
import { COMPANIONS } from '../art/companions.js';
import { COLDPAINT as C } from '../art/coldpaint.js';
import { DUSK, K } from '../art/painter.js';
import { WORLDS2 as W2 } from '../art/world2paint.js';
import { writeSays, type Said, type SceneState } from './skyplanet';
import { save } from '../save';
import { horizon, skyOf, zoneOf, zones, ZONES, type CourseView, type Pic, type World, type WorldSky, type WorldState } from './worlds';
import { askLevelSky, askPlanet, pairNow, planetLayer, type LayerName, type SkySpec } from '../art/paintcache';

const TAU = Math.PI * 2;
const sm = (x: number) => { const t = x < 0 ? 0 : x > 1 ? 1 : x; return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
type RGB = [number, number, number];

/** A critically damped spring (as the first two worlds): every state change is a motion, never a swap. */
class Spring {
  v = 0;
  constructor(public x: number, private omega = 6) {}
  step(target: number, dt: number): number { const w = this.omega; this.v += (w * w * (target - this.x) - 2 * w * this.v) * dt; this.x += this.v * dt; return this.x; }
}

export interface Timeline { gift: number; helion: number; drop: number; end: number; spb: number }
interface Cfg {
  key: string;
  T: Timeline;
  layer: (hot: boolean) => HTMLCanvasElement;
  /** the layer's name, for the paint worker */
  layerName: LayerName;
  /** the sky's gradient, cold and relit */
  sky: [Array<[number, number[]]>, Array<[number, number[]]>];
  /** the world's element colour (its bursts, its ribbons) */
  col: RGB;
  /** how much the Stillness is here (0..1): its far mass in the sky, and the dark at the edges */
  stillness: number;
  /** how strongly Helion's signal comes through (0..1): it grows world by world */
  signal: number;
}

/** The machinery every world after Emberwick shares; each world adds its inhabitant, its set pieces and its camera. */
abstract class PlanetWorld {
  protected cold: Pic | null = null; protected hot: Pic | null = null;
  protected skyCold: Pic | null = null; protected skyHot: Pic | null = null; private key = '';
  private skySpec(hot: boolean): SkySpec { return { stops: this.cfg.sky[hot ? 1 : 0], seed: 19 + this.cfg.key.length, fin: 43 }; }
  /** Ask the paint worker for this planet and its sky ahead of the level. */
  askAhead(): void { askPlanet(this.cfg.layerName); for (const hot of [false, true]) askLevelSky(window.innerWidth, window.innerHeight, this.skySpec(hot)); }
  protected lit: number[] = new Array(ZONES).fill(-1); protected sparks = 0;
  protected lastT = -1; protected dt = 0;
  constructor(protected cfg: Cfg) {}
  private paint(w: number, h: number): void {
    const key = `${w}x${h}`; if (key === this.key) return; this.key = key;
    this.ensurePlanet();
    this.skyCold = skyOf(w, h, this.skySpec(false)); this.skyHot = skyOf(w, h, this.skySpec(true));
    // the far Stillness is painted now too (its image, at the screen's resolution), not on the level's first frame
    const S = this.cfg.stillness, u = Math.min(w / 390, h / 844), dpr = window.devicePixelRatio || 1;
    if (S > 0) { const warm = document.createElement('canvas').getContext('2d')!; warm.setTransform(dpr, 0, 0, dpr, 0, 0); C.dread(warm, -1e5, -1e5, (90 + 220 * S) * u, (70 + 160 * S) * u, 61, 0.4 + 0.6 * S); }
  }
  /** the planet's pictures, as soon as the worker has them (2026-11-26: never painted on the page as a level opens) */
  protected ensurePlanet(): void { if (!this.cold) { const p = pairNow(this.cfg.layerName, this.cfg.layer); if (p) [this.cold, this.hot] = p; } }
  reset(): void { this.lit.fill(-1); this.sparks = 0; this.lastT = -1; this.taps = []; this.heat.fill(0); this.resetMore(); }
  rewind(to: number): void { for (let z = 0; z < ZONES; z++) if (this.lit[z] > to) this.lit[z] = -1; this.lastT = -1; this.taps = this.taps.filter((x) => x.at <= to); }
  spark(a: number, song: number, pf = 0): void {
    const k = Math.round(pf);
    this.taps.push({ k, at: song });
    if (this.journeyOn && !this.planetAt.includes(k)) return; // (another place lights from its own taps)
    const z = zoneOf(a); if (this.lit[z] < 0) this.lit[z] = song; this.sparks++;
  }
  // ---- the journey (2026-11-26): the world's places, each relit by the taps played on it; the planet at its places
  protected journeyOn = false;
  protected taps: Array<{ k: number; at: number }> = [];
  protected heat = [0, 0, 0, 0, 0, 0];
  /** which of the level's places are the planet itself (drawn once, at the first) */
  protected planetAt: number[] = [0];
  private jT = -1;
  /** behind the planet: the inhabitant, the world's far pieces (world frame) */
  protected journeyBack(_c: CanvasRenderingContext2D, _st: WorldState, _U: number): void { /* (per world) */ }
  /** over the planet, under the course: the other places' bodies and the world's objects */
  protected journeyMore(_c: CanvasRenderingContext2D, _st: WorldState, _U: number): void { /* (per world) */ }
  private journey(c: CanvasRenderingContext2D, st: WorldState): void {
    this.journeyOn = true;
    const t = st.song, U = st.unit ?? 100, time = st.time, dt = this.jT < 0 ? 0 : Math.min(0.05, Math.max(0, time - this.jT)); this.jT = time;
    const n = [0, 0, 0, 0, 0, 0]; for (const x of this.taps) if (x.at <= t && x.k >= 0 && x.k < 6) n[x.k]++;
    for (let k = 0; k < 6; k++) { const want = Math.min(1, n[k] / 5) * 0.8 + (t >= this.cfg.T.drop ? 0.2 : 0); this.heat[k] += (want - this.heat[k]) * Math.min(1, dt * 2.5); }
    this.journeyBack(c, st, U);
    const [px, py] = st.rel!(this.planetAt[0]);
    c.save(); c.translate(px, py); this.planetFace(c, U * 0.84, st); c.restore();
    this.journeyMore(c, st, U);
  }
  protected resetMore(): void { /* (a world's own state) */ }
  /** the planet's own landmarks and set pieces, over its painted face (canvas at its centre, radius R) */
  protected abstract planetMore(c: CanvasRenderingContext2D, R: number, st: WorldState): void;
  /** the inhabitant and the world's sky pieces, behind everything */
  protected abstract skyMore(c: CanvasRenderingContext2D, w: number, h: number, u: number, st: SceneState, t: number, dt: number): void;
  /** the world's set pieces on the course */
  protected courseMore(_c: CanvasRenderingContext2D, _v: CourseView): void { /* (none by default) */ }
  /** the camera through the song (build pushes in; the drop pulls back to show the world, then settles) */
  protected pullAt(_s: number): { x: number; y: number; k: number } | null { return null; }
  protected camAt(s: number): number { const T = this.cfg.T; return s < T.gift ? 1 : s < T.drop ? 1 + 0.12 * sm((s - T.gift) / (T.drop - 0.3 - T.gift)) : 0.8 + 0.12 * sm((s - T.drop - 0.6) / 3); }

  readonly world: World = {
    reset: () => this.reset(),
    rewind: (to) => this.rewind(to),
    spark: (a, song, pf) => this.spark(a, song, pf),
    onCourse: (c, v) => this.onCourse(c, v),
    cam: (s) => this.camAt(s),
    pull: (s) => this.pullAt(s),
    relit: 0,
    draw: (c, R, st) => {
      this.ensurePlanet();
      if (!this.cold || !this.hot) return;
      if (st.rel && st.at) { this.journey(c, st); return; }
      this.planetFace(c, R, st);
    }
  };
  /** the planet itself at the frame's origin: its zones relit, its landmarks, the Kindling rising off it with the gift */
  private planetFace(c: CanvasRenderingContext2D, R: number, st: WorldState): void {
    {
      if (!this.cold || !this.hot) return;
      const T = this.cfg.T, t = st.song, dropK = sm((t - T.drop) / 0.4);
      zones(c, this.cold, this.hot, R, this.lit, t, dropK);
      this.planetMore(c, R, st);
      // the Kindling, this world's last spark, rising off the planet as the song brings in its sound (it gives the mode)
      if (t > T.gift - 2.2 && t < T.gift + 0.3) {
        const q = sm((t - T.gift + 2.2) / 2), a = 1 - sm((t - T.gift) / 0.3), k = R / W2.R0;
        COMPANIONS.kindling(c, Math.sin(st.time * 2) * 10 * k, -R * 0.95 - 140 * k * q, 0.8 * k, (COMPANIONS.KINDLE as Record<string, number[]>)[this.cfg.key], { flap: 0.5 + 0.5 * Math.sin(st.time * 5), alpha: sm((t - T.gift + 2.2) / 0.5) * a });
      }
    }
  }
  readonly sky: WorldSky = {
    says: [],
    prepare: () => this.paint(window.innerWidth, window.innerHeight),
    draw: (c, w, h, st) => {
      this.paint(w, h);
      const T = this.cfg.T, t = st.song ?? -10, time = st.time, u = Math.min(w / 390, h / 844);
      this.dt = this.lastT < 0 ? 0 : Math.min(0.05, Math.max(0, time - this.lastT)); this.lastT = time;
      // the sky: cold, warming a little with every good tap, and relit on the drop
      const warm = Math.max(Math.min(0.35, this.sparks * 0.012), sm((t - T.drop) / 1.2));
      if (this.skyCold) c.drawImage(this.skyCold, 0, 0, w, h);
      if (this.skyHot && warm > 0) { c.globalAlpha = warm * (0.85 + 0.15 * (st.kick ?? 0)); c.drawImage(this.skyHot, 0, 0, w, h); c.globalAlpha = 1; }
      // the Stillness, far off and growing world by world: a mass of it on the edge of the sky
      const S = this.cfg.stillness;
      if (S > 0) { c.save(); c.globalAlpha = 0.5 + 0.5 * S; C.dread(c, w * (1.02 - 0.08 * S), h * 0.08, (90 + 220 * S) * u, (70 + 160 * S) * u, 61, 0.4 + 0.6 * S); c.restore(); }
      // depth: a haze between the far sky and the world (cooler, paler, far things softer), and in the lighter worlds,
      // rays of light falling through it (the cinematic pass)
      { const hz = c.createLinearGradient(0, h * 0.35, 0, h); hz.addColorStop(0, 'rgba(160,170,210,0)'); hz.addColorStop(0.5, `rgba(160,170,210,${0.05 + 0.05 * warm})`); hz.addColorStop(1, 'rgba(160,170,210,0)'); c.fillStyle = hz; c.fillRect(0, h * 0.35, w, h * 0.65); }
      if (S < 0.7 && warm > 0.05) { c.save(); c.globalCompositeOperation = 'screen'; for (let i = 0; i < 5; i++) { const a = -0.25 + i * 0.12 + 0.02 * Math.sin(time * 0.2 + i), x0 = w * 0.1, y0 = -h * 0.05, L = Math.hypot(w, h); const g = c.createLinearGradient(x0, y0, x0 + Math.cos(a + 1.2) * L, y0 + Math.sin(a + 1.2) * L); g.addColorStop(0, K.rgba(this.cfg.col, 0.1 * warm)); g.addColorStop(1, K.rgba(this.cfg.col, 0)); c.fillStyle = g; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + Math.cos(a + 1.17) * L, y0 + Math.sin(a + 1.17) * L); c.lineTo(x0 + Math.cos(a + 1.23) * L, y0 + Math.sin(a + 1.23) * L); c.closePath(); c.fill(); } c.restore(); }
      // Helion's moment: his silhouette in the shadow ring on the horizon, on the build's thin bar (stronger world by world)
      horizon(c, w, h, (t > T.helion - 0.2 && t < T.drop ? sm((t - T.helion + 0.2) / 0.5) * (1 - sm((t - T.drop + 0.3) / 0.3)) : 0) * (0.7 + 0.6 * this.cfg.signal), time);
      this.skyMore(c, w, h, u, st, t, this.dt);
      // the drop: half a beat of the world drawing in (near stillness), then the release: radial speed lines, the element outward
      const pre = t > T.drop - 0.45 && t < T.drop ? sm((t - T.drop + 0.45) / 0.45) : 0;
      if (pre > 0) { c.fillStyle = `rgba(6,4,12,${0.35 * pre})`; c.fillRect(0, 0, w, h); }
      const rel = (t >= T.drop && t < T.drop + 1.1 ? 1 - (t - T.drop) / 1.1 : 0) * (save.reduceFlash ? 0.3 : 1);
      if (rel > 0) {
        const cx = w / 2, cy = h * 0.52, R0 = Math.hypot(w, h) * 0.6, r = K.RNG(5), col = this.cfg.col;
        c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
        for (let i = 0; i < 48; i++) { const a = r() * TAU, d0 = (0.15 + 0.5 * r() + (1 - rel) * 0.6) * R0, L = (0.08 + 0.2 * r()) * R0 * rel; c.strokeStyle = K.rgba(K.mix(col, [255, 255, 255], 0.4), 0.5 * rel); c.lineWidth = 1 + 2.5 * r(); c.beginPath(); c.moveTo(cx + Math.cos(a) * d0, cy + Math.sin(a) * d0); c.lineTo(cx + Math.cos(a) * (d0 + L), cy + Math.sin(a) * (d0 + L)); c.stroke(); }
        c.restore();
        K.glow(c, cx, cy, R0 * (0.4 + 0.8 * (1 - rel)), col, 0.45 * rel, 'screen');
      }
      // the dark at the edges, deeper as the world darkens toward the guardian
      if (S > 0.3) { const g = c.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.3, w / 2, h * 0.5, Math.hypot(w, h) * 0.6); g.addColorStop(0, 'rgba(4,4,10,0)'); g.addColorStop(1, `rgba(4,4,10,${0.45 * (S - 0.3) * (1 - 0.5 * warm)})`); c.fillStyle = g; c.fillRect(0, 0, w, h); }
      writeSays(c, w, h, u, this.sky.says, st.song);
    }
  };

  /** on the course: the world's own set pieces, and the Stillness's seal on the star (the last wall; the last tap breaks it) */
  private onCourse(c: CanvasRenderingContext2D, v: CourseView): void {
    this.courseMore(c, v);
    const rb = v.rb, last = v.presses[v.presses.length - 1];
    if (!last) return;
    const d = v.beat - last.beat;
    if (d < -6 || d > 1.6) return;
    const [x, y] = v.pos(last.beat, 0);
    if (d < 0) {
      const a = sm((d + 6) / 1.5), R0 = rb * 4.4 * (1 + 0.04 * Math.sin(v.time * 3));
      c.globalAlpha = a;
      c.strokeStyle = 'rgba(176,166,198,0.5)'; c.lineWidth = rb * 1.6; c.beginPath(); c.arc(x, y, R0, 0, TAU); c.stroke();
      c.strokeStyle = 'rgba(8,6,12,0.96)'; c.lineWidth = rb * 1.1; c.beginPath(); c.arc(x, y, R0, 0, TAU); c.stroke();
      c.strokeStyle = 'rgba(176,166,198,0.6)'; c.lineWidth = rb * 0.18;
      for (let i = 0; i < 10; i++) { const an = (i / 10) * TAU + v.time * 0.4; c.beginPath(); c.moveTo(x + Math.cos(an) * R0 * 0.78, y + Math.sin(an) * R0 * 0.78); c.lineTo(x + Math.cos(an + 0.12) * R0 * 0.62, y + Math.sin(an + 0.12) * R0 * 0.62); c.stroke(); }
      K.glow(c, x, y, rb * 2.2, [255, 240, 210], 0.5 * a);
      c.globalAlpha = 1;
    } else {
      const q = d / 1.6;
      c.strokeStyle = `rgba(8,6,12,${0.95 * (1 - q)})`; c.lineWidth = rb * 0.9 * (1 - q);
      for (let i = 0; i < 14; i++) { const an = (i / 14) * TAU, rr = rb * 4.4 + d * rb * 16; c.beginPath(); c.arc(x, y, rr, an, an + 0.25); c.stroke(); }
      K.glow(c, x, y, rb * (4 + 14 * q), [255, 244, 214], Math.exp(-d * 3), 'screen');
    }
  }
}

// ================================================================ Cirra, on Flutter (128 BPM, a bar 1.875 s)
const CT = { gift: 7.5, gust: 11.25, helion: 13.125, drop: 15.0, spiral: 15.94, shelves: 22.5, mini: 26.25, strings: 99, lift: 37.5, kites: 39.375, mini2: 48.75, end: 63.75, spb: 60 / 128 };
/** where Seo stands, from Cirra's centre (base-ring radii, portrait); it stands a little behind (it drifts less) */
const SEO_AT: [number, number] = [-1.9, 2.05];
export class CirraWorld extends PlanetWorld {
  private wake = new Spring(0, 3); private fly = new Spring(0, 2.5); private sway = new Spring(0, 2); private flap = new Spring(0, 1.8);
  constructor() {
    super({ key: 'skyhigh', T: CT, layer: W2.cirraLayer, layerName: 'cirraLayer', col: [255, 200, 240], stillness: 0.3, signal: 0.45,
      sky: [[[0, [14, 12, 26]], [0.55, [34, 28, 48]], [1, [50, 40, 60]]], [[0, [36, 24, 70]], [0.5, [150, 90, 170]], [1, [255, 190, 210]]]] });
    this.world.relit = 20;
    this.planetAt = [0, 2, 4];
  }
  protected resetMore(): void { this.wake.x = 0; this.fly.x = 0; }
  private bodies: Partial<Record<'shelvesLayer' | 'kitemoonLayer', [Pic, Pic]>> = {};
  askAhead(): void { super.askAhead(); askPlanet('shelvesLayer'); askPlanet('kitemoonLayer'); }
  private body(n: 'shelvesLayer' | 'kitemoonLayer'): [Pic, Pic] | null { if (!this.bodies[n]) { const p = pairNow(n, W2[n]); if (p) this.bodies[n] = p; } return this.bodies[n] ?? null; }
  private pic(c: CanvasRenderingContext2D, n: 'shelvesLayer' | 'kitemoonLayer', x: number, y: number, r: number, heat: number): void {
    const bp = this.body(n); if (!bp) return;
    const [a, b] = bp, S = (a.width * r) / W2.R0;
    c.drawImage(a, x - S / 2, y - S / 2, S, S); if (heat > 0.01) { c.globalAlpha = heat; c.drawImage(b, x - S / 2, y - S / 2, S, S); c.globalAlpha = 1; }
  }
  /** Seo in the world, beside Cirra and a little behind it: tangled, then standing at the gift, flying every kite on the drops */
  protected journeyBack(c: CanvasRenderingContext2D, st: WorldState, U: number): void {
    const t = st.song, dt = this.dt, rel = st.rel!, [ex, ey] = rel(0), wide = !!st.wide;
    const [ox, oy] = wide ? [-SEO_AT[1], SEO_AT[0]] : SEO_AT, x = ex * 0.9 + ox * U, y = ey * 0.9 + oy * U, s = U * 0.0088;
    const wake = t >= CT.gift ? 1 : Math.min(0.3, this.sparks * 0.03), fly = t >= CT.kites ? 1 : t >= CT.drop ? 0.8 : t >= CT.helion ? 0.25 : 0;
    const W = this.wake.step(wake, dt), F = this.fly.step(fly, dt), sway = this.sway.step(t >= CT.drop ? 0.25 * Math.sin(st.time * 1.3) : 0.04 * Math.sin(st.time * 0.6), dt), fl = this.flap.step(Math.sin(st.time * 4) * (0.3 + F), dt);
    const lit = sm((t - CT.drop) / 1.2) * 0.9 + Math.min(0.1, this.sparks * 0.01);
    W2.seo(c, x, y, s, { wake: W, fly: F, sway, flap: fl, lit, t: st.time, face: 1 });
    this.seoHand = [x + 30 * s, y - 190 * s];
    // Seo's sky (the second drop): every kite of Cirra flying round it, on long lines back to Seo's hands
    const all = sm((t - CT.kites) / 1.2) * (1 - sm((t - CT.end + 1) / 1.5));
    if (all > 0.01) {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU + st.time * 0.18, rr = U * (2.0 + 0.35 * Math.sin(st.time * 0.7 + i)), kx = ex + Math.cos(a) * rr, ky = ey + Math.sin(a) * rr * 0.8 - U * 0.4;
        c.strokeStyle = `rgba(255,235,250,${0.18 * all})`; c.lineWidth = 1; c.beginPath(); c.moveTo(this.seoHand[0], this.seoHand[1]); c.quadraticCurveTo((this.seoHand[0] + kx) / 2, Math.min(this.seoHand[1], ky) - U * 0.6, kx, ky); c.stroke();
        c.globalAlpha = all; W2.kite(c, kx, ky, U * 0.006, 0.4 * Math.sin(st.time * 1.6 + i), true, i % 2 ? [255, 170, 220] : [220, 180, 255]); c.globalAlpha = 1;
      }
    }
  }
  private seoHand: [number, number] = [0, 0];
  /** the other places (the kite-moons along the strings, the Cloud Shelves) and Cirra's objects, in their three beats */
  protected journeyMore(c: CanvasRenderingContext2D, st: WorldState, U: number): void {
    const rel = st.rel!, t = st.song;
    if (st.along && st.span) {
      // the kite strings: kite-moons hanging under the line, the line itself a string of light between them
      const [o0, o1] = st.span(1), [bx, by] = rel(1);
      for (const q of [-0.12, 0.5, 1.12]) { const [x, y] = st.along(1, o0 + (o1 - o0) * q, U * 0.35); this.pic(c, 'kitemoonLayer', bx + x, by + y, U * 0.42, this.heat[1]); }
      c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(255,230,250,${0.15 + 0.3 * this.heat[1]})`; c.lineWidth = 1.5;
      for (const off of [0.85, 1.15]) { c.beginPath(); for (let i = 0; i <= 20; i++) { const [x, y] = st.along(1, o0 + (o1 - o0) * (-0.15 + 1.3 * i / 20), U * off); if (i) c.lineTo(bx + x, by + y); else c.moveTo(bx + x, by + y); } c.stroke(); }
      c.restore();
    }
    { const [x, y] = rel(3); this.pic(c, 'shelvesLayer', x, y, U * 0.95, this.heat[3]); }
    this.objects(c, st, U, t);
  }
  private objects(c: CanvasRenderingContext2D, st: WorldState, U: number, t: number): void {
    const beat = st.beat ?? t / CT.spb, at = st.at!, up = st.up!, rb = st.rb ?? U * 0.066;
    for (const p of st.presses ?? []) {
      const d = p.beat - beat;
      if (d > 3 || d < -1.6) continue;
      if (p.pad === 'jump') {
        // a kite: it fills with wind as he comes (rising, its cloth swelling on the beat), snaps up under him, soars off
        const [x, y] = at(p.beat), a = up(p.beat), pre = Math.max(0, Math.min(1, 1 - d / 2)), after = beat < p.beat ? 0 : (beat - p.beat) / 1.6;
        const beatPulse = Math.exp(-(((beat % 1) + 1) % 1) * 5), ux = Math.cos(a), uy = Math.sin(a);
        const lift = after > 0 ? after * after * U * 2.2 : -rb * 1.6 + pre * rb * 0.6, sw = after > 0 ? 1 + 0.4 * Math.exp(-after * 6) : 0.75 + 0.25 * pre + 0.08 * beatPulse * pre;
        c.globalAlpha = 1 - sm((after - 0.6) / 0.4);
        W2.kite(c, x + ux * lift + Math.sin(st.time * 3) * rb * 0.3 * (1 - pre), y + uy * lift, (rb / 12) * sw, a + Math.PI / 2 + (after > 0 ? 0.3 * Math.sin(after * 9) : 0.15 * Math.sin(st.time * 2.4)), pre > 0.2 || after > 0);
        c.globalAlpha = 1;
        if (after > 0 && after < 0.4) for (let i = 0; i < 10; i++) { const aa = (i / 10) * TAU, dd = rb * (1.5 + 8 * after); K.glow(c, x + Math.cos(aa) * dd, y + Math.sin(aa) * dd, rb * 0.25, [255, 200, 240], 0.9 * (1 - after / 0.4)); }
      } else if (p.leap && !p.leap.ember) {
        // a gust: a spiral of wind gathers under him over the beats before, bursts as it throws him, streams after him
        const [x, y] = at(p.beat), pre = Math.max(0, Math.min(1, 1 - d / 1.6)), after = beat < p.beat ? 0 : (beat - p.beat) / 1.4;
        if (pre > 0 && after === 0) { c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; for (let i = 0; i < 4; i++) { const a0 = st.time * (3 + i) + i * 1.6, rr = rb * (5 - 3 * pre) * (1 + 0.25 * i); c.strokeStyle = `rgba(255,225,250,${0.5 * pre})`; c.lineWidth = rb * 0.22; c.beginPath(); c.arc(x, y, rr, a0, a0 + 2.2); c.stroke(); } c.restore(); }
        if (after > 0 && after < 1) { c.save(); c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 16; i++) { const aa = (i / 16) * TAU + after * 2, dd = rb * (2 + 12 * after); K.glow(c, x + Math.cos(aa) * dd, y + Math.sin(aa) * dd, rb * 0.3 * (1 - after), [255, 220, 245], 0.9 * (1 - after)); } c.restore(); }
        if (after > 0 && beat < p.leap.b1 + 0.3) for (let i = 1; i <= 6; i++) { const b2 = Math.max(p.beat, beat - i * 0.12), [sx, sy] = at(b2); K.glow(c, sx, sy, rb * (1.2 - i * 0.15), [255, 225, 250], 0.4 * (1 - i / 7)); }
      } else if (p.leap?.ember) {
        // a wind chime in the air: its tubes sway and brighten as its beat comes; struck, it rings (light rings out)
        const [x, y] = at(p.beat), pre = Math.max(0, Math.min(1, 1 - d / 1.5)), after = beat < p.beat ? 0 : (beat - p.beat) / 1.2;
        c.save(); c.lineCap = 'round';
        for (let i = 0; i < 4; i++) { const sw = Math.sin(st.time * 2 + i) * 0.2 * (1 + 3 * Math.exp(-after * 4) * (after > 0 ? 1 : 0)), tx = x + (i - 1.5) * rb * 0.6, ty = y - rb * 1.4; c.strokeStyle = `rgba(${200 + 55 * pre},${190 + 50 * pre},235,${0.85 * (1 - sm((after - 0.6) / 0.4))})`; c.lineWidth = rb * 0.22; c.beginPath(); c.moveTo(tx, ty); c.lineTo(tx + Math.sin(sw) * rb * (1.4 + 0.3 * i), ty + Math.cos(sw) * rb * (1.4 + 0.3 * i)); c.stroke(); }
        c.restore();
        if (pre > 0 && after === 0) K.glow(c, x, y, rb * (1.5 + 1.5 * pre), [255, 230, 250], 0.35 * pre, 'screen');
        if (after > 0 && after < 1) { c.strokeStyle = `rgba(255,236,250,${0.7 * (1 - after)})`; c.lineWidth = rb * 0.25; for (const k of [1, 1.6]) { c.beginPath(); c.arc(x, y, rb * (1.5 + 7 * after * k), 0, TAU); c.stroke(); } }
      } else if (p.form === 'sat' && !p.auto && !p.smash) {
        // a knot of residue tangled in the wind where the wave would run on: tightening on the beat as he comes; he turns
        // off it, and it unravels behind him
        const kb = p.beat + 0.35, [x, y] = at(kb), pre = Math.max(0, Math.min(1, 1 - d / 2)), after = beat < kb ? 0 : (beat - kb) / 1.2, beatPulse = Math.exp(-(((beat % 1) + 1) % 1) * 5);
        if (after >= 1) continue;
        c.save(); c.translate(x, y); c.strokeStyle = 'rgba(20,14,30,0.85)'; c.lineCap = 'round';
        for (let i = 0; i < 5; i++) { const a0 = i * 1.3 + st.time * 0.6, rr = rb * (0.9 + 0.15 * i) * (1 - 0.15 * beatPulse * pre) * (1 + 2.5 * after); c.globalAlpha = 0.85 * (1 - after); c.lineWidth = rb * (0.28 - 0.1 * after); c.beginPath(); c.ellipse(0, 0, rr, rr * 0.55, a0, 0, after > 0 ? TAU * (1 - after) : TAU); c.stroke(); }
        c.strokeStyle = 'rgba(176,166,198,0.35)'; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, rb * 1.2, 0, TAU); c.stroke();
        c.restore();
      }
      // landing: a ring of light where he comes down from a gust
      if (p.leap && !p.leap.ember && beat >= p.leap.b1 && beat < p.leap.b1 + 1) {
        const [x, y] = at(p.leap.b1), q = beat - p.leap.b1;
        for (let i = 0; i < 16; i++) { const aa = (i / 16) * TAU, dd = rb * (1 + 6 * q); K.glow(c, x + Math.cos(aa) * dd, y + Math.sin(aa) * dd * 0.6, rb * 0.25 * (1 - q), [255, 220, 245], 0.85 * (1 - q)); }
      }
    }
  }
  protected pullAt(s: number): { x: number; y: number; k: number } | null { return s > CT.lift - 0.1 && s < CT.kites + 0.4 ? { x: 0.3, y: 0, k: sm((s - CT.lift) / 0.5) * (1 - sm((s - CT.kites + 0.7) / 0.5)) } : null; }
  protected planetMore(c: CanvasRenderingContext2D, R: number, st: WorldState): void {
    const t = st.song;
    // the gust (the drop): wind spirals streaming round the planet; again on the second high
    const gust = sm((t - CT.drop) / 0.4) * (1 - 0.6 * sm((t - CT.mini) / 2)) + sm((t - CT.kites) / 0.4) * (1 - 0.6 * sm((t - CT.mini2) / 2)) * (t > CT.kites ? 1 : 0);
    W2.windSpirals(c, 0, 0, R, st.time * (1 + gust), Math.min(1, gust + 0.25 * sm((t - CT.drop) / 1)));
  }
  protected skyMore(c: CanvasRenderingContext2D, w: number, h: number, u: number, st: SceneState, t: number, dt: number): void {
    if (this.journeyOn) { this.windSky(c, w, h, u, st, t); return; } // (on the journey, Seo stands in the world beside Cirra)
    // Seo: tangled and slumped; it stirs at the gift and stands; on the drop its kites go up and it flies them, swaying
    const wake = t >= CT.gift ? 1 : Math.min(0.3, this.sparks * 0.03), fly = t >= CT.drop ? 1 : t >= CT.helion ? 0.25 : 0;
    const W = this.wake.step(wake, dt), F = this.fly.step(fly, dt), sway = this.sway.step(t >= CT.drop ? 0.25 * Math.sin(st.time * 1.3) : 0, dt), fl = this.flap.step(Math.sin(st.time * 4) * (0.3 + F), dt);
    const lit = sm((t - CT.drop) / 1.2) * 0.9 + Math.min(0.1, this.sparks * 0.01);
    W2.seo(c, w * 0.18, h * 0.975, 0.78 * u, { wake: W, fly: F, sway, flap: fl, lit, t: st.time, face: 1 });
    // the kite strings (the drop's second half): long lines of light run across the sky behind the course
    const strings = sm((t - CT.strings) / 0.6) * (1 - sm((t - CT.lift) / 0.5));
    if (strings > 0.01) { c.save(); c.strokeStyle = `rgba(255,230,250,${0.35 * strings})`; c.lineWidth = 1.4; for (let i = 0; i < 6; i++) { const y0 = h * (0.15 + i * 0.12) + Math.sin(st.time + i) * 8; c.beginPath(); c.moveTo(-10, y0); c.quadraticCurveTo(w * 0.5, y0 + 40 * Math.sin(st.time * 0.8 + i), w + 10, y0 - 30); c.stroke(); } c.restore(); }
    // the wind itself, in the sky: streams of light on the gusts
    const gust = (t > CT.drop && t < CT.mini) || (t > CT.kites && t < CT.mini2) ? 1 : 0;
    if (gust) { c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; for (let i = 0; i < 22; i++) { const r = K.RNG(i * 5 + 1), y = h * r(), x = ((r() * w * 2 + st.time * (300 + 300 * r()) * u) % (w * 1.6)) - w * 0.3; c.strokeStyle = `rgba(255,225,245,${0.18 + 0.2 * r()})`; c.lineWidth = 1 + 2 * r(); c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 60 * u, y - 14 * u, x + 140 * u, y); c.stroke(); } c.restore(); }
  }
  /** the wind in the sky: streams of light on the gusts and through the drops */
  private windSky(c: CanvasRenderingContext2D, w: number, h: number, u: number, st: SceneState, t: number): void {
    const gust = (t > CT.drop && t < CT.mini) || t > CT.kites ? 1 : t > CT.gust && t < CT.gust + 1.6 ? 0.6 : 0;
    if (!gust) return;
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    for (let i = 0; i < 22; i++) { const r = K.RNG(i * 5 + 1), y = h * r(), x = ((r() * w * 2 + st.time * (300 + 300 * r()) * u) % (w * 1.6)) - w * 0.3, L = (40 + 80 * r()) * u; c.strokeStyle = `rgba(255,230,250,${0.12 * gust})`; c.lineWidth = 1 + 1.5 * r(); c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + L * 0.5, y - 6 * u, x + L, y); c.stroke(); }
    c.restore();
  }
  protected camAt(s: number): number {
    if (!this.journeyOn) return s >= CT.lift && s < CT.kites ? 1.1 : s >= CT.kites ? 0.82 + 0.1 * sm((s - CT.kites - 0.5) / 3) : super.camAt(s);
    // the journey: the rim calm; the build pushes in; the drop pulls back; the spiral wide (it winds outward); the shelves
    // closer; the whole sky (the pull-back) far; the second drop wide
    return s < CT.gift ? 0.95 : s < CT.gust - 0.3 ? 0.95 + 0.05 * sm((s - CT.gift) / 3) : s < CT.helion + 0.4 ? 0.84 : s < CT.drop ? 0.84 + 0.2 * sm((s - CT.helion - 0.4) / 1.2) : s < CT.spiral + 0.8 ? 0.82 : s < CT.shelves + 0.6 ? 0.82 - 0.12 * sm((s - CT.spiral - 0.8) / 1.5) : s < CT.lift ? 0.86 : s < CT.kites ? 0.86 - 0.44 * sm((s - CT.lift) / 0.5) + 0.4 * sm((s - CT.kites + 0.7) / 0.5) : 0.82;
  }
}

// ================================================================ Glassmere, on Luna (128 BPM)
const GT = { gift: 7.5, helion: 13.125, drop: 15.0, vell: 26.25, riser: 37.5, mirror: 45.0, back: 69.375, end: 76.875, spb: 60 / 128 };
export class GlassWorld extends PlanetWorld {
  private wake = new Spring(0, 2.5); private side = new Spring(0, 5); private bow = new Spring(0, 3); private flips = 0; private flipAt = -9;
  constructor() {
    super({ key: 'blank', T: GT, layer: W2.glassLayer, layerName: 'glassLayer', col: [170, 220, 255], stillness: 0.55, signal: 0.65,
      sky: [[[0, [8, 10, 22]], [0.55, [18, 24, 40]], [1, [26, 32, 50]]], [[0, [10, 24, 60]], [0.55, [40, 90, 150]], [1, [140, 200, 240]]]] });
    this.world.relit = 20;
  }
  protected resetMore(): void { this.wake.x = 0; this.flips = 0; }
  spark(a: number, song: number): void { super.spark(a, song); this.flips++; this.flipAt = song; }
  protected planetMore(c: CanvasRenderingContext2D, R: number, st: WorldState): void {
    const t = st.song;
    // the surface breaking: ripples ring out from the planet on every good tap, and on the drop
    W2.ripples(c, 0, 0, R, st.time, sm((t - GT.drop) / 0.5) * 0.8 + Math.exp(-(t - this.flipAt) * 3) * 0.6);
    // in the reflection world (the mirror), the planet's light is cooler and deeper
    const inside = sm((t - GT.mirror) / 0.4) * (1 - sm((t - GT.back) / 0.4));
    if (inside > 0.01) { c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = `rgba(120,140,220,${0.45 * inside})`; c.beginPath(); c.arc(0, 0, R * 1.01, 0, TAU); c.fill(); c.restore(); }
  }
  protected skyMore(c: CanvasRenderingContext2D, w: number, h: number, u: number, st: SceneState, t: number, dt: number): void {
    // Vell, under the water at the bottom of the picture: it stands as the lake wakes, mirrors each flip above, bows at the end
    const wake = this.wake.step(t >= GT.gift ? 1 : Math.min(0.3, this.sparks * 0.03), dt);
    const mirrorTarget = t >= GT.vell ? (this.flips % 2 ? 1 : -1) : 0, side = this.side.step(mirrorTarget, dt);
    const bow = this.bow.step(t >= GT.end - 2 ? 1 : 0, dt), lit = sm((t - GT.drop) / 1.2);
    W2.vell(c, w * 0.7, h * 0.84, 0.75 * u, { wake, mirror: side, bow, ripple: Math.exp(-(t - this.flipAt) * 3) + 0.3 * sm((t - GT.drop) / 1), lit, t: st.time });
    // through the looking-lake: the whole picture is the reflection (cool, with the stars below the line as above it)
    const inside = sm((t - GT.mirror) / 0.4) * (1 - sm((t - GT.back) / 0.4));
    if (inside > 0.01) { c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = `rgba(110,140,230,${0.4 * inside})`; c.fillRect(0, 0, w, h); c.restore(); for (let i = 0; i < 30; i++) { const r = K.RNG(i * 7 + 9); K.glow(c, r() * w, h * (0.55 + 0.45 * r()), 3 * u, [210, 235, 255], 0.7 * inside); } }
    // mist over the water, slow
    for (let i = 0; i < 6; i++) { const r = K.RNG(i * 3 + 5), x = ((r() * w + st.time * (6 + 6 * r()) * u) % (w * 1.4)) - w * 0.2; K.glow(c, x, h * (0.7 + 0.2 * r()), (80 + 60 * r()) * u, [170, 200, 230], 0.06, 'screen'); }
  }
  protected camAt(s: number): number { return s >= GT.riser && s < GT.mirror ? 1 + 0.12 * sm((s - GT.riser) / (GT.mirror - 0.3 - GT.riser)) : s >= GT.mirror ? 0.8 + 0.12 * sm((s - GT.mirror - 0.6) / 3) : super.camAt(s); }
}

// ================================================================ Verdance, on Willow Tree (100 BPM, a bar 2.4 s)
const VT = { gift: 9.6, helion: 14.4, drop: 19.2, chase: 31.2, lift: 45.6, dark: 50.4, dual: 52.8, end: 79.2, spb: 0.6 };
export class VerdWorld extends PlanetWorld {
  private climb = new Spring(0, 1.6); private reach = new Spring(0, 2.2); private lights = new Spring(0, 2); private pushAt = -9;
  constructor() {
    super({ key: 'invincible', T: VT, layer: W2.verdLayer, layerName: 'verdLayer', col: [160, 240, 160], stillness: 0.85, signal: 0.9,
      sky: [[[0, [6, 8, 10]], [0.55, [14, 18, 18]], [1, [20, 24, 22]]], [[0, [8, 20, 16]], [0.55, [30, 70, 50]], [1, [90, 150, 100]]]] });
    this.world.relit = 25;
  }
  protected resetMore(): void { this.climb.x = 0; this.lights.x = 0; }
  protected planetMore(c: CanvasRenderingContext2D, R: number, st: WorldState): void {
    // the dark (one bar of near stillness before the last drop): everything but his brother's signal goes out
    const t = st.song, dark = t > VT.dark - 0.2 && t < VT.dual ? sm((t - VT.dark + 0.2) / 0.4) * (1 - sm((t - VT.dual + 0.15) / 0.15)) : 0;
    if (dark > 0.01) { c.fillStyle = `rgba(2,3,4,${0.7 * dark})`; c.beginPath(); c.arc(0, 0, R * 1.02, 0, TAU); c.fill(); }
  }
  protected skyMore(c: CanvasRenderingContext2D, w: number, h: number, u: number, st: SceneState, t: number, dt: number): void {
    const lit = sm((t - VT.drop) / 1.2) * 0.9;
    // the great tree behind the ring, its branches growing out as the world relights
    W2.greatTree(c, w * 0.5, h * 0.62, 0.55 * u, Math.min(1, 0.2 + this.sparks * 0.01 + lit * 0.8), lit, st.time);
    // Morrow, gripping the trunk at the edge: it climbs on the drop (the climb), reaches through the chase, the seed-lights on its back alight
    const climb = this.climb.step(t >= VT.drop ? Math.min(1, (t - VT.drop) / 26) : 0, dt), reach = this.reach.step(t >= VT.drop ? 0.5 + 0.5 * Math.sin(st.time * 0.8) : 0.2, dt), lights = this.lights.step(t >= VT.dual ? 1 : t >= VT.drop ? 0.4 : Math.min(0.15, this.sparks * 0.01), dt);
    W2.morrow(c, w * 0.92, h * 1.02, 0.55 * u, { climb, reach, lights, breath: (st.time * 0.18) % 1, lit, t: st.time });
    // leaves and pollen in the air, once it breathes again
    W2.leaves(c, w, h, st.time, sm((t - VT.drop) / 1.5) * (t > VT.dark - 0.2 && t < VT.dual ? 0.1 : 1));
    // the dark: everything but his brother's signal goes out for a bar
    const dark = t > VT.dark - 0.2 && t < VT.dual ? sm((t - VT.dark + 0.2) / 0.4) * (1 - sm((t - VT.dual + 0.15) / 0.15)) : 0;
    if (dark > 0.01) { c.fillStyle = `rgba(2,3,4,${0.75 * dark})`; c.fillRect(0, 0, w, h); horizon(c, w, h, dark, st.time); }
  }
  /** chased up the tree: the residue rises from below along the course, pushed back by good landings (pressure only) */
  protected courseMore(c: CanvasRenderingContext2D, v: CourseView): void {
    if (v.hit && v.song > VT.chase) this.pushAt = v.time;
    const s = v.song;
    if (s < VT.chase - 0.2 || s > VT.lift + 1.4) return;
    const enter = sm((s - VT.chase) / 1.5), leave = sm((s - VT.lift) / 1.2), push = Math.exp(-(v.time - this.pushAt) / 0.5);
    const gap = 3.2 + 1.0 * push + leave * 10 + (1 - enter) * 4, a = enter * (1 - leave);
    if (a <= 0.01) return;
    const rb = v.rb, ref = v.beat, front = v.beat - gap;
    c.globalAlpha = a; c.lineCap = 'round';
    for (const [col, extra] of [['rgba(170,160,190,0.3)', 0.5], ['rgba(6,8,8,0.94)', 0]] as Array<[string, number]>) {
      c.strokeStyle = col;
      for (let i = 0; i < 12; i++) { const b0 = front - i * 0.2, [x0, y0] = v.pos(b0, -0.05, ref), [x1, y1] = v.pos(b0 - 0.24, -0.05, ref); c.lineWidth = rb * ((4.4 - i * 0.3) + extra) * (1 + 0.06 * Math.sin(v.time * 3 + i)); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
    }
    c.globalAlpha = 1;
  }
  protected camAt(s: number): number { return s >= VT.lift && s < VT.dark ? 1 + 0.1 * sm((s - VT.lift) / 4) : s >= VT.dark && s < VT.dual ? 1.14 : s >= VT.dual ? 0.8 + 0.12 * sm((s - VT.dual - 0.6) / 3) : super.camAt(s); }
}

/** The lines each inhabitant speaks (2-3, in calm moments only, low on the screen, never over the course). */
const LOW = (from: number, to: number, text: string): Said => ({ from, to, text, x: 0.5, y: 0.2, size: 19, align: 'center' });
export const WRITTEN2: Record<string, Said[]> = {
  skyhigh: [LOW(0.5, 4.6, 'No wind. Not since the music stopped.'), LOW(7.6, 11.4, 'There. Feel that? A gust.'), LOW(11.6, 14.6, 'Turn when the line pulls. You’ll feel it.')],
  blank: [LOW(0.5, 4.8, 'You look well. From here, everyone does.'), LOW(8.0, 12.6, 'Down here, the water remembers the music.'), LOW(37.6, 43.2, 'Come and see the other side.')],
  invincible: [LOW(0.6, 5.2, 'Slow, little light. The tree is old.'), LOW(9.8, 14.2, 'Hold on. Now let go. Both are the work.'), LOW(45.7, 50.2, 'It’s dark up there. Climb anyway.')]
};
/** What is written into a sleeping world's sky before its first attempt. */
const NAME = (from: number, to: number, text: string, y: number, size: number): Said => ({ from, to, text, x: 0.5, y, size, align: 'center' });
export const BEFORE2: Record<string, Said[]> = {
  skyhigh: [NAME(-8.4, -2.6, 'Cirra, the windless sky.', 0.2, 24), NAME(-6.8, -2.6, 'Seo, tangled in its own lines.', 0.245, 21), NAME(-5.0, -2.0, 'One gust of its wind is left, and it comes to you.', 0.29, 18)],
  blank: [NAME(-8.4, -2.6, 'Glassmere, the still lake.', 0.2, 24), NAME(-6.8, -2.6, 'Vell, waiting under the water.', 0.245, 21), NAME(-5.0, -2.0, 'One ripple is left, and it comes to you.', 0.29, 18)],
  invincible: [NAME(-8.4, -2.6, 'Verdance, under the great tree.', 0.2, 24), NAME(-6.8, -2.6, 'Morrow, holding on in the dark.', 0.245, 21), NAME(-5.0, -2.0, 'One seed-light is left, and it comes to you.', 0.29, 18)]
};
export const _unused = lerp;
