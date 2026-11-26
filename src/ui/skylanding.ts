// The Landing, as a place to rest (Afterglow): the planetoid Orbin fell on, at night, with a fire made of the stars he
// has brought home, in the open hand of the Sleeper (the planetoid itself, an old being of stone). On the horizon,
// always: the guardian, the three rings of shadow, and his brother's signal. It is the title (Orbin asleep by the
// fire, waking on a tap); it is where every star is carried home to; and it is the ground under the first stage.
// The camera rises out of it into the galaxy map in one move: the land sinks and falls away through mist, and the
// map is already there above it. Painted once per size and per number of stars, in five layers that slide past each
// other; the fire, its sparks, the motes, the signal and Orbin are live.
import { LANDING } from '../art/landingpaint.js';
import { COMPANIONS } from '../art/companions.js';
import { K } from '../art/painter.js';
import { Actor } from './actor';
import type { SceneState } from './skyplanet';

const SERIF = '"Cormorant Garamond", "Hoefler Text", Baskerville, Palatino, Georgia, serif';
const smooth = (x: number) => { const t = x < 0 ? 0 : x > 1 ? 1 : x; return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** the wide layers carry this much more picture on each side (a share of the width), and a fifth more below */
const MX = 0.25, MY = 0.2;
/** the first stage looks up from the ground: the picture sits this share of the height lower */
export const STAGE_TILT = 0.26;
type Layer = 'sky' | 'far' | 'sleeper' | 'ground' | 'front';
type LayerSet = Record<Layer, HTMLCanvasElement>;
const ORDER: Layer[] = ['sky', 'far', 'sleeper', 'ground', 'front'];
/** how far each layer moves with the camera: the near ones more */
const PAR: Record<Layer, number> = { sky: 0.3, far: 0.55, sleeper: 0.78, ground: 1, front: 1.18 };

export interface Arrival {
  /** stars home before, and now */
  from: number; to: number;
  /** flying in from a world (the camera comes down out of the sky), or already here (the first stage: the camera only levels) */
  flight: boolean;
  /** where Orbin and the star are as it begins, on the screen (the first stage hands them over mid-air) */
  orbin?: [number, number, number]; star?: [number, number, number];
  /** what is written by the fire once the star is in it */
  said: string;
  /** the star touches the fire */
  onHome?: () => void;
  then: () => void;
}

export class SkyLanding {
  private ctx: CanvasRenderingContext2D;
  private key = '';
  private sets = new Map<number, LayerSet>();
  private w = 0; private h = 0; private dpr = 1; private q = 1;
  /** how many stars are home in the picture */
  stars = 0;
  /** Orbin is asleep by the fire (the title), until a tap */
  asleep = false;
  /** the name is written in the sky */
  titled = false;
  /** the picture pushed down by this share of the height */
  tilt = 0;
  /** the dark air round a course (the first stage plays over this picture): 0..1 */
  veil = 1;
  /** the name, lettered by the title's own hand */
  wordmark: ((x: number, y: number, size: number, align: CanvasTextAlign, a: number, t: number) => void) | null = null;
  private orbin = new Actor('orbin');
  private rise = 0; private dir = 0; private secs = 1.3; private then: (() => void) | null = null;
  private arr: (Arrival & { t0: number; home: boolean; done: boolean }) | null = null;
  private said = { text: '', at: 0 };
  private t = 0; private last = 0; private wakeAt = -1;

  constructor(private canvas: HTMLCanvasElement) { this.ctx = canvas.getContext('2d')!; }

  /** The camera goes up into the galaxy (the map is drawn under this while it does). secs: how long the move takes. */
  ascend(then: () => void, secs = 1.3): void { if (this.dir > 0) return; this.dir = 1; this.secs = secs; this.then = then; }
  /**
   * Into the fire: the camera drifts into the flames until their light fills the screen (a memory begins in it), and
   * back out of it (the memory over). The first clear's journey (the owner's brief of 2026-11-25).
   */
  dive(then: () => void, secs = 2.6): void { this.fireDir = 1; this.fireSecs = secs; this.fireThen = then; }
  emerge(then: () => void, secs = 2.2): void { this.fireK = 1; this.fireDir = -1; this.fireSecs = secs; this.fireThen = then; }
  get inFire(): boolean { return this.fireK > 0.001; }
  private fireK = 0; private fireDir = 0; private fireSecs = 2.6; private fireThen: (() => void) | null = null;
  /** the newest Kindling, flying in from Orbin to its place by the fire (when, on this picture's clock) */
  private newAt = -9;
  /** ...and comes back down to the fire. */
  descend(): void { this.rise = 1; this.dir = -1; this.secs = 0.9; this.then = null; this.arr = null; }
  get rising(): boolean { return this.dir > 0; }
  /** is the galaxy showing through (the map should be drawn under it) */
  get between(): boolean { return this.rise > 0.001; }
  get arriving(): boolean { return !!this.arr && !this.arr.done; }

  private layout(): void {
    const w = window.innerWidth, h = window.innerHeight, dpr = this.canvas.width / Math.max(1, w), key = `${w}x${h}`;
    this.dpr = dpr;
    if (key === this.key) return;
    this.key = key; this.w = w; this.h = h; this.sets.clear();
    this.q = w * h > 700000 ? 1 : Math.min(2, Math.max(1, window.devicePixelRatio || 1)); // (a wide screen is painted at one to one: five layers of it are a lot of picture)
  }

  private paintLayer(stars: number, name: Layer): HTMLCanvasElement {
    const { w, h, q } = this, wide = name !== 'sky';
    const cv = document.createElement('canvas'); cv.width = Math.round((wide ? w * (1 + 2 * MX) : w) * q); cv.height = Math.round((wide ? h * (1 + MY) : h) * q);
    const c = cv.getContext('2d')!; c.scale(q, q); if (wide) c.translate(w * MX, 0);
    LANDING[name](c, w, h, stars);
    return cv;
  }
  private set(stars: number): LayerSet {
    this.layout();
    let s = this.sets.get(stars);
    if (!s) { s = {} as LayerSet; for (const n of ORDER) s[n] = this.paintLayer(stars, n); this.sets.set(stars, s); if (this.sets.size > 3) this.sets.delete([...this.sets.keys()][0]); }
    return s;
  }
  /** Paints what will be needed, a layer at a time, between frames (call it while something else holds the eye). */
  prepare(stars: number[], idle: () => boolean = () => true): void {
    this.layout();
    const key = this.key, jobs: Array<[number, Layer]> = [];
    for (const n of stars) if (!this.sets.has(n)) for (const l of ORDER) jobs.push([n, l]);
    const part = new Map<number, Partial<LayerSet>>();
    const next = (): void => {
      if (key !== this.key || !jobs.length) return;
      if (!idle()) { window.setTimeout(next, 200); return; }
      const [n, l] = jobs.shift()!;
      if (!this.sets.has(n)) { const p = part.get(n) ?? {}; p[l] = this.paintLayer(n, l); part.set(n, p); if (ORDER.every((x) => p[x])) this.sets.set(n, p as LayerSet); }
      window.setTimeout(next, 30);
    };
    window.setTimeout(next, 0);
  }

  /**
   * The picture. e: how far the camera has risen, 0..1. tilt: pushed down by this share of the height. mix: from set a
   * to set b (a star arriving). fire: the fire's size against the painted one, and its swell. who: is Orbin drawn.
   */
  private scene(c: CanvasRenderingContext2D, a: LayerSet, b: LayerSet | null, mix: number, stars: number, e: number, tilt: number, fire: { lift: number; grow: number; breath: number }, who: boolean): void {
    const { w, h, t } = this, g = LANDING.geo(w, h, stars);
    const sink = e * h * 0.46, sc = 1 - 0.3 * e, fade = 1 - smooth((e - 0.28) / 0.44), skyA = 1 - smooth((e - 0.22) / 0.5), ty = tilt * h;
    // the sky: it hardly moves
    const sy = ty * PAR.sky + e * h * 0.1;
    if (skyA > 0.003) {
      c.globalAlpha = skyA;
      if (sy > 0.5) { c.fillStyle = 'rgb(3,7,20)'; c.fillRect(0, 0, w, sy + 1); }
      c.drawImage(a.sky, 0, sy, w, h); if (b && mix > 0.003) { c.globalAlpha = skyA * mix; c.drawImage(b.sky, 0, sy, w, h); c.globalAlpha = skyA; }
      c.save(); c.translate(0, sy); LANDING.signal(c, w, h, stars, t); c.restore();
      c.globalAlpha = 1;
    }
    if (fade <= 0.003) return;
    const wide = (name: Layer, live?: () => void): void => {
      const p = PAR[name], s = 1 - (1 - sc) * Math.min(1, p);
      c.save(); c.globalAlpha = fade;
      c.translate(g.fx, g.fy + ty * p + sink * p); c.scale(s, s); c.translate(-g.fx, -g.fy);
      c.drawImage(a[name], -w * MX, 0, w * (1 + 2 * MX), h * (1 + MY));
      if (b && mix > 0.003) { c.globalAlpha = fade * mix; c.drawImage(b[name], -w * MX, 0, w * (1 + 2 * MX), h * (1 + MY)); c.globalAlpha = fade; }
      live?.();
      c.restore();
    };
    wide('far');
    wide('sleeper', () => LANDING.seam(c, w, h, stars, fire.breath));
    wide('ground', () => {
      LANDING.flames(c, w, h, stars, t, fire.grow, fire.lift);
      // the companions live here: a Kindling for each world woken, circling the fire slowly
      const worlds = ['heroes', 'skyhigh', 'blank', 'invincible', 'royalty'];
      for (let i = 0; i < Math.min(worlds.length, stars - 1); i++) {
        const a = t * (0.35 + 0.05 * i) + i * 2.3, R = (60 + 22 * i) * g.u;
        let x = g.fx + Math.cos(a) * R, y = g.fy - 70 * g.u + Math.sin(a) * R * 0.35 - 20 * g.u * Math.sin(t * 0.7 + i), s = 0.32 * g.u;
        // the newest: it comes in with him and flies down to its place by the fire (an arc, slowing as it settles)
        if (i === stars - 2 && t - this.newAt < 2.4) {
          const age = t - this.newAt; if (age < 0) continue;
          const k = smooth(age / 2.4), ox = this.orbin.x + 30 * g.u, oy = this.orbin.y - 60 * g.u;
          x = lerp(ox, x, k); y = lerp(oy, y, k) - Math.sin(k * Math.PI) * 90 * g.u; s *= 0.6 + 0.4 * k;
        }
        COMPANIONS.kindling(c, x, y, s, COMPANIONS.KINDLE[worlds[i]], { flap: 0.5 + 0.5 * Math.sin(t * 3.2 + i), alpha: Math.sin(a) > -0.2 ? 1 : 0.7 });
      }
      if (who) this.orbin.draw(c);
    });
    wide('front', () => LANDING.motes(c, w, h, stars, t));
    c.globalAlpha = 1;
  }

  /** A star comes home. The camera comes down (or levels), Orbin settles, the star goes into the fire, the fire answers. */
  arrive(a: Arrival): void {
    this.layout();
    this.arr = { ...a, t0: -1, home: false, done: false };
    this.stars = a.to; this.rise = 0; this.dir = 0; this.asleep = false; this.titled = false; this.said.text = '';
    const g = LANDING.geo(this.w, this.h, a.to), o = this.orbin, u = g.u;
    // (he is drawn with the ground, which the camera's tilt pushes down: what is handed over is where he is on the screen)
    if (a.orbin) o.set({ x: a.orbin[0], y: a.orbin[1] - (a.flight ? 0 : this.tilt * this.h), s: a.orbin[2], rot: 0, eyes: 'soft', arms: 'chest', crest: 1, glow: 1, lean: 0, face: 1 }, true);
    else o.set({ x: this.w * 0.86, y: -this.h * 1.05, s: 0.5 * u, rot: 0.5, eyes: 'open', arms: 'back', crest: 1, glow: 1, lean: -0.4, face: -1 }, true);
  }
  /** At rest by the fire, with this many stars home. sleeping: the title (he wakes on a tap). */
  rest(stars: number, sleeping: boolean, titled = sleeping): void {
    this.layout();
    this.arr = null; this.stars = stars; this.asleep = sleeping; this.titled = titled; this.tilt = 0; this.wakeAt = -1;
    this.pose(sleeping ? 'asleep' : 'rest', true);
  }
  private pose(p: 'asleep' | 'rest' | 'up', now = false): void {
    const g = LANDING.geo(this.w, this.h, this.stars), u = g.u, [ox, oy] = g.orbin, o = this.orbin;
    o.rate = 3.2;
    if (p === 'asleep') o.set({ x: ox, y: oy - 44 * u, s: 0.74 * u, rot: -0.5, eyes: 'closed', arms: 'rest', crest: 0.2, glow: 0.6, lean: 0, face: 1, look: [0, 0], beat: 0.4 }, now);
    else if (p === 'rest') o.set({ x: ox + 6 * u, y: oy - 52 * u, s: 0.74 * u, rot: -0.22, eyes: 'soft', arms: 'rest', crest: 0.7, glow: 0.9, lean: 0, face: 1, look: [0.8, 0.1], beat: 0.5 }, now);
    else o.set({ x: ox + 30 * u, y: oy - 150 * u, s: 0.7 * u, rot: 0, eyes: 'open', arms: 'rest', crest: 1, glow: 1, lean: -0.15, face: 1, look: [0.3, -0.9], beat: 0.6 }, now);
  }
  /** A tap. On the title it wakes him (the game then sends the camera up); during an arrival it ends the quiet beat. */
  tap(): 'wake' | 'skip' | '' {
    if (this.arr && !this.arr.done) { if (this.arr.home && this.t - this.arr.t0 > 2.6) { this.finish(); return 'skip'; } return ''; }
    if (this.dir > 0) return '';
    this.asleep = false; this.wakeAt = this.t; this.pose('up');
    return 'wake';
  }
  private finish(): void { const a = this.arr; if (!a || a.done) return; a.done = true; if (!a.home) { a.home = true; a.onHome?.(); } this.tilt = 0; const f = a.then; f(); }

  private write(c: CanvasRenderingContext2D, s: string, x: number, y: number, px: number, a: number, align: CanvasTextAlign = 'center', col = '#fff1d8'): void {
    if (a <= 0.004) return;
    c.save(); c.font = `italic 500 ${Math.max(15, px)}px ${SERIF}`; c.textAlign = align; c.textBaseline = 'alphabetic';
    c.shadowColor = 'rgba(3,8,18,0.95)'; c.shadowBlur = px * 0.55; c.globalAlpha = a; c.fillStyle = col;
    c.fillText(s, x, y); c.fillText(s, x, y); c.restore();
  }

  /** Draws the Landing over whatever is on the canvas (the galaxy map, while the camera is between the two). */
  draw(now: number, dt: number): void {
    this.layout();
    const c = this.ctx, { w, h } = this;
    this.t = now / 1000; this.last = now;
    if (this.dir) {
      this.rise = Math.max(0, Math.min(1, this.rise + (this.dir * dt) / this.secs));
      if (this.dir > 0 && this.rise >= 1) { this.dir = 0; const f = this.then; this.then = null; f?.(); } else if (this.dir < 0 && this.rise <= 0) this.dir = 0;
    }
    const e = smooth(this.rise), t = this.t;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.shadowBlur = 0;
    let a = this.set(this.stars), b: LayerSet | null = null, mix = 0, tilt = this.tilt, lift = 1, grow = 0, starAt: [number, number, number] | null = null;
    const g = LANDING.geo(w, h, this.stars), u = g.u, arr = this.arr;
    if (arr && !arr.done) {
      if (arr.t0 < 0) arr.t0 = t;
      const s = t - arr.t0, down = smooth(s / 1.6);
      // the camera: down out of the sky (a flight home), or only levelling (the first stage is already here)
      tilt = arr.flight ? 0.85 * (1 - down) : this.tilt * (1 - down);
      if (s > 0.1) this.pose('rest');
      // the star: beside him, then into the heart of the fire
      const o = this.orbin, sx0 = arr.star ? arr.star[0] : o.x + 34 * u, sy0 = arr.star ? arr.star[1] - this.tilt * h : o.y - 30 * u, ss0 = arr.star ? arr.star[2] : 0.5 * u;
      // (the star goes home into the vessel: its own socket on the Sleeper's back, which sits back a layer, PAR.sleeper)
      const slot = Math.max(0, Math.min(LANDING.SOCKETS - 1, arr.to - 1)), sock = LANDING.sockets(w, h, arr.to)[slot];
      const k = smooth((s - 1.3) / 0.8), hx = sock[0], hy = sock[1] + tilt * h * (PAR.sleeper - 1);
      const fx0 = arr.star && s < 1.3 ? lerp(sx0, o.x + 40 * u, smooth(s / 1.3)) : o.x + 40 * u, fy0 = arr.star && s < 1.3 ? lerp(sy0, o.y - 34 * u, smooth(s / 1.3)) : o.y - 34 * u;
      if (s < 2.1) starAt = [lerp(fx0, hx, k), lerp(fy0, hy, k) - Math.sin(k * Math.PI) * 60 * u, lerp(ss0, 0.22 * u, k)];
      if (s >= 2.1 && !arr.home) { arr.home = true; arr.onHome?.(); this.said = { text: arr.said, at: t + 0.5 }; if (arr.to >= 2 && arr.flight) this.newAt = t + 0.9; }
      // the fire answers: the picture of one star fewer gives way to this one
      a = this.set(arr.from); b = this.set(arr.to); mix = smooth((s - 2.1) / 1.4);
      const f0 = LANDING.geo(w, h, arr.from).fire, f1 = g.fire;
      lift = f1 > 0 ? lerp(f0 / f1, 1, mix) : 1; grow = s > 3.0 ? Math.exp(-(s - 3.0) * 1.6) : 0; // (the fire answers when the light has run down to it)
      if (s > 5.4) this.finish();
    }
    if (this.fireDir) {
      this.fireK = Math.max(0, Math.min(1, this.fireK + (this.fireDir * dt) / this.fireSecs));
      if ((this.fireDir > 0 && this.fireK >= 1) || (this.fireDir < 0 && this.fireK <= 0)) { this.fireDir = 0; const f = this.fireThen; this.fireThen = null; f?.(); }
    }
    const fk = smooth(this.fireK);
    if (fk > 0.001) { const z = 1 + 7 * fk * fk, fy = g.fy - g.F * 0.25 + tilt * h; c.save(); c.translate(g.fx, fy); c.scale(z, z); c.translate(-g.fx, -fy); }
    if (e < 1 || this.dir <= 0) {
      this.orbin.step(dt);
      const breath = 0.5 + 0.5 * Math.sin(t * 0.8);
      this.scene(c, a, b, mix, this.stars, e, tilt, { lift, grow: Math.max(grow, 0.6 * fk), breath }, true);
      if (starAt) { const y = starAt[1] + tilt * h; LANDING.star(c, starAt[0], y, starAt[2], LANDING.STAR_COLS[(this.stars - 1 + 6) % 6], 1, t * 2); }
      // the power-up: once the star is in its socket, light runs down the old channel in the stone to the fire
      if (arr && !arr.done && arr.t0 >= 0) {
        const s2 = t - arr.t0 - 2.1;
        if (s2 > 0 && s2 < 1.1) {
          const slot = Math.max(0, Math.min(LANDING.SOCKETS - 1, arr.to - 1)), [x0, y0, a1, b1, a2, b2, x1, y1] = LANDING.channel(w, h, arr.to, slot), q = smooth(s2 / 0.9), m = 1 - q;
          const x = m * m * m * x0 + 3 * m * m * q * a1 + 3 * m * q * q * a2 + q * q * q * x1, y = m * m * m * y0 + 3 * m * m * q * b1 + 3 * m * q * q * b2 + q * q * q * y1;
          K.glow(c, x, y + tilt * h * PAR.sleeper, 26 * u, [180, 250, 240], 0.9 * (1 - smooth((s2 - 0.9) / 0.2)));
          K.glow(c, x0, y0 + tilt * h * PAR.sleeper, 40 * u, [200, 255, 245], 0.6 * Math.exp(-s2 * 3));
        }
      }
    }
    if (fk > 0.001) { c.restore(); c.fillStyle = `rgba(255,210,130,${Math.pow(fk, 1.6)})`; c.fillRect(0, 0, w, h); K.glow(c, w / 2, h * 0.62, Math.max(w, h) * 0.6, [255, 236, 190], 0.6 * Math.pow(fk, 2), 'screen'); }
    // rising: the land falls away through mist, and the galaxy is above it
    if (e > 0.003) { c.fillStyle = `rgba(20,44,60,${Math.sin(Math.PI * e) * 0.5})`; c.fillRect(0, 0, w, h); }
    const still = (1 - Math.min(1, this.rise * 3)) * (1 - Math.min(1, this.fireK * 4)); // (and nothing is written while the camera is in the fire)
    if (this.titled && still > 0 && this.wordmark) { const size = Math.min(w * 0.3, 150 * u * (g.tall ? 1.5 : 1.9)); this.wordmark(g.tall ? w * 0.5 : w * 0.2, h * (g.tall ? 0.27 : 0.34), size, g.tall ? 'center' : 'left', still, t); }
    if (still > 0 && !this.arriving && this.dir === 0 && this.wakeAt < 0) this.write(c, this.asleep ? 'tap to wake him' : 'tap to rise', w / 2, h - Math.max(26, 34 * u), 19, still * (0.62 + 0.3 * Math.sin(t * 2.2)));
    if (this.said.text && t >= this.said.at) { const age = t - this.said.at; this.write(c, this.said.text, g.tall ? w / 2 : g.fx, g.fy - g.F - 150 * u, g.tall ? 22 : 26, smooth(age / 0.9) * still); }
  }

  // ---------------------------------------------------------------- under the first stage
  /** how far the Sleeper has stirred while the first stage plays (the game does not set this: the song does) */
  private woke = 0;
  /** The same picture as a level's sky: no fire yet, the Sleeper asleep. The first stage is flown over it. */
  /** flowers that bloomed on the planetoid where good taps landed (the first stage): position and when (s) */
  private blooms: Array<{ x: number; y: number; at: number; hue: number }> = [];
  private strikeWas = 0; private bloomSeed = 1;
  readonly backdrop = {
    prepare: (): void => { this.set(0); this.blooms = []; this.bloomSeed = 1; },
    draw: (c: CanvasRenderingContext2D, w: number, h: number, st: SceneState): void => {
      this.layout();
      if (w !== this.w || h !== this.h) return;
      this.t = st.time;
      const up = st.woke >= 0 ? smooth(st.woke / 1.2) : 0;
      this.woke = up;
      this.scene(c, this.set(0), null, 0, 0, 0, STAGE_TILT, { lift: 0, grow: 0, breath: Math.min(1, st.kick * 0.8 + up * 0.5) }, false);
      // the world answering: with the first tap the night has colour in it; from the drop, light comes up off the land
      const g = LANDING.geo(w, h, 0), hy = g.hy + STAGE_TILT * h * PAR.far, k = smooth(Math.min(1, st.colour * 1.3));
      K.glow(c, w * 0.5, hy, Math.max(w, h) * 0.7, [70, 190, 190], 0.1 * k + 0.2 * up * (0.7 + 0.3 * st.drive) + (st.calm ? 0 : 0.05 * st.kick * up), 'screen');
      if (up > 0) K.glow(c, g.seam[0], g.seam[1] + STAGE_TILT * h * PAR.sleeper, 200 * g.u, [120, 235, 215], 0.3 * up * (0.7 + 0.3 * st.kick), 'screen');
      // the world answers the player: every good tap blooms a flower on the planetoid below (they stay)
      if (st.strike > 0.9 && this.strikeWas <= 0.9 && this.blooms.length < 90) {
        const r = K.RNG(this.bloomSeed++ * 7919);
        this.blooms.push({ x: w * (0.06 + 0.88 * r()), y: h * (0.8 + 0.17 * r()), at: st.time, hue: r() });
      }
      this.strikeWas = st.strike;
      for (const b of this.blooms) {
        const age = st.time - b.at, k = smooth(age / 0.45), s = (2.2 + 2.6 * k) * g.u * 1.6;
        if (k <= 0) continue;
        K.glow(c, b.x, b.y, s * 5, b.hue < 0.5 ? [150, 235, 220] : [255, 226, 170], 0.25 * k * (1 + 1.5 * Math.exp(-age * 3)), 'screen');
        c.fillStyle = `rgba(240,250,245,${0.85 * k})`;
        for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + b.hue * 3; c.beginPath(); c.arc(b.x + Math.cos(a) * s, b.y + Math.sin(a) * s * 0.7, s * 0.55, 0, Math.PI * 2); c.fill(); }
        c.fillStyle = b.hue < 0.5 ? 'rgba(150,235,220,0.9)' : 'rgba(255,214,140,0.9)'; c.beginPath(); c.arc(b.x, b.y, s * 0.4, 0, Math.PI * 2); c.fill();
      }
      // the air round the course is kept dark, so the path and its nodes are the clearest things there are
      if (this.veil > 0.003) {
        const cx = w / 2, cy = h * 0.52, span = Math.min(w, h) * 0.74, gr = c.createRadialGradient(cx, cy, 0, cx, cy, span), a = 0.5 * this.veil;
        gr.addColorStop(0, `rgba(4,10,20,${a})`); gr.addColorStop(0.4, `rgba(4,10,20,${a})`); gr.addColorStop(0.62, `rgba(4,10,20,${a * 0.62})`); gr.addColorStop(0.82, `rgba(4,10,20,${a * 0.22})`); gr.addColorStop(1, 'rgba(4,10,20,0)');
        c.fillStyle = gr; c.fillRect(0, 0, w, h);
      }
    }
  };
  /** where the first star comes up out of the ground, on the screen while the first stage's picture is up (where the fire will be) */
  stageFire(): [number, number, number] { this.layout(); const g = LANDING.geo(this.w, this.h, 0); return [g.fx, g.fy + STAGE_TILT * this.h, g.u]; }
}
