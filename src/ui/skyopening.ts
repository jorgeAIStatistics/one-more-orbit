// The opening (the owner's storyboard, built as written): THE DRIFTING EDGE.
// Pitch black. An ember tumbles in and comes down on a dead planetoid; his light almost goes out. Thump-thump, and a
// music box from very far away: he is up, he turns, and across the dark are three shattered rings of shadow, the
// guardian under them, and one pulse of gold that the dark closes over. "He's still out there." The camera comes
// down behind him: a path of sleeping stone, one dull Star-Node. A pulse begins; a golden ring goes out from him and
// comes back on every beat; he lifts, leaning toward the node; the word "tap". The world waits, as long as it takes.
// The first tap: a chord, the song, the arc, the strike, colour running out over the stone, and the camera turning
// up into the game, which is already playing underneath. Nothing is loaded on that tap: it only starts things.
//
// Time here is the audio clock's (the scene and its sound are one thing), so if the app is put away both stop together.
import openingAudio from '../../levels/opening/audio.json';
import bedAudio from '../../levels/startedbed/audio.json';
import { audio, type LoadedTrack } from '../audio/audio';
import { CANON } from '../art/canonpaint.js';
import { DUSK, K } from '../art/painter.js';
import type { AudioMeta } from '../game/types';
import { save } from '../save';
import { Actor } from './actor';
import { OPENING_PICS, paintOpening, type OpeningPic } from '../art/openingpaint';
import { paintWorker } from '../art/paintcache';



