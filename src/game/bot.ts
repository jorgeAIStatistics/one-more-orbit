import type { RNote, Side } from './types';
import type { Level } from './level';

export interface BotEvent {
  t: number;
  down: boolean;
  side: Side;
}

/** The inputs a perfect player would make: every tap, hold, lane hop and spin exactly on time. */
export function botEvents(level: Level, notes: RNote[]): BotEvent[] {
  const ev: BotEvent[] = [];
  const holds: Record<Side, Array<[number, number]>> = { L: [], R: [] };
  const sideOf = (n: RNote): Side => (n.hand === 'R' ? 'R' : 'L');
  for (const n of notes) if (n.kind === 'hold') holds[sideOf(n)].push([n.t, n.t1]);
  const busy = (s: Side, t: number) => holds[s].some(([a, b]) => t >= a - 0.02 && t <= b + 0.02);
  const lastUp: Record<Side, number> = { L: -1, R: -1 };

  const press: RNote[] = notes.filter((n) => n.kind === 'tap' || n.kind === 'hold');
  press.forEach((n, i) => {
    let side = sideOf(n);
    if (n.kind === 'hold') {
      ev.push({ t: n.t, down: true, side }, { t: n.t1, down: false, side });
      return;
    }
    if (n.hand === 'A' && busy(side, n.t)) side = 'R';
    let next = Infinity;
    for (let j = i + 1; j < press.length; j++) if (press[j].t > n.t && (press[j].hand === 'A' || sideOf(press[j]) === side)) { next = press[j].t; break; }
    const up = n.t + Math.min(0.03, (next - n.t) / 2);
    ev.push({ t: n.t, down: true, side }, { t: up, down: false, side });
    lastUp[side] = up;
  });

  for (const seg of level.segments) {
    if (seg.mode !== 'dodge') continue;
    let lane = 0;
    let prev = seg.t0;
    for (const h of notes) {
      if (h.kind !== 'haz' || h.seg !== seg.index) continue;
      if (lane === h.lane) {
        const t = (prev + h.t) / 2;
        ev.push({ t, down: true, side: 'L' }, { t: t + 0.02, down: false, side: 'L' });
        lane ^= 1;
      }
      prev = h.t;
    }
  }

  for (const s of notes) {
    if (s.kind !== 'spin') continue;
    const n = s.need + 1;
    for (let i = 0; i < n; i++) {
      const t = s.t + ((i + 0.5) * (s.t1 - s.t)) / n;
      const side: Side = i % 2 ? 'R' : 'L';
      ev.push({ t, down: true, side }, { t: t + 0.015, down: false, side });
    }
  }

  // releases before presses at the same instant, so a side is never pressed twice
  ev.sort((a, b) => a.t - b.t || Number(a.down) - Number(b.down));
  return ev;
}
