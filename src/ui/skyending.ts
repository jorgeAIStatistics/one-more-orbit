// The ending (the owner's brief of 2026-11-26), on The Long Road Home (Inukshuk): a film, no taps (a tap skips ahead).
// Storyboard (audio seconds; a bar is 1.579 s, the drop at bar 17, 26.84 s):
//   1   0-6.3    the guardian bows its head, its star lit gold; behind it the shadow rings of the gate come undone and
//                light pours through                                    camera: still, a slow push in
//   2   6.3-26.8 the victory flight: Orbin flies the road across World 1, past Verdance, Glassmere, Cirra and Emberwick,
//                each relit, the four Kindlings after him, his trail gold   camera: tracks with him, the planets in three
//                depths (parallax), easing in and out of each pass
//   3   26.8-40  the drop: home at the Landing; the vessel (the Sleeper, its six sockets lit) rises with him and carries
//                him up through the open gate                            camera: a crane up as it lifts, speed lines
//   4   40-52    beyond the edge: another galaxy, cold and dark, turning; far off, Helion's signal pulses once: "…Orbin?"
//   5   52-77    the credits, over the stars                            then the map
import longAudio from '../../levels/longroad/audio.json';
import { audio, type LoadedTrack } from '../audio/audio';
import { CANON } from '../art/canonpaint.js';
import { COMPANIONS } from '../art/companions.js';
import { K } from '../art/painter.js';
import { LANDING } from '../art/landingpaint.js';
import { rings } from '../art/stillness.js';
import { planetLayer, type LayerName } from '../art/paintcache';
import { WORLDS as W } from '../art/worldpaint.js';
import { WORLDS2 as W2 } from '../art/world2paint.js';
import { CREDITS_MORE, creditLine, HEARD_TRACKS, manifest } from '../game/packs';
import type { AudioMeta } from '../game/types';
import { save } from '../save';

