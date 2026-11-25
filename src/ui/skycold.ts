// The cold open: the Harmonic Nebula, before. The brothers on one orbit, in step, to Helion's theme (a twin orbit that
// cannot be failed: the game flies it as a memory). Then the Stillness: colour drains inward from the edge, the tune
// comes apart, and Orbin's taps still land, each a little lonelier. Then the picture closes in on the two of them:
// the dark takes Helion, Orbin reaches, their hands brush; the shockwave; white; black. The storyboard begins in that
// black. The owner's own words are written into the sky; the brothers speak only in the memories.
//
// Two pieces: the sky behind the orbit (a backdrop for the level's renderer), and the close of it, drawn over the
// level once the dark has come (the level is still running underneath: its sound is the scene's sound).
import { CANON } from '../art/canonpaint.js';
import { K } from '../art/painter.js';
import { Actor } from './actor';
import { NebulaScene, type Said, type SceneState } from './skyplanet';

const smooth = (x: number) => { const t = x < 0 ? 0 : x > 1 ? 1 : x; return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const P = CANON.parts;
/** seconds into the cold open's music (tools/pass2.py: bars of 3 s) */
export const COLD = { still: 27, dark: 37.5, close: 39, reach: 43.5, taken: 44.4, wave: 48, black: 49.2, end: 51 };
const INK = '#2c1206', SHADE = 'rgba(255,238,196,0.85)';
/** the owner's words, in the sky (dark ink on the gold) */
export const COLD_SAYS: Said[] = [
  { from: 0.8, to: 8.2, text: 'Long before the stars fell silent,', x: 0.5, y: 0.14, align: 'center', size: 21, color: INK, shade: SHADE },
  { from: 2.2, to: 8.2, text: 'the Harmonic Nebula spun', x: 0.5, y: 0.175, align: 'center', size: 21, color: INK, shade: SHADE },
  { from: 2.9, to: 8.2, text: 'to a single, golden pulse.', x: 0.5, y: 0.21, align: 'center', size: 21, color: INK, shade: SHADE },
  { from: 9.6, to: 17.5, text: 'Two twin sparks of starlight:', x: 0.5, y: 0.14, align: 'center', size: 21, color: INK, shade: SHADE },
  { from: 11.2, to: 17.5, text: 'Orbin and his brother Helion.', x: 0.5, y: 0.175, align: 'center', size: 21, color: INK, shade: SHADE },
  { from: 29.5, to: 37, text: 'Then came the Stillness.', x: 0.5, y: 0.14, align: 'center', size: 22, color: '#fff1d8' }
];

/** The nebula behind the orbit: all gold, until the Stillness comes in from the edge and the colour goes. */
export class ColdSky {
  private neb = new NebulaScene();
  says: Said[] = COLD_SAYS;
  prepare(): void { this.neb.prepare(); }
  draw(c: CanvasRenderingContext2D, w: number, h: number, st: SceneState): void {
    const t = st.song ?? 0, still = smooth((t - COLD.still) / (COLD.dark - COLD.still));
    this.neb.says = [];
    this.neb.draw(c, w, h, { ...st, kick: st.kick * (1 - still) });
    if (still > 0.002) {
      // the colour drains inward from the edge: what was gold is ash, then nothing
      const R = Math.hypot(w, h) * 0.6, r0 = R * (1.05 - 0.9 * still), g = c.createRadialGradient(w / 2, h * 0.52, Math.max(1, r0 * 0.55), w / 2, h * 0.52, Math.max(2, r0));
      g.addColorStop(0, `rgba(40,34,52,${0.5 * still})`); g.addColorStop(1, `rgba(8,7,18,${Math.min(0.97, 0.55 + 0.5 * still)})`);
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      // and it has a shape that is no shape: it comes in from the corners
      const r = K.RNG(91), u = Math.min(w, h) / 390;
      for (const [x, y, k] of [[1.02, 0.18, 1], [-0.04, 0.8, 0.8], [0.96, 0.9, 0.65]] as Array<[number, number, number]>) { const a = smooth((still - (1 - k) * 0.5) / 0.6); if (a > 0.01) P.stillness(c, w * lerp(x, 0.5 + (x - 0.5) * 0.7, a), h * y, (120 + 240 * a) * u, (90 + 200 * a) * u, r, { near: a }); }
    }
    // the words go over everything (the last line is written on the dark)
    writeSays(c, w, h, this.says, st.song);
  }
}
const SERIF = '"Cormorant Garamond", "Hoefler Text", Baskerville, Palatino, Georgia, serif';
function writeSays(c: CanvasRenderingContext2D, w: number, h: number, says: Said[], song: number | undefined): void {
  if (song === undefined) return;
  const u = w > h * 1.15 ? Math.min(w / 1440, h / 900) * 1.5 : Math.min(w / 390, h / 844);
  for (const l of says) {
    const a = smooth((song - l.from) / 0.9) * (1 - smooth((song - l.to + 1) / 1));
    if (a <= 0.004) continue;
    const px = Math.max(16, (l.size ?? 20) * u);
    c.save(); c.font = `italic 500 ${px}px ${SERIF}`; c.textAlign = l.align ?? 'center'; c.textBaseline = 'alphabetic';
    c.shadowColor = l.shade ?? 'rgba(6,5,18,0.95)'; c.shadowBlur = px * 0.55; c.globalAlpha = a * 0.96; c.fillStyle = l.color ?? '#fff1d8';
    c.fillText(l.text, w * l.x, h * l.y); c.fillText(l.text, w * l.x, h * l.y); c.restore();
  }
}

/** The close of the cold open, over the level: the two of them, the dark between, the reach, the shockwave. */
export class ColdClose {
  private ctx: CanvasRenderingContext2D;
  private orbin = new Actor('orbin');
  private helion = new Actor('helion');
  private set = false;
  /** the moment a tap landed in the reach (page clock), or -1 */
  private reached = -1;
  constructor(private canvas: HTMLCanvasElement) { this.ctx = canvas.getContext('2d')!; }
  reset(): void { this.set = false; this.reached = -1; }
  /** A tap while the two of them are close: the reach. */
  tap(now: number): void { if (this.reached < 0) this.reached = now; }

  /** t: seconds into the cold open's music. Draws nothing before the dark has closed. */
  draw(t: number, now: number, dt: number): void {
    if (t < COLD.dark) return;
    const c = this.ctx, w = window.innerWidth, h = window.innerHeight, dpr = this.canvas.width / Math.max(1, w), tall = h > w, u = tall ? Math.min(w / 390, h / 844) : Math.min(w / 1440, h / 900) * 1.9;
    const o = this.orbin, he = this.helion, cy = h * 0.5;
    if (!this.set) { this.set = true; o.set({ x: w * 0.3, y: cy + 20 * u, s: 0.62 * u, eyes: 'worried', arms: 'rest', crest: 0.8, glow: 0.9, face: 1, look: [1, 0] }, true); he.set({ x: w * 0.7, y: cy - 10 * u, s: 0.62 * u, eyes: 'worried', arms: 'rest', crest: 0.8, glow: 0.8, face: -1, look: [-1, 0] }, true); o.rate = he.rate = 2.6; }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.shadowBlur = 0;
    const cover = smooth((t - COLD.dark) / (COLD.close - COLD.dark));
    c.fillStyle = `rgba(7,6,16,${cover})`; c.fillRect(0, 0, w, h);
    if (t >= COLD.close - 0.6) {
      const a = smooth((t - (COLD.close - 0.6)) / 0.9), taken = smooth((t - COLD.taken) / (COLD.wave - COLD.taken - 0.4));
      // what little gold is left is round the two of them; the dark stands behind Helion and closes
      K.glow(c, w * 0.5, cy, Math.min(w, h) * 0.7, [255, 214, 140], 0.22 * a * (1 - taken), 'screen');
      const r = K.RNG(47), near = smooth((t - COLD.close) / 5);
      c.globalAlpha = a; P.stillness(c, w * lerp(1.1, 0.86, near), cy - 20 * u, (190 + 150 * near) * u, (260 + 160 * near) * u, r, { near: 0.5 + 0.5 * near }); c.globalAlpha = 1;
      // the reach: they come together until their hands brush; then he is drawn away into it, still reaching
      const close = smooth((t - 41.6) / (COLD.reach - 41.6)), gap = lerp(0.2, 0.062, close) * w * (tall ? 1 : 0.6);
      if (t < COLD.taken) {
        o.set({ x: w * 0.5 - gap, y: cy + 14 * u, arms: t > 41.2 ? 'reach' : 'rest', eyes: t > 41.2 ? 'wide' : 'worried', lean: 0.25 * close });
        he.set({ x: w * 0.5 + gap, y: cy - 6 * u, arms: t > 41.6 ? 'reach' : 'rest', eyes: 'worried', glow: 0.8 - 0.2 * near, lean: -0.2 * close });
      } else {
        o.set({ x: w * 0.5 - gap - 10 * u, arms: 'reach', eyes: 'wide', lean: 0.3 });
        he.set({ x: lerp(w * 0.5 + gap, w * 0.93, taken), y: cy - 6 * u - 30 * u * taken, s: lerp(0.62, 0.34, taken) * u, glow: lerp(0.6, 0.1, taken), arms: 'reach', eyes: 'wide', lean: -0.1 });
      }
      o.step(dt); he.step(dt);
      c.globalAlpha = a * (1 - 0.85 * taken); he.draw(c);
      c.globalAlpha = a; o.draw(c); c.globalAlpha = 1;
      // where their hands meet: one small light, brighter if the tap was there to meet it
      const brush = Math.exp(-Math.pow((t - COLD.reach - 0.25) / 0.5, 2)), tapped = this.reached >= 0 ? Math.exp(-(now - this.reached) / 500) : 0;
      if (brush > 0.02) { K.glow(c, w * 0.5, cy + 2 * u, (26 + 60 * tapped) * u, [255, 240, 200], 0.75 * brush + 0.25 * tapped); }
      // the dark closes over him
      if (taken > 0.01) { c.globalAlpha = taken; P.stillness(c, lerp(w * 0.86, w * 0.74, taken), cy - 20 * u, (300 + 200 * taken) * u, (380 + 200 * taken) * u, K.RNG(48), { near: 1 }); c.globalAlpha = 1; }
    }
    // the shockwave: one ring, white; then nothing at all
    if (t >= COLD.wave) {
      const s = t - COLD.wave, R = Math.hypot(w, h);
      c.strokeStyle = `rgba(255,250,236,${Math.max(0, 1 - s / 0.5)})`; c.lineWidth = 30 * u; c.beginPath(); c.arc(w * 0.74, cy, s * R * 2.4, 0, Math.PI * 2); c.stroke();
      c.fillStyle = `rgba(255,250,236,${smooth(s / 0.22) * (1 - smooth((s - 0.5) / (COLD.black - COLD.wave - 0.5)))})`; c.fillRect(0, 0, w, h);
      c.fillStyle = `rgba(4,4,10,${smooth((s - 0.5) / (COLD.black - COLD.wave - 0.5))})`; c.fillRect(0, 0, w, h);
    }
  }
}
