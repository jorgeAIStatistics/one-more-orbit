// The star collection: the end of a level, and the most rewarding moment in the game. On the song's last big hit the
// world's star rises out of its land; Orbin flies to it on one eased arc and catches it; light bursts, the sky makes
// one slow turn round him, the whole world is in colour, and its name is written softly: "Emberwick restored". A first
// clear plays all of it (about five seconds); a replay, a quick echo. It is drawn over the level, which is still
// running underneath (its music plays out); nothing is loaded here.
//
// Our own star and our own move: a Star-Node's star, risen, with one thin orbit round it in its world's colour.
import { LANDING } from '../art/landingpaint.js';
import { K } from '../art/painter.js';
import { Actor } from './actor';
import type { SceneState } from './skyplanet';

const SERIF = '"Cormorant Garamond", "Hoefler Text", Baskerville, Palatino, Georgia, serif';
const smooth = (x: number) => { const t = x < 0 ? 0 : x > 1 ? 1 : x; return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const out = (x: number) => { const t = x < 0 ? 0 : x > 1 ? 1 : x; return 1 - (1 - t) * (1 - t) * (1 - t); };

export interface StarPlay {
  /** the picture behind: the world's own sky (it is drawn again here, over the course) */
  scene: { draw: (c: CanvasRenderingContext2D, w: number, h: number, st: SceneState) => void };
  /** where the star comes up from (screen), where Orbin is as the level ends (screen), and the star's own colour */
  from: [number, number]; orbin: [number, number]; col: number[];
  /** the two lines written in the sky, and a small third under them (how the flight went) */
  name: string; word: string; note: string;
  /** a replay: the quick echo */
  quick: boolean;
  /** the picture must end exactly as it is (the first stage hands Orbin and the star on to the Landing, in the same picture) */
  hold: boolean;
  /** called once: the catch (the sting plays on it) */
  onCatch: () => void;
  /** the dark air round the course lifts as the sequence opens: the scene is told how much is left */
  veil?: (v: number) => void;
  then: (at: { orbin: [number, number, number]; star: [number, number, number] }) => void;
}

/** when things happen, in seconds from the last hit (a first clear) */
const T = { open: 0.12, rise: 0.25, up: 1.25, fly: 1.3, catch: 2.05, words: 2.9, end: 5.0 };

export class SkyStar {
  private ctx: CanvasRenderingContext2D;
  private p: StarPlay | null = null;
  private t0 = -1; private caught = false; private ended = false; private skip = -1;
  private orbin = new Actor('orbin');
  private dust: Array<{ a: number; v: number; r: number; s: number }> = [];
  constructor(private canvas: HTMLCanvasElement) { this.ctx = canvas.getContext('2d')!; }

  get on(): boolean { return !!this.p && !this.ended; }
  /** seconds from the last hit to the catch: the sting is scheduled against this */
  static readonly CATCH = T.catch;
  static readonly CATCH_QUICK = 0.7;

  play(p: StarPlay): void {
    this.p = p; this.t0 = -1; this.caught = false; this.ended = false; this.skip = -1;
    const u = this.unit();
    this.orbin.rate = 6;
    this.orbin.set({ x: p.orbin[0], y: p.orbin[1], s: 0.42 * u, eyes: 'wide', arms: 'rest', crest: 0.8, glow: 1, lean: 0, face: p.from[0] < p.orbin[0] ? -1 : 1, look: [0, -0.8] }, true);
    this.dust = []; for (let i = 0; i < 90; i++) this.dust.push({ a: Math.random() * 6.283, v: 0.35 + Math.random() * 0.9, r: Math.random(), s: 0.6 + Math.random() * 1.6 });
  }
  stop(): void { this.p = null; this.ended = true; }
  /** A tap: once the star is caught, it goes on. */
  tap(): void { if (this.on && this.caught && this.skip < 0) this.skip = performance.now(); }
  private unit(): number { const w = window.innerWidth, h = window.innerHeight; return w > h * 1.15 ? Math.min(w / 1440, h / 900) * 1.15 * 2 : Math.min(w / 390, h / 844); }

  private write(c: CanvasRenderingContext2D, s: string, x: number, y: number, px: number, a: number, col = '#fff1d8'): void {
    if (a <= 0.004) return;
    c.save(); c.font = `italic 500 ${Math.max(15, px)}px ${SERIF}`; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.shadowColor = 'rgba(8,6,20,0.95)'; c.shadowBlur = px * 0.5; c.globalAlpha = a; c.fillStyle = col;
    c.fillText(s, x, y); c.fillText(s, x, y); c.restore();
  }

  /** Draws the sequence over the level. now: the page clock; dt: seconds since the last frame. */
  draw(now: number, dt: number): void {
    const p = this.p;
    if (!p || this.ended) return;
    if (this.t0 < 0) this.t0 = now;
    const c = this.ctx, w = window.innerWidth, h = window.innerHeight, dpr = this.canvas.width / Math.max(1, w), u = this.unit();
    const q = p.quick, k = q ? T.catch / SkyStar.CATCH_QUICK : 1; // (a replay runs the same shape, faster)
    let s = ((now - this.t0) / 1000) * k;
    if (this.skip >= 0) s = Math.max(s, T.end - 0.5 + (now - this.skip) / 1000); // tapped on: the words go, and it ends
    const end = q ? T.words + 1.1 : T.end;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.shadowBlur = 0;
    const o = this.orbin, cx = w * 0.5, cy = h * (q ? 0.4 : 0.33), after = s - T.catch;
    // the picture: from the first frame after the flash it is the world itself, whole, with no course over it
    if (s >= T.open) {
      p.veil?.(1 - smooth((s - T.open) / 0.9));
      const turn = after > 0 && !q && !p.hold ? smooth(after / 2.6) : 0, z = 1 + 0.07 * Math.sin(turn * Math.PI) + 0.02 * turn, rot = 0.035 * Math.sin(turn * Math.PI);
      c.save(); c.translate(cx, cy); c.rotate(rot); c.scale(z, z); c.translate(-cx - Math.sin(turn * Math.PI) * w * 0.02, -cy); // the camera's one slow turn round him
      p.scene.draw(c, w, h, { time: now / 1000, song: undefined, colour: 1, drive: after > 0 ? 1 : 0.6, kick: after > 0 ? Math.exp(-after * 1.4) : 0, woke: 30 + s, strike: after > 0 ? Math.exp(-after * 3) : 0, dark: 0, calm: false });
      c.restore();
    }
    // the star: up out of the land, on a beam of its own light
    const [fx, fy] = p.from, upK = out((s - T.rise) / (T.up - T.rise)), sxA = lerp(fx, cx, upK), syA = lerp(fy, cy, upK);
    const size = (q ? 0.55 : 1) * u;
    if (s >= T.rise && !this.caught) {
      const g = c.createLinearGradient(0, fy, 0, syA); g.addColorStop(0, 'rgba(255,226,160,0)'); g.addColorStop(0.3, `rgba(255,226,160,${0.4 * (1 - upK * 0.5)})`); g.addColorStop(1, 'rgba(255,226,160,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(fx - 22 * u, fy); c.lineTo(sxA - 6 * u, syA); c.lineTo(sxA + 6 * u, syA); c.lineTo(fx + 22 * u, fy); c.fill();
      LANDING.star(c, sxA, syA, 0.8 * size * (0.4 + 0.6 * upK), p.col, Math.min(1, (s - T.rise) / 0.2), now / 300);
    }
    // Orbin: he sees it, and flies to it: fast out, slow in
    const [ox, oy] = p.orbin, fk = smooth((s - T.fly) / (T.catch - T.fly));
    if (s < T.fly) o.set({ look: [(sxA - ox) / w * 3, -0.9], eyes: 'wide' });
    else if (!this.caught) {
      const bend = Math.sin(fk * Math.PI) * w * 0.12 * (ox > cx ? 1 : -1);
      o.set({ x: lerp(ox, cx, fk) + bend, y: lerp(oy, cy + 26 * u, fk) - Math.sin(fk * Math.PI) * h * 0.03, s: lerp(0.42, q ? 0.5 : 0.62, fk) * u, arms: 'reach', lean: 0.35 * (ox > cx ? -1 : 1), crest: 1, look: [0, -1] }, true);
    }
    if (s >= T.catch && !this.caught) { this.caught = true; p.onCatch(); o.set({ x: cx, y: cy + 26 * u, arms: 'chest', eyes: 'closed', lean: 0, crest: 1, beat: 1 }); }
    if (this.caught) {
      // the catch: a burst of light, three rings going out, dust; then the star is his, small, at his chest
      const b = Math.exp(-after * 2.2);
      K.glow(c, cx, cy, (300 + 620 * out(after / 0.5)) * u * (q ? 0.6 : 1), [255, 236, 190], 0.85 * b, 'screen');
      for (let i = 0; i < 3; i++) { const rr = (60 + i * 46 + after * (300 + i * 120)) * u * (q ? 0.6 : 1), a = (0.55 - i * 0.14) * Math.max(0, 1 - after / (0.9 + i * 0.25)); if (a > 0.01) { c.strokeStyle = `rgba(255,244,214,${a})`; c.lineWidth = Math.max(1.5, (5 - i) * u * 0.6); c.beginPath(); c.ellipse(cx, cy, rr, rr * 0.32, -0.2, 0, Math.PI * 2); c.stroke(); } }
      for (const d of this.dust) { const r = (40 + d.v * after * 420) * u * (q ? 0.6 : 1), a = Math.max(0, 1 - after / (0.9 + d.r)) * 0.9; if (a > 0.01) { c.fillStyle = `rgba(255,${226 + Math.round(d.r * 24)},${170 + Math.round(d.r * 60)},${a})`; c.beginPath(); c.arc(cx + Math.cos(d.a) * r, cy + Math.sin(d.a) * r * 0.7 + after * after * 30 * u, d.s * u, 0, Math.PI * 2); c.fill(); } }
      if (after > 0.9) o.set({ eyes: 'soft', look: [0, -0.3] });
      const hold = smooth(after / 0.7);
      LANDING.star(c, cx, lerp(cy, cy + 18 * u, hold), lerp(0.8, 0.34, hold) * size, p.col, 1, now / 300);
    }
    o.step(dt); o.draw(c);
    // the flash on the last hit: it is what the course goes out behind
    if (s < 0.7) { c.fillStyle = `rgba(255,240,210,${(s < T.open ? s / T.open : 1 - smooth((s - T.open) / 0.58)) * 0.85})`; c.fillRect(0, 0, w, h); }
    // its name, written softly in the sky
    const wa = smooth((s - T.words) / 0.7) * (1 - smooth((s - (end - 0.6)) / 0.5)), wy = h * (q ? 0.2 : 0.17);
    this.write(c, p.name, cx, wy, Math.min(w * 0.13, 56 * u), wa);
    this.write(c, p.word, cx, wy + Math.min(w * 0.075, 30 * u), Math.min(w * 0.07, 27 * u), wa, '#ffe6b8');
    if (p.note) this.write(c, p.note, cx, wy + Math.min(w * 0.075, 30 * u) + 30, 16, wa * 0.9, '#e6cfae');
    // a flight home leaves in light; a picture that is handed on is left exactly as it is
    if (!p.hold && s > end - 0.45) { c.fillStyle = `rgba(255,236,196,${smooth((s - (end - 0.45)) / 0.4)})`; c.fillRect(0, 0, w, h); }
    if (s >= end) { this.ended = true; const f = p.then; f({ orbin: [o.x, o.y, o.s], star: [cx, cy + 18 * u, 0.34 * size] }); }
  }
}
