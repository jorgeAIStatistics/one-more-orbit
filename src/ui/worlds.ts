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
import { WORLDS as W } from '../art/worldpaint.js';
import { CANON } from '../art/canonpaint.js';
import { DUSK } from '../art/painter.js';
import { writeSays, type Said, type SceneState } from './skyplanet';

const TAU = Math.PI * 2;
const sm = (x: number) => { const t = x < 0 ? 0 : x > 1 ? 1 : x; return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** A critically damped spring: settles on its target in about 4/omega seconds, never overshooting. */
class Spring {
  v = 0;
  constructor(public x: number, private omega = 7) {}
  step(target: number, dt: number): number { const w = this.omega; this.v += (w * w * (target - this.x) - 2 * w * this.v) * dt; this.x += this.v * dt; return this.x; }
}

/** What the world is told each frame, in the course's own frame (angles round the planet, song time). */
export interface WorldState { time: number; song: number; drive: number; kick: number; strike: number; calm: boolean }
export interface World {
  /** the planet, drawn at the course's centre (the canvas is already translated there), radius R */
  draw(c: CanvasRenderingContext2D, R: number, st: WorldState): void;
  /** a good tap, at this angle round the planet: the zone there relights */
  spark(a: number, song: number): void;
  /** a new attempt: everything goes back to how the Stillness left it */
  reset(): void;
  /** back to an ember: what was relit after this song time goes dark again; what was relit before it stays */
  rewind(to: number): void;
}
/** The backdrop a world brings (the renderer's `backdrop`): it also carries the lines the inhabitant speaks. */
export interface WorldSky { says: Said[]; prepare(): void; draw(c: CanvasRenderingContext2D, w: number, h: number, st: SceneState): void }

const ZONES = 12;
const zoneOf = (a: number) => ((Math.floor((((a % TAU) + TAU) % TAU) / (TAU / ZONES)) % ZONES) + ZONES) % ZONES;
/** draw the hot layer over the cold one where the zones are lit: soft overlapping patches, never hard wedges */
let mask: HTMLCanvasElement | null = null;
function zones(c: CanvasRenderingContext2D, cold: HTMLCanvasElement, hot: HTMLCanvasElement, R: number, lit: number[], time: number, all: number): void {
  const S = cold.width, k = R / W.R0, half = (S * k) / 2;
  c.drawImage(cold, -half, -half, S * k, S * k);
  if (all >= 0.995) { c.drawImage(hot, -half, -half, S * k, S * k); return; }
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
  if (!any) return;
  m.globalCompositeOperation = 'source-in'; m.drawImage(hot, 0, 0);
  c.drawImage(mask, -half, -half, S * k, S * k);
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
const ET = { held: 9.6, stabs: 12, riser: 16.8, drop: 19.2, breath: 36, breathEnd: 38.4, end: 57.6, spb: 0.6 };

export class EmberWorld {
  private cold: HTMLCanvasElement | null = null; private hot: HTMLCanvasElement | null = null;
  private skyCold: HTMLCanvasElement | null = null; private skyHot: HTMLCanvasElement | null = null; private key = '';
  private lit: number[] = new Array(ZONES).fill(-1); private sparks = 0;
  private rise = new Spring(0, 5); private head = new Spring(0.62, 6); private antler = new Spring(0, 3.5); private tail = new Spring(0, 3); private litS = new Spring(0.05, 3);
  private lastT = -1; private lastPhase = 0; private impact = -9; private stirAt = -9;
  private embers: Array<{ x: number; y: number; vx: number; vy: number; at: number }> = [];
  says: Said[] = [];

  private paint(w: number, h: number): void {
    const key = `${w}x${h}`; if (key === this.key) return; this.key = key;
    if (!this.cold) { this.cold = W.emberLayer(false); this.hot = W.emberLayer(true); }
    const sky = (hot: boolean) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d')!, r = K.RNG(11);
      DUSK.tools.sky(c, w, h, hot ? [[0, [24, 10, 26]], [0.55, [92, 40, 54]], [1, [150, 74, 60]]] : [[0, [10, 10, 22]], [0.55, [26, 22, 40]], [1, [34, 26, 40]]], r, 70);
      DUSK.tools.stars(c, w, h, r, Math.round((w * h) / 1500), 3); DUSK.tools.finish(c, w, h, 41, 0.3); return cv; };
    this.skyCold = sky(false); this.skyHot = sky(true);
  }
  reset(): void { this.lit.fill(-1); this.sparks = 0; this.lastT = -1; this.impact = -9; this.embers = []; this.rise.x = 0; this.head.x = 0.62; this.litS.x = 0.05; }
  rewind(to: number): void { for (let z = 0; z < ZONES; z++) if (this.lit[z] > to) this.lit[z] = -1; this.embers = []; this.lastT = -1; }
  spark(a: number, song: number): void { const z = zoneOf(a); if (this.lit[z] < 0) this.lit[z] = song; this.sparks++; if (this.sparks === 3) this.stirAt = song; }

  /** the planet, under the course */
  readonly world: World = {
    reset: () => this.reset(),
    rewind: (to) => this.rewind(to),
    spark: (a, song) => this.spark(a, song),
    draw: (c, R, st) => {
      if (!this.cold || !this.hot) return;
      const t = st.song, dropK = sm((t - ET.drop) / 0.35);
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
    }
  };

  /** the sky and Ossa beside the planet, behind everything */
  readonly sky: WorldSky = {
    says: [],
    prepare: () => this.paint(window.innerWidth, window.innerHeight),
    draw: (c, w, h, st) => {
      this.paint(w, h);
      const t = st.song ?? -10, time = st.time, dt = this.lastT < 0 ? 0 : Math.min(0.05, Math.max(0, time - this.lastT)); this.lastT = time;
      const warm = sm((t - ET.drop) / 1.2);
      if (this.skyCold) c.drawImage(this.skyCold, 0, 0, w, h);
      if (this.skyHot && warm > 0) { c.globalAlpha = warm * (0.85 + 0.15 * st.kick); c.drawImage(this.skyHot, 0, 0, w, h); c.globalAlpha = 1; }
      horizon(c, w, h, t > ET.riser && t < ET.drop ? sm((t - ET.riser) / 0.6) * (1 - sm((t - ET.drop + 0.3) / 0.3)) : 0, time);
      // Ossa: her state from the song, every change a spring, her hammering on the beat
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
      writeSays(c, w, h, u, this.sky.says, st.song);
    }
  };
  private rearS: Spring | undefined;
}

// ================================================================ the Drifting Edge
const DT = { helion: 17.6, drop: 19.2, spb: 0.4 };

export class EdgeWorld {
  private cold: HTMLCanvasElement | null = null; private hot: HTMLCanvasElement | null = null;
  private skyLayer: HTMLCanvasElement | null = null; private key = '';
  private lit: number[] = new Array(ZONES).fill(-1); private sparks = 0;
  private blooms: Array<{ a: number; d: number; at: number; hue: number }> = [];
  private wake = new Spring(0, 3); private curl = new Spring(0.7, 2.5); private lastT = -1; private seed = 1;

  private paint(w: number, h: number): void {
    const key = `${w}x${h}`; if (key === this.key) return; this.key = key;
    if (!this.cold) { this.cold = W.edgeLayer(false); this.hot = W.edgeLayer(true); }
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; LANDING.sky(cv.getContext('2d')!, w, h, 0); this.skyLayer = cv;
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
