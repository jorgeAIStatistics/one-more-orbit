// The cold open, as a scene (the owner's brief of 2026-11-25): emotion, not gameplay. Calm, then wrongness, then the
// taking, then black and three plain lines; then the crash and the storyboard. About 46 seconds, on its own sound
// (tools/pass2.py, coldopen), its clock the sound's clock. The one interaction is a press-and-hold, "Reach for him",
// while the dark takes Helion: the ring fills as you hold, Orbin strains toward him, and however long you hold, his
// hand slips (at 35.5 s, where the music breaks).
import coldAudio from '../../levels/coldopen/audio.json';
import { audio, type LoadedTrack } from '../audio/audio';
import { CANON } from '../art/canonpaint.js';
import { COLDPAINT as C } from '../art/coldpaint.js';
import { K } from '../art/painter.js';
import type { AudioMeta } from '../game/types';
import { save } from '../save';

const META = coldAudio as AudioMeta;
const P = CANON.parts, TAU = Math.PI * 2;
const SERIF = '"Cormorant Garamond", "Hoefler Text", Baskerville, Palatino, Georgia, serif';
const sm = (x: number) => { const t = x < 0 ? 0 : x > 1 ? 1 : x; return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** when things happen, in seconds of the scene */
export const COLD_T = { wrong: 12, close: 16, dark: 22, taking: 24, reach: 27, slip: 35.5, wave: 38, black: 38.6, lines: [39.2, 40.8, 42.4], end: 46.4 };
/** the three lines (the owner approved the draft on 2026-11-25) */
export const COLD_LINES = [['Orbin and Helion were the twin sparks', 'of the Harmonic Nebula.'], ['The Stillness took Helion, and the music with him.'], ['Wake the fallen stars. Bring your brother home.']];

export class SkyCold {
  private ctx: CanvasRenderingContext2D;
  private key = ''; private w = 0; private h = 0; private dpr = 1;
  private gold: HTMLCanvasElement | null = null; private ash: HTMLCanvasElement | null = null;
  private track: LoadedTrack | null = null;
  private part: { stop: (fade?: number, at?: number) => void } | null = null;
  state: 'wait' | 'scene' | 'done' = 'wait';
  private touched = false; private touchAt = 0; private waitFrom = 0;
  private own = false; private perf0 = 0; private t0 = 0;
  /** the hold: is it down, and how full the ring is (0..1) */
  private down = false; private fill = 0; private last = 0; private slipped = false;
  onDone: (() => void) | null = null;
  /** a returning player may skip (one quiet word in the corner); a first launch cannot */
  canSkip = false;
  /** called once, the moment his hand slips (for the haptic) */
  onSlip: (() => void) | null = null;

  constructor(private canvas: HTMLCanvasElement) { this.ctx = canvas.getContext('2d')!; }

  start(canSkip: boolean): void {
    Object.assign(this, { state: 'wait', touched: false, touchAt: 0, waitFrom: 0, own: false, down: false, fill: 0, last: 0, slipped: false, canSkip });
    this.part?.stop(0.05); this.part = null;
    if (audio.prime()) void audio.loadTrack(META).then((t) => { this.track = t; }, () => undefined);
    this.layout();
  }
  stop(): void { this.part?.stop(0.3); this.part = null; this.state = 'done'; }

  private layout(): void {
    const w = window.innerWidth, h = window.innerHeight, key = `${w}x${h}`;
    this.dpr = this.canvas.width / Math.max(1, w);
    if (key === this.key) return;
    this.key = key; this.w = w; this.h = h;
    const paint = (ash: boolean) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; C.nebula(cv.getContext('2d')!, w, h, ash); return cv; };
    this.gold = paint(false); this.ash = paint(true);
  }

  /** seconds into the scene, as heard */
  time(now = performance.now()): number {
    if (this.state === 'wait') return -1;
    if (this.own || !audio.ctx) return (now - this.perf0) / 1000;
    return audio.ctxTimeAt(now) - this.t0 - audio.latency() - save.audioOffset / 1000;
  }
  private begin(now: number): void {
    this.state = 'scene';
    const c = audio.ctx;
    audio.setVolumes(save.music, save.sfx);
    if (!c || !audio.running || !this.track) { this.own = true; this.perf0 = now + 150; return; }
    this.t0 = c.currentTime + 0.15;
    this.part = audio.playPart(this.track, META, this.t0, 0, { dur: 46.2 });
  }
  /** For tests and stills: be at second `t` (its sound does not follow). */
  seek(t: number): void { this.part?.stop(0.05); this.part = null; this.state = 'scene'; this.own = true; this.perf0 = performance.now() - t * 1000; this.slipped = t > COLD_T.slip; }

  /** The finger: down and up. Before the scene starts a touch only wakes the sound. */
  press(down: boolean, x = -1, y = -1): void {
    if (this.state === 'done') return;
    if (down && this.canSkip && x > window.innerWidth - 96 && y >= 0 && y < 70) { this.finish(); return; }
    if (this.state === 'wait') { if (down) { this.touched = true; audio.ensure(); } return; }
    this.down = down;
  }
  private finish(): void { if (this.state === 'done') return; this.stop(); const f = this.onDone; f?.(); }

  private write(s: string, x: number, y: number, px: number, a: number, color = '#fff1d8'): void {
    if (a <= 0.004) return;
    const c = this.ctx;
    c.save(); c.font = `italic 500 ${px}px ${SERIF}`; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.shadowColor = 'rgba(6,5,18,0.9)'; c.shadowBlur = px * 0.5; c.globalAlpha = a; c.fillStyle = color; c.fillText(s, x, y); c.restore();
  }

  draw(now: number): void {
    this.layout();
    const c = this.ctx, { w, h } = this, u = Math.min(w / 390, h / 844), cx = w / 2, cy = h * 0.5;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.shadowBlur = 0;
    if (this.state === 'wait') {
      c.fillStyle = 'rgb(6,5,12)'; c.fillRect(0, 0, w, h);
      if (!this.waitFrom) this.waitFrom = now;
      if (this.touched && !this.touchAt) this.touchAt = now;
      const sound = !!audio.ctx && audio.running && !!this.track;
      if (sound || !audio.ctx || (this.touched && now - this.touchAt > 2000)) { this.begin(now); return; }
      if (!this.touched && now - this.waitFrom > 500) this.write('touch to begin', cx, h * 0.56, 20 * u, 0.45 + 0.25 * Math.sin(now / 520));
      return;
    }
    if (this.state === 'done') return;
    const t = this.time(now), dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0; this.last = now;
    const T = COLD_T;
    // the sky: gold, draining to ash from the wrong note on, then the dark comes over it
    const drain = sm((t - T.wrong) / 10), dark = sm((t - T.dark) / 4);
    if (this.gold) c.drawImage(this.gold, 0, 0, w, h);
    if (this.ash && drain > 0) { c.globalAlpha = drain; c.drawImage(this.ash, 0, 0, w, h); c.globalAlpha = 1; }
    if (dark > 0) { c.fillStyle = `rgba(9,8,18,${0.94 * dark})`; c.fillRect(0, 0, w, h); K.glow(c, cx, cy, Math.min(w, h) * 0.75, [255, 214, 140], 0.16 * dark, 'screen'); }
    // comets, humming past, in the calm only
    if (drain < 1) for (let i = 0; i < 5; i++) { const sp = 0.035 + i * 0.012, ph = (now / 1000 * sp + i * 0.37) % 1.5, x = (ph - 0.25) * w * 1.1, y = h * (0.1 + i * 0.07 + (i % 2) * 0.6) + x * 0.12; c.strokeStyle = `rgba(255,244,210,${0.45 * (1 - drain)})`; c.lineWidth = 1.6 * u; c.beginPath(); c.moveTo(x - 70 * u, y - 8 * u); c.lineTo(x, y); c.stroke(); K.glow(c, x, y, 6 * u, [255, 250, 232], 0.9 * (1 - drain)); }
    // the camera: wide in the calm, a close shot from the wrong note, wide again (darker) for the taking
    const close = sm((t - T.wrong - 0.6) / 3.4) * (1 - sm((t - T.taking + 2) / 3));
    const s = lerp(0.62, 1.05, close), ox = lerp(110, 150, close), oy = lerp(40, 150, close);
    // the Stillness: far and small in the corner from 13 s, near and huge from the right for the taking
    if (t > 13) {
      const far = sm((t - 13) / 8) * (1 - dark);
      if (far > 0.01) { c.globalAlpha = far; C.dread(c, w * 0.9, h * 0.1, (80 + 50 * far) * u, (60 + 40 * far) * u, 91, 0.3); if (t > 17) C.tendrils(c, w * 0.9, h * 0.12, w * 0.62, h * 0.24, u, 4, 7, sm((t - 17) / 5)); c.globalAlpha = 1; }
      if (dark > 0.01) { const near = sm((t - T.taking + 1) / 6); c.globalAlpha = dark; C.dread(c, lerp(w * 1.25, w * 1.02, near), cy - 60 * u, (200 + 100 * near) * u, (280 + 120 * near) * u, 48, 0.6 + 0.4 * near); c.globalAlpha = 1; }
    }
    // the brothers
    const holdK = this.fill, slip = sm((t - T.slip) / 1.1);
    const reachOn = t > T.reach - 1;
    const strain = reachOn ? holdK : 0;
    let ax = cx - ox * u, ay = cy + oy * u, bx = cx + ox * u, by = cy + (oy - 14) * u, hs = s, ha = 1;
    if (dark > 0) {
      // the taking: Helion drawn back into the dark (slowly, then all at once where his hand slips); Orbin straining after him
      const pull = sm((t - (T.taking + 3)) / 8) * 0.55 + 0.45 * slip;
      ax = lerp(ax, w * (0.3 + 0.06 * strain), dark); ay = lerp(ay, cy + 10 * u, dark);
      bx = lerp(bx, lerp(w * 0.6, w * 0.95, pull), dark); by = lerp(by, cy - 30 * u - 50 * u * slip, dark);
      hs = lerp(s, lerp(0.56, 0.3, pull), dark); ha = 1 - 0.85 * slip;
    }
    if (dark < 1) C.music(c, ax + 18 * u * s, ay - 32 * u * s, bx - 18 * u * s, by - 32 * u * s, u * (0.9 + 0.5 * close), t, sm((t - T.wrong - 0.4) / 1.2), (1 - 0.6 * drain) * (1 - dark));
    const worried = t > T.wrong + 1.5;
    c.globalAlpha = ha;
    P.spark(c, bx, by, hs * u, { who: 'helion', eyes: t > T.wrong + 1 ? 'wide' : 'soft', arms: dark > 0.3 ? 'reach' : 'up', glow: lerp(1, 0.4, dark), face: dark > 0.3 ? -1 : -1, look: worried ? [1, -0.6] : [0, 0], crest: lerp(1, 0.5, dark), ring: true, beat: 1, lean: dark > 0.3 ? -0.15 : 0 });
    c.globalAlpha = 1;
    if (dark > 0.01 && t > T.reach - 2) C.tendrils(c, w * 1.0, cy - 80 * u, bx, by - 10 * u, u, 7, 13, sm((t - (T.reach - 2)) / 5));
    P.spark(c, ax, ay, lerp(s, 0.64, dark) * u, { who: 'orbin', eyes: worried ? (dark > 0.3 ? 'wide' : 'worried') : 'soft', arms: dark > 0.3 ? 'reach' : 'up', glow: 1, face: 1, look: worried && dark < 0.3 ? [0.6, -0.8] : [1, 0], crest: 1, ring: true, beat: 1, lean: 0.35 * dark + 0.15 * strain });
    // where their hands nearly meet
    if (dark > 0.3 && t < T.slip + 0.6) K.glow(c, (ax + bx) / 2, (ay + by) / 2, (18 + 22 * holdK) * u, [255, 240, 200], (0.35 + 0.45 * holdK) * (1 - slip));
    // the one interaction: hold to reach. The ring fills while held and ebbs when let go; it breaks where his hand slips
    if (t > T.reach && t < T.slip + 1.4) {
      if (t < T.slip) this.fill = Math.max(0, Math.min(0.92, this.fill + (this.down ? dt / 6 : -dt / 2.5)));
      else if (!this.slipped) { this.slipped = true; this.onSlip?.(); }
      const a = sm((t - T.reach) / 0.8) * (1 - sm((t - T.slip) / 1.2)), hx = cx, hy = h * 0.84;
      c.globalAlpha = a;
      c.strokeStyle = 'rgba(255,204,72,0.25)'; c.lineWidth = 3 * u; c.beginPath(); c.arc(hx, hy, 30 * u, 0, TAU); c.stroke();
      c.strokeStyle = 'rgba(255,204,72,0.95)'; c.lineWidth = 3.4 * u; c.beginPath(); c.arc(hx, hy, 30 * u, -Math.PI / 2, -Math.PI / 2 + TAU * this.fill * (1 - slip)); c.stroke();
      if (this.down && t < T.slip) K.glow(c, hx, hy, 14 * u, [255, 220, 150], 0.8);
      c.globalAlpha = 1;
      this.write('Reach for him', hx, hy + 62 * u, 22 * u, a, '#ffe6b8');
      this.write('hold', hx, hy + 86 * u, 15 * u, a * 0.7);
    }
    // the shockwave, white; then black, and the three lines
    if (t >= T.wave - 0.1) {
      const k = t - T.wave, R = Math.hypot(w, h);
      c.strokeStyle = `rgba(255,250,236,${Math.max(0, 1 - k / 0.5)})`; c.lineWidth = 30 * u; c.beginPath(); c.arc(w * 0.74, cy, Math.max(1, k * R * 2.4), 0, TAU); c.stroke();
      c.fillStyle = `rgba(255,250,236,${sm(k / 0.22) * (1 - sm((k - 0.5) / 0.6))})`; c.fillRect(0, 0, w, h);
      c.fillStyle = `rgba(4,4,10,${sm((k - 0.45) / 0.6)})`; c.fillRect(0, 0, w, h);
      const out = 1 - sm((t - (T.end - 1)) / 0.9);
      T.lines.forEach((at, i) => {
        const a = sm((t - at) / 1.0) * out, L = COLD_LINES[i], y0 = h * [0.42, 0.53, 0.63][i];
        L.forEach((line, j) => this.write(line, cx, y0 + j * 30 * u, (i === 1 ? 19 : 21) * u, a, i === 2 ? '#ffe6b8' : '#fff1d8'));
      });
    }
    if (this.canSkip && t < T.black) this.write('skip', w - 44, 64, 16, 0.55);
    if (t >= T.end) this.finish();
  }
}
