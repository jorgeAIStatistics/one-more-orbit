// Picture for the ring-hop core. What the player must read (rings, marks, ceilings, flow notes, the ball) is drawn
// last, in fixed colours, on top of everything else. The world behind follows the song's measured energy, blooms or
// drains with the player's flow, and after the drop goes off as hard as the charge and flow earned.
import { audio } from '../audio/audio';
import { orbColour } from '../game/extras';
import type { Level } from '../game/level';
import { PALETTES, type Palette, type RGB } from '../render/palettes';
import { PLANETS } from '../ui/galaxy';
import { INK as ATLAS_INK, globe, rng, stamp, tooth } from '../art/atlas';
import { CANON } from '../art/canonpaint.js';
import { COMPANIONS } from '../art/companions.js';
import type { World } from '../ui/worlds';
import { bestFor, save, starsFor } from '../save';
import { LIFT, flightRho, leapAt, smoothstep, type Course, type Feature, type Form, type Star } from './course';
import { placeAt, placePoint, type PlaceDef } from './shapes';
import type { GdRun } from './run';

const TWO_PI = Math.PI * 2;
const EQ_BARS = 48;

const LOOK = 2; // beats before an opening that the ring above shows as a ceiling
const WHITE: RGB = [255, 255, 255];
const DANGER: RGB = [232, 70, 54]; // vermilion, the atlas's one warning colour: // the edge of everything that ends the run
let GOLD: RGB = [240, 200, 98]; // flow notes, flow, the smash
let VIOLET: RGB = [178, 150, 255]; // gravity flip
let CYAN: RGB = [112, 220, 204]; // speed portals, turns, planet hops
const FLOOR: RGB = [247, 240, 222]; // the rings you ride: one fixed colour, whatever the world behind is doing
let STONE: RGB = [158, 172, 214]; // the gravity path asleep: stone tiles, ahead of Orbin
let WOKEN: RGB = [255, 224, 160]; // and awake: where he has been
let STAR: RGB = [255, 244, 200]; // star trails: pale gold, between the white you must hit and the gold you may
const HALO = 'rgba(3,5,14,0.88)'; // the dark edge under everything in the foreground
const HINT: Record<Feature, string> = {
  charge: 'tap the roll: it charges the drop', smash: 'the drop: strike the great gold node', flip: 'violet: gravity turns over', weave: 'weave: bounce between the two rings',
  spin: 'spin gate: the gap comes round to the mark', sling: 'cyan arrows: tap and hold, and ride to the next planet', reverse: 'the orbit turns round', faster: 'faster now', slower: 'slower now',
  twin: 'twin orbit: one tap moves both',
  rail: 'gold rail: tap and hold through the hop', line: 'gold line: hold, and float along it',
  tether: 'red tether: hold on. Let go early and the run ends',
  meteor: 'Meteor: tap to dash through each wall', sat: 'Satellite: each tap turns the zig-zag', pulsar: 'Pulsar: each tap flips to the other side of the ring',
  comet: 'Comet: press and hold on the bar, let go on the ring', spring: 'spring pad: tap it, and it throws you', tide: 'tide pad: tap it, and gravity turns over',
  chime: 'jump orb: tap it in mid-air to hop again', slip: 'dash orb: tap it, and it carries you', grav: 'gravity orb: tap it in mid-air, and gravity turns over', combo: 'combo: orb to orb, one tap each, on the beat',
  mirror: 'mirror gate: the picture flips', invert: 'upside-down gate: the picture turns over', dual: 'dual: one tap, two different sparks'
};
/** the hand the play field's few words are written in (the same as the rest of the interface); plain sans in a test chamber */
const HAND = '"Cormorant Garamond", "Hoefler Text", Baskerville, Palatino, Georgia, serif';
const INK: RGB = [78, 42, 150]; // what the Stillness leaves in the way: dark violet with a pale rim
const INK_RIM: RGB = [205, 178, 255];
/**
 * The one colour that means "tap now", and nothing else on the screen may wear it: the ring that closes on a node
 * and the star cut into the node it closes on. (The second look: one signal for every tap.)
 */
const TAP: RGB = [255, 204, 72];
/** what a hold is drawn in: a calm ribbon to follow while the finger stays down */
const HOLD: RGB = [110, 206, 222];
/** The second look's quiet family: everything that is not a tap or a danger steps back into cool, low-contrast tones. */
// (gates, spikes, planet-hop arrows and speed signs are the soft blue of the legend too: only the gold ring stands out)
const QUIET = { gold: [150, 158, 204] as RGB, stone: [84, 94, 140] as RGB, woken: [128, 150, 222] as RGB, star: [150, 158, 204] as RGB, cyan: [146, 180, 232] as RGB, violet: [150, 160, 226] as RGB };
const LOUD = { gold: [240, 200, 98] as RGB, stone: [158, 172, 214] as RGB, woken: [255, 224, 160] as RGB, star: [255, 244, 200] as RGB, cyan: [112, 220, 204] as RGB, violet: [178, 150, 255] as RGB };
/** Each form's own colour: its lens, and the trim of the hero while in it. */
export const FORM_COL: Record<Form, RGB> = { orb: [255, 255, 255], meteor: [255, 150, 90], sat: [120, 220, 255], pulsar: [200, 140, 255], comet: [150, 255, 200] };
const FORM_NAME: Record<Form, string> = { orb: 'ORB', meteor: 'METEOR', sat: 'SATELLITE', pulsar: 'PULSAR', comet: 'COMET' };

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); };
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rgba = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

/** back: drawn behind the course (kick bursts, the drop's shards), so it can never cover a mark. */
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; col: RGB; size: number; back?: boolean }
interface Ripple { x: number; y: number; age: number; col: RGB }
/** An expanding ring: the shockwaves of the drop, of big hits, and of on-beat taps in the loud parts. */
interface Wave { r: number; v: number; life: number; max: number; col: RGB; w: number; a: number }
/** One ring as the ball meets it: a ceiling while it is the ring above, then the floor it rides to the next note. */
interface Platform {
  lv: number; side: number; fs: number; fe: number; cs: number; ce: number; note: number; tol: number; auto: boolean;
  smash: boolean; accent: boolean; sling: boolean; after: boolean; twin: 'a' | 'b' | 'both' | null; flipAt: number; flipTol: number; pulse: boolean;
  /** the planet this ring belongs to; and, if it is entered through a spin gate, when, how wide and from which side */
  planet: number; spinAt: number; spinTol: number; enterSide: number;
  /** the press that leaves this ring: its form, what the button does on it, and whether the game takes it as a pad */
  form: Form; act: 'tap' | 'down' | 'up'; pad: '' | 'spring' | 'tide' | 'jump' | 'vent'; wide: boolean;
  /** an orb: there is no ring here, only the mark in mid-air (and which orb). noCeil: the press before stayed on this ring */
  chime: boolean; orb: '' | 'jump' | 'dash' | 'grav'; noCeil: boolean;
}
/** Things that fly past behind the course in a drop: shards thrown out from the centre, and ring fragments in orbit. */
interface Debris { a: number; d: number; v: number; rot: number; spin: number; size: number; kind: number; hue: number }
interface Frag { r: number; a: number; len: number; w: number; v: number }

export class GdRenderer {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private particles: Particle[] = [];
  /** spent particles, kept to be used again (no allocation while playing) */
  private spent: Particle[] = [];
  private ripples: Ripple[] = [];
  private waves: Wave[] = [];
  private trail: Array<{ beat: number; rho: number; off: number; pf: number; away?: number }> = [];
  private debris: Debris[] = [];
  private frags: Frag[] = [];
  private glitch = 0;
  private bands: Array<[number, number, number]> = [];
  private flipK = 0;
  private burstK = 0;
  private camX = 0;
  private camVX = 0;
  private camVY = 0;
  // The camera's bumps as the course feels them. `punch` and `zoomKick` jump the moment a hit lands (the backdrop uses
  // them like that); these follow within a few frames, so the rings and the ball swell and settle instead of jumping.
  private punchS = 0; private punchV = 0;
  private zoomS = 0; private zoomV = 0;
  // how far the ball has lifted off its ring, 0..1: it floats while the button is held and settles when it is let go
  /** beats of course drawn ahead of the ball (a B-side shows less) */
  private ahead = 3;
  private lift = 0;
  private liftV = 0;
  /** how far the ball has left the safe line for a shard branch, 0..1 */
  private branchV = 0;
  private branchK = 0;
  private branchE = 0;
  /** the picture's left-to-right scale: -1 past a mirror gate; and its top-to-bottom scale: -1 past an upside-down gate */
  private mx = 1;
  private my = 1;
  private mxS = 1; private myS = 1; private mxV = 0; private myV = 0;
  private gatesPassed = 0;
  /** test chambers: no backdrop at all, only the course on a flat ground */
  plain = false;
  /** a painted sky for this level (its planet's own, with its soul in it), in place of the atlas's plate */
  backdrop: { draw: (c: CanvasRenderingContext2D, w: number, h: number, st: { time: number; song?: number; colour: number; drive: number; kick: number; woke: number; strike: number; dark: number; calm: boolean; cam?: [number, number, number] }) => void } | null = null;
  private songT = 0;
  private woke = -1;
  private strike = 0;
  /** test chambers: draw the Lantern's four windows and the cap coming down on them (the ambush) */
  windows = false;
  /** how much of the planet's colour is showing, 0..1: none in a calm engraved stretch, all of it in an earned drop */
  private colour = 0;
  private heroDir = 1;
  /** a form change morphs over 150 ms: the form he is becoming, the one he was, and when it began (page ms) */
  private morphTo: Form = 'orb'; private morphFrom: Form = 'orb'; private morphAt = -1e9;
  /** which twin is being drawn (the second spark of a twin orbit is Helion in a memory) */
  private who: 'orbin' | 'helion' = 'orbin';
  private heroSide = 1;
  /** a memory of Helion: the twin orbit's second spark is him */
  twinIs: 'orbin' | 'helion' = 'orbin';
  /**
   * The look of the course. 2 is the one-signal language: a gold ring closing on a node is the only thing that means
   * "tap", only the next two taps wear it, optional gold notes are not drawn, a hold is a calm ribbon, and everything
   * else is quiet. 1 is the look before it.
   */
  private _look: 1 | 2 = 1;
  /** the core's flare: 1 on the drop's big hits (its great node, an accent, the finish), falling away in half a second */
  private coreFlare = 0;
  get look(): 1 | 2 { return this._look; }
  set look(v: 1 | 2) { this._look = v; const P = v === 2 ? QUIET : LOUD; GOLD = P.gold; STONE = P.stone; WOKEN = P.woken; STAR = P.star; CYAN = P.cyan; VIOLET = P.violet; }
  /** the beat of the second tap still to come: nodes after it wait, unlit */
  private cueUntil = Infinity;
  /** the beat of the first tap still to come: a node behind it has been dealt with, and is unlit again */
  private cueFrom = -Infinity;
  /** where the lit nodes were drawn in the last frame, in screen points, soonest first (for the freeze-frame test's answer sheet) */
  cues: Array<{ x: number; y: number; beat: number }> = [];
  /** the world in the middle of the ring (the level is the place): drawn in place of the core, under the course */
  planet: World | null = null;
  /** the level's embers (checkpoints), in beats: a coal on the course that catches as he passes */
  embers: number[] = [];
  private worldR = 0;
  /** where the middle of the ring is on the screen (css px): the star rises from there */
  coreAt: [number, number] = [0, 0];
  /** a companion met in the scene before a world's first attempt: its colour, or null */
  meet: number[] | null = null;
  /**
   * The meeting (the scene before a first attempt, while the song has not begun): a Kindling drifts in beside Orbin,
   * circles him once, then flies ahead to where its form will be given. t: the run's song time (below zero).
   */
  drawMeet(t: number, now: number): void {
    if (!this.meet || t > 0.4) return;
    const c = this.ctx, k = this.canvas.width / Math.max(1, this.w);
    c.setTransform(k, 0, 0, k, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    const [hx, hy] = this.heroAt[0] ? this.heroAt : [this.w * 0.5, this.h * 0.45];
    const come = smooth((t + 8.2) / 2.2), go = smooth((t + 1.6) / 1.8), ph = now / 1000;
    const x = lerp(this.w * 1.1, hx + Math.cos(ph * 0.9) * 46, come) + go * (this.w * 0.5 - hx) * 0.6, y = lerp(this.h * 0.2, hy - 40 + Math.sin(ph * 1.3) * 14, come) - go * this.h * 0.25;
    const s = Math.min(this.w / 390, this.h / 844) * 0.55;
    COMPANIONS.kindling(c, x, y, s, this.meet, { flap: 0.5 + 0.5 * Math.sin(ph * 4), alpha: come * (1 - go), rot: Math.sin(ph) * 0.2 });
  }
  /** where Orbin was drawn last, on the screen (css px): the star sequence starts from him */
  heroAt: [number, number] = [0, 0];
  private globeCv: HTMLCanvasElement | null = null;
  /** the menus' sky: how much of the galaxy's colour is home, 0..1 */
  idleColour = 0;
  private formWas: Form = 'orb';
  private camY = 0;
  private pf = 0;
  private coreX = 0;
  private coreY = 0;
  private eq = new Float32Array(EQ_BARS);
  private stars: Array<{ a: number; d: number; s: number }> = [];
  private starPhase = 0;
  private rayTurn = 0;
  private bound: GdRun | null = null;
  private plats: Platform[] = [];
  private hints: Array<[number, number, string]> = [];
  private energy: number[] = [];
  private cam = 0;
  private camVel = 0;
  private baseR = 1;
  private inten = 0;
  private flowV = 0.5;
  private drain = 0;
  private flash = 0;
  private strobe = 0;
  private punch = 0;
  private zoomKick = 0;
  private ringFlash = 0;
  private world = 0;
  private twinV = 0;
  private kickWas = 0;
  private snareWas = 0;
  private dropAge = 99;
  private dropFull = false;
  private dropPower = 1;
  private chargeV = 0;
  private landPulse = 0;
  private shake = 0;
  private dark = 0;
  private pal: Palette = PALETTES.deep;
  private palFrom: Palette = PALETTES.deep;
  private palName = '';
  private palT = 1;
  private ball = { x: 0, y: 0, r: 0 };
  // sizes for this frame
  private r0 = 100;
  private gap = 24;
  private rb = 6;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    for (let i = 0; i < 90; i++) this.stars.push({ a: Math.random() * TWO_PI, d: Math.random(), s: 0.4 + Math.random() * 1.3 });
    for (let i = 0; i < 34; i++) this.debris.push({ a: Math.random(), d: Math.random(), v: 0.25 + Math.random() * 0.5, rot: Math.random() * TWO_PI, spin: (Math.random() - 0.5) * 5, size: 5 + Math.random() * 13, kind: i % 3, hue: Math.random() });
    for (let i = 0; i < 14; i++) this.frags.push({ r: 0.3 + Math.random() * 0.75, a: Math.random() * TWO_PI, len: 0.25 + Math.random() * 0.7, w: 2 + Math.random() * 6, v: (Math.random() < 0.5 ? -1 : 1) * (0.15 + Math.random() * 0.5) });
    this.resize();
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
  }

  reset(): void {
    this.bound = null;
  }

