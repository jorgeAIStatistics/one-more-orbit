// A world's own sky behind its level (Afterglow). The same painting as its results: its land along the bottom, its
// sky above, in night until its star is reignited; from the drop the colour is back and the whole picture warms. The
// one who lives there is in it, stopped mid-note by the Stillness: Ossa of Emberwick stands dark on the hills, reared,
// its antlers raised over a strike that never landed. On the drop's great node the strike lands: Ossa wakes, and in
// the climax strikes with every wall that breaks. The air round the course is kept dark, so the rings and the
// white marks are always the clearest things on the screen. Painted once per screen size; three or four pictures laid
// over each other per frame, so it costs next to nothing while playing.
import { CANON } from '../art/canonpaint.js';
import { DUSK, K } from '../art/painter.js';
import { RESULTS } from '../art/resultpaint.js';
import { WORLD1 } from '../art/world1paint.js';

const Y = RESULTS.LAYERS;
type Dev = 'phone' | 'desktop';
const smooth = (x: number) => { const t = x < 0 ? 0 : x > 1 ? 1 : x; return t * t * (3 - 2 * t); };
export interface SceneState {
  /** seconds, for anything that breathes */
  time: number;
  /** where the song is, in seconds (what is written into the sky goes by this) */
  song?: number;
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
  /** the camera (the journey levels): its centre in the world, in pixels, and one ring's radius; skies move with it a
   * little (far things least: parallax) */
  cam?: [number, number, number];
}
/** Who lives on each planet, and how they are painted lying banked and standing awake. */
const SOULS: Record<string, { paint: (c: CanvasRenderingContext2D, x: number, y: number, s: number, lit: number, pose: 'lie' | 'stand') => void; glow: [number, number, number] }> = {
  heroes: { paint: (c, x, y, s, lit, pose) => WORLD1.parts.ossa(c, x, y, s, lit, K.RNG(53), pose), glow: [255, 150, 80] }
};

