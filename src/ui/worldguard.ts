// The guardian (the owner's brief of 2026-11-26), on Throne (Rival, Neoni). The colossus that kept this galaxy, kneeling
// at its edge, stopped mid-watch by the Stillness and worn by it as a gate. The fight is a journey on its own body, in
// three phases: the waking (at its feet; it stirs, its head comes up, its hand sweeps across the ring, each sweep
// telegraphed a bar ahead in vermilion); the climb (its raised arm, then round its helm and in toward the slit, the
// Meteor through its seals; then near silence as the Stillness pours out of the slit and its heart shows); the heart
// (the drop throws you onto the Star-Node in its chest; the four Kindlings come one by one and give their modes back;
// Helion's signal joins as the second spark; the last tap lights its star, and it bows its head, by choice).
//
// Places (levels/throne/level.json): its feet (0), its arm (1, a line), its helm (2, a spiral inward), its heart (3).
// Times are the game's song seconds (a bar is 1.558 s; bar k starts at 1.558k).
import { CANON } from '../art/canonpaint.js';
import { COMPANIONS } from '../art/companions.js';
import { K } from '../art/painter.js';
import { mass, skip, stain } from '../art/stillness.js';
import { askLevelSky, type SkySpec } from '../art/paintcache';
import { writeSays, type Said } from './skyplanet';
import { save } from '../save';
import { depthDust, horizon, skyDraw, skyOf, type CourseView, type Pic, type World, type WorldSky, type WorldState } from './worlds';

