// Moments: the short scenes of a first clear, between the star reigniting and the memory. Each is a few seconds, moves
// by itself, and a tap goes on. They are painted pictures with the twins acting in them; nothing is a card.
//   gift   the one who lives there gives Orbin its gift, and he uses it once, so you see what you now have
//   road   a stretch of the path to the galaxy's edge lights, and the guardian reacts
import { CANON } from '../art/canonpaint.js';
import { DUSK, K } from '../art/painter.js';
import { RESULTS } from '../art/resultpaint.js';
import { WORLD1 } from '../art/world1paint.js';
import { audio } from '../audio/audio';
import { Actor } from './actor';

const Y = RESULTS.LAYERS, T = DUSK.tools, P = CANON.parts;
const SERIF = '"Cormorant Garamond", "Hoefler Text", Baskerville, Palatino, Georgia, serif';
const smooth = (x: number) => { const t = x < 0 ? 0 : x > 1 ? 1 : x; return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export type Moment = 'gift' | 'road';
/** what each gift is, in a line (shown once the gift has been used) */
const GIFT: Record<string, { says: string; what: string; tint: [number, number, number] }> = {
  heroes: { says: '“It does not stop for walls.”', what: 'the Meteor: tap, and dash through walls', tint: [255, 150, 90] }
};

export class SkyMoment {
  private ctx: CanvasRenderingContext2D;
  private kind: Moment | '' = '';
  private world = '';
  private stars = 0;
  private t0 = -1;
  private last = 0;
  private then: (() => void) | null = null;
  private a: HTMLCanvasElement | null = null;
  private b: HTMLCanvasElement | null = null;
  private orbin = new Actor('orbin');
  private lay = { w: 0, h: 0, u: 1, dpr: 1, tall: true };
  private rang = 0;

  constructor(private canvas: HTMLCanvasElement) { this.ctx = canvas.getContext('2d')!; }
  get length(): number { return this.kind === 'gift' ? 6.4 : 5.6; }

  /** Plays a moment, then goes on. world: whose gift; stars: how many are awake now (the road lights that far). */
  play(kind: Moment, world: string, stars: number, then: () => void): void {
    Object.assign(this, { kind, world, stars, then, t0: -1, last: 0, rang: 0 });
    this.orbin = new Actor('orbin');
    const w = window.innerWidth, h = window.innerHeight, dpr = this.canvas.width / Math.max(1, w), tall = !(w > h * 1.15);
    const u = tall ? Math.min(w / 390, h / 844) : Math.min(w / 1440, h / 900) * 1.15;
    this.lay = { w, h, u, dpr, tall };
    const sheet = (): [HTMLCanvasElement, CanvasRenderingContext2D] => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return [cv, cv.getContext('2d')!]; };
    if (kind === 'gift') {
      const [cv, c] = sheet(), dev = tall ? 'phone' : 'desktop';
      Y.scene(c, w, h, world, dev, u, 'blaze');
      const [ox, oy, os] = this.soul();
      WORLD1.parts.ossa(c, ox, oy, os, 1, K.RNG(53), 'stand');
      this.a = cv; this.b = null;
    } else {
      // the road: the planetoid's path running to the galaxy's edge, the guardian and the three rings over it
      const paint = (lit: number, state: number): HTMLCanvasElement => {
        const [cv, c] = sheet(), VW = Math.max(780, Math.round((1688 * w) / h)), k = h / 1688, hy = 1688 * 0.56, f = 780 / VW;
        c.scale(k, k);
        T.sky(c, VW, 1688, CANON.pal.DRIFT.map(([t, col]) => [t, K.mix(col, CANON.pal.WOKEN[Math.min(4, Math.round(t * 4))][1], 0.16 * lit * 3)] as [number, number[]]), K.RNG(16), 70);
        T.stars(c, VW, 1688 * 0.5, K.RNG(20), Math.round(160 * lit * 3 * VW / 780), 3);
        P.trials(c, VW * 0.5 + 40, hy - 330, 1.25, K.RNG(41), 0.9); P.guardian(c, VW * 0.5 + 60, hy + 4, 0.34, K.RNG(42), state);
        P.ground(c, VW, 1688, hy, K.RNG(17), 0.3 * lit * 3); P.tiles(c, VW, 1688, hy, K.RNG(18), lit, { wide: 0.2 * f, bend: 0.26 * f });
        T.finish(c, VW, 1688, 25, 0.5);
        return cv;
      };
      const was = Math.max(0, stars - 1) * 0.2, now = stars * 0.2;
      this.a = paint(was, stars > 1 ? 1 : 0); this.b = paint(now, stars >= 1 ? 1 : 0);
    }
  }
  /** where the one who lives there stands: x, y, scale */
  private soul(): [number, number, number] { const { w, h, u, tall } = this.lay, hy = h * Y.lay(tall ? 'phone' : 'desktop').horizon; return [tall ? w * 0.34 : w * 0.3, hy + (tall ? 74 : 86) * u, (tall ? 0.86 : 1.25) * u]; }
  /** A tap goes on (once the moment has had a breath). */
  tap(): void { if (this.t0 >= 0 && this.last - this.t0 > 600) this.finish(); }
  private finish(): void { const f = this.then; this.then = null; this.a = this.b = null; this.kind = ''; f?.(); }
  private words(s: string, x: number, y: number, px: number, a: number, color = '#fff1d8', align: CanvasTextAlign = 'left'): void {
    if (a <= 0.004) return;
    const c = this.ctx, size = Math.max(14, px);
    c.save(); c.font = `italic 500 ${size}px ${SERIF}`; c.textAlign = align; c.textBaseline = 'alphabetic'; c.shadowColor = 'rgba(8,6,22,0.9)'; c.shadowBlur = size * 0.5; c.globalAlpha = a; c.fillStyle = color; c.fillText(s, x, y); c.fillText(s, x, y); c.restore();
  }

  draw(now: number): void {
    if (!this.kind) return;
    if (this.t0 < 0) this.t0 = now;
    const dt = Math.min(0.05, this.last ? (now - this.last) / 1000 : 0.016), t = (now - this.t0) / 1000;
    this.last = now;
    const c = this.ctx, { w, h, dpr } = this.lay;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.globalAlpha = 1; c.fillStyle = '#08071c'; c.fillRect(0, 0, w, h);
    if (this.kind === 'gift') this.gift(t, dt); else this.road(t);
    const veil = Math.max(1 - smooth(t / 0.5), smooth((t - this.length + 0.5) / 0.5));
    if (veil > 0) { c.globalAlpha = veil; c.fillStyle = '#08071c'; c.fillRect(0, 0, w, h); c.globalAlpha = 1; }
    if (t >= this.length) this.finish();
  }

  private gift(t: number, dt: number): void {
    const c = this.ctx, { w, h, u, tall } = this.lay, o = this.orbin, G = GIFT[this.world] ?? GIFT.heroes;
    if (this.a) c.drawImage(this.a, 0, 0, w, h);
    const [ox, oy, os] = this.soul();
    // its forks ring
    c.save(); c.globalCompositeOperation = 'screen';
    for (let k = 0; k < 4; k++) { const ph = (t * 0.9 + k * 0.25) % 1; c.strokeStyle = K.rgba([255, 226, 170], 0.5 * (1 - ph)); c.lineWidth = 2.4 * u; c.beginPath(); c.arc(ox + 148 * os, oy - 172 * os, (22 + ph * 90) * os, -2.4, -0.6); c.stroke(); }
    c.restore();
    // where things happen: he waits; the coal comes to him; a wall of shadow stands in the sky; he goes through it
    const home: [number, number] = tall ? [w * 0.8, h * 0.5] : [w * 0.62, h * 0.52], far: [number, number] = tall ? [w * 0.3, h * 0.36] : [w * 0.36, h * 0.3];
    const wall: [number, number] = [lerp(home[0], far[0], 0.52), lerp(home[1], far[1], 0.52)], ang = Math.atan2(far[1] - home[1], far[0] - home[0]);
    const TAKE = 1.5, DASH = 3.0, THROUGH = 3.22, LAND = 3.5, size = (tall ? 0.42 : 0.56) * u;
    // the coal, on its way
    if (t > 0.5 && t < TAKE) { const s = smooth((t - 0.5) / (TAKE - 0.5)), fx = ox + 150 * os, fy = oy - 110 * os, x = lerp(fx, home[0] - 20 * u, s), y = lerp(fy, home[1] - 30 * u, s) - Math.sin(s * Math.PI) * 60 * u; K.glow(c, x, y, 62 * u, G.tint, 0.7); c.fillStyle = 'rgba(255,214,150,0.98)'; c.beginPath(); c.ellipse(x, y, 9 * u, 6.4 * u, 0.4, 0, Math.PI * 2); c.fill(); }
    // the wall
    const wa = smooth((t - 2.0) / 0.5), broke = t >= THROUGH;
    if (wa > 0 && !broke) { c.save(); c.translate(wall[0], wall[1]); c.rotate(ang + Math.PI / 2); c.globalAlpha = wa; c.lineCap = 'round'; c.strokeStyle = 'rgba(150,170,230,0.5)'; c.lineWidth = 30 * u; c.beginPath(); c.moveTo(-96 * u, 0); c.lineTo(96 * u, 0); c.stroke(); c.strokeStyle = 'rgba(6,6,16,0.97)'; c.lineWidth = 24 * u; c.stroke(); c.restore(); }
    if (broke) { // it breaks: pieces go on the way he went
      const age = t - THROUGH;
      if (!this.rang) { this.rang = 1; audio.hit('impact', 0.6); }
      for (let i = 0; i < 12; i++) { const a = ang + (i - 5.5) * 0.16, d = (60 + i * 17) * u * (1 - Math.exp(-age * 3)), al = 1 - smooth(age / 0.9); if (al <= 0) break; c.save(); c.translate(wall[0] + Math.cos(a) * d + Math.cos(ang + Math.PI / 2) * (i - 5.5) * 14 * u, wall[1] + Math.sin(a) * d + Math.sin(ang + Math.PI / 2) * (i - 5.5) * 14 * u); c.rotate(a + i); c.fillStyle = `rgba(8,8,20,${al})`; c.fillRect(-9 * u, -5 * u, 18 * u, 10 * u); c.restore(); }
      K.glow(c, wall[0], wall[1], 220 * u, G.tint, 0.8 * Math.exp(-age * 4));
    }
    // Orbin
    o.rate = 5; o.tint = t > TAKE ? G.tint : null;
    if (t < DASH) o.set({ x: home[0], y: home[1], s: size, face: -1, glow: 1, lean: t > 2.3 ? -0.3 : 0, crest: t > 2.3 ? 1 : 0.6, eyes: t < TAKE ? 'wide' : t < 2.3 ? 'soft' : 'set', arms: t < 0.9 ? 'rest' : t < TAKE + 0.4 ? 'chest' : 'back', look: t < 2.2 ? [0.9, 0.2] : [0.6, -0.6], beat: t > TAKE ? 1 : 0.5 }, t < 0.05);
    else if (t < LAND) { const s = (t - DASH) / (LAND - DASH), e = s * s * (3 - 2 * s); o.set({ x: lerp(home[0], far[0], e), y: lerp(home[1], far[1], e), s: size, lean: -0.8, crest: 1, arms: 'back', eyes: 'set' }, true); const tx = o.x - Math.cos(ang) * 150 * u, ty = o.y - Math.sin(ang) * 150 * u, g = c.createLinearGradient(o.x, o.y, tx, ty); g.addColorStop(0, K.rgba(G.tint, 0.85)); g.addColorStop(1, K.rgba(G.tint, 0)); c.strokeStyle = g; c.lineWidth = 26 * u; c.lineCap = 'round'; c.beginPath(); c.moveTo(o.x, o.y); c.lineTo(tx, ty); c.stroke(); }
    else o.set({ x: far[0], y: far[1], s: size, face: 1, lean: 0, crest: 0.8, arms: t < LAND + 1 ? 'up' : 'rest', eyes: 'wide', look: [0.6, 0.5] });
    o.step(dt); o.draw(c);
    // what Ossa says, and what it is
    const tx = w * (tall ? 0.09 : 0.07), ty = h * (tall ? 0.15 : 0.2);
    this.words(G.says, tx, ty, (tall ? 23 : 27) * u, smooth((t - 1.1) / 0.7));
    this.words(G.what, tx, ty + (tall ? 30 : 36) * u, (tall ? 16 : 18) * u, smooth((t - LAND) / 0.6) * 0.9, '#e6cfae');
  }

  private road(t: number): void {
    const c = this.ctx, { w, h, u } = this.lay;
    if (this.a) c.drawImage(this.a, 0, 0, w, h);
    if (this.b) {
      // the light runs up the path from where he stands; when it has gone as far as it goes, the guardian answers
      const hy = h * 0.56, run = smooth((t - 0.7) / 2.2), top = lerp(h, hy + 4, run);
      c.save(); c.beginPath(); c.rect(0, top, w, h - top); c.clip(); c.drawImage(this.b, 0, 0, w, h); c.restore();
      if (run > 0 && run < 1) { const g = c.createLinearGradient(0, top - 26 * u, 0, top + 26 * u); g.addColorStop(0, 'rgba(255,226,160,0)'); g.addColorStop(0.5, 'rgba(255,226,160,0.5)'); g.addColorStop(1, 'rgba(255,226,160,0)'); c.fillStyle = g; c.fillRect(0, top - 26 * u, w, 52 * u); }
      const up = smooth((t - 3.0) / 0.9);
      if (up > 0) { c.save(); c.globalAlpha = up; c.beginPath(); c.rect(0, 0, w, hy + 6); c.clip(); c.drawImage(this.b, 0, 0, w, h); c.restore(); if (!this.rang) { this.rang = 1; audio.hit('impact', 0.35); } }
      // and far behind the rings, his brother's light answers: a little clearer with every star
      const sx = w * 0.5 + 60 * (h / 1688), sy = hy - 320 * (h / 1688), pulse = Math.max(0, Math.sin((t - 3.6) * 3.2)) * smooth((t - 3.6) / 0.4);
      if (t > 3.6) { K.glow(c, sx, sy, (18 + 26 * pulse) * u * (1 + this.stars * 0.3), [255, 206, 120], 0.35 + 0.4 * pulse); c.fillStyle = `rgba(255,243,207,${0.6 + 0.4 * pulse})`; c.beginPath(); c.arc(sx, sy, 2.2 * u, 0, Math.PI * 2); c.fill(); }
    }
  }
}