/** A line written into the picture for a stretch of the song. */
export interface Said { from: number; to: number; text: string; /** 0..1 across and down the screen */ x: number; y: number; align?: CanvasTextAlign; size?: number; color?: string; /** what is laid under the letters so they read (dark by default; light for dark words on a bright sky) */ shade?: string }
const SERIF = '"Cormorant Garamond", "Hoefler Text", Baskerville, Palatino, Georgia, serif';
function write(c: CanvasRenderingContext2D, w: number, h: number, u: number, says: Said[], song: number | undefined): void {
  if (song === undefined) return;
  for (const l of says) {
    const a = smooth((song - l.from) / 0.7) * (1 - smooth((song - l.to + 0.9) / 0.9));
    if (a <= 0.004) continue;
    const px = Math.max(15, (l.size ?? 19) * u);
    c.save(); c.font = `italic 500 ${px}px ${SERIF}`; c.textAlign = l.align ?? 'left'; c.textBaseline = 'alphabetic';
    c.shadowColor = l.shade ?? 'rgba(6,5,18,0.95)'; c.shadowBlur = px * 0.55; c.globalAlpha = a * 0.95; c.fillStyle = l.color ?? '#fff1d8';
    c.fillText(l.text, w * l.x, h * l.y); c.fillText(l.text, w * l.x, h * l.y); c.restore();
  }
}

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
  private u = 1;
  /** what is written into this sky, and when (the game sets it: a first visit says more than a tenth) */
  says: Said[] = [];

  /** world: whose sky (a level id that has a painted world: heroes, skyhigh, blank, invincible, royalty). */
  constructor(readonly world: string) {}
  static has(world: string): boolean { return Y.has(world); }

  /** Paints what this screen size needs (once). Call it ahead of the level so the first frame is not held up. */
  prepare(): void {
    const w = window.innerWidth, h = window.innerHeight, key = `${w}x${h}`;
    if (key === this.key) return;
    this.key = key;
    const dev: Dev = w > h * 1.15 ? 'desktop' : 'phone', u = (this.u = dev === 'phone' ? Math.min(w / 390, h / 844) : Math.min(w / 1440, h / 900) * 1.15);
    const layer = (mode: 'cold' | 'warm' | 'blaze') => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; Y.scene(cv.getContext('2d')!, w, h, this.world, dev, u, mode); return cv; };
    this.cold = layer('cold'); this.warm = layer('warm'); this.blaze = layer('blaze');
    this.horizon = Y.lay(dev).horizon;
    const soul = SOULS[this.world];
    if (soul) {
      // the soul stands on the land, low and to one side, clear of the course
      const s = (dev === 'phone' ? 0.58 : 0.82) * u, x = dev === 'phone' ? w * 0.2 : w * 0.13, y = h * (Y.lay(dev).horizon + (dev === 'phone' ? 0.115 : 0.13));
      this.at = [x, y, s];
      const sprite = (lit: number, pose: 'lie' | 'stand') => { const cv = document.createElement('canvas'), q = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.ceil(520 * s * q); cv.height = Math.ceil(460 * s * q); const c = cv.getContext('2d')!; c.scale(q, q); soul.paint(c, 260 * s, 400 * s, s, lit, pose); return cv; };
      this.asleep = sprite(0.05, 'stand'); this.awake = sprite(1, 'stand'); // (the same stance, dark and lit: it was stopped mid-strike, standing)
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
      // stopped mid-strike: reared back on its hind legs, antlers raised. When its star is reignited the strike lands
      // at last (down, a little past level, and back), and its fire comes up.
      const up = st.woke >= 0 ? smooth(st.woke / 0.16) : 0, bw = 520 * s, bh = 460 * s;
      const rear = st.woke < 0 ? -0.26 : st.woke < 0.16 ? -0.26 + 0.34 * smooth(st.woke / 0.16) : 0.08 * (1 - smooth((st.woke - 0.16) / 0.5));
      const put = (img: HTMLCanvasElement, a: number, dy = 0): void => { c.save(); c.globalAlpha = a; c.translate(x - 96 * s, y - 6 * s); c.rotate(rear); c.drawImage(img, -164 * s, -394 * s + dy, bw, bh); c.restore(); };
      if (up < 1) put(this.asleep, 1 - up);
      if (up > 0) {
        const flare = Math.max(st.strike, st.woke < 0.5 ? 1 - st.woke / 0.5 : 0) * (st.calm ? 0.3 : 1);
        K.glow(c, x + 20 * s, y - 90 * s, (210 + 90 * flare) * s, soul.glow, (0.34 + 0.14 * st.kick * st.drive + 0.3 * flare) * up, 'screen');
        put(this.awake, up);
        // it strikes as each wall breaks: its forks ring
        if (flare > 0.02) { c.save(); c.globalCompositeOperation = 'screen'; for (let n = 0; n < 3; n++) { c.strokeStyle = K.rgba([255, 226, 170], 0.5 * flare * (1 - n * 0.28)); c.lineWidth = 1.6 * Math.max(1, s * 2); c.beginPath(); c.arc(x + 136 * s, y - 168 * s, (18 + n * 16 + (1 - flare) * 30) * s, -2.5, -0.5); c.stroke(); } c.restore(); }
      }
    }
    // the air round the course is kept dark: the rings and the white marks stay the clearest things there are
    // (only the ring of air the course is in: the sky above it and the land below keep their colour)
    // (it falls off slowly, like dusk round the course, never as a disc with an edge)
    const cx = w / 2, cy = h * 0.52, span = Math.min(w, h) * 0.74, g = c.createRadialGradient(cx, cy, 0, cx, cy, span), va = 0.4 + 0.12 * k;
    g.addColorStop(0, `rgba(12,8,26,${va})`); g.addColorStop(0.4, `rgba(12,8,26,${va})`); g.addColorStop(0.62, `rgba(12,8,26,${va * 0.62})`); g.addColorStop(0.82, `rgba(12,8,26,${va * 0.22})`); g.addColorStop(1, 'rgba(12,8,26,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    if (st.dark > 0.01) { c.fillStyle = `rgba(6,5,18,${st.dark * 0.6})`; c.fillRect(0, 0, w, h); }
    write(c, w, h, this.u, this.says, st.song);
  }
}