  private bind(run: GdRun): void {
    this.bound = run;
    const level = run.level;
    const c = run.course;
    this.plats = platforms(c, level);
    this.padCol = level.id === 'heroes' ? [255, 168, 96] : [150, 235, 220];
    this.geo = null;
    if (level.file.places?.length) {
      // each place's stretch of orbit (the angles the ball covers there), and a spiral's window, from the course itself
      const defs = level.file.places, span: Array<[number, number]> = defs.map(() => [0, 0]), seen = defs.map(() => false);
      for (let b = c.start; b <= c.end; b += 0.25) { const k = c.at(b).planet; if (k !== Math.round(k) || k < 0 || k >= defs.length) continue; const a = c.angle(b); if (!seen[k]) { span[k] = [a, a]; seen[k] = true; } else span[k][1] = a; }
      const win = defs.map((d): [number, number] | null => (d.spiral ? [-Math.PI / 2 + c.angle(d.spiral[0]), -Math.PI / 2 + c.angle(d.spiral[1])] : null));
      // (an eight crosses itself where raw angle -PI/2 falls, scaled: its phase puts that on the beat it names)
      const placed = defs.map((d) => (d.shape === 'eight' && d.cross !== undefined ? { ...d, phase: -Math.PI / 2 * (d.size ?? 1) - (-Math.PI / 2 + c.angle(d.cross)) } : d));
      this.geo = { defs: placed, span: span.map(([a, b]) => [-Math.PI / 2 + a, -Math.PI / 2 + b]), win };
      // each leap's flight: from its launch on one place to its landing on the next (drawn as one arc between them)
      this.leapArcs = c.presses.filter((q) => q.leap && !q.leap.ember).map((q) => ({ p0: q.leap!.p0, a0: -Math.PI / 2 + c.angle(q.leap!.b0), a1: -Math.PI / 2 + c.angle(q.leap!.b1) }));
      // each flight keeps his speed through its launch and its landing (the Ufotable pass, 2026-11-26): the pace he
      // rides the ring at, as a share of the flight arc's own pace at each end (its tangents), for leapAt's timing
      for (const q of c.presses) {
        if (!q.leap || q.leap.ember) continue;
        const L = q.leap, k = Math.round(L.p0), R = this.rad(this.cam), T = L.b1 - L.b0, e = 0.05;
        const pt = (kk: number, b: number): [number, number] => { const [ox, oy] = this.planetXY(kk), p = this.locK(kk, -Math.PI / 2 + c.angle(b), R); return [ox + p[0], oy + p[1]]; };
        const P0 = pt(k, L.b0), P1 = pt(k + 1, L.b1), v0 = Math.hypot(...([0, 1].map((i) => P0[i] - pt(k, L.b0 - e)[i]) as [number, number])) / e, v1 = Math.hypot(...([0, 1].map((i) => pt(k + 1, L.b1 + e)[i] - P1[i]) as [number, number])) / e;
        const d = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]) || 1, lift = Math.min(d * 0.32, R * 2.2), M: [number, number] = [(P0[0] + P1[0]) / 2, (P0[1] + P1[1]) / 2];
        const t0 = 2 * Math.hypot(M[0] - P0[0], M[1] - P0[1] - lift * 0) || 1, t1 = 2 * Math.hypot(P1[0] - M[0], P1[1] - M[1]) || 1, arc = Math.hypot(d, 2 * lift);
        L.s0 = clamp((v0 * T) / Math.max(t0, arc * 0.8), 0.25, 2.2); L.s1 = clamp((v1 * T) / Math.max(t1, arc * 0.8), 0.25, 2.2);
      }
      // (the taps in the air ride the same flight: the same timing, or he would jump as each is tapped)
      for (const q of c.presses) if (q.leap?.ember) { const L = c.presses.find((o) => o.leap && !o.leap.ember && Math.abs(o.leap.b0 - q.leap!.b0) < 1e-6)?.leap; if (L) { q.leap.s0 = L.s0; q.leap.s1 = L.s1; } }
    }
    if (!this.globeCv) this.globeCv = stamp(160, 160, (g) => globe(g, 80, 80, 74, 225, rng(5)), 2);
    this.colour = 0;
    this.ahead = level.file.side?.ahead ?? level.file.rules?.ahead ?? 3;
    // hints: the first mark, the first gold note, and each mechanic the first time the level uses it
    this.hints = [];
    const firstPress = c.presses[0];
    // (the one-signal look writes on the course only what is new: the tap and the hold are taught once, in the first
    // stage's own lessons, and a form is named once, where it is given. Nothing else is labelled.)
    // (in the one-signal look a thing is explained once, in the level that first has it: the first stage teaches the tap,
    // the ribbon, the spike, the spin gate, the planet hop and the speed gate; after it, only a world's own gift is told)
    const first = level.id === 'started', quiet = this.look === 2;
    const taught = (w: Feature) => quiet && (w === 'rail' || w === 'line' || w === 'twin' || w === 'charge' || w === 'smash' || (!first && (w === 'reverse' || w === 'spin' || w === 'sling' || w === 'faster' || w === 'slower' || w === 'chime' || w === 'combo' || w === 'spring')));
    const said = (w: Feature) => (!quiet ? HINT[w] : w === 'reverse' ? 'a spike: tap it, and he turns round' : w === 'sling' && !level.file.holds ? 'a planet hop: tap, and he leaps to the next world' : w === 'spin' ? 'spin gate: tap as the gap comes round' : HINT[w]);
    if (firstPress && !quiet) this.hints.push([c.start - 9, firstPress.beat + 1.5, 'tap as he reaches each Star-Node']);
    const gold = c.flow.find((f) => !f.charge);
    if (gold && !quiet) this.hints.push([gold.beat - 3, gold.beat + 2.5, 'gold lights: bonus taps']);
    // (each world names its own gift once: Cirra's Satellite is the wave, Glassmere's Pulsar the ball, Verdance's the snap)
    const GIFT: Record<string, Partial<Record<Feature, string>>> = { skyhigh: { sat: 'the wave: each tap turns the zig-zag' }, blank: { pulsar: 'the ball: each tap turns gravity over' }, invincible: { pulsar: 'the snap: each tap jumps you across the branch at once' } };
    const named = (w: Feature) => GIFT[level.file.side?.of ?? level.id]?.[w] ?? said(w);
    // (the ambush brings nothing new: everything so far, under pressure; nothing is named)
    for (const f of c.firsts) if (!taught(f.what) && level.id !== 'ambush' && level.id !== 'royalty') this.hints.push(f.what === 'charge' ? [f.beat - 2.5, f.beat + 4, HINT.charge] : f.what === 'smash' ? [f.beat - 5, f.beat, HINT.smash] : [f.beat - 4.5, f.beat + 1.5, named(f.what)]);
    this.hints.sort((a, b) => a[0] - b[0]);
    this.energy = barEnergy(level);
    this.particles = [];
    this.ripples = [];
    this.waves = [];
    this.trail = [];
    this.flash = this.strobe = this.punch = this.zoomKick = this.ringFlash = this.landPulse = this.shake = this.dark = this.drain = this.glitch = this.flipK = this.burstK = this.coreFlare = 0;
    this.punchS = this.zoomS = this.punchV = this.zoomV = 0; this.tgOn = false; this.plume = []; this.camSV = this.csTV = 0; this.camTOn = false; this.baseT = 1; this.baseTV = 0;
    this.lift = this.liftV = 0;
    this.branchV = this.branchK = 0;
    this.mx = 1;
    this.my = 1;
    this.mxS = this.myS = 1; this.mxV = this.myV = 0;
    this.gatesPassed = 99;
    this.formWas = c.formAt(run.viewTime / level.spb);
    this.dropAge = 99;
    this.dropFull = run.dropFull === true;
    this.dropPower = run.dropPower;
    this.chargeV = run.sim.charge;
    const beat = run.viewTime / level.spb;
    this.world = beat >= c.dropBeat ? 1 : 0;
    this.twinV = c.twins.some(([a, z]) => beat >= a && beat < z) ? 1 : 0;
    this.cam = run.sim.rho(beat);
    this.camVel = 0;
    this.sizes();
    this.pf = this.planetOf(run, beat);
    [this.camX, this.camY] = this.planetXY(this.pf);
    this.camVX = this.camVY = 0;
    this.baseR = run.sim.side > 0 ? 1 : 1.5;
    this.flowV = run.sim.flow;
    this.inten = this.energyAt(beat);
    this.palName = level.segAt(Math.max(0, run.viewTime)).look.palette;
    this.pal = this.palFrom = PALETTES[this.palName] || PALETTES.deep;
    this.palT = 1;
    this.ball.r = 0;
  }

  private energyAt(beat: number): number {
    const e = this.energy;
    if (!e.length) return 0.5;
    const x = clamp(beat / 4 - 0.5, 0, e.length - 1);
    const i = Math.floor(x);
    return lerp(e[i], e[Math.min(e.length - 1, i + 1)], x - i);
  }

  /** Palette colour; when the player has lost the rhythm the world's colours drain toward grey. */
  private col(c: RGB, a = 1): string {
    const g = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
    const d = this.drain * 0.85;
    return `rgba(${lerp(c[0], g, d) | 0},${lerp(c[1], g, d) | 0},${lerp(c[2], g, d) | 0},${a})`;
  }

  private sizes(): number {
    const m = Math.min(this.w, this.h * 0.94);
    this.r0 = m * 0.27;
    this.gap = this.r0 * 0.25;
    this.rb = Math.max(6.2, this.r0 * 0.066);
    return m;
  }

  // ---- the journey's places (the owner's brief of 2026-11-26; src/gd/shapes.ts). Without them, every ring is a circle
  // round its planet's core, exactly as before.
  private geo: { defs: PlaceDef[]; span: Array<[number, number]>; win: Array<[number, number] | null> } | null = null;
  /** the place the ring being drawn belongs to (set before drawing round it) */
  private lk = 0;
  private locK(k: number, a: number, r: number): [number, number, number, number] {
    const g = this.geo!, i = clamp(k, 0, g.defs.length - 1);
    return placePoint(g.defs[i], a, r, this.rad(this.cam), g.span[i], g.win[i], this.w >= this.h);
  }
  private leapArcs: Array<{ p0: number; a0: number; a1: number }> = [];
  /** Where angle a at radius r is, relative to the centre of place pf (part-way between two places in a leap). */
  private loc(pf: number, a: number, r: number): [number, number] {
    if (!this.geo) return [Math.cos(a) * r, Math.sin(a) * r];
    const k = Math.floor(pf + 1e-9), f = pf - k, p = this.locK(k, a, r);
    if (f < 1e-6 || k + 1 >= this.geo.defs.length) return [p[0], p[1]];
    // in a leap: one smooth arc from the launch point to the landing, bowed up off the place he leaves (2026-11-26)
    const L = this.leapArcs.find((l) => l.p0 === k);
    if (L) {
      const R = this.rad(this.cam), [c0x, c0y] = this.planetXY(k), [c1x, c1y] = this.planetXY(k + 1), s0 = this.locK(k, L.a0, r), s1 = this.locK(k + 1, L.a1, r);
      const x0 = c0x + s0[0], y0 = c0y + s0[1], x1 = c1x + s1[0], y1 = c1y + s1[1], dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1;
      let nx = -dy / d, ny = dx / d; if (nx * s0[2] + ny * s0[3] < 0) { nx = -nx; ny = -ny; }
      const lift = Math.min(d * 0.32, R * 2.2) + (r - R) * 0.6, mx = (x0 + x1) / 2 + nx * lift, my = (y0 + y1) / 2 + ny * lift;
      const bx = (1 - f) * (1 - f) * x0 + 2 * (1 - f) * f * mx + f * f * x1, by = (1 - f) * (1 - f) * y0 + 2 * (1 - f) * f * my + f * f * y1;
      const [ox, oy] = this.planetXY(pf);
      return [bx - ox, by - oy];
    }
    const q = this.locK(k + 1, a, r);
    return [lerp(p[0], q[0], f), lerp(p[1], q[1], f)];
  }
  /** The same, relative to the camera. */
  private wxy(pf: number, a: number, r: number): [number, number] { const [ox, oy] = this.planetXY(pf), [x, y] = this.loc(pf, a, r); return [ox - this.camX + x, oy - this.camY + y]; }
  /** Which way is up (away from what he rides on) at angle a in place pf, as an angle. */
  private upA(pf: number, a: number): number { if (!this.geo) return a; const p = this.locK(Math.round(pf), a, this.rad(this.cam)); return Math.atan2(p[3], p[2]); }
  /** A ring round the place being drawn, or the stretch of it near angle a0 (a bridge, a spiral). */
  private ringPath(r: number, a0: number): void {
    const c = this.ctx;
    if (!this.geo) { c.arc(0, 0, r, 0, TWO_PI); return; }
    for (let i = 0; i <= 96; i++) { const [x, y] = this.loc(this.lk, a0 - Math.PI + (TWO_PI * i) / 96, r); if (i) c.lineTo(x, y); else c.moveTo(x, y); }
  }

  /** Where a planet's core is in the world. Each planet hop goes on to the next: across on a wide screen, up on a tall one. */
  private planetXY(pf: number): [number, number] {
    if (this.geo) {
      const d = this.geo.defs, U = this.rad(this.cam), wide = this.w >= this.h, k = clamp(Math.floor(pf), 0, d.length - 1), f = clamp(pf - k, 0, 1);
      const [x0, y0] = placeAt(d[k], wide), [x1, y1] = placeAt(d[Math.min(d.length - 1, k + 1)], wide);
      return [lerp(x0, x1, f) * U, lerp(y0, y1, f) * U];
    }
    const d = this.r0 * 2.75;
    const at = (k: number): [number, number] => (this.w >= this.h ? [k * d, k % 2 ? -0.42 * d : 0] : [k % 2 ? 0.4 * d : 0, -k * d]);
    const k = Math.floor(pf);
    const f = pf - k;
    if (f < 1e-6) return at(k);
    const a = at(k);
    const b = at(k + 1);
    return [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
  }

  /** Which planet the ball is at; part-way between two while it flies a planet hop. */
  private planetOf(run: GdRun, beat: number): number {
    const sim = run.sim;
    const last = run.course.presses[sim.ni - 1];
    if (!last) return 0;
    if (last.sling && sim.mode === 'flight' && sim.fl) return last.planet + smoothstep((beat - sim.fl.t0) / (sim.fl.t1 - sim.fl.t0));
    if (last.leap && beat < last.leap.b1) return leapAt(last.leap, beat); // (the flight never waits at an ember not yet tapped: that held him a frame and then jumped him on; 2026-11-26)
    return last.planetTo;
  }

  /** Where the ball is, in ring levels: the simulation's path, plus the float of a held button. */
  private ballRho(sim: GdRun['sim'], beat: number): number {
    const rho = sim.rho(beat);
    const up = Math.max(this.lift, this.branchK);
    if (sim.mode === 'flight') return rho + sim.sideAt(beat) * LIFT * up;
    return sim.lv + sim.side * Math.max(Math.abs(rho - sim.lv), LIFT * up);
  }

  /** Screen radius of a ring level. The camera bumps on big hits and pulls right back as the drop goes off. */
  private rad(lv: number): number {
    return (this.r0 * this.baseR + (lv - this.cam) * this.gap) * (1 + this.punchS * 0.05) * (1 - this.zoomS * 0.2) * (1 - 0.12 * clamp(this.speedK, 0, 1)) * this.camScale * (1 + this.introZ * this.introK * this.introK);
  }

  private burst(x: number, y: number, n: number, col: RGB, speed: number, size = 1, back = false): void {
    if (this.look === 2) { col = mix(col, STONE, 0.65); n = Math.ceil(n * 0.5); back = true; } // (second look: particles are few, quiet, and behind the course)
    if (save.reducedMotion) n = Math.ceil(n / 3);
    for (let i = 0; i < n && this.particles.length < 420; i++) {
      const a = Math.random() * TWO_PI;
      const v = speed * (0.3 + Math.random() * 0.7);
      this.spawn(x, y, Math.cos(a) * v, Math.sin(a) * v, 0.3 + Math.random() * 0.35, col, (1.2 + Math.random() * 2.2) * size, back);
    }
  }

  private spawn(x: number, y: number, vx: number, vy: number, max: number, col: RGB, size: number, back: boolean): void {
    if (this.particles.length >= 420) return;
    const p = this.spent.pop() ?? ({} as Particle);
    p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = 0; p.max = max; p.col = col; p.size = size; p.back = back;
    this.particles.push(p);
  }
  /** how much faster than normal the course is going (eased), 0 at the normal pace */
  private speedK = 0;
  /** the world's own camera (eased): pulled back for a set piece that shows the planet whole (the Sleeper's throw) */
  private baseRV = 0; private baseT = 1; private baseTV = 0; private camTS = 0; private camTV = 0; private camTOn = false; private speedV = 0; private miniV = 0;
  /** Orbin's plume: a rope of springs, in the world's frame */
  private plume: Array<{ x: number; y: number; px: number; py: number }> = [];
  private camScale = 1; private camSV = 0; private csT = 1; private csTV = 0;
  /** the camera's eased target (the Ufotable pass) */
  private tgX = 0; private tgY = 0; private tgVX = 0; private tgVY = 0; private tgOn = false;
  /** mini (Cirra's tight gusts): how small Orbin is drawn, eased */
  private miniK = 0;
  private orbitK = 0; private whipAt = -1e9; private lensSeen = -1;
  /**
   * One continuous journey (the owner's brief of 2026-11-25): a level opens out of the light of the planet the map
   * dived into (a match cut: the camera settles back from close in, through the planet's colour), and a fall goes
   * back to its ember through a warm dissolve. introK: how much of that is left, 1..0.
   */
  private introK = 0; private introAt = 0; private introDur = 0.9; private introZ = 0.9; private introCol: RGB = [255, 220, 170];
  beginIntro(col: RGB, dur = 0.9, zoom = 0.9): void { this.introCol = col; this.introDur = dur; this.introZ = zoom; this.introAt = performance.now(); this.introK = 1; }
  /** Over everything, after the course: the light the level opens out of. */
  drawIntro(now: number): void {
    if (this.dropAge < 0.16 && this.dropPower >= 0.3 && !save.reduceFlash && !save.reducedMotion) {
      const c = this.ctx, k = 1 - this.dropAge / 0.16, d = 3 * k * this.dpr;
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.12 * k;
      try { c.drawImage(this.canvas, -d, 0); c.drawImage(this.canvas, d, 0); } catch { /* (a canvas with no size yet) */ }
      c.restore();
    }
    if (this.introK <= 0) return;
    this.introK = Math.max(0, 1 - (now - this.introAt) / 1000 / this.introDur);
    const k = this.introK * this.introK * (3 - 2 * this.introK), c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.fillStyle = rgba(this.introCol, k); c.fillRect(0, 0, this.w, this.h);
  }
  /** a jump pad's colour: the world's own life (the Edge's teal, Emberwick's fire) */
  private padCol: RGB = [150, 235, 220];
  /** stars stretched into streaks, behind the course, when the pace goes up */
  private streaks(time: number): void {
    const k = clamp(this.speedK / 0.5, 0, 1);
    if (k < 0.02 || save.reducedMotion) return;
    const c = this.ctx, cx = this.w / 2, cy = this.h * 0.52, R = Math.hypot(this.w, this.h) * 0.6;
    c.save(); c.globalCompositeOperation = 'screen'; c.lineCap = 'round';
    for (let i = 0; i < 46; i++) {
      const a = i * 2.399, ph = (time * (0.35 + 0.5 * k) + i * 0.137) % 1, r0 = R * (0.25 + 0.75 * ph), len = R * 0.18 * k * (0.4 + ph);
      c.strokeStyle = `rgba(220,232,255,${0.22 * k * ph})`; c.lineWidth = 1 + ph;
      c.beginPath(); c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); c.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len)); c.stroke();
    }
    c.restore();
  }

  private wave(r: number, col: RGB, speed: number, width: number, alpha: number, life = 0.45): void {
    if (this.look === 2) { col = mix(col, STONE, 0.8); alpha *= 0.5; }
    if (this.waves.length < 10) this.waves.push({ r, v: speed, life: 0, max: life, col, w: width, a: alpha });
  }

  private drawParticles(dt: number, back: boolean): void {
    const c = this.ctx;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (!!p.back !== back) continue;
      p.life += dt;
      if (p.life >= p.max) { const last = this.particles.pop()!; if (i < this.particles.length) this.particles[i] = last; this.spent.push(p); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - dt * 2.5;
      p.vy *= 1 - dt * 2.5;
      c.fillStyle = rgba(p.col, (1 - p.life / p.max) * (back ? 0.75 : 1));
      c.beginPath(); c.arc(p.x, p.y, p.size, 0, TWO_PI); c.fill();
    }
  }

  // ---------------------------------------------------------------- the world behind the course
  /** drive: 0 in the verse, up to 1 in a fully earned drop. It is what makes the drop several times livelier than the verse. */
  private background(p: Palette, time: number, dt: number, inten: number, groove: number, dark: number, drive: number, kick: number): void {
    const c = this.ctx;
    const cx = this.w / 2;
    const cy = this.h * 0.52;
    const span = Math.max(this.w, this.h) * 0.75;
    if (this.plain) { c.fillStyle = '#0d0e17'; c.fillRect(0, 0, this.w, this.h); return; }
    const calm = save.reducedMotion;
    if (this.backdrop) { this.backdrop.draw(c, this.w, this.h, { time, song: this.songT, colour: this.colour, drive, kick, woke: this.woke, strike: this.strike, dark, calm, cam: this.geo ? [this.camX, this.camY, this.rad(this.cam)] : undefined }); this.streaks(time); return; }
    const k = 0.4 + inten * 0.95 + groove * 0.7 + drive * kick * 0.5;
    // the bass warps the backdrop: its bright centre swells on every kick
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, span * (1 + (calm ? 0 : drive * kick * 0.18)));
    g.addColorStop(0, this.col([p.bg0[0] * k, p.bg0[1] * k, p.bg0[2] * k]));
    if (drive > 0.02) g.addColorStop(0.45, this.col(mix(p.bg0, p.ring, 0.22 * drive * (0.5 + kick)), 1));
    g.addColorStop(1, this.col(p.bg1));
    c.fillStyle = g;
    c.fillRect(0, 0, this.w, this.h);
    {
      // the atlas's plate behind everything: circles of declination, graduations and hour lines, in ink. As colour comes
      // home the lines take it, and in a drop the whole plate turns slowly.
      const lineCol = mix(ATLAS_INK, p.ring, this.colour);
      const turn = calm ? 0 : this.rayTurn * 0.6;
      c.lineWidth = 1;
      c.strokeStyle = this.col(lineCol, 0.13 + 0.1 * this.colour);
      for (const f of [0.62, 0.8, 1]) { c.beginPath(); c.arc(cx, cy, span * f, 0, TWO_PI); c.stroke(); } // (none inside the course: nothing behind the rings may look like a ring)
      c.beginPath();
      for (let a = 0; a < 12; a++) { const q = turn + (a / 12) * TWO_PI; c.moveTo(cx + Math.cos(q) * span * 0.62, cy + Math.sin(q) * span * 0.62); c.lineTo(cx + Math.cos(q) * span, cy + Math.sin(q) * span); }
      c.strokeStyle = this.col(lineCol, 0.07 + 0.08 * this.colour); c.stroke();
      c.beginPath();
      for (let a = 0; a < 120; a++) { const q = turn + (a / 120) * TWO_PI, l = a % 10 === 0 ? 11 : a % 5 === 0 ? 7 : 4; c.moveTo(cx + Math.cos(q) * span * 0.62, cy + Math.sin(q) * span * 0.62); c.lineTo(cx + Math.cos(q) * (span * 0.62 + l), cy + Math.sin(q) * (span * 0.62 + l)); }
      c.strokeStyle = this.col(lineCol, 0.26); c.stroke();
    }
    if (drive > 0.03) {
      // after the drop the world is a different place: turning light rays and a bloom, both breathing with the kick
      c.globalCompositeOperation = 'lighter';
      if (!calm) this.rayTurn += dt * (0.05 + drive * 0.12);
      const n = 14;
      c.fillStyle = this.col(p.acc, (0.035 + 0.075 * kick) * drive * (calm ? 0.5 : 1));
      c.beginPath();
      for (let i = 0; i < n; i++) {
        const a = this.rayTurn + (i / n) * TWO_PI;
        const half = 0.045 + 0.05 * ((i * 7) % 5) / 5;
        c.moveTo(cx, cy);
        c.lineTo(cx + Math.cos(a - half) * span * 1.4, cy + Math.sin(a - half) * span * 1.4);
        c.lineTo(cx + Math.cos(a + half) * span * 1.4, cy + Math.sin(a + half) * span * 1.4);
      }
      c.fill();
      const b = c.createRadialGradient(cx, cy, 0, cx, cy, span * 0.7);
      b.addColorStop(0, this.col(p.ring, (0.1 + 0.2 * kick) * drive));
      b.addColorStop(1, this.col(p.ring, 0));
      c.fillStyle = b;
      c.fillRect(0, 0, this.w, this.h);
      c.globalCompositeOperation = 'source-over';
    }
    if (drive > 0.08) {
      // chaos, all of it behind the course and all of it scaled by how big the drop was earned:
      // ring fragments in orbit...
      c.lineCap = 'round';
      const shown = Math.round(this.frags.length * Math.min(1, drive * 1.4) * (calm ? 0.4 : 1));
      for (let i = 0; i < shown; i++) {
        const f = this.frags[i];
        if (!calm) f.a += dt * f.v * (0.4 + drive * 0.9 + kick * drive * 1.5);
        c.strokeStyle = this.col(i % 2 ? p.acc : p.ring, (0.1 + 0.2 * kick) * drive);
        c.lineWidth = f.w * (1 + kick * drive);
        c.beginPath(); c.arc(cx, cy, f.r * span, f.a, f.a + f.len); c.stroke();
      }
      c.lineCap = 'butt';
      // ...and shards thrown out from the centre, repeated round it like a kaleidoscope, each second copy mirrored
      const fold = calm ? 1 : drive > 0.55 ? 6 : 4;
      const count = Math.round(this.debris.length * Math.min(1, drive * 1.5) * (calm ? 0.3 : 1));
      for (let i = 0; i < count; i++) {
        const o = this.debris[i];
        o.d += dt * o.v * (calm ? 0.12 : 0.22 + drive * 0.5 + kick * drive * 1.4);
        if (o.d > 1) { o.d -= 1; o.a = Math.random(); o.hue = Math.random(); }
        o.rot += dt * o.spin * (calm ? 0.2 : 1);
        const dist = o.d * o.d * span * 1.15;
        const size = o.size * (0.35 + o.d * 1.9);
        c.fillStyle = this.col(mix(p.ring, p.acc, o.hue), o.d * (1 - o.d) * 4 * (0.09 + 0.13 * drive));
        for (let k = 0; k < fold; k++) {
          const a = ((k % 2 ? 1 - o.a : o.a) + k) * (TWO_PI / fold);
          const x = cx + Math.cos(a) * dist;
          const y = cy + Math.sin(a) * dist;
          const rot = (k % 2 ? -o.rot : o.rot) + a;
          const ux = Math.cos(rot) * size;
          const uy = Math.sin(rot) * size;
          c.beginPath();
          if (o.kind === 0) { c.moveTo(x + ux, y + uy); c.lineTo(x - uy * 0.6, y + ux * 0.6); c.lineTo(x + uy * 0.6, y - ux * 0.6); } // shard
          else if (o.kind === 1) { c.moveTo(x + ux, y + uy); c.lineTo(x - uy * 0.5, y + ux * 0.5); c.lineTo(x - ux, y - uy); c.lineTo(x + uy * 0.5, y - ux * 0.5); } // diamond
          else { c.moveTo(x + ux * 1.6, y + uy * 1.6); c.lineTo(x - uy * 0.16, y + ux * 0.16); c.lineTo(x - ux * 1.6, y - uy * 1.6); c.lineTo(x + uy * 0.16, y - ux * 0.16); } // splinter
          c.fill();
        }
      }
    }
    if ((inten > 0.55 || drive > 0.05) && !calm) {
      // the groove: rings drifting outward, more of them and brighter in the drop
      const a = Math.max(clamp((inten - 0.55) / 0.45, 0, 1), drive);
      const n = drive > 0.3 ? 8 : 5;
      for (let i = 0; i < n; i++) {
        const f = (i / n + time * (0.16 + drive * 0.1)) % 1;
        c.lineWidth = 1.5 + f * (3 + drive * 4);
        c.strokeStyle = this.col(p.acc, (1 - f) * f * (0.8 + drive * 0.8) * a * (0.35 + groove));
        c.beginPath(); c.arc(cx, cy, f * f * span, 0, TWO_PI); c.stroke();
      }
    }
    // stars drift outward; in the drop every kick throws them forward as streaks
    this.starPhase += dt * (calm ? 0.01 : 0.01 + inten * 0.07 + drive * (0.1 + kick * 0.5));
    const streak = calm ? 0 : drive * (0.3 + kick) * 26;
    c.lineWidth = 1.4;
    for (const s of this.stars) {
      const d = (s.d + this.starPhase * s.s) % 1;
      const x = cx + Math.cos(s.a) * d * span;
      const y = cy + Math.sin(s.a) * d * span;
      const al = (0.1 + 0.4 * d) * (0.35 + inten * 0.65 + drive * 0.4);
      if (streak > 2) {
        c.strokeStyle = this.col(p.acc, al);
        c.beginPath(); c.moveTo(x, y); c.lineTo(x - Math.cos(s.a) * streak * d, y - Math.sin(s.a) * streak * d); c.stroke();
      } else {
        c.fillStyle = this.col(p.acc, al * 1.3);
        c.beginPath(); c.arc(x, y, s.s * 0.8, 0, TWO_PI); c.fill();
      }
    }
    if (this.flipK > 0.02 && !calm) {
      // colour flip on the kick: for a moment the whole backdrop swings to its opposite
      c.globalCompositeOperation = 'difference';
      c.fillStyle = this.col(mix(p.acc, WHITE, 0.25), this.flipK * 0.3 * drive);
      c.fillRect(0, 0, this.w, this.h);
      c.globalCompositeOperation = 'source-over';
    }
    if (dark > 0.01) { c.fillStyle = `rgba(0,0,0,${dark})`; c.fillRect(0, 0, this.w, this.h); }
    tooth(c, this.w, this.h, 0.55); // paper tooth over the whole sheet
  }

  /** Audio-reactive equalizer round the core, with the flow meter and the drop's charge as arcs round it. */
  private core(pal: Palette, rc: number, len: number, kick: number, snare: number, dt: number, flow: number, charge: number, drive: number, span: number, planet?: [RGB, RGB, RGB], night = false): void {
    const c = this.ctx;
    const spec = audio.spectrum();
    for (let i = 0; i < EQ_BARS; i++) {
      const m = i < EQ_BARS / 2 ? i : EQ_BARS - 1 - i;
      const v = spec ? Math.pow(spec[2 + Math.floor(m * 1.7)] / 255, 1.5) : kick * Math.exp(-m * 0.12) + snare * 0.7 * Math.exp(-Math.abs(m - 14) * 0.15);
      this.eq[i] += (v - this.eq[i]) * Math.min(1, dt * (v > this.eq[i] ? 40 : 9));
    }
    c.lineCap = 'round';
    const quiet = this.look === 2, flare = this.coreFlare;
    if (quiet) drive *= flare; // (the new look: beams only on the big hits)
    if (drive > 0.05 && !save.reducedMotion) {
      // in the drop the equalizer's bars reach right across the screen on the kick, as beams behind the course
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < EQ_BARS; i++) {
        const v = this.eq[i];
        if (v < 0.12) continue;
        const a = (i / EQ_BARS) * TWO_PI - Math.PI / 2 + Math.PI / EQ_BARS;
        const far = rc * 1.2 + v * len + v * (0.25 + kick + this.burstK * 1.3) * drive * span; // on the kick they burst right to the edges
        c.lineWidth = 2 + v * 5 * drive;
        c.strokeStyle = this.col(mix(pal.ring, pal.acc, v), (0.05 + 0.2 * v * kick + 0.18 * this.burstK) * drive);
        c.beginPath(); c.moveTo(Math.cos(a) * rc * 1.2, Math.sin(a) * rc * 1.2); c.lineTo(Math.cos(a) * far, Math.sin(a) * far); c.stroke();
      }
      c.globalCompositeOperation = 'source-over';
    }
    const glow = c.createRadialGradient(0, 0, 0, 0, 0, rc * (1.1 + kick * 0.4));
    glow.addColorStop(0, this.col(pal.ring, quiet ? 0.1 + 0.6 * flare : 0.5 + kick * 0.35));
    glow.addColorStop(1, this.col(pal.ring, 0));
    c.fillStyle = glow;
    c.beginPath(); c.arc(0, 0, rc * (1.1 + kick * 0.4), 0, TWO_PI); c.fill();
    if (planet) {
      // the planet whose song this is, at the heart of its rings. It loses its colour with the rest of the world when
      // the rhythm is lost; a B-side shows its night side.
      const rp = rc * 1.08;
      if (this.globeCv) c.drawImage(this.globeCv, -rp * 1.08, -rp * 1.08, rp * 2.16, rp * 2.16);
      c.globalAlpha = this.colour;
      const body = c.createRadialGradient(-rp * 0.3, -rp * 0.35, rp * 0.1, 0, 0, rp);
      body.addColorStop(0, this.col(planet[0]));
      body.addColorStop(0.7, this.col(planet[1]));
      body.addColorStop(1, this.col(planet[2]));
      c.fillStyle = body;
      c.beginPath(); c.arc(0, 0, rp, 0, TWO_PI); c.fill();
      c.save();
      c.beginPath(); c.arc(0, 0, rp, 0, TWO_PI); c.clip();
      c.fillStyle = this.col(planet[2], 0.5);
      c.beginPath(); c.moveTo(-rp, rp * 0.1); c.quadraticCurveTo(-rp * 0.4, -rp * 0.22, 0, rp * 0.08); c.quadraticCurveTo(rp * 0.5, rp * 0.4, rp, rp * 0.02); c.lineTo(rp, rp); c.lineTo(-rp, rp); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(-rp, rp * 0.55); c.quadraticCurveTo(-rp * 0.3, rp * 0.3, rp * 0.2, rp * 0.52); c.quadraticCurveTo(rp * 0.6, rp * 0.66, rp, rp * 0.4); c.lineTo(rp, rp); c.lineTo(-rp, rp); c.closePath(); c.fill();
      if (night) { c.fillStyle = 'rgba(7,4,26,0.55)'; c.fillRect(-rp, -rp, rp * 2, rp * 2); }
      c.restore();
      c.globalAlpha = 1;
    }
    c.lineWidth = Math.max(2, ((rc * TWO_PI) / EQ_BARS) * 0.5);
    for (let i = 0; i < EQ_BARS; i++) {
      const a = (i / EQ_BARS) * TWO_PI - Math.PI / 2 + Math.PI / EQ_BARS;
      const v = this.eq[i];
      c.strokeStyle = quiet ? rgba(STONE, 0.14 + v * 0.2 + flare * 0.5) : this.col(mix(pal.ring, pal.acc, v), 0.4 + v * 0.6);
      c.beginPath(); c.moveTo(Math.cos(a) * rc * 1.12, Math.sin(a) * rc * 1.12); c.lineTo(Math.cos(a) * (rc * 1.2 + v * len), Math.sin(a) * (rc * 1.2 + v * len)); c.stroke();
    }
    if (flow >= 0) {
      // flow meter: fills as taps land on the notes, turns gold when the music is fully open
      const rm = rc * 1.2 + len + 7;
      const hot = flow >= 0.66;
      c.lineWidth = 3.5;
      c.strokeStyle = quiet ? 'rgba(150,158,204,0.1)' : 'rgba(255,255,255,0.13)';
      c.beginPath(); c.arc(0, 0, rm, 0, TWO_PI); c.stroke();
      if (flow > 0.005) {
        c.strokeStyle = quiet ? rgba(WOKEN, hot ? 0.34 : 0.22) : hot ? rgba(GOLD) : rgba(mix(pal.acc, WHITE, 0.4), 0.9);
        if (quiet) c.lineWidth = 2; // (the flow ring is scenery: fainter and finer than anything on the course)
        if (hot && !quiet) { c.shadowColor = rgba(GOLD, 0.9); c.shadowBlur = 10; }
        c.beginPath(); c.arc(0, 0, rm, -Math.PI / 2, -Math.PI / 2 + flow * TWO_PI); c.stroke();
        c.shadowBlur = 0;
      }
      if (charge > 0.005) {
        // the drop's charge: a thicker white arc outside the flow meter, filled by tapping the roll
        const ro = rm + 8 + charge * 2;
        c.lineWidth = 5 + charge * 3;
        c.strokeStyle = 'rgba(255,255,255,0.16)';
        c.beginPath(); c.arc(0, 0, ro, 0, TWO_PI); c.stroke();
        c.strokeStyle = rgba(mix(WHITE, GOLD, charge >= 1 ? 0.6 : 0));
        c.shadowColor = 'rgba(255,255,255,0.9)';
        c.shadowBlur = 6 + charge * 14;
        c.beginPath(); c.arc(0, 0, ro, -Math.PI / 2, -Math.PI / 2 + charge * TWO_PI); c.stroke();
        c.shadowBlur = 0;
      }
    }
    c.lineCap = 'butt';
  }

  /** eko: the hero himself, with his face, his flame tuft and his hoop in the chosen Glow (a plain ball otherwise). */
  private drawBall(x: number, y: number, r: number, col: RGB, angle = 0, along = 1, across = 1, eko = false): void {
    const c = this.ctx;
    if (eko) {
      // Orbin in play: the figure of the story, small. He stands out from the path he rides (his head away from the
      // world, his tail toward it), leans into the way he is going, and his plume streams behind. His light is the
      // chosen Glow. (Helion, in a memory, is drawn the same way.)
      const side = this.heroSide, s = r * 0.0215 * (0.94 + 0.06 * along);
      const g = c.createRadialGradient(x, y, 0, x, y, r * 4.6); g.addColorStop(0, rgba(mix(col, [255, 200, 120], 0.5), 0.42)); g.addColorStop(1, rgba(col, 0));
      c.fillStyle = g; c.fillRect(x - r * 4.6, y - r * 4.6, r * 9.2, r * 9.2);
      c.save();
      c.translate(x, y);
      c.rotate(angle + (side >= 0 ? Math.PI / 2 : -Math.PI / 2));
      // squash and stretch: the figure's height runs away from the path (a hop stretches him, a landing or the crouch
      // before a tap presses him down); kept to about half the ball's, so the figure reads as alive, not as rubber
      c.scale(1 + (across - 1) * 0.6, 1 + (along - 1) * 0.6);
      CANON.parts.spark(c, 0, -34 * s, s, { who: this.who, lite: true, glow: 1, lean: -0.42, crest: 1, arms: 'back', face: this.heroDir * (side >= 0 ? 1 : -1), eyes: 'set', beat: 1, t: performance.now() / 1000, tint: col });
      c.restore();
      return;
    }
    c.save();
    c.translate(x, y);
    c.rotate(angle);
    c.scale(along, across);
    c.shadowColor = rgba(col, 0.9);
    c.shadowBlur = r * 2.2;
    c.fillStyle = eko ? '#fff6dc' : '#ffffff';
    c.beginPath(); c.arc(0, 0, r, 0, TWO_PI); c.fill();
    c.shadowBlur = 0;
    if (!eko) {
      c.lineWidth = r * 0.35;
      c.strokeStyle = rgba(col, 0.95);
      c.beginPath(); c.arc(0, 0, r * 1.25, 0, TWO_PI); c.stroke();
    }
    c.restore();
  }

  /** A lens shard: a splinter of the Lantern's lens. A dark edge, an outline, and a filling that grows with `fill` (0..1). */
  private star(x: number, y: number, R: number, col: RGB, fill: number, turn: number): void {
    if (R <= 0.5) return;
    const c = this.ctx;
    const pts: Array<[number, number]> = [[0.05, -1.05], [0.62, -0.2], [0.2, 1.05], [-0.58, 0.28]];
    const ca = Math.cos(turn);
    const sa = Math.sin(turn);
    const path = (rr: number) => {
      c.beginPath();
      pts.forEach(([px, py], k) => { const X = x + (px * ca - py * sa) * rr; const Y = y + (px * sa + py * ca) * rr; if (k === 0) c.moveTo(X, Y); else c.lineTo(X, Y); });
      c.closePath();
    };
    c.lineJoin = 'round';
    path(R);
    c.fillStyle = 'rgba(3,5,14,0.55)';
    c.fill();
    c.strokeStyle = HALO; c.lineWidth = Math.max(4, R * 0.34); c.stroke();
    if (fill > 0.02) { path(R * (0.25 + 0.75 * fill)); c.fillStyle = rgba(col, 0.9); c.fill(); path(R); }
    c.strokeStyle = rgba(col); c.lineWidth = Math.max(1.6, R * 0.14); c.stroke();
    // one facet line, so it reads as cut glass
    c.beginPath(); c.moveTo(x + (0.05 * ca + 1.05 * sa) * R, y + (0.05 * sa - 1.05 * ca) * R); c.lineTo(x + (0.2 * ca - 0.3 * sa) * R, y + (0.2 * sa + 0.3 * ca) * R);
    c.strokeStyle = rgba(col, 0.7); c.lineWidth = Math.max(1, R * 0.08); c.stroke();
    c.lineJoin = 'miter';
  }

  /**
   * The ambush, in plain shapes: the Lantern's four windows in a row at the top, and the Snuffer's cap coming down
   * on them as the next light note nears. Struck on the beat, the cap is thrown back and a window relights; struck
   * off it, a window goes dark.
   */
  private drawWindows(run: GdRun, beat: number): void {
    const c = this.ctx;
    const { lit } = run.windows;
    const next = run.lights.find((l) => l.on === null);
    const last = [...run.lights].reverse().find((l) => l.on !== null && l.beat <= beat);
    const since = last ? beat - last.beat : 99;
    c.save();
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const x0 = this.w / 2, y0 = Math.max(168, this.h * 0.2), sz = 15, gap = 9, n = 4, wRow = n * sz + (n - 1) * gap;
    for (let i = 0; i < n; i++) {
      const x = x0 - wRow / 2 + i * (sz + gap);
      const on = i < lit;
      c.fillStyle = on ? (since < 0.5 && last?.on ? '#ffffff' : '#f2e2b8') : 'rgba(13,14,23,0.9)';
      c.strokeStyle = on ? '#f2e2b8' : since < 0.5 && last && !last.on && i === lit ? '#ea4a30' : 'rgba(242,226,184,0.45)';
      c.lineWidth = 2;
      c.fillRect(x, y0, sz, sz); c.strokeRect(x, y0, sz, sz);
    }
    if (next) {
      // the cap: far off while the light note is far, on the windows as it arrives
      const d = clamp((next.beat - beat) / 12, 0, 1), y = y0 - 10 - d * 62;
      c.strokeStyle = 'rgba(242,226,184,0.35)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x0, y0 - 96); c.lineTo(x0, y - 16); c.stroke();
      c.fillStyle = '#b7a6ff'; c.beginPath(); c.moveTo(x0 - 13, y); c.lineTo(x0 + 13, y); c.lineTo(x0 + 5, y - 18); c.lineTo(x0 - 5, y - 18); c.closePath(); c.fill();
    }
    c.font = '700 11px ui-rounded, system-ui, sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(242,226,184,0.7)';
    c.fillText(since < 1.2 && last ? (last.on ? 'STRUCK' : 'OFF THE BEAT') : `WINDOWS ${lit}/4`, x0, y0 + sz + 16);
    c.restore();
  }

  /** A small upright label in the course (a gate's number, a lens's name). It stays readable when the picture is mirrored. */
  private tag(s: string, x: number, y: number, size: number, col: RGB, alpha: number): void {
    if (alpha <= 0.01) return;
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    c.scale(this.mxS, this.myS); // (a mirror gate turns the picture over in a third of a second, eased: never a cut)
    c.font = `800 ${Math.round(size)}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.lineWidth = 4;
    c.strokeStyle = `rgba(3,5,14,${alpha * 0.85})`;
    c.strokeText(s, 0, 0);
    c.fillStyle = rgba(col, alpha);
    c.fillText(s, 0, 0);
    c.restore();
  }

  /** How far a shard branch has left the safe line at a beat, 0..1: it rises from its first note and rejoins after its last. */
  private env(st: Star, b: number): number {
    return smooth((b - st.a) / 0.75) * smooth((st.b + 0.5 - b) / 0.5);
  }

  /**
   * Eko, in the form in force. Every form is the same white spark with its ring; what changes is what it wears:
   * the Meteor a pointed flame behind it, the Satellite two panels, the Pulsar two beams, the Comet a long tail.
   * `dir` is which way round the orbit it is travelling (1 or -1); `angle` points out from the core.
   */
  private drawHero(x: number, y: number, r: number, col: RGB, angle: number, dir: number, form: Form, along: number, across: number, lit: number): void {
    const c = this.ctx, now = performance.now();
    if (form !== this.morphTo) { this.morphFrom = this.morphTo; this.morphTo = form; this.morphAt = now; }
    const mk = smooth((now - this.morphAt) / 150);
    if (mk < 1 && this.morphFrom !== 'orb' && this.morphFrom !== form) { c.save(); c.globalAlpha *= 1 - mk; this.formDeco(x, y, r * (1 - 0.3 * mk), angle, dir, this.morphFrom, lit); c.restore(); }
    if (form !== 'orb') { c.save(); c.globalAlpha *= mk; this.formDeco(x, y, r * (0.6 + 0.4 * mk), angle, dir, form, lit); c.restore(); }
    this.heroDir = dir;
    { const t = this.ctx.getTransform(), k = this.canvas.width / Math.max(1, this.w); this.heroAt = [(t.a * x + t.c * y + t.e) / k, (t.b * x + t.d * y + t.f) / k]; }
    const tint = form === 'orb' ? col : mix(col, FORM_COL[form], 0.45 * mk);
    this.drawBall(x, y, r * (1 - 0.4 * this.miniK), tint, angle, along, across, true);
    if (this.look === 2) { const c2 = this.ctx; c2.save(); c2.strokeStyle = 'rgba(255,250,235,0.5)'; c2.lineWidth = Math.max(1, r * 0.16); c2.lineCap = 'round'; c2.beginPath(); c2.arc(x, y, r * (1.08 - 0.4 * this.miniK), -2.5, -1.0); c2.stroke(); c2.restore(); } // (his rim light, from the world's light above)
  }
  /** What a form adds round him: the Meteor's flame, the Satellite's panels, the Pulsar's beams. */
  private formDeco(x: number, y: number, r: number, angle: number, dir: number, form: Form, lit: number): void {
    const c = this.ctx;
    {
      const fc = FORM_COL[form];
      c.save();
      c.translate(x, y);
      c.rotate(angle);
      c.lineCap = 'round';
      if (form === 'meteor' || form === 'comet') {
        // behind it, along the way it came (the local y axis runs round the orbit)
        const len = r * (form === 'comet' ? 6.5 + lit * 2 : 4.6);
        const wid = r * (form === 'comet' ? 1.15 : 1.7);
        const g = c.createLinearGradient(0, 0, 0, -dir * len);
        g.addColorStop(0, rgba(mix(fc, WHITE, 0.25), 0.98));
        g.addColorStop(0.45, rgba(fc, 0.8));
        g.addColorStop(1, rgba(fc, 0));
        c.fillStyle = g;
        c.beginPath(); c.moveTo(-wid, 0); c.quadraticCurveTo(-wid * 0.5, -dir * len * 0.45, 0, -dir * len); c.quadraticCurveTo(wid * 0.5, -dir * len * 0.45, wid, 0); c.closePath(); c.fill();
      } else if (form === 'sat') {
        c.fillStyle = rgba(fc, 0.95);
        c.strokeStyle = HALO; c.lineWidth = 2;
        for (const k of [-1, 1]) { c.beginPath(); c.rect(-r * 0.8, k * r * 1.7 - (k < 0 ? r * 1.9 : 0), r * 1.6, r * 1.9); c.fill(); c.stroke(); c.beginPath(); c.moveTo(-r * 0.8, k * r * 2.65); c.lineTo(r * 0.8, k * r * 2.65); c.stroke(); }
        c.strokeStyle = rgba(fc); c.lineWidth = Math.max(1.5, r * 0.3);
        c.beginPath(); c.moveTo(0, -r * 1.7); c.lineTo(0, r * 1.7); c.stroke();
      } else {
        // the Pulsar: a beam out of each pole, across the ring it rides
        c.strokeStyle = HALO; c.lineWidth = Math.max(4, r * 1.05);
        c.beginPath(); c.moveTo(r * 1.3, 0); c.lineTo(r * 3.5, 0); c.moveTo(-r * 1.3, 0); c.lineTo(-r * 3.5, 0); c.stroke();
        c.strokeStyle = rgba(fc, 0.95); c.lineWidth = Math.max(2, r * 0.6);
        c.beginPath(); c.moveTo(r * 1.3, 0); c.lineTo(r * 3.5, 0); c.moveTo(-r * 1.3, 0); c.lineTo(-r * 3.5, 0); c.stroke();
        c.lineWidth = Math.max(1.2, r * 0.22);
        c.beginPath(); c.arc(0, 0, r * 1.95, 0, TWO_PI); c.stroke();
      }
      c.restore();
    }
  }

  /** A line of words near the core: a hint, the count back in after a pause. One quiet line with a dark breath under it; never a pill. */
  private text(s: string, x: number, y: number, size: number, col: RGB, alpha: number): void {
    if (alpha <= 0.01) return;
    const c = this.ctx;
    c.save();
    if (this.mx < 0) { c.scale(-1, 1); x = -x; } // past a mirror gate the picture is flipped; words never are
    if (this.my < 0) { c.scale(1, -1); y = -y; }
    const figure = /^\d+$/.test(s), px = Math.round(this.plain || figure ? size : size * 1.3);
    c.font = this.plain ? `600 ${px}px system-ui, sans-serif` : figure ? `500 ${px}px "Cormorant Lining", ${HAND}` : `italic 500 ${px}px ${HAND}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    // (white on the play field means only "tap here": words are cream)
    c.fillStyle = rgba(col === WHITE ? [255, 241, 216] : col, alpha);
    c.shadowColor = `rgba(10,6,24,${alpha})`;
    c.shadowBlur = px * 0.45;
    c.fillText(s, x, y + 1);
    c.fillText(s, x, y + 1); // twice: the shade under the words has to hold over a bright sky
    c.restore();
  }

  /** Adds the stretch of a ring between two beats to the current path, following the orbit through any turn. */
  private arcPath(c0: Course, r: number, b0: number, b1: number): void {
    const c = this.ctx;
    if (this.geo) { // (a place's own shape: followed point by point)
      const n = Math.max(2, Math.ceil(Math.abs(b1 - b0) * 20));
      for (let i = 0; i <= n; i++) { const [x, y] = this.loc(this.lk, -Math.PI / 2 + c0.angle(b0 + ((b1 - b0) * i) / n), r); if (i) c.lineTo(x, y); else c.moveTo(x, y); }
      return;
    }
    let from = b0;
    for (const t of c0.turns) {
      if (t <= from || t >= b1) continue;
      const a0 = -Math.PI / 2 + c0.angle(from);
      const a1 = -Math.PI / 2 + c0.angle(t);
      c.arc(0, 0, r, a0, a1, a1 < a0);
      from = t;
    }
    const a0 = -Math.PI / 2 + c0.angle(from);
    const a1 = -Math.PI / 2 + c0.angle(b1);
    c.arc(0, 0, r, a0, a1, a1 < a0);
  }

  /** plain: the twin ball's side of a ring whose mark is on the other ball: somewhere to ride, nothing to read. */
  private drawPlatform(pl: Platform, c0: Course, beat: number, pal: Palette, kick: number, drop: boolean, plain: boolean, time: number): void {
    const c = this.ctx;
    const start = Math.min(pl.cs, pl.fs);
    if (start - beat > this.ahead || beat > pl.fe + 0.5) return;
    const r = this.rad(pl.lv);
    if (r < this.r0 * 0.5 || r > Math.hypot(this.w, this.h) / 2 + 40) return; // inside the core's meter, or off the screen
    const alpha = clamp((this.ahead - (start - beat)) / 0.6, 0, 1) * clamp(1 - (beat - pl.fe - 0.1) / 0.4, 0, 1) * (plain ? 0.55 : 1);
    if (alpha <= 0.01) return;
    const lo = beat - 1;
    const hi = beat + this.ahead;
    const ang = (b: number) => -Math.PI / 2 + c0.angle(b);
    const arc = (b0: number, b1: number) => { c.beginPath(); this.arcPath(c0, r, Math.max(b0, lo), Math.min(b1, hi)); };
    const { rb } = this;
    const pulse = pl.pulse ? kick : 0;
    const lit = this.ringFlash;
    if (pl.chime) {
      // an orb: no ring at all, only the mark hanging where the hop before ends. White at its heart: it is a tap.
      // Gold with four ticks: a jump orb. Cyan with chevrons: a dash orb. Violet with an arrow each way: a gravity orb.
      if (plain || pl.note < lo || pl.note > hi) return;
      const a = ang(pl.note);
      const [x, y] = this.loc(this.lk, a, r + pl.side * rb);
      const tick = Math.exp(-(((beat % 1) + 1) % 1) * 5);
      const col = pl.orb === 'dash' ? CYAN : pl.orb === 'grav' ? VIOLET : GOLD;
      c.globalAlpha = alpha;
      if (this.look === 2) {
        // the one signal: an orb is a tap, so it is an unlit stone until it is one of the next two taps; then the gold
        // ring closes on it like on any node. Its four ticks say what it is: a mark in mid-air.
        // (the next tap is lit; the one after it only a faint outline, smaller: clearly second; 2026-11-26)
        const second = pl.note > this.cueFrom + 1e-6, cue = pl.note <= this.cueUntil + 1e-6 && pl.note >= this.cueFrom - 1e-6 && !second, ahead = pl.note - beat;
        c.fillStyle = HALO; c.beginPath(); c.arc(x, y, rb * 1.9, 0, TWO_PI); c.fill();
        c.strokeStyle = cue ? rgba(TAP, 0.9) : second && pl.note <= this.cueUntil + 1e-6 ? rgba(TAP, 0.4) : rgba(STONE, 0.9); c.lineWidth = Math.max(1.5, rb * 0.3); c.lineCap = 'round';
        for (let k = 0; k < 4; k++) { const q = a + Math.PI / 4 + (k * Math.PI) / 2; c.beginPath(); c.moveTo(x + Math.cos(q) * rb * 1.5, y + Math.sin(q) * rb * 1.5); c.lineTo(x + Math.cos(q) * rb * 2.05, y + Math.sin(q) * rb * 2.05); c.stroke(); }
        c.fillStyle = cue ? rgba(TAP) : rgba(STONE, 0.9); c.beginPath(); c.arc(x, y, rb * (cue ? 0.8 : 0.6), 0, TWO_PI); c.fill();
        if (cue) {
          const t2 = c.getTransform(), k2 = this.canvas.width / Math.max(1, this.w); this.cues.push({ x: (t2.a * x + t2.c * y + t2.e) / k2, y: (t2.b * x + t2.d * y + t2.f) / k2, beat: pl.note });
          if (ahead > -pl.tol && ahead < 2.4) { const far = Math.max(0, ahead), rr = rb * (1.3 + far * 3.2), wd = 3.2 - far * 0.5; c.globalAlpha = alpha * clamp(1.15 - far * 0.42, 0, 1); c.strokeStyle = HALO; c.lineWidth = wd + 3; c.beginPath(); c.arc(x, y, rr, 0, TWO_PI); c.stroke(); c.strokeStyle = rgba(TAP); c.lineWidth = wd; c.beginPath(); c.arc(x, y, rr, 0, TWO_PI); c.stroke(); }
        }
        c.lineCap = 'butt'; c.globalAlpha = 1;
        return;
      }
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.fillStyle = HALO; c.beginPath(); c.arc(x, y, rb * 2.1, 0, TWO_PI); c.fill();
      c.strokeStyle = rgba(col); c.lineWidth = Math.max(2, rb * 0.42);
      c.beginPath(); c.arc(x, y, rb * (1.55 + 0.15 * tick), 0, TWO_PI); c.stroke();
      if (pl.orb === 'dash') {
        // the way it carries you: along the orbit, onward
        const way = c0.angle(pl.note + 0.05) >= c0.angle(pl.note) ? 1 : -1;
        const tx = -Math.sin(a) * way, ty = Math.cos(a) * way, nx = Math.cos(a), ny = Math.sin(a);
        for (const k of [2.3, 3.2]) { c.beginPath(); c.moveTo(x + tx * rb * (k - 0.7) + nx * rb * 0.75, y + ty * rb * (k - 0.7) + ny * rb * 0.75); c.lineTo(x + tx * rb * k, y + ty * rb * k); c.lineTo(x + tx * rb * (k - 0.7) - nx * rb * 0.75, y + ty * rb * (k - 0.7) - ny * rb * 0.75); c.stroke(); }
      } else if (pl.orb === 'grav') {
        // gravity turns over here: an arrow toward the core and one away from it
        const nx = Math.cos(a), ny = Math.sin(a), tx = -ny, ty = nx;
        for (const k of [-1, 1]) { const bx = x + nx * rb * 2.1 * k, by = y + ny * rb * 2.1 * k, ex = x + nx * rb * 3.2 * k, ey = y + ny * rb * 3.2 * k; c.beginPath(); c.moveTo(bx, by); c.lineTo(ex, ey); c.moveTo(ex - nx * rb * 0.7 * k + tx * rb * 0.6, ey - ny * rb * 0.7 * k + ty * rb * 0.6); c.lineTo(ex, ey); c.lineTo(ex - nx * rb * 0.7 * k - tx * rb * 0.6, ey - ny * rb * 0.7 * k - ty * rb * 0.6); c.stroke(); }
      } else for (let k = 0; k < 4; k++) { const q = a + Math.PI / 4 + (k * Math.PI) / 2; c.beginPath(); c.moveTo(x + Math.cos(q) * rb * 1.9, y + Math.sin(q) * rb * 1.9); c.lineTo(x + Math.cos(q) * rb * 2.5, y + Math.sin(q) * rb * 2.5); c.stroke(); }
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x, y, rb * (pl.wide ? 1 : 0.85), 0, TWO_PI); c.fill();
      const ahead = pl.note - beat;
      if (ahead > 0 && ahead < 2) { c.strokeStyle = `rgba(255,255,255,${0.9 - ahead * 0.3})`; c.lineWidth = 2; c.beginPath(); c.arc(x, y, rb * (1.6 + ahead * 2.6), 0, TWO_PI); c.stroke(); }
      c.lineCap = 'butt'; c.lineJoin = 'miter';
      c.globalAlpha = 1;
      return;
    }
    // the whole ring, faintly: the lit stretch below is the part of it you can ride. After the drop the rings are
    // broken into turning shards, and every on-beat tap lights them up.
    // (kept very quiet, and still: only the lit stretch may draw the eye)
    c.globalAlpha = alpha * (0.07 + pulse * 0.04 + lit * 0.16);
    c.strokeStyle = this.look === 2 ? rgba(STONE) : this.col(pal.ring);
    c.lineWidth = 1.2 + lit;
    c.beginPath(); this.ringPath(r, ang(beat)); c.stroke();
    void time;
    c.globalAlpha = alpha;
    if (!plain) {
      if (!Number.isNaN(pl.spinAt)) {
        // spin gate: a turning ring between you and the next ring, with one gap. It comes round against the orbit
        // and its gap is over the mark exactly on the beat, so you can watch the two close on each other.
        const ahead = pl.spinAt - beat;
        if (ahead > -0.05 && ahead < 1.7) { // only the gate you are about to meet: one turning ring at a time, never a stack
          const rs = r - pl.enterSide * rb * 1.2;
          const g = ang(pl.spinAt) + (ang(pl.spinAt) - ang(beat)) * 0.75;
          const hw = Math.abs(ang(pl.spinAt + pl.spinTol) - ang(pl.spinAt)) + (rb * 1.5) / rs;
          c.globalAlpha = alpha * clamp((1.7 - ahead) / 0.45, 0, 1) * 0.9;
          c.lineCap = 'butt';
          c.beginPath(); c.arc(0, 0, rs, g + hw, g - hw + TWO_PI);
          c.strokeStyle = HALO; c.lineWidth = 7.5; c.stroke();
          c.strokeStyle = this.look === 2 ? rgba(WOKEN, 0.95) : rgba(DANGER); c.lineWidth = 3.6; c.stroke();
          c.strokeStyle = this.look === 2 ? 'rgba(20,26,62,0.9)' : '#ffffff'; c.lineWidth = 1.4; c.stroke();
          // the gap's two lips, so the opening itself is easy to follow
          c.fillStyle = this.look === 2 ? rgba(CYAN) : '#ffffff';
          for (const e of [g - hw, g + hw]) { c.beginPath(); c.arc(Math.cos(e) * rs, Math.sin(e) * rs, 3.4, 0, TWO_PI); c.fill(); }
          c.globalAlpha = alpha;
        }
      } else if (!pl.noCeil && pl.ce - pl.cs > 0.06 && pl.ce > lo && pl.cs < hi) {
        // ceiling: the ring above, closed until its opening. Hazard colours: touching it ends the run.
        arc(pl.cs, pl.ce);
        c.lineCap = 'butt';
        if (this.look === 2) {
          // the ring above, closed: a thin line in the quiet family. Nothing red stands beside the tap that is coming.
          c.strokeStyle = rgba(STONE, 0.55); c.lineWidth = 2.2; c.stroke();
        } else {
          c.strokeStyle = HALO; c.lineWidth = 10; c.stroke();
          c.strokeStyle = rgba(DANGER); c.lineWidth = 5; c.stroke();
          c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.stroke();
        }
      }
      // gravity flip: the ring above takes you on its underside
      if (!Number.isNaN(pl.flipAt)) {
        arc(pl.flipAt - pl.flipTol * 0.85, pl.fs);
        c.lineCap = 'round';
        c.strokeStyle = HALO;
        c.lineWidth = 13;
        c.stroke();
        c.strokeStyle = rgba(VIOLET);
        c.lineWidth = 5;
        c.stroke();
      }
    }
    // floor: the stretch you ride, ending just past the note you leave on (drawn a little short of the real edge)
    const fe = Number.isNaN(pl.note) ? pl.fe : pl.note + pl.tol * 0.85;
    if (fe > lo && pl.fs < hi) {
      c.lineCap = 'round';
      arc(pl.fs, fe);
      // a dark edge first, then the ring in its one fixed colour: the world behind never tints what you ride
      c.strokeStyle = HALO;
      c.lineWidth = (drop ? 11.5 : 10) + (pulse + lit) * 3;
      c.stroke();
      if (pulse > 0.05 || lit > 0.05) {
        c.strokeStyle = `rgba(255,255,255,${Math.min(0.5, pulse * 0.25 + lit * 0.3)})`;
        c.lineWidth = 8 + lit * 4;
        c.stroke();
      }
      // the gravity path: stone tiles. Ahead of him they sleep (blue-grey); behind him they are awake (warm gold).
      // (the tiles are fixed to the ring: the dash is counted from the ring's own start, not from the edge of the view)
      const tile = rb * 1.5, seam = Math.max(2, rb * 0.42), from = Math.max(pl.fs, lo), to = Math.min(fe, hi);
      c.lineCap = 'butt';
      c.setLineDash([tile, seam]);
      c.lineWidth = drop ? 6.4 : 5.8;
      const laid = (b: number) => r * Math.abs(c0.angle(b) - c0.angle(pl.fs));
      if (beat > from) { c.beginPath(); this.arcPath(c0, r, from, Math.min(beat, to)); c.lineDashOffset = laid(from); c.strokeStyle = rgba(WOKEN); c.stroke(); }
      if (beat < to) { const b0 = Math.max(beat, from); c.beginPath(); this.arcPath(c0, r, b0, to); c.lineDashOffset = laid(b0); c.strokeStyle = rgba(STONE); c.stroke(); }
      c.setLineDash([]); c.lineDashOffset = 0;
      c.lineCap = 'round';
      if (!plain && !Number.isNaN(pl.note) && pl.note > lo && pl.note < hi) {
        // the note: a bright mark across the ring. This is the moment to tap. Big hits get a bigger mark and a ring
        // that closes in on it as the ball arrives; the drop's smash is gold and bigger still.
        const a = ang(pl.note);
        const bigness = pl.smash ? 2.3 : pl.accent || pl.after ? 1.6 : pl.wide ? 1.3 : 1;
        const len = rb * (1.15 + pulse * 0.5) * bigness;
        const gold = pl.auto || pl.smash;
        const wide = (gold ? 7 : pl.accent || pl.after ? 6 : pl.wide ? 5.2 : 4.6) + pulse * 2.5;
        if (pl.form === 'meteor' || pl.form === 'pulsar') {
          // what the Hush left in the way, just past the mark: a wall across the ring (the Meteor dashes through it),
          // or a blot on this side of the ring (the Pulsar flips to the other side)
          const e = ang(pl.note + pl.tol + 0.06);
          const gone = beat > pl.note + pl.tol ? 0 : 1;
          c.globalAlpha = alpha * gone;
          if (pl.form === 'meteor') {
            c.lineCap = 'round';
            { const [x0, y0] = this.loc(this.lk, e, r - rb * 2.8), [x1, y1] = this.loc(this.lk, e, r + rb * 2.8); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); }
            if (this.look === 2) { c.strokeStyle = HALO; c.lineWidth = rb * 1.5; c.stroke(); c.strokeStyle = rgba(WOKEN, 0.92); c.lineWidth = rb * 1.05; c.stroke(); c.strokeStyle = 'rgba(20,26,62,0.96)'; c.lineWidth = rb * 0.62; c.stroke(); } // (soft blue: a wall is scenery until its node is the next tap)
            else { c.strokeStyle = rgba(INK_RIM); c.lineWidth = rb * 1.25; c.stroke(); c.strokeStyle = rgba(INK); c.lineWidth = rb * 0.85; c.stroke(); }
          } else {
            const [bx, by] = this.loc(this.lk, e, r + pl.side * rb * 1.5);
            // (the visual language, 2026-11-26: what is in the way is danger, so its rim is vermilion; no purple)
            if (this.look === 2) { c.fillStyle = rgba(DANGER, 0.9); c.beginPath(); c.arc(bx, by, rb * 1.18, 0, TWO_PI); c.fill(); c.fillStyle = 'rgba(16,10,22,0.96)'; c.beginPath(); c.arc(bx, by, rb * 0.92, 0, TWO_PI); c.fill(); }
            else { c.fillStyle = rgba(INK_RIM); c.beginPath(); c.arc(bx, by, rb * 1.55, 0, TWO_PI); c.fill(); c.fillStyle = rgba(INK); c.beginPath(); c.arc(bx, by, rb * 1.2, 0, TWO_PI); c.fill(); }
          }
          c.globalAlpha = alpha;
          c.lineCap = 'round';
        }
        if (pl.pad) {
          // a pad: a short thick plate on the ring, cyan for a spring pad, violet for a tide pad. The white mark across
          // it is drawn as on any ring: a pad is tapped.
          c.beginPath(); this.arcPath(c0, r, pl.note - 0.2, pl.note + 0.2);
          c.strokeStyle = HALO; c.lineWidth = 14; c.stroke();
          c.strokeStyle = rgba(pl.pad === 'spring' ? CYAN : pl.pad === 'jump' || pl.pad === 'vent' ? this.padCol : VIOLET); c.lineWidth = pl.pad === 'jump' ? 11 : 9; c.stroke(); // (a jump pad: the woken teal of the world's own life)
        }
        const ahead = pl.note - beat;
        const [nx, ny] = this.loc(this.lk, a, r), nr = rb * 1.5 * (pl.smash ? 1.7 : pl.accent || pl.after ? 1.3 : pl.wide ? 1.15 : 1) * (1 + pulse * 0.2);
        if (pl.act === 'up') {
          // the Comet's second mark: a white ring. Let go here.
          c.strokeStyle = HALO; c.lineWidth = wide + 5;
          c.beginPath(); c.arc(nx, ny, rb * 1.25, 0, TWO_PI); c.stroke();
          c.strokeStyle = this.look === 2 ? rgba(HOLD) : gold ? rgba(GOLD) : '#ffffff'; c.lineWidth = wide * 0.8;
          c.beginPath(); c.arc(nx, ny, rb * 1.25, 0, TWO_PI); c.stroke();
        } else if (this.look === 2 && (pl.auto || pl.note > this.cueUntil + 1e-6 || pl.note < this.cueFrom - 1e-6)) {
          // a node that is not yet one of the next two taps (or one the game takes itself): a small unlit stone
          c.fillStyle = HALO; c.beginPath(); c.arc(nx, ny, rb * 0.95, 0, TWO_PI); c.fill();
          c.fillStyle = rgba(STONE, 0.9); c.beginPath(); c.arc(nx, ny, rb * 0.62, 0, TWO_PI); c.fill();
        } else if (this.look === 2 && pl.note > this.cueFrom + 1e-6) {
          // the tap after next: a stone with a faint gold outline, smaller than the lit one (clearly second)
          { const t = c.getTransform(), k = this.canvas.width / Math.max(1, this.w); this.cues.push({ x: (t.a * nx + t.c * ny + t.e) / k, y: (t.b * nx + t.d * ny + t.f) / k, beat: pl.note }); }
          c.fillStyle = HALO; c.beginPath(); c.arc(nx, ny, rb * 1.05, 0, TWO_PI); c.fill();
          c.fillStyle = rgba(STONE, 0.9); c.beginPath(); c.arc(nx, ny, rb * 0.62, 0, TWO_PI); c.fill();
          c.strokeStyle = rgba(TAP, 0.42); c.lineWidth = 1.6; c.beginPath(); c.arc(nx, ny, rb * 1.05, 0, TWO_PI); c.stroke();
        } else {
          // a Star-Node, set in the path: a dark stone with a star cut into it. In the second look the star is in the
          // tap colour; before it, white (gold where the game takes it for you, and on the drop's great node).
          const col = this.look === 2 ? rgba(TAP) : gold ? rgba(GOLD) : '#ffffff';
          if (this.look === 2) { const t = c.getTransform(), k = this.canvas.width / Math.max(1, this.w); this.cues.push({ x: (t.a * nx + t.c * ny + t.e) / k, y: (t.b * nx + t.d * ny + t.f) / k, beat: pl.note }); }
          c.fillStyle = HALO; c.beginPath(); c.arc(nx, ny, nr + 2.4, 0, TWO_PI); c.fill();
          c.fillStyle = 'rgba(16,18,40,0.96)'; c.beginPath(); c.arc(nx, ny, nr, 0, TWO_PI); c.fill();
          c.strokeStyle = col; c.globalAlpha = alpha * 0.85; c.lineWidth = Math.max(1.2, nr * 0.14);
          c.beginPath(); c.arc(nx, ny, nr, 0, TWO_PI); c.stroke(); c.globalAlpha = alpha;
          c.fillStyle = col;
          c.beginPath();
          for (let i = 0; i < 10; i++) { const q = a + (i * Math.PI) / 5, rr = nr * (i % 2 ? 0.34 : 0.78); if (i) c.lineTo(nx + Math.cos(q) * rr, ny + Math.sin(q) * rr); else c.moveTo(nx + Math.cos(q) * rr, ny + Math.sin(q) * rr); }
          c.closePath(); c.fill();
        }
        // the cue: a ring closes on the node and touches its edge exactly on the beat (Orbin arrives at the same
        // instant: two cues that agree). Only the nodes about to be met carry one, so the rings never pile up.
        if (this.look === 2) {
          if (!pl.auto && pl.act !== 'up' && pl.note <= this.cueFrom + 1e-6 && pl.note >= this.cueFrom - 1e-6 && ahead > -pl.tol && ahead < 2.4) {
            const far = Math.max(0, ahead), rr = nr + 1.5 + far * rb * (pl.smash ? 4.2 : 3.2), wd = (pl.smash ? 4 : 3.2) - far * 0.5;
            c.globalAlpha = alpha * clamp(1.15 - far * 0.42, 0, 1);
            c.strokeStyle = HALO; c.lineWidth = wd + 3; c.beginPath(); c.arc(nx, ny, rr, 0, TWO_PI); c.stroke(); // (a dark edge under it: it reads on any sky)
            c.strokeStyle = rgba(TAP); c.lineWidth = wd; c.beginPath(); c.arc(nx, ny, rr, 0, TWO_PI); c.stroke();
            c.globalAlpha = alpha;
          }
        } else if (!pl.auto && ahead > -pl.tol && ahead < 1.6) {
          const far = Math.max(0, ahead);
          c.strokeStyle = rgba(pl.after ? CYAN : [255, 208, 120], clamp(1.1 - far * 0.55, 0, 1));
          c.lineWidth = (pl.smash ? 3.2 : 2.3) - far * 0.6;
          c.beginPath(); c.arc(nx, ny, nr + 1.5 + far * rb * (pl.smash ? 4.2 : 3), 0, TWO_PI); c.stroke();
        }
        if (pl.sling) {
          // slingshot: arrows pointing the way it throws you
          // (they pulse on every beat while you ride up to them)
          const tick = Math.exp(-(((beat % 1) + 1) % 1) * 5);
          c.strokeStyle = rgba(CYAN);
          c.lineWidth = 3 + tick * 2;
          for (let j = 0; j < 3; j++) {
            const rr = r + pl.side * rb * (3 + j * 1.7 + tick * 0.8);
            const tip = rr + pl.side * rb * 1.1;
            c.globalAlpha = alpha * (1 - j * 0.25);
            c.beginPath();
            c.moveTo(...this.loc(this.lk, a - (rb * 1.1) / r, rr));
            c.lineTo(...this.loc(this.lk, a, tip));
            c.lineTo(...this.loc(this.lk, a + (rb * 1.1) / r, rr));
            c.stroke();
          }
          c.globalAlpha = alpha;
        }
        if (!pl.auto && this.look !== 2) {
          // and the edge: ride past it and the run ends
          const e = ang(fe);
          c.fillStyle = rgba(DANGER);
          c.beginPath(); c.arc(...this.loc(this.lk, e, r), 3.2, 0, TWO_PI); c.fill();
        }
      }
      c.lineCap = 'butt';
    }
    c.globalAlpha = 1;
  }

  /** Everything one ball reads and the ball itself. The twin's side is the same picture, mirrored left to right. */
  private drawSide(run: GdRun, twin: boolean, beat: number, pal: Palette, kick: number, dropStyle: boolean, time: number, skin: RGB, dt: number): void {
    const c = this.ctx;
    const course = run.course;
    const sim = run.sim;
    const { r0, rb } = this;
    const ang = (b: number) => -Math.PI / 2 + course.angle(b);
    // each ring is drawn round its own planet; `at` moves the origin there and back
    const [hx, hy] = this.planetXY(this.pf);
    const origin = (pf: number): [number, number] => { const [x, y] = this.planetXY(pf); return [x - this.camX, y - this.camY]; };
    // the star trail in view: still whole, and close enough to see
    const trail = run.finale ? undefined : course.stars.find((st) => sim.stars[st.i] === 0 && st.a - beat <= this.ahead && beat <= st.b + 0.15);
    // the world's own pieces on the course, drawn first, under it: nothing ever covers the course or the path ahead
    if (this.planet?.underCourse && !twin) {
      const hit = run.events.some((e) => (e.kind === 'hop' || e.kind === 'flip') && e.flow !== false);
      const pos = (b: number, dl = 0, ref?: number): [number, number] => { const h = course.at(ref ?? b), r = this.rad(h.rho + dl) + h.side * rb; return this.wxy(course.at(b).planet, ang(b), r); };
      c.save();
      this.planet.underCourse(c, { beat, song: beat * course.spb, time, spb: course.spb, rb, presses: course.presses, holds: course.holds, pos, place: (k: number) => origin(k), unit: this.rad(this.cam), pf: this.pf, ring: (b) => this.rad(course.at(b).rho), ang, center: [hx - this.camX, hy - this.camY], planetR: this.worldR, hit });
      c.restore();
    }
    // Holds: gold rails through long hops and gold lines above the ring. They are drawn first, under the rings and
    // their marks, and kept slim: a hold is a path to follow, and it must never hide a white mark or look like one.
    // What is left of each is drawn from the ball onward; it brightens while you are holding on it; a gold ring marks
    // where to let go (white is only ever "tap here").
    for (const h of course.holds) {
      if (h.a - beat > this.ahead) break;
      if (h.b < beat - 0.05 || (twin && !h.twin)) continue;
      const at = (t: number): [number, number] => {
        const u = clamp((t - h.a) / (h.b - h.a), 0, 1) * (h.path.length - 1);
        const k = Math.min(h.path.length - 2, Math.floor(u));
        const p0 = h.path[k];
        const p1 = h.path[k + 1];
        const f = u - k;
        const r = this.rad(lerp(p0.rho, p1.rho, f)) + lerp(p0.side, p1.side, f) * rb;
        return this.wxy(lerp(p0.planet, p1.planet, f), ang(t), r);
      };
      // a rail starts a little way past its white mark, so the mark stands clear of it
      const from = Math.max(h.a + (h.rail ? 0.22 : 0), beat);
      const to = Math.min(h.b, beat + this.ahead);
      const on = sim.down && beat >= h.a - 0.1;
      const show = clamp((this.ahead - (h.a - beat)) / 0.6, 0, 1);
      const body: RGB = h.tether ? DANGER : this.look === 2 ? HOLD : GOLD; // a tether is in the colour of everything that ends the run
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.globalAlpha = show;
      if (to - from >= 0.02) {
        const n = Math.max(2, Math.ceil((to - from) * 10));
        c.beginPath();
        for (let k = 0; k <= n; k++) { const [x, y] = at(from + ((to - from) * k) / n); if (k === 0) c.moveTo(x, y); else c.lineTo(x, y); }
        c.strokeStyle = 'rgba(3,5,14,0.8)'; c.lineWidth = rb * 1.9; c.stroke();
        c.strokeStyle = rgba(body, on ? 0.55 : h.tether ? 0.36 : 0.28); c.lineWidth = rb * (on ? 1.3 + 0.25 * kick : 1.1); c.stroke();
        c.strokeStyle = rgba(on ? mix(body, WHITE, 0.55) : body, 0.97); c.lineWidth = Math.max(2, rb * (on ? 0.5 : 0.42)); c.stroke();
      }
      // gold along it
      for (const tk of h.ticks) {
        if (this.look === 2 || tk < beat - 0.02 || tk > beat + this.ahead || sim.tickGone(tk) || Math.abs(tk - h.b) < 1e-6) continue;
        const [x, y] = at(tk);
        c.fillStyle = 'rgba(3,5,14,0.5)'; c.beginPath(); c.arc(x, y, rb * 0.6, 0, TWO_PI); c.fill();
        c.fillStyle = rgba(GOLD); c.beginPath(); c.arc(x, y, rb * 0.38, 0, TWO_PI); c.fill();
      }
      // the end: let go here. A ring in the hold's own colour, closing in as the ball arrives.
      if (h.b <= beat + this.ahead && h.b >= beat - 0.05) {
        const [x, y] = at(h.b);
        const near = on ? clamp(1 - (h.b - beat) / 1, 0, 1) : 0;
        c.strokeStyle = 'rgba(3,5,14,0.5)'; c.lineWidth = Math.max(4, rb * 0.75);
        c.beginPath(); c.arc(x, y, rb * 0.95, 0, TWO_PI); c.stroke();
        c.strokeStyle = rgba(body); c.lineWidth = Math.max(2, rb * 0.36);
        c.beginPath(); c.arc(x, y, rb * 0.95, 0, TWO_PI); c.stroke();
        if (near > 0.01) { c.strokeStyle = rgba(body, 0.75 * near); c.lineWidth = 2; c.beginPath(); c.arc(x, y, rb * (0.95 + 1.6 * (1 - near)), 0, TWO_PI); c.stroke(); }
      }
      c.globalAlpha = 1;
      c.lineCap = 'butt';
    }
    { // which nodes are lit: the next two taps the player must make
      let n = 0; this.cueUntil = Infinity; this.cueFrom = -Infinity; if (!twin) this.cues = [];
      if (this.look === 2) for (let k = sim.ni; k < course.presses.length; k++) { const p = course.presses[k]; if (p.auto) continue; if (++n === 1) this.cueFrom = p.beat; else { this.cueUntil = p.beat; break; } }
    }
    for (const pl of this.plats) {
      if (twin ? pl.twin === null : false) continue;
      if (Math.min(pl.cs, pl.fs) - beat > this.ahead || beat > pl.fe + 0.5) continue;
      const mine = twin ? pl.twin === 'b' || pl.twin === 'both' : pl.twin !== 'b';
      const [ox, oy] = origin(pl.planet);
      c.translate(ox, oy);
      this.lk = pl.planet;
      this.drawPlatform(pl, course, beat, pal, kick, dropStyle, !mine, time);
      c.translate(-ox, -oy);
    }
    const [bx0, by0] = [hx - this.camX, hy - this.camY]; // the ball's own planet
    if (trail && !twin) {
      // the shard branch: a dotted gold path that leaves the safe line at its first note and rejoins it after the shard
      const b0 = Math.max(trail.a, beat);
      const b1 = Math.min(trail.b + 0.5, beat + this.ahead);
      c.fillStyle = rgba(STAR, this.look === 2 ? 0.5 : 0.9);
      for (let b = Math.ceil(b0 * 8) / 8; b <= b1; b += this.look === 2 ? 0.25 : 0.125) {
        const wpt = course.at(b);
        // (second look: the stretch that counts for a star is a quiet dotted line well outside the path, never on it)
        const r = this.rad(wpt.rho) + wpt.side * (this.look === 2 ? rb * 3.4 : rb + this.gap * LIFT * this.env(trail, b));
        c.globalAlpha = clamp((this.ahead - (b - beat)) / 0.6, 0, 1);
        c.beginPath(); c.arc(...this.wxy(wpt.planet, ang(b), r), rb * 0.2, 0, TWO_PI); c.fill();
      }
      c.globalAlpha = 1;
    }
    // the Comet's climb: from its bar to its ring the button stays down. A rail in the Comet's colour shows the stretch.
    for (let k = Math.max(0, sim.ni - 1); k < course.presses.length && !twin; k++) {
      const p = course.presses[k];
      if (p.beat - beat > this.ahead) break;
      const up = course.presses[k + 1];
      if (p.act !== 'down' || !up || up.act !== 'up') continue;
      const b0 = Math.max(p.land, beat);
      const b1 = Math.min(up.beat, beat + this.ahead);
      if (b1 - b0 < 0.04) continue;
      const [ox, oy] = origin(p.planetTo);
      const on = sim.down && beat >= p.beat - 0.1;
      c.translate(ox, oy);
      this.lk = p.planetTo;
      c.globalAlpha = clamp((this.ahead - (p.beat - beat)) / 0.6, 0, 1);
      c.lineCap = 'round';
      c.beginPath(); this.arcPath(course, this.rad(p.to) - p.side * rb, b0, b1);
      c.strokeStyle = 'rgba(3,5,14,0.8)'; c.lineWidth = rb * 1.9; c.stroke();
      c.strokeStyle = rgba(FORM_COL.comet, on ? 0.6 : 0.32); c.lineWidth = rb * (on ? 1.3 : 1.1); c.stroke();
      c.strokeStyle = rgba(on ? mix(FORM_COL.comet, WHITE, 0.5) : FORM_COL.comet, 0.97); c.lineWidth = Math.max(2, rb * 0.42); c.stroke();
      c.lineCap = 'butt';
      c.globalAlpha = 1;
      c.translate(-ox, -oy);
    }
    if (!twin) {
      // where the next hops go: a faint dotted path from each note to its landing
      for (let k = sim.ni; k < Math.min(course.presses.length, sim.ni + 3); k++) {
        const p = course.presses[k];
        if (p.beat - beat > this.ahead - 0.4) break;
        if (course.holds.some((h) => h.rail && h.a === p.beat)) continue; // a rail shows the way itself
        if (p.slip) {
          // a slipstream: cyan chevrons along the way it carries you
          const pt = (u: number): [number, number] => { const b = p.beat + (p.land - p.beat) * u; const r = this.rad(flightRho(p, b)) + (p.kind === 'flip' ? p.side * rb * (1 - 2 * u) : p.side * rb); return this.wxy(p.planet, ang(b), r); };
          c.strokeStyle = rgba(CYAN, 0.9);
          c.lineWidth = 2.6;
          c.lineCap = 'round';
          c.lineJoin = 'round';
          for (let i = 1; i <= 5; i++) {
            const [x0, y0] = pt(i / 6 - 0.03);
            const [x1, y1] = pt(i / 6 + 0.03);
            const d = Math.hypot(x1 - x0, y1 - y0) || 1;
            const ux = (x1 - x0) / d;
            const uy = (y1 - y0) / d;
            c.beginPath(); c.moveTo(x1 - ux * rb - uy * rb * 0.8, y1 - uy * rb + ux * rb * 0.8); c.lineTo(x1, y1); c.lineTo(x1 - ux * rb + uy * rb * 0.8, y1 - uy * rb - ux * rb * 0.8); c.stroke();
          }
          c.lineCap = 'butt';
          c.lineJoin = 'miter';
          continue;
        }
        const n = Math.max(3, Math.round((p.land - p.beat) * (p.sling || p.leap ? 14 : 8)));
        c.fillStyle = p.sling ? rgba(CYAN, 0.8) : this.look === 2 ? rgba(STONE, k === sim.ni ? 0.7 : 0.35) : rgba(WHITE, k === sim.ni ? 0.8 : 0.4);
        for (let i = 1; i < n; i++) {
          const b = p.beat + ((p.land - p.beat) * i) / n;
          const r = this.rad(flightRho(p, b)) + (p.kind === 'flip' ? p.side * rb * (1 - (2 * i) / n) : p.side * rb);
          const pf = p.leap ? leapAt(p.leap, b) : p.sling ? p.planet + smoothstep(i / n) : p.planet; // a planet hop's path crosses to the next planet
          c.beginPath(); c.arc(...this.wxy(pf, ang(b), r), p.sling || p.leap ? 2.4 : 2, 0, TWO_PI); c.fill();
        }
      }
      // planet hops: from a couple of beats before the launch until it lands, a cyan target marks the landing spot
      for (let k = Math.max(0, sim.ni - 3); k < Math.min(course.presses.length, sim.ni + 2); k++) {
        const p = course.presses[k];
        const lp = p.leap && !p.leap.ember ? p.leap : null; // (a leap's landing is shown from before its launch to its end)
        if (!(p.sling || lp) || beat < p.beat - 2.5 || beat > (lp ? lp.b1 : p.land)) continue;
        const r = this.rad(p.to) + p.side * rb;
        const [x, y] = lp ? this.wxy(lp.p0 + 1, ang(lp.b1), r) : this.wxy(p.planetTo, ang(p.land), r);
        const tick = Math.exp(-(((beat % 1) + 1) % 1) * 5);
        c.globalAlpha = clamp((beat - (p.beat - 2.5)) / 0.5, 0, 1);
        c.strokeStyle = HALO;
        c.lineWidth = 7;
        c.beginPath(); c.arc(x, y, rb * (2 + tick * 0.5), 0, TWO_PI); c.stroke();
        c.strokeStyle = rgba(CYAN);
        c.lineWidth = 2.5;
        c.beginPath(); c.arc(x, y, rb * (2 + tick * 0.5), 0, TWO_PI); c.stroke();
        c.beginPath(); c.arc(x, y, rb * 0.5, 0, TWO_PI); c.stroke();
        c.globalAlpha = 1;
      }
      // speed portals and turns: cyan signs across the ball's path
      const rr = this.rad(this.cam);
      for (const sp of course.portals) {
        const d = sp.beat - beat;
        if (d > this.ahead || d < -0.4) continue;
        c.save();
        { const [px, py] = this.wxy(this.pf, ang(sp.beat), rr); c.translate(px, py); c.rotate(this.upA(this.pf, ang(sp.beat)) + Math.PI / 2); c.translate(0, rr); } // (to the ring under the sign, turned as the path turns there)
        c.globalAlpha = clamp((this.ahead - d) / 0.6, 0, 1) * clamp(1 + d / 0.4, 0, 1);
        c.strokeStyle = rgba(CYAN);
        c.lineWidth = 3 + (d < 2.05 && d > 0 ? Math.exp(-(((beat % 1) + 1) % 1) * 5) * 3 : 0); // in its last two beats the sign beats with the music
        c.lineCap = 'round';
        const way = (course.angle(sp.beat + 0.1) > course.angle(sp.beat) ? 1 : -1) * (sp.faster ? 1 : -1);
        for (let i = -1; i <= 1; i++) {
          const x = i * rb * 1.3;
          c.beginPath(); c.moveTo(x - rb * 0.6 * way, -rr - rb * 2.4); c.lineTo(x + rb * 0.6 * way, -rr); c.lineTo(x - rb * 0.6 * way, -rr + rb * 2.4); c.stroke();
        }
        c.restore();
        // a tempo gate says how fast: 0.5x ... 2x
        const ga = ang(sp.beat);
        this.tag(`${sp.speed}\u00d7`, ...this.wxy(this.pf, ga, rr + rb * 5.2), clamp(rb * 1.9, 11, 18), CYAN, clamp((this.ahead - d) / 0.6, 0, 1) * clamp(1 + d / 0.4, 0, 1));
      }
      // embers: a small dark coal lying on the ring at a section line; it catches as he passes (a ring of warm light, then a
      // small steady flame), and the lit ones stay lit behind him. Deep orange, never the gold of the tap signal.
      for (const eb of this.embers) {
        const d = eb - beat;
        if (d > this.ahead || d < -8) continue;
        const ea = ang(eb), here = course.at(eb), er = this.rad(here.rho) - here.side * rb * 0.9;
        const [ex, ey] = this.wxy(here.planet, ea, er);
        const al = clamp((this.ahead - d) / 0.6, 0, 1);
        c.globalAlpha = al;
        if (d > 0) {
          // unlit: a coal, a dull core
          c.fillStyle = 'rgba(34,20,18,0.95)'; c.beginPath(); c.ellipse(ex, ey, rb * 0.62, rb * 0.42, ea, 0, TWO_PI); c.fill();
          c.fillStyle = 'rgba(150,52,30,0.55)'; c.beginPath(); c.arc(ex, ey, rb * 0.18, 0, TWO_PI); c.fill();
        } else {
          const age = -d * course.spb, burst = clamp(age / 0.5, 0, 1), flick = 0.85 + 0.15 * Math.sin(time * 11 + eb) * Math.sin(time * 4.3);
          if (burst < 1) { c.strokeStyle = `rgba(255,150,80,${0.7 * (1 - burst)})`; c.lineWidth = 2.5; c.beginPath(); c.arc(ex, ey, rb * (0.8 + 3.2 * burst), 0, TWO_PI); c.stroke(); }
          const g = c.createRadialGradient(ex, ey, 0, ex, ey, rb * 1.8);
          g.addColorStop(0, `rgba(255,190,120,${0.85 * flick})`); g.addColorStop(0.35, `rgba(240,110,50,${0.5 * flick})`); g.addColorStop(1, 'rgba(240,90,40,0)');
          c.fillStyle = g; c.beginPath(); c.arc(ex, ey, rb * 1.8, 0, TWO_PI); c.fill();
          c.fillStyle = 'rgba(60,30,22,0.9)'; c.beginPath(); c.ellipse(ex, ey + rb * 0.1, rb * 0.58, rb * 0.36, ea, 0, TWO_PI); c.fill();
          c.fillStyle = `rgba(255,214,150,${flick})`; c.beginPath(); c.arc(ex, ey, rb * 0.22, 0, TWO_PI); c.fill();
        }
        c.globalAlpha = 1;
      }
      // the world's own set pieces on the course (Helion's light, the Sleeper's hand, the residue, Ossa's fire, the seal)
      if (this.planet?.onCourse && !twin) {
        const hit = run.events.some((e) => (e.kind === 'hop' || e.kind === 'flip') && e.flow !== false);
        const pos = (b: number, dl = 0, ref?: number): [number, number] => { const h = course.at(ref ?? b), r = this.rad(h.rho + dl) + h.side * rb; return this.wxy(course.at(b).planet, ang(b), r); };
        c.save();
        this.planet.onCourse(c, { beat, song: beat * course.spb, time, spb: course.spb, rb, presses: course.presses, holds: course.holds, pos, place: (k: number) => origin(k), unit: this.rad(this.cam), pf: this.pf, ring: (b) => this.rad(course.at(b).rho), ang, center: [bx0, by0], planetR: this.worldR, hit });
        c.restore();
      }
      // lenses: a tall lens standing across the path, in the colour of the form it gives
      for (const ln of course.lenses) {
        const d = ln.beat - beat;
        if (d > this.ahead || d < -0.4) continue;
        const al = clamp((this.ahead - d) / 0.6, 0, 1) * clamp(1 + d / 0.4, 0, 1);
        const col = this.look === 2 ? WOKEN : FORM_COL[ln.form];
        if (this.look === 2) {
          // the companion IS the mode portal: a Kindling hovering over the path, its wings opening across it as he
          // comes, and closing round him as he passes (he takes its shape)
          const la = ang(ln.beat), [px, py] = this.wxy(course.at(ln.beat).planet, la, rr);
          const open = clamp(1 - d / 1.5, 0, 1), passK = clamp(-d / 0.4, 0, 1);
          COMPANIONS.kindling(c, px, py, rb * (0.11 + 0.05 * open), COMPANIONS.KINDLE[run.level.file.side?.of ?? run.level.id] ?? COMPANIONS.KINDLE.heroes, { flap: 0.5 + 0.5 * Math.sin(time * 3), open: open * (1 - passK), alpha: al * (1 - passK), rot: la + Math.PI / 2 });
          continue;
        }
        const H = rb * 4.2;
        const W = rb * 1.7;
        c.save();
        c.translate(bx0, by0);
        c.rotate(ang(ln.beat) + Math.PI / 2);
        c.translate(0, -rr);
        c.globalAlpha = al;
        c.beginPath(); c.moveTo(0, -H); c.quadraticCurveTo(W, 0, 0, H); c.quadraticCurveTo(-W, 0, 0, -H); c.closePath();
        c.strokeStyle = HALO; c.lineWidth = 8; c.stroke();
        c.fillStyle = rgba(col, 0.22); c.fill();
        c.strokeStyle = rgba(col); c.lineWidth = 3; c.stroke();
        c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(-W * 0.18, -H * 0.55); c.quadraticCurveTo(-W * 0.42, -H * 0.1, -W * 0.2, H * 0.3); c.stroke();
        c.restore();
        const la = ang(ln.beat);
        this.tag(FORM_NAME[ln.form], ...this.wxy(course.at(ln.beat).planet, la, rr + rb * 6.4), clamp(rb * 1.5, 13, 16), col, al); // (a form is named once, where it is given; after that its shape speaks)
      }
      // mirror and upside-down gates: a cyan line across the path, with an arrow each way along the orbit (mirror) or
      // toward and away from the core (upside-down), and its name. In its last two beats the sign beats with the music.
      for (const [list, flipV] of [[course.mirrors, false], [course.inverts, true]] as Array<[number[], boolean]>) for (const mb of list) {
        const d = mb - beat;
        if (d > this.ahead || d < -0.4) continue;
        const al = clamp((this.ahead - d) / 0.6, 0, 1) * clamp(1 + d / 0.4, 0, 1);
        const beatK = d < 2.05 && d > 0 ? Math.exp(-(((beat % 1) + 1) % 1) * 5) : 0;
        c.save();
        c.translate(bx0, by0);
        c.rotate(ang(mb) + Math.PI / 2);
        c.globalAlpha = al;
        c.lineCap = 'round';
        c.setLineDash([rb * 0.8, rb * 0.9]);
        c.beginPath(); c.moveTo(0, -rr - rb * 3.2); c.lineTo(0, -rr + rb * 3.2);
        c.strokeStyle = HALO; c.lineWidth = 7 + beatK * 4; c.stroke();
        c.strokeStyle = rgba(CYAN); c.lineWidth = 3 + beatK * 3; c.stroke();
        c.setLineDash([]);
        c.fillStyle = rgba(CYAN);
        if (flipV) for (const k of [-1, 1]) { for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * rb * 1.7, -rr + k * rb * 4.6); c.lineTo(sx * rb * 1.7 - rb * 1.1, -rr + k * rb * 3.2); c.lineTo(sx * rb * 1.7 + rb * 1.1, -rr + k * rb * 3.2); c.closePath(); c.fill(); } }
        else for (const k of [-1, 1]) { c.beginPath(); c.moveTo(k * rb * 2.6, -rr); c.lineTo(k * rb * 1.2, -rr - rb * 1.1); c.lineTo(k * rb * 1.2, -rr + rb * 1.1); c.closePath(); c.fill(); }
        c.restore();
        const ma = ang(mb);
        if (this.look !== 2) this.tag(flipV ? 'UPSIDE-DOWN' : 'MIRROR', bx0 + Math.cos(ma) * (rr + rb * 6.6), by0 + Math.sin(ma) * (rr + rb * 6.6), clamp(rb * 1.5, 10, 15), CYAN, al);
      }
      for (const tb of course.turns) {
        const d = tb - beat;
        if (d > this.ahead || d < -0.4) continue;
        const a = ang(tb);
        c.globalAlpha = clamp((this.ahead - d) / 0.6, 0, 1) * clamp(1 + d / 0.4, 0, 1);
        c.lineCap = 'round';
        // a wall across the path with a U-turn arrow in front of it
        const tpf = course.at(tb).planet, [tox, toy] = origin(tpf);
        c.translate(tox, toy); this.lk = tpf;
        c.beginPath(); c.moveTo(...this.loc(tpf, a, rr - rb * 3)); c.lineTo(...this.loc(tpf, a, rr + rb * 3));
        c.strokeStyle = HALO; c.lineWidth = 8; c.stroke();
        c.strokeStyle = rgba(CYAN); c.lineWidth = 3.5 + (d < 2.05 && d > 0 ? Math.exp(-(((beat % 1) + 1) % 1) * 5) * 3.5 : 0); c.stroke();
        const back = course.angle(tb - 0.1) < course.angle(tb) ? -1 : 1;
        const ac = a + (back * rb * 2.6) / rr;
        c.lineWidth = 2.5;
        { const ua = this.upA(tpf, ac); c.beginPath(); c.arc(...this.loc(tpf, ac, rr), rb * 1.3, ua + Math.PI / 2 * back, ua + Math.PI / 2 * back + Math.PI * 1.2 * back, back < 0); c.stroke(); }
        c.translate(-tox, -toy);
        c.globalAlpha = 1;
      }
      c.lineCap = 'butt';
      c.globalAlpha = 1;
    }
    // flow notes: optional taps, on the ring or in mid-flight. Gold, and smaller than the white marks you must hit.
    let lastNote: [number, number, number] | null = null; // gold notes a beat apart or less are joined: the phrase is a constellation
    for (const f of course.flow) {
      const d = f.beat - beat;
      if (d > this.ahead) break;
      if (d < -0.25 || sim.noteUsed(f.beat)) continue;
      if (this.look === 2) break; // (the second look has no optional targets on the course: flow is earned by tapping the nodes on the beat)
      if (twin ? !(f.twin === 'b' || f.twin === 'both') : f.twin === 'b') continue;
      // on a shard branch that is still whole, the note sits out on the branch's path
      const out = f.branch >= 0 && sim.stars[f.branch] === 0 && !run.finale ? this.gap * LIFT * this.env(course.stars[f.branch], f.beat) : 0;
      const r = this.rad(f.rho) + f.side * (rb + out);
      const [ox, oy] = origin(f.planet);
      const x = ox + Math.cos(ang(f.beat)) * r;
      const y = oy + Math.sin(ang(f.beat)) * r;
      c.globalAlpha = clamp((this.ahead - d) / 0.6, 0, 1) * clamp(1 + d / 0.25, 0, 1);
      if (lastNote && f.beat - lastNote[2] <= 1.01 && d > 0) { c.strokeStyle = rgba(GOLD, 0.55); c.lineWidth = 1.3; c.beginPath(); c.moveTo(lastNote[0], lastNote[1]); c.lineTo(x, y); c.stroke(); }
      lastNote = [x, y, f.beat];
      if (f.ride !== 0) {
        // gold collected by riding (the Comet's climb, a form's introduction): a plain gold bead, nothing to tap
        c.fillStyle = 'rgba(3,5,14,0.5)'; c.beginPath(); c.arc(x, y, rb * 0.6, 0, TWO_PI); c.fill();
        c.fillStyle = rgba(GOLD); c.beginPath(); c.arc(x, y, rb * 0.38, 0, TWO_PI); c.fill();
        c.globalAlpha = 1;
        continue;
      }
      const big = f.air ? 1 : 0.8;
      c.fillStyle = HALO;
      c.beginPath(); c.arc(x, y, rb * 1.35 * big, 0, TWO_PI); c.fill();
      c.strokeStyle = rgba(GOLD);
      c.lineWidth = Math.max(1.5, rb * 0.3);
      c.beginPath(); c.arc(x, y, rb * 0.95 * big, 0, TWO_PI); c.stroke();
      c.fillStyle = rgba(f.charge ? WHITE : GOLD, 0.95);
      c.beginPath(); c.arc(x, y, rb * 0.4 * big, 0, TWO_PI); c.fill();
      if (trail && f.beat >= trail.a - 1e-6 && f.beat <= trail.b + 1e-6) {
        // part of the star trail: ringed in white
        c.strokeStyle = rgba(STAR, 0.9);
        c.lineWidth = Math.max(1.2, rb * 0.2);
        c.beginPath(); c.arc(x, y, rb * 1.7 * big, 0, TWO_PI); c.stroke();
      }
      c.globalAlpha = 1;
    }
    // the star itself, on the last piece of gold of its trail; a small one marks where the trail starts
    if (!twin) for (const st of course.stars) {
      const state = sim.stars[st.i];
      const kept = starsFor(run.level.id)[st.i];
      const spot = (w: Star['at'], b: number): [number, number] => {
        const r = this.rad(w.rho) + w.side * rb;
        return this.wxy(w.planet, ang(b), r);
      };
      if (state === -1) {
        // lost: it greys, shrinks and is gone
        const age = (beat - sim.starBeat[st.i]) * course.spb;
        if (age < 0 || age > 0.5 || st.b - beat > this.ahead) continue;
        const [x, y] = spot(st.at, st.b);
        c.globalAlpha = 1 - age / 0.5;
        this.star(x, y + age * rb * 6, rb * 2.3 * (1 - age), [150, 156, 176], 0, age * 3);
        c.globalAlpha = 1;
        continue;
      }
      if (state !== 0 || st.a - beat > this.ahead || beat > st.b + 0.15) continue;
      const show = clamp((this.ahead - (st.a - beat)) / 0.6, 0, 1);
      const beatPulse = Math.exp(-(((beat % 1) + 1) % 1) * 4);
      if (beat < st.a) {
        const [x, y] = spot(st.from, st.a);
        c.globalAlpha = show;
        this.star(x, y, rb * (1.9 + 0.25 * beatPulse), kept ? WHITE : STAR, 0, 0);
      }
      if (st.b - beat <= this.ahead) {
        const [x, y] = spot(st.at, st.b);
        c.globalAlpha = clamp((this.ahead - (st.b - beat)) / 0.6, 0, 1) * (kept ? 0.6 : 1);
        this.star(x, y, rb * (2.5 + 0.3 * beatPulse), kept ? WHITE : GOLD, clamp((beat - st.a) / (st.b - st.a), 0, 1), 0);
      }
      c.globalAlpha = 1;
    }
    // the ball: its place round the core is a pure function of the clock, so it moves exactly as smoothly as the clock does
    if (run.state === 'failed') return;
    // the Meteor is a dash, not a hop: he drives forward low along the ring (a flattened flight), stretched along the
    // way he goes, through the wall
    const dashing = !twin && sim.mode === 'flight' && course.formAt(beat) === 'meteor' && !!sim.fl;
    const dashK = dashing && sim.fl ? Math.sin(Math.PI * clamp((beat - sim.fl.t0) / Math.max(0.05, sim.fl.t1 - sim.fl.t0), 0, 1)) : 0;
    const rho0 = this.ballRho(sim, beat), rho = dashing ? sim.lv + (rho0 - sim.lv) * 0.22 : rho0;
    // a landing presses him down and lets him up again; and on the ground, as the ring closes on the node he is about to
    // leave from, he gathers himself a little (the anticipation before the hop)
    const cue = this.cues.reduce((m, q) => (q.beat >= beat - 0.02 && q.beat < m ? q.beat : m), Infinity);
    const crouch = sim.mode === 'ground' && !twin && this.look === 2 ? clamp(1 - (cue - beat) * course.spb / 0.16, 0, 1) : 0;
    const squash = 4 * this.landPulse * (1 - this.landPulse) + 0.35 * crouch * crouch;
    // (the journey's feel, 2026-11-26: on the ground he bobs with the beat, down on it, up between; visual only)
    const bob = this.geo && sim.mode === 'ground' && !twin ? Math.pow(Math.sin(Math.PI * (((beat % 1) + 1) % 1)), 2) * rb * 0.28 * (1 - crouch) : 0;
    const off = sim.sideAt(beat) * (rb * (1 - 0.3 * squash) + bob);
    // at the finish the ball launches straight out through every ring and off the screen
    const away = run.finale ? Math.pow(Math.min(1.4, run.finaleAge / 0.9), 2.2) * this.r0 * 7 : 0;
    if (away > Math.hypot(this.w, this.h)) return;
    const br = this.rad(rho) + off + away;
    const a = ang(beat);
    c.lineCap = 'round';
    const heroForm: Form = twin ? 'orb' : course.formAt(beat);
    this.who = twin ? this.twinIs : 'orbin';
    this.heroSide = sim.sideAt(beat) < 0 ? -1 : 1;
    const tint = heroForm === 'orb' ? skin : mix(skin, FORM_COL[heroForm], 0.7);
    const n = this.trail.length;
    for (let i = 1; i < n; i++) {
      const p0 = this.trail[i - 1];
      const p1 = this.trail[i];
      const u = i / n;
      const ra = this.rad(p0.rho) + p0.off + (p0.away ?? 0);
      const rz = this.rad(p1.rho) + p1.off + (p1.away ?? 0);
      const [x0, y0] = this.wxy(p0.pf, ang(p0.beat), ra);
      const [x1, y1] = this.wxy(p1.pf, ang(p1.beat), rz);
      c.strokeStyle = rgba(tint, u * u * (this.look === 2 ? 0.28 : 0.55));
      c.lineWidth = rb * 1.7 * u;
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    }
    // his trail takes the element of the mode he is in: a flame for the Meteor, wind for the wave, water for the ball,
    // leaves for the snap (the cinematic pass); it stays behind him and under the course's marks
    if (!twin && this.look === 2 && heroForm !== 'orb' && n > 2) {
      const world = run.level.file.side?.of ?? run.level.id, el = heroForm === 'meteor' ? 'fire' : heroForm === 'sat' ? 'wind' : heroForm === 'pulsar' ? (world === 'invincible' ? 'leaf' : 'water') : heroForm === 'comet' ? 'wind' : '';
      const ecol: RGB = el === 'fire' ? [255, 150, 70] : el === 'wind' ? [255, 215, 245] : el === 'water' ? [170, 220, 255] : [160, 240, 160];
      const pts = this.trail.map((p) => this.wxy(p.pf, ang(p.beat), this.rad(p.rho) + p.off + (p.away ?? 0)));
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 1; i < pts.length; i++) { const u = i / pts.length; c.strokeStyle = rgba(ecol, u * 0.45); c.lineWidth = rb * (el === 'fire' ? 2.4 : 1.6) * u; c.beginPath(); c.moveTo(pts[i - 1][0], pts[i - 1][1]); c.lineTo(pts[i][0], pts[i][1]); c.stroke(); }
      for (let i = 0; i < pts.length; i++) {
        const u = i / pts.length, [px, py] = pts[i], ph = time * 6 + i * 1.7;
        if (el === 'fire') { c.fillStyle = rgba([255, 200, 120], 0.6 * u); c.beginPath(); c.arc(px + Math.sin(ph) * rb * 0.6, py - (1 - u) * rb * 1.4, rb * 0.22 * u, 0, TWO_PI); c.fill(); }
        else if (el === 'wind') { c.strokeStyle = rgba(ecol, 0.35 * u); c.lineWidth = 1; c.beginPath(); c.arc(px, py, rb * (0.6 + 0.4 * Math.sin(ph)), ph, ph + 2); c.stroke(); }
        else if (el === 'water') { c.fillStyle = rgba([230, 245, 255], 0.55 * u); c.beginPath(); c.arc(px + Math.sin(ph) * rb * 0.4, py + Math.cos(ph) * rb * 0.4, rb * 0.16, 0, TWO_PI); c.fill(); }
        else { c.save(); c.translate(px + Math.sin(ph) * rb * 0.5, py + Math.cos(ph) * rb * 0.5); c.rotate(ph); c.fillStyle = rgba(ecol, 0.6 * u); c.beginPath(); c.ellipse(0, 0, rb * 0.35, rb * 0.13, 0, 0, TWO_PI); c.fill(); c.restore(); }
      }
      c.restore();
    }
    c.lineCap = 'butt';
    const vr = dt > 0 && this.ball.r ? (br - this.ball.r) / dt : 0;
    const stretch = sim.mode !== 'ground' ? clamp(Math.abs(vr) / (r0 * 4), 0, 0.2) : 0;
    const [x, y] = this.wxy(this.pf, a, br);
    // (in a leap he stretches along his flight with his speed across the screen: the take-off and landing ease it in and out)
    const sv = dt > 0 && !twin ? Math.hypot(x - this.ballXY[0], y - this.ballXY[1]) / dt : 0;
    const fly = this.geo && !twin && this.pf !== Math.round(this.pf) ? clamp(sv / (r0 * 12), 0, 0.28) : 0;
    this.ballXY = [x, y];
    // his plume (the Ufotable pass, 2026-11-26): a rope of springs off his back in his mode's element (pale gold in no
    // mode), in the world's frame: each link lags the one before, swings as he turns and settles when he lands; fire
    // rises off it, water and leaves sink a little, wind streams
    if (!twin && this.look === 2 && run.state === 'playing') {
      const hx = x + this.camX, hy = y + this.camY, N = 9, seg = rb * 0.62, sdt = Math.min(dt, 0.034);
      if (this.plume.length !== N || Math.hypot(this.plume[0].x - hx, this.plume[0].y - hy) > rb * 30) this.plume = Array.from({ length: N }, () => ({ x: hx, y: hy, px: hx, py: hy }));
      const ua = this.upA(this.pf, a), el = heroForm === 'meteor' ? 1.6 : heroForm === 'sat' || heroForm === 'comet' ? 0.2 : heroForm === 'pulsar' ? -0.5 : 0.6;
      const gx = Math.cos(ua) * el * rb * 60, gy = Math.sin(ua) * el * rb * 60;
      this.plume[0] = { x: hx, y: hy, px: hx, py: hy };
      for (let i = 1; i < N; i++) { const q = this.plume[i], vx = (q.x - q.px) * 0.9, vy = (q.y - q.py) * 0.9; q.px = q.x; q.py = q.y; q.x += vx + gx * sdt * sdt; q.y += vy + gy * sdt * sdt; }
      for (let it = 0; it < 3; it++) for (let i = 1; i < N; i++) { const p0 = this.plume[i - 1], q = this.plume[i], dx = q.x - p0.x, dy = q.y - p0.y, d = Math.hypot(dx, dy) || 1, k = (d - seg) / d; q.x -= dx * k; q.y -= dy * k; }
      const col: RGB = heroForm === 'meteor' ? [255, 160, 80] : heroForm === 'sat' || heroForm === 'comet' ? [255, 220, 245] : heroForm === 'pulsar' ? ((run.level.file.side?.of ?? run.level.id) === 'invincible' ? [170, 240, 160] : [180, 225, 255]) : [255, 226, 170];
      c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
      for (let i = 1; i < N; i++) { const u = 1 - i / N, p0 = this.plume[i - 1], q = this.plume[i]; c.strokeStyle = rgba(col, 0.42 * u); c.lineWidth = rb * (0.2 + 1.1 * u); c.beginPath(); c.moveTo(p0.x - this.camX, p0.y - this.camY); c.lineTo(q.x - this.camX, q.y - this.camY); c.stroke(); }
      c.restore();
    }
    // a dark halo, so the ball reads against anything
    c.fillStyle = 'rgba(3,5,14,0.5)';
    c.beginPath(); c.arc(x, y, rb * 2.1, 0, TWO_PI); c.fill();
    const dir = course.angle(beat + 0.05) >= course.angle(beat) ? 1 : -1;
    this.drawHero(x, y, rb, skin, this.upA(this.pf, a), dir, heroForm, 1 + stretch + fly - 0.3 * squash - 0.18 * dashK, 1 - (stretch + fly) * 0.5 + 0.22 * squash + 0.45 * dashK, sim.down ? 1 : 0);
    if (!twin) {
      this.ball.x = x;
      this.ball.y = y;
      this.ball.r = br;
    }
  }

  /**
   * Dual mode's second spark, mirrored across the screen, answering the same taps in its own way. A Pulsar stays on
   * one ring and flips to the other side of it on every tap (its marks have a blot of ink behind them). A Satellite
   * zig-zags between two rings, turning on every tap (its marks are at the turns).
   */
  private drawEcho(run: GdRun, beat: number, skin: RGB): void {
    const c = this.ctx;
    const course = run.course;
    const sim = run.sim;
    const { rb } = this;
    const rng = course.duals.find(([a, z]) => beat >= a - 1 && beat < z + 0.25);
    if (!rng) return;
    const ang = (b: number) => -Math.PI / 2 + course.angle(b);
    const ps = course.presses;
    let first = ps.findIndex((p) => p.beat >= rng[0] - 1e-6);
    if (first < 0) first = ps.length;
    const sideBefore = (k: number) => ((Math.max(k, first) - first) % 2 === 0 ? 1 : -1);
    const R = this.rad(this.cam);
    c.save();
    c.translate(this.coreX, this.coreY);
    c.lineCap = 'round';
    if (rng[2] === 'sat') {
      const Rin = this.rad(this.cam - 1);
      const ringOf = (k: number) => ((Math.max(k, first) - first) % 2 === 0 ? R : Rin); // the ring it is on as press k comes
      for (const rr of [Rin, R]) { c.beginPath(); this.arcPath(course, rr, beat - 0.8, beat + this.ahead); c.strokeStyle = HALO; c.lineWidth = 8; c.stroke(); c.strokeStyle = rgba(FLOOR, 0.55); c.lineWidth = 2.6; c.stroke(); }
      // where it is, and the zig-zag ahead of it: a straight run from turn to turn
      const lastS = ps[sim.ni - 1];
      const nextS = ps[sim.ni];
      const inRng = !!lastS && sim.ni - 1 >= first && lastS.beat < rng[1];
      const t1 = nextS && nextS.beat < rng[1] + 1e-6 ? nextS.beat : (lastS ? lastS.beat : beat) + 1;
      const rrNow = inRng ? lerp(ringOf(sim.ni - 1), ringOf(sim.ni), clamp((beat - lastS.beat) / Math.max(0.05, t1 - lastS.beat), 0, 1)) : ringOf(first);
      c.beginPath(); c.moveTo(Math.cos(ang(beat)) * rrNow, Math.sin(ang(beat)) * rrNow);
      let fromB = beat, fromR = rrNow;
      for (let k = Math.max(first, sim.ni); k < ps.length; k++) {
        const p = ps[k];
        if (p.beat >= rng[1] || p.beat - beat > this.ahead) break;
        for (let q = 1; q <= 5; q++) { const b = lerp(fromB, p.beat, q / 5), rr = lerp(fromR, ringOf(k), q / 5); c.lineTo(Math.cos(ang(b)) * rr, Math.sin(ang(b)) * rr); }
        fromB = p.beat; fromR = ringOf(k);
      }
      c.setLineDash([2, 7]); c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 2.2; c.stroke(); c.setLineDash([]);
      for (let k = Math.max(first, sim.ni); k < ps.length; k++) {
        const p = ps[k];
        if (p.beat >= rng[1] || p.beat - beat > this.ahead) break;
        if (p.twin !== 'b' && p.twin !== 'both') continue;
        c.globalAlpha = clamp((this.ahead - (p.beat - beat)) / 0.6, 0, 1);
        const a = ang(p.beat), rr = ringOf(k), len = rb * (p.accent ? 1.8 : 1.15);
        c.beginPath(); c.moveTo(Math.cos(a) * (rr - len), Math.sin(a) * (rr - len)); c.lineTo(Math.cos(a) * (rr + len), Math.sin(a) * (rr + len));
        c.strokeStyle = HALO; c.lineWidth = 8.5; c.stroke();
        c.strokeStyle = '#ffffff'; c.lineWidth = 3.5; c.stroke();
      }
      c.globalAlpha = 1;
      c.lineCap = 'butt';
      if (run.state !== 'failed') {
        const a = ang(beat), x = Math.cos(a) * rrNow, y = Math.sin(a) * rrNow;
        c.fillStyle = 'rgba(3,5,14,0.5)';
        c.beginPath(); c.arc(x, y, rb * 2.1, 0, TWO_PI); c.fill();
        this.drawHero(x, y, rb, skin, a, course.angle(beat + 0.05) >= course.angle(beat) ? 1 : -1, 'sat', 1, 1, 0);
      }
      c.restore();
      return;
    }
    c.beginPath(); this.arcPath(course, R, beat - 0.8, beat + this.ahead);
    c.strokeStyle = HALO; c.lineWidth = 10; c.stroke();
    c.strokeStyle = rgba(FLOOR, 0.9); c.lineWidth = 3.5; c.stroke();
    for (let k = Math.max(first, sim.ni); k < ps.length; k++) {
      const p = ps[k];
      if (p.beat >= rng[1] || p.beat - beat > this.ahead) break;
      if (p.twin !== 'b' && p.twin !== 'both') continue;
      c.globalAlpha = clamp((this.ahead - (p.beat - beat)) / 0.6, 0, 1);
      const e = ang(p.beat + p.tol + 0.06);
      const sd = sideBefore(k);
      const bx = Math.cos(e) * (R + sd * rb * 1.5);
      const by = Math.sin(e) * (R + sd * rb * 1.5);
      c.fillStyle = rgba(INK_RIM); c.beginPath(); c.arc(bx, by, rb * 1.55, 0, TWO_PI); c.fill();
      c.fillStyle = rgba(INK); c.beginPath(); c.arc(bx, by, rb * 1.2, 0, TWO_PI); c.fill();
      const a = ang(p.beat);
      const len = rb * (p.accent ? 1.8 : 1.15);
      c.beginPath(); c.moveTo(Math.cos(a) * (R - len), Math.sin(a) * (R - len)); c.lineTo(Math.cos(a) * (R + len), Math.sin(a) * (R + len));
      c.strokeStyle = HALO; c.lineWidth = 8.5; c.stroke();
      c.strokeStyle = '#ffffff'; c.lineWidth = 3.5; c.stroke();
    }
    c.globalAlpha = 1;
    c.lineCap = 'butt';
    if (run.state !== 'failed') {
      const last = ps[sim.ni - 1];
      let sd = sideBefore(sim.ni);
      if (last && sim.ni - 1 >= first && last.beat < rng[1]) sd = lerp(sideBefore(sim.ni - 1), sideBefore(sim.ni), smooth((beat - last.beat) / 0.3));
      const a = ang(beat);
      const x = Math.cos(a) * (R + sd * rb);
      const y = Math.sin(a) * (R + sd * rb);
      c.fillStyle = 'rgba(3,5,14,0.5)';
      c.beginPath(); c.arc(x, y, rb * 2.1, 0, TWO_PI); c.fill();
      this.drawHero(x, y, rb, skin, a, course.angle(beat + 0.05) >= course.angle(beat) ? 1 : -1, 'pulsar', 1, 1, 0);
    }
    c.restore();
  }

  // ---------------------------------------------------------------- a frame of play
  draw(run: GdRun, now: number, dt: number): void {
    if (this.bound !== run) this.bind(run);
    const c = this.ctx;
    const level = run.level;
    const course = run.course;
    const sim = run.sim;
    const t = run.viewTime;
    this.songT = t;
    const beat = t / level.spb;
    // speed is felt: from a bar before a fast portal the stars stretch into streaks, and at speed the camera eases out
    // (so there is always at least as much course in view, in seconds, as at the normal pace)
    {
      const barNow = course.bars[Math.max(0, Math.min(course.bars.length - 1, Math.floor(beat / 4)))];
      const ahead = course.portals.find((g) => g.beat > beat - 0.01 && g.beat - beat <= 4);
      const want = Math.max(0, Math.max(barNow?.speed ?? 1, ahead && ahead.faster ? 1 + (ahead.speed - 1) * clamp(1 - (ahead.beat - beat) / 4, 0, 1) : 0) - 1);
      { const w = 3.2, sdt = Math.min(dt, 0.034); this.speedV += (w * w * (want - this.speedK) - 2 * w * this.speedV) * sdt; this.speedK += this.speedV * sdt; }
      const mini = course.bars[Math.max(0, Math.min(course.bars.length - 1, Math.floor(beat / 4)))]?.mini ? 1 : 0;
      { const w = 7, sdt = Math.min(dt, 0.034); this.miniV += (w * w * (mini - this.miniK) - 2 * w * this.miniV) * sdt; this.miniK += this.miniV * sdt; }
      const cs = this.planet?.cam?.(t) ?? 1, zk = 3.2, zdt = Math.min(dt, 0.034);
      // (two springs in a row: a change of framing eases in and out, never starts at full speed; 2026-11-26)
      this.csTV += (zk * zk * (cs - this.csT) - 2 * zk * this.csTV) * zdt; this.csT += this.csTV * zdt;
      this.camSV += (16 * (this.csT - this.camScale) - 8 * this.camSV) * zdt; this.camScale += this.camSV * zdt;
    }
    const m = this.sizes();
    const span = Math.max(this.w, this.h) * 0.75;
    const { r0, rb } = this;
    const skin = orbColour(save.skin);
    const calm = save.reducedMotion;

    // the section's palette, cross-faded (at the drop it snaps: the colours explode rather than fade)
    const seg = level.segAt(Math.max(0, t));
    if (seg.look.palette !== this.palName) {
      this.palFrom = this.pal;
      this.palName = seg.look.palette;
      this.palT = seg.core?.smash ? 0.7 : 0;
    }
    const target = PALETTES[this.palName] || PALETTES.deep;
    this.palT = Math.min(1, this.palT + dt / 0.5);
    const sectPal: Palette = this.palT >= 1 ? target : { bg0: mix(this.palFrom.bg0, target.bg0, this.palT), bg1: mix(this.palFrom.bg1, target.bg1, this.palT), ring: mix(this.palFrom.ring, target.ring, this.palT), acc: mix(this.palFrom.acc, target.acc, this.palT) };
    void sectPal; // (sections no longer set the colours: the planet has one palette, and the song decides how much of it shows)
    const P3 = (PLANETS[level.file.side?.of ?? level.id] ?? PLANETS.heroes).rgb;
    const kc = this.colour;
    const pal: Palette = { bg0: mix([26, 26, 46], mix(P3[1], P3[2], 0.62), kc), bg1: mix([9, 10, 20], mix(P3[2], [8, 6, 24], 0.45), kc), ring: mix(ATLAS_INK, P3[0], kc), acc: mix(GOLD, mix(P3[0], WHITE, 0.3), kc) };
    this.pal = pal;

    // the song's measured energy sets the scene; the player's flow opens it up or drains it
    this.flowV += (sim.flow - this.flowV) * Math.min(1, dt * 6);
    this.drain += (sim.muffle - this.drain) * Math.min(1, dt * (sim.muffle > this.drain ? 1.4 : 9));
    this.inten += (this.energyAt(beat) - this.inten) * Math.min(1, dt * 2.5);
    const afterDrop = beat >= course.dropBeat - 0.01;
    this.chargeV += (sim.charge - this.chargeV) * Math.min(1, dt * 8);
    // before the drop the charge winds everything up; after it, the drop is as big as the charge and flow made it
    const wound = afterDrop ? 0 : this.chargeV * (course.charges.length ? 1 : 0);
    const bloom = (0.6 + 0.55 * this.flowV) * (afterDrop ? 0.6 + 0.4 * this.dropPower : 1) * (1 - this.drain * 0.4);
    const inten = clamp(this.inten * bloom + wound * 0.3, 0, 1.15);
    const kick = Math.min(1.3, level.energyAt('kick', t) * (1 + wound * 0.8));
    const snare = level.energyAt('snare', t);
    const groove = kick * inten * inten;
    // drive: nothing in the verse, everything in a drop that was earned. It scales every effect behind the course.
    this.world += ((afterDrop ? 1 : 0) - this.world) * Math.min(1, dt * 6);
    // a section the level calls a drop is always loud enough to go off, however sparse its kick
    const hot = Math.max(clamp((this.inten - 0.45) / 0.4, 0, 1), seg.label === 'DROP' ? 0.8 : 0);
    let drive = this.world * hot * (0.4 + 0.6 * this.dropPower) * (0.75 + 0.25 * this.flowV) * (1 - this.drain * 0.6);
    // the finish: everything behind the course goes off at full strength, whatever came before
    const fin = run.finale ? run.finaleAge : -1;
    if (fin >= 0) drive = Math.max(drive, clamp(1 - (fin - 3) / 1, 0.4, 1));
    // a B-side is the night side of its planet: the same scene, with the lights down
    this.dark += (Math.max(seg.blackout ? 0.45 : 0, level.file.side ? 0.3 : 0) - this.dark) * Math.min(1, dt * 4);

    {
      const home = bestFor(level.file.side?.of ?? level.id).cleared ? 0.26 : 0;
      const want = clamp(Math.max(home, drive * 1.2, this.flash), 0, 1);
      this.colour += (want - this.colour) * Math.min(1, dt * (want > this.colour ? 9 : 1.5));
    }
    // what just happened
    const loud = drive > 0.15 || wound > 0.05;
    const formEv = course.presses[sim.ni - 1]?.form;
    for (const ev of run.events) {
      if (ev.kind === 'tick') { this.burst(this.ball.x, this.ball.y, 4, GOLD, r0 * 0.5, 0.7); continue; }
      if (ev.kind === 'star') {
        // a star collected: two gold rings off the ball's ring and a shower of sparks
        this.wave(this.ball.r || r0, GOLD, r0 * 3.4, 5, 0.75, 0.6);
        this.wave((this.ball.r || r0) * 0.8, WHITE, r0 * 2.4, 3, 0.5, 0.5);
        this.burst(this.ball.x, this.ball.y, 34, GOLD, r0 * 1.8, 1.2);
        this.burst(this.ball.x, this.ball.y, 14, WHITE, r0 * 1.1);
        this.ringFlash = 1;
        this.punch = Math.max(this.punch, calm ? 0.2 : 0.5);
        continue;
      }
      if (ev.kind === 'starlost') { this.burst(this.ball.x, this.ball.y, 8, [150, 156, 176], r0 * 0.6, 0.8); continue; }
      if (ev.kind === 'release' && ev.flow) { this.ripples.push({ x: this.ball.x, y: this.ball.y, age: 0, col: GOLD }); this.burst(this.ball.x, this.ball.y, 7, GOLD, r0 * 0.7, 0.8); continue; }
      if (ev.kind === 'held' && ev.full) {
        // a hold collected in full: a gold ring off the ball's ring
        this.wave(this.ball.r || r0, GOLD, r0 * 2.6, 3, 0.5, 0.4);
        this.burst(this.ball.x, this.ball.y, 12, GOLD, r0 * 1.1);
        continue;
      }
      if (ev.kind === 'hop' || ev.kind === 'flip' || ev.kind === 'spark') {
        if (ev.kind !== 'spark' || ev.flow) this.ripples.push({ x: this.ball.x, y: this.ball.y, age: 0, col: ev.flow ? GOLD : [170, 180, 200] });
        if (ev.flow) this.burst(this.ball.x, this.ball.y, ev.kind === 'spark' ? 7 : 5, GOLD, r0 * 0.7, 0.8); // small sparkles: on the note
        if (ev.charge) this.punch = Math.max(this.punch, 0.2); // each roll note you catch winds the picture a little tighter
        if (ev.kind === 'flip') this.burst(this.ball.x, this.ball.y, 12, VIOLET, r0 * 0.9);
        if (ev.kind === 'hop' && (formEv === 'meteor' || this.look === 2)) this.strike = 1; // (the planet's soul strikes with it; in the new look every good tap touches the world)
        if ((ev.kind === 'hop' || ev.kind === 'flip') && ev.flow !== false) this.planet?.spark(-Math.PI / 2 + course.angle(beat), t, this.pf); // (a good tap relights the zone under him)
        if (ev.kind === 'hop' && formEv === 'meteor') { this.burst(this.ball.x, this.ball.y, 16, INK_RIM, r0 * 1.4); this.burst(this.ball.x, this.ball.y, 8, FORM_COL.meteor, r0 * 0.9); } // the wall goes to pieces
        if (ev.flow && loud) {
          // in the loud parts an on-beat tap drives the picture: a shockwave off the ball's ring, the rings light up, a burst
          const press = ev.kind !== 'spark';
          this.wave(this.ball.r || r0, press ? WHITE : GOLD, r0 * (press ? 3.2 : 2.4), press ? 4 : 2.5, press ? 0.6 : 0.45, press ? 0.5 : 0.35);
          this.ringFlash = Math.max(this.ringFlash, press ? 1 : 0.6);
          this.burst(this.ball.x, this.ball.y, press ? 12 : 8, pal.acc, r0 * 1.2);
          if (press && !calm) this.punch = Math.max(this.punch, 0.3);
        }
        if (ev.accent) {
          if (afterDrop) this.coreFlare = Math.max(this.coreFlare, 0.7);
          // a big hit: the camera bumps, a wide shockwave, a flicker of colour
          this.wave(this.ball.r || r0, WHITE, r0 * 4, 6, 0.7, 0.6);
          this.burst(this.ball.x, this.ball.y, 22, WHITE, r0 * 1.6);
          this.punch = Math.max(this.punch, calm ? 0.2 : 0.7);
          this.ringFlash = 1;
          if (!calm) this.strobe = Math.max(this.strobe, 0.6);
        }
        if (ev.sling) {
          this.burst(this.ball.x, this.ball.y, 26, CYAN, r0 * 2);
          this.wave(this.ball.r || r0, CYAN, r0 * 4, 5, 0.7, 0.6);
          if (!calm) this.zoomKick = Math.max(this.zoomKick, 0.5);
        }
      } else if (ev.kind === 'land') this.landPulse = 1;
      else if (ev.kind === 'drop') {
        const pw = ev.power ?? (ev.full ? 1 : 0.3);
        this.dropFull = !!ev.full;
        this.dropPower = pw;
        this.dropAge = 0;
        this.coreFlare = 1;
        this.punch = 0.3 + 0.7 * pw;
        this.ringFlash = 1;
        if (pw >= 0.3) {
          // the drop, as big as it was earned: a flash, three shockwaves, every ring on screen shatters into shards,
          // the camera is thrown back and the world behind changes for good
          this.flash = pw;
          this.zoomKick = calm ? 0 : pw;
          this.strobe = calm ? 0 : pw;
          const rr = this.ball.r || r0;
          if (!calm) { this.burstK = 1; this.flipK = pw; }
          for (let k = 0; k < 3; k++) this.wave(rr * (0.4 + k * 0.5), k === 1 ? WHITE : pal.acc, r0 * (5 + k * 1.5) * (0.5 + pw), 10 - k * 2, 0.75, 0.7 + k * 0.12);
          const n = Math.round(150 * pw * (calm ? 0.3 : 1));
          for (let i = 0; i < n; i++) {
            const a = (i / n) * TWO_PI + Math.random() * 0.1;
            const from = rr * (0.7 + (i % 3) * 0.28);
            const sp = r0 * (1.5 + Math.random() * 4) * (0.5 + pw);
            this.spawn(this.coreX + Math.cos(a) * from, this.coreY + Math.sin(a) * from, Math.cos(a) * sp, Math.sin(a) * sp, 0.5 + Math.random() * 0.6, i % 3 === 0 ? WHITE : i % 3 === 1 ? pal.acc : pal.ring, 2 + Math.random() * 3.5, i % 2 === 0);
          }
        }
      } else if (ev.kind === 'finale') {
        // level complete: the ball launches out through every ring and the world bursts into the level's colours
        this.flash = 1;
        this.ringFlash = 1;
        this.burstK = 1;
        this.coreFlare = 1;
        this.zoomKick = calm ? 0 : 0.7;
        this.punch = 1;
        for (let k = 0; k < 4; k++) this.wave(r0 * (0.3 + k * 0.45), k % 2 ? WHITE : pal.acc, r0 * (4 + k * 1.6), 9 - k, 0.8, 0.8 + k * 0.15);
        const n = calm ? 60 : 220;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * TWO_PI;
          const sp = r0 * (1 + Math.random() * 5);
          this.spawn(this.coreX + Math.cos(a) * r0 * 0.3, this.coreY + Math.sin(a) * r0 * 0.3, Math.cos(a) * sp, Math.sin(a) * sp, 0.7 + Math.random() * 0.9, [pal.ring, pal.acc, WHITE, GOLD][i % 4], 2 + Math.random() * 4, i % 3 === 0);
        }
      } else if (ev.kind === 'crash') {
        this.burst(this.ball.x, this.ball.y, 34, WHITE, r0 * 1.5);
        this.burst(this.ball.x, this.ball.y, 16, DANGER, r0 * 1.1);
        this.shake = calm ? 0 : 1;
      }
    }
    run.events.length = 0;
    if (this.ripples.length > 8) this.ripples.splice(0, this.ripples.length - 8);

    // the music drives the drop too: every kick throws a burst off the core and bumps the camera, every snare flickers the colour
    if (kick > 0.55 && this.kickWas <= 0.55 && drive > 0.2 && run.state === 'playing' && this.look !== 2) {
      if (!calm) {
        const n = Math.round(6 + 12 * drive);
        for (let i = 0; i < n && this.particles.length < 420; i++) {
          const a = Math.random() * TWO_PI;
          const sp = r0 * (1.2 + Math.random() * 2.2) * (0.6 + drive);
          this.spawn(this.coreX + Math.cos(a) * m * 0.06, this.coreY + Math.sin(a) * m * 0.06, Math.cos(a) * sp, Math.sin(a) * sp, 0.35 + Math.random() * 0.4, pal.acc, 1.5 + Math.random() * 2.5, true);
        }
        this.punch = Math.max(this.punch, 0.3 * drive);
        this.burstK = 1; // the equalizer bursts to the edges
        if (drive > 0.35) this.flipK = Math.max(this.flipK, 0.8); // and the backdrop's colours flip
      }
      this.wave(m * 0.07, pal.acc, r0 * 3.5, 3, 0.28 * drive, 0.5);
    }
    if (snare > 0.6 && this.snareWas <= 0.6 && drive > 0.35 && !calm) {
      this.strobe = Math.max(this.strobe, 0.35 * drive);
      // glitch hit: for a tenth of a second a few bands of the backdrop tear sideways
      this.glitch = 0.1;
      this.bands = Array.from({ length: 4 }, () => [Math.random() * this.h, 14 + Math.random() * 46, (Math.random() - 0.5) * 90 * drive] as [number, number, number]);
    }
    this.kickWas = kick;
    this.snareWas = snare;
    if (fin >= 0 && fin < 3.2 && !calm && Math.floor(fin / 0.28) !== Math.floor((fin - dt) / 0.28)) {
      // fireworks through the finish
      const a = Math.random() * TWO_PI;
      const d = r0 * (0.8 + Math.random() * 1.6);
      this.burst(this.coreX + Math.cos(a) * d, this.coreY + Math.sin(a) * d, 26, [pal.acc, GOLD, WHITE, pal.ring][Math.floor(fin / 0.28) % 4], r0 * 1.6, 1.2);
      this.wave(r0 * 0.4, pal.acc, r0 * 4.5, 4, 0.4, 0.6);
    }

    // spring camera: keeps the ball's ring at a steady radius; further out while it rides the inside, where the hops
    // go toward the core, and it starts moving there a couple of beats before the flip
    const rho = sim.rho(beat);
    const nextP = course.presses[sim.ni];
    const lastP = course.presses[sim.ni - 1];
    // in a weave the ball bounces between two rings on every press: the camera holds still between them
    const weaving = sim.mode === 'flight' ? !!lastP?.weave : !!nextP?.weave && (!!lastP?.weave || nextP.beat - beat < 1.5);
    const camT = weaving ? (sim.mode === 'flight' ? lastP!.camLv : nextP!.camLv) : rho;
    const om = 9, cdt = Math.min(dt, 0.034);
    // (its target eased first, so it never starts moving at full acceleration: 2026-11-26)
    if (!this.camTOn) { this.camTS = camT; this.camTV = 0; this.camTOn = true; }
    this.camTV += (14 * 14 * (camT - this.camTS) - 28 * this.camTV) * cdt; this.camTS += this.camTV * cdt;
    this.camVel += (om * om * (this.camTS - this.cam) - 2 * om * this.camVel) * cdt;
    this.cam += this.camVel * cdt;
    const inward = !weaving && (sim.sideAt(beat) < 0 || (!!nextP && nextP.kind === 'flip' && !nextP.weave && nextP.side > 0 && nextP.beat - beat < 2.5));
    // the camera follows the ball from planet to planet, and leans toward the next one before a planet hop
    this.pf = this.planetOf(run, beat);
    // camera first: in a planet hop the camera reaches the next planet well before the ball, so everything there is in view on landing
    // It is one continuous move: a lean toward the next planet over the two beats before the hop (whatever the ball is
    // doing then, and held if the tap comes late), carried straight on into the crossing when the ball takes off.
    const LEAN = 0.32;
    const slinging = !!lastP?.sling && sim.mode === 'flight' && !!sim.fl;
    // the next planet hop coming up, even if another press comes before it
    let slingP: typeof nextP | undefined = undefined as typeof nextP | undefined;
    for (let i = sim.ni; i < course.presses.length && course.presses[i].beat - beat < 2.5; i++) if (course.presses[i].sling) { slingP = course.presses[i]; break; }
    const hop = slinging ? lastP!.planet + LEAN + (1 - LEAN) * smoothstep(Math.min(1, ((beat - sim.fl!.t0) / (sim.fl!.t1 - sim.fl!.t0)) * 2.4)) : this.pf;
    let [tx, ty] = this.planetXY(hop);
    if (!slinging && slingP) {
      const [nx, ny] = this.planetXY(slingP.planetTo);
      const lean = LEAN * smoothstep((2.5 - (slingP.beat - beat)) / 2);
      tx += (nx - tx) * lean;
      ty += (ny - ty) * lean;
    }
    if (this.geo) {
      // the journey's camera: in a leap it travels ahead of him to the next place, so the landing is in view before he
      // gets there; before a leap it leans a little toward where he will go; on a bridge it runs with him, looking ahead
      let aim = this.pf;
      let leapP: typeof nextP | undefined = undefined as typeof nextP | undefined;
      for (let i = Math.max(0, sim.ni - 1); i < course.presses.length && course.presses[i].beat - beat < 2.5; i++) { const q = course.presses[i]; if (q.leap && !q.leap.ember && beat < q.leap.b1) { leapP = q; break; } }
      if (leapP?.leap && beat >= leapP.beat) aim = leapAt(leapP.leap, Math.min(leapP.leap.b1, beat + 0.9));
      else if (leapP?.leap) aim = this.pf + 0.22 * smoothstep((2.5 - (leapP.beat - beat)) / 2);
      [tx, ty] = this.planetXY(aim);
      const k = Math.round(aim);
      if (Math.abs(aim - k) < 1e-3 && this.geo.defs[k]?.shape === 'line') {
        const ahead = this.wxy(k, -Math.PI / 2 + course.angle(beat + 1.2), this.rad(this.cam));
        tx += ahead[0] + this.camX - tx; ty += ahead[1] + this.camY - ty;
      }
      const pull = this.planet?.pull?.(t);
      if (pull && pull.k > 0) { const U = this.rad(this.cam), wide = this.w >= this.h, px = wide ? -pull.y : pull.x, py = wide ? pull.x : pull.y; tx = lerp(tx, px * U, pull.k); ty = lerp(ty, py * U, pull.k); }
      // framing (2026-11-26): wherever it aims, the camera keeps Orbin well inside the picture, and the path 1.5 s ahead
      // in it too (Orbin first: he is never pushed to the edge)
      const at = (b: number): [number, number] => { const h = course.at(b), [ox, oy] = this.planetXY(h.planet), [x, y] = this.loc(h.planet, -Math.PI / 2 + course.angle(b), this.rad(h.rho)); return [ox + x, oy + y]; };
      const keep = (p: [number, number], mx: number, my: number): void => {
        const left = -this.w / 2 + mx, right = this.w / 2 - mx, top = -this.h * 0.52 + my, bottom = this.h * 0.48 - my;
        const dx = p[0] - tx, dy = p[1] - ty;
        if (dx < left) tx = p[0] - left; else if (dx > right) tx = p[0] - right;
        if (dy < top) ty = p[1] - top; else if (dy > bottom) ty = p[1] - bottom;
      };
      keep(at(beat + 1.5 / course.spb), 40, 70);
      const [bx, by] = this.planetXY(this.pf), [lx, ly] = this.loc(this.pf, -Math.PI / 2 + course.angle(beat), this.rad(this.ballRho(sim, beat)));
      keep([bx + lx, by + ly], this.w * 0.2, this.h * 0.16);
    }
    // a spring, like the zoom: the camera picks up speed and settles, it never changes pace in a single frame. (The
    // Ufotable pass, 2026-11-26: the target itself is eased first, by a spring of its own, so when what the camera
    // follows changes (a launch, a landing, a new place) it blends there over about half a second: two springs in a
    // row, so even its acceleration never jumps.)
    const tk = 9, sdt = Math.min(dt, 0.034);
    if (!this.tgOn) { this.tgX = tx; this.tgY = ty; this.tgVX = this.tgVY = 0; this.tgOn = true; }
    this.tgVX += (tk * tk * (tx - this.tgX) - 2 * tk * this.tgVX) * sdt; this.tgVY += (tk * tk * (ty - this.tgY) - 2 * tk * this.tgVY) * sdt;
    this.tgX += this.tgVX * sdt; this.tgY += this.tgVY * sdt;
    tx = this.tgX; ty = this.tgY;
    const ok = 12;
    this.camVX += (ok * ok * (tx - this.camX) - 2 * ok * this.camVX) * sdt;
    this.camVY += (ok * ok * (ty - this.camY) - 2 * ok * this.camVY) * sdt;
    this.camX += this.camVX * dt;
    this.camY += this.camVY * dt;
    if (this.geo) {
      // (after the spring: if a fast flight has carried Orbin, or the path 1.5 s ahead, toward the edge, the camera catches
      // up at once, so he is never pushed off the picture; 2026-11-26)
      const pt = (b: number): [number, number] => { const h = course.at(b), [ox, oy] = this.planetXY(h.planet), [x, y] = this.loc(h.planet, -Math.PI / 2 + course.angle(b), this.rad(h.rho)); return [ox + x, oy + y]; };
      const [qx, qy] = this.planetXY(this.pf), [lx, ly] = this.loc(this.pf, -Math.PI / 2 + course.angle(beat), this.rad(this.ballRho(sim, beat)));
      const fix = (p: [number, number], mx: number, my: number, k: number): void => {
        const dx = p[0] - this.camX, dy = p[1] - this.camY, L = -this.w / 2 + mx, Rr = this.w / 2 - mx, T = -this.h * 0.52 + my, B = this.h * 0.48 - my;
        const ex = dx < L ? dx - L : dx > Rr ? dx - Rr : 0, ey = dy < T ? dy - T : dy > B ? dy - B : 0;
        this.camX += ex * k; this.camY += ey * k; if (ex) this.camVX *= 0.5; if (ey) this.camVY *= 0.5;
      };
      // (only as a safety net now, gently, and at the very edge: the framing is the eased target's job)
      fix([qx + lx, qy + ly], this.w * 0.08, this.h * 0.06, Math.min(1, dt * 6));
      fix([qx + lx, qy + ly], 4, 4, 1);
      void pt;
    }
    const [wx, wy] = this.planetXY(this.pf);
    this.coreX = wx - this.camX;
    this.coreY = wy - this.camY;
    { const w = 4.5, sdt = Math.min(dt, 0.034), want = (inward ? 1.5 : 1) - wound * 0.1; this.baseTV += (81 * (want - this.baseT) - 18 * this.baseTV) * sdt; this.baseT += this.baseTV * sdt; this.baseRV += (w * w * (this.baseT - this.baseR) - 2 * w * this.baseRV) * sdt; this.baseR += this.baseRV * sdt; } // (springs in a row: 2026-11-26)
    this.punch = Math.max(0, this.punch - dt / 0.45);
    { const w = 34, sdt = Math.min(dt, 0.02); this.punchV += (w * w * (this.punch - this.punchS) - 2 * w * this.punchV) * sdt; this.punchS += this.punchV * sdt; }
    const up = sim.down && sim.mode !== 'flight' && run.state === 'playing' && !run.finale ? 1 : 0;
    this.liftV += (18 * 18 * (up - this.lift) - 2 * 18 * this.liftV) * Math.min(dt, 0.03);
    this.lift = clamp(this.lift + this.liftV * Math.min(dt, 0.03), 0, 1.05);
    // a shard branch still whole lifts the ball off the safe line along its path; one slip and it drops back
    const bt = run.finale ? undefined : course.stars.find((st) => sim.stars[st.i] === 0 && beat >= st.a - 0.05 && beat <= st.b + 0.5);
    this.branchV += ((bt ? 1 : 0) - this.branchV) * Math.min(1, dt * 12);
    if (bt) this.branchE = this.env(bt, beat);
    this.branchK = this.branchV * this.branchE;
    // mirror and upside-down gates: the picture turns over on the bar line itself. The gate is in view for beats
    // beforehand; the change is a snap, with a ring of light thrown out as it goes.
    let mx = 1;
    let my = 1;
    for (const g of course.mirrors) if (beat >= g) mx = -mx;
    for (const g of course.inverts) if (beat >= g) my = -my;
    if ((mx !== this.mx || my !== this.my) && run.state === 'playing' && beat > course.start + 0.5) { this.wave(this.ball.r || r0, CYAN, r0 * 3.4, 5, 0.7, 0.4); if (!calm) this.flash = Math.max(this.flash, 0.5); }
    this.mx = mx;
    this.my = my;
    { const w = 13, sdt = Math.min(dt, 0.02); this.mxV += (w * w * (mx - this.mxS) - 2 * w * this.mxV) * sdt; this.mxS += this.mxV * sdt; this.myV += (w * w * (my - this.myS) - 2 * w * this.myV) * sdt; this.myS += this.myV * sdt; }
    // the orbit turning round or changing speed snaps on its bar line too: the same ring of light, smaller
    let passed = 0;
    for (const t of course.turns) if (beat >= t) passed++;
    for (const g of course.portals) if (beat >= g.beat) passed++;
    if (passed !== this.gatesPassed && passed > this.gatesPassed && run.state === 'playing' && beat > course.start + 0.5) this.wave(this.ball.r || r0, CYAN, r0 * 3, 4, 0.55, 0.35);
    this.gatesPassed = passed;
    // through a lens: a burst in the new form's colour
    const formNow = course.formAt(beat);
    if (formNow !== this.formWas) {
      if (run.state === 'playing') { this.burst(this.ball.x, this.ball.y, 26, FORM_COL[formNow], r0 * 1.6); this.wave(this.ball.r || r0, FORM_COL[formNow], r0 * 3, 4, 0.6, 0.5); }
      this.formWas = formNow;
    }
    { const w = 24, sdt = Math.min(dt, 0.02); this.zoomV += (w * w * (this.zoomKick - this.zoomS) - 2 * w * this.zoomV) * sdt; this.zoomS += this.zoomV * sdt; }
    this.zoomKick = Math.max(0, this.zoomKick - dt / 0.9) * (1 - Math.min(1, dt * 1.5));
    this.flash = Math.max(0, this.flash - dt / 0.18);
    this.flipK = Math.max(0, this.flipK - dt / 0.11);
    this.burstK = Math.max(0, this.burstK - dt / 0.16);
    this.coreFlare = Math.max(0, this.coreFlare - dt / 0.55);
    this.glitch = Math.max(0, this.glitch - dt);
    this.strobe = Math.max(0, this.strobe - dt / 0.12);
    this.ringFlash = Math.max(0, this.ringFlash - dt / 0.3);
    this.landPulse = Math.max(0, this.landPulse - dt / 0.12);
    this.shake = Math.max(0, this.shake - dt / 0.3);
    this.dropAge += dt;
    const twinNow = course.twins.some(([a, z]) => beat >= a - 1 && beat < z + 0.25);
    this.twinV += ((twinNow ? 1 : 0) - this.twinV) * Math.min(1, dt * 5);
    if (run.state === 'playing') {
      this.trail.push({ beat, rho: this.ballRho(sim, beat), off: sim.sideAt(beat) * rb * (1 - 0.3 * 4 * this.landPulse * (1 - this.landPulse)), pf: this.pf, away: run.finale ? Math.pow(Math.min(1.4, run.finaleAge / 0.9), 2.2) * r0 * 7 : 0 });
      while (this.trail.length > (this.look === 2 ? 9 : 30)) this.trail.shift();
    }

    // ---- behind the course: backdrop, flashes, beams, shockwaves, shards
    this.woke = afterDrop ? (beat - course.dropBeat) * level.spb : -1;
    this.strike = Math.max(0, this.strike - dt * 3.2);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.background(pal, now / 1000, dt, inten, groove, this.dark, drive, kick);
    const soft = calm || save.reduceFlash; // (softer flashes and shake: the accessibility setting)
    if (this.flash > 0 && !this.plain) { c.fillStyle = `rgba(255,255,255,${this.flash * (soft ? 0.08 : 0.26)})`; c.fillRect(0, 0, this.w, this.h); }
    if (this.strobe > 0.01 && !this.plain) { c.fillStyle = this.col(pal.acc, this.strobe * (soft ? 0.03 : 0.09)); c.fillRect(0, 0, this.w, this.h); }
    c.save();
    let cx = this.w / 2;
    let cy = this.h * 0.52;
    // the drop shakes the picture: a quick sway that dies away, not a new random place every frame
    if (this.shake > 0) { const sh = 4 * this.shake * (1 - this.shake) * 5 * (soft ? 0.25 : 1); cx += Math.sin(now * 0.031) * sh; cy += Math.sin(now * 0.026 + 1) * sh; }
    if (this.dropPower >= 0.3 && this.dropAge < 1.2 && !soft) cx += Math.exp(-this.dropAge * 4) * Math.sin(this.dropAge * 10) * m * 0.045 * this.dropPower; // the launch swings the camera
    c.translate(cx, cy);
    // the camera (the cinematic pass): a slow orbit round the planet while a drop is going, and a quick whip when the
    // mode changes (on the gift's bar, which is played for him: no tap is ever under a whip)
    { const lens = course.lenses.filter((l) => l.beat <= beat).length; if (lens !== this.lensSeen) { if (lens > this.lensSeen && this.lensSeen >= 0) this.whipAt = now; this.lensSeen = lens; } }
    this.orbitK += ((drive > 0.3 && !soft ? 1 : 0) - this.orbitK) * Math.min(1, dt * 0.8);
    const whip = soft ? 0 : 0.09 * Math.exp(-(now - this.whipAt) / 220) * Math.sin(Math.min(1, (now - this.whipAt) / 220) * Math.PI);
    c.rotate(0.05 * Math.sin(now / 1000 * 0.32) * this.orbitK + whip);
    c.scale(this.mx, this.my);

    // the other planets nearby: a small glowing core each, so you can see where a planet hop is going
    // (only the one a planet hop is about to go to, or has just left)
    const soon = course.presses.slice(sim.ni, sim.ni + 3).find((p) => p.sling && p.beat - beat < 3);
    const flying = lastP?.sling && sim.mode === 'flight' ? lastP : null;
    for (let k = Math.max(0, Math.floor(this.pf) - 1); k <= Math.floor(this.pf) + 2 && !this.geo; k++) {
      if (Math.abs(k - this.pf) < 0.5 || !(soon?.planetTo === k || flying?.planet === k || flying?.planetTo === k)) continue;
      const [px, py] = this.planetXY(k);
      const g = c.createRadialGradient(px - this.camX, py - this.camY, 0, px - this.camX, py - this.camY, m * 0.09);
      g.addColorStop(0, this.col(pal.ring, 0.55));
      g.addColorStop(1, this.col(pal.ring, 0));
      c.fillStyle = g;
      c.beginPath(); c.arc(px - this.camX, py - this.camY, m * 0.09, 0, TWO_PI); c.fill();
    }
    c.translate(this.coreX, this.coreY);
    const chargeShown = afterDrop ? this.chargeV * clamp(1 - this.dropAge / 0.35, 0, 1) : course.charges.length && beat > course.charges[0][0] - 4 ? Math.max(this.chargeV, 0.006) : 0;
    { const t2 = c.getTransform(), k2 = this.canvas.width / Math.max(1, this.w); this.coreAt = [t2.e / k2, t2.f / k2]; }
    if (this.look === 2 && this.planet) {
      // the planet itself, just under the innermost ring the course uses nearby (eased, so a hop never jolts it)
      // (one size, just under the base ring: the course climbs away from it and comes back, the world stays put)
      const Rt = Math.max(m * 0.16, this.r0 * 0.84);
      this.worldR = this.worldR > 0 ? this.worldR + (Rt - this.worldR) * Math.min(1, dt * 3) : Rt;
      this.planet.draw(c, this.worldR, { time: now / 1000, song: t, drive: this.plain ? 0 : drive, kick, strike: this.strike, calm, pf: this.pf, unit: this.rad(this.cam),
        // (the journey: where each place is from here, and a point on its path, so the world can paint every place in view)
        rel: (k: number) => { const [x, y] = this.planetXY(k), [x0, y0] = this.planetXY(this.pf); return [x - x0, y - y0]; },
        along: this.geo ? (k: number, a: number, r: number) => { const p = this.locK(k, a, r); return [p[0], p[1]]; } : undefined, span: this.geo ? (k: number) => this.geo!.span[k] ?? [0, 0] : undefined, wide: this.w >= this.h,
        at: (b: number) => { const h = course.at(b), [x, y] = this.wxy(h.planet, -Math.PI / 2 + course.angle(b), this.rad(h.rho) + h.side * this.rb); return [x - this.coreX, y - this.coreY]; },
        up: (b: number) => this.upA(course.at(b).planet, -Math.PI / 2 + course.angle(b)), presses: course.presses, done: sim.ni, rb: this.rb, origin: [cx + this.coreX, cy + this.coreY], beat });
    } else this.core(pal, m * 0.045, m * 0.04 * (0.4 + 1.1 * inten) * (1 + wound * 0.7 + drive * 0.5), kick * (0.3 + 0.7 * inten), snare * inten, dt, this.flowV, chargeShown, this.plain ? 0 : drive, span, PLANETS[level.file.side?.of ?? level.id]?.rgb, !!level.file.side);
    if (this.look === 2 && !this.planet) { // (the second look: the core is scenery, and steps back; nothing bright sits in the middle of the course)
      const va = 0.6 * (1 - 0.85 * this.coreFlare), vr = m * 0.12;
      const veil = c.createRadialGradient(0, 0, 0, 0, 0, vr); veil.addColorStop(0, `rgba(12,10,28,${va})`); veil.addColorStop(0.45, `rgba(12,10,28,${va * 0.8})`); veil.addColorStop(1, 'rgba(12,10,28,0)');
      c.fillStyle = veil; c.beginPath(); c.arc(0, 0, vr, 0, TWO_PI); c.fill();
    }

    for (let i = this.waves.length - 1; i >= 0; i--) {
      const wv = this.waves[i];
      wv.life += dt;
      if (wv.life >= wv.max) { this.waves.splice(i, 1); continue; }
      wv.r += wv.v * dt;
      const u = wv.life / wv.max;
      c.strokeStyle = rgba(wv.col, (1 - u) * wv.a);
      c.lineWidth = wv.w * (1 - u * 0.6);
      c.beginPath(); c.arc(0, 0, wv.r, 0, TWO_PI); c.stroke();
    }
    c.translate(-this.coreX, -this.coreY);
    this.drawParticles(dt, true);
    if (this.glitch > 0 && !calm && !this.plain && !this.backdrop && this.canvas.width > 0 && this.canvas.height > 0) { // (a painted sky is never torn)
      // the glitch tears only what has been drawn so far, which is all background
      c.save();
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      for (const [y, hgt, dx] of this.bands) {
        const sy = Math.min(this.canvas.height - 2, Math.round(y * this.dpr));
        const sh = Math.max(1, Math.min(this.canvas.height - sy, Math.round(hgt * this.dpr)));
        try { c.drawImage(this.canvas, 0, sy, this.canvas.width, sh, dx, sy / this.dpr, this.w, sh / this.dpr); } catch { /* a canvas with no size yet: nothing to tear */ }
      }
      c.restore();
    }
    // a dark band under the play area, deeper the wilder the backdrop gets: the course always sits on a calm ground
    const reach = r0 * 3.3;
    const dim = c.createRadialGradient(this.coreX, this.coreY, r0 * 0.4, this.coreX, this.coreY, reach);
    // (over a painted sky in the one-signal look the sky keeps its own soft veil, so this is light and has no edge:
    // two darks stacked read as a disc behind the orbit)
    const veiled = this.look === 2 && !!this.backdrop;
    const deep = veiled ? 0.16 + 0.12 * drive : 0.32 + 0.4 * Math.max(drive, this.colour);
    dim.addColorStop(0, 'rgba(4,5,12,0)');
    dim.addColorStop(0.16, `rgba(4,5,12,${deep})`);
    if (veiled) { dim.addColorStop(0.45, `rgba(4,5,12,${deep})`); dim.addColorStop(0.75, `rgba(4,5,12,${deep * 0.35})`); }
    else dim.addColorStop(0.74, `rgba(4,5,12,${deep})`);
    dim.addColorStop(1, 'rgba(4,5,12,0)');
    c.fillStyle = dim;
    c.beginPath(); c.arc(this.coreX, this.coreY, reach, 0, TWO_PI); c.fill();

    // ---- the course, on top of all of that: rings, marks, flow notes, the ball. Nothing below here changes colour.
    const dropStyle = afterDrop && this.dropPower >= 0.3;
    this.drawSide(run, false, beat, pal, kick, dropStyle, now / 1000, skin, dt);
    if (this.twinV > 0.5) {
      // twin orbit: a second ball, mirrored left to right. One tap moves both; each mark is on one ball's ring or on both.
      c.save();
      c.translate(2 * this.coreX, 0);
      c.scale(-1, 1);
      // (in dual mode the second spark is a Pulsar on a ring of its own: it flips sides on every tap)
      if (course.duals.some(([a, z]) => beat >= a - 1 && beat < z + 0.25)) this.drawEcho(run, beat, this.twinIs === 'helion' ? [255, 200, 120] : [150, 190, 240]); // (Helion's gold, or soft blue: no violet; 2026-11-26)
      else this.drawSide(run, true, beat, pal, kick, dropStyle, now / 1000, this.twinIs === 'helion' ? [255, 200, 120] : [150, 190, 240], dt);
      c.restore();
    }

    for (const r of this.ripples) {
      r.age += dt;
      const u = r.age / 0.28;
      if (u >= 1) continue;
      c.strokeStyle = rgba(r.col, (1 - u) * 0.8);
      c.lineWidth = 2;
      c.beginPath(); c.arc(r.x, r.y, rb * (1.2 + u * 2.6), 0, TWO_PI); c.stroke();
    }
    this.drawParticles(dt, false);

    if (this.windows && run.lights.length) this.drawWindows(run, beat);
    // short hints near the core, out of the ball's way: the latest one that applies
    // a star trail coming up says so, until that star has been kept
    const ahead = course.stars.find((st) => sim.stars[st.i] === 0 && beat >= st.a - 5 && beat <= st.a + 1 && !starsFor(level.id)[st.i]);
    if (run.state !== 'loading' && (!bestFor(level.id).cleared || run.opts.practice || ahead)) {
      let shown: [number, number, string] | null = null;
      // (a B-side explains nothing: whoever found it has cleared the level it is the night side of)
      if ((!bestFor(level.id).cleared || run.opts.practice) && !level.file.side) for (const hnt of this.hints) if (beat >= hnt[0] && beat <= hnt[1]) shown = hnt;
      if (ahead && !run.opts.tutorial && this.look !== 2) shown = [ahead.a - 5, ahead.a + 1, 'shard branch: all the gold, no extra taps'];
      if (shown) {
        const al = Math.min(1, (beat - Math.max(shown[0], run.startAt / level.spb - 4)) / 0.5, (shown[1] - beat) / 0.5);
        // the star trail's line sits under the three stars at the top of the screen, clear of the course
        const star = !!ahead && shown[2].startsWith('shard');
        this.text(shown[2], star ? 0 : this.coreX, star ? this.h * 0.185 - this.h * 0.52 : this.coreY - m * 0.045 * 1.2 - m * 0.04 * 1.5 - 30, clamp(m * 0.022, 10, 16), star ? STAR : WHITE, clamp(al, 0, 1));
      }
    }
    if (run.state === 'resuming') this.text(String(Math.max(1, Math.ceil((run.resumeAt - now) / 400))), this.coreX, this.coreY + m * 0.16, m * 0.06, WHITE, 1);
    if (run.state === 'loading') this.text('loading', this.coreX, this.coreY + m * 0.16, clamp(m * 0.024, 11, 17), WHITE, 0.8);
    c.restore();
    if (save.tapLog) this.drawTapLog(run);
  }

  /** The tap log (for testing; settings): the last taps, when each came (song time) and how it was judged. */
  private drawTapLog(run: GdRun): void {
    const c = this.ctx, L = run.sim.log.slice(-8), spb = run.course.spb, x = 10, y0 = this.h - 30 - L.length * 15;
    c.save(); c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = 'rgba(4,4,12,0.72)'; c.fillRect(x - 6, y0 - 16, Math.min(this.w - 8, 370), L.length * 15 + 22);
    c.font = '11px ui-monospace, Menlo, monospace'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.fillStyle = 'rgba(255,240,210,0.7)'; c.fillText(`tap log, now ${(run.time).toFixed(2)} s`, x, y0 - 3);
    L.forEach((l, i) => { const bad = /wasted|ignored|MASH|hit the ring/.test(l.what); c.fillStyle = bad ? 'rgba(255,160,120,0.95)' : 'rgba(220,235,255,0.92)'; c.fillText(`${(l.beat * spb).toFixed(2)} s  ${l.what}${Number.isFinite(l.press) ? ` (next mark ${(l.press * spb).toFixed(2)})` : ''}`, x, y0 + 12 + i * 15); });
    c.restore();
  }

  /** The menus choose the idle scene's palette (the focused level's) and where its centre sits (fractions of the screen). */
  idlePal = 'deep';
  idleAt: [number, number] = [0.5, 0.5];
  /** Where the ball was last drawn, in screen pixels. Read by the smoothness check (tools/smooth-check.mjs). */
  ballXY: [number, number] = [0, 0];
  /** Size of the menu scene, 1 = its usual size; the title screen fits it between the wordmark and the call to start. */
  idleScale = 1;
  /** backdrop only: no core, rings or ball */
  idleBare = false;
  private idleS = 1;
  private idleX = 0.5;
  private idleY = 0.5;
  private idleMix: Palette = PALETTES.deep;

  /** Idle picture behind the menus: a living orbit with the equalizer at its core. */
  drawIdle(now: number, dt = 0.016): void {
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drain = 0;
    this.colour = this.idleColour;
    const kI = this.idleColour;
    const to: Palette = this.idlePal === 'lantern' ? { bg0: mix([26, 26, 46], [96, 52, 104], kI), bg1: mix([9, 10, 20], [20, 12, 40], kI), ring: mix(ATLAS_INK, [255, 214, 160], kI), acc: mix(GOLD, [255, 226, 180], kI) } : PALETTES[this.idlePal] || PALETTES.deep;
    const k = Math.min(1, dt * 3);
    this.idleMix = { bg0: mix(this.idleMix.bg0, to.bg0, k), bg1: mix(this.idleMix.bg1, to.bg1, k), ring: mix(this.idleMix.ring, to.ring, k), acc: mix(this.idleMix.acc, to.acc, k) };
    const pal = this.idleMix;
    this.idleX += (this.idleAt[0] - this.idleX) * Math.min(1, dt * 4);
    this.idleY += (this.idleAt[1] - this.idleY) * Math.min(1, dt * 4);
    this.idleS += (this.idleScale - this.idleS) * Math.min(1, dt * 4);
    // the scene listens: when music is playing its bass drives the pulse; in silence a steady beat does
    const bass = (this.eq[0] + this.eq[1] + this.eq[2] + this.eq[EQ_BARS - 1]) / 4;
    const steady = Math.exp(-(((now / 1000) * 2) % 1) * 4) * 0.4;
    const pulse = Math.max(steady * (bass > 0.05 ? 0.3 : 1), Math.min(1, bass * 1.3));
    this.background(pal, now / 1000, dt, 0.5, pulse * 0.25, 0, 0, 0);
    const m = Math.min(this.w, this.h) * this.idleS;
    if (this.idleBare) return; // the world map draws its own planets over the backdrop
    c.save();
    c.translate(this.w * this.idleX, this.h * this.idleY);
    this.core(pal, m * 0.06, m * 0.07, pulse, pulse * 0.5, dt, -1, 0, 0, 0);
    for (let n = 0; n < 4; n++) {
      c.lineWidth = n === 0 ? 3 : 2;
      c.strokeStyle = this.col(pal.ring, 0.42 - n * 0.09);
      c.beginPath(); c.arc(0, 0, m * (0.22 + n * 0.075) * (1 + pulse * 0.015 * (n + 1)), 0, TWO_PI); c.stroke();
    }
    // the ball climbs a ring every half turn, then drops back
    const turn = (now / 5200) % 1;
    const step = Math.floor(turn * 4) % 3;
    const u = smooth(((turn * 4) % 1) * 3);
    const lv = step === 2 ? 2 - 2 * u : step + u;
    const a = -Math.PI / 2 + turn * TWO_PI * 2;
    const r = m * (0.22 + lv * 0.075) + m * 0.016;
    c.lineCap = 'round';
    for (let n = 1; n <= 10; n++) {
      const b = a - n * 0.035;
      c.strokeStyle = rgba(orbColour(save.skin), 0.4 * (1 - n / 10));
      c.lineWidth = m * 0.02 * (1 - n / 11);
      c.beginPath(); c.moveTo(Math.cos(b) * r, Math.sin(b) * r); c.lineTo(Math.cos(b + 0.035) * r, Math.sin(b + 0.035) * r); c.stroke();
    }
    c.lineCap = 'butt';
    this.drawBall(Math.cos(a) * r, Math.sin(a) * r, m * 0.016, orbColour(save.skin));
    c.restore();
  }

  /** Ball crossing a mark at the top of a ring; used by the visual-offset calibration. */
  drawMetronome(now: number, phase: number): void {
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drain = 0;
    const pal = PALETTES.deep;
    this.background(pal, now / 1000, 0.016, 0.4, 0, 0, 0, 0);
    const cx = this.w / 2;
    const cy = this.h * 0.36;
    const R = Math.min(this.w, this.h) * 0.2;
    c.lineWidth = 3;
    c.strokeStyle = rgba(pal.ring, 0.5);
    c.beginPath(); c.arc(cx, cy, R, 0, TWO_PI); c.stroke();
    c.lineCap = 'round';
    c.lineWidth = 5;
    c.strokeStyle = '#ffffff';
    c.beginPath(); c.moveTo(cx, cy - R * 0.87); c.lineTo(cx, cy - R * 1.13); c.stroke();
    c.lineCap = 'butt';
    const a = -Math.PI / 2 + phase * TWO_PI;
    this.drawBall(cx + Math.cos(a) * (R + R * 0.1), cy + Math.sin(a) * (R + R * 0.1), R * 0.1, CYAN);
  }
}

