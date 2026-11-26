// The worlds you play on (the owner's brief, 2026-11-25): the level is the story. Each world is two pieces the
// renderer draws: a backdrop (the sky, the far shadow rings with Helion's moment, the inhabitant beside the planet, the
// lines it speaks) behind everything, and the planet itself in the middle of the ring, under the course. The
// relighting happens in play: every good tap lights the zone under Orbin; the drop lights everything.
//
// Motion: every state change is a spring (critically damped, settling in about 0.4-1 s), with anticipation where it
// helps (a dip before a rise), and the parts that hang off a body (antlers, tail) on slower springs of their own, so
// they lag and settle after it. Nothing is ever perfectly still: everyone breathes.
import { COMPANIONS } from '../art/companions.js';
import { K } from '../art/painter.js';
import { LANDING } from '../art/landingpaint.js';
import { askLandingSky, askLevelSky, askPlanet, landingSky, levelSky, planetLayer, type SkySpec } from '../art/paintcache';
import { WORLDS as W } from '../art/worldpaint.js';
import { CANON } from '../art/canonpaint.js';
import { DUSK } from '../art/painter.js';
import { writeSays, type Said, type SceneState } from './skyplanet';
import { save } from '../save';
import { EIGHT_LOBES } from '../gd/shapes';

const TAU = Math.PI * 2;
const sm = (x: number) => { const t = x < 0 ? 0 : x > 1 ? 1 : x; return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** A critically damped spring: settles on its target in about 4/omega seconds, never overshooting. */
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
class Spring {
  v = 0;
  constructor(public x: number, private omega = 7) {}
  step(target: number, dt: number): number { const w = this.omega; this.v += (w * w * (target - this.x) - 2 * w * this.v) * dt; this.x += this.v * dt; return this.x; }
}

/** What the world is told each frame, in the course's own frame (angles round the planet, song time). */
export interface WorldState {
  time: number; song: number; drive: number; kick: number; strike: number; calm: boolean;
  /** the journey (levels with places): the place he is at (part-way in a leap), one base-ring radius on screen, where
   * place k is from the one being drawn at, a point on place k's path (angle, radius), its stretch of orbit */
  pf?: number; unit?: number; rel?: (k: number) => [number, number]; along?: (k: number, a: number, r: number) => [number, number]; span?: (k: number) => [number, number]; wide?: boolean;
  /** the course as a perfect run plays it: where he is at a beat (in this frame), which way is up there, its presses, and how many are done */
  at?: (beat: number) => [number, number]; up?: (beat: number) => number; presses?: ReadonlyArray<{ beat: number; tol: number; form: string; auto: boolean; pad: string; land: number; leap?: { b0: number; b1: number; p0: number; ember: boolean } }>; done?: number; rb?: number;
}
export interface World {
  /** the planet, drawn at the course's centre (the canvas is already translated there), radius R */
  draw(c: CanvasRenderingContext2D, R: number, st: WorldState): void;
  /** a good tap, at this angle round the planet: the zone there relights */
  spark(a: number, song: number, pf?: number): void;
  /** a new attempt: everything goes back to how the Stillness left it */
  reset(): void;
  /** back to an ember: what was relit after this song time goes dark again; what was relit before it stays */
  rewind(to: number): void;
  /** the level's set pieces that live on the course itself (drawn over the course, in its own frame) */
  onCourse?(c: CanvasRenderingContext2D, v: CourseView): void;
  /** a song time at which the planet is drawn whole and relit (the flight home looks down on it) */
  relit?: number;
  /** the camera's scale at a song time (1: as the course sets it; less: pulled back to show the world whole) */
  cam?(song: number): number;
  /** the journey: pull the camera toward a point (base-ring radii, portrait layout) by k, 0..1 (to show the whole system) */
  pull?(song: number): { x: number; y: number; k: number } | null;
}
/** What a world is told to draw on the course: where things are, at which beat. */
export interface CourseView {
  beat: number; song: number; time: number; spb: number; rb: number;
  /** the course: its presses (the last is the level's last wall) */
  presses: Array<{ beat: number; pad: string; land: number }>;
  /** where the course runs at a beat (a perfect run), lifted `dl` ring levels (at the ring of beat `ref`, if given) */
  pos(beat: number, dl?: number, ref?: number): [number, number];
  /** the screen radius of the course's ring at a beat */
  ring(beat: number): number;
  /** the angle of the course at a beat (screen, radians) */
  ang(beat: number): number;
  center: [number, number];
  planetR: number;
  /** a good tap this frame */
  hit: boolean;
}
/** The backdrop a world brings (the renderer's `backdrop`): it also carries the lines the inhabitant speaks. */
export interface WorldSky { says: Said[]; prepare(): void; draw(c: CanvasRenderingContext2D, w: number, h: number, st: SceneState): void }

const ZONES = 12;
/** a picture painted once: on the page, or by the paint worker */
export type Pic = HTMLCanvasElement | ImageBitmap;
/** Emberwick's sky, cold and relit */
const EMBER_SKY: [SkySpec, SkySpec] = [
  { stops: [[0, [10, 10, 22]], [0.55, [26, 22, 40]], [1, [34, 26, 40]]], seed: 11, fin: 41 },
  { stops: [[0, [24, 10, 26]], [0.55, [92, 40, 54]], [1, [150, 74, 60]]], seed: 11, fin: 41 },
];
/** A level's sky at this size: the worker's, when it has painted it, else painted here. */
export function skyOf(w: number, h: number, s: SkySpec): Pic {
  const pre = levelSky(w, h, s); if (pre) return pre;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d')!, r = K.RNG(s.seed);
  DUSK.tools.sky(c, w, h, s.stops as never, r, 70); DUSK.tools.stars(c, w, h, r, Math.round((w * h) / 1500), 3); DUSK.tools.finish(c, w, h, s.fin, 0.3); return cv;
}
/** Ask the paint worker for Emberwick's planet and sky ahead of the level. */
export function askEmber(): void { askPlanet('emberLayer'); for (const n of BODIES) askPlanet(n); for (const s of EMBER_SKY) askLevelSky(window.innerWidth, window.innerHeight, s); }
/** Emberwick's system: the bodies of its journey besides the planet itself */
const BODIES = ['ashLayer', 'crucibleLayer', 'twinaLayer', 'twinbLayer'] as const;
/** where Ossa stands, from Emberwick's centre (base-ring radii, portrait), and how big she is per base-ring radius */
const OSSA_AT: [number, number] = [2.0, 1.95], OSSA_S = 0.0098, OSSA_DEPTH = 0.9, TWINS_SIZE = 1.7; // (she stands a little behind: she drifts less than the places as the camera moves)
const zoneOf = (a: number) => ((Math.floor((((a % TAU) + TAU) % TAU) / (TAU / ZONES)) % ZONES) + ZONES) % ZONES;
/** draw the hot layer over the cold one where the zones are lit: soft overlapping patches, never hard wedges */
let mask: HTMLCanvasElement | null = null;
// (the composite is kept: it is only made again while a zone is still fading in, or the whole planet's light changes;
// the performance pass of 2026-11-25)
let lastKey = '', lastCold: Pic | null = null, comp: HTMLCanvasElement | null = null, compAny = false;
function zones(c: CanvasRenderingContext2D, cold: Pic, hot: Pic, R: number, lit: number[], time: number, all: number): void {
  const S = cold.width, k = R / W.R0, half = (S * k) / 2;
  if (all >= 0.995) { c.drawImage(hot, -half, -half, S * k, S * k); return; }
  const key = `${Math.round(all * 200)}|${lit.map((t0) => (t0 < 0 ? -1 : Math.round(sm((time - t0) / 0.5) * 100))).join(',')}`;
  if (key === lastKey && cold === lastCold && comp) { c.drawImage(compAny ? comp : cold, -half, -half, S * k, S * k); return; }
  lastKey = key; lastCold = cold;
  if (!comp || comp.width !== S) { comp = document.createElement('canvas'); comp.width = comp.height = S; }
  const cc = comp.getContext('2d')!;
  cc.globalCompositeOperation = 'source-over'; cc.clearRect(0, 0, S, S); cc.drawImage(cold, 0, 0);
  compAny = zonesInto(cc, hot, S, lit, time, all);
  c.drawImage(compAny ? comp : cold, -half, -half, S * k, S * k);
}
function zonesInto(cc: CanvasRenderingContext2D, hot: Pic, S: number, lit: number[], time: number, all: number): boolean {
  if (!mask || mask.width !== S) { mask = document.createElement('canvas'); mask.width = mask.height = S; }
  const m = mask.getContext('2d')!;
  m.globalCompositeOperation = 'source-over'; m.clearRect(0, 0, S, S);
  let any = all > 0.004;
  if (any) { m.fillStyle = `rgba(255,255,255,${all})`; m.fillRect(0, 0, S, S); }
  for (let z = 0; z < ZONES; z++) {
    const a = lit[z] < 0 ? 0 : sm((time - lit[z]) / 0.5);
    if (a <= 0.004) continue;
    any = true;
    const ang = ((z + 0.5) * TAU) / ZONES, x = S / 2 + Math.cos(ang) * W.R0 * 0.62, y = S / 2 + Math.sin(ang) * W.R0 * 0.62, rr = W.R0 * 0.72;
    const g = m.createRadialGradient(x, y, 0, x, y, rr); g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(0.55, `rgba(255,255,255,${0.8 * a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    m.fillStyle = g; m.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  if (!any) return false;
  m.globalCompositeOperation = 'source-in'; m.drawImage(hot, 0, 0);
  cc.drawImage(mask, 0, 0);
  return true;
}
/** the far shadow rings on the horizon, with Helion's signal behind them; at his moment his silhouette flickers there */
function horizon(c: CanvasRenderingContext2D, w: number, h: number, helion: number, time: number): void {
  const gx = w * 0.2, gy = h * 0.12, u = Math.min(w / 390, h / 844);
  c.save(); c.strokeStyle = 'rgba(10,8,20,0.85)'; c.lineWidth = 3 * u; for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(gx, gy, (26 + i * 9) * u, (8 + i * 3) * u, -0.2 + i * 0.25, 0, TAU); c.stroke(); } c.restore();
  K.glow(c, gx, gy, 14 * u * (1 + helion), [255, 214, 140], 0.5 + 0.4 * helion);
  if (helion > 0.01) {
    const flick = helion * (0.55 + 0.45 * Math.sin(time * 23) * Math.sin(time * 7.1));
    c.save(); c.globalAlpha = Math.max(0, flick);
    CANON.parts.spark(c, gx, gy + 8 * u, 0.12 * u, { who: 'helion', glow: 0.9, arms: 'reach', face: 1, eyes: 'soft', crest: 0.8, lite: true });
    c.restore();
    K.glow(c, gx, gy, 60 * u, [255, 226, 170], 0.35 * helion, 'screen');
  }
}

// ================================================================ Emberwick
/** Emberwick's timeline, in song seconds (the re-cut of 2026-11-25) */
const ET = { held: 9.6, stabs: 12, riser: 16.8, drop: 19.2, lava: 20.4, bridge: 29.4, back: 34.8, tip: 35.5, breath: 36, breathEnd: 38.4, dive: 37.6, core: 38.4, end: 57.6, spb: 0.6 };

export class EmberWorld {
  private cold: Pic | null = null; private hot: Pic | null = null;
  private skyCold: Pic | null = null; private skyHot: Pic | null = null; private key = '';
  private lit: number[] = new Array(ZONES).fill(-1); private sparks = 0;
  private rise = new Spring(0, 5); private head = new Spring(0.62, 6); private antler = new Spring(0, 3.5); private tail = new Spring(0, 3); private litS = new Spring(0.05, 3);
  private lastT = -1; private lastPhase = 0; private impact = -9; private stirAt = -9;
  private embers: Array<{ x: number; y: number; vx: number; vy: number; at: number }> = [];
  says: Said[] = [];
  // the journey (2026-11-26): its other bodies, each place's light (from the good taps played there), Ossa's pose
  private bodies: Partial<Record<(typeof BODIES)[number], [Pic, Pic]>> = {};
  private taps: Array<{ k: number; at: number }> = [];
  private heat = [0, 0, 0, 0, 0, 0];
  private pose = { R: 0, H: 0.62, L: 0.05, rear: 0, A: 0, Tl: 0, hammer: false };

  private paint(w: number, h: number): void {
    const key = `${w}x${h}`; if (key === this.key) return; this.key = key;
    if (!this.cold) { this.cold = planetLayer('emberLayer', false) ?? W.emberLayer(false); this.hot = planetLayer('emberLayer', true) ?? W.emberLayer(true); }
    for (const n of BODIES) if (!this.bodies[n]) this.bodies[n] = [planetLayer(n, false) ?? W[n](false), planetLayer(n, true) ?? W[n](true)];
    this.skyCold = skyOf(w, h, EMBER_SKY[0]); this.skyHot = skyOf(w, h, EMBER_SKY[1]);
  }
  reset(): void { this.lit.fill(-1); this.sparks = 0; this.lastT = -1; this.impact = -9; this.embers = []; this.rise.x = 0; this.head.x = 0.62; this.litS.x = 0.05; this.taps = []; this.heat.fill(0); }
  rewind(to: number): void { for (let z = 0; z < ZONES; z++) if (this.lit[z] > to) this.lit[z] = -1; this.embers = []; this.lastT = -1; this.taps = this.taps.filter((x) => x.at <= to); }
  spark(a: number, song: number, pf = 1): void {
    const k = Math.round(pf);
    this.taps.push({ k, at: song });
    if (k !== 1 && k !== 5) return; // (a tap on another place lights that place; Emberwick's own zones relight from its ring)
    const z = zoneOf(a); if (this.lit[z] < 0) this.lit[z] = song; this.sparks++; if (this.sparks === 3) this.stirAt = song;
  }

  /** the planet, under the course */
  readonly world: World = {
    reset: () => this.reset(),
    rewind: (to) => this.rewind(to),
    spark: (a, song, pf) => this.spark(a, song, pf),
    onCourse: (c, v) => this.onCourse(c, v),
    relit: 30,
    // the journey's camera: on the lava moons it is pulled back toward Emberwick, so Ossa and her strikes stay in view;
    // as the dive begins it pulls right back to show the whole system relit, then tips into the forge
    pull: (s) => (s >= ET.lava && s < ET.back ? { x: 0, y: 0.2, k: 0.34 * sm((s - ET.lava) / 1.2) } : s >= ET.back && s < ET.dive ? { x: 0.1, y: -2.6, k: sm((s - ET.back) / 0.5) * (1 - sm((s - ET.tip) / 0.45)) } : null),
    // the camera follows the song: it pushes in through the build, holds on the riser's last beat (the tension), and
    // pulls back hard on the drop to show the planet ablaze, settling as the drop runs; in the core it is a little close
    cam: (s) => (s < ET.held ? 0.9 : s < ET.stabs ? 0.9 - 0.18 * sm((s - ET.held) / 0.8) + 0.28 * sm((s - ET.stabs + 0.9) / 0.9) : s < ET.drop ? 1 + 0.12 * sm((s - ET.stabs) / (ET.drop - 0.3 - ET.stabs)) : s < ET.lava ? 0.8 : s < ET.bridge ? 0.8 - 0.14 * sm((s - ET.lava) / 1.2) : s < ET.back ? 0.66 + 0.16 * sm((s - ET.bridge) / 0.8) : s < ET.tip ? 0.82 - 0.5 * sm((s - ET.back) / 0.5) : s < ET.core ? 0.32 + 0.58 * sm((s - ET.tip) / 0.45) + 0.25 * sm((s - ET.dive + 0.4) / 0.4) : 0.95),
    draw: (c, R, st) => {
      if (!this.cold || !this.hot) return;
      if (st.rel && st.at && st.song < ET.core) { this.journey(c, R, st); return; }
      this.planet(c, R, st);
    }
  };

  /** Emberwick itself (at the frame's origin) */
  private planet(c: CanvasRenderingContext2D, R: number, st: WorldState): void {
    {
      if (!this.cold || !this.hot) return;
      const t = st.song, dropK = sm((t - ET.drop) / 0.35);
      // into the core (the second half): the camera dives through the forge's mouth, and the planet's heart is the place
      if (t >= ET.core) { this.heart(c, R, st); return; }
      const dive = sm((t - ET.dive) / (ET.core - ET.dive));
      const k0 = R / W.R0, mx = Math.cos(W.EMBER.forge) * R * 0.97, my = Math.sin(W.EMBER.forge) * R * 0.97 - 26 * k0;
      if (dive > 0) { c.save(); const z = 1 + 9 * dive * dive; c.translate(mx, my); c.scale(z, z); c.translate(-mx, -my); }
      zones(c, this.cold, this.hot, R, this.lit, t, dropK);
      // the forge: banked, then glowing as Ossa wakes, then roaring on the drop (with the kick)
      const heat = t < ET.held ? 0.04 + Math.min(0.2, this.sparks * 0.02) : t < ET.stabs ? 0.35 : t < ET.drop ? 0.5 + 0.2 * sm((t - ET.riser) / 2.4) : 0.85 + 0.15 * st.kick;
      const k = R / W.R0, fx = Math.cos(W.EMBER.forge) * R * 0.97, fy = Math.sin(W.EMBER.forge) * R * 0.97, mouth = [fx, fy - 26 * k];
      K.glow(c, mouth[0], mouth[1], 90 * k * (0.5 + heat), [255, 140, 60], 0.6 * heat, 'screen');
      if (heat > 0.3) for (let i = 0; i < Math.round(12 * heat); i++) { const r = K.RNG(i * 13 + Math.floor(st.time * 6)), y0 = fy - 132 * k; K.glow(c, fx + (r() - 0.5) * 30 * k, y0 - r() * 90 * k * heat, (2 + r() * 3) * k, [255, 200, 120], 0.8 * heat); }
      // the anvil rings with each of Ossa's blows
      const flash = Math.exp(-(st.time - this.impact) * 6);
      if (flash > 0.02) { const ax = Math.cos(W.EMBER.anvil) * R, ay = Math.sin(W.EMBER.anvil) * R; K.glow(c, ax, ay, 120 * k, [255, 210, 140], 0.7 * flash, 'screen'); }
      // the Kindling, the forge's last spark, rising from its mouth at the held bar (it gives the Meteor on the stabs)
      if (t > ET.held - 0.2 && t < ET.stabs + 0.3) {
        const q = sm((t - ET.held + 0.2) / 2.2), a = 1 - sm((t - ET.stabs) / 0.3);
        COMPANIONS.kindling(c, mouth[0] + Math.sin(st.time * 2) * 10 * k, mouth[1] - 140 * k * q, 0.5 * k * 1.6, COMPANIONS.KINDLE.heroes, { flap: 0.5 + 0.5 * Math.sin(st.time * 5), alpha: sm((t - ET.held + 0.2) / 0.5) * a });
      }
      // ablaze: from the drop, flame ribbons lick round the planet's rim, rising and curling with the kick
      const blaze = sm((t - ET.drop) / 0.4) * (1 - sm((t - ET.breath) / 0.6) * 0.5);
      if (blaze > 0.01) {
        c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
        for (let i = 0; i < 22; i++) {
          const a0 = (i / 22) * TAU + st.time * 0.35, flick = 0.6 + 0.4 * Math.sin(st.time * 7 + i * 1.7), len = R * (0.16 + 0.14 * flick + 0.12 * st.kick) * blaze;
          const x0 = Math.cos(a0) * R * 0.98, y0 = Math.sin(a0) * R * 0.98, nx = Math.cos(a0), ny = Math.sin(a0);
          c.strokeStyle = `rgba(255,${150 + Math.round(70 * flick)},70,${0.28 * blaze})`; c.lineWidth = R * 0.05 * (0.6 + 0.4 * flick);
          c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(x0 + nx * len * 0.6 - ny * len * 0.35, y0 + ny * len * 0.6 + nx * len * 0.35, x0 + nx * len + ny * len * 0.2 * Math.sin(st.time * 3 + i), y0 + ny * len - nx * len * 0.2 * Math.sin(st.time * 3 + i)); c.stroke();
        }
        c.restore();
      }
      if (dive > 0) { c.restore(); K.glow(c, mx, my, R * 3 * dive, [255, 230, 170], dive * dive, 'screen'); }
    }
  }

  /**
   * The journey (the owner's brief of 2026-11-26): every place of Emberwick's system painted where it is, each catching
   * light as it is played; Ossa, a giant beside Emberwick, hammering, every strike thrown out as a ring of fire that
   * reaches Orbin on the beat it launches him; and the objects on the course (anvils, bellows, embers in the air).
   */
  private journey(c: CanvasRenderingContext2D, R: number, st: WorldState): void {
    this.journeyOn = true;
    const t = st.song, U = st.unit ?? R / 0.84, rel = st.rel!, time = st.time, dt = this.jT < 0 ? 0 : Math.min(0.05, Math.max(0, time - this.jT)); this.jT = time;
    const wide = !!st.wide, turn = (x: number, y: number): [number, number] => (wide ? [-y, x] : [x, y]);
    // each place's light: a few good taps there light it; the drop lights them all a little more
    const n = [0, 0, 0, 0, 0, 0]; for (const x of this.taps) if (x.at <= t && x.k >= 0 && x.k < 6) n[x.k]++;
    for (let k = 0; k < 6; k++) { const want = Math.min(1, n[k] / 5) * 0.8 + (t >= ET.drop ? 0.2 : 0); this.heat[k] += (want - this.heat[k]) * Math.min(1, dt * 2.5); }
    const body = (name: (typeof BODIES)[number], x: number, y: number, r: number, heat: number): void => {
      const pic = this.bodies[name]; if (!pic) return;
      const S = (pic[0].width * r) / W.R0;
      c.drawImage(pic[0], x - S / 2, y - S / 2, S, S);
      if (heat > 0.01) { c.globalAlpha = heat; c.drawImage(pic[1], x - S / 2, y - S / 2, S, S); c.globalAlpha = 1; }
    };
    // the Slag Bridge: a causeway of cooled crust over the dark, laid under the path, its cracks glowing once crossed
    if (st.along && st.span) {
      const [o0, o1] = st.span(4), [bx, by] = rel(4), pts: Array<[number, number]> = [];
      for (let i = 0; i <= 40; i++) { const a = o0 + (o1 - o0) * (-0.08 + 1.16 * (i / 40)), [x, y] = st.along(4, a, U * 0.9); pts.push([bx + x, by + y]); }
      c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
      const line = (): void => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); };
      line(); c.strokeStyle = 'rgba(30,20,26,0.97)'; c.lineWidth = U * 0.3; c.stroke();
      line(); c.strokeStyle = 'rgba(150,140,180,0.18)'; c.lineWidth = U * 0.3 + 2; c.globalCompositeOperation = 'destination-over'; c.stroke(); c.globalCompositeOperation = 'source-over';
      const h = this.heat[4];
      c.setLineDash([U * 0.12, U * 0.2]); line(); c.strokeStyle = `rgba(255,${120 + Math.round(60 * h)},60,${0.25 + 0.6 * h})`; c.lineWidth = Math.max(1.5, U * 0.025); if (h > 0.3) { c.shadowColor = 'rgba(255,110,40,0.8)'; c.shadowBlur = 8 * h; } c.stroke(); c.setLineDash([]);
      c.restore();
      if (h > 0.05) for (let i = 0; i < 12; i++) { const r = K.RNG(i * 7 + 3), [x, y] = pts[Math.floor(r() * pts.length)]; K.glow(c, x + (r() - 0.5) * U * 0.3, y + (r() - 0.5) * U * 0.3 - ((time * 0.4 + r()) % 1) * U * 0.6, U * 0.02, [255, 170, 90], 0.7 * h); }
    }
    // the Ash Moon, the Crucible, the Twins
    { const [x, y] = rel(0); body('ashLayer', x, y, U * 0.56, this.heat[0]); }
    { const [x, y] = rel(2); body('crucibleLayer', x, y, U * 0.36, this.heat[2]); }
    { const [x, y] = rel(3), rot = wide ? Math.PI / 2 : 0;
      const k = TWINS_SIZE;
      EIGHT_LOBES.forEach(([lx, ly], i) => { const X = (lx * Math.cos(rot) - ly * Math.sin(rot)) * k, Y = (lx * Math.sin(rot) + ly * Math.cos(rot)) * k; body(i ? 'twinbLayer' : 'twinaLayer', x + X * U, y + Y * U, U * (i ? 0.4 : 0.46), this.heat[3]); }); }
    // Ossa, a giant behind Emberwick and beside it, on her hearth-stone, hammering; her blows ring the planet's anvil
    this.posed(t, time, dt);
    const [ex, ey] = rel(1), [ox0, oy0] = turn(OSSA_AT[0] * U, OSSA_AT[1] * U), ox = ex * OSSA_DEPTH + ox0, oy = ey * OSSA_DEPTH + oy0, s = U * OSSA_S, P = this.pose;
    const flash = Math.exp(-(time - this.impact) * 6), hx = ox - W.OSSA_HOOF[0] * s, hy = oy;
    W.hearthStone(c, hx, hy, s * 1.2, flash);
    W.ossa(c, ox, oy, s, { rise: P.R, rear: P.rear, head: P.H, antler: P.A, tail: P.Tl, breath: (time * 0.28) % 1, lit: P.L, flicker: 0.5 + 0.5 * Math.sin(time * 1.7) * Math.sin(time * 0.6), face: -1 });
    // Emberwick, where it is (in front of her), at the size the camera sees it
    { const [x, y] = rel(1); c.save(); c.translate(x, y); this.planet(c, U * 0.84, st); c.restore(); }
    for (let i = this.embers.length - 1; i >= 0; i--) { const e = this.embers[i], a = time - e.at; if (a > 1.2) { this.embers.splice(i, 1); continue; } K.glow(c, hx + e.vx * a * s, hy - 20 * s + (e.vy * a + 140 * a * a) * s, 2.5 * s, [255, 190, 110], 1 - a / 1.2); }
    // her strikes that launch him: a ring of fire thrown out from the hearth-stone on the blow before, reaching him on the launch
    for (const p of st.presses ?? []) {
      if (!p.leap || p.leap.ember) continue;
      const Ts = p.beat * ET.spb; if (Ts < ET.drop || t < Ts - 1.2 || t > Ts + 0.5) continue;
      const [px, py] = st.at!(p.beat), D = Math.hypot(px - hx, py - hy), q = clamp01((t - (Ts - 1.2)) / 1.2), after = clamp01((t - Ts) / 0.5);
      c.save(); c.globalCompositeOperation = 'lighter';
      c.strokeStyle = `rgba(255,${150 + Math.round(70 * q)},80,${(0.25 + 0.45 * q) * (1 - after)})`; c.lineWidth = U * (0.05 + 0.05 * q); c.beginPath(); c.arc(hx, hy, Math.max(1, D * (q * q * (3 - 2 * q) * 0.7 + 0.3 * q) + after * U * 0.8), 0, TAU); c.stroke();
      c.restore();
      if (t >= Ts) K.glow(c, px, py, U * (0.3 + 0.8 * after), [255, 200, 120], 0.8 * (1 - after), 'screen');
    }
    this.objects(c, st, U);
  }
  private jT = -1;
  /** Ossa's pose from the song: every change a spring, her hammering on the beat */
  private posed(t: number, time: number, dt: number): void {
    let rise = 0, head = 0.62, lit = 0.05, rear = 0;
    if (t >= ET.held) { rise = 0.45; head = 0.3; lit = 0.3; }
    if (t >= ET.held && t < ET.held + 0.3) head = 0.75; // anticipation: the head dips before it lifts
    if (t >= ET.stabs) { rise = 1; head = 0.02; lit = 0.55; }
    if (t > this.stirAt && t < this.stirAt + 0.9 && t < ET.held) head = 0.45; // a first stir at the third spark
    if (t >= ET.riser && t < ET.drop) { const q = (t - ET.riser) / (ET.drop - ET.riser); rear = q < 0.15 ? -0.15 * (q / 0.15) : sm((q - 0.15) / 0.85) * 0.9; head = -0.1; lit = 0.7; }
    let hammer = false;
    if (t >= ET.drop && t < ET.end) {
      lit = 1; head = 0.05; hammer = !(t >= ET.back && t < ET.breathEnd);
      if (hammer) {
        const f = (((t - ET.drop) / (2 * ET.spb)) % 1 + 1) % 1;
        rear = f < 0.5 ? 0.85 * (1 - Math.pow(1 - f / 0.5, 3)) : 0.85 * (1 - Math.pow((f - 0.5) / 0.5, 3));
        if (f < this.lastPhase - 0.5) { this.impact = time; for (let i = 0; i < 10; i++) this.embers.push({ x: 0, y: 0, vx: (Math.random() - 0.5) * 160, vy: -80 - Math.random() * 160, at: time }); }
        this.lastPhase = f;
      } else rear = 0.1;
    }
    if (t >= ET.end) { lit = 1; rear = 0.95; head = -0.3; }
    const P = this.pose;
    P.R = this.rise.step(rise, dt); P.H = this.head.step(head, dt); P.L = this.litS.step(lit, dt);
    P.rear = hammer ? rear : (this.rearS ??= new Spring(0, 6)).step(rear, dt);
    if (hammer && this.rearS) this.rearS.x = rear;
    P.A = this.antler.step(-(P.H - 0.3) * 0.25 + (hammer ? -0.12 * P.rear : 0), dt); P.Tl = this.tail.step(-P.rear * 0.6 + 0.1 * Math.sin(time * 0.9), dt);
  }
  /**
   * Emberwick's objects on the course, each in three beats: anticipation (it reacts a beat ahead), contact, follow-through.
   * Ossa's anvils are the Meteor's walls (their faces heat as he comes; they split as he dashes through); the bellows
   * are the pads (they breathe in, slam, wheeze open); the embers in the air are a leap's taps (they brighten, burst).
   * Drawn under the course: the marks and the gold signal stay on top.
   */
  private objects(c: CanvasRenderingContext2D, st: WorldState, U: number): void {
    const beat = st.song / ET.spb, at = st.at!, up = st.up!, rb = st.rb ?? U * 0.066;
    for (const p of st.presses ?? []) {
      const d = p.beat - beat;
      if (d > 3.5 || d < -1.5) continue;
      if (p.form === 'meteor' && !p.leap) {
        const wb = p.beat + p.tol + 0.06, [x, y] = at(wb), a = up(wb), heat = clamp01(1 - d / 2), split = clamp01((beat - wb) / 0.8);
        if (split >= 1) continue;
        c.save(); c.translate(x, y); c.rotate(a + Math.PI / 2); const k = rb / 9.5 * (1 + 0.25 * Math.exp(-Math.abs(beat - wb) * 14)); c.scale(k, k);
        for (const side of split > 0 ? [-1, 1] : [0]) {
          c.save(); if (side) { c.translate(side * 26 * split, -14 * split + 30 * split * split); c.rotate(side * 0.9 * split); c.beginPath(); c.rect(side < 0 ? -60 : 0, -60, 60, 120); c.clip(); c.globalAlpha = 1 - split; }
          c.fillStyle = 'rgb(30,22,32)'; c.beginPath(); c.moveTo(-14, 30); c.lineTo(-10, 12); c.lineTo(-30, 6); c.lineTo(-40, -8); c.lineTo(36, -8); c.lineTo(28, 6); c.lineTo(10, 12); c.lineTo(14, 30); c.closePath(); c.fill();
          c.strokeStyle = `rgba(255,200,140,${0.2 + 0.6 * heat})`; c.lineWidth = 1.6; c.stroke();
          c.fillStyle = `rgba(${Math.round(90 + 165 * heat)},${Math.round(60 + 160 * heat)},${Math.round(60 + 110 * heat)},${0.5 + 0.5 * heat})`; c.fillRect(-38, -10, 72, 4);
          c.restore();
        }
        if (heat > 0.05 && split <= 0) { K.glow(c, 0, -10, 36 * heat, [255, 190, 120], 0.5 * heat, 'screen'); for (let i = 0; i < 4; i++) { const r = K.RNG(i + Math.round(p.beat * 10)), q = ((st.time * 1.3 + r()) % 1); K.glow(c, (r() - 0.5) * 40, -14 - q * 40, 2, [255, 200, 130], 0.8 * heat * (1 - q)); } }
        if (split > 0 && split < 0.6) K.glow(c, 0, 0, 60, [255, 236, 200], 0.9 * (1 - split / 0.6), 'screen');
        c.restore();
      } else if (p.pad === 'jump') {
        const [x, y] = at(p.beat), a = up(p.beat), q = clamp01(1 - d / 1.5), shut = beat < p.beat ? 0 : clamp01(1 - (beat - p.beat) / 0.9);
        const k = rb / 9;
        c.save(); c.translate(x, y); c.rotate(a + Math.PI / 2); c.scale(k * 1.4, k * 1.4); c.translate(0, 26);
        const top = beat < p.beat ? -46 - 6 * q : -46 + 30 * (shut > 0.85 ? 1 : shut / 0.85) * (beat - p.beat < 0.15 ? 1 : shut);
        c.fillStyle = 'rgb(48,30,30)'; c.beginPath(); c.moveTo(-34, -4); c.quadraticCurveTo(-46 - 4 * q, (top - 4) / 2, -30, top); c.lineTo(30, top); c.quadraticCurveTo(46 + 4 * q, (top - 4) / 2, 34, -4); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(110,70,60,0.8)'; c.lineWidth = 1.4; for (let i = 1; i < 4; i++) { const yy = -4 + (top + 4) * (i / 4); c.beginPath(); c.moveTo(-36, yy); c.lineTo(36, yy); c.stroke(); }
        c.fillStyle = 'rgb(28,22,30)'; c.fillRect(-38, -6, 76, 7); c.fillRect(-36, top - 6, 72, 7);
        c.strokeStyle = `rgba(255,180,110,${0.3 + 0.6 * q})`; c.lineWidth = 1.6; c.strokeRect(-36, top - 6, 72, 7);
        K.glow(c, 0, top - 18, 26 * (0.5 + q), [255, 140, 60], 0.6 * q, 'screen');
        if (beat >= p.beat && beat < p.beat + 0.6) { const b2 = (beat - p.beat) / 0.6; const g = c.createLinearGradient(0, top - 10, 0, top - 160); g.addColorStop(0, `rgba(255,230,180,${0.8 * (1 - b2)})`); g.addColorStop(1, 'rgba(255,150,80,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(-10, top - 8); c.lineTo(-50 - 30 * b2, top - 160); c.lineTo(50 + 30 * b2, top - 160); c.lineTo(10, top - 8); c.fill(); }
        if (beat < p.beat) for (let i = 0; i < 6; i++) { const r = K.RNG(i + 5), aa = r() * TAU, dd = (40 - 30 * ((st.time * 0.8 + r()) % 1)); K.glow(c, Math.cos(aa) * dd, top - 26 + Math.sin(aa) * dd * 0.5, 2, [200, 190, 210], 0.6 * q); }
        c.restore();
      } else if (p.leap?.ember) {
        // an ember in the air: a coal turning, brightening as its beat comes; tapped, it bursts into a ring of sparks
        const [x, y] = at(p.beat), bright = clamp01(1 - d / 1.5);
        if (beat < p.beat) {
          K.glow(c, x, y, rb * (2.6 + 1.4 * bright), [255, 140, 60], 0.45 + 0.4 * bright, 'screen');
          c.fillStyle = 'rgb(44,22,24)'; c.beginPath(); c.arc(x, y, rb * 0.95, 0, TAU); c.fill();
          c.strokeStyle = `rgba(255,170,90,${0.5 + 0.5 * bright})`; c.lineWidth = rb * 0.25; c.beginPath(); c.arc(x, y, rb * 0.95, st.time * (2 + 6 * bright), st.time * (2 + 6 * bright) + 2.6); c.stroke();
        } else {
          const b2 = clamp01((beat - p.beat) / 1.2);
          for (let i = 0; i < 14; i++) { const aa = (i / 14) * TAU, dd = rb * (1.2 + 5 * b2); K.glow(c, x + Math.cos(aa) * dd, y + Math.sin(aa) * dd + b2 * b2 * rb * 3, rb * 0.3 * (1 - b2), [255, 210, 140], 0.9 * (1 - b2)); }
          if (b2 < 0.3) K.glow(c, x, y, rb * 4, [255, 240, 200], 0.8 * (1 - b2 / 0.3), 'screen');
          c.fillStyle = `rgba(34,22,26,${1 - b2})`; c.beginPath(); c.arc(x - rb * 0.4, y + b2 * rb * 6, rb * 0.5, 0, TAU); c.fill();
        }
      }
      // landing: a squash and a ring of embers where he comes down (a leap's end, a pad's)
      const land = p.leap && !p.leap.ember ? p.leap.b1 : p.pad === 'jump' ? p.land : NaN;
      if (!Number.isNaN(land) && beat >= land && beat < land + 1) {
        const [x, y] = at(land), q = beat - land;
        for (let i = 0; i < 16; i++) { const aa = (i / 16) * TAU, dd = rb * (1 + 6 * q); K.glow(c, x + Math.cos(aa) * dd, y + Math.sin(aa) * dd * 0.6, rb * 0.25 * (1 - q), [255, 180, 100], 0.85 * (1 - q)); }
      }
    }
  }

  /** the planet's heart, from inside: white-gold at the centre, deep red at its edge, its flows turning, pulsing on the kick */
  private heart(c: CanvasRenderingContext2D, R: number, st: WorldState): void {
    const time = st.time, kick = st.kick, in0 = sm((st.song - ET.core) / 0.6);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, R * 1.15);
    g.addColorStop(0, 'rgba(255,250,232,1)'); g.addColorStop(0.32, 'rgba(255,214,140,0.96)'); g.addColorStop(0.7, 'rgba(232,108,52,0.9)'); g.addColorStop(1, 'rgba(120,30,20,0)');
    c.globalAlpha = in0; c.fillStyle = g; c.beginPath(); c.arc(0, 0, R * 1.15, 0, TAU); c.fill();
    c.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const rr = R * (0.28 + 0.13 * i), a0 = time * (0.35 + 0.08 * i) * (i % 2 ? 1 : -1);
      c.strokeStyle = `rgba(255,${236 - i * 14},${200 - i * 22},${0.32 - i * 0.03})`; c.lineWidth = R * (0.05 - i * 0.004);
      for (let j = 0; j < 2; j++) { c.beginPath(); c.arc(0, 0, rr, a0 + j * Math.PI, a0 + j * Math.PI + 1.1 + 0.3 * Math.sin(time + i)); c.stroke(); }
    }
    K.glow(c, 0, 0, R * 1.35 * (1 + 0.08 * kick), [255, 196, 120], (0.3 + 0.3 * kick) * in0, 'screen');
    c.globalAlpha = 1;
  }

  /** the inside of the planet, behind everything once the camera has dived in: molten walls flowing outward */
  private inside(c: CanvasRenderingContext2D, w: number, h: number, st: SceneState): void {
    const cx = w / 2, cy = h * 0.52, R = Math.hypot(w, h) * 0.6, time = st.time, kick = st.kick ?? 0;
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, R);
    g.addColorStop(0, 'rgb(128,44,26)'); g.addColorStop(0.45, 'rgb(70,18,14)'); g.addColorStop(1, 'rgb(18,5,8)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.save(); c.globalCompositeOperation = 'screen'; c.lineCap = 'round';
    for (let i = 0; i < 16; i++) {
      const r = K.RNG(i * 17 + 5), ph = (time * 0.09 + r()) % 1, rr = R * (0.22 + 0.85 * ph), a0 = r() * TAU + time * 0.05 * (r() - 0.5);
      c.strokeStyle = `rgba(255,${120 + Math.round(80 * r())},60,${0.22 * Math.sin(ph * Math.PI)})`; c.lineWidth = (6 + 18 * r()) * (0.5 + ph);
      c.beginPath(); c.arc(cx, cy, rr, a0, a0 + 0.5 + r() * 0.9); c.stroke();
    }
    for (let i = 0; i < 24; i++) { const r = K.RNG(i * 29 + 3), ph = (time * 0.12 + r()) % 1; K.glow(c, cx + (r() - 0.5) * w * 1.1, cy + h * 0.5 - ph * h * 1.1, 2 + 2 * r(), [255, 200, 120], 0.7 * Math.sin(ph * Math.PI)); }
    c.restore();
    // Ossa's strikes, felt from inside: the whole heart pulses on them
    K.glow(c, cx, cy, R * 0.8, [255, 150, 80], 0.12 + 0.22 * kick, 'screen');
  }

  /** on the course: Ossa's strikes rising under it as rings of fire (the launches), and the Stillness's seal on the star */
  private onCourse(c: CanvasRenderingContext2D, v: CourseView): void {
    const rb = v.rb;
    for (const p of v.presses) {
      if (p.pad !== 'jump') continue;
      const d = v.beat - p.beat;
      if (d < -1.6 || d > 1.4) continue;
      const [x, y] = v.pos(p.beat, -0.05);
      c.lineCap = 'round';
      if (d < 0) { // the shock arriving: a ring of fire closing on the pad
        const q = -d / 1.6; c.strokeStyle = `rgba(255,150,70,${0.75 * (1 - q)})`; c.lineWidth = rb * 0.45; c.beginPath(); c.arc(x, y, rb * (2 + 7 * q), 0, TAU); c.stroke();
        K.glow(c, x, y, rb * 3, [255, 170, 90], 0.35 * (1 - q), 'screen');
      } else { // the strike: it goes up under him
        const q = d / 1.4; c.strokeStyle = `rgba(255,210,150,${0.85 * (1 - q)})`; c.lineWidth = rb * (0.7 - 0.4 * q); c.beginPath(); c.arc(x, y, rb * (2 + 12 * q), 0, TAU); c.stroke();
        K.glow(c, x, y, rb * (4 + 6 * q), [255, 180, 100], 0.6 * (1 - q), 'screen');
      }
    }
    // the vents: a glowing crack in the ring, breathing; it erupts as he is thrown, and he lands in a burst on the far side
    for (let i = 0; i < v.presses.length; i++) {
      const p = v.presses[i];
      if (p.pad !== 'vent') continue;
      const d = v.beat - p.beat;
      if (d < -6 || d > 1.6) continue;
      const [x, y] = v.pos(p.beat, -0.05);
      if (d < 0) {
        const breathe = 0.6 + 0.4 * Math.sin(v.time * 6 + i);
        K.glow(c, x, y, rb * 3.2, [255, 120, 50], 0.35 * breathe, 'screen');
        c.strokeStyle = `rgba(255,200,120,${0.7 * breathe})`; c.lineWidth = rb * 0.35; c.lineCap = 'round';
        c.beginPath(); c.moveTo(x - rb * 1.4, y - rb * 0.2); c.lineTo(x - rb * 0.3, y + rb * 0.3); c.lineTo(x + rb * 0.5, y - rb * 0.25); c.lineTo(x + rb * 1.4, y + rb * 0.15); c.stroke();
      } else {
        const q = d / 1.6;
        for (let k = 0; k < 14; k++) { const r = K.RNG(k * 11 + i), a = r() * TAU, dist = rb * (2 + 14 * q) * (0.4 + r()); K.glow(c, x + Math.cos(a) * dist, y + Math.sin(a) * dist - q * rb * 6, rb * (0.7 + 0.8 * r()) * (1 - q), [255, 180, 90], 0.9 * (1 - q)); }
        K.glow(c, x, y, rb * (4 + 8 * q), [255, 150, 70], 0.7 * (1 - q), 'screen');
        const [lx, ly] = v.pos(p.land, 0), lq = Math.max(0, (v.beat - p.land) / 1.0);
        if (v.beat >= p.land && lq < 1) { c.strokeStyle = `rgba(255,214,150,${0.8 * (1 - lq)})`; c.lineWidth = rb * 0.5; c.beginPath(); c.arc(lx, ly, rb * (1.5 + 6 * lq), 0, TAU); c.stroke(); }
      }
    }
    // the seal: the last wall is the Stillness's seal on the star, a ring of ink; the last dash shatters it
    const last = v.presses[v.presses.length - 1];
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
      K.glow(c, x, y, rb * 2.2, [255, 240, 210], 0.5 * a); // the star, behind the seal
      c.globalAlpha = 1;
    } else {
      const q = d / 1.6;
      c.strokeStyle = `rgba(8,6,12,${0.95 * (1 - q)})`; c.lineWidth = rb * 0.9 * (1 - q);
      for (let i = 0; i < 14; i++) { const an = (i / 14) * TAU, rr = rb * 4.4 + d * rb * 16; c.beginPath(); c.arc(x, y, rr, an, an + 0.25); c.stroke(); }
      K.glow(c, x, y, rb * (4 + 14 * q), [255, 244, 214], Math.exp(-d * 3), 'screen');
    }
  }

  /** the sky and Ossa beside the planet, behind everything */
  readonly sky: WorldSky = {
    says: [],
    prepare: () => this.paint(window.innerWidth, window.innerHeight),
    draw: (c, w, h, st) => {
      this.paint(w, h);
      const t = st.song ?? -10, time = st.time, dt = this.lastT < 0 ? 0 : Math.min(0.05, Math.max(0, time - this.lastT)); this.lastT = time;
      if (t >= ET.core) { this.inside(c, w, h, st); writeSays(c, w, h, Math.min(w / 390, h / 844), this.sky.says, st.song); return; }
      const warm = sm((t - ET.drop) / 1.2);
      if (this.skyCold) c.drawImage(this.skyCold, 0, 0, w, h);
      if (this.skyHot && warm > 0) { c.globalAlpha = warm * (0.85 + 0.15 * st.kick); c.drawImage(this.skyHot, 0, 0, w, h); c.globalAlpha = 1; }
      horizon(c, w, h, t > ET.riser && t < ET.drop ? sm((t - ET.riser) / 0.6) * (1 - sm((t - ET.drop + 0.3) / 0.3)) : 0, time);
      // Ossa: her state from the song, every change a spring, her hammering on the beat (on the journey she stands in
      // the world beside Emberwick, drawn with it)
      if (this.journeyOn) { this.afterOssa(c, w, h, st, t); return; }
      let rise = 0, head = 0.62, lit = 0.05, rear = 0;
      if (t >= ET.held) { rise = 0.45; head = 0.3; lit = 0.3; }
      if (t >= ET.held && t < ET.held + 0.3) head = 0.75; // anticipation: the head dips before it lifts
      if (t >= ET.stabs) { rise = 1; head = 0.02; lit = 0.55; }
      if (t > this.stirAt && t < this.stirAt + 0.9 && t < ET.held) head = 0.45; // a first stir at the third spark
      if (t >= ET.riser && t < ET.drop) { const q = (t - ET.riser) / (ET.drop - ET.riser); rear = q < 0.15 ? -0.15 * (q / 0.15) : sm((q - 0.15) / 0.85) * 0.9; head = -0.1; lit = 0.7; }
      let hammer = false;
      if (t >= ET.drop && t < ET.end) {
        lit = 1; head = 0.05; hammer = !(t >= ET.breath && t < ET.breathEnd);
        if (hammer) {
          // one blow every two beats, landing on the beat: up after the blow (ease out), down into the next (ease in)
          const f = (((t - ET.drop) / (2 * ET.spb)) % 1 + 1) % 1;
          rear = f < 0.5 ? 0.85 * (1 - Math.pow(1 - f / 0.5, 3)) : 0.85 * (1 - Math.pow((f - 0.5) / 0.5, 3));
          if (f < this.lastPhase - 0.5) { this.impact = time; for (let i = 0; i < 10; i++) this.embers.push({ x: 0, y: 0, vx: (Math.random() - 0.5) * 160, vy: -80 - Math.random() * 160, at: time }); }
          this.lastPhase = f;
        } else rear = 0.1;
      }
      if (t >= ET.end) { lit = 1; rear = 0.95; head = -0.3; } // the end: it rears back and holds there, celebrating
      const R = this.rise.step(rise, dt), H = this.head.step(head, dt), L = this.litS.step(lit, dt);
      const rearX = hammer ? rear : (this.rearS ??= new Spring(0, 6)).step(rear, dt);
      if (hammer && this.rearS) this.rearS.x = rear;
      const A = this.antler.step(-(H - 0.3) * 0.25 + (hammer ? -0.12 * rearX : 0), dt) , Tl = this.tail.step(-rearX * 0.6 + 0.1 * Math.sin(time * 0.9), dt);
      const u = Math.min(w / 390, h / 844), s = 0.62 * u, ox = w * 0.4, oy = h * 0.975;
      // her hearth-stone, under her forehooves: she strikes it, and the planet's anvil rings with it
      const flash = Math.exp(-(time - this.impact) * 6);
      W.hearthStone(c, ox + W.OSSA_HOOF[0] * s, oy, s, flash);
      W.ossa(c, ox, oy, s, { rise: R, rear: rearX, head: H, antler: A, tail: Tl, breath: (time * 0.28) % 1, lit: L, flicker: 0.5 + 0.5 * Math.sin(time * 1.7) * Math.sin(time * 0.6), face: 1 });
      // embers shaken off her back with every blow (secondary motion)
      for (let i = this.embers.length - 1; i >= 0; i--) { const e = this.embers[i], a = time - e.at; if (a > 1.2) { this.embers.splice(i, 1); continue; } K.glow(c, ox + W.OSSA_HOOF[0] * s + e.vx * a * u, oy - 20 * s + (e.vy * a + 140 * a * a) * u, 2.5 * u, [255, 190, 110], 1 - a / 1.2); }
      this.afterOssa(c, w, h, st, t);
    }
  };
  /** whether the level has the journey's places (set by the renderer's first frame of it) */
  journeyOn = false;
  /** over everything in the sky: the dive's flash, the drop's held breath and release, and the lines spoken */
  private afterOssa(c: CanvasRenderingContext2D, w: number, h: number, st: SceneState, t: number): void {
    const u = Math.min(w / 390, h / 844);
      const dive = sm((t - ET.dive) / (ET.core - ET.dive));
      if (dive > 0) { c.fillStyle = `rgba(255,190,120,${0.7 * dive * dive})`; c.fillRect(0, 0, w, h); }
      // the drop: the last half-beat before it the world draws in and darkens (near stillness); then the release:
      // radial speed lines and a burst of fire from the forge outward
      const pre = t > ET.drop - 0.45 && t < ET.drop ? sm((t - ET.drop + 0.45) / 0.45) : 0;
      if (pre > 0) { c.fillStyle = `rgba(8,4,10,${0.35 * pre})`; c.fillRect(0, 0, w, h); }
      const rel = (t >= ET.drop && t < ET.drop + 1.1 ? 1 - (t - ET.drop) / 1.1 : 0) * (save.reduceFlash ? 0.3 : 1);
      if (rel > 0) {
        const cx = w / 2, cy = h * 0.52, R0 = Math.hypot(w, h) * 0.6, r = K.RNG(5);
        c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
        for (let i = 0; i < 48; i++) { const a = r() * TAU, d0 = (0.15 + 0.5 * r() + (1 - rel) * 0.6) * R0, L = (0.08 + 0.2 * r()) * R0 * rel; c.strokeStyle = `rgba(255,${190 + Math.round(50 * r())},140,${0.5 * rel})`; c.lineWidth = 1 + 2.5 * r(); c.beginPath(); c.moveTo(cx + Math.cos(a) * d0, cy + Math.sin(a) * d0); c.lineTo(cx + Math.cos(a) * (d0 + L), cy + Math.sin(a) * (d0 + L)); c.stroke(); }
        c.restore();
        K.glow(c, cx, cy, R0 * (0.4 + 0.8 * (1 - rel)), [255, 160, 80], 0.5 * rel, 'screen');
      }
    writeSays(c, w, h, u, this.sky.says, st.song);
  }
  private rearS: Spring | undefined;
}

// ================================================================ the Drifting Edge
const DT = { helion: 17.6, drop: 19.2, climb: 32.0, slip: 44.8, rise: 45.6, toss: 49.6, drop2: 51.2, end: 70.4, spb: 0.4 };

export class EdgeWorld {
  private cold: Pic | null = null; private hot: Pic | null = null;
  private skyLayer: HTMLCanvasElement | null = null; private key = '';
  private lit: number[] = new Array(ZONES).fill(-1); private sparks = 0;
  private blooms: Array<{ a: number; d: number; at: number; hue: number }> = [];
  private wake = new Spring(0, 3); private curl = new Spring(0.7, 2.5); private lastT = -1; private seed = 1;

  /** Asks the paint worker for this world's sky ahead (the Landing's own, at one to one). */
  askAhead(): void { askLandingSky(window.innerWidth, window.innerHeight, 1, 0); askPlanet('edgeLayer'); }
  private paint(w: number, h: number): void {
    const key = `${w}x${h}`; if (key === this.key) return; this.key = key;
    if (!this.cold) { this.cold = planetLayer('edgeLayer', false) ?? W.edgeLayer(false); this.hot = planetLayer('edgeLayer', true) ?? W.edgeLayer(true); }
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const pre = landingSky(w, h, 1, 0); if (pre) cv.getContext('2d')!.drawImage(pre, 0, 0, w, h); else LANDING.sky(cv.getContext('2d')!, w, h, 0); this.skyLayer = cv; // (from the paint worker when it is ready)
  }
  reset(): void { this.lit.fill(-1); this.sparks = 0; this.blooms = []; this.lastT = -1; this.wake.x = 0; this.curl.x = 0.7; }
  rewind(to: number): void { for (let z = 0; z < ZONES; z++) if (this.lit[z] > to) this.lit[z] = -1; this.blooms = this.blooms.filter((b) => b.at <= to); this.lastT = -1; }
  spark(a: number, song: number): void {
    const z = zoneOf(a); if (this.lit[z] < 0) this.lit[z] = song; this.sparks++;
    const r = K.RNG(this.seed++ * 7919);
    if (this.blooms.length < 120) for (let i = 0; i < 3; i++) this.blooms.push({ a: a + (r() - 0.5) * 0.3, d: 0.62 + 0.33 * r(), at: song + i * 0.06, hue: r() });
  }

  readonly world: World = {
    reset: () => this.reset(),
    rewind: (to) => this.rewind(to),
    spark: (a, song) => this.spark(a, song),
    onCourse: (c, v) => this.onCourse(c, v),
    // the Sleeper's throw: the camera pulls back to show the planetoid and the Sleeper whole
    cam: (song) => (song > DT.toss - 0.3 && song < DT.drop2 + 0.3 ? 0.74 : 1),
    draw: (c, R, st) => {
      if (!this.cold || !this.hot) return;
      const t = st.song, time = st.time, dt = this.lastT < 0 ? 0 : Math.min(0.05, Math.max(0, time - this.lastT)); this.lastT = time;
      zones(c, this.cold, this.hot, R, this.lit, t, sm((t - DT.drop) / 1.5) * 0.6);
      // flowers where good taps landed (they stay), each opening as it blooms
      for (const b of this.blooms) {
        const q = sm((t - b.at) / 0.45); if (q <= 0) continue;
        const x = Math.cos(b.a) * R * b.d, y = Math.sin(b.a) * R * b.d, s = (1.6 + 1.8 * q) * (R / 110);
        K.glow(c, x, y, s * 4, b.hue < 0.5 ? [150, 235, 220] : [255, 226, 170], 0.22 * q, 'screen');
        c.fillStyle = `rgba(240,250,245,${0.85 * q})`;
        for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + b.hue * 3; c.beginPath(); c.arc(x + Math.cos(a) * s, y + Math.sin(a) * s * 0.8, s * 0.55, 0, TAU); c.fill(); }
      }
      // the Sleeper stirs with the flowers, and wakes a little on the drop; its fingers loosen round the pit
      const wake = this.wake.step(Math.min(0.35, this.sparks * 0.012) + (t > DT.drop ? 0.45 : 0), dt), curl = this.curl.step(t > DT.drop ? 0.25 : 0.7, dt);
      W.sleeper(c, R, { wake, curl, breath: (time * 0.22) % 1 });
      if (t > DT.drop) for (let i = 0; i < 14; i++) { const r = K.RNG(i * 31), ph = ((time * 0.15 + r()) % 1), a = r() * TAU; K.glow(c, Math.cos(a) * R * (0.7 + 0.6 * ph), Math.sin(a) * R * (0.7 + 0.6 * ph) - ph * 30, 2.2, [170, 240, 230], 0.8 * (1 - ph)); }
    }
  };

  private flareAt = -9; private pushAt = -9;
  /** on the course: Helion's light to chase, the Sleeper's hand, the residue creeping up behind */
  private onCourse(c: CanvasRenderingContext2D, v: CourseView): void {
    const s = v.song, rb = v.rb;
    if (v.hit) { if (s > DT.drop && s < DT.slip) this.flareAt = v.time; if (s > DT.drop2) this.pushAt = v.time; }
    // Helion's light: on the drop his flicker becomes a light on the course a few beats ahead; it flares on each good
    // tap; from 32 s it climbs off the surface; at 44.8 it slips away into the dark
    if (s > DT.drop - 0.2 && s < DT.slip + 1.8) {
      const slip = sm((s - DT.slip) / 1.6), lead = 2.5 + slip * 7, lift = 0.15 + 1.3 * sm((s - DT.climb) / 3);
      const a = sm((s - DT.drop) / 0.5) * (1 - slip), fl = Math.exp(-(v.time - this.flareAt) / 0.35), flick = 0.85 + 0.15 * Math.sin(v.time * 17) * Math.sin(v.time * 5.3);
      for (let i = 1; i <= 6; i++) { const [mx, my] = v.pos(v.beat + lead - i * 0.3, lift - i * 0.03); K.glow(c, mx, my, rb * (1.2 - i * 0.12), [255, 200, 140], 0.35 * a * (1 - i / 7)); }
      const [x, y] = v.pos(v.beat + lead, lift);
      K.glow(c, x, y, rb * (5 + 3 * fl), [255, 170, 100], (0.45 + 0.4 * fl) * a * flick, 'screen');
      K.glow(c, x, y, rb * 1.5, [255, 240, 210], 0.95 * a);
      if (a > 0.05) { c.save(); c.globalAlpha = a * 0.9; CANON.parts.spark(c, x, y + rb * 0.5, rb * 0.02, { who: 'helion', glow: 1, arms: 'back', face: 1, eyes: 'soft', crest: 1, lite: true }); c.restore(); }
    }
    // the Sleeper's hand: it rises out of the planetoid under the throw (anticipation: a dip first), its palm a giant
    // pad; it flicks up as he is thrown, and sinks back
    const toss = v.presses.find((p) => p.pad === 'jump' && p.land - p.beat > 2.5);
    if (toss && s > DT.slip && s < DT.drop2 + 2.4) {
      const up = s < DT.rise + 0.4 ? -0.06 * sm((s - DT.slip) / 1.0) : sm((s - DT.rise - 0.4) / 2.4);
      const flick = sm((s - DT.toss) / 0.25), sink = sm((s - DT.toss - 1.6) / 1.8), rise = Math.max(-0.06, up) * (1 - sink);
      const A = v.ang(toss.beat), [cx, cy] = v.center, r0 = v.planetR * 0.92, rp = lerp(r0, v.ring(toss.beat) - rb * 1.4, Math.max(0, rise));
      c.save(); c.translate(cx, cy); c.rotate(A + Math.PI / 2);
      const stone = 'rgba(118,126,150,0.97)', rim = 'rgba(205,235,228,0.7)';
      const wrist = rp - rb * 1.6;
      // the arm, from the planetoid's surface
      c.fillStyle = stone; c.strokeStyle = rim; c.lineWidth = rb * 0.25;
      c.beginPath(); c.moveTo(-rb * 2.4, -r0 * 0.9); c.quadraticCurveTo(-rb * 2.0, -(r0 + wrist) / 2, -rb * 1.5, -wrist); c.lineTo(rb * 1.5, -wrist); c.quadraticCurveTo(rb * 2.0, -(r0 + wrist) / 2, rb * 2.4, -r0 * 0.9); c.closePath(); c.fill(); c.stroke();
      // the palm, cupped, and its fingers (curled up at the sides; open as he is thrown)
      c.beginPath(); c.ellipse(0, -rp + rb * 0.4, rb * 2.6, rb * 1.2, 0, 0, TAU); c.fill(); c.stroke();
      c.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const fx = -rb * 2.0 + i * rb * 1.33, curl = (1 - flick) * (i === 0 || i === 3 ? 0.9 : 0.5);
        c.lineWidth = rb * 0.95; c.strokeStyle = stone; c.beginPath(); c.moveTo(fx, -rp + rb * 0.2); c.quadraticCurveTo(fx * (1 + 0.15 * flick), -rp - rb * 1.6, fx * (1 - 0.6 * curl), -rp - rb * (2.6 - 1.2 * curl)); c.stroke();
        c.lineWidth = rb * 0.2; c.strokeStyle = rim; c.stroke();
      }
      K.glow(c, 0, -rp, rb * (2.5 + 4 * flick * (1 - sink)), [150, 235, 220], 0.35 + 0.5 * flick * (1 - sink), 'screen'); // the seam's light in its palm
      c.restore();
    }
    // the residue: a grey tide creeping up the course behind him on the music; it gains toward each phrase's end and
    // is pushed back by every good landing (pressure only: it never ends a run). At 70.4 it falls away.
    if (s > DT.drop2 - 0.2 && s < DT.end + 2) {
      const enter = sm((s - DT.drop2) / 1.5), leave = sm((s - DT.end) / 1.4);
      const ph = (((v.beat - DT.drop2 / v.spb) % 16) + 16) % 16, surge = sm((ph - 10) / 5) * (1 - sm((ph - 15.2) / 0.8));
      const push = Math.exp(-(v.time - this.pushAt) / 0.5);
      const gap = 3.4 - 1.7 * surge + 1.0 * push + leave * 10 + (1 - enter) * 4, a = enter * (1 - leave);
      if (a > 0.01) {
        c.globalAlpha = a; c.lineCap = 'round';
        const ref = v.beat, front = v.beat - gap;
        // a smear of ink along the course behind him (at his own ring), thickest at its front, with an ash rim
        for (const [col, extra] of [['rgba(170,160,190,0.3)', 0.5], ['rgba(8,7,14,0.94)', 0]] as Array<[string, number]>) {
          c.strokeStyle = col;
          for (let i = 0; i < 12; i++) { const b0 = front - i * 0.2, [x0, y0] = v.pos(b0, -0.05, ref), [x1, y1] = v.pos(b0 - 0.24, -0.05, ref); c.lineWidth = rb * ((4.4 - i * 0.3) + extra) * (1 + 0.06 * Math.sin(v.time * 3 + i)); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
        }
        // its reaching edge: thin fingers of it, feeling forward along the course
        c.strokeStyle = 'rgba(8,7,14,0.9)'; c.lineWidth = rb * 0.45;
        for (let j = 0; j < 4; j++) { const [x0, y0] = v.pos(front, -0.05 + (j - 1.5) * 0.12, ref), [x1, y1] = v.pos(front + 0.7 + 0.25 * Math.sin(v.time * 4 + j), -0.05 + (j - 1.5) * 0.22, ref); c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2 + Math.sin(v.time * 5 + j) * rb, (y0 + y1) / 2, x1, y1); c.stroke(); }
        c.globalAlpha = 1;
      }
    }
  }

  readonly sky: WorldSky = {
    says: [],
    prepare: () => this.paint(window.innerWidth, window.innerHeight),
    draw: (c, w, h, st) => {
      this.paint(w, h);
      if (this.skyLayer) c.drawImage(this.skyLayer, 0, 0, w, h);
      const t = st.song ?? -10;
      horizon(c, w, h, t > DT.helion - 0.2 && t < DT.drop ? sm((t - DT.helion + 0.2) / 0.5) * (1 - sm((t - DT.drop + 0.3) / 0.3)) : 0, st.time);
      writeSays(c, w, h, Math.min(w / 390, h / 844), this.sky.says, st.song);
    }
  };
}
export const _lerp = lerp;
// (shared with the worlds after Emberwick: src/ui/worlds2.ts)
export { zones, zoneOf, horizon, ZONES };
