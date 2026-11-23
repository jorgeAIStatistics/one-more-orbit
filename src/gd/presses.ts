// Where the notes come from. Bars recorded by hand (Record Mode) win over the generated chart and are never
// overwritten by the tools; every other bar falls back to the chart's notes, split into layers automatically.
import type { LevelPack } from '../game/packs';
import { autoLayers, type Layers } from './course';

/** One hand-recorded bar: `t` are the survival presses, `f` the flow notes, as ticks inside the bar (12 per beat). */
export interface HandBar { by: 'hand'; t: number[]; f?: number[] }
export interface PressFile { _doc?: string; bars: Record<string, HandBar> }

const TICKS = 48; // per bar
const key = (id: string) => `omo_presses_${id}`;
const store = new Map<string, PressFile>();
const DOC = 'Notes recorded by hand in Record Mode. Per bar: t = survival presses, f = flow notes, as ticks inside the bar (12 per beat). The tools never overwrite this file.';

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

/** Both layers as ticks (12 per beat, from the start of the level): hand bars where they exist, the chart elsewhere. */
export function layerTicks(pack: LevelPack): { survival: number[]; flow: number[] } {
  const hand = handBars(pack).bars;
  const auto = autoLayers(pack.chart.notes.map((n) => n.t / 12));
  const isHand = (tick: number) => !!hand[String(Math.floor(tick / TICKS))];
  const survival = auto.survival.map((b) => Math.round(b * 12)).filter((t) => !isHand(t));
  const flow = auto.flow.map((b) => Math.round(b * 12)).filter((t) => !isHand(t));
  for (const [bar, b] of Object.entries(hand)) {
    for (const t of b.t) survival.push(Number(bar) * TICKS + t);
    for (const t of b.f ?? []) if (!b.t.includes(t)) flow.push(Number(bar) * TICKS + t);
  }
  const sort = (a: number[]) => [...new Set(a)].sort((x, y) => x - y);
  return { survival: sort(survival), flow: sort(flow) };
}

/** The layers in beats, ready for the course builder. */
export function layers(pack: LevelPack): Layers {
  const t = layerTicks(pack);
  return { survival: t.survival.map((x) => x / 12), flow: t.flow.map((x) => x / 12) };
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

/** Sets a bar's notes by hand (ticks inside the bar), or hands it back to the generated chart with null. */
export function setBar(pack: LevelPack, bar: number, notes: { t: number[]; f: number[] } | null): void {
  const file = handBars(pack);
  if (notes === null) { delete file.bars[String(bar)]; return; }
  const clean = (a: number[]) => [...new Set(a)].filter((t) => t >= 0 && t < TICKS).sort((x, y) => x - y);
  const t = clean(notes.t);
  file.bars[String(bar)] = { by: 'hand', t, f: clean(notes.f).filter((x) => !t.includes(x)) };
}

/** Saves to the level folder through the dev server; without one, keeps the bars in this browser. */
export async function saveBars(pack: LevelPack): Promise<'file' | 'browser'> {
  const id = pack.level.id;
  const body = JSON.stringify({ _doc: DOC, bars: handBars(pack).bars }, null, 1);
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

export const exportBars = (pack: LevelPack) => JSON.stringify({ _doc: DOC, bars: handBars(pack).bars }, null, 1);