/** Turns the presses into the rings the ball meets, in order. */
function platforms(c: Course, level: Level): Platform[] {
  const ps = c.presses;
  const out: Platform[] = [];
  for (let j = 0; j <= ps.length; j++) {
    const p = ps[j];
    const prev = ps[j - 1];
    const lv = p ? p.from : prev ? prev.to : 0;
    const side = p ? p.side : prev ? (prev.kind === 'flip' ? -prev.side : prev.side) : 1;
    const fs = prev ? prev.land - (prev.bounce && p ? p.tol * 0.85 : 0.1) : c.start - 16;
    const fe = p ? p.beat + p.tol : c.end + 16;
    let cs = Infinity;
    let ce = -Infinity;
    // (the Comet shows its climb as a rail, so the ring above it is not also drawn closed: one thing to read, not three)
    if (prev && !prev.auto && !prev.sling && prev.from !== prev.to && !(p && p.chime) && prev.form !== 'comet') {
      // while the ball rides the ring before, this ring is the ceiling above it, up to the opening over the note
      // (a launch the game takes itself has none, and a slingshot's landing ring is far off)
      const before = out[j - 1];
      cs = Math.max(prev.beat - LOOK, before.fs);
      ce = prev.beat - prev.tol * (prev.kind === 'flip' ? 0.85 : 0.9);
    }
    const inTwin = c.twins.some(([a, z]) => (p ? p.beat : fs) >= a && (p ? p.beat : fs) < z);
    out.push({
      lv, side, fs, fe, cs, ce, note: p ? p.beat : NaN, tol: p ? p.tol : 0, auto: !!p && p.auto, smash: !!p && p.smash, accent: !!p && p.accent, sling: !!p && p.sling, after: !!p && p.after,
      twin: p ? p.twin : inTwin ? 'both' : null,
      planet: p ? p.planet : prev ? prev.planetTo : 0,
      spinAt: prev && prev.spin ? prev.beat : NaN, spinTol: prev ? prev.tol : 0, enterSide: prev ? prev.side : 1,
      form: p ? p.form : 'orb', act: p ? p.act : 'tap', pad: p ? p.pad : '', wide: !!p && p.wide, chime: !!p && p.chime, orb: p ? p.orb : '', noCeil: !!prev && prev.from === prev.to,
      // the violet "gravity turns over" stretch is for the Orb's flips and the Pulsar; the Satellite and the Comet cross by their nature
      flipAt: prev && prev.kind === 'flip' && prev.form !== 'sat' && prev.form !== 'comet' ? prev.beat : NaN, flipTol: prev ? prev.tol : 0,
      pulse: !!level.segAt(((p ? p.beat : c.end) + 1e-6) * c.spb).core?.pulse
    });
  }
  return out;
}

/** Measured energy of each bar, 0..1: the kick and snare strengths baked into the chart, averaged and lightly smoothed. */
function barEnergy(level: Level): number[] {
  const bars = Math.ceil(level.totalBeats / 4);
  const raw: number[] = [];
  for (let b = 0; b < bars; b++) {
    let sum = 0;
    for (let i = 0; i < 16; i++) {
      const t = (b * 4 + i / 4 + 0.01) * level.spb;
      sum += level.energyAt('kick', t) + 0.5 * level.energyAt('snare', t);
    }
    raw.push(sum / 16);
  }
  const top = Math.max(0.001, ...raw);
  const norm = raw.map((v) => v / top);
  return norm.map((v, i) => (norm[Math.max(0, i - 1)] + 2 * v + norm[Math.min(bars - 1, i + 1)]) / 4);
}
