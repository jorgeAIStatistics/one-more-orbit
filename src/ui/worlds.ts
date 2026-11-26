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
  /** the level's set pieces that live on the course itself (drawn over the course, in its own frame) */
  onCourse?(c: CanvasRenderingContext2D, v: CourseView): void;
  /** the camera's scale at a song time (1: as the course sets it; less: pulled back to show the world whole) */
  cam?(song: number): number;
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
const zoneOf = (a: number) => ((Math.floor((((a % TAU) + TAU) % TAU) / (TAU / ZONES)) % ZONES) + ZONES) % ZONES;
/** draw the hot layer over the cold one where the zones are lit: soft overlapping patches, never hard wedges */
let mask: HTMLCanvasElement | null = null;
// (the composite is kept: it is only made again while a zone is still fading in, or the whole planet's light changes;
// the performance pass of 2026-11-25)
let lastKey = '', lastCold: HTMLCanvasElement | null = null, comp: HTMLCanvasElement | null = null, compAny = false;
function zones(c: CanvasRenderingContext2D, cold: HTMLCanvasElement, hot: HTMLCanvasElement, R: number, lit: number[], time: number, all: number): void {
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
function zonesInto(cc: CanvasRenderingContext2D, hot: HTMLCanvasElement, S: number, lit: number[], time: number, all: number): boolean {
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
const ET = { held: 9.6, stabs: 12, riser: 16.8, drop: 19.2, breath: 36, breathEnd: 38.4, dive: 37.6, core: 38.4, end: 57.6, spb: 0.6 };

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
    onCourse: (c, v) => this.onCourse(c, v),
    draw: (c, R, st) => {
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
      if (dive > 0) { c.restore(); K.glow(c, mx, my, R * 3 * dive, [255, 230, 170], dive * dive, 'screen'); }
    }
  };

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
      const dive = sm((t - ET.dive) / (ET.core - ET.dive));
      if (dive > 0) { c.fillStyle = `rgba(255,190,120,${0.7 * dive * dive})`; c.fillRect(0, 0, w, h); }
      writeSays(c, w, h, u, this.sky.says, st.song);
    }
  };
  private rearS: Spring | undefined;
}

// ================================================================ the Drifting Edge
const DT = { helion: 17.6, drop: 19.2, climb: 32.0, slip: 44.8, rise: 45.6, toss: 49.6, drop2: 51.2, end: 70.4, spb: 0.4 };

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
