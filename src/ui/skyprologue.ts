// The prologue (World 1): the first minute of the game, played in the galaxy's own sky. Marlow lights the lamp and
// teaches the spark to fly: he draws ring after ring of lamplight, and Eko hops from one to the next when you tap
// as he crosses the white mark. Higher up the four planets hum back. Then the Hush comes: the lullaby is cut off
// mid-phrase, colour drains, Marlow throws Eko clear ("Go."), and in the silence one mark is left. Pull back: four
// dark planets, one small light far up, tapping. The title writes itself, and the picture is the galaxy map.
//
// Nothing can go wrong here: a tap a little early or late still counts, and a tap that never comes is taken by
// Marlow. Every tap of the lesson is on a note of the lullaby. The taps are also listened to: if they sit steadily
// early or late, that is the device's delay, and the game can set its sync from them without asking.
import lullaby from '../../levels/lullaby/audio.json';
import { audio } from '../audio/audio';
import { DUSK, K } from '../art/painter.js';
import { WORLD1 } from '../art/world1paint.js';
import type { AudioMeta } from '../game/types';
import { save } from '../save';
import type { SkyMap } from './skymap';
import type { SkyTitle } from './skytitle';

type XY = [number, number];
const META = lullaby as AudioMeta;
const BEAT = 60 / META.bpm;
const SERIF = '"Cormorant Garamond", "Hoefler Text", Baskerville, Palatino, Georgia, serif';
const IDS = ['heroes', 'skyhigh', 'blank', 'invincible'];
const COL: Record<string, [number, number, number]> = { heroes: [255, 190, 120], skyhigh: [255, 196, 232], blank: [226, 242, 255], invincible: [196, 250, 160] };
/** the note each planet hums back with (D major: the lullaby's key) */
const HUM = [62, 66, 69, 74];
/**
 * When each tap falls, in beats from the first of Marlow's four counting taps (a bar is four beats; the tune starts
 * on beat 4). Six slow ones on the downbeats of bars 3 to 8, then two a bar: every one is a note of the tune.
 */
