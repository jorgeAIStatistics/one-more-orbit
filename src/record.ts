// Record Mode (a dev tool): play a section, tap along, and the taps, snapped to a grid, become the notes the course
// is built from. Each note is a survival press (can end the run) or a flow note (optional). Bars recorded here are
// marked "by: hand" and the tools never overwrite them.
import { audio } from './audio/audio';
import { Level } from './game/level';
import type { LevelPack } from './game/packs';
import { exportBars, handBars, layerTicks, saveBars, setBar } from './gd/presses';
import { save } from './save';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const BAR = 48; // ticks per bar (12 per beat)
const GRIDS: Record<string, { cells: number; name: string }> = { '4': { cells: 4, name: '1/4' }, '8': { cells: 8, name: '1/8' }, '16': { cells: 16, name: '1/16' }, t: { cells: 12, name: 'Triplets' } };
const RATES = [1, 0.75, 0.5];

interface Transport { mode: 'record' | 'listen'; t0: number; pos0: number; rate: number; end: number; music: { stop: (fade?: number) => void }; taps: number[] }

export function initRecord(deps: { pack: () => LevelPack; show: (screen: 'menu' | 'record') => void; play: (from: number) => void }) {
  let level: Level;
  let segs: Level['segments'] = [];
  let segIdx = 0;
  let rate = 1;
  let grid = '8';
  let layer: 'survival' | 'flow' = 'survival';
  let tr: Transport | null = null;
  let nowCell: HTMLElement | null = null;
  let dirty = false;

  const seg = () => segs[segIdx];
  const status = (s: string) => { $('recStatus').textContent = s; };

  /** A bar's notes in both layers, as ticks inside the bar. */
  function barNotes(bar: number): { t: number[]; f: number[] } {
    const all = layerTicks(deps.pack());
    const pick = (a: number[]) => a.filter((x) => x >= bar * BAR && x < (bar + 1) * BAR).map((x) => x - bar * BAR);
    return { t: pick(all.survival), f: pick(all.flow) };
  }
  const isCharge = () => !!seg().core?.charge;

  function renderControls(): void {
    const sel = $<HTMLSelectElement>('recSection');
    sel.innerHTML = '';
    segs.forEach((s, i) => {
      const o = document.createElement('option');
      o.value = String(i);
      const sec = Math.round(s.t0);
      o.textContent = `${s.label} · bars ${s.bar0 + 1}–${s.bar0 + s.bars} · ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
      sel.appendChild(o);
    });
    sel.value = String(segIdx);
    const speed = $('recSpeed');
    speed.innerHTML = '';
    for (const r of RATES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `pill toggle${r === rate ? ' on' : ''}`;
      b.textContent = `${Math.round(r * 100)}%`;
      b.addEventListener('click', () => { if (!tr) { rate = r; renderControls(); } });
      speed.appendChild(b);
    }
    const gr = $('recGridPick');
    gr.innerHTML = '';
    for (const [k, g] of Object.entries(GRIDS)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `pill toggle${k === grid ? ' on' : ''}`;
      b.textContent = g.name;
      b.addEventListener('click', () => { grid = k; renderControls(); renderGrid(); });
      gr.appendChild(b);
    }
    const lay = $('recLayer');
    lay.innerHTML = '';
    for (const [k, name] of [['survival', 'Survival presses'], ['flow', 'Flow notes']] as const) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `pill toggle${k === layer ? ' on' : ''} lay-${k}`;
      b.textContent = name;
      b.addEventListener('click', () => { if (!tr) { layer = k; renderControls(); } });
      lay.appendChild(b);
    }
    $('recRecord').textContent = tr?.mode === 'record' ? '■ STOP AND KEEP' : `● RECORD ${layer === 'survival' ? 'SURVIVAL PRESSES' : 'FLOW NOTES'}`;
    $('recListen').textContent = tr?.mode === 'listen' ? 'Stop' : 'Listen with clicks';
  }

  function renderGrid(): void {
    const view = $('recGridView');
    view.innerHTML = '';
    nowCell = null;
    const cells = GRIDS[grid].cells;
    const step = BAR / cells;
    const hand = handBars(deps.pack()).bars;
    const s = seg();
    for (let b = s.bar0; b < s.bar0 + s.bars; b++) {
      const row = document.createElement('div');
      row.className = 'rec-row';
      const tag = document.createElement('span');
      tag.className = `rec-tag${hand[String(b)] ? ' hand' : ''}`;
      tag.textContent = `${b + 1} ${hand[String(b)] ? 'hand' : 'auto'}`;
      row.appendChild(tag);
      const line = document.createElement('div');
      line.className = 'rec-cells';
      line.style.gridTemplateColumns = `repeat(${cells}, 1fr)`;
      const notes = barNotes(b);
      const at = (a: number[], k: number) => a.filter((t) => Math.min(cells - 1, Math.round(t / step)) === k);
      for (let k = 0; k < cells; k++) {
        const sv = at(notes.t, k);
        const fl = at(notes.f, k);
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = `rec-cell${k % (cells / 4) === 0 ? ' beat' : ''}${sv.length ? ' on' : fl.length ? ' flow' : ''}${[...sv, ...fl].some((t) => t % step !== 0) ? ' off' : ''}`;
        cell.dataset.bar = String(b);
        cell.dataset.cell = String(k);
        cell.setAttribute('aria-label', `bar ${b + 1}, step ${k + 1}${sv.length ? ', survival press' : fl.length ? ', flow note' : ''}`);
        line.appendChild(cell);
      }
      row.appendChild(line);
      view.appendChild(row);
    }
  }

  /** Clicking a square steps it round: empty, survival press, flow note, empty. */
  function toggle(bar: number, cell: number): void {
    if (tr) return;
    const cells = GRIDS[grid].cells;
    const step = BAR / cells;
    const n = barNotes(bar);
    const here = (t: number) => Math.min(cells - 1, Math.round(t / step)) === cell;
    const wasS = n.t.some(here);
    const wasF = n.f.some(here);
    const t = n.t.filter((x) => !here(x));
    const f = n.f.filter((x) => !here(x));
    if (!wasS && !wasF) t.push(cell * step); else if (wasS) f.push(cell * step);
    setBar(deps.pack(), bar, { t, f });
    dirty = true;
    renderGrid();
    status(`${!wasS && !wasF ? 'Survival press' : wasS ? 'Flow note' : 'Empty'}. This bar is now "by hand".${isCharge() ? ' This section charges the drop, so every note in it plays as a flow note.' : ''}`);
  }

  async function start(mode: 'record' | 'listen'): Promise<void> {
    if (tr) return;
    const pack = deps.pack();
    if (!audio.ensure()) { status('No audio on this device.'); return; }
    audio.setVolumes(save.music, save.sfx);
    audio.setMuffle(0);
    const track = await audio.loadTrack(pack.audio);
    await audio.resume();
    const c = audio.ctx!;
    const s = seg();
    const spb = level.spb;
    const pre = Math.min(4, s.beat0);
    const pos0 = s.t0 - pre * spb;
    const t0 = c.currentTime + 0.3;
    const music = audio.playMusic(track.buffer, t0, Math.max(0, pack.audio.offset + track.shift + pos0), rate);
    for (let k = 0; k < pre; k++) audio.hit(k === 0 ? 'clickHi' : 'click', 0.7, t0 + (k * spb) / rate); // one bar of count-in
    if (mode === 'listen') {
      const all = layerTicks(pack);
      // survival presses click high, flow notes click low and softer
      for (const [ticks, name, gain] of [[all.survival, 'clickHi', 1], [all.flow, 'click', 0.6]] as const) {
        for (const t of ticks) {
          const song = (t / 12) * spb;
          if (song >= s.t0 - 1e-6 && song < s.t1) audio.hit(name, gain, t0 + (song - pos0) / rate);
        }
      }
    }
    tr = { mode, t0, pos0, rate, end: t0 + (s.t1 - pos0) / rate + 0.12, music, taps: [] };
    status(mode === 'record' ? `Recording ${layer === 'survival' ? 'survival presses' : 'flow notes'}: one bar of count-in, then tap along (the pad, or any key).` : 'Listening: a high click on every survival press, a low one on every flow note.');
    renderControls();
  }

  function stop(keep: boolean): void {
    if (!tr) return;
    const t = tr;
    tr = null;
    t.music.stop(0.1);
    void audio.suspend().then(() => audio.resume()); // drops clicks still queued
    if (t.mode === 'record' && keep) {
      const s = seg();
      // the take replaces this layer in the section; the other layer stays, apart from notes the take landed on
      for (let b = s.bar0; b < s.bar0 + s.bars; b++) {
        const got = t.taps.filter((x) => x >= b * BAR && x < (b + 1) * BAR).map((x) => x - b * BAR);
        const old = barNotes(b);
        setBar(deps.pack(), b, layer === 'survival' ? { t: got, f: old.f.filter((x) => !got.includes(x)) } : { t: old.t.filter((x) => !got.includes(x)), f: got });
      }
      dirty = true;
      status(`Recorded ${t.taps.length} ${layer === 'survival' ? 'survival presses' : 'flow notes'} on the ${GRIDS[grid].name} grid; the other layer is untouched. Listen back, click squares to fix single notes, re-record, or save.${isCharge() ? ' This section charges the drop, so every note in it plays as a flow note.' : ''}`);
    } else if (t.mode === 'record') status('Recording thrown away.');
    else status('');
    renderControls();
    renderGrid();
  }

  /** A tap while recording: placed where it was heard, then snapped to the grid. */
  function tap(perfMs: number): void {
    if (!tr || tr.mode !== 'record') return;
    const heard = audio.ctxTimeAt(perfMs) - audio.latency() - save.audioOffset / 1000;
    const song = tr.pos0 + (heard - tr.t0) * tr.rate;
    const step = BAR / GRIDS[grid].cells;
    const tick = Math.round(((song / level.spb) * 12) / step) * step;
    const s = seg();
    if (tick < s.beat0 * 12 || tick >= s.beat1 * 12 || tr.taps.includes(tick)) return;
    tr.taps.push(tick);
    audio.hit('tap', 0.8);
    const cell = document.querySelector<HTMLElement>(`.rec-cell[data-bar="${Math.floor(tick / BAR)}"][data-cell="${Math.round((tick % BAR) / step)}"]`);
    cell?.classList.add(layer === 'survival' ? 'on' : 'flow', 'fresh');
  }

  function tick(now: number): void {
    if (!tr) return;
    audio.tick(now);
    const T = audio.ctxTimeAt(now);
    if (T >= tr.end) { stop(true); return; }
    const song = tr.pos0 + (T - audio.latency() - tr.t0) * tr.rate;
    const tickF = (song / level.spb) * 12;
    const step = BAR / GRIDS[grid].cells;
    const cell = tickF < seg().beat0 * 12 ? null : document.querySelector<HTMLElement>(`.rec-cell[data-bar="${Math.floor(tickF / BAR)}"][data-cell="${Math.floor((tickF % BAR) / step)}"]`);
    if (cell !== nowCell) { nowCell?.classList.remove('now'); cell?.classList.add('now'); nowCell = cell; }
  }

  function open(): void {
    level = new Level(deps.pack().level, deps.pack().audio, deps.pack().chart);
    const lab = deps.pack().level.lab;
    segs = level.segments.filter((s) => !lab || (s.beat0 >= lab[0] && s.beat1 <= lab[1]));
    segIdx = Math.min(segIdx, segs.length - 1);
    renderControls();
    renderGrid();
    status('Blue = survival press (must be hit), gold = flow note (optional). Record one layer at a time, or click a square to step it through empty, survival, flow.');
    deps.show('record');
  }

  $('recSection').addEventListener('change', (e) => { if (tr) stop(false); segIdx = Number((e.target as HTMLSelectElement).value); renderGrid(); });
  $('recGridView').addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.rec-cell');
    if (el) toggle(Number(el.dataset.bar), Number(el.dataset.cell));
  });
  $('recRecord').addEventListener('click', () => { if (tr) stop(tr.mode === 'record'); else void start('record'); });
  $('recListen').addEventListener('click', () => { if (tr) stop(tr.mode === 'record'); else void start('listen'); });
  $('recPad').addEventListener('pointerdown', (e) => { e.preventDefault(); tap(Math.abs(e.timeStamp - performance.now()) < 2000 ? e.timeStamp : performance.now()); });
  $('recAuto').addEventListener('click', () => {
    if (tr) return;
    const s = seg();
    for (let b = s.bar0; b < s.bar0 + s.bars; b++) setBar(deps.pack(), b, null);
    dirty = true;
    renderGrid();
    status('This section is back to the generated notes. Save to keep that.');
  });
  $('recSave').addEventListener('click', () => {
    void saveBars(deps.pack()).then((where) => {
      dirty = false;
      if (where === 'file') status(`Saved to levels/${deps.pack().level.id}/presses.json.`);
      else {
        status('No dev server here, so the bars are kept in this browser only. The JSON is in the box below: paste it into the level\'s presses.json to keep it.');
        const box = $<HTMLTextAreaElement>('recExport');
        box.value = exportBars(deps.pack());
        box.classList.remove('hidden');
      }
    });
  });
  $('recPlay').addEventListener('click', () => { if (tr) stop(tr.mode === 'record'); deps.play(seg().t0); });
  $('recClose').addEventListener('click', () => {
    if (tr) stop(false);
    if (dirty && !confirm('Leave without saving? The changes stay for this visit only.')) return;
    deps.show('menu');
  });

  return {
    open, tick,
    /** Any key taps while recording. Returns true if it used the key. */
    key(e: KeyboardEvent): boolean {
      if (!tr || tr.mode !== 'record' || e.code === 'Escape' || e.code === 'Tab') return false;
      tap(Math.abs(e.timeStamp - performance.now()) < 2000 ? e.timeStamp : performance.now());
      return true;
    },
    get busy() { return !!tr; },
    halt() { if (tr) stop(false); }
  };
}
