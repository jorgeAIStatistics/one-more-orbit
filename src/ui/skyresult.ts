// The results, Afterglow ("Daybreak"): you are under the planet's own sky. Its colour rises from the horizon as far
// as the song got; on a clear it reaches the top, and on a first clear it blazes. The few things worth knowing are
// written into the picture a line at a time. No panel, no tiles, no buttons: a tap anywhere flies the song again,
// one quiet line leads back to the galaxy, and one opens more about the run.
import { K } from '../art/painter.js';
import { RESULTS } from '../art/resultpaint.js';

const Y = RESULTS.LAYERS;
const SERIF = '"Cormorant Garamond", "Hoefler Text", Baskerville, Palatino, Georgia, serif';
const FIGS = `"Cormorant Lining", ${SERIF}`;
const CREAM = '255,241,216', SAND = '230,207,174';
const smooth = (x: number) => { const t = x < 0 ? 0 : x > 1 ? 1 : x; return t * t * (3 - 2 * t); };
type Dev = 'phone' | 'desktop';

export interface ResultInfo {
  /** whose sky it is: heroes, skyhigh, blank, invincible or royalty (a moon has its planet's) */
  world: string;
  name: string;
  song: string;
  /** "practice" or "autoplay", or nothing */
  tag: string;
  pct: number;
  cleared: boolean;
  /** the first counted clear: the sky blazes */
  first: boolean;
  /** this world's colour was already home before the run */
  home: boolean;
  /** kept shards, or null where there are none to find (a moon) */
  shards: boolean[] | null;
  fresh: boolean[];
  shardLine: string;
  /** what the run changed, most important first */
  lines: string[];
  /** more about the run, shown only when asked for */
  more: string[];
  /** the one-tap sync fix on offer, in a few words, or '' */
  fix: string;
}
export type ResultTap = 'again' | 'galaxy' | 'more' | 'fix' | 'check' | 'wait';
interface Layers { cold: HTMLCanvasElement | null; warm: HTMLCanvasElement | null; blaze: HTMLCanvasElement | null; front: { mask: HTMLCanvasElement; lip: HTMLCanvasElement; y: number } | null }
interface Hit { x: number; y: number; w: number; h: number; kind: ResultTap }

