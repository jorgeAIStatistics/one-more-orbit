// The ambush (the owner's brief of 2026-11-26), on Darkness (Lost Sky, She Is Jules). With two stars awake the
// Stillness notices the Landing's light and reaches for it; Orbin draws its eye and leads it away through the dark
// between the worlds: a chase through debris and dead fragments, the Stillness following his trail and swallowing each
// place as he leaves it. No new mode: everything so far, under pressure. Its hazards, each telegraphed a bar ahead:
// stretches of the path that freeze and double (the holds: hold through them), the music skipping with the path
// skipping on the beat (the vents), and colour draining in waves. It ends in a narrow escape home: the Landing's light
// holds, the two Kindlings close by the fire, and Helion's signal pulses once. The gloomiest stretch of World 1.
//
// Places (levels/darkness/level.json): the Landing (0), the debris bridge (1, a line), the twin wrecks (2, an eight),
// the dead moon (3, an ellipse), home (4, the Landing again). Times are the game's song seconds (a bar is 1.6 s; bar k
// starts at 1.6k; the cut's audio has 1.6 s before bar 0).
import { COMPANIONS } from '../art/companions.js';
import { K } from '../art/painter.js';
import { WORLDS as W } from '../art/worldpaint.js';
import { mass, reachOut, skip } from '../art/stillness.js';
import { askLevelSky, askPlanet, pairNow, type LayerName, type SkySpec } from '../art/paintcache';
import { writeSays, type Said } from './skyplanet';
import { save } from '../save';
import { depthDust, horizon, skyDraw, skyOf, type CourseView, type Pic, type World, type WorldSky, type WorldState } from './worlds';
import { EIGHT_LOBES } from '../gd/shapes';

