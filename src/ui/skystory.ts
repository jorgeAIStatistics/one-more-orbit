// The story, Afterglow: painted scenes that fill the screen, with the words written into them. No card, no dots, no
// buttons. A scene is painted once when it is shown; the words fade in a sentence at a time; a small spark under the
// last line says a tap will go on. A tap before that brings all the words in at once. "skip" is one quiet word.
import { STORIES } from '../art/storypaint.js';

const SERIF = '"Cormorant Garamond", "Hoefler Text", Baskerville, Palatino, Georgia, serif';
const smooth = (x: number) => { const t = x < 0 ? 0 : x > 1 ? 1 : x; return t * t * (3 - 2 * t); };
interface Block { x: number; y: number; w: number; align: CanvasTextAlign; size: number; band?: boolean }

export class SkyStory {
  private ctx: CanvasRenderingContext2D;
  private pic: HTMLCanvasElement | null = null;
  private was: HTMLCanvasElement | null = null;
  private scene = '';
  private sentences: string[] = [];
  private t0 = 0;       // when this scene's words began
  private tIn = 0;      // when this scene's picture began to fade in
  private all = false;  // every sentence brought in by a tap
  private now = 0;
  private many = false;
  private key = '';

  constructor(private canvas: HTMLCanvasElement) { this.ctx = canvas.getContext('2d')!; }

  private dev(): 'phone' | 'desktop' { return window.innerWidth > window.innerHeight * 1.15 ? 'desktop' : 'phone'; }

  /** Shows a scene with its words. `many`: it is one of several, so the quiet "skip" is offered. */
  show(scene: string, text: string, many: boolean): void {
    this.was = this.pic;
    this.scene = STORIES.SCENES[scene] ? scene : 'lantern';
    this.sentences = (text.match(/[^.?!]+[.?!]+\s*/g) ?? [text]).map((s) => s.trim());
    this.many = many;
    this.all = false;
    this.key = '';
    this.paint();
    this.tIn = this.t0 = this.now;
  }
  private paint(): void {
    const w = window.innerWidth, h = window.innerHeight, dev = this.dev();
    this.key = `${this.scene}:${w}x${h}`;
    // painted at screen size (not at the device's finer grain): quick to make, and soft the way paint is
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    STORIES.draw(cv.getContext('2d')!, w, h, this.scene, dev, -1, dev === 'phone' ? Math.min(w / 390, h / 844) : Math.min(w / 1440, h / 900) * 1.15);
    this.pic = cv;
  }
  /** How many sentences are fully in, and how far the next one is. */
  private progress(): [number, number] {
    if (this.all) return [this.sentences.length, 0];
    const t = this.now - this.t0 - 0.45, per = 1.15;
    if (t < 0) return [0, 0];
    const n = Math.floor(t / per);
    return [Math.min(this.sentences.length, n + (t - n * per >= 0.6 ? 1 : 0)), n >= this.sentences.length ? 0 : Math.min(1, (t - n * per) / 0.6)];
  }
  get ready(): boolean { return this.progress()[0] >= this.sentences.length; }

  /** A tap at screen x, y: "skip" on the quiet word, "next" when the words are all there, otherwise the words come in at once. */
  tap(x: number, y: number): 'skip' | 'next' | 'more' {
    if (this.many && x > window.innerWidth - 96 && y < 70) return 'skip';
    if (this.ready) return 'next';
    this.all = true;
    return 'more';
  }

  draw(now: number): void {
    this.now = now / 1000;
    const w = window.innerWidth, h = window.innerHeight, c = this.ctx, dpr = this.canvas.width / Math.max(1, w);
    if (this.key !== `${this.scene}:${w}x${h}`) this.paint(); // the screen turned or changed size
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const a = smooth((this.now - this.tIn) / 0.45);
    if (this.was && a < 1) c.drawImage(this.was, 0, 0, w, h); else { c.fillStyle = '#08071c'; c.fillRect(0, 0, w, h); }
    if (this.pic) { c.globalAlpha = this.was ? a : Math.max(a, 0.02); c.drawImage(this.pic, 0, 0, w, h); c.globalAlpha = 1; }
    if (a >= 1) this.was = null;
    const dev = this.dev(), B = STORIES.SCENES[this.scene][dev].B as Block, u = dev === 'phone' ? Math.min(w / 390, h / 844) : Math.min(w / 1440, h / 900) * 1.15;
    const size = Math.max(18, B.size * u * (dev === 'phone' ? 1.04 : 1));
    // the picture darkens where the words go: low in it, toward the bottom; higher up, only the air round them. Never a panel.
    if (B.band === false) { const g = c.createRadialGradient(w * (B.x + B.w * 0.45), h * (B.y + 0.07), 0, w * (B.x + B.w * 0.45), h * (B.y + 0.07), w * B.w * 0.95); g.addColorStop(0, `rgba(8,6,22,${0.62 * a})`); g.addColorStop(1, 'rgba(8,6,22,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }
    else { const g = c.createLinearGradient(0, h * (B.y - 0.14), 0, h); g.addColorStop(0, 'rgba(8,6,22,0)'); g.addColorStop(0.45, `rgba(8,6,22,${0.6 * a})`); g.addColorStop(1, `rgba(8,6,22,${0.86 * a})`); c.fillStyle = g; c.fillRect(0, h * (B.y - 0.14), w, h); }
    c.font = `italic 500 ${size}px ${SERIF}`;
    c.textAlign = B.align; c.textBaseline = 'alphabetic';
    c.shadowColor = 'rgba(8,6,22,0.8)'; c.shadowBlur = size * 0.4;
    const [full, part] = this.progress();
    let y = h * B.y;
    const lineH = size * 1.4;
    this.sentences.forEach((sen, si) => {
      const al = si < full ? 1 : si === full ? smooth(part) : 0;
      let line = '';
      const flush = () => { if (line.trim()) { if (al > 0) { c.fillStyle = `rgba(255,241,216,${0.97 * al})`; c.fillText(line.trim(), w * B.x, y + (1 - al) * 6); } y += lineH; } line = ''; };
      for (const word of sen.split(' ')) { if (c.measureText(line + word).width > w * B.w && line) flush(); line += `${word} `; }
      flush();
      y += size * 0.3;
    });
    c.shadowBlur = 0;
    if (full >= this.sentences.length) { // a small spark under the last line: a tap will go on
      const sx = B.align === 'center' ? w * B.x : w * B.x + 6, sy = y + size * 0.5, p = 0.6 + 0.4 * Math.sin(this.now * 3);
      const g = c.createRadialGradient(sx, sy, 0, sx, sy, 16 * u); g.addColorStop(0, `rgba(255,214,150,${0.6 * p})`); g.addColorStop(1, 'rgba(255,214,150,0)'); c.fillStyle = g; c.fillRect(sx - 16 * u, sy - 16 * u, 32 * u, 32 * u);
      c.fillStyle = `rgba(255,244,220,${0.6 + 0.4 * p})`; c.beginPath(); c.arc(sx, sy, 2.4 * u, 0, Math.PI * 2); c.fill();
    }
    if (this.many) { c.font = `italic 500 16px ${SERIF}`; c.textAlign = 'right'; c.fillStyle = 'rgba(255,241,216,0.55)'; c.shadowColor = 'rgba(8,6,22,0.8)'; c.shadowBlur = 6; c.fillText('skip', w - 22, 40); c.shadowBlur = 0; }
  }
}
