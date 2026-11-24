// The title, Afterglow ("The Horizon"): the bottom of the same painting as the galaxy map. A wide dusk, the land a
// low band, the Lantern far off, Eko drifting where the last light is, and the name written softly into the sky with
// an orbit of light round it. A tap and Eko rises: the land sinks away, the name fades, and the galaxy is there.
import { DUSK, K } from '../art/painter.js';

const T = DUSK.tools;
const SERIF = '"Cormorant Garamond", "Hoefler Text", Baskerville, Palatino, Georgia, serif';
const SKY = [[0, [10, 11, 38]], [0.34, [38, 30, 90]], [0.6, [104, 52, 108]], [0.8, [214, 108, 92]], [0.92, [250, 176, 118]], [1, [255, 214, 150]]];
const RIDGES: Array<[number, number, [number, number, number], number]> = [[0, 34, [96, 50, 96], 0.35], [40, 30, [60, 32, 76], 0.6], [86, 26, [34, 20, 54], 0.8], [140, 22, [16, 10, 32], 0.9]];
interface Lay { horizon: number; sun: number; title: [number, number, number, CanvasTextAlign]; eko: [number, number, number]; lantern: [number, number, number]; hint: [number, number, CanvasTextAlign] }
const LAYS: Record<'tall' | 'wide', Lay> = {
  tall: { horizon: 0.8, sun: 0.66, title: [0.5, 0.33, 118, 'center'], eko: [0.66, 0.62, 0.52], lantern: [0.16, 0.826, 0.5], hint: [0.5, 0.945, 'center'] },
  wide: { horizon: 0.78, sun: 0.7, title: [0.1, 0.44, 200, 'left'], eko: [0.72, 0.5, 0.66], lantern: [0.9, 0.81, 0.7], hint: [0.105, 0.57, 'left'] }
};
const smooth = (x: number) => { const t = x < 0 ? 0 : x > 1 ? 1 : x; return t * t * (3 - 2 * t); };

export class SkyTitle {
  private ctx: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement | null = null;
  private eko: HTMLCanvasElement | null = null;
  private key = '';
  private w = 0; private h = 0; private u = 1; private dpr = 1;
  private L: Lay = LAYS.tall;
  /** how far the camera has risen toward the galaxy, 0..1, and which way it is going */
  private rise = 0;
  private dir = 0;
  private then: (() => void) | null = null;

  constructor(private canvas: HTMLCanvasElement) { this.ctx = canvas.getContext('2d')!; }

  /** Eko rises and the camera goes up with him; `then` runs when the galaxy is reached. */
  ascend(then: () => void): void { if (this.dir > 0) return; this.dir = 1; this.then = then; }
  /** Coming back down from the galaxy to the horizon. */
  descend(): void { this.rise = 1; this.dir = -1; this.then = null; }
  get rising(): boolean { return this.dir > 0; }
  /** Is the picture still part-way to the galaxy (so the map should be drawn under it)? */
  get between(): boolean { return this.rise > 0.001; }

  private layout(): void {
    const w = window.innerWidth, h = window.innerHeight, dpr = this.canvas.width / Math.max(1, w);
    const key = `${w}x${h}@${dpr.toFixed(2)}`;
    if (key === this.key) return;
    this.key = key; this.w = w; this.h = h; this.dpr = dpr;
    const wide = w > h * 1.15, L = (this.L = wide ? LAYS.wide : LAYS.tall), u = (this.u = wide ? Math.min(w / 1440, h / 900) * 1.15 : Math.min(w / 390, h / 844));
    const cv = document.createElement('canvas');
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const c = cv.getContext('2d')!;
    c.scale(dpr, dpr);
    const r = K.RNG(401);
    T.sky(c, w, h, SKY.map(([t, col]) => [Math.min(1, ((t as number) * L.horizon) / 0.86), col]), r, 170);
    T.stars(c, w, h * (L.horizon - 0.12), r, Math.round((w * h) / 520), 401);
    const hy = h * L.horizon;
    // the last of the day: a low bright place on the horizon, and its light lying along the sky's edge
    K.glow(c, w * L.sun, hy + 10 * u, 520 * u, [255, 196, 130], 0.5, 'screen');
    c.save(); c.filter = `blur(${26 * u}px)`; c.fillStyle = 'rgba(255,196,140,0.4)'; c.fillRect(-40, hy - 46 * u, w + 80, 70 * u); c.restore();
    RIDGES.forEach(([dy, amp, col, rim], i) => T.ridge(c, w, h, hy + dy * u, amp * u, 401 + i * 7, col, w * L.sun, [255, 214, 150], rim));
    const [lx, ly, ls] = [w * L.lantern[0], h * L.lantern[1], L.lantern[2] * u];
    K.glow(c, lx - 10 * ls, ly - 132 * ls, 150 * ls, [255, 214, 150], 0.6);
    T.lighthouse(c, lx, ly, ls, r);
    T.finish(c, w, h, 410, 0.5);
    this.bg = cv;
    const s = L.eko[2] * u, ek = document.createElement('canvas');
    ek.width = Math.round(700 * s * dpr); ek.height = Math.round(760 * s * dpr); // (room for the whole of his glow: a cut-off glow shows as a box)
    const ec = ek.getContext('2d')!;
    ec.scale(dpr * s, dpr * s);
    T.eko(ec, 350, 330, 1, K.RNG(7), { wisp: true, lean: 0.3 });
    this.eko = ek;
  }

