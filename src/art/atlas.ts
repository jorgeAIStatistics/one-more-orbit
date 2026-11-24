// The Star Atlas: the game's hand. Ink on dark paper, a burin's fine line with hatching for shade, gold leaf for
// whatever gives light, and (where a planet's song is home) the warm painted colour the Hush took.
// Everything here draws on a 2D canvas and is seeded, so a picture is the same every time it is made.
// Fine lines are for pictures and backgrounds only: what the player must read in play is drawn elsewhere, thick.
export type RGB = [number, number, number];
type Ctx = CanvasRenderingContext2D;
type Shape = (c: Ctx) => boolean | void;
type Box = [number, number, number, number];

const TAU = Math.PI * 2;
const D = Math.PI / 180;
export const INK: RGB = [233, 223, 198];
export const LEAF: RGB = [231, 194, 100];
export const VERMILION: RGB = [226, 72, 58];
export const PAPER = '#0c0d17';
export const TITLE = '"Cormorant SC", Didot, "Bodoni 72", "Hoefler Text", Georgia, serif';
export const NOTE = '"Cormorant Garamond", "Hoefler Text", Baskerville, Georgia, serif';
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rgba = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const ink = (a = 1) => rgba(INK, a);
export const rng = (seed: number) => { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };
type Rnd = () => number;
const P = (cx: number, cy: number, deg: number, r: number): [number, number] => [cx + Math.cos(deg * D) * r, cy + Math.sin(deg * D) * r];

function noise(seed: number): (x: number, y: number) => number {
  const p = new Float32Array(4096);
  const r = rng(seed);
  for (let i = 0; i < 4096; i++) p[i] = r();
  const h = (x: number, y: number) => p[(Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) & 4095];
  const sm = (t: number) => t * t * (3 - 2 * t);
  const n = (x: number, y: number) => { const xi = Math.floor(x), yi = Math.floor(y), u = sm(x - xi), v = sm(y - yi); const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
  return (x, y) => n(x, y) * 0.5 + n(x * 2.03 + 9, y * 2.03) * 0.25 + n(x * 4.1, y * 4.1 + 5) * 0.125 + n(x * 8.3 + 3, y * 8.3) * 0.0625;
}
const canvas = (w: number, h: number): [HTMLCanvasElement, Ctx] => { const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(w)); cv.height = Math.max(1, Math.round(h)); return [cv, cv.getContext('2d')!]; };

