// A planet's own sky behind its level (Afterglow). The same painting as its results: its land along the bottom, its
// sky above, in night until its song comes back; from the drop the colour is home and the whole picture warms. The
// planet's soul lives in it: Ossa of Emberwick lies banked and dark on the hills, wakes on the drop's big press, and
// in the climax strikes with every wall that breaks. The air round the course is kept dark, so the rings and the
// white marks are always the clearest things on the screen. Painted once per screen size; three or four pictures laid
// over each other per frame, so it costs next to nothing while playing.
import { K } from '../art/painter.js';
import { RESULTS } from '../art/resultpaint.js';
import { WORLD1 } from '../art/world1paint.js';

const Y = RESULTS.LAYERS;
type Dev = 'phone' | 'desktop';
const smooth = (x: number) => { const t = x < 0 ? 0 : x > 1 ? 1 : x; return t * t * (3 - 2 * t); };
export interface SceneState {
  /** seconds, for anything that breathes */
  time: number;
  /** how much of the planet's colour is home right now, 0..1 */
  colour: number;
  /** how hard the drop is going, 0..1, and the kick under it */
  drive: number; kick: number;
  /** seconds since the drop's big press landed; below 0 before it */
  woke: number;
  /** 1 at the instant a wall breaks, falling away after */
  strike: number;
  /** the night side: the lights are down */
  dark: number;
  calm: boolean;
}
/** Who lives on each planet, and how they are painted lying banked and standing awake. */
const SOULS: Record<string, { paint: (c: CanvasRenderingContext2D, x: number, y: number, s: number, lit: number, pose: 'lie' | 'stand') => void; glow: [number, number, number] }> = {
  heroes: { paint: (c, x, y, s, lit, pose) => WORLD1.parts.ossa(c, x, y, s, lit, K.RNG(53), pose), glow: [255, 150, 80] }
};

const soulGlow = (world: string): [number, number, number] => SOULS[world]?.glow ?? [255, 170, 110];

export class PlanetScene {
  private key = '';
  private cold: HTMLCanvasElement | null = null;
  private warm: HTMLCanvasElement | null = null;
  private blaze: HTMLCanvasElement | null = null;
  private asleep: HTMLCanvasElement | null = null;
  private awake: HTMLCanvasElement | null = null;
  private at: [number, number, number] = [0, 0, 1];
  private horizon = 0.76;

  /** world: whose sky (a level id that has a painted world: heroes, skyhigh, blank, invincible, royalty). */
  constructor(readonly world: string) {}
  static has(world: string): boolean { return Y.has(world); }