  /** The name, written into the sky: soft light under it, the letters in cream, and an orbit of light with a spark going round it. */
  private wordmark(x: number, y: number, size: number, align: CanvasTextAlign, a: number, t: number): void {
    const c = this.ctx;
    const big = `italic 500 ${size}px ${SERIF}`;
    c.save();
    c.font = big;
    const wBig = c.measureText('Orbit').width;
    const left = align === 'center' ? x - wBig / 2 : x;
    const cx = left + wBig * 0.5, cy = y - size * 0.28, rx = wBig * 0.7, ry = size * 0.36;
    const ring = (front: boolean) => { c.save(); c.translate(cx, cy); c.rotate(-0.13); c.strokeStyle = `rgba(255,232,196,${(front ? 0.85 : 0.3) * a})`; c.lineWidth = Math.max(1.4, size * 0.016); c.shadowColor = 'rgba(255,190,120,0.9)'; c.shadowBlur = size * 0.1; c.beginPath(); c.ellipse(0, 0, rx, ry, 0, front ? 0.15 : Math.PI + 0.1, front ? Math.PI - 0.15 : Math.PI * 2 - 0.1); c.stroke(); c.restore(); };
    ring(false);
    c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    for (const [blur, al] of [[size * 0.5, 0.5], [size * 0.16, 0.6]]) { c.shadowColor = `rgba(255,170,110,${al * a})`; c.shadowBlur = blur; c.fillStyle = `rgba(255,240,214,${0.5 * a})`; c.fillText('Orbit', left, y); }
    c.shadowBlur = size * 0.05; c.shadowColor = 'rgba(40,16,50,0.5)';
    c.fillStyle = `rgba(255,244,224,${0.97 * a})`; c.fillText('Orbit', left, y);
    c.font = `italic 500 ${size * 0.34}px ${SERIF}`; c.fillStyle = `rgba(255,236,206,${0.9 * a})`;
    try { (c as unknown as { letterSpacing: string }).letterSpacing = `${size * 0.03}px`; } catch { /* older engines */ }
    c.fillText('one more', left + size * 0.07, y - size * 0.84);
    c.restore();
    ring(true);
    // a spark goes round the orbit, slowly: the name is alive
    const q = t * 0.45, sx = Math.cos(q) * rx, sy = Math.sin(q) * ry, bx = cx + sx * Math.cos(-0.13) - sy * Math.sin(-0.13), by = cy + sx * Math.sin(-0.13) + sy * Math.cos(-0.13);
    const near = Math.sin(q) > 0 ? 1 : 0.35; // dimmer on the far side of the word
    K.glow(c, bx, by, size * 0.2, [255, 214, 150], 0.7 * a * near);
    c.fillStyle = `rgba(255,248,230,${a * near})`; c.beginPath(); c.arc(bx, by, Math.max(2, size * 0.022), 0, Math.PI * 2); c.fill();
  }

  /** Draws the title over whatever is already on the canvas (the galaxy, while rising). */
  draw(now: number, dt: number): void {
    this.layout();
    const c = this.ctx, { w, h, u } = this, L = this.L, t = now / 1000;
    if (this.dir) {
      this.rise = Math.max(0, Math.min(1, this.rise + (this.dir * dt) / (this.dir > 0 ? 1.15 : 0.8)));
      if (this.dir > 0 && this.rise >= 1) { this.dir = 0; const f = this.then; this.then = null; f?.(); } else if (this.dir < 0 && this.rise <= 0) this.dir = 0;
    }
    const e = smooth(this.rise);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const drop = e * h * 0.62; // the land sinks out of the picture as the camera goes up
    c.globalAlpha = 1 - smooth((this.rise - 0.4) / 0.55);
    if (this.bg) {
      c.drawImage(this.bg, 0, drop, w, h);
      if (drop > 0) { // the sky above the sinking picture: the same deep blue it ends in, with no hard edge where they meet
        c.fillStyle = 'rgb(7,7,26)'; c.fillRect(0, 0, w, drop + 1);
        const g = c.createLinearGradient(0, drop, 0, drop + 60); g.addColorStop(0, 'rgba(7,7,26,1)'); g.addColorStop(1, 'rgba(7,7,26,0)');
        c.fillStyle = g; c.fillRect(0, drop, w, 60);
      }
    }
    c.globalAlpha = 1;
    const ta = Math.max(0, 1 - this.rise * 2.3);
    if (ta > 0) this.wordmark(w * L.title[0], h * L.title[1] + drop * 0.5, L.title[2] * u, L.title[3], ta, t);
    // Eko drifts where the last light is; rising, he climbs ahead of the camera
    const s = L.eko[2] * u, ex = w * L.eko[0] + Math.sin(t * 0.31) * 14 * u, ey = h * L.eko[1] + Math.sin(t * 0.72) * 9 * u - e * h * 0.34;
    const ea = 1 - smooth((this.rise - 0.62) / 0.35);
    if (ea > 0 && this.eko) {
      K.glow(c, ex, Math.min(h, h * L.horizon + drop + 30 * u), 260 * s, [255, 170, 100], 0.2 * (1 - e) * ea, 'screen');
      c.globalAlpha = ea; c.drawImage(this.eko, ex - 350 * s, ey - 330 * s, 700 * s, 760 * s); c.globalAlpha = 1;
    }
    if (this.rise === 0) {
      c.font = `italic 500 ${Math.max(17, 17 * u)}px ${SERIF}`; c.textAlign = L.hint[2]; c.textBaseline = 'alphabetic';
      c.shadowColor = 'rgba(8,6,24,0.7)'; c.shadowBlur = 8;
      c.fillStyle = `rgba(255,241,216,${0.55 + 0.25 * Math.sin(t * 1.6)})`; c.fillText('tap, and rise', w * L.hint[0], h * L.hint[1]); c.shadowBlur = 0;
    }
  }
}