export class SkyResult {
  private ctx: CanvasRenderingContext2D;
  private cache = new Map<string, Layers>();
  private tmp = document.createElement('canvas');
  private eko: HTMLCanvasElement | null = null;
  private ekoKey = '';
  private jobs: Array<() => void> = [];
  private hits: Hit[] = [];
  private t0 = -1;      // when the picture was ready and the colour began to rise (seconds); -1 = not yet
  private now = 0;
  private all = false;  // a tap has brought everything in at once
  private open = false; // "more about this run" is showing
  private openAt = 0;
  private lining = false;
  info: ResultInfo | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    // the big number wants lining figures (the face's own old-style 1 reads as an I); where they are not to be had, it is set in italic
    document.fonts?.load(`500 40px "Cormorant Lining"`).then(() => {
      const c = document.createElement('canvas').getContext('2d')!;
      c.font = `500 100px "Cormorant Lining"`; const a = c.measureText('1').actualBoundingBoxAscent;
      c.font = `500 100px "Cormorant Garamond"`; const b = c.measureText('1').actualBoundingBoxAscent;
      this.lining = a > b * 1.15;
    }).catch(() => { /* italic it is */ });
  }

  private dev(): Dev { return window.innerWidth > window.innerHeight * 1.15 ? 'desktop' : 'phone'; }
  private unit(dev: Dev): number { const w = window.innerWidth, h = window.innerHeight; return dev === 'phone' ? Math.min(w / 390, h / 844) : Math.min(w / 1440, h / 900) * 1.15; }
  private key(world: string): string { return `${world}:${window.innerWidth}x${window.innerHeight}`; }
  private layers(world: string): Layers {
    const k = this.key(world);
    let L = this.cache.get(k);
    if (!L) {
      if (this.cache.size >= 2) this.cache.delete(this.cache.keys().next().value as string); // two worlds' worth of pictures is plenty to keep
      L = { cold: null, warm: null, blaze: null, front: null };
      this.cache.set(k, L);
    }
    return L;
  }
  /** One layer, painted at screen size (not the device's finer grain): quick to make, and soft the way paint is. */
  private paint(world: string, what: 'cold' | 'warm' | 'blaze' | 'front'): void {
    const L = this.layers(world), w = window.innerWidth, h = window.innerHeight, dev = this.dev(), u = this.unit(dev);
    if (what === 'front') { if (!L.front) L.front = Y.front(w, h, world, dev, u); return; }
    if (L[what]) return;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    Y.scene(cv.getContext('2d')!, w, h, world, dev, u, what);
    L[what] = cv;
  }
  /** What this run's picture needs, in the order it is needed. */
  private needs(i: ResultInfo): Array<'cold' | 'warm' | 'blaze' | 'front'> {
    const out: Array<'cold' | 'warm' | 'blaze' | 'front'> = i.home ? ['warm'] : ['cold', 'warm', 'front'];
    if (i.cleared) out.push('blaze');
    return out;
  }
  private missing(i: ResultInfo): Array<'cold' | 'warm' | 'blaze' | 'front'> { const L = this.layers(i.world); return this.needs(i).filter((k) => !L[k]); }

  /** Paints a world's skies ahead of time, a layer at a time, while `still()` holds (the galaxy is showing, say). */
  prepare(world: string, still: () => boolean): void {
    const id = Y.has(world) ? world : 'heroes', k = this.key(id);
    const steps: Array<'cold' | 'warm' | 'front' | 'blaze'> = ['cold', 'warm', 'front', 'blaze'];
    const next = (n: number) => { if (n >= steps.length || !still() || this.key(id) !== k) return; this.paint(id, steps[n]); window.setTimeout(() => next(n + 1), 260); };
    window.setTimeout(() => next(0), 1400);
  }

  /** Shows what a run came to. The first layer is painted at once, so there is never an empty screen. */
  show(info: ResultInfo): void {
    this.info = { ...info, world: Y.has(info.world) ? info.world : 'heroes' };
    this.all = false; this.open = false; this.t0 = -1; this.hits = [];
    const miss = this.missing(this.info), world = this.info.world;
    if (miss.length) this.paint(world, miss[0]);
    this.jobs = miss.slice(1).map((k) => () => this.paint(world, k));
  }
  /** Everything is in and a tap will be taken as meant. */
  get ready(): boolean { return this.t0 >= 0 && (this.all || this.now - this.t0 >= this.times().hint + 0.25); }

  /** A tap at screen x, y. */
  tap(x: number, y: number): ResultTap {
    if (!this.info || this.t0 < 0) return 'wait';
    if (!this.all && this.now - this.t0 < 0.9) return 'wait'; // (the last taps of the song are not an answer)
    if (!this.ready) { this.all = true; return 'wait'; }
    for (const r of this.hits) if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      if (r.kind === 'more') { this.open = !this.open; this.openAt = this.now; }
      return r.kind;
    }
    return 'again';
  }

  /** When each thing arrives, in seconds from the start. */
  private times(): { flood: number; name: number; rest: number; hint: number } {
    const i = this.info!, flood = i.home ? 0.8 : i.first ? 1.9 : i.cleared ? 1.2 : 1.0;
    const name = i.cleared && !i.home ? 0.3 + flood * 0.5 : 0.25, rest = i.cleared ? 0.3 + flood * 0.9 : 0.3 + flood * 0.6;
    const n = 1 + (i.shards ? 1 : 0) + i.lines.length + 1;
    return { flood, name, rest, hint: rest + n * 0.22 + 0.2 };
  }

  private write(s: string, x: number, y: number, px: number, a: number, o: { color?: string; align?: CanvasTextAlign; style?: string; glow?: boolean; font?: string } = {}): number {
    const c = this.ctx;
    c.font = `${o.style ?? 'italic'} 500 ${px}px ${o.font ?? SERIF}`; c.textAlign = o.align ?? 'left'; c.textBaseline = 'alphabetic';
    if (a <= 0.003) return c.measureText(s).width;
    if (o.glow) { c.shadowColor = `rgba(255,170,110,${0.6 * a})`; c.shadowBlur = px * 0.4; c.fillStyle = `rgba(255,240,214,${0.5 * a})`; c.fillText(s, x, y); }
    c.shadowColor = `rgba(10,6,24,${0.8 * a})`; c.shadowBlur = px * 0.35; c.fillStyle = `rgba(${o.color ?? CREAM},${a})`; c.fillText(s, x, y);
    c.shadowBlur = 0;
    return c.measureText(s).width;
  }
  private wrap(s: string, px: number, max: number): string[] {
    const c = this.ctx, out: string[] = [];
    c.font = `italic 500 ${px}px ${SERIF}`;
    let line = '';
    for (const word of s.split(' ')) { if (line && c.measureText(line + word).width > max) { out.push(line.trim()); line = ''; } line += `${word} `; }
    out.push(line.trim());
    return out;
  }
  /** A lens shard as a small star of paint: kept, just won (a ring of light round it), or only the place where one will be. */
  private dab(x: number, y: number, s: number, on: boolean, fresh: boolean, a: number): void {
    const c = this.ctx;
    if (a <= 0.003) return;
    c.globalAlpha = a;
    if (on) {
      if (fresh) { K.glow(c, x, y, s * 4.2, [255, 226, 170], 0.3); c.strokeStyle = 'rgba(255,236,206,0.6)'; c.lineWidth = Math.max(1, s * 0.2); c.beginPath(); c.arc(x, y, s * 1.75, 0, Math.PI * 2); c.stroke(); }
      K.glow(c, x, y, s * 3, [255, 220, 150], 0.4); c.fillStyle = 'rgba(255,240,206,0.98)'; c.beginPath(); c.ellipse(x, y, s, s * 0.9, 0.4, 0, Math.PI * 2); c.fill();
    } else { c.strokeStyle = 'rgba(255,236,206,0.5)'; c.lineWidth = Math.max(1, s * 0.28); c.beginPath(); c.arc(x, y, s * 0.85, 0, Math.PI * 2); c.stroke(); }
    c.globalAlpha = 1;
  }

  draw(now: number, _dt: number): void {
    this.now = now / 1000;
    const i = this.info, c = this.ctx, w = window.innerWidth, h = window.innerHeight, dpr = this.canvas.width / Math.max(1, w);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    if (!i) { c.fillStyle = '#08071c'; c.fillRect(0, 0, w, h); return; }
    const dev = this.dev(), u = this.unit(dev), lay = Y.lay(dev), hy = h * lay.horizon;
    let L = this.layers(i.world);
    const base = i.home ? 'warm' : 'cold';
    if (!L[base]) { this.paint(i.world, base); this.jobs = this.missing(i).map((k) => () => this.paint(i.world, k)); this.t0 = -1; L = this.layers(i.world); } // the screen turned or changed size
    // the rest of the picture is painted a layer a frame; the colour starts to rise when all of it is there
    if (this.jobs.length) this.jobs.shift()!();
    else if (this.t0 < 0) this.t0 = this.now;
    const t = this.t0 < 0 ? 0 : this.all ? 99 : this.now - this.t0, T = this.times();
    const ph = smooth((t - 0.3) / T.flood);

    c.drawImage(L[base]!, 0, 0, w, h);
    if (!i.home && L.warm && L.front && ph > 0) {
      if (i.cleared && ph >= 1) c.drawImage(L.warm, 0, 0, w, h);
      else {
        // the colour's front: all the way up (and past the top) on a clear, as far as the song got otherwise
        const f = i.cleared ? ph * 1.45 : (ph * i.pct) / 100, dy = hy * (1 - f) - L.front.y, m = this.tmp;
        if (m.width !== w || m.height !== h) { m.width = w; m.height = h; }
        const x = m.getContext('2d')!;
        x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, w, h); x.drawImage(L.warm, 0, 0);
        x.globalCompositeOperation = 'destination-in'; x.drawImage(L.front.mask, 0, dy);
        if (!i.cleared) { const g = x.createLinearGradient(0, hy - 12 * u, 0, hy + 44 * u); g.addColorStop(0, '#000'); g.addColorStop(1, 'rgba(0,0,0,0.25)'); x.fillStyle = g; x.fillRect(0, 0, w, h); } // its song is not home: the ground stays in night
        c.drawImage(m, 0, 0, w, h);
        c.globalCompositeOperation = 'screen'; c.globalAlpha = (i.cleared ? 1 - smooth((ph - 0.7) / 0.3) : 1) * smooth(ph * 3); c.drawImage(L.front.lip, 0, dy);
        c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      }
    }
    const blaze = i.cleared && L.blaze ? (i.first ? 1 : 0.4) * smooth((ph - 0.72) / 0.28) * (0.93 + 0.07 * Math.sin(this.now * 1.3)) : 0;
    if (blaze > 0) { c.globalAlpha = Math.min(1, blaze); c.drawImage(L.blaze!, 0, 0, w, h); c.globalAlpha = 1; }

    // Eko: after a clear he goes up into the new light; after a fall he is back near the ground, waiting
    const up = i.cleared ? smooth((t - 0.3) / (T.flood * 0.9)) : 0;
    const es = lay.eko[2] * (0.62 + 0.38 * up) * u, ex = w * (lay.eko[0] - 0.04 * (1 - up)) + Math.sin(this.now * 0.31) * 12 * u, ey = h * (lay.horizon - 0.075 + (lay.eko[1] - lay.horizon + 0.075) * up) + Math.sin(this.now * 0.72) * 8 * u;
    this.sprite(lay.eko[2] * u, dpr);
    K.glow(c, ex, hy + 30 * u, 260 * es, [255, 170, 100], 0.2, 'screen');
    if (this.eko) { const k = es / (lay.eko[2] * u), s = lay.eko[2] * u * k; c.drawImage(this.eko, ex - 350 * s, ey - 330 * s, 700 * s, 760 * s); }

    this.words(i, t, T, dev, u, w, h);
    const fade = this.t0 < 0 ? 1 : 1 - smooth(t / 0.35);
    if (fade > 0) { c.fillStyle = `rgba(8,7,28,${fade * 0.9})`; c.fillRect(0, 0, w, h); }
  }

  /** Eko, painted once at the device's own grain (room for the whole of his glow: a cut-off glow shows as a box). */
  private sprite(s: number, dpr: number): void {
    const key = `${s.toFixed(3)}@${dpr.toFixed(2)}`;
    if (key === this.ekoKey) return;
    this.ekoKey = key;
    const ek = document.createElement('canvas');
    ek.width = Math.round(700 * s * dpr); ek.height = Math.round(760 * s * dpr);
    const ec = ek.getContext('2d')!;
    ec.scale(dpr * s, dpr * s);
    Y.eko(ec, 350, 330, 1, 0.3);
    this.eko = ek;
  }

  /** The few soft lines, each arriving in its turn; and where a tap means something other than "again". */
  private words(i: ResultInfo, t: number, T: { name: number; rest: number; hint: number }, dev: Dev, u: number, w: number, h: number): void {
    const c = this.ctx, lay = Y.lay(dev), B = lay.B, U = dev === 'desktop' ? Math.max(u, 0.72) : u, x = w * B.x, max = Math.min(w * B.w * (U / u), w - x - 16);
    const at = (when: number) => smooth((t - when) / 0.4);
    this.hits = [];
    let y = h * B.y, n = 0;
    const turn = () => at(T.rest + 0.22 * n++);
    const aN = at(T.name);
    if (aN > 0) { // only the air round the words darkens; never a panel
      const g = c.createRadialGradient(x + max * 0.5, y + 130 * U, 0, x + max * 0.5, y + 130 * U, Math.max(max, 300 * U) * 1.05);
      g.addColorStop(0, `rgba(8,6,22,${0.5 * aN})`); g.addColorStop(0.35, `rgba(8,6,22,${0.22 * aN})`); g.addColorStop(1, 'rgba(8,6,22,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }
    this.write(i.name, x, y + (1 - aN) * 6, 50 * U, aN, { glow: true });
    y += 30 * U; this.write(i.song + (i.tag ? `  ·  ${i.tag}` : ''), x, y + (1 - aN) * 6, 19 * U, 0.92 * aN);
    y += 98 * U;
    { const a = turn(), nw = this.write(String(i.pct), x - 3 * U, y + (1 - a) * 6, 100 * U, a, this.lining ? { style: 'normal', glow: true, font: FIGS } : { glow: true }); this.write('%', x + nw + (this.lining ? 3 : 10) * U, y + (1 - a) * 6, 42 * U, 0.9 * a); }
    if (i.shards) {
      y += 36 * U; const a = turn();
      for (let k = 0; k < 3; k++) this.dab(x + (8 + k * 27) * U, y - 5.5 * U, 5.4 * U, !!i.shards[k], !!i.fresh[k], a);
      if (i.shardLine) this.write(i.shardLine, x + 92 * U, y, 16.5 * U, 0.8 * a, { color: SAND });
      y += 48 * U;
    } else y += 44 * U;
    // on a short screen there is not room for both: opened, "more about this run" takes the place of what the run changed
    const mw = dev === 'phone' ? Math.min(max, w * 0.7) : max, rows = this.open ? i.more.flatMap((s) => this.wrap(s, 16.5 * U, mw)) : [];
    const said = i.lines.map((s) => this.wrap(s, 19.5 * U, max)), saidH = said.flat().length * 27 * U + 12 * U;
    const swap = this.open && y + saidH + rows.length * 23.5 * U + 12 * U + 16 > h;
    for (const ls of said) { const a = turn(); if (!swap) for (const l of ls) { this.write(l, x, y + (1 - a) * 6, 19.5 * U, 0.96 * a); y += 27 * U; } }
    if (!swap) y += 12 * U;
    const aM = turn(), ready = this.ready;
    if (!this.open) {
      const mw = this.write('more about this run', x, y, 15 * U, 0.74 * aM, { color: SAND });
      if (ready) this.hits.push({ x: x - 12, y: y - 30, w: mw + 24, h: 48, kind: 'more' });
    } else {
      // opened: the same hand, a little smaller. Nothing here is needed to go on.
      const a = smooth((this.now - this.openAt) / 0.3), top = y;
      { // the air behind them darkens a little more, so they hold over the brightest sky
        const bh = rows.length * 23.5 * U + 60 * U, rx = mw * 0.95, ry = bh * 0.8;
        c.save(); c.translate(x + mw * 0.42, top + bh * 0.4); c.scale(1, ry / rx);
        const g = c.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, `rgba(8,6,22,${0.6 * a})`); g.addColorStop(0.6, `rgba(8,6,22,${0.4 * a})`); g.addColorStop(1, 'rgba(8,6,22,0)');
        c.fillStyle = g; c.fillRect(-rx, -rx, rx * 2, rx * 2); c.restore();
      }
      for (const l of rows) { this.write(l, x, y, 16.5 * U, 0.9 * a, { color: SAND }); y += 23.5 * U; }
      this.hits.push({ x: x - 12, y: top - 24 * U, w: max + 24, h: y - top + 12 * U, kind: 'more' }); // a tap on them folds them away again
      y += 12 * U;
      let ax = x;
      if (i.fix) { const fw = this.write(i.fix, ax, y, 16.5 * U, 0.95 * a); this.hits.push({ x: ax - 10, y: y - 30, w: fw + 20, h: 46, kind: 'fix' }); ax += fw; ax += this.write('   ·   ', ax, y, 16.5 * U, 0.6 * a, { color: SAND }); }
      const cw = this.write('check the sync, 10 s', ax, y, 16.5 * U, 0.95 * a);
      this.hits.push({ x: ax - 10, y: y - 30, w: cw + 20, h: 46, kind: 'check' });
    }
    const aH = at(T.hint);
    if (aH > 0) {
      const p = 0.78 + 0.14 * Math.sin(this.now * 1.6);
      this.write('tap, for one more orbit', w * lay.hint[0], h * lay.hint[1], Math.max(17, 17.5 * U), p * aH, { align: lay.hint[2] });
      const gy = Math.max(34, (dev === 'phone' ? 64 : 40) * u), gw = this.write('up to the galaxy', w - Math.max(18, 22 * u), gy, Math.max(15, 15.5 * U), 0.66 * aH, { align: 'right' });
      if (ready) this.hits.push({ x: w - gw - 44, y: 0, w: gw + 44, h: gy + 26, kind: 'galaxy' });
    }
    c.textAlign = 'left';
  }
}
