// The places of a journey (the owner's brief of 2026-11-26): a level runs through several places, each with its own
// path shape. The course itself never changes: it is still angles and ring levels, beat by beat, so the timing is the
// same on any shape. Only where those angles and rings are drawn changes: a place maps (angle, radius) to a point.
//   circle: as before. ellipse: a stretched loop. eight: a figure-eight round two moons, crossing between them.
//   line: a straight bridge, ridden along (its "up" is one side of it). A spiral is a circle place with a window of
//   beats in which the ring winds inward to a point (the dive into the forge).
// Closed shapes are measured by length, and each is as long as a circle of the same size: a beat covers the same
// distance on any of them, so the speed you see always matches the music.

/** A place, as the level file gives it. `at`: its centre, in base-ring radii (portrait; turned for a wide screen). */
export interface PlaceDef {
  id: string;
  at: [number, number];
  shape: 'circle' | 'ellipse' | 'eight' | 'line';
  /** turns the shape (radians) */
  rot?: number;
  /** a line: the way it runs (radians, 0 = right, PI/2 = down); its length per radian of orbit (default 0.6) */
  dir?: number;
  len?: number;
  /** turns where on the shape a given angle falls (to put the landing where the flight comes in) */
  phase?: number;
  /** a closed shape this many times the size of the base ring (a beat still covers the same distance: a loop takes longer) */
  size?: number;
  /** the beat at which the eight crosses itself (its phase is set from it) */
  cross?: number;
  /** a circle that winds inward between these beats (to the point `to`, in base-ring radii from the centre) */
  spiral?: [number, number];
  to?: [number, number];
  /** the spiral's ring at its end, as a share of the base ring (0.18: down into a point; above 1: winding outward) */
  grow?: number;
}

const TAU = Math.PI * 2;
const N = 720;
const tables = new Map<string, Float32Array>();
/** points equally spaced by length round a closed curve, scaled so its whole length is 2 pi */
function table(key: string, raw: (t: number) => [number, number]): Float32Array {
  const hit = tables.get(key);
  if (hit) return hit;
  const M = 4096, xs = new Float64Array(M + 1), ys = new Float64Array(M + 1), cum = new Float64Array(M + 1);
  for (let i = 0; i <= M; i++) { const [x, y] = raw((i / M) * TAU); xs[i] = x; ys[i] = y; if (i) cum[i] = cum[i - 1] + Math.hypot(x - xs[i - 1], y - ys[i - 1]); }
  const L = cum[M], s = TAU / L, out = new Float32Array(N * 2);
  let j = 0;
  for (let k = 0; k < N; k++) {
    const want = (k / N) * L;
    while (j < M && cum[j + 1] < want) j++;
    const f = (want - cum[j]) / Math.max(1e-9, cum[j + 1] - cum[j]);
    out[k * 2] = (xs[j] + (xs[j + 1] - xs[j]) * f) * s;
    out[k * 2 + 1] = (ys[j] + (ys[j + 1] - ys[j]) * f) * s;
  }
  tables.set(key, out);
  return out;
}
// (the ellipse a little wider than tall; the eight's lobes stacked, each nearly round, crossing at the centre)
const RAW = {
  ellipse: (t: number): [number, number] => [1.26 * Math.cos(t), 0.76 * Math.sin(t)],
  eight: (t: number): [number, number] => [0.62 * Math.sin(2 * t), 1.25 * Math.sin(t)],
};
/** A point on a closed unit shape at angle a, and the outward normal there (the side "up" is on). */
function closed(shape: 'ellipse' | 'eight', a: number): [number, number, number, number] {
  const t = table(shape, RAW[shape]);
  const u = ((((a + Math.PI / 2) / TAU) % 1) + 1) % 1 * N; // (angle -PI/2, the top of a circle, is where each shape starts)
  const i = Math.floor(u), f = u - i, i1 = (i + 1) % N, i0 = (i - 1 + N) % N;
  const x = t[i * 2] + (t[i1 * 2] - t[i * 2]) * f, y = t[i * 2 + 1] + (t[i1 * 2 + 1] - t[i * 2 + 1]) * f;
  const tx = t[i1 * 2] - t[i0 * 2], ty = t[i1 * 2 + 1] - t[i0 * 2 + 1], d = Math.hypot(tx, ty) || 1;
  return [x, y, ty / d, -tx / d];
}
/** where the eight's two moons sit, in base-ring radii from its centre (before its turn) */
export const EIGHT_LOBES: Array<[number, number]> = (() => { const t = table('eight', RAW.eight); let top = 0; for (let k = 0; k < N; k++) top = Math.max(top, Math.abs(t[k * 2 + 1])); return [[0, -top / 2], [0, top / 2]]; })();

const sm = (x: number) => { const t = x < 0 ? 0 : x > 1 ? 1 : x; return t * t * (3 - 2 * t); };
const turn = (x: number, y: number, r: number): [number, number] => [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)];

/**
 * Where angle a at radius r falls, relative to the place's centre, for a place whose base ring has radius R (the
 * ring the ball rides; other rings run parallel to it, r - R further out along the normal). Also the outward normal.
 * span: the angles over which the ball is on this place (a line is centred on them); win: a spiral's angle window.
 */
export function placePoint(d: PlaceDef, a: number, r: number, R: number, span: [number, number], win: [number, number] | null, wide: boolean): [number, number, number, number] {
  const rot = (d.rot ?? 0) + (wide ? Math.PI / 2 : 0);
  if (d.shape === 'line') {
    const mid = (span[0] + span[1]) / 2, way = span[1] >= span[0] ? 1 : -1, dir = (d.dir ?? 0) + (wide ? Math.PI / 2 : 0);
    const along = (a - mid) * way * (d.len ?? 0.6) * R, tx = Math.cos(dir), ty = Math.sin(dir), nx = ty, ny = -tx;
    const off = r - R;
    return [tx * along + nx * off, ty * along + ny * off, nx, ny];
  }
  const ap = a + (d.phase ?? 0);
  if (d.shape === 'circle') {
    const cx = Math.cos(ap), cy = Math.sin(ap);
    const raw = win && d.spiral ? (a - win[0]) / (win[1] - win[0] || 1) : -1;
    if (raw > 0 && raw <= 1) { // (before its window and after it, the ring is round again: after it, he is inside)
      const q = sm(raw), m = 1 + ((d.grow ?? 0.18) - 1) * q, to = d.to ?? [0, -0.92];
      return [to[0] * R * q + cx * r * m, to[1] * R * q + cy * r * m, cx, cy];
    }
    const k = d.size ?? 1;
    return [cx * (r + R * (k - 1)), cy * (r + R * (k - 1)), cx, cy];
  }
  const k = d.size ?? 1, [x0, y0, nx, ny] = closed(d.shape, ap / k), x = x0 * k, y = y0 * k;
  const [X, Y] = turn(x, y, rot), [NX, NY] = turn(nx, ny, rot), off = r - R;
  return [X * R + NX * off, Y * R + NY * off, NX, NY];
}
/** A place's centre in base-ring radii, turned for a wide screen (the journey then runs left to right). */
export function placeAt(d: PlaceDef, wide: boolean): [number, number] { return wide ? [-d.at[1], d.at[0]] : [d.at[0], d.at[1]]; }