/**
 * The Harmonic Nebula, remembered: all gold, turning to one pulse, comets humming past. The sky of a memory of
 * Helion. Painted once; the comets and the words are live.
 */
export class NebulaScene {
  private key = '';
  private sky: HTMLCanvasElement | null = null;
  private u = 1;
  says: Said[] = [];

  prepare(): void {
    const w = window.innerWidth, h = window.innerHeight, key = `${w}x${h}`;
    if (key === this.key) return;
    this.key = key;
    this.u = w > h * 1.15 ? Math.min(w / 1440, h / 900) * 1.15 : Math.min(w / 390, h / 844);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d')!, r = K.RNG(63);
    DUSK.tools.sky(c, w, h, CANON.pal.NEBULA, r, 110);
    // the turning of it: long soft arcs of light round the middle of the picture
    c.save(); c.globalCompositeOperation = 'screen'; c.lineCap = 'round';
    for (let i = 0; i < 9; i++) { const rr = Math.min(w, h) * (0.5 + i * 0.13), a0 = r() * 6.28; c.strokeStyle = K.rgba([255, 236, 180], 0.05 + r() * 0.05); c.lineWidth = 10 + r() * 30; c.beginPath(); c.ellipse(w / 2, h * 0.52, rr, rr * 0.84, 0.2, a0, a0 + 1.2 + r() * 2.2); c.stroke(); }
    c.restore();
    K.glow(c, w / 2, h * 0.52, Math.max(w, h) * 0.7, [255, 226, 150], 0.35, 'screen');
    DUSK.tools.finish(c, w, h, 71, 0.25);
    this.sky = cv;
  }

  draw(c: CanvasRenderingContext2D, w: number, h: number, st: SceneState): void {
    this.prepare();
    if (this.sky) c.drawImage(this.sky, 0, 0, w, h);
    const u = this.u;
    // the one golden pulse the whole nebula keeps
    K.glow(c, w / 2, h * 0.52, Math.min(w, h) * (0.6 + 0.08 * st.kick), [255, 230, 160], 0.16 + 0.1 * st.kick, 'screen');
    // comets, humming past: slow, far, each on its own line
    c.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const sp = 0.035 + i * 0.012, ph = (st.time * sp + i * 0.37) % 1.5, x = (ph - 0.25) * w * 1.1, y = h * (0.1 + i * 0.07 + (i % 2) * 0.6) + x * 0.12, len = (60 + i * 16) * u;
      const g = c.createLinearGradient(x - len, y - len * 0.12, x, y); g.addColorStop(0, 'rgba(255,244,210,0)'); g.addColorStop(1, 'rgba(255,244,210,0.6)');
      c.strokeStyle = g; c.lineWidth = (1.6 + (i % 3) * 0.6) * u; c.beginPath(); c.moveTo(x - len, y - len * 0.12); c.lineTo(x, y); c.stroke();
      c.fillStyle = 'rgba(255,250,232,0.9)'; c.beginPath(); c.arc(x, y, (1.8 + (i % 3) * 0.5) * u, 0, Math.PI * 2); c.fill();
    }
    // the air round the orbit a little deeper, so the path and its Star-Nodes read against all that gold
    // (falling off slowly, never a disc with an edge)
    const cx = w / 2, cy = h * 0.52, span = Math.min(w, h) * 0.76, g = c.createRadialGradient(cx, cy, 0, cx, cy, span);
    g.addColorStop(0, 'rgba(60,26,14,0.42)'); g.addColorStop(0.4, 'rgba(60,26,14,0.42)'); g.addColorStop(0.62, 'rgba(60,26,14,0.26)'); g.addColorStop(0.82, 'rgba(60,26,14,0.09)'); g.addColorStop(1, 'rgba(60,26,14,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    write(c, w, h, u, this.says, st.song);
  }
}
export { write as writeSays };