const TAU = Math.PI * 2;
const sm = (x: number) => { const t = x < 0 ? 0 : x > 1 ? 1 : x; return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** the ambush's timeline */
export const AT = { notice: 0, away: 6.4, debris: 8.0, freeze: 16.0, go2: 17.6, wrecks: 19.2, skip: 22.4, drop: 25.6, go3: 26.4, moon: 27.2, escape: 46.4, home: 48.0, pulse: 48.8, last: 49.6, end: 51.2, spb: 0.4 };
/** when he leaves each place (it is swallowed after him); the Landing never is */
const LEFT = [1e9, AT.go2, AT.go3, AT.escape, 1e9];
/** the flights the camera leads (launch, landing, and the middle of the flight in place units) */
const LEADS: Array<[number, number, number, number]> = [[6.4, 8.0, 0.9, -1.6], [17.6, 19.2, 1.1, -5.0], [26.4, 27.2, -1.0, -5.5]];
/** the sky: the darkest of World 1 */
const SKY: SkySpec = { stops: [[0, [5, 4, 11]], [0.55, [12, 9, 22]], [1, [19, 13, 28]]], seed: 29, fin: 43 };
/** the lines written into the sky (low, in calm moments, never over the course) */
const LOW = (from: number, to: number, text: string): Said => ({ from, to, text, x: 0.5, y: 0.2, size: 19, align: 'center' });
export const AMBUSH_SAYS: Said[] = [LOW(0.4, 4.2, 'It has seen the light.'), { ...LOW(48.4, 51.1, 'The light holds.'), y: 0.12 }];

/** A critically damped spring (as every world): nothing jumps. */
class Spring {
  v = 0;
  constructor(public x: number, private omega = 3) {}
  step(target: number, dt: number): number { const w = this.omega; this.v += (w * w * (target - this.x) - 2 * w * this.v) * dt; this.x += this.v * dt; return this.x; }
}
const BODIES: LayerName[] = ['edgeLayer', 'rocksLayer', 'shardsLayer', 'hearthLayer', 'ashLayer'];

export class AmbushWorld {
  private bodies: Partial<Record<LayerName, [Pic, Pic]>> = {};
  private skyPic: Pic | null = null; private key = '';
  private jT = -1; private dt = 0;
  /** the mass, in place units from the Landing (so the camera's moves never move it), and how present it is */
  private mx = new Spring(-2.4, 2.2); private my = new Spring(-1.6, 2.2); private near = new Spring(0.3, 2.5);
  private toward = new Spring(0, 3);
  private flareAt = -9; private pushAt = -9; private hitN = 0;
  /** fragments drifting in the dark between the places (place units), made once */
  private frags: Array<{ x: number; y: number; s: number; a: number; w: number; k: number }> = [];

  constructor() {
    const r = K.RNG(71), P: Array<[number, number]> = [[0, 0], [1.8, -3.2], [0.4, -6.8], [-2.4, -4.2]];
    for (let i = 0; this.frags.length < 26 && i < 400; i++) {
      const x = -4.6 + 9 * r(), y = 1.8 - 11.4 * r();
      if (P.some(([px, py]) => Math.hypot(x - px, y - py) < 1.9)) continue; // (never on a place, where the course runs)
      if (Math.abs((x - 1.8) * 0.296 + (y + 3.2) * 0.955) < 1.0 && Math.abs((x - 1.8) * 0.955 - (y + 3.2) * 0.296) < 2.6) continue; // (nor on the bridge)
      this.frags.push({ x, y, s: 0.05 + 0.1 * r() * r(), a: r() * TAU, w: (r() - 0.5) * 0.4, k: Math.floor(r() * 3) });
    }
  }
  askAhead(): void { for (const n of BODIES) askPlanet(n); askLevelSky(window.innerWidth, window.innerHeight, SKY); }
  private body(n: LayerName): [Pic, Pic] | null {
    if (!this.bodies[n]) { const p = pairNow(n, (W as unknown as Record<string, (hot: boolean) => HTMLCanvasElement>)[n]); if (p) this.bodies[n] = p; }
    return this.bodies[n] ?? null;
  }
  /** a body's picture at (x, y), radius r (its cold side, or its lit one), turned by rot */
  private pic(c: CanvasRenderingContext2D, n: LayerName, x: number, y: number, r: number, hot: boolean, rot = 0, alpha = 1): void {
    const bp = this.body(n); if (!bp || alpha < 0.01) return;
    const p = bp[hot ? 1 : 0], S = (p.width * r) / W.R0;
    c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.drawImage(p, -S / 2, -S / 2, S, S); c.restore();
  }
  reset(): void { this.mx.x = -2.4; this.my.x = -1.6; this.mx.v = this.my.v = 0; this.near.x = 0.3; this.toward.x = 0; this.flareAt = this.pushAt = -9; this.jT = -1; this.hitN = 0; }
  rewind(_to: number): void { this.reset(); } // (no embers: a fall starts the chase again)
  spark(_a: number, song: number): void { this.flareAt = song; this.hitN++; }

  readonly world: World = {
    reset: () => this.reset(),
    rewind: (to) => this.rewind(to),
    spark: (a, song) => this.spark(a, song),
    underCourse: (c, v) => this.onCourse(c, v), // (under the course: nothing covers it; 2026-11-26)
    // the Landing seen wide (it rises over it); the build pushes in; the drop wide; the escape pulls back over it all
    cam: (s) => this.camAt(s),
    pull: (s) => this.pullAt(s),
    draw: (c, R, st) => {
      if (st.rel && st.at) { this.journey(c, st); return; }
      this.landing(c, R, st, 0);
    }
  };
  /** the camera leads each flight: from a second before the launch it leans to the middle of the flight (so the next
   * landing is in view before take-off), and lets go as he lands; the escape pulls back over everything */
  private pullAt(s: number): { x: number; y: number; k: number } | null {
    if (s > AT.escape - 2.4 && s < AT.home + 0.6) return { x: -0.2, y: -3.4, k: 0.5 * sm((s - AT.escape + 2.4) / 1.6) * (1 - sm((s - AT.home + 0.4) / 0.9)) };
    for (const [l0, l1, x, y] of LEADS) if (s > l0 - 1.2 && s < l1 + 0.6) return { x, y, k: 0.4 * sm((s - l0 + 1.2) / 1.0) * (1 - sm((s - l1 + 0.1) / 0.6)) };
    return null;
  }
  private camAt(s: number): number {
    const esc = s > AT.escape - 2.4 && s < AT.home + 0.6 ? sm((s - AT.escape + 2.4) / 1.6) * (1 - sm((s - AT.home + 0.4) / 0.9)) : 0;
    const base = s < AT.away - 0.4 ? 0.8 : s < AT.go2 ? 0.88 : s < AT.drop ? 0.84 + 0.06 * sm((s - AT.skip) / (AT.drop - 0.4 - AT.skip)) : s < AT.drop + 1.2 ? 0.82 : 0.88;
    let lead = 0; for (const [l0, l1] of LEADS) if (s > l0 - 1.6 && s < l1 + 0.6) lead = sm((s - l0 + 1.6) / 1.2) * (1 - sm((s - l1 + 0.1) / 0.6));
    return base - 0.32 * esc - 0.4 * lead;
  }

  // ---------------------------------------------------------------- the world
  private journey(c: CanvasRenderingContext2D, st: WorldState): void {
    const t = st.song, U = st.unit ?? 100, rel = st.rel!, time = st.time, beat = st.beat ?? t / AT.spb;
    this.dt = this.jT < 0 ? 0 : Math.min(0.05, Math.max(0, time - this.jT)); this.jT = time;
    const dt = this.dt, wide = !!st.wide, turn = (x: number, y: number): [number, number] => (wide ? [-y, x] : [x, y]);
    const [ox, oy] = rel(0), P = (x: number, y: number): [number, number] => { const [a, b] = turn(x, y); return [ox + a * U, oy + b * U]; };
    const sw = (k: number) => sm((t - LEFT[k] - 0.6) / 2.2);
    // the dark between the places: fragments of dead worlds, turning slowly (dimmer as the dark takes them)
    c.save();
    for (const f of this.frags) {
      const [x, y] = P(f.x, f.y + 0.06 * Math.sin(time * 0.4 + f.a)), s = f.s * U;
      if (x < -s * 2 - 800 || x > 800 + s * 2) { /* (cheap cull below) */ }
      c.save(); c.translate(x, y); c.rotate(f.a + time * f.w);
      c.fillStyle = 'rgba(22,20,32,0.92)'; c.strokeStyle = 'rgba(150,145,190,0.28)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(-s, -s * 0.3); c.lineTo(-s * 0.2, -s * 0.9); c.lineTo(s * 0.9, -s * 0.4); c.lineTo(s * 0.6, s * 0.7); c.lineTo(-s * 0.5, s * 0.6); c.closePath(); c.fill(); c.stroke();
      c.restore();
    }
    c.restore();
    // the dead moon (3): an ash-grey moon, frost-cracked, long dead
    { const [x, y] = rel(3), s3 = sw(3); this.pic(c, 'ashLayer', x, y, U * 0.72, false, 0.3, 1 - 0.6 * s3); this.frost(c, x, y, U * 0.66, time, 1 - s3); this.swallowed(c, x, y, U * 1.0, s3, time, 3); }
    // the twin wrecks (2): two broken halves of something that was a world, on the eight's two lobes
    { const [x, y] = rel(2), s2 = sw(2), rot = wide ? Math.PI / 2 : 0, k = 1.1;
      EIGHT_LOBES.forEach(([lx, ly], i) => { const X = (lx * Math.cos(rot) - ly * Math.sin(rot)) * k, Y = (lx * Math.sin(rot) + ly * Math.cos(rot)) * k; this.pic(c, i ? 'rocksLayer' : 'hearthLayer', x + X * U, y + Y * U, U * (i ? 0.42 : 0.48), false, (i ? -0.4 : 0.5) + 0.05 * Math.sin(time * 0.3 + i), 1 - 0.6 * s2); });
      this.swallowed(c, x, y, U * 1.5, s2, time, 2); }
    // the debris bridge (1): broken rock along the line he runs, drifting apart
    if (st.along && st.span) {
      const [o0, o1] = st.span(1), [bx, by] = rel(1), s1 = sw(1);
      for (let i = 0; i < 9; i++) {
        const q = -0.1 + 1.2 * (i / 8), side = i % 2 ? 0.55 : 1.45, [x, y] = st.along(1, o0 + (o1 - o0) * q, U * (side + 0.05 * Math.sin(time * 0.5 + i)));
        this.pic(c, i % 3 ? 'shardsLayer' : 'rocksLayer', bx + x, by + y, U * (0.16 + 0.05 * (i % 3)), false, i * 1.7 + time * 0.08 * (i % 2 ? 1 : -1), 1 - 0.6 * s1);
      }
      this.swallowed(c, bx, by, U * 1.6, s1, time, 1);
    }
    // the Landing (0, and home, 4): its planetoid lit, the fire, the light round it
    { const [x, y] = rel(0); c.save(); c.translate(x, y); this.landing(c, U * 0.84, st, U); c.restore(); }
    // the Stillness: a mass following his trail, never closer than it can reach; it swallows what he leaves
    this.chase(c, st, U, P, t, beat, dt);
  }

  /** a place the dark has taken: its light goes, and what is left is a void with a broken cold rim */
  private swallowed(c: CanvasRenderingContext2D, x: number, y: number, r: number, k: number, time: number, seed: number): void {
    if (k < 0.01) return;
    K.glow(c, x, y, r * (0.6 + 0.5 * k), [2, 1, 6], 0.7 * k, 'source-over');
    c.save(); c.lineCap = 'round'; c.strokeStyle = `rgba(160,150,205,${0.6 * k})`;
    const [tt] = skip(time, seed);
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU + tt * 0.05 + seed, rr = r * (0.62 + 0.06 * Math.sin(tt * 0.7 + i * 2.3)) * (0.7 + 0.3 * k); c.lineWidth = Math.max(1, r * 0.012); c.beginPath(); c.arc(x, y, rr, a, a + 0.12 + 0.1 * Math.sin(i * 1.7)); c.stroke(); }
    c.restore();
  }
  /** frost on the dead moon: cold cracks, crystalline */
  private frost(c: CanvasRenderingContext2D, x: number, y: number, r: number, _time: number, a: number): void {
    if (a < 0.02) return;
    c.save(); c.strokeStyle = `rgba(205,215,240,${0.35 * a})`; c.lineWidth = Math.max(1, r * 0.01);
    const rnd = K.RNG(13);
    for (let i = 0; i < 9; i++) { let an = rnd() * TAU, px = x + Math.cos(an) * r * 0.3 * rnd(), py = y + Math.sin(an) * r * 0.3 * rnd(); c.beginPath(); c.moveTo(px, py); for (let k = 0; k < 5; k++) { an += (rnd() - 0.5) * 1.1; px += Math.cos(an) * r * 0.14; py += Math.sin(an) * r * 0.14; c.lineTo(px, py); } c.stroke(); }
    c.restore();
  }

  /** the Landing: the planetoid (lit: two stars are awake), the Sleeper, the fire on its crown, and the light round it */
  private landing(c: CanvasRenderingContext2D, R: number, st: WorldState, U: number): void {
    const t = st.song, time = st.time;
    const bp = this.body('edgeLayer');
    // the light round it: it holds (it swells as the dark pushes on it at the end)
    const push = sm((t - AT.home) / 0.5) * (1 - sm((t - AT.pulse - 0.6) / 1.4)), pulse = Math.exp(-Math.max(0, t - AT.pulse) / 0.5) * (t >= AT.pulse ? 1 : 0);
    K.glow(c, 0, 0, R * (2.1 + 0.25 * push + 0.6 * pulse), [255, 186, 118], 0.16 + 0.05 * Math.sin(time * 1.3) + 0.2 * push + 0.25 * pulse, 'screen');
    if (bp) { const S = (bp[1].width * R) / W.R0; c.drawImage(bp[1], -S / 2, -S / 2, S, S); }
    W.sleeper(c, R, { wake: 0.35 + 0.3 * push, curl: 0.55 - 0.2 * push, breath: (time * 0.22) % 1 });
    // the fire on its crown: low flames, flickering, leaning in the dark's wind as it passes
    const fx = 0, fy = -R * 0.9, lean = 0.25 * Math.sin(time * 0.7) + (t > AT.away && t < AT.home ? 0.15 : 0);
    K.glow(c, fx, fy, R * 0.5, [255, 150, 70], 0.55 + 0.1 * Math.sin(time * 9) * Math.sin(time * 3.3), 'screen');
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const ph = time * (2.3 + i * 0.4) + i, hgt = R * (0.16 + 0.07 * Math.sin(ph) + 0.04 * (i % 2)) * (1 + 0.3 * pulse), x0 = fx + (i - 2) * R * 0.045;
      c.fillStyle = i % 2 ? 'rgba(255,200,120,0.55)' : 'rgba(255,140,60,0.5)';
      c.beginPath(); c.moveTo(x0 - R * 0.035, fy); c.quadraticCurveTo(x0 + lean * hgt * 0.4, fy - hgt * 0.6, x0 + lean * hgt + Math.sin(ph * 1.7) * R * 0.015, fy - hgt); c.quadraticCurveTo(x0 + lean * hgt * 0.3, fy - hgt * 0.5, x0 + R * 0.035, fy); c.fill();
    }
    c.restore();
    // the two Kindlings (Emberwick's, Cirra's): they hide in the fire through the chase, and close by it at the end
    const home = U > 0 ? sm((t - AT.home - 0.2) / 1.0) : 1, KD = COMPANIONS.KINDLE as Record<string, number[]>;
    for (const [i, id] of [[0, 'heroes'], [1, 'skyhigh']] as Array<[number, string]>) {
      const side = i ? 1 : -1, bob = Math.sin(time * 2.1 + i * 2) * R * 0.03;
      const x = fx + side * R * lerp(0.08, 0.3, home), y = fy - R * lerp(0.12, 0.26, home) + bob;
      COMPANIONS.kindling(c, x, y, R / W.R0 * 0.55, KD[id], { flap: 0.5 + 0.5 * Math.sin(time * 5 + i), alpha: 0.35 + 0.65 * home, rot: -side * 0.2 });
    }
  }

  /** the mass: where it is (it follows his trail some beats behind, and never comes closer to him than it can reach) */
  private chase(c: CanvasRenderingContext2D, st: WorldState, U: number, P: (x: number, y: number) => [number, number], t: number, beat: number, dt: number): void {
    if (t < AT.notice - 1.4) return;
    const rel = st.rel!, at = st.at!, [ox, oy] = rel(0), wide = !!st.wide;
    const toU = ([x, y]: [number, number]): [number, number] => [(x - ox) / U, (y - oy) / U];
    const [hx, hy] = toU(at(beat));
    let tx: number, ty: number;
    if (t < AT.away) {
      // it rises at the edge of the Landing's sky, and reaches for the fire
      const lair = wide ? [1.7, -2.5] : [-2.5, -1.7], q = sm((t - AT.notice + 1.4) / 5);
      tx = lair[0] * lerp(1.25, 1, q); ty = lair[1] * lerp(1.25, 1, q);
    } else if (t < AT.home) {
      // his trail, eight beats back; pushed off him and off the place he is on (the path ahead stays clear)
      const lag = t < AT.drop ? 9 : 7, [lx, ly] = toU(at(Math.max(AT.away / AT.spb, beat - lag)));
      tx = lx; ty = ly;
      const pf = st.pf ?? 0, k = Math.round(pf), [cx, cy] = toU(rel(k));
      for (let it = 0; it < 3; it++) {
        let d = Math.hypot(tx - hx, ty - hy); if (d < 3.0) { const ux = (tx - hx) / (d || 1), uy = (ty - hy) / (d || 1); tx = hx + ux * 3.0; ty = hy + uy * 3.0; }
        { const dl = Math.hypot(tx, ty); if (dl < 2.8) { tx = (tx / (dl || 1)) * 2.8; ty = (ty / (dl || 1)) * 2.8; } } // (never over the Landing: it only reaches for it)
        const keep = k === 2 ? 3.6 : k === 3 ? 3.9 : 2.9; d = Math.hypot(tx - cx, ty - cy); if (d < keep && Math.abs(pf - k) < 0.25) { const ux = (tx - cx) / (d || 1), uy = (ty - cy) / (d || 1); tx = cx + ux * keep; ty = cy + uy * keep; }
      }
    } else {
      // home: it comes up against the light; at Helion's pulse it recoils and goes
      const [dx, dy] = wide ? [4.2, -2.4] : [-2.4, -4.2], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
      const d = t < AT.pulse ? lerp(3.4, 2.35, sm((t - AT.home) / 0.7)) : lerp(2.35, 6, sm((t - AT.pulse) / 1.6));
      tx = ux * d; ty = uy * d;
    }
    const x = this.mx.step(tx, dt), y = this.my.step(ty, dt);
    // how present it is: it gains toward each phrase's end and on the drop; good taps push it back; it goes at the pulse
    const ph = ((beat % 16) + 16) % 16, gain = sm((ph - 10) / 5) * (1 - sm((ph - 15.3) / 0.7));
    const push = Math.exp(-(t - this.flareAt) / 0.4) * (t >= this.flareAt ? 1 : 0);
    const want = t < AT.away ? 0.55 + 0.35 * sm((t - AT.notice) / 4) : t < AT.home ? 0.6 + 0.25 * gain + (t > AT.drop && t < AT.escape ? 0.15 : 0) - 0.2 * push : 0.85 * (1 - sm((t - AT.pulse) / 1.4));
    const n = this.near.step(want, dt);
    const gone = t > AT.pulse ? sm((t - AT.pulse - 0.4) / 1.8) : 0;
    if (gone >= 0.99) return;
    const R = U * (1.0 + 0.3 * n) * (t < AT.away ? lerp(0.6, 1, sm((t - AT.notice + 1.4) / 5)) : 1) * (1 - 0.4 * gone), [sx, sy] = [ox + x * U, oy + y * U];
    // what it reaches for: the fire, until he takes its eye (it turns after him over a beat), then him
    const tw = this.toward.step(t < AT.away + 0.1 ? 0 : 1, dt);
    const [fx, fy] = [ox, oy - U * 0.84 * 0.9], [px, py] = at(beat);
    const aim: [number, number] = [lerp(fx, px, tw), lerp(fy, py, tw)];
    const reach = t < AT.away ? 0.15 + 0.7 * sm((t - AT.notice) / 5.4) : t < AT.home ? 0.35 + 0.25 * gain - 0.25 * push : 0.85 * (1 - sm((t - AT.pulse) / 0.5));
    c.save(); c.globalAlpha = 1 - gone;
    mass(c, sx, sy, R, R * 0.86, { near: n, seed: 7, toward: aim, reach: Math.max(0, reach), n: 5, t: st.time });
    c.restore();
    // at home: where it meets the light, the light flares against it (it holds)
    if (t > AT.home && t < AT.pulse + 1) {
      const [hx2, hy2] = rel(4), d = Math.hypot(sx - hx2, sy - hy2) || 1, ex = hx2 + ((sx - hx2) / d) * U * 1.75, ey = hy2 + ((sy - hy2) / d) * U * 1.75, k = sm((t - AT.home - 0.3) / 0.4) * (1 - sm((t - AT.pulse) / 0.8));
      K.glow(c, ex, ey, U * 0.7, [255, 200, 140], 0.5 * k, 'screen');
      c.save(); c.strokeStyle = `rgba(255,214,160,${0.6 * k})`; c.lineWidth = Math.max(1.5, U * 0.03); c.beginPath(); c.arc(hx2, hy2, U * 1.75, Math.atan2(sy - hy2, sx - hx2) - 0.5, Math.atan2(sy - hy2, sx - hx2) + 0.5); c.stroke(); c.restore();
    }
    void P;
  }

  // ---------------------------------------------------------------- on the course
  private onCourse(c: CanvasRenderingContext2D, v: CourseView): void {
    const s = v.song, rb = v.rb, beat = v.beat, time = v.time;
    if (v.hit) { this.pushAt = time; }
    // the freezes: a bar ahead the stretch darkens and doubles; held, it is frozen over (hold through it); after, it shatters
    for (const hd of v.holds ?? []) {
      const pre = sm((beat - (hd.a - 4)) / 2), after = (beat - hd.b) / 2.5;
      if (beat < hd.a - 4 || after > 1) continue;
      const pts: Array<[number, number]> = [];
      for (let b = hd.a - 0.3; b <= hd.b + 0.3; b += 0.12) pts.push(v.pos(b, 0));
      const pts2: Array<[number, number]> = []; for (let b = hd.a - 0.3; b <= hd.b + 0.3; b += 0.12) pts2.push(v.pos(b, 0.5));
      const line = (q: Array<[number, number]>) => { c.beginPath(); q.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); };
      const [, dbl] = skip(time, 11);
      c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
      if (after <= 0) {
        // the dark gathering on it, and its double (the Stillness's own sign: a pale copy, offset, flickering)
        c.globalAlpha = pre * (after > 0 ? 1 - after : 1);
        line(pts); c.strokeStyle = 'rgba(6,5,14,0.55)'; c.lineWidth = rb * 2.6; c.stroke();
        c.globalAlpha = pre * (dbl >= 0 ? 0.75 : 0.35); line(pts2); c.strokeStyle = 'rgba(200,192,240,0.7)'; c.lineWidth = Math.max(1, rb * 0.12); c.setLineDash([rb * 0.6, rb * 0.4]); c.stroke(); c.setLineDash([]);
        // frozen: frost along both sides (crystals standing off it), a cold flash as he enters
        const fz = sm((beat - hd.a + 0.25) / 0.25);
        if (fz > 0) {
          c.globalAlpha = fz; c.strokeStyle = 'rgba(210,225,250,0.75)'; c.lineWidth = Math.max(1, rb * 0.14);
          for (let i = 1; i < pts.length - 1; i += 2) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i + 1], dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d, [x, y] = pts[i], L = rb * (0.6 + 0.5 * Math.abs(Math.sin(i * 2.7))); for (const sgn of [1, -1]) { c.beginPath(); c.moveTo(x + nx * rb * 0.9 * sgn, y + ny * rb * 0.9 * sgn); c.lineTo(x + nx * (rb * 0.9 + L) * sgn + dx / d * L * 0.3, y + ny * (rb * 0.9 + L) * sgn + dy / d * L * 0.3); c.stroke(); } }
          const enter = beat - hd.a; if (enter > -0.1 && enter < 0.6) { const [x, y] = v.pos(hd.a); K.glow(c, x, y, rb * (2 + 6 * enter), [200, 220, 255], 0.6 * (1 - enter / 0.6), 'screen'); }
        }
      } else {
        // the frost shatters behind him: shards thrown off, tumbling, fading
        for (let i = 0; i < pts.length; i += 2) { const [x, y] = pts[i], r = K.RNG(i * 13 + 5), a = r() * TAU, d = rb * (1 + 7 * after) * (0.5 + r()); c.globalAlpha = 1 - after; c.fillStyle = 'rgba(215,228,252,0.8)'; c.save(); c.translate(x + Math.cos(a) * d, y + Math.sin(a) * d + after * after * rb * 3); c.rotate(a + after * 6); c.fillRect(-rb * 0.25, -rb * 0.08, rb * 0.5, rb * 0.16); c.restore(); }
      }
      c.restore();
    }
    // the skips (the vents): a beat ahead the path there tears; on the beat it skips (and so does the picture, and the
    // music: main.ts); his double is left behind where he was, and fades
    for (const p of v.presses) {
      if (p.pad !== 'vent') continue;
      const d = p.beat - beat;
      if (d > 2.5 || d < -1.6) continue;
      const [x, y] = v.pos(p.beat);
      if (d > 0) {
        const pre = sm(1 - d / 2.5), [, dbl] = skip(time, 17);
        c.save(); c.strokeStyle = `rgba(3,2,8,${0.8 * pre})`; c.lineWidth = Math.max(1.5, rb * 0.22); c.lineCap = 'butt';
        for (let i = 0; i < 4; i++) { const b = p.beat + 0.15 + i * 0.3, [ax, ay] = v.pos(b, -0.35), [bx, by] = v.pos(b + (dbl >= 0 ? 0.08 : 0), 0.35); c.globalAlpha = pre * (0.5 + 0.5 * Math.sin(time * 13 + i * 2)); c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); }
        c.restore();
        K.glow(c, x, y, rb * 2.2, [190, 180, 240], 0.25 * pre, 'screen');
      } else {
        const q = -d / 1.6;
        // his double, left behind: a pale ring where he was, and its echo
        c.save(); c.globalAlpha = 1 - q; c.strokeStyle = 'rgba(215,205,250,0.8)'; c.lineWidth = Math.max(1, rb * 0.12);
        c.beginPath(); c.arc(x + rb * 0.3 * q, y - rb * 0.2 * q, rb * (1 + 0.4 * q), 0, TAU); c.stroke();
        c.globalAlpha = 0.5 * (1 - q); c.beginPath(); c.arc(x + rb * 0.9 * q, y - rb * 0.5 * q, rb * (1 + 0.6 * q), 0, TAU); c.stroke();
        c.restore();
        K.glow(c, x, y, rb * 1.4, [200, 195, 245], 0.4 * (1 - q), 'screen');
        // the picture skipping on the beat: slices of it thrown sideways for a few frames
        const k = -d * v.spb;
        if (k < 0.12) this.tear(c, (1 - k / 0.12) * (save.reduceFlash ? 0.3 : 1), Math.floor(p.beat));
      }
    }
    // pressure on the course through the drop: the dark creeping up the path behind him, pushed back by every good tap
    if (s > AT.drop - 0.2 && s < AT.escape + 0.8) {
      const enter = sm((s - AT.drop) / 1.2), leave = sm((s - AT.escape) / 0.7), ph = ((beat % 16) + 16) % 16, surge = sm((ph - 10) / 5) * (1 - sm((ph - 15.2) / 0.8));
      const push = Math.exp(-(time - this.pushAt) / 0.5), gap = 3.6 - 1.6 * surge + 1.0 * push + leave * 10 + (1 - enter) * 4, a = enter * (1 - leave);
      if (a > 0.01) {
        c.save(); c.globalAlpha = a; c.lineCap = 'round';
        const front = beat - gap;
        for (const [col, extra] of [['rgba(150,140,195,0.3)', 0.5], ['rgba(4,3,10,0.94)', 0]] as Array<[string, number]>) {
          c.strokeStyle = col;
          for (let i = 0; i < 10; i++) { const b0 = front - i * 0.22, [x0, y0] = v.pos(b0, -0.05, beat), [x1, y1] = v.pos(b0 - 0.26, -0.05, beat); c.lineWidth = rb * ((4 - i * 0.3) + extra) * (1 + 0.06 * Math.sin(time * 3 + i)); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
        }
        c.strokeStyle = 'rgba(4,3,10,0.9)'; c.lineWidth = rb * 0.42;
        for (let j = 0; j < 4; j++) { const [x0, y0] = v.pos(front, -0.05 + (j - 1.5) * 0.12, beat), [x1, y1] = v.pos(front + 0.7 + 0.25 * Math.sin(time * 4 + j), -0.05 + (j - 1.5) * 0.22, beat); c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2 + Math.sin(time * 5 + j) * rb, (y0 + y1) / 2, x1, y1); c.stroke(); }
        c.restore();
      }
    }
    // his launches and landings, and the lights caught in flight (three beats each)
    for (const p of v.presses) {
      if (!p.leap) continue;
      const d = p.beat - beat;
      if (d > 2 || d < -2) continue;
      const [x, y] = v.pos(p.beat);
      if (p.leap.ember) {
        // a light to catch: a warm mote hanging in the dark, brighter as its beat comes; caught, it bursts and rings
        const pre = sm(1 - d / 2), after = d < 0 ? -d / 1.2 : 0;
        if (after < 1) { K.glow(c, x, y, rb * (1.3 + 0.8 * pre), [255, 200, 140], (0.25 + 0.4 * pre) * (1 - after), 'screen'); if (after > 0) { c.save(); c.strokeStyle = `rgba(255,220,170,${0.7 * (1 - after)})`; c.lineWidth = Math.max(1, rb * 0.15); c.beginPath(); c.arc(x, y, rb * (1.2 + 5 * after), 0, TAU); c.stroke(); c.restore(); } }
      } else {
        // the throw: dust gathering under him the beats before, a burst as he goes, a ring where he lands
        const pre = d > 0 ? sm(1 - d / 1.5) : 0, after = d <= 0 ? -d / 1.2 : 0;
        if (pre > 0) { c.save(); c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + time * 2, rr = rb * (3.5 - 2.2 * pre); K.glow(c, x + Math.cos(a) * rr, y + Math.sin(a) * rr, rb * 0.2, [200, 195, 240], 0.6 * pre); } c.restore(); }
        if (after > 0 && after < 1) for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU, dd = rb * (1.5 + 8 * after); K.glow(c, x + Math.cos(a) * dd, y + Math.sin(a) * dd, rb * 0.25 * (1 - after), [215, 210, 250], 0.8 * (1 - after)); }
        const ld = beat - p.leap.b1;
        if (ld >= 0 && ld < 1) { const [lx, ly] = v.pos(p.leap.b1); for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU, dd = rb * (1 + 5 * ld); K.glow(c, lx + Math.cos(a) * dd, ly + Math.sin(a) * dd * 0.6, rb * 0.22 * (1 - ld), [210, 205, 245], 0.75 * (1 - ld)); } }
      }
    }
    // colour draining in waves: a band of the picture loses its colour as the dark passes over (from the build; on every
    // second bar through the drop). Orbin is drawn after it: he keeps his.
    this.drain(c, s, beat);
  }
  /** the picture skipping: a few horizontal slices of it thrown sideways for a moment */
  private tear(c: CanvasRenderingContext2D, k: number, seed: number): void {
    if (k < 0.02) return;
    const cv = c.canvas, Wd = cv.width, Hd = cv.height, r = K.RNG(seed * 31 + 7);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = 0; i < 5; i++) { const y = Math.floor(r() * Hd * 0.9), h = Math.floor(Hd * (0.02 + 0.06 * r())), dx = Math.round((r() - 0.5) * Wd * 0.06 * k); if (dx) c.drawImage(cv, 0, y, Wd, h, dx, y, Wd, h); }
    c.fillStyle = `rgba(3,2,8,${0.5 * k})`; for (let i = 0; i < 3; i++) c.fillRect(0, Math.floor(r() * Hd), Wd, Math.max(1, Math.floor(Hd * 0.004)));
    c.restore();
  }
  private drain(c: CanvasRenderingContext2D, s: number, beat: number): void {
    const inBuild = s > AT.away + 1.6 && s < AT.drop - 1.6, inDrop = s > AT.drop + 3.2 && s < AT.escape - 0.4;
    if (!inBuild && !inDrop) return;
    const period = inDrop ? 8 : 16, q = (((beat % period) + period) % period) / 3.2; // (a wave lasts 3.2 beats: 1.28 s)
    if (q >= 1) return;
    const cv = c.canvas, Wd = cv.width, Hd = cv.height, band = Hd * 0.45, y = -band + (Hd + band * 2) * sm(q) - band * 0.5;
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'saturation';
    const g = c.createLinearGradient(0, y, 0, y + band); const a = inDrop ? 0.92 : 0.6;
    g.addColorStop(0, 'rgba(128,128,128,0)'); g.addColorStop(0.5, `rgba(128,128,128,${a})`); g.addColorStop(1, 'rgba(128,128,128,0)');
    c.fillStyle = g; c.fillRect(0, Math.max(0, y), Wd, Math.min(Hd, y + band) - Math.max(0, y));
    c.restore();
  }

  // ---------------------------------------------------------------- the sky
  private paint(w: number, h: number): void { const key = `${w}x${h}`; if (key === this.key) return; this.key = key; this.skyPic = skyOf(w, h, SKY); }
  readonly sky: WorldSky = {
    says: [],
    prepare: () => this.paint(window.innerWidth, window.innerHeight),
    draw: (c, w, h, st) => {
      this.paint(w, h);
      const t = st.song ?? -10, time = st.time, u = Math.min(w / 390, h / 844);
      if (this.skyPic) skyDraw(c, this.skyPic, w, h, st.cam);
      depthDust(c, w, h, st.cam, time, [170, 160, 210], 0.14);
      // the stars go out as it swallows the places (a veil over the sky, deeper place by place); they come back at home
      const veil = Math.min(0.55, 0.12 * [1, 2, 3].filter((k) => t > LEFT[k] + 1).length + 0.15 * sm((t - AT.drop) / 2)) * (1 - 0.6 * sm((t - AT.pulse) / 1.5));
      if (veil > 0) { c.fillStyle = `rgba(2,1,6,${veil})`; c.fillRect(0, 0, w, h); }
      // Helion's signal: faint behind the shadow rings all through; it pulses once, clearly, when the light holds
      const pulse = t >= AT.pulse - 0.1 ? Math.exp(-Math.max(0, t - AT.pulse) / 0.7) * sm((t - AT.pulse + 0.1) / 0.1) : 0;
      horizon(c, w, h, 0.12 + pulse, time);
      if (pulse > 0.01) {
        const gx = w * 0.2, gy = h * 0.12, q = Math.min(1, (t - AT.pulse) / 1.6), R0 = Math.hypot(w, h) * (0.1 + 1.0 * q);
        c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(255,214,150,${0.45 * (1 - q) * (save.reduceFlash ? 0.5 : 1)})`; c.lineWidth = Math.max(2, 6 * u * (1 - q)); c.beginPath(); c.arc(gx, gy, R0, 0, TAU); c.stroke(); c.restore();
      }
      // the drop: half a beat of the world drawing in (near stillness), then the release: cold speed lines outward
      const pre = t > AT.drop - 0.4 && t < AT.drop ? sm((t - AT.drop + 0.4) / 0.4) : 0;
      if (pre > 0) { c.fillStyle = `rgba(3,2,8,${0.45 * pre})`; c.fillRect(0, 0, w, h); }
      const rel = (t >= AT.drop && t < AT.drop + 1.1 ? 1 - (t - AT.drop) / 1.1 : 0) * (save.reduceFlash ? 0.3 : 1);
      if (rel > 0) {
        const cx = w / 2, cy = h * 0.52, R0 = Math.hypot(w, h) * 0.6, r = K.RNG(5);
        c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
        for (let i = 0; i < 40; i++) { const a = r() * TAU, d0 = (0.15 + 0.5 * r() + (1 - rel) * 0.6) * R0, L = (0.08 + 0.2 * r()) * R0 * rel; c.strokeStyle = `rgba(200,195,250,${0.45 * rel})`; c.lineWidth = 1 + 2.5 * r(); c.beginPath(); c.moveTo(cx + Math.cos(a) * d0, cy + Math.sin(a) * d0); c.lineTo(cx + Math.cos(a) * (d0 + L), cy + Math.sin(a) * (d0 + L)); c.stroke(); }
        c.restore();
      }
      // the dark at the edges: the gloomiest of World 1
      { const g = c.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.28, w / 2, h * 0.5, Math.hypot(w, h) * 0.6); g.addColorStop(0, 'rgba(2,2,8,0)'); g.addColorStop(1, `rgba(2,2,8,${0.55 * (1 - 0.4 * sm((t - AT.pulse) / 1.5))})`); c.fillStyle = g; c.fillRect(0, 0, w, h); }
      writeSays(c, w, h, u, this.sky.says, st.song);
      void reachOut; void lerp;
    }
  };
}
