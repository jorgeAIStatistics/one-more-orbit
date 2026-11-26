// The memories of Helion, as short films (the owner's brief of 2026-11-25): no tapping. After a world's first clear,
// Orbin rests by the fire, the camera drifts into the flames, and the fire's light becomes the memory: a chapter of the
// brothers' story, a page each star unlocks. Their words are faint text in the scene, never bubbles. It dissolves back
// into the fire's light at the end. The chapters and their lines are the canon's (approved 2026-11-24):
//   heroes      Emberwick, the joy of it          "Keep up, little brother." / "We're the same age." / "By a heartbeat. I counted."
//   skyhigh     Cirra, their bond                 "What if I lose the beat?" / "Then listen for mine."
//   blank       Glassmere, the Stillness arriving "Do you hear that?" / "I don't hear anything." / "…That's what I mean."
//   invincible  Verdance, the dark closing        "Stay on my side of the beat." / "I'm here. I'm right here."
// The sound: tools/pass2.py memfilms, one part per chapter (levels/memfilm).
//
// Storyboard (panel: time, camera, effects, sound), the same frame for every chapter:
//   1  0-1.4    the fire's light fills the screen and opens onto the gold of the Harmonic Nebula   camera: still, a slow push   sound: the fire under, the music box enters
//   2  1.4-17   the chapter (below)                                                               camera: a slow drift and push, depth in three layers (far gold, the brothers, near motes out of focus)
//   3  17-20    the last line; the gold warms back into firelight                                 camera: settles       sound: the theme resolves, the fire returns
import memAudio from '../../levels/memfilm/audio.json';
import { audio, type LoadedTrack } from '../audio/audio';
import { CANON } from '../art/canonpaint.js';
import { COLDPAINT as C } from '../art/coldpaint.js';
import { K } from '../art/painter.js';
import type { AudioMeta } from '../game/types';
import { save } from '../save';