const META = longAudio as AudioMeta;
const TAU = Math.PI * 2;
const sm = (x: number) => { const t = x < 0 ? 0 : x > 1 ? 1 : x; return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const SERIF = '"Cormorant Garamond", "Hoefler Text", Baskerville, Palatino, Georgia, serif';
export const ENDING_LEN = 76;
const T = { flight: 6.3, drop: 26.84, beyond: 40, credits: 52, end: ENDING_LEN };
/** the road across World 1, in the flight's own units: each world, its picture and the Kindling that came from it */
const ROAD: Array<{ x: number; y: number; layer: LayerName; make: (hot: boolean) => HTMLCanvasElement; kin: string; name: string }> = [
  { x: 0, y: 0, layer: 'verdLayer', make: W2.verdLayer, kin: 'invincible', name: 'Verdance' },
  { x: 1.1, y: -0.5, layer: 'glassLayer', make: W2.glassLayer, kin: 'blank', name: 'Glassmere' },
  { x: 2.2, y: 0.15, layer: 'cirraLayer', make: W2.cirraLayer, kin: 'skyhigh', name: 'Cirra' },
  { x: 3.3, y: -0.35, layer: 'emberLayer', make: W.emberLayer, kin: 'heroes', name: 'Emberwick' }
];

export class SkyEnding {
  private ctx: CanvasRenderingContext2D;
  private track: LoadedTrack | null = null; private part: { stop: (fade?: number) => void } | null = null;
  private t0 = 0; private own = true; private perf0 = 0; private skipTo = -1;
  private pics: Array<HTMLCanvasElement | ImageBitmap | null> = [];
  private landing: HTMLCanvasElement | null = null; private key = '';
  private trail: Array<[number, number]> = [];
  on = false;
  private then: (() => void) | null = null;
  constructor(private canvas: HTMLCanvasElement) { this.ctx = canvas.getContext('2d')!; }
  /** load the song and paint what is heavy (the Landing with every socket lit), before it plays */
  prepare(): void {
    if (audio.prime()) void audio.loadTrack(META).then((t) => { this.track = t; }, () => undefined);
    this.pics = ROAD.map((r) => planetLayer(r.layer, true) ?? r.make(true));
    this.layout();
  }
  play(then: () => void): void {
    this.prepare(); this.on = true; this.then = then; this.trail = []; this.skipTo = -1;
    const c = audio.ctx;
    if (c && audio.running && this.track) { this.own = false; this.t0 = c.currentTime + 0.1; this.part = audio.playPart(this.track, META, this.t0, 0, { dur: ENDING_LEN + 0.5, gain: 0.95 }); }
    else { this.own = true; this.perf0 = performance.now(); }
  }
  /** a tap: on to the credits (a second tap during them lets it go) */
  tap(): void { const t = this.time(); if (t < T.credits - 1) this.skipTo = T.credits - 1; else this.finish(); }
  /** for stills: be at second t */
  seek(t: number): void { this.prepare(); this.on = true; this.own = true; this.perf0 = performance.now() - t * 1000; this.trail = []; this.skipTo = -1; }
  stop(): void { this.part?.stop(0.8); this.part = null; this.on = false; }
  private finish(): void { const f = this.then; this.then = null; this.stop(); f?.(); }
  private time(now = performance.now()): number {
    if (this.own || !audio.ctx) return (now - this.perf0) / 1000;
    return audio.ctxTimeAt(now) - this.t0 - audio.latency() - save.audioOffset / 1000;
  }
  private layout(): void {
    const w = window.innerWidth, h = window.innerHeight, key = `${w}x${h}`;
    if (key === this.key) return; this.key = key;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; LANDING.paint(cv.getContext('2d')!, w, h, 6, 0); this.landing = cv;
  }
  private words(s: string, x: number, y: number, px: number, a: number, italic = true, col = '#fff3dc'): void {
    if (a <= 0.004) return;
    const c = this.ctx; c.save(); c.font = `${italic ? 'italic ' : ''}500 ${px}px ${SERIF}`; c.textAlign = 'center'; c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = px * 0.5; c.globalAlpha = a; c.fillStyle = col; c.fillText(s, x, y); c.restore();
  }

  draw(now: number): void {
    if (!this.on) return;
    this.layout();
    const c = this.ctx, w = window.innerWidth, h = window.innerHeight, dpr = this.canvas.width / Math.max(1, w), u = Math.min(w / 390, h / 844);
    let t = this.time(now);
    if (this.skipTo >= 0 && t < this.skipTo) { this.perf0 -= (this.skipTo - t) * 1000; this.t0 -= this.skipTo - t; t = this.skipTo; this.part?.stop(1.2); this.part = null; this.own = true; this.perf0 = now - t * 1000; }
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    // the night, always under everything: deep blue going to the gold of the end
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#05060f'); g.addColorStop(1, t < T.beyond ? '#1a1430' : '#071018'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    const r0 = K.RNG(3); for (let i = 0; i < 160; i++) { const x = r0() * w, y = r0() * h, s = r0(); K.glow(c, x, y, (1 + 2 * s) * u, [255, 245, 225], 0.25 + 0.5 * s * (0.7 + 0.3 * Math.sin(now / 900 + i))); }
    if (t < T.flight + 0.8) this.gate(c, w, h, u, t);
    if (t > T.flight - 0.8 && t < T.drop + 0.8) this.flight(c, w, h, u, t);
    if (t > T.drop - 0.8 && t < T.beyond + 0.8) this.carried(c, w, h, u, t);
    if (t > T.beyond - 0.8 && t < T.credits + 1) this.beyond(c, w, h, u, t);
    if (t > T.credits - 1) this.credits(c, w, h, u, t);
    // the cuts between scenes are dissolves through the light, never cuts
    for (const at of [T.flight, T.drop, T.beyond, T.credits]) { const k = 1 - Math.abs(t - at) / 0.8; if (k > 0) { c.fillStyle = `rgba(255,236,200,${0.85 * sm(k) * (save.reduceFlash ? 0.5 : 1)})`; c.fillRect(0, 0, w, h); } }
    if (t >= T.end) this.finish();
  }
  /** 1: the guardian bows, its star lit; the gate's rings come undone behind it, and light pours through */
  private gate(c: CanvasRenderingContext2D, w: number, h: number, u: number, t: number): void {
    const push = 1 + 0.05 * sm(t / T.flight), open = sm((t - 1) / 4);
    c.save(); c.translate(w / 2, h * 0.55); c.scale(push, push); c.translate(-w / 2, -h * 0.55);
    K.glow(c, w * 0.5, h * 0.28, Math.max(w, h) * (0.2 + 0.5 * open), [255, 214, 150], 0.25 + 0.5 * open, 'screen');
    c.save(); c.globalAlpha = 1 - open; rings(c, w * 0.5, h * 0.28, 120 * u * (1 + open), 40 * u * (1 + open), 0.9, t); c.restore();
    CANON.parts.guardian(c, w * 0.5, h * 0.86, 0.42 * u, K.RNG(42), 3);
    c.restore();
    this.words('The way is open.', w / 2, h * 0.14, 22 * u, sm((t - 2.4) / 0.8) * (1 - sm((t - 5.4) / 0.6)));
  }
  /** 2: the victory flight across World 1, past each relit world, the Kindlings after him */
  private flight(c: CanvasRenderingContext2D, w: number, h: number, u: number, t: number): void {
    const q = sm((t - T.flight) / (T.drop - T.flight)), span = 3.3, along = -0.3 + (span + 0.6) * q, S = Math.min(w, h) * 0.85;
    // the camera travels along the road; each world comes through in its own depth (the far ones move less)
    const cy = h * 0.5, time = t;
    ROAD.forEach((r, i) => {
      const depth = [0.8, 1.0, 0.9, 1.1][i], x = w / 2 + (r.x - along) * S * depth, y = cy + r.y * S * 0.35 + Math.sin(time * 0.4 + i) * 6 * u, pic = this.pics[i], R = S * 0.16 * depth;
      if (x < -R * 2 || x > w + R * 2 || !pic) return;
      K.glow(c, x, y, R * 2.2, [255, 220, 170], 0.18, 'screen');
      const P = pic.width * (R / 110); c.drawImage(pic, x - P / 2, y - P / 2, P, P);
      this.words(r.name, x, y + R * 1.45, 18 * u, sm(1 - Math.abs(x - w / 2) / (w * 0.4)) * 0.9);
    });
    // Orbin, flying the road in a long gold ribbon, bobbing on the beat; the four Kindlings after him
    const bp = Math.exp(-((((t - T.flight) / (60 / 152)) % 1 + 1) % 1) * 5), ox = w * 0.42, oy = cy - S * 0.12 + Math.sin(t * 1.6) * 14 * u - bp * 4 * u;
    this.trail.push([ox + (t - T.flight) * 0, oy]); if (this.trail.length > 50) this.trail.shift();
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    for (let i = 1; i < this.trail.length; i++) { const k = i / this.trail.length, dx = (this.trail.length - i) * 7 * u; c.strokeStyle = `rgba(255,214,150,${0.5 * k})`; c.lineWidth = (2 + 8 * k) * u; c.beginPath(); c.moveTo(this.trail[i - 1][0] - dx - 7 * u, this.trail[i - 1][1]); c.lineTo(this.trail[i][0] - dx, this.trail[i][1]); c.stroke(); }
    c.restore();
    const KD = COMPANIONS.KINDLE as Record<string, number[]>;
    ROAD.forEach((r, i) => COMPANIONS.kindling(c, ox - (40 + 34 * i) * u, oy + Math.sin(t * 2 + i) * 18 * u + (i % 2 ? 22 : -18) * u, 0.32 * u, KD[r.kin], { flap: 0.5 + 0.5 * Math.sin(t * 6 + i), alpha: sm((t - T.flight - 0.5 - i * 0.6) / 1) }));
    CANON.parts.spark(c, ox, oy, 0.5 * u, { who: 'orbin', eyes: 'soft', arms: 'up', glow: 1, face: 1, look: [1, 0], crest: 1, ring: true, beat: 1, lean: 0.4 });
  }
  /** 3: the drop: home at the Landing; the vessel rises with him and carries him up through the gate */
  private carried(c: CanvasRenderingContext2D, w: number, h: number, u: number, t: number): void {
    const lift = sm((t - T.drop - 1.2) / 8), crane = lift * h * 0.9;
    if (this.landing) { c.save(); c.translate(0, crane * 0.6); c.drawImage(this.landing, 0, 0, w, h); c.restore(); }
    const [fx, fy] = [w * 0.5, h * 0.62 + crane * 0.6];
    // the vessel lifting: its sockets lit, rising out of the frame with him; the gate's gold above
    K.glow(c, w * 0.5, -h * 0.1 + h * 0.5 * lift, Math.max(w, h) * (0.4 + 0.4 * lift), [255, 214, 150], 0.2 + 0.5 * lift, 'screen');
    const ox = fx, oy = lerp(fy - 40 * u, h * 0.32, lift);
    if (lift > 0.02 && lift < 0.98) { c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; const r = K.RNG(9); for (let i = 0; i < 36; i++) { const x = r() * w, y0 = ((r() * h + t * 900 * u) % (h * 1.2)) - h * 0.1, L = (40 + 120 * r()) * u * lift; c.strokeStyle = `rgba(255,236,200,${0.25 * (1 - Math.abs(lift - 0.5) * 2)})`; c.lineWidth = 1 + 2 * r(); c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y0 + L); c.stroke(); } c.restore(); }
    CANON.parts.spark(c, ox, oy, 0.55 * u, { who: 'orbin', eyes: 'set', arms: lift > 0.2 ? 'up' : 'rest', glow: 1, face: 1, look: [0, -1], crest: 1, ring: true, beat: 1, lean: 0 });
    this.words('Home, and on.', w / 2, h * 0.14, 22 * u, sm((t - T.drop - 0.8) / 0.8) * (1 - sm((t - T.drop - 5) / 0.8)));
  }
  /** 4: beyond the edge: another galaxy, cold and turning; far off, Helion's signal pulses once */
  private beyond(c: CanvasRenderingContext2D, w: number, h: number, u: number, t: number): void {
    const q = (t - T.beyond), cx = w * 0.5, cy = h * 0.45, R = Math.min(w, h) * (0.42 + 0.02 * q), rot = q * 0.05;
    c.save(); c.globalCompositeOperation = 'lighter';
    const r = K.RNG(21);
    for (let i = 0; i < 520; i++) { const arm = i % 3, d = Math.pow(r(), 0.7), a = arm * (TAU / 3) + d * 4.2 + rot + (r() - 0.5) * 0.5, x = cx + Math.cos(a) * d * R, y = cy + Math.sin(a) * d * R * 0.45; K.glow(c, x, y, (1 + 2.5 * r()) * u, d < 0.2 ? [210, 240, 255] : [120, 200, 210], (0.2 + 0.5 * r()) * sm(q / 2)); }
    c.restore();
    K.glow(c, cx, cy, R * 0.35, [170, 220, 255], 0.25 * sm(q / 2), 'screen');
    // Helion's signal, far off at its edge: one pulse
    const px = cx + R * 0.82, py = cy - R * 0.22, pulse = Math.exp(-Math.max(0, q - 6) / 0.6) * (q > 6 ? 1 : 0);
    K.glow(c, px, py, (6 + 40 * pulse) * u, [255, 200, 130], 0.5 + 0.5 * pulse, 'screen');
    this.words('Beyond the edge, another galaxy waits in the dark.', w / 2, h * 0.8, 19 * u, sm((q - 1.5) / 1) * (1 - sm((q - 10.4) / 0.8)));
    this.words('“…Orbin?”', Math.min(px, w - 70 * u), py - 26 * u, 18 * u, sm((q - 6.4) / 0.6) * (1 - sm((q - 10.4) / 0.8)));
  }
  /** 5: the credits, over the stars */
  private credits(c: CanvasRenderingContext2D, w: number, h: number, u: number, t: number): void {
    const q = t - T.credits, a = sm((q + 1) / 1.2) * (1 - sm((q - (T.end - T.credits - 1.4)) / 1.2));
    const lines: Array<[string, number, boolean]> = [['ONE MORE ORBIT', 30, false], ['World 1', 20, true], ['', 14, false], ['The music', 20, true], ...HEARD_TRACKS.flatMap((tr): Array<[string, number, boolean]> => { const [a1, ...b1] = creditLine(tr).split(' · '); return [[a1, 14, false], [b1.join(' · '), 11, false]]; }), ['', 14, false], [manifest.licenceNote, 11, false], ...CREDITS_MORE.map((l): [string, number, boolean] => [l, 11, false]), ['', 14, false], ['Thank you for playing.', 22, true]];
    const total = lines.reduce((s, [, px]) => s + px * 2.1 * u, 0), y0 = h * 0.92 - (total + h * 0.5) * sm(q / (T.end - T.credits - 2));
    let y = y0;
    for (const [s, px, it] of lines) { if (s) this.words(s.length > 70 ? s.slice(0, 68) + '…' : s, w / 2, y, px * u, a * (y > h * 0.08 && y < h * 0.96 ? 1 : 0.2), it, it ? '#ffe2b0' : '#f2ecff'); y += px * 2.1 * u; }
  }
}
