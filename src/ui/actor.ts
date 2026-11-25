// A twin who moves: Orbin or Helion, held as a set of numbers (where he is, how he leans, his plume, his lids, each
// arm, his glow) that ease toward wherever a scene sends them. A scene only ever says "be like this now"; the
// easing, the blink and the breath are his own. Nothing here is drawn frame by frame.
import { CANON, type Arms, type ArmsName, type Eyes, type EyesName, type SparkOpts } from '../art/canonpaint.js';

export interface Pose {
  x?: number; y?: number; s?: number; rot?: number;
  glow?: number; lean?: number; crest?: number; beat?: number;
  look?: [number, number];
  eyes?: EyesName; arms?: ArmsName;
  face?: number; back?: boolean; ring?: boolean;
}
const ease = (v: number, to: number, k: number) => v + (to - v) * k;

export class Actor {
  x = 0; y = 0; s = 1; rot = 0;
  glow = 1; lean = 0; crest = 1; beat = 0.5;
  look: [number, number] = [0, 0];
  face = 1; back = false; ring = true;
  tint: number[] | null = null;
  private eyes: Eyes = { ...CANON.EYES.open };
  private arms: Arms = CANON.ARMS.rest.map((a) => a.map((p) => [...p]));
  private to: Required<Omit<Pose, 'face' | 'back' | 'ring'>> = { x: 0, y: 0, s: 1, rot: 0, glow: 1, lean: 0, crest: 1, beat: 0.5, look: [0, 0], eyes: 'open', arms: 'rest' };
  private blinkAt = 2.4;
  private blink = 0;
  private t = 0;
  /** how fast he gets where he is going, per second (a body is slower than a glance) */
  rate = 5;

  constructor(readonly who: 'orbin' | 'helion' = 'orbin') {}

  /** Be like this, from here on. `now`: no easing, he simply is (a cut). */
  set(p: Pose, now = false): this {
    const t = this.to;
    if (p.x !== undefined) t.x = p.x; if (p.y !== undefined) t.y = p.y; if (p.s !== undefined) t.s = p.s; if (p.rot !== undefined) t.rot = p.rot;
    if (p.glow !== undefined) t.glow = p.glow; if (p.lean !== undefined) t.lean = p.lean; if (p.crest !== undefined) t.crest = p.crest; if (p.beat !== undefined) t.beat = p.beat;
    if (p.look) t.look = p.look; if (p.eyes) t.eyes = p.eyes; if (p.arms) t.arms = p.arms;
    if (p.face !== undefined) this.face = p.face; if (p.back !== undefined) this.back = p.back; if (p.ring !== undefined) this.ring = p.ring;
    if (now) this.step(0, true);
    return this;
  }

  /** dt in seconds. */
  step(dt: number, snap = false): void {
    this.t += dt;
    const t = this.to;
    const k = snap ? 1 : 1 - Math.exp(-dt * this.rate), kf = snap ? 1 : 1 - Math.exp(-dt * this.rate * 2.2);
    this.x = ease(this.x, t.x, k); this.y = ease(this.y, t.y, k); this.s = ease(this.s, t.s, k); this.rot = ease(this.rot, t.rot, k);
    this.lean = ease(this.lean, t.lean, k); this.crest = ease(this.crest, t.crest, k * 0.7);
    this.glow = ease(this.glow, t.glow, kf); this.beat = ease(this.beat, t.beat, kf);
    this.look[0] = ease(this.look[0], t.look[0], kf); this.look[1] = ease(this.look[1], t.look[1], kf);
    const e = CANON.EYES[t.eyes];
    this.eyes.slant = ease(this.eyes.slant, e.slant, kf); this.eyes.open = ease(this.eyes.open, e.open, kf); this.eyes.big = ease(this.eyes.big, e.big, kf);
    const a = CANON.ARMS[t.arms];
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let c = 0; c < 2; c++) this.arms[i][j][c] = ease(this.arms[i][j][c], a[i][j][c], k * 1.3 > 1 ? 1 : k * 1.3);
    // he blinks, as anything alive does: quickly, and now and then twice
    if (this.t > this.blinkAt) { this.blink = 1; this.blinkAt = this.t + 2.2 + ((this.t * 7.31) % 1) * 3.4; }
    this.blink = Math.max(0, this.blink - dt * 7);
  }

  /** Draws him where he is. `o`: anything a scene wants to force for this frame (his glow flickering, say). */
  draw(ctx: CanvasRenderingContext2D, o: SparkOpts = {}): void {
    const breath = Math.sin(this.t * 1.7) * 2.2 * this.s;
    const opts: SparkOpts = { who: this.who, glow: this.glow, lean: this.lean, crest: this.crest, beat: this.beat, look: this.look, eyes: this.eyes, arms: this.arms, blink: this.blink > 0.5 ? 1 : 0, face: this.face, back: this.back, ring: this.ring, t: this.t, tint: this.tint, ...o };
    if (this.rot) { ctx.save(); ctx.translate(this.x, this.y + breath); ctx.rotate(this.rot); CANON.parts.spark(ctx, 0, 0, this.s, opts); ctx.restore(); }
    else CANON.parts.spark(ctx, this.x, this.y + breath, this.s, opts);
  }
}