let grainCv: HTMLCanvasElement | null = null;
/** Paper tooth and fibres as a see-through tile: laid over a picture, or over the whole play field, as a pattern. */
export function grain(): HTMLCanvasElement {
  if (grainCv) return grainCv;
  const S = 256;
  const [cv, c] = canvas(S, S);
  const img = c.createImageData(S, S);
  const r = rng(77);
  const n = noise(78);
  for (let y = 0, i = 0; y < S; y++) for (let x = 0; x < S; x++, i += 4) {
    const v = (r() - 0.5) * 0.9 + (n(x * 0.03, y * 0.03) - 0.47) * 1.1;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v > 0 ? 255 : 0;
    img.data[i + 3] = Math.min(255, Math.abs(v) * 70);
  }
  c.putImageData(img, 0, 0);
  for (let k = 0; k < 70; k++) { const x = r() * S, y = r() * S, a = r() * TAU, l = 5 + r() * 16; c.strokeStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.05 + r() * 0.1})`; c.lineWidth = 0.7; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
  return (grainCv = cv);
}
/** Lays the paper's grain over a w by h area. */
export function tooth(c: Ctx, w: number, h: number, alpha = 1): void {
  const pat = c.createPattern(grain(), 'repeat');
  if (!pat) return;
  c.save(); c.globalAlpha = alpha; c.fillStyle = pat; c.fillRect(0, 0, w, h); c.restore();
}
export function glow(c: Ctx, x: number, y: number, r: number, col: RGB, a = 1, mode: GlobalCompositeOperation = 'lighter'): void {
  c.save(); c.globalCompositeOperation = mode;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(col, a)); g.addColorStop(0.35, rgba(col, a * 0.45)); g.addColorStop(1, rgba(col, 0));
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.restore();
}
/** Engraver's hatching inside a clip: ruled lines that waver and break. */
export function hatch(c: Ctx, clip: Shape | null, box: Box, angle: number, gap: number, r: Rnd, o: { color?: string; lw?: number; wob?: number; breakP?: number } = {}): void {
  const { color = ink(0.8), lw = 1, wob = 1, breakP = 0.06 } = o;
  c.save();
  if (clip && clip(c) !== true) c.clip();
  const [bx, by, bw, bh] = box;
  const R = Math.hypot(bw, bh) / 2;
  c.translate(bx + bw / 2, by + bh / 2); c.rotate(angle);
  c.strokeStyle = color; c.lineWidth = lw; c.lineCap = 'round';
  for (let y = -R; y <= R; y += gap * (0.85 + r() * 0.3)) {
    c.beginPath();
    let pen = false;
    for (let x = -R; x <= R; x += 9) { if (r() < breakP) { pen = false; continue; } const yy = y + (r() - 0.5) * wob; if (pen) c.lineTo(x, yy); else { c.moveTo(x, yy); pen = true; } }
    c.stroke();
  }
  c.restore();
}
/** Gold leaf laid in a shape: never quite even, with the flecks and gaps leaf has. */
export function leaf(c: Ctx, shape: Shape, box: Box, r: Rnd, a = 1): void {
  c.save();
  if (shape(c) !== true) c.clip();
  const [x, y, w, h] = box;
  const g = c.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#8f6b22'); g.addColorStop(0.35, '#e7c264'); g.addColorStop(0.55, '#fff2bd'); g.addColorStop(0.75, '#d3a544'); g.addColorStop(1, '#8f6b22');
  c.globalAlpha = a; c.fillStyle = g; c.fillRect(x, y, w, h);
  const n = Math.min(900, Math.max(16, (w * h) / 26));
  for (let i = 0; i < n; i++) { c.fillStyle = r() < 0.55 ? 'rgba(60,40,8,0.5)' : 'rgba(255,250,220,0.7)'; const s = r() * 1.6; c.fillRect(x + r() * w, y + r() * h, s, s); }
  c.restore();
}
/** One disc with another bitten out of it (a crescent): a shape that clips to it. */
const minus = (ax: number, ay: number, ar: number, bx: number, by: number, br: number): Shape => (c) => { c.beginPath(); c.arc(ax, ay, ar, 0, TAU); c.clip(); c.beginPath(); c.rect(ax - ar - 9, ay - ar - 9, ar * 2 + 18, ar * 2 + 18); c.arc(bx, by, br, 0, TAU); c.clip('evenodd'); return true; };
const line = (c: Ctx, x0: number, y0: number, x1: number, y1: number, a = 1, lw = 1, col: RGB = INK) => { c.strokeStyle = rgba(col, a); c.lineWidth = lw; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
const circ = (c: Ctx, x: number, y: number, r: number, a = 1, lw = 1, col: RGB = INK) => { c.strokeStyle = rgba(col, a); c.lineWidth = lw; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke(); };
export function text(c: Ctx, s: string, x: number, y: number, font: string, color: string, o: { ls?: number; align?: CanvasTextAlign } = {}): void {
  c.save(); c.font = font; c.fillStyle = color; c.textAlign = o.align ?? 'center'; c.textBaseline = 'alphabetic';
  try { (c as unknown as { letterSpacing: string }).letterSpacing = `${o.ls ?? 0}px`; } catch { /* older engines */ }
  c.fillText(s, x, y); c.restore();
}
/** A handwritten note with a leader line to what it is about. */
export function note(c: Ctx, s: string, x: number, y: number, tx: number, ty: number, align: CanvasTextAlign = 'left', size = 23): void {
  line(c, x, y, tx, ty, 0.5, 0.8);
  text(c, s, x + (align === 'left' ? 8 : -8), y + 5, `italic 500 ${size}px ${NOTE}`, ink(0.85), { align });
}
/** A star as an engraver cuts one: a point, with rays if it is bright; hollow if its light has been taken. */
export function star(c: Ctx, x: number, y: number, s: number, gold = false, out = false): void {
  if (out) { circ(c, x, y, s * 0.9, 0.5, 0.8); return; }
  c.fillStyle = gold ? '#e7c264' : ink(0.95); c.beginPath(); c.arc(x, y, s * 0.55, 0, TAU); c.fill();
  if (s > 2.2) for (let k = 0; k < 8; k++) { const [x0, y0] = P(x, y, k * 45 + 22, s * 1.1), [x1, y1] = P(x, y, k * 45 + 22, s * (k % 2 ? 2 : 3)); line(c, x0, y0, x1, y1, 0.8, 0.7, gold ? LEAF : INK); }
}
/** Dark paper, the plate's ruled border and number, the atlas's circles, and a field of stars. */
export function plate(c: Ctx, w: number, h: number, r: Rnd, o: { no?: string; cx?: number; cy?: number; radii?: number[]; ticks?: number; stars?: number; clear?: (x: number, y: number) => boolean } = {}): void {
  const { no = '', cx = w / 2, cy = h / 2, radii = [], ticks = 0, stars = 120, clear } = o;
  c.fillStyle = PAPER; c.fillRect(0, 0, w, h);
  glow(c, w / 2, h / 2, Math.hypot(w, h) / 1.7, [44, 40, 66], 0.5, 'source-over');
  c.strokeStyle = ink(0.75); c.lineWidth = 1.4; c.strokeRect(22, 22, w - 44, h - 44);
  c.lineWidth = 0.7; c.strokeRect(30, 30, w - 60, h - 60);
  if (no) text(c, no, w - 50, 58, `500 15px ${TITLE}`, ink(0.8), { align: 'right', ls: 4 });
  for (const R of radii) circ(c, cx, cy, R, 0.16, 0.8);
  if (radii.length) for (let a = 0; a < 360; a += 30) { const [x0, y0] = P(cx, cy, a, radii[0] * 0.5), [x1, y1] = P(cx, cy, a, radii[radii.length - 1]); line(c, x0, y0, x1, y1, 0.09, 0.7); }
  if (ticks) for (let a = 0; a < 360; a += 2) { const l = a % 30 === 0 ? 12 : a % 10 === 0 ? 8 : 4; const [x0, y0] = P(cx, cy, a, ticks), [x1, y1] = P(cx, cy, a, ticks + l); line(c, x0, y0, x1, y1, 0.4, 0.8); }
  for (let i = 0; i < stars; i++) { const x = 46 + r() * (w - 92), y = 46 + r() * (h - 92); if (clear && clear(x, y)) continue; star(c, x, y, 0.8 + r() * r() * 3.2); }
}
/** An engraved globe: meridians and parallels, hatched where it turns from the light (`la` degrees), leaf on its lit limb. */
export function globe(c: Ctx, x: number, y: number, R: number, la: number, r: Rnd, o: { gold?: boolean; a?: number; fill?: boolean } = {}): void {
  const { gold = false, a = 1, fill = true } = o;
  const lx = Math.cos(la * D), ly = Math.sin(la * D);
  if (fill) { c.fillStyle = '#0a0b14'; c.beginPath(); c.arc(x, y, R, 0, TAU); c.fill(); }
  if (gold) leaf(c, minus(x, y, R, x - lx * R * 0.34, y - ly * R * 0.34, R * 1.04), [x - R, y - R, R * 2, R * 2], r, 0.95);
  c.save(); c.beginPath(); c.arc(x, y, R, 0, TAU); c.clip();
  c.strokeStyle = ink(0.34 * a); c.lineWidth = Math.max(0.8, R * 0.012);
  for (let k = 1; k < 5; k++) { c.beginPath(); c.ellipse(x, y, R * Math.cos((k / 5) * Math.PI / 2 + 0.2), R, -0.25, 0, TAU); c.stroke(); }
  for (let k = -2; k <= 2; k++) { c.beginPath(); c.ellipse(x, y + k * R * 0.3, R * Math.sqrt(1 - Math.pow(k * 0.3, 2)), R * 0.12, -0.25, 0, Math.PI); c.stroke(); }
  c.restore();
  const gap = Math.max(3, R * 0.075);
  const shade = (off: number, ang: number, al: number) => hatch(c, minus(x, y, R, x + lx * R * off, y + ly * R * off, R * 0.98), [x - R, y - R, R * 2, R * 2], ang, gap, r, { color: ink(al * a), lw: Math.max(0.8, R * 0.012), wob: 0.8 });
  shade(0.3, 0.7, 0.75); shade(0.6, -0.6, 0.7);
  circ(c, x, y, R, 0.95 * a, Math.max(1.4, R * 0.024));
}
/** The same globe with its colour home: painted light, shade and bands in the planet's own palette, the engraving still showing through. */
export function sphere(c: Ctx, x: number, y: number, R: number, cols: [RGB, RGB, RGB], la: number, r: Rnd): void {
  const [lit, base, dark] = cols;
  const lx = Math.cos(la * D), ly = Math.sin(la * D);
  glow(c, x, y, R * 1.7, lit, 0.32, 'screen');
  c.save(); c.beginPath(); c.arc(x, y, R, 0, TAU); c.clip();
  const g = c.createRadialGradient(x + lx * R * 0.5, y + ly * R * 0.5, R * 0.05, x, y, R * 1.25);
  g.addColorStop(0, rgba(lit)); g.addColorStop(0.5, rgba(base)); g.addColorStop(1, rgba(dark));
  c.fillStyle = g; c.fillRect(x - R, y - R, R * 2, R * 2);
  c.lineCap = 'round';
  for (let b = 0; b < 5; b++) { // bands, laid with a loaded brush: several passes that do not quite agree
    const off = -0.5 + b * 0.25 + (r() - 0.5) * 0.1, col = b % 2 ? mix(lit, [255, 255, 255], 0.3) : mix(dark, base, 0.4);
    for (let k = 0; k < 6; k++) { c.strokeStyle = rgba(col, 0.1 + r() * 0.1); c.lineWidth = R * (0.04 + r() * 0.14); c.beginPath(); c.moveTo(x - R * 1.1, y + off * R + (r() - 0.5) * R * 0.1); c.quadraticCurveTo(x, y + off * R + (r() - 0.5) * R * 0.22, x + R * 1.1, y + off * R + (r() - 0.5) * R * 0.1); c.stroke(); }
  }
  const sh = c.createRadialGradient(x + lx * R * 0.55, y + ly * R * 0.55, R * 0.55, x + lx * R * 0.2, y + ly * R * 0.2, R * 1.5);
  sh.addColorStop(0, rgba(dark, 0)); sh.addColorStop(1, rgba(mix(dark, [8, 6, 26], 0.6), 0.92));
  c.fillStyle = sh; c.fillRect(x - R, y - R, R * 2, R * 2);
  c.strokeStyle = ink(0.22); c.lineWidth = Math.max(0.8, R * 0.01);
  for (let k = 1; k < 5; k++) { c.beginPath(); c.ellipse(x, y, R * Math.cos((k / 5) * Math.PI / 2 + 0.2), R, -0.25, 0, TAU); c.stroke(); }
  c.restore();
  c.save(); c.globalCompositeOperation = 'screen'; c.lineCap = 'round';
  c.strokeStyle = rgba(mix(lit, [255, 255, 255], 0.4), 0.85); c.lineWidth = Math.max(1.5, R * 0.035); c.shadowColor = rgba(lit, 0.9); c.shadowBlur = R * 0.18;
  c.beginPath(); c.arc(x, y, R * 0.99, (la - 62) * D, (la + 62) * D); c.stroke(); c.restore();
  circ(c, x, y, R, 0.7, Math.max(1.2, R * 0.016));
}
/** Eko, as a picture: an engraved flame shaded along its own rise, a seed of gold, the ring he wears, rays and a wisp. `warm`: his glow when colour is back. */
export function flame(c: Ctx, x: number, y: number, s: number, r: Rnd, o: { rays?: boolean; tail?: boolean; hoop?: string; warm?: number; halo?: number } = {}): void {
  const { rays = true, tail = true, hoop = ink(1), warm = 0, halo = 1 } = o;
  if (warm > 0) { glow(c, x, y - 20 * s, 300 * s * halo, [255, 150, 70], 0.3 * warm); glow(c, x, y - 10 * s, 130 * s * halo, [255, 214, 150], 0.45 * warm); }
  if (rays) for (let i = 0; i < 60; i++) { const a = i * 6 + 3; if (tail && a > 96 && a < 168) continue; const [x0, y0] = P(x, y - 30 * s, a, 124 * s), [x1, y1] = P(x, y - 30 * s, a, (i % 10 === 0 ? 236 : i % 2 ? 150 : 184) * s); line(c, x0, y0, x1, y1, 0.75, 0.9); }
  if (tail) for (let k = 0; k < 11; k++) {
    const ex = x - (150 + k * 9) * s, ey = y + (236 + k * 7 - Math.abs(k - 5) * 9) * s;
    c.strokeStyle = ink(0.8); c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(x + (k - 5) * 5 * s, y + 46 * s); c.bezierCurveTo(x + (k - 5) * 4 * s, y + 110 * s, x - 60 * s, y + 170 * s, ex, ey); c.stroke();
    if (k % 2 === 0) star(c, ex - 4 * s, ey + 3 * s, 1.6 * s + 0.6, k === 4);
  }
  const ring = (a0: number, a1: number, al: number) => { c.save(); c.translate(x, y + 16 * s); c.rotate(-0.3); c.globalAlpha = al; c.strokeStyle = hoop; c.lineWidth = Math.max(1.3, 2.2 * s); c.beginPath(); c.ellipse(0, 0, 92 * s, 26 * s, 0, a0, a1); c.stroke(); c.restore(); };
  ring(Math.PI, TAU, 0.45);
  const body = [[30, 44], [0, 52], [-30, 42], [-46, 12], [-42, -24], [-26, -62], [-10, -100], [10, -150], [14, -102], [28, -66], [44, -28], [46, 10]].map(([a, b]) => [x + a * s + 12 * s * Math.pow(Math.max(0, -b) / 150, 2), y + b * s]);
  const shape = () => { const n = body.length; const m = (i: number) => [(body[i % n][0] + body[(i + 1) % n][0]) / 2, (body[i % n][1] + body[(i + 1) % n][1]) / 2]; const st = m(n - 1); c.beginPath(); c.moveTo(st[0], st[1]); for (let i = 0; i < n; i++) { const e = m(i); c.quadraticCurveTo(body[i][0], body[i][1], e[0], e[1]); } c.closePath(); };
  c.save(); shape(); c.fillStyle = warm > 0 ? rgba(mix([10, 11, 20], [150, 70, 30], warm * 0.8)) : '#0a0b14'; c.fill(); c.clip();
  for (let k = 0; k < 17; k++) { const t = k / 16, bx = x + lerp(-44, 46, t * t) * s; c.strokeStyle = ink(0.35 + t * 0.55); c.lineWidth = Math.max(0.8, s * 0.9); c.beginPath(); c.moveTo(bx, y + 52 * s); c.quadraticCurveTo(x + lerp(-58, 62, t * t) * s, y - 30 * s, x + 12 * s, y - 150 * s); c.stroke(); }
  c.restore();
  shape(); c.strokeStyle = ink(1); c.lineWidth = Math.max(1.3, 1.9 * s); c.lineJoin = 'round'; c.stroke();
  leaf(c, (cc) => { cc.beginPath(); cc.moveTo(x, y - 22 * s); cc.quadraticCurveTo(x + 17 * s, y + 14 * s, x, y + 40 * s); cc.quadraticCurveTo(x - 17 * s, y + 14 * s, x, y - 22 * s); }, [x - 18 * s, y - 24 * s, 36 * s, 66 * s], r);
  ring(0.12, Math.PI - 0.12, 1);
}
/** The Hush: a black disc where stars should be, cloth hanging off it, one seam sewn shut and a hair of light under it. `open`: the seam undone, the light whole. */
export function hush(c: Ctx, x: number, y: number, R: number, r: Rnd, o: { seed?: number; open?: number; jars?: boolean } = {}): void {
  const { seed = 3, open = 0 } = o;
  const nz = noise(seed);
  for (let i = 0; i < 300; i++) {
    const a = (i / 300) * 360 + r() * 0.8;
    const len = (26 + 190 * Math.pow(nz(a * 0.035, 1.5), 1.6)) * (R / 200) * (i % 3 === 0 ? 1 : 0.62) * (1 - open * 0.55);
    const [x0, y0] = P(x, y, a, R + 2), [x1, y1] = P(x, y, a, R + len);
    c.strokeStyle = open ? rgba(mix(INK, LEAF, open), 0.3 + r() * 0.5) : ink(0.3 + r() * 0.5); c.lineWidth = Math.max(0.8, R * 0.004);
    c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + len * 0.06, x1, y1 + len * 0.3); c.stroke();
  }
  c.fillStyle = '#030306'; c.beginPath(); c.arc(x, y, R, 0, TAU); c.fill();
  circ(c, x, y, R, 1, Math.max(1.5, R * 0.009)); circ(c, x, y, R - R * 0.035, 0.3, 0.7); circ(c, x, y, R - R * 0.065, 0.16, 0.7);
  const sw = R * 0.74;
  if (open < 0.5) {
    c.strokeStyle = ink(0.55); c.lineWidth = 1;
    c.beginPath(); c.moveTo(x - sw, y - R * 0.02); c.quadraticCurveTo(x, y + R * 0.09, x + sw, y - R * 0.02); c.stroke();
    for (let k = -9; k <= 9; k++) { const px = x + (k / 9.6) * sw, py = y - R * 0.02 + (1 - Math.pow(k / 9.6, 2)) * R * 0.065; line(c, px - R * 0.012, py - R * 0.03, px + R * 0.012, py + R * 0.03, 0.5, 0.9); }
  }
  c.strokeStyle = '#e7c264'; c.lineWidth = Math.max(1.2, R * (0.011 + open * 0.03)); c.lineCap = 'round';
  c.beginPath(); c.arc(x, y - R * 0.1, R * 0.36, (28 - open * 118) * D, (152 + open * 118) * D); c.stroke();
  if (open > 0.5) glow(c, x, y - R * 0.1, R * 0.9, [255, 200, 120], 0.35);
}
/** A bell jar with one small light in it: a song the Hush took. */
export function jar(c: Ctx, x: number, y: number, s = 1): void {
  c.strokeStyle = ink(0.85); c.lineWidth = 1;
  c.beginPath(); c.moveTo(x - 12 * s, y + 18 * s); c.lineTo(x - 12 * s, y - 6 * s); c.quadraticCurveTo(x - 12 * s, y - 24 * s, x, y - 24 * s); c.quadraticCurveTo(x + 12 * s, y - 24 * s, x + 12 * s, y - 6 * s); c.lineTo(x + 12 * s, y + 18 * s); c.stroke();
  line(c, x - 16 * s, y + 18 * s, x + 16 * s, y + 18 * s, 0.85, 1.3); circ(c, x, y - 27 * s, 2.4 * s, 0.8, 0.9);
  for (let k = 0; k < 4; k++) line(c, x + (5 + k * 1.8) * s, y + (-14 + k * 3) * s, x + (5 + k * 1.8) * s, y + 14 * s, 0.4, 0.6);
  star(c, x - s, y + 2 * s, 2.6 * s, true);
}
/** The Lantern: the crooked lighthouse on its rock, with leaf in the lamp room when it is lit. */
export function lighthouse(c: Ctx, x: number, y: number, s: number, r: Rnd, lit = true): void {
  c.save(); c.translate(x, y); c.scale(s, s);
  const rock: Shape = (cc) => { cc.beginPath(); cc.moveTo(-92, 40); cc.quadraticCurveTo(-70, 6, -30, 14); cc.quadraticCurveTo(0, -2, 34, 12); cc.quadraticCurveTo(76, 8, 94, 40); cc.closePath(); };
  rock(c); c.fillStyle = '#0a0b14'; c.fill(); c.strokeStyle = ink(0.9); c.lineWidth = 1.3; c.stroke();
  hatch(c, rock, [-94, 0, 190, 42], 0.5, 4, r, { color: ink(0.6), lw: 0.7 });
  c.rotate(-0.09);
  c.beginPath(); c.moveTo(-22, 16); c.lineTo(22, 16); c.lineTo(13, -108); c.lineTo(-13, -108); c.closePath(); c.fillStyle = '#0a0b14'; c.fill(); c.strokeStyle = ink(1); c.lineWidth = 1.4; c.stroke();
  hatch(c, (cc) => { cc.beginPath(); cc.moveTo(2, 16); cc.lineTo(22, 16); cc.lineTo(13, -108); cc.lineTo(1, -108); cc.closePath(); }, [-22, -108, 44, 124], 0, 3.4, r, { color: ink(0.7), lw: 0.7 });
  for (const yy of [-20, -44, -70, -92]) line(c, -22 - yy * 0.072, yy, 22 + yy * 0.072, yy, 0.8, 0.9);
  if (lit) leaf(c, (cc) => { cc.beginPath(); cc.rect(-10, -136, 20, 22); }, [-10, -136, 20, 22], r);
  c.strokeStyle = ink(1); c.lineWidth = 1.3; c.strokeRect(-18, -114, 36, 6); c.strokeRect(-10, -136, 20, 22);
  c.beginPath(); c.moveTo(-15, -136); c.lineTo(0, -158); c.lineTo(15, -136); c.closePath(); c.stroke();
  c.restore();
}
/** Marlow, the keeper: a lampmoth drawn as a naturalist would, wings spread, with the hand lantern he carries. Under glass if `under`. */
export function moth(c: Ctx, x: number, y: number, s: number, r: Rnd, under = false): void {
  c.save(); c.translate(x, y); c.scale(s, s);
  for (const k of [-1, 1]) {
    const upper: Shape = (cc) => { cc.beginPath(); cc.moveTo(0, -14); cc.bezierCurveTo(k * 60, -110, k * 190, -120, k * 176, -40); cc.bezierCurveTo(k * 170, 6, k * 80, 24, 0, 14); cc.closePath(); };
    const lower: Shape = (cc) => { cc.beginPath(); cc.moveTo(0, 8); cc.bezierCurveTo(k * 90, 16, k * 136, 70, k * 100, 116); cc.bezierCurveTo(k * 66, 146, k * 28, 90, 0, 52); cc.closePath(); };
    for (const [w, root, n] of [[lower, [0, 30], 7], [upper, [0, -4], 10]] as Array<[Shape, [number, number], number]>) {
      w(c); c.fillStyle = '#0a0b14'; c.fill();
      hatch(c, w, [k < 0 ? -190 : 0, -124, 190, 274], 0.9 * k, 5, r, { color: ink(0.3), lw: 0.7 });
      c.save(); w(c); c.clip(); for (let i = 0; i < n; i++) { const deg = w === upper ? lerp(-78, 2, i / (n - 1)) : lerp(8, 88, i / (n - 1)); const [vx, vy] = P(root[0], root[1], k > 0 ? deg : 180 - deg, 240); line(c, root[0], root[1], vx, vy, 0.5, 0.8); } c.restore();
      w(c); c.strokeStyle = ink(1); c.lineWidth = 1.6; c.lineJoin = 'round'; c.stroke();
    }
    leaf(c, (cc) => { cc.beginPath(); cc.arc(k * 118, -52, 17, 0, TAU); cc.arc(k * 118, -52, 9, 0, TAU, true); }, [k * 118 - 18, -70, 36, 36], r); // an eye-spot on each wing, ringed in leaf
    circ(c, k * 118, -52, 17, 0.9, 1); c.fillStyle = '#030306'; c.beginPath(); c.arc(k * 118, -52, 8, 0, TAU); c.fill();
    c.strokeStyle = ink(0.9); c.lineWidth = 1.2; c.beginPath(); c.moveTo(k * 4, -50); c.bezierCurveTo(k * 16, -96, k * 44, -122, k * 76, -126); c.stroke(); // antennae, feathered
    for (let i = 1; i <= 9; i++) { const t = i / 10, ax = k * lerp(8, 70, t), ay = lerp(-62, -124, Math.sqrt(t)); line(c, ax, ay, ax + k * 9, ay - 11 + t * 6, 0.8, 0.8); line(c, ax, ay, ax - k * 3, ay - 13, 0.6, 0.8); }
  }
  const body: Shape = (cc) => { cc.beginPath(); cc.ellipse(0, 26, 15, 60, 0, 0, TAU); };
  body(c); c.fillStyle = '#0a0b14'; c.fill(); c.strokeStyle = ink(1); c.lineWidth = 1.5; c.stroke();
  for (let i = 0; i < 7; i++) { c.strokeStyle = ink(0.7); c.lineWidth = 0.9; c.beginPath(); c.ellipse(0, 2 + i * 12, 14 * Math.sqrt(1 - Math.pow((i * 12 - 24) / 62, 2)), 4, 0, 0.1, Math.PI - 0.1); c.stroke(); }
  for (let i = 0; i < 26; i++) { const [x0, y0] = P(0, -18, i * 14, 10), [x1, y1] = P(0, -18, i * 14, 21 + (i % 3) * 3); line(c, x0, y0, x1, y1, 0.8, 0.8); } // the ruff
  c.fillStyle = '#0a0b14'; c.beginPath(); c.arc(0, -44, 10, 0, TAU); c.fill(); circ(c, 0, -44, 10, 1, 1.4);
  line(c, 26, 60, 58, 96, 0.8, 0.9); c.strokeStyle = ink(0.95); c.lineWidth = 1.2; c.strokeRect(48, 98, 20, 28); line(c, 46, 98, 70, 98, 1, 1.6); line(c, 46, 126, 70, 126, 1, 1.6);
  leaf(c, (cc) => { cc.beginPath(); cc.ellipse(58, 114, 5, 9, 0, 0, TAU); }, [52, 104, 12, 20], r);
  if (under) {
    c.strokeStyle = ink(0.8); c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(-226, 176); c.lineTo(-226, -40); c.bezierCurveTo(-226, -190, 226, -190, 226, -40); c.lineTo(226, 176); c.stroke();
    c.lineWidth = 2.4; c.beginPath(); c.moveTo(-250, 176); c.lineTo(250, 176); c.stroke(); circ(c, 0, -164, 9, 0.8, 1.4);
    c.strokeStyle = ink(0.3); c.lineWidth = 1; c.beginPath(); c.moveTo(-204, 120); c.lineTo(-204, -30); c.bezierCurveTo(-204, -90, -170, -130, -120, -146); c.stroke();
  }
  c.restore();
}
/** A picture as an image address, for the pages (the map's planets, the Lantern, Eko on a tile). */
export function picture(w: number, h: number, draw: (c: Ctx, w: number, h: number) => void, scale = 2): string {
  const [cv, c] = canvas(w * scale, h * scale);
  c.scale(scale, scale);
  draw(c, w, h);
  return cv.toDataURL('image/png');
}
/** A picture kept as a canvas, for the play field to stamp. */
export function stamp(w: number, h: number, draw: (c: Ctx, w: number, h: number) => void, scale = 2): HTMLCanvasElement {
  const [cv, c] = canvas(w * scale, h * scale);
  c.scale(scale, scale);
  draw(c, w, h);
  return cv;
}
export { rgba, mix, P, line, circ, ink };