const TAU = Math.PI * 2;
const sm = (x: number) => { const t = x < 0 ? 0 : x > 1 ? 1 : x; return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const BAR = (60 / 154) * 4;
/** the fight's timeline */
export const GT = { wake: 0, sweep: 4 * BAR, helion: 8 * BAR, climb: 16 * BAR, arm: 16 * BAR + 0.78, helm: 20 * BAR, open: 30 * BAR, drop: 32 * BAR, heart: 32 * BAR + 0.78, k1: 33 * BAR, k2: 37 * BAR, k3: 41 * BAR, k4: 45 * BAR, two: 49 * BAR, sprint: 52 * BAR, star: 55 * BAR, end: 56 * BAR, spb: 60 / 154 };
/** where the guardian kneels (its ground, in place units from its feet) and how big it is (per place unit) */
const G_AT: [number, number] = [0.01, 1.0], G_S = 0.01;
const SKY: SkySpec = { stops: [[0, [4, 5, 14]], [0.5, [10, 12, 30]], [1, [22, 18, 40]]], seed: 37, fin: 43 };
const LOW = (from: number, to: number, text: string): Said => ({ from, to, text, x: 0.5, y: 0.17, size: 19, align: 'center' });
export const GUARDIAN_SAYS: Said[] = [LOW(0.8, 5.0, 'The guardian of the edge, stopped mid-watch.'), LOW(GT.open + 0.2, GT.drop - 0.3, 'Its heart. Strike it on the beat.'), { ...LOW(GT.star + 0.3, GT.end - 0.1, '…Orbin?'), y: 0.12 }];
/** the four Kindlings, in the order they come back to the heart */
const KIN: Array<[string, number]> = [['heroes', GT.k1], ['skyhigh', GT.k2], ['blank', GT.k3], ['invincible', GT.k4]];

class Spring {
  v = 0;
  constructor(public x: number, private omega = 3) {}
  step(target: number, dt: number): number { const w = this.omega; this.v += (w * w * (target - this.x) - 2 * w * this.v) * dt; this.x += this.v * dt; return this.x; }
}

export class GuardianWorld {
  private skyPic: Pic | null = null; private key = '';
  private jT = -1; private dt = 0; private hitAt = -9;
  private head = new Spring(0, 1.6); private turned = new Spring(0, 2.2); private lit = new Spring(0, 1.4);
  private leads: Array<[number, number, number, number, number]> | null = null;
  askAhead(): void { askLevelSky(window.innerWidth, window.innerHeight, SKY); }
  reset(): void { this.jT = -1; this.head.x = 0; this.turned.x = 0; this.lit.x = 0; this.hitAt = -9; }
  readonly world: World = {
    reset: () => this.reset(),
    rewind: () => this.reset(), // (no embers: a fall starts the whole fight again)
    spark: (_a, song) => { this.hitAt = song; },
    underCourse: (c, v) => this.under(c, v),
    cam: (s) => this.camAt(s),
    pull: (s) => this.pullAt(s),
    draw: (c, _R, st) => { if (st.rel && st.at) this.journey(c, st); }
  };
  // ---------------------------------------------------------------- the camera
  private leadAt(s: number): { x: number; y: number; k: number; out: number } | null {
    for (const [l0, l1, x, y, out] of this.leads ?? []) if (s > l0 - 1.6 && s < l1 + 0.6) return { x, y, k: sm((s - l0 + 1.6) / 1.2) * (1 - sm((s - l1 + 0.1) / 0.6)), out };
    return null;
  }
  private pullAt(s: number): { x: number; y: number; k: number } | null {
    // the pull-back over the whole guardian before the last stretch (as Helion's signal joins)
    if (s > GT.two - 0.8 && s < GT.two + 3) return { x: 0.2, y: -2.3, k: 0.6 * sm((s - GT.two + 0.8) / 1.0) * (1 - sm((s - GT.two - 2) / 1.0)) };
    const l = this.leadAt(s); return l ? { x: l.x, y: l.y, k: 0.55 * l.k } : null;
  }
  private camAt(s: number): number {
    const back = s > GT.two - 0.8 && s < GT.two + 3 ? sm((s - GT.two + 0.8) / 1.0) * (1 - sm((s - GT.two - 2) / 1.0)) : 0, l = back > 0 ? null : this.leadAt(s);
    const base = s < GT.climb ? 0.84 : s < GT.open ? 0.86 : s < GT.drop ? 0.86 + 0.12 * sm((s - GT.open) / (GT.drop - GT.open - 0.3)) : 0.8;
    return Math.max(0.32, base - 0.4 * back - (l ? l.out * l.k : 0));
  }
  private findLeads(st: WorldState): void {
    if (this.leads || !st.presses || !st.rel || !st.at) return;
    const U = st.unit ?? 100, [ox, oy] = st.rel(0), wide = !!st.wide, at = st.at;
    const unturn = (x: number, y: number): [number, number] => (wide ? [y, -x] : [x, y]);
    this.leads = st.presses.filter((p) => p.leap && !p.leap.ember).map((p) => {
      const [ax, ay] = at(p.beat), [bx, by] = at(p.leap!.b1 + 1.5 / GT.spb * 0.5), [mx, my] = unturn(((ax + bx) / 2 - ox) / U, ((ay + by) / 2 - oy) / U), d = Math.hypot(bx - ax, by - ay) / U;
      return [p.beat * GT.spb, p.leap!.b1 * GT.spb, mx, my, Math.max(0.15, Math.min(0.5, (d - 1.8) * 0.13))];
    });
  }

  // ---------------------------------------------------------------- the world: the guardian, behind everything
  private journey(c: CanvasRenderingContext2D, st: WorldState): void {
    this.findLeads(st);
    const t = st.song, time = st.time, U = st.unit ?? 100, rel = st.rel!, wide = !!st.wide;
    this.dt = this.jT < 0 ? 0 : Math.min(0.05, Math.max(0, time - this.jT)); this.jT = time;
    const dt = this.dt, [ox, oy] = rel(0);
    const P = (x: number, y: number): [number, number] => (wide ? [ox - y * U, oy + x * U] : [ox + x * U, oy + y * U]);
    // its state: the head comes up through the waking; it turns on you as the climb begins; lit at the last tap
    const up = this.head.step(t < GT.wake + 1 ? 0 : t < GT.climb ? 0.4 + 0.6 * sm((t - 1) / (GT.helion)) : 1, dt);
    const turned = this.turned.step(t >= GT.climb - 0.4 && t < GT.star ? 1 : 0, dt), lit = this.lit.step(t >= GT.star ? 1 : 0, dt);
    const [gx, gy] = P(G_AT[0], G_AT[1]), s = U * G_S;
    c.save(); c.translate(gx, gy); if (wide) c.rotate(Math.PI / 2);
    // (each state is a pose; it moves between them by cross-fading two poses over the spring's time, never a cut)
    const draw = (state: number, a: number) => { if (a < 0.01) return; c.save(); c.globalAlpha *= a; CANON.parts.guardian(c, 0, 0, s, K.RNG(42), state); c.restore(); };
    if (lit > 0.01) { draw(2, 1 - lit); draw(3, lit); }
    else { draw(up, 1 - turned); draw(1 + turned, turned); }
    // the Stillness wearing it: stains on its body while it is turned on you, and pouring from its slit before the heart
    if (turned > 0.05 && lit < 0.5) {
      c.save(); c.globalAlpha *= turned * (1 - lit);
      stain(c, -120 * s, -430 * s, 70 * s, 3, time); stain(c, 150 * s, -300 * s, 60 * s, 7, time);
      c.restore();
      const pour = sm((t - GT.open) / 1.5) * (1 - sm((t - GT.drop - 0.2) / 0.8));
      if (pour > 0.01) { c.save(); c.globalAlpha *= pour; mass(c, 10 * s, -640 * s, 120 * s * (0.6 + 0.4 * pour), 90 * s * (0.6 + 0.4 * pour), { near: 0.8, seed: 11, toward: [10 * s, -360 * s], reach: pour * 0.7, n: 5, t: time }); c.restore(); }
    }
    // its Star-Node: dull; it beats with the song through the heart; lit gold at the end
    if (t > GT.drop - 0.5) { const bp = Math.exp(-((((st.beat ?? 0) % 1) + 1) % 1) * 5); K.glow(c, 14 * s, -360 * s, 130 * s * (1 + 0.2 * bp), lit > 0.5 ? [255, 214, 140] : [150, 170, 230], (0.25 + 0.25 * bp) * (1 - 0.5 * lit) + 0.6 * lit, 'screen'); }
    c.restore();
    this.kindlings(c, st, U, t, time);
  }
  /** the four Kindlings: each comes in on its bar, gives its mode back in a burst of its colour, and keeps orbiting the heart */
  private kindlings(c: CanvasRenderingContext2D, st: WorldState, U: number, t: number, time: number): void {
    if (t < GT.k1 - 1.5) return;
    const [hx, hy] = st.rel!(3), KD = COMPANIONS.KINDLE as Record<string, number[]>;
    KIN.forEach(([id, at], i) => {
      if (t < at - 1.5) return;
      const come = sm((t - at + 1.5) / 1.5), a = time * 0.6 + (i / 4) * TAU, R = U * lerp(4.5, 2.1, come);
      const x = hx + Math.cos(a) * R, y = hy + Math.sin(a) * R * 0.7 - (1 - come) * U * 1.5;
      COMPANIONS.kindling(c, x, y, U * 0.006, KD[id], { flap: 0.5 + 0.5 * Math.sin(time * 5 + i), alpha: come, rot: Math.sin(time + i) * 0.3 });
      const burst = t > at && t < at + 0.9 ? 1 - (t - at) / 0.9 : 0;
      if (burst > 0) { K.glow(c, x, y, U * (0.4 + 1.2 * (1 - burst)), KD[id] as [number, number, number], 0.6 * burst * (save.reduceFlash ? 0.4 : 1), 'screen'); c.strokeStyle = `rgba(${KD[id].join(',')},${0.6 * burst})`; c.lineWidth = Math.max(1, U * 0.03); c.beginPath(); c.arc(hx, hy, U * (1.4 + 1.4 * (1 - burst)), 0, TAU); c.stroke(); }
    });
  }

  // ---------------------------------------------------------------- under the course: sweeps, seals, the last seal
  private under(c: CanvasRenderingContext2D, v: CourseView): void {
    const beat = v.beat, rb = v.rb, time = v.time;
    for (const p of v.presses) {
      const d = p.beat - beat;
      if (d > 4.2 || d < -1.6) continue;
      const [x, y] = v.pos(p.beat);
      if (p.pad === 'jump') {
        // a sweep of its hand: a bar ahead a vermilion line marks where it will cross the ring (the danger); on the
        // beat a band of its stone sweeps through there and he hops it; dust after
        const [cx, cy] = v.center, ang = Math.atan2(y - cy, x - cx), L = rb * 7;
        if (d > 0) {
          const pre = sm(1 - d / 4);
          c.save(); c.strokeStyle = `rgba(232,70,54,${0.18 + 0.5 * pre})`; c.lineWidth = Math.max(1.5, rb * 0.22); c.setLineDash([rb * 0.6, rb * 0.5]);
          c.beginPath(); c.moveTo(x - Math.cos(ang) * L, y - Math.sin(ang) * L); c.lineTo(x + Math.cos(ang) * L, y + Math.sin(ang) * L); c.stroke(); c.restore();
        }
        const sw = (beat - (p.beat - 0.35)) / 0.7;
        if (sw > 0 && sw < 1) {
          const perp = ang + Math.PI / 2, off = (sw - 0.5) * rb * 14, bx = x + Math.cos(perp) * off, by = y + Math.sin(perp) * off;
          c.save(); c.globalAlpha = Math.sin(sw * Math.PI); c.strokeStyle = 'rgba(20,24,42,0.95)'; c.lineCap = 'round'; c.lineWidth = rb * 2.2;
          c.beginPath(); c.moveTo(bx - Math.cos(ang) * L, by - Math.sin(ang) * L); c.lineTo(bx + Math.cos(ang) * L, by + Math.sin(ang) * L); c.stroke();
          c.strokeStyle = 'rgba(120,150,220,0.35)'; c.lineWidth = Math.max(1, rb * 0.15); c.stroke(); c.restore();
        }
        if (d < 0 && d > -1.2) { const q = -d / 1.2; for (let i = 0; i < 8; i++) { const a2 = (i / 8) * TAU; K.glow(c, x + Math.cos(a2) * rb * 4 * q, y + Math.sin(a2) * rb * 4 * q + q * q * rb * 2, rb * 0.25, [150, 160, 200], 0.6 * (1 - q)); } }
      } else if (p.form === 'meteor' && !p.auto && !p.smash && !p.leap) {
        // a seal: a ring of ink round the wall, its rim cold; the dash breaks it, and its pieces scatter
        if (d > 2.5) continue;
        const pre = sm(1 - d / 2.5), [, dbl] = skip(time, 5);
        if (d > 0) { c.save(); c.globalAlpha = pre; c.strokeStyle = 'rgba(6,5,14,0.85)'; c.lineWidth = rb * 0.55; c.beginPath(); c.arc(x, y, rb * 2.2, 0, TAU); c.stroke(); c.strokeStyle = `rgba(150,145,200,${dbl >= 0 ? 0.6 : 0.35})`; c.lineWidth = Math.max(1, rb * 0.1); c.stroke(); c.restore(); }
        else { const q = -d / 1.2; if (q < 1) { c.save(); c.globalAlpha = 1 - q; c.strokeStyle = 'rgba(6,5,14,0.85)'; c.lineWidth = rb * 0.4 * (1 - q); for (let i = 0; i < 8; i++) { const a2 = (i / 8) * TAU, rr = rb * (2.2 + 4 * q); c.beginPath(); c.arc(x, y, rr, a2, a2 + 0.4); c.stroke(); } c.restore(); } }
      }
    }
    // the last seal, on its star (the last tap breaks it)
    const last = v.presses[v.presses.length - 1];
    if (last) {
      const d = v.beat - last.beat, [x, y] = v.pos(last.beat);
      if (d > -6 && d < 0) { const a = sm((d + 6) / 1.5), R0 = rb * 4.4 * (1 + 0.04 * Math.sin(time * 3)); c.save(); c.globalAlpha = a; c.strokeStyle = 'rgba(8,6,12,0.96)'; c.lineWidth = rb * 1.1; c.beginPath(); c.arc(x, y, R0, 0, TAU); c.stroke(); c.strokeStyle = 'rgba(176,166,198,0.5)'; c.lineWidth = rb * 0.2; c.stroke(); c.restore(); }
      else if (d >= 0 && d < 2) { const q = d / 2; c.strokeStyle = `rgba(8,6,12,${0.95 * (1 - q)})`; c.lineWidth = rb * 0.9 * (1 - q); for (let i = 0; i < 14; i++) { const an = (i / 14) * TAU, rr = rb * 4.4 + d * rb * 16; c.beginPath(); c.arc(x, y, rr, an, an + 0.25); c.stroke(); } K.glow(c, x, y, rb * (4 + 14 * q), [255, 230, 170], Math.exp(-d * 3) * (save.reduceFlash ? 0.4 : 1), 'screen'); }
    }
  }

  // ---------------------------------------------------------------- the sky: the edge of the galaxy
  private paint(w: number, h: number): void { const key = `${w}x${h}`; if (key === this.key) return; this.key = key; this.skyPic = skyOf(w, h, SKY); }
  readonly sky: WorldSky = {
    says: [],
    prepare: () => this.paint(window.innerWidth, window.innerHeight),
    draw: (c, w, h, st) => {
      this.paint(w, h);
      const t = st.song ?? -10, time = st.time, u = Math.min(w / 390, h / 844);
      if (this.skyPic) skyDraw(c, this.skyPic, w, h, st.cam);
      depthDust(c, w, h, st.cam, time, [150, 160, 220], 0.16);
      // Helion's signal: strongest of all now; his moment at bar 8; it joins at the dual
      const hel = t > GT.helion - 0.3 && t < GT.climb ? sm((t - GT.helion + 0.3) / 0.6) : t >= GT.two - 0.5 ? sm((t - GT.two + 0.5) / 0.8) : 0.35;
      horizon(c, w, h, hel, time);
      // the drop: half a beat drawing in, then the release
      const pre = t > GT.drop - 0.4 && t < GT.drop ? sm((t - GT.drop + 0.4) / 0.4) : 0;
      if (pre > 0) { c.fillStyle = `rgba(3,3,10,${0.45 * pre})`; c.fillRect(0, 0, w, h); }
      const rel = (t >= GT.drop && t < GT.drop + 1.1 ? 1 - (t - GT.drop) / 1.1 : 0) * (save.reduceFlash ? 0.3 : 1);
      if (rel > 0) { const cx = w / 2, cy = h * 0.52, R0 = Math.hypot(w, h) * 0.6, r = K.RNG(5); c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; for (let i = 0; i < 44; i++) { const a = r() * TAU, d0 = (0.15 + 0.5 * r() + (1 - rel) * 0.6) * R0, L = (0.08 + 0.2 * r()) * R0 * rel; c.strokeStyle = `rgba(200,210,255,${0.45 * rel})`; c.lineWidth = 1 + 2.5 * r(); c.beginPath(); c.moveTo(cx + Math.cos(a) * d0, cy + Math.sin(a) * d0); c.lineTo(cx + Math.cos(a) * (d0 + L), cy + Math.sin(a) * (d0 + L)); c.stroke(); } c.restore(); }
      // its star lit: gold floods the sky
      const lit = sm((t - GT.star) / 1.2);
      if (lit > 0) K.glow(c, w * 0.5, h * 0.45, Math.hypot(w, h) * 0.6, [255, 200, 130], 0.3 * lit, 'screen');
      // the dark at the edges
      { const g = c.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.3, w / 2, h * 0.5, Math.hypot(w, h) * 0.6); g.addColorStop(0, 'rgba(2,2,8,0)'); g.addColorStop(1, `rgba(2,2,8,${0.5 * (1 - 0.6 * lit)})`); c.fillStyle = g; c.fillRect(0, 0, w, h); }
      writeSays(c, w, h, u, this.sky.says, st.song);
    }
  };
}
