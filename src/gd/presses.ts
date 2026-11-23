// Where the press moments come from. Bars recorded by hand (Record Mode) win over the generated chart and are
// never overwritten by the tools; every other bar falls back to the chart's notes.
import type { LevelPack } from '../game/packs';

export interface HandBar { by: 'hand'; t: number[] } // ticks inside the bar, 12 per beat
export interface PressFile { _doc?: string; bars: Record<string, HandBar> }

const TICKS = 48; // per bar
const key = (id: string) => `omo_presses_${id}`;
const store = new Map<string, PressFile>();

/** The hand-recorded bars for a level: the file in its folder, unless this browser holds a newer unsaved copy. */
export function handBars(pack: LevelPack): PressFile {
  const id = pack.level.id;
  let f = store.get(id);
  if (!f) {
    f = { bars: { ...(pack.presses?.bars ?? {}) } };
    try {
      const raw = localStorage.getItem(key(id));
      if (raw) f = JSON.parse(raw) as PressFile;
    } catch { /* no storage */ }
    store.set(id, f);
  }
  return f;
}

/** Ticks (12 per beat, from the start of the level) of every press, bar by bar: hand bars where they exist. */
export function pressTicks(pack: LevelPack): number[] {
  const hand = handBars(pack).bars;
  const out: number[] = [];
  for (const n of pack.chart.notes) if (!hand[String(Math.floor(n.t / TICKS))]) out.push(n.t);
  for (const [bar, b] of Object.entries(hand)) for (const t of b.t) out.push(Number(bar) * TICKS + t);
  return [...new Set(out)].sort((a, b) => a - b);
}

/** MIDI pitch of the chart's note at (or right next to) a beat, so on-beat taps can play the hook. */
export function pitchLookup(pack: LevelPack): (beat: number) => number | null {
  const notes = pack.chart.notes.filter((n) => n.p != null && n.p > 0);
  return (beat) => {
    const t = beat * 12;
    let best: number | null = null;
    let dist = 3.1; // within a sixteenth
    for (const n of notes) { const d = Math.abs(n.t - t); if (d < dist) { dist = d; best = n.p as number; } }
    return best;
  };
}

export function setBar(pack: LevelPack, bar: number, ticks: number[] | null): void {
  const f = handBars(pack);
  if (ticks === null) delete f.bars[String(bar)];
  else f.bars[String(bar)] = { by: 'hand', t: [...new Set(ticks)].filter((t) => t >= 0 && t < TICKS).sort((a, b) => a - b) };
}

/** Saves to the level folder through the dev server; without one, keeps the bars in this browser. */
export async function saveBars(pack: LevelPack): Promise<'file' | 'browser'> {
  const id = pack.level.id;
  const f = handBars(pack);
  const body = JSON.stringify({ _doc: 'Press moments recorded by hand in Record Mode. Ticks inside each bar, 12 per beat. The tools never overwrite this file.', bars: f.bars }, null, 1);
  try {
    const r = await fetch(`/__presses/${id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
    if (r.ok) { try { localStorage.removeItem(key(id)); } catch { /* ignore */ } return 'file'; }
  } catch { /* no dev server */ }
  try { localStorage.setItem(key(id), body); } catch { /* ignore */ }
  return 'browser';
}

/** In dev, reads the file fresh from disk (the page is not reloaded when Record Mode saves). */
export async function refreshBars(pack: LevelPack): Promise<void> {
  try {
    const r = await fetch(`/__presses/${pack.level.id}`);
    if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) return;
    const f = (await r.json()) as PressFile;
    let local = false;
    try { local = !!localStorage.getItem(key(pack.level.id)); } catch { /* ignore */ }
    if (!local && f && f.bars) store.set(pack.level.id, { bars: f.bars });
  } catch { /* not the dev server */ }
}

export const exportBars = (pack: LevelPack) => JSON.stringify({ bars: handBars(pack).bars }, null, 1);