const META = memAudio as AudioMeta;
const P = CANON.parts, TAU = Math.PI * 2;
const SERIF = '"Cormorant Garamond", "Hoefler Text", Baskerville, Palatino, Georgia, serif';
const sm = (x: number) => { const t = x < 0 ? 0 : x > 1 ? 1 : x; return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const MEMORY_LEN = 20;
const PART = 22; // (seconds between chapters in the sound file)

type Line = { at: number; to: number; who: 'orbin' | 'helion'; text: string };
interface Chapter { index: number; title: string; lines: Line[] }
export const CHAPTERS: Record<string, Chapter> = {
  heroes: { index: 0, title: 'The joy of it', lines: [
    { at: 3.6, to: 8.8, who: 'helion', text: 'Keep up, little brother.' },
    { at: 9.4, to: 13.6, who: 'orbin', text: 'We’re the same age.' },
    { at: 14.6, to: 18.8, who: 'helion', text: 'By a heartbeat. I counted.' }] },
  skyhigh: { index: 1, title: 'Their bond', lines: [
    { at: 6.0, to: 10.6, who: 'orbin', text: 'What if I lose the beat?' },
    { at: 11.6, to: 17.0, who: 'helion', text: 'Then listen for mine.' }] },
  blank: { index: 2, title: 'The Stillness arriving', lines: [
    { at: 10.6, to: 13.6, who: 'helion', text: 'Do you hear that?' },
    { at: 13.9, to: 16.4, who: 'orbin', text: 'I don’t hear anything.' },
    { at: 16.8, to: 19.6, who: 'helion', text: '…That’s what I mean.' }] },
  invincible: { index: 3, title: 'The dark closing', lines: [
    { at: 5.2, to: 10.2, who: 'helion', text: 'Stay on my side of the beat.' },
    { at: 11.2, to: 16.8, who: 'orbin', text: 'I’m here. I’m right here.' }] }
};

export class SkyMemory {
  private ctx: CanvasRenderingContext2D;
  private key = ''; private w = 0; private h = 0; private dpr = 1;
  private gold: HTMLCanvasElement | null = null;
  private track: LoadedTrack | null = null;
  private part: { stop: (fade?: number, at?: number) => void } | null = null;
  private ch: Chapter | null = null; private world = '';
  private t0 = -1; private own = false; private perf0 = 0; private skipAt = -1;
  private trail: Array<{ o: [number, number]; h: [number, number] }> = [];
  onDone: (() => void) | null = null;
  constructor(private canvas: HTMLCanvasElement) { this.ctx = canvas.getContext('2d')!; if (audio.prime()) void audio.loadTrack(META).then((t) => { this.track = t; }, () => undefined); }

  static has(world: string): boolean { return !!CHAPTERS[world]; }
  get on(): boolean { return !!this.ch; }

  play(world: string, then: () => void): void {
    this.ch = CHAPTERS[world] ?? null; this.world = world; this.onDone = then; this.trail = []; this.skipAt = -1;
    if (!this.ch) { then(); return; }
    this.layout();
    const c = audio.ctx;
    if (c && audio.running && this.track) { this.own = false; this.t0 = c.currentTime + 0.1; this.part = audio.playPart(this.track, META, this.t0, this.ch.index * PART, { dur: MEMORY_LEN + 0.5, gain: 0.95 }); }
    else { this.own = true; this.perf0 = performance.now(); }
  }
  /** A tap: the memory lets go early (its last second and a half still dissolve into the fire). */
  tap(): void { if (this.ch && this.skipAt < 0) { this.skipAt = this.time(); this.part?.stop(1.2); } }
  stop(): void { this.part?.stop(0.4); this.part = null; this.ch = null; }
  /** For stills and tests: be at second t. */
  seek(world: string, t: number): void { this.ch = CHAPTERS[world] ?? null; this.world = world; this.own = true; this.perf0 = performance.now() - t * 1000; this.skipAt = -1; this.trail = []; this.layout(); }

  private time(now = performance.now()): number {
    if (this.own || !audio.ctx) return (now - this.perf0) / 1000;
    return audio.ctxTimeAt(now) - this.t0 - audio.latency() - save.audioOffset / 1000;
  }
  private layout(): void {
    const w = window.innerWidth, h = window.innerHeight, key = `${w}x${h}`;
    this.dpr = this.canvas.width / Math.max(1, w);
    if (key === this.key) return;
    this.key = key; this.w = w; this.h = h;
    const cv = document.createElement('canvas'); cv.width = Math.round(w * 1.2); cv.height = Math.round(h * 1.2); C.nebula(cv.getContext('2d')!, cv.width, cv.height, false); this.gold = cv;
  }
  private words(s: string, x: number, y: number, px: number, a: number, warm: boolean): void {
    if (a <= 0.004) return;
    const c = this.ctx; c.save(); c.font = `italic 500 ${px}px ${SERIF}`; c.textAlign = 'center';
    c.shadowColor = 'rgba(40,20,6,0.55)'; c.shadowBlur = px * 0.6; c.globalAlpha = a * 0.82; c.fillStyle = warm ? '#fff0d4' : '#f4f6ff';
    c.fillText(s, x, y); c.restore();
  }

  draw(now: number): void {
    const ch = this.ch; if (!ch) return;
    this.layout();
    const c = this.ctx, { w, h } = this, u = Math.min(w / 390, h / 844), cx = w / 2, cy = h * 0.5;
    let t = this.time(now);
    if (this.skipAt >= 0) t = Math.max(t, MEMORY_LEN - 1.5 + (t - this.skipAt)); // (tapped: straight to its last second and a half)
    const T = Math.max(0, t);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.shadowBlur = 0;
    // the camera: a slow push and drift; the far gold moves least (depth)
    const push = 1 + 0.06 * sm(T / MEMORY_LEN), dx = Math.sin(T * 0.21) * w * 0.02, dy = Math.cos(T * 0.17) * h * 0.012;
    const dark = ch.index === 3 ? sm((T - 1) / 12) : 0; // (Verdance: half the orbit goes)
    if (this.gold) { c.save(); c.translate(cx + dx * 0.4, cy + dy * 0.4); c.scale(push * 1.02, push * 1.02); c.translate(-cx, -cy); c.drawImage(this.gold, -w * 0.1, -h * 0.1, w * 1.2, h * 1.2); c.restore(); }
    if (ch.index >= 2) { c.fillStyle = `rgba(30,24,40,${ch.index === 2 ? 0.1 + 0.18 * sm((T - 9) / 6) : 0.28})`; c.fillRect(0, 0, w, h); }
    // a constellation at the edge of the gold (Glassmere: it goes out, star by star)
    if (ch.index === 2) {
      const pts = [[0.78, 0.12], [0.86, 0.17], [0.9, 0.26], [0.82, 0.3], [0.74, 0.24]];
      c.strokeStyle = 'rgba(255,240,210,0.25)'; c.lineWidth = 1; c.beginPath(); pts.forEach(([x, y], i) => { const gone = sm((T - 8.6 - i * 0.45) / 0.35); if (gone < 1) (i ? c.lineTo(w * x + dx, h * y + dy) : c.moveTo(w * x + dx, h * y + dy)); }); c.stroke();
      pts.forEach(([x, y], i) => { const gone = sm((T - 8.6 - i * 0.45) / 0.35); K.glow(c, w * x + dx, h * y + dy, 12 * u * (1 - gone * 0.8), [255, 240, 210], 0.8 * (1 - gone)); if (gone > 0) { c.strokeStyle = `rgba(30,24,40,${0.6 * gone})`; c.lineWidth = 2 * u; c.beginPath(); c.arc(w * x + dx, h * y + dy, 5 * u, 0, TAU); c.stroke(); } });
    }
    // the dark closing (Verdance): the Stillness takes the right of the frame, slowly, and keeps it
    if (dark > 0) { c.save(); c.globalAlpha = dark; C.dread(c, w * (1.35 - 0.4 * dark), cy, 340 * u, 520 * u, 48, 0.8); c.restore(); }
    // the brothers' paths: each chapter its own dance
    const pos = (who: 0 | 1): [number, number] => {
      const s = T;
      if (ch.index === 0) { // joy: wide chasing loops, Helion ahead
        const a = s * 0.55 + (who ? 0.55 : 0), r = Math.min(w, h) * 0.3;
        return [cx + Math.sin(a) * r * 1.1 + dx, cy + Math.sin(a * 2) * r * 0.45 + dy];
      }
      if (ch.index === 1) { // bond: side by side; Orbin drifts back off the beat (5-10 s), Helion drops back to him
        const base = cx + Math.sin(s * 0.3) * w * 0.08, drift = who === 0 ? -sm((s - 4.5) / 3) * (1 - sm((s - 10) / 3)) * w * 0.22 : -sm((s - 8) / 3) * (1 - sm((s - 12) / 3)) * w * 0.12;
        const wob = who === 0 ? Math.sin(s * 5.3) * 10 * u * sm((s - 4.5) / 2) * (1 - sm((s - 11) / 2)) : 0;
        return [base + (who ? 34 : -34) * u + drift, cy - 40 * u + Math.sin(s * 1.6 + who) * 18 * u + wob - sm((s - 14) / 4) * h * 0.08];
      }
      if (ch.index === 2) { // the Stillness arriving: an easy turn round each other, slowing; at 9 s Helion stops and looks out
        const slow = 1 - 0.85 * sm((s - 8.5) / 1.5), a = (s < 8.5 ? s : 8.5 + (s - 8.5) * slow) * 0.7 + (who ? Math.PI : 0), r = 70 * u;
        return [cx + Math.cos(a) * r + dx, cy + 30 * u + Math.sin(a) * r * 0.5 + dy];
      }
      // the dark closing: a small orbit, close together, on the side the dark has not taken
      const a = s * 0.9 + (who ? 0.42 : 0), r = Math.min(w, h) * (0.24 - 0.08 * dark);
      return [cx - w * 0.12 * dark + Math.cos(a) * r * (1 - 0.5 * Math.max(0, Math.cos(a)) * dark) + dx, cy + Math.sin(a) * r * 0.55 + dy];
    };
    const o = pos(0), hl = pos(1);
    this.trail.push({ o, h: hl }); if (this.trail.length > 70) this.trail.shift();
    // their trails, braiding into their song (gold for Helion, pale for Orbin)
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    for (const [k, col] of [['o', [255, 236, 200]], ['h', [255, 176, 110]]] as Array<['o' | 'h', number[]]>) {
      for (let i = 1; i < this.trail.length; i++) {
        const q = i / this.trail.length, a0 = this.trail[i - 1][k], a1 = this.trail[i][k];
        const off = k === 'o' && ch.index === 1 ? (1 - 0.6 * sm((T - 4.5) / 2) * (1 - sm((T - 11) / 2))) : 1;
        c.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${(0.04 + 0.5 * q) * off})`; c.lineWidth = (1 + 5 * q) * u; c.beginPath(); c.moveTo(a0[0], a0[1]); c.lineTo(a1[0], a1[1]); c.stroke();
      }
    }
    c.restore();
    // their music between them: beads of light; it skips (Glassmere) and goes thin (Verdance)
    const skip = ch.index === 2 && T > 9.6 && T < 10.3;
    if (!skip) C.music(c, o[0], o[1] - 20 * u, hl[0], hl[1] - 20 * u, u * 0.8, T, ch.index === 2 ? sm((T - 10) / 1) : 0, ch.index === 3 ? 0.6 : ch.index === 2 ? 1 - 0.5 * sm((T - 10) / 3) : 1);
    // their hearts, as rings (Cirra: Orbin's drifts off Helion's beat and comes back)
    if (ch.index === 1) {
      const beatH = (T * 1.25) % 1, beatO = (T * 1.25 + 0.35 * sm((T - 4.5) / 2) * (1 - sm((T - 12) / 2))) % 1;
      c.strokeStyle = `rgba(255,210,140,${0.5 * (1 - beatH)})`; c.lineWidth = 2 * u; c.beginPath(); c.arc(hl[0], hl[1], (20 + 40 * beatH) * u, 0, TAU); c.stroke();
      c.strokeStyle = `rgba(230,240,255,${0.5 * (1 - beatO)})`; c.beginPath(); c.arc(o[0], o[1], (20 + 40 * beatO) * u, 0, TAU); c.stroke();
    }
    // the brothers (they face each other when they speak)
    const speaking = ch.lines.find((l) => T >= l.at && T < l.to);
    const looksOut = ch.index === 2 && T > 9.2;
    const sc = (ch.index === 0 ? 0.5 : 0.56) * u;
    P.spark(c, hl[0], hl[1], sc, { who: 'helion', eyes: looksOut ? 'wide' : ch.index === 3 ? 'set' : 'soft', arms: ch.index === 0 ? 'up' : ch.index === 3 ? 'reach' : 'rest', glow: 1, face: hl[0] < o[0] ? 1 : -1, look: looksOut ? [1, -0.8] : [o[0] > hl[0] ? 1 : -1, 0], crest: 1, ring: true, beat: 1, lean: 0 });
    const lost = ch.index === 1 && T > 4.5 && T < 11.5;
    P.spark(c, o[0], o[1], sc, { who: 'orbin', eyes: lost ? 'worried' : ch.index === 3 ? 'set' : 'soft', arms: ch.index === 0 ? 'up' : ch.index === 3 ? 'reach' : 'rest', glow: lost ? 0.7 : 1, face: o[0] < hl[0] ? 1 : -1, look: [hl[0] > o[0] ? 1 : -1, 0], crest: 1, ring: true, beat: 1, lean: 0 });
    if (ch.index === 3 && T > 14) K.glow(c, (o[0] + hl[0]) / 2, (o[1] + hl[1]) / 2 - 10 * u, 22 * u, [255, 240, 205], 0.8 * sm((T - 14) / 1.5)); // their hands
    // the joy's golden pulse, and comets humming past
    if (ch.index === 0) {
      const ph = (T / 3.2) % 1; c.strokeStyle = `rgba(255,232,170,${0.35 * (1 - ph)})`; c.lineWidth = 3 * u; c.beginPath(); c.ellipse(cx + dx, cy + dy, ph * w * 0.7, ph * w * 0.28, 0, 0, TAU); c.stroke();
      for (let i = 0; i < 4; i++) { const ph2 = ((T * (0.09 + i * 0.02) + i * 0.31) % 1.4) - 0.2, x = ph2 * w * 1.2, y = h * (0.15 + i * 0.2) + x * 0.1; c.strokeStyle = 'rgba(255,244,210,0.4)'; c.lineWidth = 1.5 * u; c.beginPath(); c.moveTo(x - 60 * u, y - 6 * u); c.lineTo(x, y); c.stroke(); K.glow(c, x, y, 5 * u, [255, 250, 232], 0.85); }
    }
    // near motes, out of focus, drifting faster than everything (depth)
    for (let i = 0; i < 9; i++) { const r = K.RNG(i * 13 + ch.index), x = ((r() * w * 1.4 + T * (14 + r() * 20) * u + dx * 2.2) % (w * 1.4)) - w * 0.2, y = h * (0.1 + 0.85 * r()) + dy * 2.2; K.glow(c, x, y, (18 + 30 * r()) * u, [255, 226, 170], 0.08 + 0.06 * r()); }
    // their words: faint, in the scene, near whoever says them
    for (const l of ch.lines) {
      const a = sm((T - l.at) / 0.6) * (1 - sm((T - (l.to - 0.6)) / 0.6));
      const p = l.who === 'orbin' ? o : hl;
      this.words(l.text, Math.max(110 * u, Math.min(w - 110 * u, p[0])), p[1] - 58 * u, 19 * u, a, l.who === 'helion');
    }
    // the fire's light: it becomes the memory, and the memory goes back into it
    const fire = Math.max(1 - sm(T / 1.4), sm((T - (MEMORY_LEN - 1.6)) / 1.5));
    if (fire > 0.003) { c.fillStyle = `rgba(255,${Math.round(170 + 40 * fire)},${Math.round(90 + 40 * fire)},${fire})`; c.fillRect(0, 0, w, h); K.glow(c, cx, h * 0.62, Math.max(w, h) * 0.6, [255, 236, 190], 0.6 * fire, 'screen'); }
    if (T >= MEMORY_LEN) { const f = this.onDone; this.stop(); f?.(); }
  }
}