const TAPS = [12, 16, 20, 24, 28, 32, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70, 72];
/** the ring Eko has just landed on when each planet hums back */
const HUMS = [14, 16, 18, 20];
const CUT = 73.5; // the lullaby stops, mid-phrase
const GO = 80;    // Marlow throws the spark clear
const EARLY = 0.34, LATE = 0.46; // seconds either side of a tap's beat in which it counts; after that Marlow takes it
const smooth = (x: number) => { const t = x < 0 ? 0 : x > 1 ? 1 : x; return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

export class SkyPrologue {
  /** waiting for the first tap (sound cannot start without one), playing, or over */
  state: 'wait' | 'play' | 'done' = 'wait';
  /** how far off each counted tap of the lesson was, in ms (+ late): for the sync */
  offsets: number[] = [];
  /** a replay (from the logbook): it can be skipped */
  again = false;
  onDone: () => void = () => undefined;
  private ctx: CanvasRenderingContext2D;
  private music: { stop: (fade?: number) => void } | null = null;
  private songStart = 0;      // audio-clock time of the lullaby's first sample
  private perfStart = -1;     // page time of the same, when there is no sound to keep time by
  private latency = 0;
  private cutDone = false;
  private hop = 0;            // hops made so far: Eko is on (or flying to) ring `hop`
  private went: number[] = []; // when each hop happened (seconds)
  private thrownAt = -1;
  private lastAt = -1;
  private knocks = 0;
  private rings: Array<{ x: number; y: number; r: number }> = [];
  private lone: XY = [0, 0];
  private far: XY = [0, 0];
  private key = '';
  private cam = { x: 0, y: 0, z: 1 };
  private mar: XY = [0, 0];
  private eko: HTMLCanvasElement | null = null;
  private moth: HTMLCanvasElement | null = null;
  private g = 1; private u = 1; private zL = 2.3;
  private t = -99;
  private lastNow = 0;
  private wobble = -9;

  constructor(private canvas: HTMLCanvasElement, private sky: SkyMap, private title: SkyTitle) { this.ctx = canvas.getContext('2d')!; }

  /** Back to the very beginning. */
  reset(again = false): void {
    this.music?.stop(0.2);
    this.music = null;
    Object.assign(this, { state: 'wait', offsets: [], again, cutDone: false, hop: 0, went: [], thrownAt: -1, lastAt: -1, knocks: 0, perfStart: -1, t: -99, key: '', wobble: -9 });
  }
  /** Leaves at once (a replay skipped, or the screen left). */
  stop(): void { this.music?.stop(0.25); this.music = null; this.sky.stage = null; }

  /** The first tap: the lamp is lit and the lullaby begins (its first bar is Marlow's four counting taps). */
  private async begin(now: number): Promise<void> {
    this.state = 'play';
    this.perfStart = now + 150;
    audio.setVolumes(save.music, save.sfx);
    if (!audio.ensure()) return;
    try {
      const track = await audio.loadTrack(META);
      await audio.resume();
      const c = audio.ctx;
      if (!c || this.state !== 'play' || this.hop > 0) return;
      const t0 = c.currentTime + 0.12;
      this.music = audio.playMusic(track.buffer, t0, META.offset + track.shift);
      this.songStart = t0;
      this.latency = audio.latency();
      this.perfStart = -1;
    } catch { /* no sound: the page's own clock keeps the time */ }
  }
  /** Seconds since the lullaby's first sample, as heard. */
  private timeAt(perfMs: number): number {
    if (this.state === 'wait') return -99;
    if (this.perfStart >= 0 || !audio.ctx) return (perfMs - this.perfStart) / 1000;
    return audio.ctxTimeAt(perfMs) - this.songStart - this.latency - save.audioOffset / 1000;
  }

  /** The one button. */
  tap(perfMs: number, x = -1, y = -1): void {
    if (this.state === 'done') return;
    if (this.state === 'wait') { void this.begin(perfMs); return; }
    if (this.again && x > window.innerWidth - 96 && y >= 0 && y < 70) { this.finish(); return; }
    const t = this.timeAt(perfMs);
    if (this.hop < TAPS.length) {
      const d = t - TAPS[this.hop] * BEAT;
      if (d < -EARLY) { this.wobble = t; return; } // too soon: "not before it"
      this.takeHop(t, d);
    } else if (this.thrownAt < 0) { if (t >= GO * BEAT - 0.5) this.throwNow(t); }
    else if (this.lastAt < 0 && t >= this.loneReady()) this.lastTap(t);
  }
  private takeHop(t: number, d: number | null): void {
    this.went.push(t);
    this.hop++;
    if (d !== null && Math.abs(d) <= 0.26) this.offsets.push(d * 1000);
    audio.hit(d === null ? 'tap' : 'hit', (d === null ? 0.35 : 0.8) * save.hitVol);
    const k = HUMS.indexOf(this.hop);
    if (k >= 0) audio.pluck(HUM[k], 0.45 * save.hitVol); // the planet beside this ring hums back
  }
  private throwNow(t: number): void { this.thrownAt = t; audio.hit('hop', 0.9 * save.hitVol); audio.hit('impact', 0.5); }
  /** when the last ring is there and Eko is on it */
  private loneReady(): number { return this.thrownAt + 1.7; }
  private lastTap(t: number): void { this.lastAt = t; audio.hit('glass', 0.9); }
  private finish(): void {
    if (this.state === 'done') return;
    this.state = 'done';
    this.music?.stop(0.3);
    this.music = null;
    this.onDone();
  }

  // ---------------------------------------------------------------- where things are
  private layout(): void {
    const G = this.sky.geo(), key = `${G.w}x${G.h}`;
    if (key === this.key) return;
    this.key = key;
    const u = (this.u = G.u), g = (this.g = G.tall ? 1 : 1.9), rr = 11 * u * g;
    this.zL = G.tall ? 2.3 : 1.9;
    const at = (id: string) => G.at(id), lamp = G.lamp;
    // beside a world: on the side its neighbours along the road are on, clear of it
    const beside = (id: string, prev: XY, next: XY): XY => { const p = at(id), mx = (prev[0] + next[0]) / 2 - p.x, my = (prev[1] + next[1]) / 2 - p.y, d = Math.hypot(mx, my) || 1, off = p.r + rr * 1.2 + 12 * u; return [p.x + (mx / d) * off, p.y + (my / d) * off]; };
    const c = (id: string): XY => [at(id).x, at(id).y];
    const E = beside('heroes', lamp, c('skyhigh')), C = beside('skyhigh', c('heroes'), c('blank')), B = beside('blank', c('skyhigh'), c('invincible')), V = beside('invincible', c('blank'), c('gate'));
    // the lesson: a long lazy curve from the lamp out over the land and back to Emberwick's side (14 rings, evenly spaced)
    const sx = G.w / (G.tall ? 390 : 1440), sy = G.h / (G.tall ? 844 : 900);
    const P0: XY = [lamp[0], lamp[1]], P1: XY = G.tall ? [300 * sx, 742 * sy] : [70 * sx, 430 * sy], P2: XY = G.tall ? [352 * sx, 628 * sy] : [240 * sx, 372 * sy], P3 = E;
    const bez = (t: number): XY => { const a = 1 - t; return [a * a * a * P0[0] + 3 * a * a * t * P1[0] + 3 * a * t * t * P2[0] + t * t * t * P3[0], a * a * a * P0[1] + 3 * a * a * t * P1[1] + 3 * a * t * t * P2[1] + t * t * t * P3[1]]; };
    const pts: XY[] = [], len: number[] = [0];
    for (let i = 0; i <= 200; i++) { pts.push(bez(i / 200)); if (i) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); }
    const along = (d: number): XY => { let i = 1; while (i < 200 && len[i] < d) i++; const f = (d - len[i - 1]) / Math.max(1e-6, len[i] - len[i - 1]); return [lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)]; };
    const rings: Array<{ x: number; y: number; r: number }> = [];
    for (let i = 0; i <= 14; i++) { const [x, y] = along((len[200] * i) / 14); rings.push({ x, y, r: i === 0 ? rr * 1.15 : rr }); }
    // higher: past each world in turn (a ring between, a ring beside), then on up toward the Hollow, and round
    const mid = (a: XY, b: XY, k = 0.5, bend = 0): XY => [lerp(a[0], b[0], k) + (b[1] - a[1]) * bend, lerp(a[1], b[1], k) - (b[0] - a[0]) * bend];
    const gate = c('gate'), H1 = mid(V, gate, 0.4, 0.12), H2 = mid(V, gate, 0.68, -0.1);
    for (const p of [mid(E, C, 0.5, 0.1), C, mid(C, B, 0.5, -0.1), B, mid(B, V, 0.5, 0.1), V, H1, H2]) rings.push({ x: p[0], y: p[1], r: rr * 1.18 });
    const R = 30 * u * g;
    for (const a of [2.5, 3.6, 4.6]) rings.push({ x: H2[0] + Math.cos(a) * R, y: H2[1] + Math.sin(a) * R * 0.8 + 16 * u * g, r: rr * 1.18 });
    this.rings = rings; // 26 of them: ring 0 is round the wick
    this.lone = [lamp[0] + (G.tall ? 62 : 110) * u * (G.tall ? 1 : 1), lamp[1] - 34 * u * g];
    this.far = [gate[0] - 34 * u * g, gate[1] + (G.tall ? 92 : 70) * u * (G.tall ? 1 : 1.4)];
    this.cam = { x: lamp[0], y: lamp[1] - 20 * u, z: this.zL };
    this.mar = [rings[1].x + 14 * u * g, rings[1].y - 18 * u * g];
    // Eko and Marlow, painted once
    const dpr = this.canvas.width / Math.max(1, G.w), es = 0.36 * u * g, q = Math.min(3, es * this.zL * dpr * 1.1);
    const ek = document.createElement('canvas'); ek.width = Math.ceil(240 * q); ek.height = Math.ceil(320 * q);
    const ec = ek.getContext('2d')!; ec.scale(q, q); DUSK.tools.eko(ec, 150, 120, 0.3, K.RNG(5), { wisp: true });
    this.eko = ek;
    const ms = 0.085 * u * g, mq = Math.min(2, ms * this.zL * dpr * 1.1);
    const mo = document.createElement('canvas'); mo.width = Math.ceil(460 * mq); mo.height = Math.ceil(480 * mq);
    const mc = mo.getContext('2d')!; mc.scale(mq, mq); WORLD1.parts.moth(mc, 230, 200, 1, K.RNG(9), 1);
    this.moth = mo;
  }
  private ang(i: number, toward: number): number { const a = this.rings[i], b = this.rings[Math.max(0, Math.min(this.rings.length - 1, toward))]; return Math.atan2(b.y - a.y, b.x - a.x); }
  /** How long Eko is in the air between ring i-1 and ring i. */
  private flight(i: number): number { return i > 14 ? 0.42 : 0.32; }
  /** Where Eko is at time t (and whether he is in the air). */
  private ekoAt(t: number): { x: number; y: number; air: number } {
    const R = this.rings, lamp = this.sky.geo().lamp, u = this.u * this.g;
    if (this.lastAt >= 0) { // the last tap: he goes back to the wick, and sits
      const k = smooth((t - this.lastAt) / 0.55), a = this.loneAngle(this.lastAt);
      return { x: lerp(this.lone[0] + Math.cos(a) * 12 * u, lamp[0], k), y: lerp(this.lone[1] + Math.sin(a) * 12 * u, lamp[1] - 6 * u, k) - Math.sin(k * Math.PI) * 14 * u, air: k < 1 ? 1 : 0 };
    }
    if (this.thrownAt >= 0) {
      const k = (t - this.thrownAt) / 1.6;
      if (k >= 1) { const a = this.loneAngle(t); return { x: this.lone[0] + Math.cos(a) * 12 * u, y: this.lone[1] + Math.sin(a) * 12 * u, air: 0 }; }
      const from = this.orbit(R.length - 1, this.thrownAt), e = smooth(k), a1 = this.loneAngle(this.thrownAt + 1.6);
      const to: XY = [this.lone[0] + Math.cos(a1) * 12 * u, this.lone[1] + Math.sin(a1) * 12 * u];
      return { x: lerp(from[0], to[0], e) - Math.sin(e * Math.PI) * 60 * u, y: lerp(from[1], to[1], e * e), air: 1 }; // flung out and down, in a long arc
    }
    const i = this.hop;
    if (i > 0) {
      const t0 = this.went[i - 1], F = this.flight(i);
      if (t < t0 + F) {
        const k = smooth((t - t0) / F), a0 = this.ang(i - 1, i), a1 = this.ang(i, i - 1), A = R[i - 1], B = R[i];
        const x0 = A.x + Math.cos(a0) * A.r, y0 = A.y + Math.sin(a0) * A.r, x1 = B.x + Math.cos(a1) * B.r, y1 = B.y + Math.sin(a1) * B.r;
        return { x: lerp(x0, x1, k), y: lerp(y0, y1, k) - Math.sin(k * Math.PI) * 7 * u, air: 1 };
      }
    }
    const [x, y] = this.orbit(i, t);
    return { x, y, air: 0 };
  }
  /** Eko riding round ring i: timed so that he crosses its white mark exactly on the beat of the next tap. */
  private orbit(i: number, t: number): XY {
    const r = this.rings[i], dir = i % 2 ? -1 : 1;
    const mark = i + 1 < this.rings.length ? this.ang(i, i + 1) : this.ang(i, i - 1) + Math.PI * 0.6;
    const tNext = (i < TAPS.length ? TAPS[i] : GO) * BEAT;
    const tLand = i > 0 ? this.went[i - 1] + this.flight(i) : 8 * BEAT;
    let sweep = i > 0 ? (((mark - this.ang(i, i - 1)) * dir) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) : Math.PI * 2;
    if (sweep < 2.4) sweep += Math.PI * 2; // always a good run-up to the mark
    const w = sweep / Math.max(0.5, tNext - tLand), a = mark - dir * w * (tNext - t);
    return [r.x + Math.cos(a) * r.r, r.y + Math.sin(a) * r.r];
  }
  /** The last ring, by the dark Lantern: one slow lap every four beats, crossing its mark on the lap's beat. */
  private loneAngle(t: number): number { return -0.6 + ((t - this.loneReady()) / (4 * BEAT)) * Math.PI * 2; }

  // ---------------------------------------------------------------- one frame
  draw(now: number): void {
    const dt = Math.min(0.05, Math.max(0, (now - this.lastNow) / 1000));
    this.lastNow = now;
    this.layout();
    const G = this.sky.geo(), u = this.u, g = this.g, ug = u * g, lamp = G.lamp;
    const t = (this.t = this.timeAt(now)), beat = t / BEAT;
    if (this.state === 'play') {
      // what was not tapped in time, Marlow takes: nothing can go wrong in the first minute
      while (this.hop < TAPS.length && t > TAPS[this.hop] * BEAT + LATE) this.takeHop(TAPS[this.hop] * BEAT + LATE, null);
      if (!this.cutDone && beat >= CUT) { this.cutDone = true; this.music?.stop(0.1); this.music = null; if (audio.ctx && this.perfStart < 0) { /* the audio clock goes on keeping time in the silence */ } }
      if (this.thrownAt < 0 && t > GO * BEAT + 0.8) this.throwNow(GO * BEAT + 0.8);
      if (this.thrownAt >= 0 && this.lastAt < 0 && t > this.loneReady() + 9 * BEAT) this.lastTap(t); // (he waits a long while for it)
      if (this.lastAt >= 0) {
        const since = (t - this.lastAt) / BEAT;
        // far up, one small light under glass taps four times
        while (this.knocks < 4 && since >= 8 + this.knocks) { this.knocks++; audio.hit('glass', 0.32); }
        if (since >= 23) this.finish();
      }
    }
    if (this.state === 'done') return; // (it has just ended: the sky is the map's again)
    const after = this.lastAt >= 0 ? (t - this.lastAt) / BEAT : -1;
    // the cold comes down with the Hush; at the very end it lifts again, and what is left is the galaxy as the map shows it
    const lift = after >= 0 ? 1 - smooth((after - 19.5) / 3.5) : 1, drain = smooth((beat - CUT) / 5) * lift;
    const e = this.ekoAt(t);
    // ---- the camera: close on the lesson, wider as he climbs, back down with the throw, and at last the whole sky
    const back = after >= 3 ? smooth((after - 3) / 4.5) : 0;
    const zWant = this.state === 'wait' ? this.zL : back > 0 ? lerp(this.zL * 0.8, 1, back) : this.thrownAt >= 0 ? this.zL * 0.8 : beat >= CUT ? this.zL * 0.6 : this.hop >= 14 ? this.zL * 0.72 : this.zL;
    const cx = back > 0 ? lerp(e.x, G.w / 2, back) : e.x, cy = back > 0 ? lerp(e.y - 8 * ug, G.h / 2, back) : beat >= CUT && this.thrownAt < 0 ? e.y - 50 * ug : e.y - 8 * ug;
    const k = 1 - Math.exp(-dt * (this.thrownAt >= 0 && after < 0 ? 5 : 2.6));
    this.cam.x += (cx - this.cam.x) * k; this.cam.y += (cy - this.cam.y) * k; this.cam.z += (zWant - this.cam.z) * (1 - Math.exp(-dt * 1.8));
    // ---- Marlow keeps a ring ahead; caught, he is carried up under glass
    const caught = smooth((beat - 76.5) / 1.5), carried = this.thrownAt >= 0 ? smooth((t - this.thrownAt - 0.3) / 3.2) : 0;
    const next = this.rings[Math.min(this.rings.length - 1, this.hop + 1)], gate = G.at('gate');
    const mWant: XY = this.hop + 1 < this.rings.length ? [next.x + 15 * ug, next.y - 19 * ug] : [next.x + 34 * ug, next.y + 4 * ug];
    const mk = 1 - Math.exp(-dt * 4);
    this.mar[0] += (mWant[0] - this.mar[0]) * mk; this.mar[1] += (mWant[1] - this.mar[1]) * mk;
    const mx = lerp(this.mar[0], gate.x - 20 * ug, carried), my = lerp(this.mar[1], gate.y + 30 * ug, carried) + Math.sin(t * 2.3) * 2.2 * ug * (1 - caught);

    const planets: Record<string, number> = {};
    IDS.forEach((id, i) => { planets[id] = 1 - smooth((beat - CUT - 0.6 - i * 0.75) / 0.8); });
    this.sky.stage = {
      x: this.cam.x, y: this.cam.y, z: this.cam.z, planets,
      paint: (c) => {
        // the dusk goes cold as the songs are taken
        if (drain > 0) {
          c.save(); c.globalCompositeOperation = 'saturation'; c.fillStyle = `rgba(128,128,128,${0.62 * drain})`; c.fillRect(0, 0, G.w, G.h);
          c.globalCompositeOperation = 'source-over'; c.fillStyle = `rgba(7,8,28,${0.5 * drain})`; c.fillRect(0, 0, G.w, G.h); c.restore();
          // the Hush: its curtains come down out of the dark at the top, and a thread goes up from every world to a jar
          const fall = smooth((beat - CUT) / 6) * lift;
          for (let i = 0; i < 34; i++) {
            const x = hash(i) * G.w, len = G.h * (0.12 + 0.34 * hash(i + 50)) * fall, wd = (10 + 26 * hash(i + 90)) * u;
            const gr = c.createLinearGradient(0, 0, 0, len); gr.addColorStop(0, 'rgba(5,4,14,0.92)'); gr.addColorStop(0.7, 'rgba(10,8,26,0.5)'); gr.addColorStop(1, 'rgba(10,8,26,0)');
            c.fillStyle = gr; c.fillRect(x - wd / 2, 0, wd, len);
          }
          IDS.forEach((id, i) => {
            const p = G.at(id), a = smooth((beat - CUT - 0.4 - i * 0.75) / 1.2) * lift;
            if (a <= 0) return;
            const jx = gate.x + (i - 1.5) * 22 * ug, jy = gate.y + 64 * ug, qx = lerp(p.x, jx, 0.5), qy = Math.min(p.y, jy) - 40 * u;
            c.strokeStyle = K.rgba(COL[id], 0.5 * a); c.lineWidth = 1.2 * u; c.beginPath(); c.moveTo(p.x, p.y - p.r * 0.5); c.quadraticCurveTo(qx, qy, jx, jy); c.stroke();
            for (let n = 0; n < 6; n++) { const f = ((t * 0.5 + n / 6) % 1) * a, o = 1 - f; c.fillStyle = K.rgba(COL[id], 0.8 * a * (1 - f * 0.5)); c.beginPath(); c.arc(o * o * p.x + 2 * o * f * qx + f * f * jx, o * o * (p.y - p.r * 0.5) + 2 * o * f * qy + f * f * jy, 1.7 * u, 0, Math.PI * 2); c.fill(); }
            if (a > 0.6) { c.globalAlpha = smooth((a - 0.6) / 0.4); WORLD1.parts.jar(c, jx, jy + 12 * ug, 0.5 * ug, COL[id]); c.globalAlpha = 1; }
          });
        }
        // the worlds hum back: rings of their own colour, opening
        HUMS.forEach((ring, i) => {
          if (this.hop < ring) return;
          const since = t - this.went[ring - 1], p = G.at(IDS[i]);
          for (let n = 0; n < 3; n++) { const f = (since - n * 0.22) / 1.5; if (f <= 0 || f >= 1) continue; c.strokeStyle = K.rgba(COL[IDS[i]], 0.55 * (1 - f)); c.lineWidth = 2 * u; c.beginPath(); c.arc(p.x, p.y, p.r * (1.15 + f * 0.9), 0, Math.PI * 2); c.stroke(); }
        });
        // the rings of lamplight: the one he is on, the one Marlow has just drawn, and the last few fading behind
        if (this.state === 'play' && this.thrownAt < 0) {
          c.save(); c.globalCompositeOperation = 'screen'; c.lineCap = 'round';
          for (let i = Math.max(0, this.hop - 3); i <= Math.min(this.rings.length - 1, this.hop + 1); i++) {
            const r = this.rings[i], born = i === 0 ? 5 * BEAT : i === 1 ? 7 * BEAT : this.went[i - 2] + 0.2;
            const grow = smooth((t - born) / 0.6), a = (i <= this.hop ? Math.max(0, 1 - (this.hop - i) * 0.34) : 0.85) * (1 - drain * 0.55);
            if (grow <= 0 || a <= 0) continue;
            c.strokeStyle = `rgba(255,214,150,${0.75 * a})`; c.lineWidth = 2 * u; c.shadowColor = 'rgba(255,190,120,0.9)'; c.shadowBlur = 5 * u;
            const a0 = i > 0 ? this.ang(i, i - 1) : -Math.PI / 2;
            c.beginPath(); c.arc(r.x, r.y, r.r, a0, a0 + Math.PI * 2 * grow); c.stroke();
          }
          c.restore();
          // the white mark: where to tap
          if (this.hop < TAPS.length && t > (this.hop === 0 ? 7.5 * BEAT : this.went[this.hop - 1] + this.flight(this.hop) * 0.6)) this.mark(c, this.rings[this.hop], this.ang(this.hop, this.hop + 1), t, TAPS[this.hop] * BEAT);
          else if (this.hop >= TAPS.length && beat >= GO - 2) this.mark(c, this.rings[this.rings.length - 1], this.ang(this.rings.length - 1, this.rings.length - 2) + Math.PI * 0.6, t, GO * BEAT);
        }
        // the one ring left, by the dark Lantern
        if (this.thrownAt >= 0 && t >= this.loneReady() - 0.6 && after < 6) {
          const a = smooth((t - this.loneReady() + 0.6) / 0.8) * (after >= 0 ? 1 - smooth(after / 3) : 1);
          c.strokeStyle = `rgba(255,236,206,${0.5 * a})`; c.lineWidth = 1.6 * u; c.beginPath(); c.arc(this.lone[0], this.lone[1], 12 * ug, 0, Math.PI * 2); c.stroke();
          if (this.lastAt < 0) { const lap = Math.ceil((t - this.loneReady() - 0.2) / (4 * BEAT)); this.mark(c, { x: this.lone[0], y: this.lone[1], r: 12 * ug }, -0.6, t, this.loneReady() + Math.max(1, lap) * 4 * BEAT, a); }
        }
        // Marlow, and the glass that comes down over him
        if (this.moth && carried < 1) {
          const ms = 0.085 * ug, flap = 1 + 0.07 * Math.sin(t * 9) * (1 - caught);
          c.globalAlpha = 1 - smooth((carried - 0.7) / 0.3);
          c.drawImage(this.moth, mx - 230 * ms * flap, my - 200 * ms, 460 * ms * flap, 480 * ms);
          if (caught > 0) {
            const jw = 22 * ug, jh = 30 * ug, drop = (1 - caught) * 40 * ug;
            c.strokeStyle = `rgba(214,226,255,${0.6 * caught})`; c.lineWidth = 1.4 * u;
            c.beginPath(); c.moveTo(mx - jw, my + jh - drop); c.lineTo(mx - jw, my - jh * 0.3 - drop); c.quadraticCurveTo(mx - jw, my - jh - drop, mx, my - jh - drop); c.quadraticCurveTo(mx + jw, my - jh - drop, mx + jw, my - jh * 0.3 - drop); c.lineTo(mx + jw, my + jh - drop); c.closePath(); c.stroke();
          }
          c.globalAlpha = 1;
        }
        // the throw: a line of lamplight from his hand to the spark
        if (this.thrownAt >= 0 && t - this.thrownAt < 0.5) { const a = 1 - (t - this.thrownAt) / 0.5; c.save(); c.globalCompositeOperation = 'screen'; c.strokeStyle = `rgba(255,226,170,${0.8 * a})`; c.lineWidth = 3 * u; c.lineCap = 'round'; c.beginPath(); c.moveTo(mx, my); c.lineTo(e.x, e.y); c.stroke(); c.restore(); }
        // far up, under the Hollow: one small light under glass, tapping
        if (after >= 6) {
          const a = smooth((after - 6) / 2), since = after - 8 - (this.knocks - 1), pulse = this.knocks > 0 ? Math.max(0, 1 - since / 0.8) : 0;
          K.glow(c, this.far[0], this.far[1], (16 + 14 * pulse) * ug, [255, 200, 130], (0.55 + 0.4 * pulse) * a);
          c.fillStyle = `rgba(255,230,176,${a})`; c.beginPath(); c.arc(this.far[0], this.far[1], 1.8 * ug, 0, Math.PI * 2); c.fill();
          if (pulse > 0) { c.strokeStyle = `rgba(255,226,170,${0.6 * pulse * a})`; c.lineWidth = 1.2 * u; c.beginPath(); c.arc(this.far[0], this.far[1], (6 + (1 - pulse) * 16) * ug, 0, Math.PI * 2); c.stroke(); }
        }
        // Eko
        if (this.eko && this.state === 'play') {
          const es = 0.36 * ug, wob = t - this.wobble < 0.3 ? Math.sin((t - this.wobble) * 40) * 1.6 * u : 0;
          if (e.air) K.glow(c, e.x, e.y, 26 * ug, [255, 200, 130], 0.35);
          c.drawImage(this.eko, e.x - 150 * es + wob, e.y - 120 * es, 240 * es, 320 * es);
        } else if (this.eko) { // before the first tap: a seed of light on the wick
          K.glow(c, lamp[0], lamp[1], 20 * ug, [255, 220, 160], 0.5 + 0.2 * Math.sin(now / 400));
        }
      }
    };
    this.sky.draw(now, dt);
    this.words(G.w, G.h, G.tall, beat, after, now / 1000);
  }

  /** The white mark on a ring: a short stroke across it, brighter as the beat comes. */
  private mark(c: CanvasRenderingContext2D, r: { x: number; y: number; r: number }, a: number, t: number, at: number, alpha = 1): void {
    const u = this.u, near = 1 - Math.min(1, Math.abs(at - t) / 0.5), x = r.x + Math.cos(a) * r.r, y = r.y + Math.sin(a) * r.r, len = (4.2 + 1.6 * near) * u * this.g;
    c.save(); c.translate(x, y); c.rotate(a); c.lineCap = 'round';
    c.strokeStyle = `rgba(6,5,16,${0.75 * alpha})`; c.lineWidth = 4.2 * u; c.beginPath(); c.moveTo(-len, 0); c.lineTo(len, 0); c.stroke();
    c.strokeStyle = `rgba(255,255,255,${alpha})`; c.lineWidth = 2.1 * u; c.shadowColor = 'rgba(255,255,255,0.9)'; c.shadowBlur = (3 + 7 * near) * u; c.beginPath(); c.moveTo(-len, 0); c.lineTo(len, 0); c.stroke();
    c.restore();
  }

  /** The few words, written over the picture. */
  private words(w: number, h: number, tall: boolean, beat: number, after: number, secs: number): void {
    const c = this.ctx, dpr = this.canvas.width / Math.max(1, w), U = tall ? Math.min(w / 390, h / 844) : Math.max(0.8, Math.min(w / 1440, h / 900) * 1.15);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const say = (s: string, x: number, y: number, px: number, a: number, align: CanvasTextAlign = 'center', col = '255,241,216') => {
      if (a <= 0.003) return;
      c.font = `italic 500 ${px}px ${SERIF}`; c.textAlign = align; c.textBaseline = 'alphabetic';
      c.shadowColor = `rgba(8,6,22,${0.9 * a})`; c.shadowBlur = px * 0.5; c.fillStyle = `rgba(${col},${a})`; c.fillText(s, x, y); c.fillText(s, x, y); c.shadowBlur = 0;
    };
    const win = (a: number, b: number) => smooth((beat - a) / 1.2) * (1 - smooth((beat - b) / 1.2));
    const x = w / 2, y = tall ? h * 0.905 : h * 0.9;
    if (this.state === 'wait') say('tap, and the lamp is lit', x, y, 22 * U, 0.7 + 0.2 * Math.sin(secs * 1.6));
    else {
      say('Tap as the spark crosses the white mark.', x, y, 20 * U, this.hop < 2 ? win(5, 99) : 1 - smooth((secs - this.wordsOff(secs)) / 0.8));
      say('“With the beat, little spark. Not before it.”', x, y, 21 * U, win(21.5, 31));
      say('“Go.”', x, tall ? h * 0.3 : h * 0.3, 30 * U, win(78, 83));
      if (after >= 4.5) {
        const a = smooth((after - 4.5) / 2) * (1 - smooth((after - 21) / 2));
        say('Four songs. One keeper. A long way up.', tall ? w / 2 : w * 0.1, tall ? h * 0.2 : h * 0.26, (tall ? 22 : 30) * U, a, tall ? 'center' : 'left');
      }
      if (after >= 12) { // the title writes itself
        const a = smooth((after - 12) / 3) * (1 - smooth((after - 21) / 2));
        if (tall) this.title.wordmark(w * 0.5, h * 0.44, 104 * U, 'center', a, secs); else this.title.wordmark(w * 0.1, h * 0.52, 190 * U, 'left', a, secs);
      }
      if (this.again) say('skip', w - 22, 40, 16, 0.8, 'right', '230,207,174');
    }
    c.textAlign = 'left';
  }
  private offAt = -1;
  /** the first instruction goes once he has hopped twice */
  private wordsOff(secs: number): number { if (this.hop >= 2 && this.offAt < 0) this.offAt = secs; if (this.hop < 2) this.offAt = -1; return this.offAt < 0 ? secs : this.offAt; }
}
