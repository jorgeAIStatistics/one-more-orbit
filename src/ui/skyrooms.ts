// The rooms of the Lantern, and the held breath of a pause (Afterglow). Each room is painted once (the wall, the
// fire, the glass, the sky over the gallery rail, the logbook's page) and kept; the live things are drawn over it
// every frame: flames that can be touched, Marlow's taps coming down the dark, constellations, and the writing.
// No panels, no tiles, no buttons: a tap goes to whatever is painted there.
//   desk     Marlow's desk: the picture behind the settings (their rows are real controls, laid over it)
//   lamp     the lamp room: the sync check. Marlow taps the glass, and you tap along
//   hearth   Eko's glows, a flame for each along the mantel
//   gallery  the star chart
//   page     the last page of the logbook: who made the music
import { K } from '../art/painter.js';
import { UI } from '../art/uipaint.js';

const C = UI.C;
const SAND = '#e6cfae';
const INK: [number, number, number] = [44, 28, 40];
const FACE = '"Cormorant Garamond", "Hoefler Text", Baskerville, Palatino, Georgia, serif';
const smooth = (x: number) => { const t = x < 0 ? 0 : x > 1 ? 1 : x; return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const WORDS = ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen'];
const count = (n: number) => WORDS[n] ?? String(n);
type Dev = 'phone' | 'desktop';
export type Room = 'desk' | 'lamp' | 'hearth' | 'gallery' | 'page';

export interface GlowView { id: string; name: string; rgb: [number, number, number]; lit: boolean; says: string; how: string }
export interface GlowsInfo { glows: GlowView[]; worn: string }
export interface StarGroup { id: string; name: string; rows: Array<{ name: string; what: string; lit: boolean }>; /** a quiet line under its name, e.g. that it is not in the sky yet */ note: string }
export interface StarsInfo { groups: StarGroup[]; lit: number; total: number }
export interface CreditsInfo { tracks: Array<{ title: string; by: string }>; lines: string[]; foot: string; link: string }
export interface SyncInfo {
  title: string; say: string; back: string;
  /** taps taken so far in this round (the count "one, two, three, four" follows them); -1 when no round is running */
  counting: number;
  /** each tap so far, in ms early (-) or late (+) against his */
  taps: number[];
  line: string;
  /** what can be chosen now, as words in a line */
  acts: Array<{ id: string; label: string }>;
  foot: string;
  /** by eye: how far through his current tap, 0..1 (it lands at 0); -1 by ear, where nothing shows his taps */
  phase: number;
}
interface Hit { x: number; y: number; w: number; h: number; id: string }
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
interface Kept { cv: HTMLCanvasElement; geo: any }

export class SkyRooms {
  private ctx: CanvasRenderingContext2D;
  private kept = new Map<string, Kept>();
  private hits: Hit[] = [];
  private small = document.createElement('canvas');
  private eko: HTMLCanvasElement | null = null;
  private ekoKey = '';
  private shown = '';
  private t0 = 0;
  private now = 0;
  private myTap = -9;
  /** calmer motion: nothing flickers or bobs */
  calm = false;
  glows: GlowsInfo | null = null;
  stars: StarsInfo | null = null;
  credits: CreditsInfo | null = null;
  sync: SyncInfo | null = null;
  /** the hearth: the glow being read about (the one worn, unless a dark wick was touched) */
  look = '';
  /** the gallery: the constellation written out large */
  place = '';

  constructor(private canvas: HTMLCanvasElement) { this.ctx = canvas.getContext('2d')!; }

  private dims(): { w: number; h: number; dev: Dev; u: number; dpr: number } {
    const w = window.innerWidth, h = window.innerHeight, dev: Dev = w > h * 1.15 ? 'desktop' : 'phone';
    return { w, h, dev, u: Math.max(UI.unit(w, h, dev), 0.6), dpr: this.canvas.width / Math.max(1, w) };
  }
  /** A room's picture, painted once for this screen size: about the grain of a phone's screen, never more than the device has. */
  private room(room: Room): Kept {
    const { w, h, dev, u, dpr } = this.dims(), key = `${room}:${w}x${h}`;
    let k = this.kept.get(key);
    if (!k) {
      if (this.kept.size >= 4) this.kept.delete(this.kept.keys().next().value as string);
      const s = Math.max(1, Math.min(dpr, 2, Math.sqrt(1.4e6 / (w * h)))), cv = document.createElement('canvas');
      cv.width = Math.round(w * s); cv.height = Math.round(h * s);
      const geo = UI.ROOMS[room](cv.getContext('2d')!, cv.width, cv.height, dev, u * s);
      // (the painter worked in the picture's own pixels: what it says about places is brought back to the screen's)
      const back = (v: unknown): unknown => (typeof v === 'number' ? v / s : Array.isArray(v) ? v.map(back) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([n, x]) => [n, n === 'rot' ? x : back(x)])) : v);
      k = { cv, geo: back(geo) };
      this.kept.set(key, k);
    }
    return k;
  }
  /** Paints rooms ahead of time, one at a time, while `still()` holds: opening one is then instant. */
  prepare(rooms: Room[], still: () => boolean, wait = 500): void {
    const next = (n: number) => { if (n >= rooms.length || !still()) return; this.room(rooms[n]); window.setTimeout(() => next(n + 1), 240); };
    window.setTimeout(() => next(0), wait);
  }
  /** A room is being entered: it fades up out of the dark. */
  enter(room: Room): void { this.shown = room; this.t0 = -1; this.hits = []; }
  /** You tapped along (the sync check): the glass answers. */
  tapped(): void { this.myTap = this.now; }
  /** What is under a tap at screen x, y: 'back', something of the room's own, or nothing. */
  hit(x: number, y: number): string {
    for (const r of this.hits) if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r.id;
    return '';
  }

  private write(s: string, x: number, y: number, px: number, o: Parameters<typeof C.write>[5] = {}): number { return C.write(this.ctx, s, x, y, px, o); }
  private wrap(s: string, px: number, max: number): string[] {
    const c = this.ctx, out: string[] = [];
    c.font = `italic 500 ${px}px ${FACE}`;
    let line = '';
    for (const word of s.split(' ')) { if (line && c.measureText(line + word).width > max) { out.push(line.trim()); line = ''; } line += `${word} `; }
    out.push(line.trim());
    return out;
  }
  /** The way back, top left: an arrow in ink and where it leads. */
  private back(label: string, x0: number, u: number, dev: Dev): void {
    const y = Math.max(30, (dev === 'phone' ? 64 : 46) * u), px = Math.max(15, 15 * u);
    C.back(this.ctx, x0, y, px, label, Math.max(1, u));
    this.ctx.font = `italic 500 ${px}px ${FACE}`;
    this.hits.push({ x: 0, y: 0, w: x0 + 40 * u + this.ctx.measureText(label).width + 20, h: y + 26, id: 'back' });
  }

  draw(room: Room, now: number): void {
    this.now = now / 1000;
    const c = this.ctx, { w, h, dev, u, dpr } = this.dims();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.shadowBlur = 0;
    if (this.shown !== room) this.enter(room);
    const R = this.room(room);
    if (this.t0 < 0) this.t0 = this.now; // (counted from the first frame the picture is there)
    c.drawImage(R.cv, 0, 0, w, h);
    this.hits = [];
    if (room === 'hearth') this.hearth(R.geo, w, h, dev, u, dpr);
    else if (room === 'gallery') this.gallery(R.geo, w, h, dev, u);
    else if (room === 'page') this.page(R.geo, w, h, dev, u);
    else if (room === 'lamp') this.lamp(R.geo, w, h, dev, u);
    else if (!this.calm) K.glow(c, R.geo.lampX, R.geo.dy - 36 * u, 150 * u, [255, 190, 120], 0.05 + 0.03 * Math.sin(this.now * 2.1) + 0.02 * Math.sin(this.now * 5.3), 'screen'); // the desk lamp breathes
    const fade = 1 - smooth((this.now - this.t0) / 0.4);
    if (fade > 0) { c.fillStyle = `rgba(10,8,24,${fade})`; c.fillRect(0, 0, w, h); }
  }

  // ---------------------------------------------------------------- by the hearth: Eko's glows
  private hearth(G: { fx: number; fy: number; fw: number; shelves: Array<[number, number, number]>; eko: [number, number, number] }, w: number, _h: number, dev: Dev, u: number, dpr: number): void {
    const c = this.ctx, info = this.glows, t = this.now;
    if (!info) return;
    if (!this.calm) K.glow(c, G.fx, G.fy, G.fw * 1.5, [255, 160, 90], 0.07 + 0.04 * Math.sin(t * 2.3) + 0.025 * Math.sin(t * 6.1), 'screen'); // the fire breathes
    const worn = info.glows.find((g) => g.id === info.worn) ?? info.glows[0];
    const read = info.glows.find((g) => g.id === this.look) ?? worn;
    const first = Math.ceil(info.glows.length / 2);
    info.glows.forEach((g, i) => {
      const top = i >= first, n = top ? info.glows.length - first : first, k = top ? i - first : i, [a, b, y] = G.shelves[top ? 1 : 0];
      const x = n > 1 ? lerp(a, b, k / (n - 1)) : (a + b) / 2, gap = n > 1 ? (b - a) / (n - 1) : 60;
      C.flame(c, x, y, 1.05 * u * (g.lit && !this.calm ? 1 + 0.05 * Math.sin(t * 7.3 + i * 1.9) + 0.03 * Math.sin(t * 12.1 + i) : 1), g.rgb, g.lit ? 1 : 0);
      if (g === worn || g === read) {
        c.save(); c.strokeStyle = `rgba(255,241,216,${g === worn ? 0.8 : 0.45})`; c.lineWidth = 1.2 * u; if (g !== worn) c.setLineDash([3 * u, 4 * u]);
        c.beginPath(); c.arc(x, y - 13 * u, 21 * u, 0, Math.PI * 2); c.stroke(); c.restore();
      }
      const hw = Math.max(34, Math.min(52, gap));
      this.hits.push({ x: x - hw / 2, y: y - 40 * u, w: hw, h: 56 * u, id: `glow:${g.id}` });
    });
    // Eko by the fire, wearing the one chosen
    const [ex, ey, es] = G.eko, key = `${worn.id}:${es.toFixed(3)}@${dpr.toFixed(2)}`;
    if (key !== this.ekoKey) {
      this.ekoKey = key;
      const ek = document.createElement('canvas');
      ek.width = Math.round(700 * es * dpr); ek.height = Math.round(760 * es * dpr);
      const ec = ek.getContext('2d')!;
      ec.scale(dpr * es, dpr * es);
      C.ekoIn(ec, 350, 330, 1, K.RNG(242), worn.rgb, { wisp: true, lean: 0.2 });
      this.eko = ek;
    }
    if (this.eko) c.drawImage(this.eko, ex - 350 * es + (this.calm ? 0 : Math.sin(t * 0.5) * 3 * u), ey - 330 * es + (this.calm ? 0 : Math.sin(t * 0.9) * 5 * u), 700 * es, 760 * es);

    const x0 = dev === 'phone' ? w * 0.09 : w * 0.07, max = dev === 'phone' ? w * 0.5 : w * 0.3;
    this.back('out to the galaxy', x0, u, dev);
    let y = (dev === 'phone' ? 122 : 108) * u;
    this.write('By the hearth', x0, y, 44 * u, { glow: 0.8 }); y += 26 * u;
    this.write('Eko’s glows', x0, y, 15 * u, { alpha: 0.7, color: SAND }); y += (dev === 'phone' ? 110 : 90) * u;
    this.write(read.name, x0, y, 40 * u, { glow: read.lit ? 0.6 : 0, alpha: read.lit ? 1 : 0.7 }); y += 28 * u;
    for (const l of this.wrap(read.lit ? read.says : 'still dark', 18 * u, max)) { this.write(l, x0, y, 18 * u, { alpha: read.lit ? 0.9 : 0.7 }); y += 22 * u; }
    y += 2 * u;
    for (const l of this.wrap(read.lit ? 'worn now' : `what lights it: ${read.how}`, 15 * u, max)) { this.write(l, x0, y, 15 * u, { alpha: 0.7, color: SAND }); y += 19 * u; }
    y += 27 * u;
    const lit = info.glows.filter((g) => g.lit).length, dark = info.glows.length - lit;
    this.write(dark ? `${count(lit)} lit, ${count(dark)} still dark` : `all ${count(lit)} lit`, x0, y, 15 * u, { alpha: 0.65, color: SAND }); y += 22 * u;
    for (const l of this.wrap('touch a flame to wear it; touch a wick to see what lights it', 14 * u, max)) { this.write(l, x0, y, 14 * u, { alpha: 0.55, color: SAND }); y += 18 * u; }
  }

  // ---------------------------------------------------------------- the gallery rail: the star chart
  private gallery(P: { big: [number, number, number]; lines: [number, number]; slots: Array<[number, number, number]> }, w: number, h: number, dev: Dev, u: number): void {
    const c = this.ctx, info = this.stars, t = this.now;
    if (!info) return;
    const chosen = info.groups.find((g) => g.id === this.place) ?? info.groups[0];
    const tw = this.calm ? null : (i: number) => 1 + 0.12 * Math.sin(t * 1.6 + i * 2.1);
    const shape = (id: string) => UI.SHAPES[id] ?? UI.SHAPES.heroes;
    C.constellation(c, shape(chosen.id), chosen.rows.map((r) => r.lit), P.big[2], P.big[0], P.big[1], u, 1, tw);
    info.groups.filter((g) => g !== chosen).forEach((g, i) => {
      const slot = P.slots[i];
      if (!slot) return;
      const pts = shape(g.id), ys = pts.map((p) => p[1]), xs = pts.map((p) => p[0]), maxY = Math.max(...ys), minY = Math.min(...ys);
      // (the two places low over the rail are shallow: a tall figure there is drawn smaller, so its name clears the rail)
      const sc = i >= 3 ? Math.min(slot[2], (32 * u) / Math.max(0.3, maxY)) : slot[2], n = g.rows.filter((r) => r.lit).length;
      C.constellation(c, pts, g.rows.map((r) => r.lit), sc, slot[0], slot[1], u, n ? 1 : 0.6, tw);
      const ly = slot[1] + maxY * sc + 30 * u;
      this.write(g.name, slot[0], ly, 19 * u, { alpha: 0.85 });
      this.write(g.note || `${n} of ${g.rows.length}`, slot[0], ly + 18 * u, 13 * u, { alpha: 0.55, color: SAND });
      this.hits.push({ x: slot[0] - 16, y: slot[1] + minY * sc - 16, w: Math.max(110, Math.max(...xs) * sc + 32), h: ly + 26 * u - (slot[1] + minY * sc - 16), id: `place:${g.id}` });
    });
    const x0 = dev === 'phone' ? w * 0.09 : w * 0.07;
    this.back('out to the galaxy', x0, u, dev);
    const y = (dev === 'phone' ? 122 : 108) * u;
    this.write('The star chart', x0, y, 44 * u, { glow: 0.8 });
    this.write(`${info.lit} of ${info.total} lit`, x0, y + 26 * u, 15 * u, { alpha: 0.7, color: SAND });
    // the chosen constellation's stars, each with its one line
    const lx = P.lines[0];
    let ly = P.lines[1] + (dev === 'phone' ? 16 * u : 0); // (clear of the lowest star of the figure above)
    this.write(chosen.name, lx, ly, 30 * u, { glow: 0.5 });
    if (chosen.note) { ly += 22 * u; this.write(chosen.note, lx, ly, 15 * u, { alpha: 0.65, color: SAND }); }
    ly += 40 * u;
    for (const r of chosen.rows) {
      C.dab(c, lx + 6 * u, ly - 6 * u, 4 * u, r.lit);
      const nw = this.write(r.name, lx + 24 * u, ly, 20 * u, { alpha: r.lit ? 1 : 0.6 });
      c.font = `italic 500 ${15 * u}px ${FACE}`;
      const fits = lx + 24 * u + nw + 12 * u + c.measureText(r.what).width < w - 10;
      if (fits) this.write(r.what, lx + 24 * u + nw + 12 * u, ly, 15 * u, { alpha: r.lit ? 0.75 : 0.5, color: SAND });
      else { ly += 19 * u; this.write(r.what, lx + 24 * u, ly, 15 * u, { alpha: r.lit ? 0.75 : 0.5, color: SAND }); }
      ly += 34 * u;
    }
    void h;
  }

  // ---------------------------------------------------------------- the last page of the logbook
  private page(G: { px: number; py: number; pw: number; ph: number; rot: number; ix: number }, w: number, _h: number, dev: Dev, u: number): void {
    const c = this.ctx, info = this.credits;
    if (!info) return;
    const { pw, ph, ix } = G, max = pw - ix * 2, ink = `rgb(${INK.join(',')})`;
    // everything on the page, top to bottom: [words, size, strength, room after them, a rule before them]
    const rows: Array<{ s: string; px: number; a: number; after: number; rule?: boolean; id?: string }> = [
      { s: 'The last page', px: 38, a: 0.92, after: 60 },
      { s: 'the songs, and who made them', px: 15, a: 0.7, after: 38 },
      ...info.tracks.flatMap((k) => [{ s: k.title, px: 22, a: 0.92, after: 24 }, { s: k.by, px: 15.5, a: 0.72, after: 34 }]),
      ...info.lines.map((s, i) => ({ s, px: 17, a: 0.9, after: i + 1 < info.lines.length ? 26 : 56 })),
      { s: info.foot, px: 15.5, a: 0.75, after: 24, rule: true },
      { s: info.link, px: 15.5, a: 0.95, after: 0, id: 'privacy' }
    ];
    const top = (dev === 'phone' ? 64 : 62) * u;
    // if the page is short (a small phone, a long list), the hand gets smaller until it all fits
    let f = 1, laid: Array<{ lines: string[]; r: (typeof rows)[number] }> = [];
    for (let pass = 0; pass < 6; pass++) {
      laid = rows.map((r) => ({ r, lines: this.wrap(r.s, r.px * u * f, max) }));
      const need = laid.reduce((n, l) => n + ((l.lines.length - 1) * l.r.px * 1.15 + l.r.after) * u * f, 0);
      if (top + need <= ph - 26 * u) break;
      f *= Math.max(0.8, (ph - 26 * u - top) / need);
    }
    c.save();
    c.translate(G.px + pw / 2, G.py + ph / 2); c.rotate(G.rot); c.translate(-pw / 2, -ph / 2);
    let y = top;
    laid.forEach(({ r, lines }, i) => {
      if (r.rule) C.rule(c, ix, pw - ix, y - 26 * u * f, 0.3, INK);
      for (const [k, l] of lines.entries()) {
        const wd = this.write(l, ix, y, r.px * u * f, { color: ink, alpha: r.a, ink: true });
        if (r.id) { C.rule(c, ix, ix + wd, y + 4 * u, 0.45, INK); this.hits.push({ x: G.px + ix - 12, y: G.py + y - 32, w: wd + 24, h: 48, id: r.id }); }
        if (k + 1 < lines.length) y += r.px * 1.15 * u * f;
      }
      if (i === 0) C.rule(c, ix, pw - ix, y + 20 * u * f, 0.35, INK);
      y += r.after * u * f;
    });
    c.restore();
    this.back('back to the desk', dev === 'phone' ? w * 0.09 : w * 0.07, u, dev);
  }

  // ---------------------------------------------------------------- the lamp room: Marlow taps the glass
  private lamp(G: { hx: number; hy: number; gx: number; gy: number }, w: number, h: number, dev: Dev, u: number): void {
    const c = this.ctx, s = this.sync, t = this.now;
    if (!s) return;
    const { hx, hy, gx, gy } = G;
    // the rings where taps land on the glass: still and faint; by eye, his tap comes down the dark and they open as it lands
    c.save(); c.globalCompositeOperation = 'screen';
    for (let i = 0; i < 4; i++) { c.strokeStyle = `rgba(255,226,170,${(0.6 - i * 0.14) * (s.phase >= 0 ? 0.35 : 0.5)})`; c.lineWidth = (2.6 - i * 0.4) * u; c.beginPath(); c.arc(gx, gy, (20 + i * 26) * u, 0, Math.PI * 2); c.stroke(); }
    if (s.phase >= 0) {
      const p = s.phase; // 0 as it lands, 1 just before the next
      c.strokeStyle = `rgba(255,236,190,${0.9 * (1 - smooth(p / 0.55))})`; c.lineWidth = 3 * u; c.beginPath(); c.arc(gx, gy, (8 + 110 * Math.min(1, p / 0.55)) * u, 0, Math.PI * 2); c.stroke();
    }
    c.restore();
    if (s.phase >= 0) { // the tap on its way: it leaves his light as the one before lands, and falls at a steady pace
      C.dab(c, lerp(hx, gx, s.phase), lerp(hy, gy, s.phase), (1.6 + s.phase * 2.2) * u, true);
      K.glow(c, gx, gy, 130 * u, [255, 214, 150], 0.5 * (1 - smooth(s.phase / 0.3)));
    }
    // your own tap: the glass answers under your finger
    const mine = 1 - smooth((t - this.myTap) / 0.3);
    K.glow(c, gx, gy, 120 * u, [255, 214, 150], 0.16 + 0.34 * mine);
    c.fillStyle = `rgba(255,255,255,${0.75 + 0.25 * mine})`; c.beginPath(); c.arc(gx, gy, (4 + 3 * mine) * u, 0, Math.PI * 2); c.fill();

    const x0 = dev === 'phone' ? w * 0.09 : w * 0.07, max = dev === 'phone' ? w * 0.84 : w * 0.4;
    this.back(s.back, x0, u, dev);
    let y = dev === 'phone' ? h * 0.548 : h * 0.34;
    this.write(s.title, x0, y, 34 * u, { glow: 0.7 }); y += 34 * u;
    for (const l of this.wrap(s.say, 21 * u, max)) { this.write(l, x0, y, 21 * u, { alpha: 0.85 }); y += 25 * u; }
    y += 30 * u;
    // the count follows your taps: one, two, three, four, and round again
    const on = s.counting > 0 ? (s.counting - 1) % 4 : -1;
    let cx = x0;
    ['one', 'two', 'three', 'four'].forEach((word, i) => { cx += this.write(word, cx, y, (i === on ? 40 : 30) * u, { alpha: i === on ? 1 : 0.5, glow: i === on ? 1 : 0 }) + 26 * u; });
    y += 52 * u;
    // your taps so far, set down against his: left of the mark is early, right is late
    const tx0 = x0, tx1 = x0 + (dev === 'phone' ? w * 0.8 : w * 0.36), mid = (tx0 + tx1) / 2, half = (tx1 - tx0) / 2;
    C.rule(c, tx0, tx1, y, 0.3);
    c.strokeStyle = 'rgba(255,241,216,0.8)'; c.lineWidth = 1.5 * u; c.beginPath(); c.moveTo(mid, y - 9 * u); c.lineTo(mid, y + 9 * u); c.stroke();
    s.taps.forEach((d, i) => C.dab(c, mid + Math.max(-1, Math.min(1, d / 180)) * half, y + (((i * 7919) % 9) - 4) * u, 2.6 * u, true));
    this.write('early', tx0, y + 24 * u, 12.5 * u, { alpha: 0.55, color: SAND }); this.write('late', tx1, y + 24 * u, 12.5 * u, { align: 'right', alpha: 0.55, color: SAND }); this.write('him', mid, y - 16 * u, 12.5 * u, { align: 'center', alpha: 0.7 });
    y += 58 * u;
    for (const l of this.wrap(s.line, 19 * u, max)) { this.write(l, x0, y, 19 * u, { alpha: 0.95 }); y += 23 * u; }
    y += 7 * u;
    let ax = x0;
    s.acts.forEach((a, i) => {
      if (i) ax += this.write('   ·   ', ax, y, 17 * u, { alpha: 0.5, color: SAND });
      const aw = this.write(a.label, ax, y, Math.max(16, 17 * u), { alpha: 0.95 });
      this.hits.push({ x: ax - 12, y: y - 30, w: aw + 24, h: 46, id: a.id });
      ax += aw;
    });
    if (s.foot) this.write(s.foot, x0, y + 30 * u, 13.5 * u, { alpha: 0.55, color: SAND });
  }

  // ---------------------------------------------------------------- pause: the scene dims and holds its breath
  /**
   * Laid over the play field as it stands, every frame while paused: the picture softens (drawn small and laid back
   * large; no blur filter is needed), most of its colour drains, and the dusk comes down over it. k is how far in, 0..1.
   */
  hold(k: number): void {
    if (k <= 0) return;
    const c = this.ctx, cv = this.canvas, W = cv.width, H = cv.height, s = this.small, { u, dpr } = this.dims();
    const f = Math.max(2, 2.6 * u * dpr), sw = Math.max(8, Math.round(W / f)), sh = Math.max(8, Math.round(H / f));
    if (s.width !== sw || s.height !== sh) { s.width = sw; s.height = sh; }
    const x = s.getContext('2d')!;
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(cv, 0, 0, sw, sh);
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.shadowBlur = 0; c.globalCompositeOperation = 'source-over'; c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    // laid back four times, each half a grain apart and each over the last by a smaller share: their average, with no grain showing
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dy], i) => { c.globalAlpha = k / (i + 1); c.drawImage(s, dx * f * 0.5, dy * f * 0.5, W, H); });
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'saturation'; c.fillStyle = `rgba(128,128,128,${0.5 * k})`; c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'source-over'; c.fillStyle = `rgba(8,6,24,${0.62 * k})`; c.fillRect(0, 0, W, H);
    c.restore();
  }
}