  /** Paints what this screen size needs (once). Call it ahead of the level so the first frame is not held up. */
  prepare(): void {
    const w = window.innerWidth, h = window.innerHeight, key = `${w}x${h}`;
    if (key === this.key) return;
    this.key = key;
    const dev: Dev = w > h * 1.15 ? 'desktop' : 'phone', u = dev === 'phone' ? Math.min(w / 390, h / 844) : Math.min(w / 1440, h / 900) * 1.15;
    const layer = (mode: 'cold' | 'warm' | 'blaze') => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; Y.scene(cv.getContext('2d')!, w, h, this.world, dev, u, mode); return cv; };
    this.cold = layer('cold'); this.warm = layer('warm'); this.blaze = layer('blaze');
    this.horizon = Y.lay(dev).horizon;
    const soul = SOULS[this.world];
    if (soul) {
      // the soul stands on the land, low and to one side, clear of the course
      const s = (dev === 'phone' ? 0.58 : 0.82) * u, x = dev === 'phone' ? w * 0.2 : w * 0.13, y = h * (Y.lay(dev).horizon + (dev === 'phone' ? 0.115 : 0.13));
      this.at = [x, y, s];
      const sprite = (lit: number, pose: 'lie' | 'stand') => { const cv = document.createElement('canvas'), q = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.ceil(520 * s * q); cv.height = Math.ceil(460 * s * q); const c = cv.getContext('2d')!; c.scale(q, q); soul.paint(c, 260 * s, 400 * s, s, lit, pose); return cv; };
      this.asleep = sprite(0.06, 'lie'); this.awake = sprite(1, 'stand');
    } else this.asleep = this.awake = null;
  }

  draw(c: CanvasRenderingContext2D, w: number, h: number, st: SceneState): void {
    this.prepare();
    if (!this.cold || !this.warm) return;
    const k = smooth(Math.min(1, st.colour * 1.3));
    c.drawImage(this.cold, 0, 0, w, h);
    if (k > 0.003) { c.globalAlpha = k; c.drawImage(this.warm, 0, 0, w, h); c.globalAlpha = 1; }
    // the drop breathes: the warm light swells a little on every kick
    // in a drop that was earned the sky is ablaze, and it swells a little on every kick
    // (how far depends on how the drop was earned: its charge and the flow it is played in)
    if (this.blaze && st.woke >= 0) { c.globalAlpha = Math.min(0.92, smooth(st.woke / 0.7) * (0.42 + 0.46 * st.drive + (st.calm ? 0 : 0.1 * st.kick))); c.drawImage(this.blaze, 0, 0, w, h); c.globalAlpha = 1; }
    // and the light of it comes up off the land into the whole sky
    if (st.woke >= 0) { const up = smooth(st.woke / 0.9) * (0.6 + 0.4 * st.drive); K.glow(c, w * 0.5, h * this.horizon, Math.max(w, h) * 0.95, soulGlow(this.world), 0.34 * up, 'screen'); K.glow(c, w * 0.5, h * this.horizon, Math.max(w, h) * 0.5, [255, 214, 150], 0.22 * up * (st.calm ? 1 : 0.8 + 0.4 * st.kick), 'screen'); }
    // the soul: banked and dark until the drop's big press, then awake, its fire up
    const [x, y, s] = this.at, soul = SOULS[this.world];
    if (soul && this.asleep && this.awake) {
      const up = st.woke >= 0 ? smooth(st.woke / 0.5) : 0, bw = 520 * s, bh = 460 * s;
      if (up < 1) { c.globalAlpha = 1 - up; c.drawImage(this.asleep, x - 260 * s, y - 400 * s, bw, bh); c.globalAlpha = 1; }
      if (up > 0) {
        const flare = st.strike * (st.calm ? 0.3 : 1), rise = (1 - up) * 14 * s;
        K.glow(c, x + 20 * s, y - 90 * s, (210 + 90 * flare) * s, soul.glow, (0.34 + 0.14 * st.kick * st.drive + 0.3 * flare) * up, 'screen');
        c.globalAlpha = up; c.drawImage(this.awake, x - 260 * s, y - 400 * s + rise, bw, bh); c.globalAlpha = 1;
        // it strikes as each wall breaks: its forks ring
        if (flare > 0.02) { c.save(); c.globalCompositeOperation = 'screen'; for (let n = 0; n < 3; n++) { c.strokeStyle = K.rgba([255, 226, 170], 0.5 * flare * (1 - n * 0.28)); c.lineWidth = 1.6 * Math.max(1, s * 2); c.beginPath(); c.arc(x + 136 * s, y - 168 * s, (18 + n * 16 + (1 - flare) * 30) * s, -2.5, -0.5); c.stroke(); } c.restore(); }
      }
    }
    // the air round the course is kept dark: the rings and the white marks stay the clearest things there are
    // (only the ring of air the course is in: the sky above it and the land below keep their colour)
    const cx = w / 2, cy = h * 0.52, span = Math.min(w, h) * 0.56, g = c.createRadialGradient(cx, cy, span * 0.1, cx, cy, span);
    g.addColorStop(0, `rgba(12,8,26,${0.42 + 0.1 * k})`); g.addColorStop(0.74, `rgba(12,8,26,${0.42 + 0.16 * k})`); g.addColorStop(1, 'rgba(12,8,26,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    if (st.dark > 0.01) { c.fillStyle = `rgba(6,5,18,${st.dark * 0.6})`; c.fillRect(0, 0, w, h); }
  }
}