const META = openingAudio as AudioMeta;
/** the first stage's own song, from its first second to where its drums come in: what the scene is played over */
const SONG = bedAudio as AudioMeta;
const T = DUSK.tools, P = CANON.parts;
const SERIF = '"Cormorant Garamond", "Hoefler Text", Baskerville, Palatino, Georgia, serif';
const H = 1688;                 // the scene is painted on a canvas this tall (the approved stills' size); its width follows the screen
const SPB = 0.8;                // the pulse: two to a bar of the first stage's song (150 BPM, felt at half that)
// where each piece of sound is in the file (tools/opening.py), and when the scene uses it
const BED = 0, PULSE = 24, NOTE = 30, CHORD = 36, LOOP = 4 * SPB;
// the song's quiet opening is sixteen bars (25.6 s): it starts so that its drums would come in as "tap" appears, and
// its last eight bars go round until the tap comes. The pulse and the note fall on the song's own beats.
const SONG_LEN = 25.6, SONG_ROUND = 12.8;
/** how far up the path the first Star-Node is, and the ones that light after it */
const NODE = 0.34, CHAIN = [0.47, 0.58, 0.67, 0.75];
const T_READY = 28.2, T_SONG = T_READY - SONG_LEN, T_PULSE = T_SONG + 22 * SPB, T_NOTE = T_PULSE + 2 * LOOP;
const THUMPS = [10.0, 10.32, 12.0, 12.32];
const GOLD: [number, number, number] = [255, 214, 130];
const smooth = (x: number) => { const t = x < 0 ? 0 : x > 1 ? 1 : x; return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (x: number, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const out = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
type Shot = 'fall' | 'close' | 'far' | 'path';
type Bg = Shot | 'woke';

export class SkyOpening {
  /** painting its pictures; waiting for a first touch (sound cannot start without one); playing; the first tap's bloom over the game; over */
  state: 'paint' | 'wait' | 'scene' | 'bloom' | 'done' = 'paint';
  /** a replay from the still pool: it can be skipped, and its tap starts no level */
  again = false;
  /** the level behind the first tap is ready to start at once (the game says so) */
  armed = false;
  /** the first tap: when it happened, and the audio-clock time the song must start at */
  onTap: (perfMs: number, when: number) => void = () => undefined;
  onDone: () => void = () => undefined;
  private ctx: CanvasRenderingContext2D;
  private bg: Partial<Record<Bg, CanvasImageSource>> = {};
  private mist: CanvasImageSource | null = null;
  private key = '';
  private W = 780; private k = 1; private q = 1;
  private track: LoadedTrack | null = null;
  private song: LoadedTrack | null = null;
  private t0 = 0;            // audio-clock time of the scene's first moment
  private perf0 = 0;         // the page's clock for the same, when there is no sound to keep time by
  private own = false;       // (and whether that is the clock in use)
  private touched = false;
  private parts: Array<{ stop: (fade?: number, at?: number) => void }> = [];
  private orbin = new Actor('orbin');
  private shot: Shot | '' = '';
  private trail: Array<[number, number]> = [];
  private motes: Array<{ x: number; y: number; vx: number; vy: number; born: number; life: number; cold: boolean }> = [];
  private bounced = 0;
  private tapAt = -1;
  private last = 0;
  private dust: Array<{ a: number; v: number; r: number; up: number; blue: boolean }> = [];
  private token = 0;
  private waitFrom = 0;
  private touchAt = 0;

  constructor(private canvas: HTMLCanvasElement) { this.ctx = canvas.getContext('2d')!; }

  /** Back to the very beginning. Paints its pictures (a second or so, in the dark the scene opens on) and loads its sound. */
  reset(again = false): void {
    this.stop();
    const token = ++this.token;
    Object.assign(this, { state: 'paint', again, armed: false, perf0: 0, own: false, touched: false, waitFrom: 0, touchAt: 0, shot: '', trail: [], motes: [], bounced: 0, tapAt: -1, last: 0 });
    this.orbin = new Actor('orbin');
    if (audio.prime()) { void audio.loadTrack(META).then((t) => { if (token === this.token) this.track = t; }, () => undefined); void audio.loadTrack(SONG).then((t) => { if (token === this.token) this.song = t; }, () => undefined); }
    this.paint(token);
  }
  /** Leaves at once. */
  stop(): void { for (const p of this.parts) p.stop(0.25); this.parts = []; }
  /** Lets go of its pictures (they are a lot of memory, and the opening is seen once). */
  private free(): void { this.bg = {}; this.mist = null; this.key = ''; }

  /** How much of the game underneath the bloom still hides, 1..0. */
  get cover(): number { return this.state === 'bloom' ? 1 - smooth(((performance.now() - this.tapAt) / 1000 - 1.25) / 0.8) : this.state === 'done' ? 0 : 1; }
  /** Is the picture dark just now (before it starts, or between two shots)? The game spends its heavy moments here. */
  get dark(): boolean { if (this.state === 'paint' || this.state === 'wait') return true; const t = this.time(performance.now()); return t < 0.3 || Math.abs(t - 6.25) < 0.12 || Math.abs(t - 13.0) < 0.12 || (t > 22 && t < 27); }
  /** Is the prompt up: will a tap now be the first tap? */
  get ready(): boolean { return this.state === 'scene' && this.armed && this.time(performance.now()) >= T_READY; }

  // ---------------------------------------------------------------- the pictures, painted once
  private size(): void {
    const w = window.innerWidth, h = window.innerHeight;
    this.W = Math.max(780, Math.round((H * w) / h));
    this.k = this.canvas.height / H;
    this.q = Math.min(1, this.k, Math.sqrt(2.3e6 / (this.W * H)));
  }
  private sheet(hgt = H): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const cv = document.createElement('canvas');
    cv.width = Math.round(this.W * this.q); cv.height = Math.round(hgt * this.q);
    const c = cv.getContext('2d')!; c.scale(this.q, this.q);
    return [cv, c];
  }
  /** how the path is set for this screen: on a wide one it keeps a phone's width, in the middle */
  private get lane(): { wide: number; bend: number } { const f = 780 / this.W; return { wide: 0.22 * f, bend: 0.3 * f }; }
  private at(t: number): [number, number, number] { return CANON.along(this.W, H, H * 0.42, t, this.lane.bend); }
  private paint(token: number): void {
    this.size();
    const W = this.W, key = `${W}@${this.q.toFixed(3)}`;
    this.key = key; this.bg = {}; this.mist = null;
    const R = K.RNG;
    const pics: OpeningPic[] = [...OPENING_PICS];
    const put = (name: OpeningPic, img: CanvasImageSource): void => { if (name === 'mist') this.mist = img; else this.bg[name] = img; };
    const done = (): void => { if (this.state === 'paint') this.state = 'wait'; };
    // in a worker (off the main thread: nothing stalls), each picture as it is finished; else on the page, one a turn
    const wk = paintWorker();
    if (wk) {
      let left = pics.length;
      const on = (e: MessageEvent<{ id: number; name: OpeningPic; bmp: ImageBitmap }>): void => {
        if (e.data.id !== token) return;
        put(e.data.name, e.data.bmp);
        if (--left === 0) { wk.removeEventListener('message', on); done(); }
      };
      wk.addEventListener('message', on);
      for (const name of pics) wk.postMessage({ id: token, kind: 'opening', name, W, q: this.q });
    } else {
      const next = (): void => { if (token !== this.token) return; const name = pics.shift(); if (!name) { done(); return; } put(name, paintOpening(name, W, this.q, (w, h) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }) as HTMLCanvasElement); window.setTimeout(next, 0); };
      window.setTimeout(next, 0);
    }
    // the first tap's stardust: where each mote goes
    const r = R(91); this.dust = [];
    for (let i = 0; i < 120; i++) this.dust.push({ a: r() * Math.PI * 2, v: 160 + r() * r() * 760, r: 1.4 + r() * 4.2, up: 60 + r() * 260, blue: r() < 0.3 });
  }

  // ---------------------------------------------------------------- time and sound
  /** Seconds into the scene, as heard. */
  private time(perfMs: number): number {
    if (this.state === 'paint' || this.state === 'wait') return -1;
    if (this.own || !audio.ctx) return (perfMs - this.perf0) / 1000;
    return audio.ctxTimeAt(perfMs) - this.t0 - audio.latency() - save.audioOffset / 1000;
  }
  private begin(now: number): void {
    this.state = 'scene';
    const c = audio.ctx;
    audio.setVolumes(save.music, save.sfx);
    if (!c || !audio.running || !this.track) { this.own = true; this.perf0 = now + 150; return; } // no sound: the page's own clock keeps the time
    const t0 = (this.t0 = c.currentTime + 0.15), tr = this.track;
    const pulse = audio.playPart(tr, META, t0 + T_PULSE, PULSE, { loop: LOOP, gain: 0.55 });
    pulse.gain.linearRampToValueAtTime(1, t0 + T_READY); // it comes nearer
    const note = audio.playPart(tr, META, t0 + T_PULSE, NOTE, { loop: LOOP, gain: 0 });
    note.gain.setValueAtTime(0, t0 + T_NOTE - 0.06); note.gain.linearRampToValueAtTime(1, t0 + T_NOTE - 0.01);
    this.parts = [audio.playPart(tr, META, t0, BED, { dur: 22 }), pulse, note];
    if (this.song) { // the song itself, from nothing: it is what the tap will wake
      const bed = audio.playPart(this.song, SONG, t0 + T_SONG, 0, { loopAt: SONG_ROUND, loop: SONG_LEN - SONG_ROUND, gain: 0.9 });
      this.parts.push(bed);
    }
  }
  /** For tests and stills: be at second `t` of the scene (its sound does not follow). */
  seek(t: number): void {
    if (this.state === 'paint' || this.state === 'bloom' || this.state === 'done') return;
    this.stop(); this.state = 'scene'; this.own = true; this.perf0 = performance.now() - t * 1000; this.shot = '';
  }

  /** The one button. */
  tap(perfMs: number, x = -1, y = -1): void {
    if (this.state === 'done' || this.state === 'bloom' || this.state === 'paint') { if (this.state === 'paint') { this.touched = true; audio.ensure(); } return; }
    if (this.again && x > window.innerWidth - 96 && y >= 0 && y < 70) { this.finish(); return; }
    if (this.state === 'wait') { this.touched = true; audio.ensure(); return; }
    if (!this.ready) return;
    // the first tap. Everything is already here: this only starts it, on the audio clock, at once.
    const c = audio.ctx, live = !!c && audio.running && !!this.track;
    const when = live ? c!.currentTime + 0.03 : 0;
    for (const p of this.parts) p.stop(0.05, when);
    this.parts = live ? [audio.playPart(this.track!, META, when, CHORD, { dur: 5 })] : [];
    this.tapAt = perfMs;
    this.state = 'bloom';
    this.onTap(perfMs, when);
  }
  private finish(): void {
    if (this.state === 'done') return;
    this.stop(); this.state = 'done'; this.free(); this.onDone();
  }

  // ---------------------------------------------------------------- drawing
  private words(s: string, x: number, y: number, px: number, a: number, color = '#fff1d8', align: CanvasTextAlign = 'center'): void {
    if (a <= 0.004) return;
    const c = this.ctx, size = Math.max(px, 13.5 / (this.k / (this.canvas.height / window.innerHeight))); // never under 13 points on the screen
    c.save(); c.font = `italic 500 ${size}px ${SERIF}`; c.textAlign = align; c.textBaseline = 'alphabetic';
    c.shadowColor = 'rgba(4,4,14,0.9)'; c.shadowBlur = size * 0.5; c.globalAlpha = a; c.fillStyle = color;
    c.fillText(s, x, y); c.fillText(s, x, y); c.restore();
  }
  private put(name: Bg, a = 1, dy = 0): void {
    const b = this.bg[name]; if (!b || a <= 0) return;
    const c = this.ctx; c.globalAlpha = a; c.drawImage(b, 0, dy, this.W, H); c.globalAlpha = 1;
  }
  /** a ring lying on the ground (seen at an angle) */
  private flat(x: number, y: number, r: number, col: number[], a: number, wd: number): void {
    if (a <= 0 || r <= 0) return;
    const c = this.ctx; c.save(); c.translate(x, y); c.scale(1, 0.42); c.strokeStyle = K.rgba(col, a); c.lineWidth = wd; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke(); c.restore();
  }
  private cut(shot: Shot): boolean { const first = this.shot !== shot; this.shot = shot; return first; }

  /** The scene, up to the tap. */
  draw(now: number): void {
    const c = this.ctx, dt = Math.min(0.05, this.last ? (now - this.last) / 1000 : 0.016);
    this.last = now;
    this.size();
    const W = this.W;
    c.setTransform(this.k, 0, 0, this.k, 0, 0);
    c.globalAlpha = 1; c.fillStyle = '#020208'; c.fillRect(0, 0, W, H);
    if (this.state === 'paint' || this.state === 'wait') {
      this.put('fall');
      // sound cannot begin without a touch (the browser's rule): if it is already running (the app), the scene simply starts
      if (this.state === 'wait') {
        const sound = !!audio.ctx && audio.running && !!this.track;
        if (!this.waitFrom) this.waitFrom = now;
        if (this.touched && !this.touchAt) this.touchAt = now;
        // it starts when its sound can; with no sound to be had (none on this device, or still none two seconds after the touch), it starts without
        if (sound || !audio.ctx || (this.touched && now - this.touchAt > 2000)) { this.begin(now); return; }
        if (!this.touched && now - this.waitFrom > 500) this.words('touch to begin', W / 2, H * 0.56, 36, 0.5 + 0.3 * Math.sin(now / 520), '#ffffff');
      }
      return;
    }
    const t = this.time(now);
    if (this.state === 'bloom' || this.state === 'done') return;
    if (t < 6.25) this.fall(t, dt);
    else if (t < 13.0) this.close(t, dt);
    else if (t < 19.8) this.far(t, dt, 0);
    else {
      const u = smooth((t - 19.8) / 1.9), dy = H * 0.32;
      if (u < 1) { c.save(); c.translate(0, -dy * u); this.far(t, dt, u); c.restore(); }
      c.save(); c.translate(0, dy * (1 - u)); this.path(t, dt, u); c.restore();
    }
    // between shots the dark closes for a moment (it is never far)
    for (const tc of [6.25, 13.0]) { const v = 1 - Math.abs(t - tc) / 0.42; if (v > 0) { c.globalAlpha = smooth(v); c.fillStyle = '#020208'; c.fillRect(0, 0, W, H); c.globalAlpha = 1; } }
    if (t < 0.6) { c.globalAlpha = 1 - smooth(t / 0.6); c.fillStyle = '#020208'; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
    if (this.again) this.words('skip', W - 44, 70, 30, 0.6, '#e6cfae', 'right');
  }

  /** 0:00. Pitch black; the ember tumbles in, bounces on cold stone, rolls to a stop. */
  private fall(t: number, dt: number): void {
    const c = this.ctx, W = this.W, hy = H * 0.8, R = W * 2.1;
    const ground = (x: number) => hy + R - Math.sqrt(R * R - (x - W / 2) * (x - W / 2)) + 12;
    const z = 1 + 0.14 * smooth(t / 6.2);
    c.save(); c.translate(W * 0.55, hy); c.scale(z, z); c.translate(-W * 0.55, -hy);
    this.put('fall');
    // where he is
    let x: number, y: number, g = 0.75, on = t > 0.5;
    const hop = (a: number, b: number, x0: number, x1: number, hgt: number): void => { const s = (t - a) / (b - a); x = lerp(x0, x1, s); y = ground(x) - 4 * hgt * s * (1 - s); };
    x = 0; y = 0;
    if (t < 4.5) { const s = clamp((t - 0.5) / 4.0); x = lerp(-60, W * 0.44, Math.pow(s, 0.85)) + Math.sin(t * 7) * 7; y = lerp(H * 0.07, ground(W * 0.44), Math.pow(s, 2.1)) + Math.cos(t * 9) * 5; }
    else if (t < 5.15) { hop(4.5, 5.15, W * 0.44, W * 0.53, 86); g = 0.55; }
    else if (t < 5.6) { hop(5.15, 5.6, W * 0.53, W * 0.585, 34); g = 0.42; }
    else { const s = out((t - 5.6) / 0.6); x = lerp(W * 0.585, W * 0.615, s); y = ground(x); g = lerp(0.36, 0.22, s); }
    g *= 0.82 + 0.18 * Math.sin(t * 31) * Math.sin(t * 7.3); // he gutters as he tumbles
    const hits = t >= 5.6 ? 3 : t >= 5.15 ? 2 : t >= 4.5 ? 1 : 0;
    if (hits > this.bounced) { // cold dust where he strikes
      this.bounced = hits;
      for (let i = 0; i < 12 - hits * 3; i++) this.motes.push({ x, y, vx: (hash(i + hits * 9) - 0.5) * 260, vy: -40 - hash(i * 3 + hits) * 170, born: t, life: 0.5 + hash(i * 7) * 0.5, cold: true });
    }
    if (on) {
      // sparks come off him as he falls
      if (t < 5.7 && hash(Math.floor(t * 60)) < 0.5) this.motes.push({ x, y, vx: -60 - hash(t * 91) * 80, vy: -20 + (hash(t * 53) - 0.5) * 60, born: t, life: 0.5 + hash(t * 17) * 0.7, cold: false });
      this.trail.push([x, y]); if (this.trail.length > 26) this.trail.shift();
    }
    c.lineCap = 'round';
    for (let i = 1; i < this.trail.length; i++) { const u = i / this.trail.length, a = this.trail[i - 1], b = this.trail[i]; c.strokeStyle = `rgba(255,190,110,${u * u * 0.5 * g})`; c.lineWidth = 9 * u; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
    this.drawMotes(t, dt);
    if (on) { K.glow(c, x, y, 90 * (0.5 + g), [255, 200, 120], 0.55 * g + 0.1); c.fillStyle = `rgba(255,236,190,${0.5 + 0.5 * g})`; c.beginPath(); c.arc(x, y, 5.5, 0, Math.PI * 2); c.fill(); }
    c.restore();
  }
  private drawMotes(t: number, dt: number): void {
    const c = this.ctx;
    this.motes = this.motes.filter((m) => t - m.born < m.life);
    for (const m of this.motes) {
      m.x += m.vx * dt; m.y += m.vy * dt; m.vy += (m.cold ? 420 : 60) * dt; m.vx *= 1 - dt * 1.5;
      const a = 1 - (t - m.born) / m.life;
      c.fillStyle = m.cold ? `rgba(150,165,205,${a * 0.5})` : `rgba(255,214,150,${a * 0.9})`;
      c.beginPath(); c.arc(m.x, m.y, m.cold ? 2.6 : 2, 0, Math.PI * 2); c.fill();
    }
  }

  /** 0:06. He has rolled to a stop: his light flickers, dims, almost goes out. 0:10 thump-thump: he is up, and turns. */
  private close(t: number, dt: number): void {
    const c = this.ctx, W = this.W, hy = H * 0.62, o = this.orbin;
    const first = this.cut('close');
    const z = 1 + 0.05 * smooth((t - 6.2) / 7);
    c.save(); c.translate(W * 0.5, hy + 60); c.scale(z, z); c.translate(-W * 0.5, -hy - 60);
    this.put('close');
    // his heart: each thump lights it
    let hb = 0; for (const th of THUMPS) if (t >= th) hb = Math.max(hb, Math.exp(-(t - th) * 5));
    // lying there
    const fl = 0.5 + 0.5 * Math.sin(t * 23) * Math.sin(t * 7.1);
    let glow = t < 7.4 ? 0.3 + 0.08 * fl : t < 8.8 ? lerp(0.3, 0.13, (t - 7.4) / 1.4) + 0.05 * fl : t < 9.6 ? (Math.sin(t * 17) > 0.2 ? 0.14 : 0.05) : 0.035;
    if (t < 10.32) {
      if (t >= 10) glow = 0.5;
      o.set({ x: W * 0.51, y: hy + 150, s: 1.25, rot: 1.25, glow, eyes: t >= 10.05 ? 'wide' : 'closed', crest: 0, arms: 'rest', ring: false, lean: 0, look: [0, 0], beat: hb, face: 1, back: false }, first);
      o.glow = glow; // (his light gutters by itself: nothing eases it)
    } else {
      o.rate = 3.2;
      o.set({ x: W * 0.5, y: hy + 70, s: 1.5, rot: 0, glow: 0.88, eyes: t < 11.9 ? 'wide' : 'open', crest: 0.9, arms: t < 12.2 ? 'chest' : 'rest', ring: t >= 10.95, lean: t < 11.9 ? 0 : 0.12, look: t < 11.9 ? [0, -0.1] : [0.8, -0.6], beat: hb });
    }
    // his orbit, come off, lying by him; it goes back to him when he stands
    const ra = 1 - smooth((t - 10.5) / 0.5);
    if (ra > 0) { c.save(); c.translate(W * 0.6, hy + 196); c.rotate(0.1); c.strokeStyle = `rgba(230,220,200,${0.2 * ra + 0.25 * hb * ra})`; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 0, 62, 14, 0, 0, Math.PI * 2); c.stroke(); c.restore(); }
    // thump-thump: a ring of light goes out from him
    for (const th of THUMPS) { const age = t - th; if (age > 0 && age < 1.1) { c.strokeStyle = K.rgba(GOLD, 0.42 * (1 - age / 1.1)); c.lineWidth = 3; c.beginPath(); c.arc(o.x, o.y - 10, 60 + age * 240, 0, Math.PI * 2); c.stroke(); } }
    o.step(dt); o.draw(c);
    c.restore();
  }

  /** 0:13. Across the dark: the three rings, the guardian, and one pulse of gold, swallowed. "He's still out there." */
  private far(t: number, dt: number, leaving: number): void {
    const c = this.ctx, W = this.W, hy = H * 0.74, o = this.orbin;
    const first = this.cut(leaving > 0.5 ? 'path' : 'far') && leaving <= 0.5;
    const z = 1 + 0.06 * smooth((t - 13) / 7);
    c.save(); c.translate(W * 0.58, 520); c.scale(z, z); c.translate(-W * 0.58, -520);
    this.put('far');
    // his brother's light, behind the rings: one pulse, and the dark mist closes over it
    const sx = W * 0.6, sy = 520, born = smooth((t - 13.7) / 0.3), gone = smooth((t - 15.2) / 1.1), sa = born * (1 - gone);
    if (sa > 0) {
      const p = Math.exp(-Math.max(0, t - 14.0) * 2.2) * (t >= 14 ? 1 : 0);
      K.glow(c, sx, sy, 34 + 90 * p, [255, 200, 110], (0.7 + 0.3 * p) * sa);
      c.fillStyle = `rgba(255,243,207,${sa})`; c.beginPath(); c.arc(sx, sy, 4 + 3 * p, 0, Math.PI * 2); c.fill();
      for (let k2 = 0; k2 < 2; k2++) { const age = t - 14.0 - k2 * 0.22; if (age > 0 && age < 1.6) { c.strokeStyle = K.rgba(GOLD, 0.55 * (1 - age / 1.6) * sa); c.lineWidth = 2.4; c.beginPath(); c.arc(sx, sy, 24 + age * 130, 0, Math.PI * 2); c.stroke(); } }
    }
    if (this.mist && t > 14.9) { c.globalAlpha = smooth((t - 14.9) / 1.5); c.drawImage(this.mist, 0, 210, W, 620); c.globalAlpha = 1; }
    c.restore();
    o.rate = 4;
    if (leaving <= 0.5) {
      o.set({ x: W * 0.32, y: hy + 190, s: 1.35, rot: 0, glow: 0.82, crest: t < 16.6 ? 0.85 : 0.6, lean: t < 14.3 ? 0.14 : t < 16.6 ? 0.3 : t < 18.4 ? 0.1 : 0.24, look: [1, -0.5], eyes: t < 14.05 ? 'open' : t < 14.6 ? 'wide' : t < 18.4 ? 'worried' : 'set', arms: t < 14.5 ? 'rest' : t < 16.5 ? 'reach' : t < 18.4 ? 'chest' : 'rest', ring: true, face: 1, back: false, beat: 0.4 + 0.3 * Math.sin(t * 5) }, first);
      o.step(dt);
      c.globalAlpha = 1 - smooth(leaving / 0.45); o.draw(c); c.globalAlpha = 1;
    }
    const wa = smooth((t - 16.6) / 0.9) * (1 - smooth((t - 19.0) / 0.8));
    this.words('He’s still out there.', W / 2, H * 0.24, 46, wa);
  }

  /** 0:20. Behind him: the path, one dull Star-Node. A pulse; a ring that goes out from him and comes back; he lifts. "tap". */
  private path(t: number, dt: number, arrived: number): void {
    const c = this.ctx, W = this.W, o = this.orbin;
    this.put('path', smooth(arrived / 0.5));
    if (arrived < 0.5) return;
    const first = this.cut('path') || o.back === false;
    const ready = t >= T_READY && this.armed, lift = t >= T_READY - 0.7;
    const beats = (t - T_PULSE) / SPB, ph = beats >= 0 ? beats - Math.floor(beats) : 1, on = beats >= 0 ? Math.exp(-ph * 4.5) : 0;
    const [nx, ny, ns] = this.at(NODE);
    // the node: it echoes the beat weakly while it sleeps; then the golden ring closes on its edge, beat after beat
    const echo = t >= 24 ? on * 0.75 : 0;
    P.node(c, nx, ny, 2.1 * ns, { lit: 0, flash: lift ? Math.max(echo, 0.35) : echo, cue: ready ? Math.pow(1 - ph, 1.25) : -1 });
    for (const pt of CHAIN) { const [x, y, sc] = this.at(pt); P.node(c, x, y, 2.1 * sc, { lit: 0 }); }
    // the ring that goes out from him on the beat, and comes back
    const gy = H * 0.955;
    if (t >= 24) { const s = Math.sin(Math.PI * ph), fade = smooth((t - 24) / 1.2); this.flat(W * 0.5, gy, 70 + 250 * s, GOLD, 0.6 * (0.35 + 0.65 * (1 - ph)) * fade, 5); this.flat(W * 0.5, gy, 70 + 250 * s * 0.6, GOLD, 0.25 * fade, 3); }
    c.fillStyle = `rgba(0,0,0,${lift ? 0.36 : 0.2})`; c.beginPath(); c.ellipse(W * 0.5, gy, lift ? 50 : 68, lift ? 11 : 15, 0, 0, Math.PI * 2); c.fill();
    o.rate = 3.4;
    o.set({ x: W * 0.5, y: lift ? H * 0.845 : H * 0.89, s: lift ? 1.3 : 1.36, rot: 0, glow: 0.78 + 0.2 * on, crest: lift ? 1 : 0.8, arms: lift ? 'back' : 'rest', lean: 0, look: [0, -0.8], eyes: 'set', ring: true, back: true, face: 1, beat: on }, first);
    o.step(dt); o.draw(c);
    if (ready) this.words('tap', nx, ny - 96, 60, 0.62 + 0.38 * Math.exp(-ph * 3), '#ffffff'); // white: tap here
  }

  /**
   * The first tap, over the game (which is already running underneath): the arc, the strike, colour running out over
   * the stone, node after node lighting toward the horizon, and the camera turning up into the play view.
   */
  drawOver(now: number): void {
    if (this.state !== 'bloom') return;
    const c = this.ctx, W = this.W, o = this.orbin, tau = (now - this.tapAt) / 1000, dt = Math.min(0.05, this.last ? (now - this.last) / 1000 : 0.016);
    this.last = now;
    this.size();
    if (tau > 4.9) { this.finish(); return; }
    c.setTransform(this.k, 0, 0, this.k, 0, 0);
    const cover = 1 - smooth((tau - 1.25) / 0.8);
    if (cover > 0.002) {
      const e = 1 - cover, hy = H * 0.42, [nx, ny, ns] = this.at(NODE), hit = 0.2, age = tau - hit;
      c.save();
      c.globalAlpha = cover;
      c.translate(W / 2, hy); c.scale(1 + 0.55 * e, 1 + 0.55 * e); c.translate(-W / 2, -hy + H * 0.2 * e); // the camera rises: the land falls away under it
      this.put('path', cover);
      if (age > 0) {
        // colour runs out from where he struck
        const rr = out(age / 1.5) * Math.hypot(W, H) * 1.15;
        c.save(); c.beginPath(); c.ellipse(nx, ny, rr, rr * 0.78, 0, 0, Math.PI * 2); c.clip(); this.put('woke', cover); c.restore();
        c.globalAlpha = cover;
        c.strokeStyle = `rgba(255,236,190,${0.7 * (1 - clamp(age / 1.3))})`; c.lineWidth = 10; c.beginPath(); c.ellipse(nx, ny, rr, rr * 0.78, 0, 0, Math.PI * 2); c.stroke();
        for (let i = 0; i < 4; i++) { const a2 = age - i * 0.09; if (a2 > 0 && a2 < 1.3) this.flat(nx, ny, 80 + a2 * 1500, i % 2 ? [150, 190, 255] : GOLD, 0.85 * (1 - a2 / 1.3), 9 - i * 1.6); }
      }
      // the nodes: the one he struck, and the chain of them lighting toward the horizon, one a beat
      CHAIN.forEach((pt, i) => { const [x, y, s] = this.at(pt), since = tau - hit - (i + 1) * SPB; P.node(c, x, y, 2.1 * s, { lit: age > 0 ? smooth(since / 0.25) : 0, flash: since > 0 ? Math.exp(-since * 5) : 0 }); if (since > 0 && since < 0.7) this.flat(x, y, 60 * s + since * 500 * s, GOLD, 0.7 * (1 - since / 0.7), 5 * s); });
      P.node(c, nx, ny, 2.1 * ns, { lit: age > 0 ? 1 : 0, flash: age > 0 ? Math.exp(-age * 4) : 1, cue: age > 0 ? -1 : 0 });
      if (age > 0) {
        K.glow(c, nx, ny, 520 * (1 + age), [255, 220, 150], 0.95 * Math.exp(-age * 2.6));
        // stardust
        const fall = 1 - Math.exp(-age * 2.2);
        for (const d of this.dust) { const a2 = 1 - clamp(age / 2.2); if (a2 <= 0) break; c.fillStyle = d.blue ? `rgba(170,205,255,${a2})` : `rgba(255,${214 + Math.round(d.r * 8)},${150 + Math.round(d.r * 18)},${a2})`; c.beginPath(); c.arc(nx + Math.cos(d.a) * d.v * fall, ny - 30 + Math.sin(d.a) * d.v * fall * 0.6 - d.up * fall + 90 * age * age, d.r * (1 - 0.4 * age / 2.2), 0, Math.PI * 2); c.fill(); }
      }
      // Orbin: the arc into the node; then on, along the path, as the tempo takes him
      o.rate = 9;
      if (age <= 0) {
        const s = out(tau / hit), u = 1 - s, bx = u * u * W * 0.5 + 2 * u * s * W * 0.47 + s * s * nx, by = u * u * H * 0.845 + 2 * u * s * H * 0.6 + s * s * (ny - 70);
        o.set({ x: bx, y: by, s: lerp(1.3, 0.95, s), lean: 0.1, arms: 'back', crest: 1, glow: 1, beat: 1 }, true);
        { const g = c.createLinearGradient(W * 0.5, H * 0.845, bx, by); g.addColorStop(0, 'rgba(255,214,130,0)'); g.addColorStop(1, 'rgba(255,226,160,0.75)'); c.strokeStyle = g; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(W * 0.5, H * 0.845); c.quadraticCurveTo(lerp(W * 0.5, bx, 0.4) - 20, lerp(H * 0.845, by, 0.5) - 60 * s, bx, by); c.stroke(); }
      } else {
        const g = smooth((age - 0.3) / 1.6), [ex, ey, es] = this.at(lerp(NODE, 0.7, g)), k0 = ns;
        o.set({ x: ex + 24 * (es / k0) * g, y: ey - (70 + 50 * g) * (es / k0), s: 0.95 * (es / k0), lean: 0.5 * g, arms: age < 0.5 ? 'up' : 'back', crest: 1, glow: 1, beat: 1 }, age < 0.05);
      }
      o.step(dt); o.draw(c);
      c.restore();
      c.globalAlpha = 1;
    }
    // written over the game as it arrives
    this.words('Wake the stars.', W > 1200 ? W * 0.2 : W / 2, H * 0.2, 46, smooth((tau - 1.5) / 0.6) * (1 - smooth((tau - 4.1) / 0.7)) * 0.94);
  }
}
