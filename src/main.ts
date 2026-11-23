import './style.css';
import { audio } from './audio/audio';
import { BADGES, ORBS, earned, type Orb } from './game/extras';
import { BSIDES, PACKS as ALL_PACKS, SLICE, creditLine, manifest, type LevelPack } from './game/packs';
import { QUESTS, questSet, questsEarned, questsFor } from './game/quests';
import { GATE_STARS, NODES, TIERS, maxStars, nodeOf, nodeState, playable, totalStars, type MapNode, type Progress } from './game/world';
import { refreshBars } from './gd/presses';
import { GdRenderer as Renderer } from './gd/render';
import { GdRun as Run, TUTORIAL_BEATS } from './gd/run';
import { canHaptics, feel, fullScreen, gameCenter, isNative, watchBackground } from './native';
import { initRecord } from './record';
import { bestFor, persist, save, starCount, starsFor } from './save';
import { LEVEL_UI, icon, levelArt } from './ui/art';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
type Screen = 'title' | 'levels' | 'play' | 'pause' | 'results' | 'settings' | 'calib' | 'orbs' | 'badges' | 'quests' | 'record';
const SCREENS: Screen[] = ['title', 'levels', 'pause', 'results', 'settings', 'calib', 'orbs', 'badges', 'quests', 'record'];

const PACKS = ALL_PACKS.filter((p) => SLICE.includes(p.level.id));
const shortTitle = (p: LevelPack) => p.level.title.replace(/ \(.*/, '');
/** Each level's own palette (its drop's), for the scene behind the menus. */
const levelPalette = (p: LevelPack) => (p.level.segments.find((s) => s.core?.smash) ?? p.level.segments[0]).look.palette;
/** Every level there is: the four planets and their B-sides (the moons). */
const ALL = [...PACKS, ...BSIDES];
const packOf = (id: string) => ALL.find((p) => p.level.id === id);
/** The level a pack is a version of: itself, or for a B-side its planet's. */
const baseOf = (p: LevelPack) => p.level.side?.of ?? p.level.id;
/** What the map's rules read: clears, stars, and the playtest switch that opens every planet and shows every moon. */
const progress: Progress = { cleared: (id) => bestFor(id).cleared, stars: starsFor, get unlockAll() { return save.unlockAll || /[?&]unlock=1/.test(location.search); } };
/** Where the player is on the map; `pack` is the level there (for the gate, the last one looked at). */
let at: MapNode = nodeOf(save.at || PACKS[Math.max(0, Math.min(PACKS.length - 1, save.level || 0))].level.id);
let levelIdx = Math.min(PACKS.length - 1, at.index);
let pack = packOf(at.id) ?? PACKS[levelIdx];
const levelOpen = (i: number) => playable(nodeOf(PACKS[i].level.id), progress);
const canPlay = () => playable(at, progress);
/** "LEVEL 2 · SKY HIGH · HIGH ORBIT", or "B-SIDE · SKY HIGH" for a moon. */
const levelLabel = (p: LevelPack) => (p.level.side ? `B-SIDE · ${shortTitle(p)}` : `LEVEL ${PACKS.indexOf(p) + 1} · ${shortTitle(p)} · ${TIERS[p.level.id] ?? ''}`).toUpperCase();
/** An orb is yours from the start, or for a badge, or for both quests of a level, or for clearing its B-side. */
const owned = (o: Orb): boolean => {
  if (!o.needs) return true;
  const [kind, lvl] = o.needs.split(':');
  return kind === 'quests' ? questSet(lvl, save.quests) : kind === 'moon' ? bestFor(`${lvl}-b`).cleared : !!save.badges[o.needs];
};

const renderer = new Renderer($<HTMLCanvasElement>('stage'));
let screen: Screen = 'title';
let settingsFrom: Screen = 'levels';
let run: Run | null = null;
let botMode = /[?&]bot=1/.test(location.search);
let practice = false;
let lastFrame = performance.now();
/** this visit to a level: the furthest any attempt got, and its flow, for the results screen */
const session = { far: 0, newBest: false, onBeat: 0, judged: 0, streak: 0, drop: -1, attempts: 0 };

/** Input events carry the time the tap happened; fall back to "now" on browsers that report something else. */
const stamp = (e: Event) => (Math.abs(e.timeStamp - performance.now()) < 2000 ? e.timeStamp : performance.now());
const fmtMs = (ms: number) => `${ms > 0 ? '+' : ''}${Math.round(ms)} ms`;
const wide = () => window.innerWidth >= 900;

for (const el of document.querySelectorAll<HTMLElement>('[data-icon]')) el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon!));

// ------------------------------------------------------------------ screens
/** Where the menu scene sits: beside the wordmark on a wide title screen; on a phone, centred in the room between the wordmark and TAP TO START. */
function placeScene(s: Screen): void {
  renderer.idleScale = 1;
  if (s !== 'title') { renderer.idleAt = [0.5, 0.46]; return; }
  if (wide()) { renderer.idleAt = [0.7, 0.5]; return; }
  const h = window.innerHeight;
  const top = document.querySelector<HTMLElement>('.mark')!.getBoundingClientRect().bottom;
  const bottom = $('cta').getBoundingClientRect().top;
  const room = bottom - top;
  if (!(room > 60)) { renderer.idleAt = [0.5, 0.58]; renderer.idleScale = 0.7; return; }
  const outer = 0.46 * Math.min(window.innerWidth, h); // the outermost ring at full size
  renderer.idleAt = [0.5, (top + bottom) / 2 / h];
  renderer.idleScale = Math.max(0.45, Math.min(1, (room / 2 - 14) / outer));
}
function show(s: Screen): void {
  screen = s;
  for (const id of SCREENS) $(id).classList.toggle('on', id === s);
  $('hud').classList.toggle('hidden', !(s === 'play' || s === 'pause'));
  $('levels').classList.remove('launch');
  // the scene behind the menus: beside the wordmark on a wide title screen, centred otherwise, in the focused level's colours
  placeScene(s);
  renderer.idleBare = s !== 'title'; // the map draws its own planets; only the title has the living orbit
  renderer.idlePal = s === 'title' ? 'deep' : at.kind === 'gate' ? 'void' : levelPalette(pack);
  if (s === 'levels') { layoutMap(); renderMap(); queuePreview(); }
  if (s === 'title' || s === 'play') audio.stopPreview(s === 'play' ? 0.9 : 0.4);
}

// ------------------------------------------------------------------ the world map
const STARS3 = `<i>${icon('star')}</i>`.repeat(3);
/** Fills a row of three stars: `kept` are gold, `got` (just collected) glow, `lost` are dimmed. */
function paintStars(el: Element, state: (i: number) => '' | 'kept' | 'got' | 'lost'): void {
  if (!el.children.length || el.children[0].tagName !== 'I') el.insertAdjacentHTML('afterbegin', STARS3);
  for (let i = 0; i < 3; i++) { const cls = state(i); if (el.children[i].className !== cls) el.children[i].className = cls; }
}
// Where everything sits, as fractions of the map's width and height. Tall: the route climbs the screen, labels to the
// side. Wide: it zigzags left to right, labels under the low planets and over the high ones, each moon on the far side.
type XY = [number, number];
type Side = 'left' | 'right' | 'below' | 'above';
const LAYOUT: Record<'tall' | 'wide', { planets: XY[]; moons: XY[]; gate: XY; sides: Side[]; gateSide: Side }> = {
  tall: { planets: [[0.27, 0.87], [0.72, 0.67], [0.3, 0.46], [0.7, 0.26]], moons: [[0.08, 0.775], [0.91, 0.545], [0.09, 0.345], [0.9, 0.14]], gate: [0.4, 0.075], sides: ['right', 'left', 'right', 'left'], gateSide: 'right' },
  wide: { planets: [[0.14, 0.68], [0.36, 0.36], [0.58, 0.68], [0.8, 0.36]], moons: [[0.14, 0.27], [0.36, 0.8], [0.58, 0.27], [0.8, 0.8]], gate: [0.93, 0.66], sides: ['below', 'above', 'below', 'above'], gateSide: 'above' }
};
const mapEl = $('map');
const nodeEls = new Map<string, HTMLElement>();
const labEls = new Map<string, HTMLElement>();
/** places that have just changed (a planet unlocked, a moon found, the gate opened): they pop once when the map is next shown */
const freshNodes = new Set<string>();
function buildMap(): void {
  for (const n of NODES) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `node ${n.kind}`;
    el.dataset.id = n.id;
    el.innerHTML = '<span class="orbit"></span><span class="glyph"></span>';
    const lab = document.createElement('div');
    lab.className = 'lab';
    lab.dataset.id = n.id;
    mapEl.append(el, lab);
    nodeEls.set(n.id, el);
    labEls.set(n.id, lab);
  }
  mapEl.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-id]');
    if (!el) return;
    // a second tap on the planet you are at goes in
    if (el.dataset.id === at.id && el.classList.contains('node') && canPlay()) begin(false); else select(el.dataset.id!);
  });
}
/** Puts every place, label and stretch of route where the map's current size wants it. */
function layoutMap(): void {
  const w = mapEl.clientWidth;
  const h = mapEl.clientHeight;
  if (!w || !h) return;
  const wideMap = w > h * 1.3;
  mapEl.classList.toggle('compact', wideMap && w < 640); // a phone on its side: names only
  const L = wideMap ? LAYOUT.wide : LAYOUT.tall;
  const r = Math.max(14, Math.min(wideMap ? 34 : 31, wideMap ? Math.min(h * 0.085, w * 0.05) : Math.min(h * 0.07, w * 0.078)));
  const xy = (n: MapNode): XY => { const [x, y] = n.kind === 'gate' ? L.gate : n.kind === 'moon' ? L.moons[n.index] : L.planets[n.index]; return [x * w, y * h]; };
  for (const n of NODES) {
    const [x, y] = xy(n);
    const rr = n.kind === 'planet' ? r : n.kind === 'moon' ? Math.max(10, r * 0.45) : r * 0.8;
    const el = nodeEls.get(n.id)!;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.setProperty('--r', `${rr}px`);
    const lab = labEls.get(n.id)!;
    const side = n.kind === 'moon' ? 'below' : n.kind === 'gate' ? L.gateSide : L.sides[n.index];
    const reach = rr * (n.kind === 'planet' ? 1.6 : n.kind === 'gate' ? (side === 'right' ? 2.1 : 1.3) : 1.3) + 8;
    lab.className = `lab ${side}`;
    lab.style.left = `${side === 'right' ? x + reach : side === 'left' ? x - reach : x}px`;
    lab.style.top = `${side === 'below' ? y + reach - 2 : side === 'above' ? y - reach + 2 : y}px`;
  }
  // the route: planet to planet and on to the gate, each stretch its own path so the travelled part can light up
  const stops = [...NODES.filter((n) => n.kind === 'planet'), nodeOf('gate')].map(xy);
  let d = '';
  for (let i = 0; i + 1 < stops.length; i++) {
    const [x0, y0] = stops[i];
    const [x1, y1] = stops[i + 1];
    const c = wideMap ? `${(x0 + x1) / 2} ${y0}, ${(x0 + x1) / 2} ${y1}` : `${x0} ${(y0 + y1) / 2}, ${x1} ${(y0 + y1) / 2}`;
    d += `<path data-seg="${i}" d="M${x0} ${y0} C ${c}, ${x1} ${y1}"/>`;
  }
  for (const n of NODES.filter((m) => m.kind === 'moon')) {
    const [x0, y0] = stops[n.index];
    const [x1, y1] = xy(n);
    d += `<path data-moon="${n.id}" class="side" d="M${x0} ${y0} L${x1} ${y1}"/>`;
  }
  const svg = $('mapRoute');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.innerHTML = d;
}
/** Every place's state (open, cleared, locked, hidden), the route travelled so far, the star total and the panel. */
function renderMap(): void {
  for (const n of NODES) {
    const st = nodeState(n, progress);
    const el = nodeEls.get(n.id)!;
    const lab = labEls.get(n.id)!;
    const side = lab.className.split(' ').find((c) => c === 'left' || c === 'right' || c === 'below' || c === 'above') ?? 'right';
    const p = packOf(n.id);
    const title = p ? shortTitle(p) : '';
    // a moon nobody has found shows as a "?" beside a planet that is open, and not at all beside a locked one
    const unseen = n.kind === 'moon' && st === 'hidden' && nodeState(nodeOf(n.planet), progress) === 'locked';
    el.className = `node ${n.kind} ${st === 'hidden' ? 'hidden-moon' : st}${n.id === at.id ? ' sel' : ''}${freshNodes.has(n.id) ? ' fresh' : ''}${unseen ? ' hidden' : ''}`;
    el.querySelector('.glyph')!.innerHTML = st === 'cleared' ? icon('check') : st === 'locked' && n.kind === 'planet' ? icon('lock') : st === 'hidden' ? '?' : '';
    if (n.kind === 'planet') {
      const ui = LEVEL_UI[n.id] ?? { col: '#19e3ff', dots: 1 };
      const b = bestFor(n.id);
      el.style.setProperty('--c', ui.col);
      el.setAttribute('aria-label', `Level ${n.index + 1}, ${title}, ${TIERS[n.id]}${st === 'locked' ? ', locked' : st === 'cleared' ? ', cleared' : `, best ${b.pct} percent`}`);
      const sub = st === 'locked' ? `Clear ${shortTitle(PACKS[n.index - 1])}` : st === 'open' && b.pct > 0 ? `Best ${b.pct}%` : TIERS[n.id];
      lab.className = `lab ${side}${st === 'locked' ? ' dim' : ''}`;
      lab.innerHTML = `<b></b><span class="sub">${st === 'locked' ? '' : '<span class="stars3"></span>'}<span></span></span>${st === 'locked' ? '' : `<span class="gems">${questsFor(n.id).map((q) => `<i class="${save.quests[q.id] ? 'on' : ''}"></i>`).join('')}</span>`}`;
      lab.querySelector('b')!.textContent = title;
      lab.querySelector('.sub > span:last-child')!.textContent = sub;
      const kept = starsFor(n.id);
      const row = lab.querySelector('.stars3');
      if (row) paintStars(row, (k) => (kept[k] ? 'kept' : ''));
    } else if (n.kind === 'moon') {
      el.style.setProperty('--c', 'var(--gold)');
      el.setAttribute('aria-label', st === 'hidden' ? `Something hidden near ${title}` : `B-side of ${title}${st === 'cleared' ? ', cleared' : ''}`);
      lab.className = `lab ${side} gold`;
      lab.textContent = st === 'hidden' ? '' : 'B-side';
    } else {
      el.setAttribute('aria-label', st === 'open' ? 'The gate, open' : `The gate, needs ${GATE_STARS} stars`);
      lab.className = `lab ${side}${st === 'open' ? '' : ' dim'}`;
      lab.innerHTML = st === 'open' ? '<b>The gate</b><span>Open</span>' : `<b>???</b><span>Needs ${GATE_STARS} stars</span>`;
    }
  }
  freshNodes.clear();
  for (const path of $('mapRoute').querySelectorAll<SVGPathElement>('path')) {
    if (path.dataset.seg !== undefined) path.setAttribute('class', bestFor(PACKS[Number(path.dataset.seg)].level.id).cleared ? 'done' : 'todo');
    else if (path.dataset.moon) {
      const m = nodeOf(path.dataset.moon);
      path.setAttribute('class', `side${nodeState(m, progress) === 'hidden' ? '' : ' found'}${nodeState(nodeOf(m.planet), progress) === 'locked' ? ' hidden' : ''}`);
    }
  }
  $('starTotal').innerHTML = `${icon('star')}${starCount()} / ${maxStars}`;
  $('starTotal').setAttribute('aria-label', `${starCount()} of ${maxStars} stars`);
  renderSheet();
}
/** The panel under the map: the place you are at, how you have done there, and PLAY. */
function renderSheet(): void {
  const st = nodeState(at, progress);
  const sheet = $('sheet');
  const best = $('shBest');
  const meter = (label: string, pct: number, text: string) => {
    best.classList.remove('hidden');
    best.querySelector('span')!.textContent = label;
    best.querySelector<HTMLElement>('i')!.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    best.querySelector('b')!.textContent = text;
  };
  const play = $<HTMLButtonElement>('playBtn');
  const prac = $<HTMLButtonElement>('practiceBtn');
  const art = $('shArt');
  const artOf = at.kind === 'gate' ? 'gate' : at.planet;
  if (art.dataset.of !== artOf) { art.dataset.of = artOf; art.innerHTML = levelArt(artOf); }
  art.style.filter = at.kind === 'moon' ? (st === 'hidden' ? 'grayscale(1) brightness(0.3)' : 'saturate(0.5) brightness(0.62)') : at.kind === 'gate' ? 'none' : st === 'locked' ? 'grayscale(0.85) brightness(0.45)' : 'none';
  $('shLine').classList.remove('hidden');
  $('shStars').classList.remove('hidden');
  $('shQuests').innerHTML = '';
  $('shTries').textContent = '';
  if (at.kind === 'gate') {
    const n = totalStars(progress);
    sheet.style.setProperty('--tint', 'var(--pink)');
    $('shTitle').textContent = st === 'open' ? 'The gate' : '???';
    $('shTier').textContent = st === 'open' ? 'Open' : 'Locked';
    $('shMeta').textContent = st === 'open' ? 'The gate is open. The last level of World 1 lies beyond it, and it is still being built.' : `Something waits past ${shortTitle(PACKS[PACKS.length - 1])}. It opens on ${GATE_STARS} stars.`;
    meter('STARS', (n / GATE_STARS) * 100, `${Math.min(n, GATE_STARS)}/${GATE_STARS}`);
    $('shLine').classList.add('hidden');
    play.disabled = prac.disabled = true;
    play.textContent = st === 'open' ? 'SOON' : 'LOCKED';
    return;
  }
  const planet = PACKS[at.index];
  const b = bestFor(at.id);
  const kept = starsFor(planet.level.id);
  const open = st === 'open' || st === 'cleared';
  play.disabled = prac.disabled = !open;
  play.textContent = open ? 'PLAY' : st === 'hidden' ? 'HIDDEN' : 'LOCKED';
  const tries = b.attempts ? `<b>${b.attempts}</b> attempt${b.attempts === 1 ? '' : 's'}${b.cleared ? ' · <b>cleared</b>' : (b.prac ?? 0) > 0 ? ` · practice <b>${b.prac}%</b>` : ''}` : 'Not played yet';
  if (at.kind === 'moon') {
    sheet.style.setProperty('--tint', 'var(--gold)');
    $('shTitle').textContent = st === 'hidden' ? '???' : shortTitle(planet);
    $('shTier').textContent = st === 'hidden' ? 'Hidden' : 'B-side';
    $('shMeta').textContent = st === 'hidden' ? `Keep all three stars on ${shortTitle(planet)} and something will appear here.` : `${planet.level.artist} · ${pack.level.adds ?? ''}`;
    if (st === 'hidden') { best.classList.add('hidden'); paintStars($('shStars'), (k) => (kept[k] ? 'kept' : '')); $('shTries').textContent = `${kept.filter(Boolean).length} of 3 stars kept`; } else { meter('BEST', b.cleared ? 100 : b.pct, `${b.cleared ? 100 : b.pct}%`); $('shStars').classList.add('hidden'); $('shTries').innerHTML = tries; }
    return;
  }
  sheet.style.setProperty('--tint', (LEVEL_UI[at.id] ?? { col: '#19e3ff' }).col);
  $('shTitle').textContent = shortTitle(planet);
  $('shTier').textContent = TIERS[at.id] ?? '';
  $('shMeta').textContent = st === 'locked' ? `Clear ${shortTitle(PACKS[at.index - 1])} to open the way here.` : `${planet.level.artist} · ${planet.level.adds ?? ''}`;
  meter('BEST', b.cleared ? 100 : b.pct, `${b.cleared ? 100 : b.pct}%`);
  paintStars($('shStars'), (k) => (kept[k] ? 'kept' : ''));
  $('shTries').innerHTML = tries;
  $('shQuests').innerHTML = questsFor(at.id).map((q) => `<span class="qchip${save.quests[q.id] ? ' on' : ''}" title="${q.desc}">${icon(save.quests[q.id] ? 'check' : 'quest')}${q.name}</span>`).join('');
}
/** Moves to a place on the map. */
function select(id: string, quiet = false): void {
  const n = nodeOf(id);
  const changed = n.id !== at.id;
  at = n;
  if (n.kind !== 'gate') { levelIdx = Math.min(PACKS.length - 1, n.index); pack = packOf(n.id) ?? PACKS[levelIdx]; }
  if (changed) { save.at = n.id; save.level = levelIdx; persist(); }
  renderMap();
  renderer.idlePal = n.kind === 'gate' ? 'void' : levelPalette(pack);
  if (changed && !quiet) queuePreview();
}
/** Moves to a planet by its place on the route (0 = the first level). */
function focusLevel(i: number, _scroll = false): void {
  select(PACKS[Math.max(0, Math.min(PACKS.length - 1, i))].level.id);
}
/** The focused level's song plays quietly from its drop: the preview. It needs one tap first (browsers hold audio until then). */
let audioReady = false;
let previewTimer = 0;
function queuePreview(): void {
  clearTimeout(previewTimer);
  if (!audioReady || screen !== 'levels') return;
  // nothing to hear at the gate, or at a moon nobody has found
  if (at.kind === 'gate' || nodeState(at, progress) === 'hidden') { audio.stopPreview(0.4); return; }
  previewTimer = window.setTimeout(() => {
    if (screen !== 'levels') return;
    audio.setVolumes(save.music, save.sfx);
    void audio.preview(pack.audio, pack.audio.dropTime - pack.audio.offset - (4 * 60) / pack.audio.bpm);
  }, 320);
}

// ------------------------------------------------------------------ starting a level
/** PLAY or PRACTICE from the level select: sync check on a first run, the tutorial before level 1, then the card opens into the level. */
function begin(asPractice: boolean): void {
  if (!canPlay() || $('levels').classList.contains('launch')) return;
  practice = asPractice;
  botMode = false;
  audio.ensure();
  audio.setVolumes(save.music, save.sfx);
  checkDevice();
  if (!save.calibrated || deviceChanged) { openCalib(true, 'begin'); return; }
  enter();
}
function enter(): void {
  session.far = session.onBeat = session.judged = session.streak = session.attempts = 0;
  session.newBest = false;
  session.drop = -1;
  if (screen === 'levels') {
    // the chosen card zooms open over one beat while the preview fades into the level's own music
    $('levels').classList.add('launch');
    audio.stopPreview(0.9);
    window.setTimeout(go, 430);
  } else go();
}
function go(): void {
  if (!save.tutorialDone && !botMode && pack.level.id === PACKS[0].level.id) startTutorial(); else startRun();
}

/** Starts an attempt. `from` is a song time (practice restarts from a checkpoint); `quick` is the instant restart after a crash. */
function startRun(from = -1, quick = false): void {
  if (!canPlay()) return;
  audio.ensure();
  audio.setVolumes(save.music, save.sfx);
  audio.stopPreview(0.6);
  if (practice && !botMode && !save.practiced[pack.level.id]) { save.practiced[pack.level.id] = true; persist(); }
  run?.stop();
  const counted = !botMode && !practice;
  if (counted) {
    save.bests[pack.level.id] = { ...bestFor(pack.level.id), attempts: bestFor(pack.level.id).attempts + 1 };
    persist();
  }
  session.attempts++;
  renderer.reset();
  const spb = 60 / pack.audio.bpm;
  // a fresh start plays the whole count-in bar under the title card; an instant restart cuts in for the last two counts
  const opts = from >= 0 ? { startAt: from, leadIn: 1.5 } : quick ? { startAt: 2 * spb, leadIn: 0.3 } : { leadIn: 2.4 };
  run = new Run(pack, { bot: botMode, practice: practice && !botMode, ...opts }, onRunEnd);
  const b = bestFor(pack.level.id);
  $('dropMark').style.left = `${((run.level.dropTime - run.t0) / (run.t1 - run.t0)) * 100}%`;
  $('bestMark').style.left = `${b.cleared ? 100 : b.pct}%`;
  $('bestMark').classList.toggle('hidden', b.pct === 0 && !b.cleared);
  $('bestPct').textContent = b.cleared ? 'CLEARED' : `BEST ${b.pct}%`;
  const label = $('attempt');
  label.textContent = botMode ? 'AUTOPLAY' : practice ? 'PRACTICE' : `ATTEMPT ${b.attempts}`;
  label.classList.remove('flash');
  if (quick) { void label.offsetWidth; label.classList.add('flash'); }
  const card = $('titleCard');
  card.classList.remove('show');
  if (from < 0 && !quick) {
    $('tcLevel').textContent = `${pack.level.side ? 'B-SIDE' : `LEVEL ${levelIdx + 1} · ${(TIERS[pack.level.id] ?? '').toUpperCase()}`}${practice ? ' · PRACTICE' : ''}`;
    $('tcSong').textContent = shortTitle(pack);
    $('tcArtist').textContent = pack.level.artist;
    void card.offsetWidth;
    card.classList.add('show');
  }
  $('tutor').classList.add('hidden');
  $('finale').classList.remove('show');
  hud.pct = -1;
  hud.crashShown = false;
  hud.count = '';
  show('play');
  void run.start().then(() => { if (run && run.state === 'error') { alert(`Could not start the level: ${run.error}`); show('levels'); } });
}

// ------------------------------------------------------------------ first run: the tutorial
const LESSONS: Array<[number, string]> = [
  [-9, 'The ball orbits <i>by itself</i>, in time with the music.'],
  [2.6, 'TAP anywhere as it crosses a <i>white mark</i>. A little early or late still counts.'],
  [12, '<b>Gold notes</b> are bonus taps. On the beat they build <b>flow</b>: the gold arc round the core.'],
  [17, '<b>Gold rails</b>: keep your finger down to ride along them. Only a missed <i>white mark</i> restarts the run.']
];
function startTutorial(): void {
  run?.stop();
  renderer.reset();
  audio.stopPreview(0.6);
  run = new Run(pack, { tutorial: true, leadIn: 1.8 }, endTutorial);
  $('attempt').textContent = 'TUTORIAL';
  $('bestPct').textContent = '';
  $('bestMark').classList.add('hidden');
  $('titleCard').classList.remove('show');
  $('finale').classList.remove('show');
  $('tutor').classList.remove('hidden');
  hud.pct = -1;
  hud.lesson = -1;
  hud.count = '';
  show('play');
  void run.start();
}
function endTutorial(): void {
  save.tutorialDone = true;
  persist();
  $('tutor').classList.add('hidden');
  startRun();
}

// ------------------------------------------------------------------ sync check
// Every tap that meets a note is logged as milliseconds early or late, across attempts. If the taps centre well
// away from zero, that is audio or display delay, not the chart, and one tap on the fix corrects the offset.
const sync = { press: [] as number[], flow: [] as number[], seenPress: 0, seenFlow: 0, of: null as Run | null, last: NaN };
/** the audio output changed since the last calibration (new headphones or speakers) */
let deviceChanged = false;
function harvest(r: Run): void {
  if (sync.of !== r) { sync.of = r; sync.seenPress = sync.seenFlow = 0; }
  if (r.opts.bot || r.opts.tutorial) return;
  const o = r.sim.offsets;
  while (sync.seenPress < o.press.length) { sync.last = o.press[sync.seenPress++] * 1000; sync.press.push(sync.last); }
  while (sync.seenFlow < o.flow.length) { sync.last = o.flow[sync.seenFlow++] * 1000; sync.flow.push(sync.last); }
  if (sync.press.length > 150) sync.press.splice(0, sync.press.length - 150);
  if (sync.flow.length > 150) sync.flow.splice(0, sync.flow.length - 150);
}
function spread(a: number[]): { n: number; mean: number; sd: number } {
  if (a.length < 3) return { n: a.length, mean: 0, sd: 0 };
  const s = [...a].sort((x, y) => x - y);
  const core = s.slice(Math.floor(s.length * 0.1), Math.ceil(s.length * 0.9)); // drop the wildest tenth at each end
  const mean = core.reduce((p, v) => p + v, 0) / core.length;
  return { n: a.length, mean, sd: Math.sqrt(core.reduce((p, v) => p + (v - mean) * (v - mean), 0) / core.length) };
}
const lateEarly = (ms: number) => (Math.abs(ms) < 3 ? 'on the beat' : `${Math.abs(Math.round(ms))} ms ${ms > 0 ? 'late' : 'early'}`);
/** Fills a sync box: what the taps say, and a one-tap fix if they are consistently off. */
function showSync(textId: string, fixId: string): void {
  const all = spread([...sync.press, ...sync.flow]);
  const fix = $(fixId);
  fix.classList.add('hidden');
  let text: string;
  if (all.n < 12) text = 'Your taps: not enough yet to say. Play a little more.';
  else if (all.sd > 60) text = `Your taps are spread too wide (±${Math.round(all.sd)} ms) to say where they centre.`;
  else if (Math.abs(all.mean) < 15) text = `In sync: your taps centre ${lateEarly(all.mean)} (±${Math.round(all.sd)} ms over ${all.n} taps).`;
  else {
    const next = Math.max(-200, Math.min(400, save.audioOffset + Math.round(all.mean)));
    text = `Your taps are consistently ${lateEarly(all.mean)} (±${Math.round(all.sd)} ms over ${all.n} taps). That is audio or display delay, not the level.`;
    fix.textContent = `Fix it: offset ${fmtMs(next)}`;
    fix.classList.remove('hidden');
    fix.onclick = () => {
      save.audioOffset = next;
      persist();
      sync.press.length = sync.flow.length = 0;
      $(textId).textContent = `Audio offset set to ${fmtMs(next)}. Play on and check again.`;
      fix.classList.add('hidden');
    };
  }
  $(textId).textContent = `${text} Audio offset ${fmtMs(save.audioOffset)}.`;
}
function drawSyncOverlay(): void {
  const el = $('syncOverlay');
  const on = save.syncOverlay || /[?&]sync=1/.test(location.search);
  el.classList.toggle('hidden', !on);
  if (!on) return;
  const row = (x: { n: number; mean: number; sd: number }) => (x.n < 3 ? `      -      (${x.n})` : `${(x.mean >= 0 ? '+' : '') + x.mean.toFixed(0)} ms ±${x.sd.toFixed(0)} (${x.n})`);
  el.textContent = `last  ${Number.isNaN(sync.last) ? '-' : (sync.last >= 0 ? '+' : '') + sync.last.toFixed(0) + ' ms'}\npress ${row(spread(sync.press))}\nflow  ${row(spread(sync.flow))}\noffset ${fmtMs(save.audioOffset)}  (+ = late)`;
}
function checkDevice(): void {
  if (save.calLatency >= 0 && Math.abs(audio.latency() - save.calLatency) > 0.03) deviceChanged = true;
}
navigator.mediaDevices?.addEventListener?.('devicechange', () => { deviceChanged = true; });

// ------------------------------------------------------------------ the end of an attempt
let toastTimer = 0;
function toast(text: string, gold = false): void {
  const el = $('toast');
  el.textContent = text;
  el.className = `toast${gold ? ' gold' : ''}`;
  void el.offsetWidth; // restart the animation
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), 1400);
}
function tally(r: Run): void {
  session.onBeat += r.sim.onBeat;
  session.judged += r.sim.judged;
  session.streak = Math.max(session.streak, r.sim.bestStreak);
  if (r.dropFull !== null && r.time > r.level.dropTime) session.drop = Math.max(session.drop, r.dropPower);
}
/** A crash restarts at once (practice: from the last checkpoint). Only a clear, or quitting, shows the results. */
function onRunEnd(r: Run): void {
  if (r !== run) return;
  harvest(r);
  const id = r.pack.level.id;
  const prev = bestFor(id);
  const counted = !r.opts.bot && !r.opts.practice;
  if (r.state === 'failed') {
    tally(r);
    const pct = r.pct;
    session.far = Math.max(session.far, pct);
    if (r.opts.practice) {
      if (pct > (prev.prac ?? 0)) { save.bests[id] = { ...prev, prac: pct }; persist(); }
      // back to the start of the section; the one before if you fell right at its start
      const seg = r.level.segAt(r.crashTime);
      const cp = r.crashTime - seg.t0 < 1.2 && seg.index > 0 ? r.level.segments[seg.index - 1].t0 : seg.t0;
      if (cp <= r.t0 + 0.01) startRun(-1, true); else startRun(cp);
      return;
    }
    if (counted && pct > prev.pct) { save.bests[id] = { ...prev, pct }; persist(); session.newBest = true; if (!r.pack.level.side) gameCenter.best(id, pct); }
    startRun(-1, true);
    return;
  }
  tally(r);
  showResults(r, true);
}

/** reached: how far the run was when it was left (a stopped run no longer knows) */
function showResults(r: Run, cleared: boolean, reached = r.pct): void {
  const id = r.pack.level.id;
  const prev = bestFor(id);
  const counted = !r.opts.bot && !r.opts.practice;
  const first = cleared && counted && !prev.cleared;
  const unlocks: string[] = [];
  let newStars = [false, false, false];
  if (cleared && counted) {
    const moon = !!r.pack.level.side;
    const row = (ico: string, head: string, small: string) => `<div class="unlock">${ico}<div>${head}<small>${small}</small></div></div>`;
    const dot = (o: Orb) => `<span class="dot" style="background:rgb(${o.rgb.join(',')})"></span>`;
    // how the map stood before this clear, to tell what it has just changed
    const gateWas = nodeState(nodeOf('gate'), progress) === 'open';
    const moonWas = moon || nodeState(nodeOf(`${id}-b`), progress) !== 'hidden';
    const orbsWas = new Set(ORBS.filter(owned).map((o) => o.id));
    save.bests[id] = { ...prev, pct: 100, cleared: true };
    const onBeatPct = r.sim.judged ? (r.sim.onBeat / r.sim.judged) * 100 : 0;
    if (!moon) {
      const done = ALL_PACKS.map((p) => p.level.id).filter((x) => bestFor(x).cleared);
      const fresh = earned(id, { onBeatPct, dropPower: r.dropPower, bestStreak: r.sim.bestStreak, attempts: bestFor(id).attempts, practised: !!save.practiced[id] }, done).filter((b) => !save.badges[b]);
      if (first && levelIdx + 1 < PACKS.length) {
        freshNodes.add(PACKS[levelIdx + 1].level.id);
        if (!progress.unlockAll) unlocks.push(row(icon('play'), 'NEXT LEVEL UNLOCKED', `${shortTitle(PACKS[levelIdx + 1])} · ${TIERS[PACKS[levelIdx + 1].level.id]}`));
      }
      // stars are kept when the run that collected them clears the level
      const had = starsFor(id);
      const now = had.map((k, i) => k || r.sim.stars[i] === 1);
      const gained = now.filter(Boolean).length - had.filter(Boolean).length;
      if (gained > 0) {
        save.stars[id] = now;
        newStars = now.map((k, i) => k && !had[i]);
        const all = now.every(Boolean);
        unlocks.push(row(icon('star'), all ? 'ALL THREE STARS' : `${gained} NEW STAR${gained === 1 ? '' : 'S'}`, all ? `Every star trail in ${shortTitle(r.pack)} played clean` : `${now.filter(Boolean).length} of 3 kept on ${shortTitle(r.pack)}`));
      }
      // what the stars have just done to the map
      if (!moonWas && nodeState(nodeOf(`${id}-b`), progress) !== 'hidden') {
        freshNodes.add(`${id}-b`);
        unlocks.push(row(icon('orb'), 'A MOON APPEARS', `${shortTitle(r.pack)} has a B-side: find it on the map`));
      }
      if (!gateWas && nodeState(nodeOf('gate'), progress) === 'open') {
        freshNodes.add('gate');
        unlocks.push(row(icon('flag'), 'THE GATE IS OPEN', `${GATE_STARS} stars: the way past ${shortTitle(PACKS[PACKS.length - 1])} is clear`));
      }
      // side quests this clear completes
      for (const q of questsEarned(id, { onBeatPct, dropPower: r.dropPower, bestStreak: r.sim.bestStreak, holdsFull: r.sim.holdsFull, holds: r.course.holds.length, strays: r.sim.strays }, save.quests)) {
        save.quests[q.id] = true;
        unlocks.push(row(icon('quest'), `QUEST: ${q.name.toUpperCase()}`, q.desc));
      }
      gameCenter.best(id, 100);
      gameCenter.flow(id, onBeatPct);
      for (const bid of fresh) {
        save.badges[bid] = true;
        gameCenter.badge(bid);
        const b = BADGES.find((x) => x.id === bid);
        if (b) unlocks.push(row(icon('badge'), `BADGE: ${b.name.toUpperCase()}`, b.desc));
      }
    }
    // orbs this clear has earned: by a badge, by both quests of a level, or by a B-side
    for (const o of ORBS) if (owned(o) && !orbsWas.has(o.id)) unlocks.push(row(dot(o), `ORB: ${o.name.toUpperCase()}`, 'Equip it under Orbs'));
  }
  if (cleared && r.opts.practice) save.bests[id] = { ...bestFor(id), prac: 100 };
  persist();
  const pct = cleared ? 100 : Math.max(session.far, reached);
  $('results').querySelector('.results')!.classList.toggle('clear', cleared);
  $('resLevel').textContent = `${levelLabel(r.pack)}${r.opts.bot ? ' · AUTOPLAY' : r.opts.practice ? ' · PRACTICE' : ''}`;
  $('resPct').textContent = String(pct);
  const callout = $('resCallout');
  const says = first ? 'FIRST CLEAR' : !cleared && session.newBest ? 'NEW BEST' : '';
  callout.textContent = says;
  callout.classList.toggle('hidden', !says);
  $('resTitle').textContent = cleared ? 'LEVEL COMPLETE' : `REACHED ${pct}%`;
  $('resFill').style.transform = 'scaleX(0)';
  window.setTimeout(() => { $('resFill').style.transform = `scaleX(${pct / 100})`; }, 60);
  $('resDrop').style.left = `${((r.level.dropTime - r.t0) / (r.t1 - r.t0)) * 100}%`;
  $('resCrash').classList.toggle('hidden', cleared);
  $('resCrash').style.left = `${pct}%`;
  $('resAttempts').textContent = counted ? String(bestFor(id).attempts) : String(session.attempts);
  $('resOnBeat').textContent = session.judged ? `${Math.round((session.onBeat / session.judged) * 100)}%` : '–';
  $('resStreak').textContent = String(session.streak);
  $('resCharge').textContent = session.drop < 0 ? '–' : `${Math.round(session.drop * 100)}%`;
  $('resUnlocks').innerHTML = unlocks.join('');
  const keptNow = starsFor(id);
  paintStars($('resStars'), (i) => (newStars[i] ? 'got' : keptNow[i] ? 'kept' : ''));
  $('resStars').classList.toggle('hidden', !r.course.stars.length);
  const sm = r.smoothness();
  const carried = r.sim.stars.filter((x) => x === 1).length;
  const notes: string[] = [];
  if (r.opts.bot) notes.push(`Autoplay. Movement check: ${sm.frames} frames, clock speed never more than ${sm.worstPct.toFixed(2)}% off.`);
  else {
    if (cleared && r.dropFull === false) notes.push(`The drop played at ${Math.round(r.dropPower * 100)}%. Tap the roll's notes and arrive in flow for the full one.`);
    if (cleared && r.course.holds.length) notes.push(`Gold holds collected in full: ${r.sim.holdsFull} of ${r.course.holds.length}.`);
    if (r.opts.practice && carried) notes.push('Practice runs do not keep stars.');
    else if (!cleared && carried) notes.push('A star is kept when the run that collected it clears the level.');
    else if (cleared && r.course.stars.length && !keptNow.every(Boolean)) notes.push('Stars: play a star trail clean (all its gold, no extra taps) and clear the level to keep it.');
  }
  $('resNote').textContent = notes.join(' ');
  console.log(`[one more orbit] ${r.opts.bot ? 'autoplay' : 'run'} ${cleared ? 'cleared' : 'left'} ${r.level.title}: ${r.sim.onBeat}/${r.sim.judged} taps on the beat, best streak ${r.sim.bestStreak}, drop at ${Math.round(r.dropPower * 100)}%. Movement check: ${sm.frames} frames, clock speed never more than ${sm.worstPct.toFixed(2)}% off (average ${sm.meanPct.toFixed(3)}%)`);
  showSync('resSyncText', 'resSyncFix');
  const next = $<HTMLButtonElement>('nextBtn');
  next.disabled = !!r.pack.level.side || !(levelIdx + 1 < PACKS.length && levelOpen(levelIdx + 1));
  next.style.opacity = next.disabled ? '0.4' : '1';
  botMode = false;
  show('results');
}

// ------------------------------------------------------------------ HUD
const hud = { pct: -1, seg: '', count: '', crashShown: false, lesson: -1, finale: false };
function updateHud(r: Run): void {
  harvest(r);
  drawSyncOverlay();
  // the level's three stars: gold if already kept, glowing once collected on this attempt, dimmed if lost on it
  const kept = starsFor(r.pack.level.id);
  $('hudStars').classList.toggle('hidden', !!r.opts.tutorial || !r.course.stars.length);
  paintStars($('hudStars'), (i) => (r.sim.stars[i] === 1 ? 'got' : kept[i] ? 'kept' : r.sim.stars[i] === -1 && r.sim.starBeat[i] > -90 ? 'lost' : ''));
  const pct = r.pct;
  if (pct !== hud.pct) { hud.pct = pct; $('pct').textContent = `${pct}%`; }
  $('progFill').style.transform = `scaleX(${r.progress.toFixed(4)})`;
  const label = r.level.segAt(Math.max(0, r.time)).label;
  if (label !== hud.seg) { hud.seg = label; $('section').textContent = label; }
  const beat = r.time / r.level.spb;
  // 3, 2, 1 on the beats of the count-in bar: the first press is never a surprise
  let n = '';
  if (r.course.start === 0 && !r.opts.tutorial && r.startAt <= r.level.spb * 3.5 && r.state === 'playing') n = beat >= 1 && beat < 2 ? '3' : beat >= 2 && beat < 3 ? '2' : beat >= 3 && beat < 4 ? '1' : '';
  if (n !== hud.count) {
    hud.count = n;
    const el = $('countIn');
    el.classList.remove('pop');
    if (n) { el.textContent = n; void el.offsetWidth; el.classList.add('pop'); }
  }
  if (r.state === 'failed' && !hud.crashShown) {
    // the crash: how far you got, briefly; it restarts by itself, or at once on a tap
    hud.crashShown = true;
    const best = !r.opts.bot && !r.opts.practice && pct > bestFor(r.pack.level.id).pct;
    toast(best && pct >= 2 ? `NEW BEST ${pct}%` : `${pct}%`, best);
  }
  if (r.finale !== hud.finale) {
    hud.finale = r.finale;
    $('finale').classList.toggle('show', r.finale);
    if (r.finale) $('finaleNote').textContent = !r.opts.bot && !r.opts.practice && !bestFor(r.pack.level.id).cleared ? 'FIRST CLEAR' : '';
  }
  if (r.finale) $('finaleFill').style.transform = `scaleX(${r.progress.toFixed(3)})`;
  if (r.opts.tutorial) {
    let k = 0;
    LESSONS.forEach(([b], i) => { if (beat >= b) k = i; });
    if (k !== hud.lesson) { hud.lesson = k; $('tutorText').innerHTML = LESSONS[k][1]; }
    $('progFill').style.transform = `scaleX(${Math.max(0, Math.min(1, beat / TUTORIAL_BEATS)).toFixed(3)})`;
  }
}

// ------------------------------------------------------------------ input: one button
function tap(t: number): void {
  if (!run || screen !== 'play') return;
  if (run.state === 'failed') { run.skipWait(); return; } // tap to retry at once
  if (!run.opts.bot) run.tap(t);
}
window.addEventListener('pointerdown', (e) => {
  audioReady = true;
  const btn = (e.target as HTMLElement).closest('button');
  if (btn && screen !== 'play' && audio.ctx) audio.hit('tap', 0.5); // every button answers with a click
  if (btn && screen !== 'play') feel('pick');
  if (screen !== 'play' || btn) return;
  e.preventDefault();
  fingers.add(e.pointerId);
  tap(stamp(e));
}, { passive: false });
// Holds: the button is down while any finger (or key) is. Letting the last one go is the release.
const fingers = new Set<number>();
const keysDown = new Set<string>();
function letGo(t: number): void {
  if (fingers.size || keysDown.size) return;
  if (run && screen === 'play' && !run.opts.bot) run.release(t);
}
for (const type of ['pointerup', 'pointercancel'] as const) window.addEventListener(type, (e) => { if (fingers.delete(e.pointerId)) letGo(stamp(e)); });
window.addEventListener('keyup', (e) => { if (keysDown.delete(e.code)) letGo(stamp(e)); });
window.addEventListener('blur', () => { fingers.clear(); keysDown.clear(); letGo(performance.now()); });
// iOS Safari only lets sound start from the end of a touch (or a click), not from its start: wake the audio there too.
// The same call brings it back after a phone call or a trip to another app.
for (const type of ['pointerup', 'touchend', 'click'] as const) window.addEventListener(type, () => { if (audio.ctx && !audio.running && !(run && (run.state === 'paused' || run.state === 'resuming'))) void audio.resume(); }, { capture: true, passive: true });
// The title opens on the finished tap (a click), not on the touch going down: a touch that changes the screen under the
// finger would land its click on whatever appears there, and start a level. A click is also what lets iOS start the sound.
$('title').addEventListener('click', () => { if (screen !== 'title') return; audio.ensure(); audio.setVolumes(save.music, save.sfx); show('levels'); });
window.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
  audioReady = true;
  const back = e.code === 'Escape';
  if (screen === 'calib') { if (!back) { e.preventDefault(); calTap(stamp(e)); } else closeCalib(); return; }
  if (screen === 'record') { if (record.key(e)) e.preventDefault(); return; }
  if (screen === 'title') { e.preventDefault(); audio.ensure(); show('levels'); return; }
  if (screen === 'levels') {
    const step = e.code === 'ArrowLeft' || e.code === 'ArrowDown' ? -1 : e.code === 'ArrowRight' || e.code === 'ArrowUp' ? 1 : 0;
    if (step) { e.preventDefault(); select(NODES[Math.max(0, Math.min(NODES.length - 1, NODES.indexOf(at) + step))].id); }
    else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); begin(false); } else if (e.code === 'KeyP') begin(true); else if (back) show('title');
    return;
  }
  if (screen === 'play') {
    if (back || e.code === 'KeyP') pause(); else if (e.code === 'KeyR' && !run?.opts.tutorial) startRun(-1, true); else if (e.code !== 'Tab') { e.preventDefault(); keysDown.add(e.code); tap(stamp(e)); } // any key is the button
    return;
  }
  if (screen === 'pause') { if (back || e.code === 'Space' || e.code === 'Enter') resume(); else if (e.code === 'KeyR') startRun(-1, true); return; }
  if (screen === 'results') { if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyR') { e.preventDefault(); startRun(); } else if (back) toLevels(); return; }
  if (back) { if (screen === 'settings') closeSettings(); else show('levels'); }
});

function pause(): void {
  if (!run || screen !== 'play' || run.state !== 'playing' || run.finale) return;
  fingers.clear();
  keysDown.clear();
  run.release(performance.now()); // a held button does not stay held through a pause
  run.pause();
  showSync('pauseSyncText', 'pauseSyncFix');
  const tut = !!run.opts.tutorial;
  for (const id of ['pauseRestartBtn', 'pausePracticeBtn', 'pauseSkipBtn']) $(id).classList.toggle('hidden', tut);
  $('pauseSkipBtn').classList.toggle('hidden', tut || buildStart() < 0);
  show('pause');
}
function resume(): void {
  if (!run || screen !== 'pause') return;
  show('play');
  run.resume();
}
function toLevels(): void {
  run?.stop();
  run = null;
  botMode = false;
  show('levels');
}
/** Quitting shows what the visit came to (how far, flow, sync) before going back to the levels. */
function quit(): void {
  if (!run) { toLevels(); return; }
  const r = run;
  if (r.opts.tutorial) { r.stop(); run = null; show('levels'); return; }
  tally(r);
  const reached = r.pct;
  r.stop();
  if (session.far === 0 && reached === 0 && session.attempts <= 1) { toLevels(); return; }
  showResults(r, false, reached);
}
/** Where the build-up before the drop begins (the first charge section), as a song time. */
function buildStart(): number {
  let beat = 0;
  for (const s of pack.level.segments) {
    if (s.core?.charge) return Math.max(0, beat - 8) * 60 / pack.audio.bpm; // two bars of run-up before it
    beat += s.bars * 4;
  }
  return -1;
}
/** The game left the screen (another tab or app, the home screen, a call): stop the run and the music, and save. */
function away(): void {
  pause();
  record.halt();
  audio.stopPreview(0.2);
  persist();
  if (!(run && (screen === 'play' || screen === 'pause'))) void audio.suspend(); // nothing keeps playing behind another app
}
function back(): void {
  if (screen === 'levels') queuePreview();
}
document.addEventListener('visibilitychange', () => { if (document.hidden) away(); else back(); });
window.addEventListener('pagehide', persist);
watchBackground(away, back);
window.addEventListener('resize', () => { renderer.resize(); show(screen); });

// ------------------------------------------------------------------ settings
// Installing the website as an app: Chrome and Android offer a prompt; on an iPhone it is done from Safari's Share menu.
type InstallEvent = Event & { prompt: () => Promise<unknown> };
let installEvent: InstallEvent | null = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e as InstallEvent; });
function installHint(): boolean {
  if (isNative) return false;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const installed = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !installed;
}
function renderSettings(): void {
  $<HTMLInputElement>('setMusic').value = String(save.music);
  $<HTMLInputElement>('setSfx').value = String(save.sfx);
  $<HTMLInputElement>('setHit').value = String(save.hitVol);
  showVolumes();
  $('aoVal').textContent = fmtMs(save.audioOffset);
  $('voVal').textContent = fmtMs(save.visualOffset);
  $('setMotion').classList.toggle('on', save.reducedMotion);
  $('setSync').classList.toggle('on', save.syncOverlay);
  $('setUnlock').classList.toggle('on', save.unlockAll);
  $('setHaptics').classList.toggle('on', save.haptics);
  $('setHaptics').classList.toggle('hidden', !canHaptics);
  $('gcBtn').classList.toggle('hidden', !gameCenter.available);
  $('installNote').classList.toggle('hidden', !installHint());
  $('installBtn').classList.toggle('hidden', !installEvent);
  $('syncBtn').textContent = !save.calibrated ? 'Sync check needed' : deviceChanged ? 'Audio changed: check' : 'Sync check · 10 s';
  $('recordBtn').classList.toggle('hidden', !import.meta.env.DEV);
  const lat = Math.round(audio.latency() * 1000);
  $('setInfo').textContent = `${audio.ctx ? `This device reports ${lat} ms of output delay, already allowed for. ` : ''}Changed headphones or speakers? Run the sync check again.`;
}
/** Each slider says its value, so a saved setting can be read at a glance (and 0 reads as Off, not as a blank bar). */
function showVolumes(): void {
  for (const [id, v] of [['setMusicVal', save.music], ['setSfxVal', save.sfx], ['setHitVal', save.hitVol]] as const) {
    const el = $(id);
    el.textContent = v <= 0 ? 'Off' : `${Math.round(v * 100)}%`;
    el.classList.toggle('off', v <= 0);
  }
}
function openSettings(from: Screen): void {
  settingsFrom = from;
  audio.ensure();
  renderSettings();
  show('settings');
}
function closeSettings(): void {
  persist();
  show(settingsFrom === 'pause' ? 'pause' : 'levels');
}
function nudge(key: 'audioOffset' | 'visualOffset', by: number): void {
  save[key] = Math.max(-200, Math.min(400, save[key] + by));
  persist();
  renderSettings();
}
function toggle(key: 'reducedMotion' | 'syncOverlay' | 'unlockAll' | 'haptics'): void {
  save[key] = !save[key];
  persist();
  renderSettings();
}

// ------------------------------------------------------------------ calibration
// Audio: tap along to a click; the average distance between taps and clicks becomes the audio offset.
// Visual: no sound; tap when the ball crosses the mark; the average becomes the visual offset.
const CAL_PERIOD = 0.6;
const CAL_NEED = 8;
const cal = { mode: 'audio' as 'audio' | 'visual', running: false, clicks: [] as number[], taps: [] as number[], startPerf: 0, timer: 0, quick: false, then: 'back' as 'begin' | 'back', from: 'settings' as Screen, done: false };

function renderCal(): void {
  $('calAudioTab').classList.toggle('on', cal.mode === 'audio');
  $('calVisualTab').classList.toggle('on', cal.mode === 'visual');
  $('calTabs').classList.toggle('hidden', cal.quick);
  $('calStart').classList.toggle('hidden', cal.quick && cal.running);
  $('calClose').textContent = cal.quick ? (cal.then === 'begin' ? 'Skip (not recommended)' : 'Cancel') : 'Done';
  $('calTitle').textContent = cal.quick ? 'SYNC CHECK' : 'CALIBRATION';
  $('calText').textContent = cal.quick
    ? `${deviceChanged && save.calibrated ? 'Your audio output has changed. ' : ''}Tap along to the click 8 times, going by what you hear. It lines the game up with your speakers or headphones. Do it again whenever you change them: Bluetooth adds 150 to 250 ms.`
    : cal.mode === 'audio'
    ? 'Press Start, then tap in time with the click, 8 times. Go by what you hear. Use the speakers or headphones you will play with.'
    : 'No sound here. Press Start, then tap each time the ball crosses the mark at the top of the ring.';
  const dots = $('calDots');
  dots.innerHTML = '';
  for (let i = 0; i < CAL_NEED; i++) { const d = document.createElement('i'); if (i < cal.taps.length) d.className = 'on'; dots.appendChild(d); }
  $('calStart').textContent = cal.running ? 'Restart' : 'Start';
}
function calStart(): void {
  audio.ensure();
  audio.stopPreview(0.2);
  cal.running = true;
  cal.taps = [];
  cal.clicks = [];
  $('calResult').textContent = cal.mode === 'audio' ? 'Listening…' : 'Watching…';
  clearTimeout(cal.timer);
  if (cal.mode === 'audio' && audio.ctx) {
    void audio.resume().then(() => {
      const t0 = audio.ctx!.currentTime + 0.8;
      for (let i = 0; i < 40; i++) { const t = t0 + i * CAL_PERIOD; cal.clicks.push(t); audio.hit(i % 4 === 0 ? 'clickHi' : 'click', 1, t); }
    });
  } else cal.startPerf = performance.now() + 600;
  cal.timer = window.setTimeout(() => { if (cal.running) { cal.running = false; $('calResult').textContent = 'Timed out. Press Start to try again.'; renderCal(); } }, 26000);
  renderCal();
}
function calTap(t: number): void {
  if (!cal.running) return;
  let d: number;
  if (cal.mode === 'audio') {
    if (!cal.clicks.length) return;
    const heard = audio.ctxTimeAt(t) - audio.latency();
    if (heard < cal.clicks[2] - CAL_PERIOD / 2) return; // let the first clicks set the pulse
    d = Infinity;
    for (const c of cal.clicks) if (Math.abs(heard - c) < Math.abs(d)) d = heard - c;
  } else {
    const x = (t - cal.startPerf) / 1000;
    if (x < CAL_PERIOD * 1.5) return;
    d = ((x + CAL_PERIOD / 2) % CAL_PERIOD) - CAL_PERIOD / 2;
  }
  if (Math.abs(d) > 0.25) return;
  cal.taps.push(d * 1000);
  if (cal.taps.length >= CAL_NEED) {
    const sorted = [...cal.taps].sort((a, b) => a - b);
    const core = sorted.slice(1, -1);
    const mean = core.reduce((s, v) => s + v, 0) / core.length;
    const sd = Math.sqrt(core.reduce((s, v) => s + (v - mean) * (v - mean), 0) / core.length);
    cal.running = false;
    clearTimeout(cal.timer);
    if (sd > 40) $('calResult').textContent = `Taps were too uneven (±${Math.round(sd)} ms). Try again.`;
    else {
      const v = Math.max(-200, Math.min(400, Math.round(mean)));
      if (cal.mode === 'audio') { save.audioOffset = v; save.calLatency = audio.latency(); cal.done = true; sync.press.length = sync.flow.length = 0; } else save.visualOffset = v;
      persist();
      $('calResult').textContent = `${cal.mode === 'audio' ? 'Audio' : 'Visual'} offset set to ${fmtMs(v)} (your taps were within ±${Math.round(sd)} ms).`;
      if (cal.quick) window.setTimeout(() => { if (screen === 'calib' && cal.quick) closeCalib(); }, 1200);
    }
  }
  renderCal();
}
/** quick: the 10-second sync check. then 'begin': it came up on the way into a level, which starts when it is done. */
function openCalib(quick = false, then: 'begin' | 'back' = 'back'): void {
  cal.quick = quick;
  cal.then = then;
  cal.from = screen === 'calib' ? cal.from : screen;
  cal.done = false;
  if (quick) cal.mode = 'audio';
  cal.running = false;
  cal.taps = [];
  $('calResult').textContent = '';
  renderCal();
  show('calib');
  if (quick) calStart();
}
function closeCalib(): void {
  cal.running = false;
  clearTimeout(cal.timer);
  void audio.suspend().then(() => audio.resume()); // drops any clicks still queued
  if (cal.quick) {
    cal.quick = false;
    if (cal.then === 'begin' || cal.done) {
      // done, or skipped on the way in: it is not forced again until the audio output changes
      save.calibrated = true;
      if (save.calLatency < 0 || cal.done) save.calLatency = audio.latency();
      deviceChanged = false;
      persist();
    }
    if (cal.then === 'begin') { show('levels'); window.setTimeout(enter, 60); return; }
    if (cal.from === 'results' || cal.from === 'pause') { toLevels(); return; }
    if (cal.from === 'settings') { renderSettings(); show('settings'); return; }
    show('levels');
    return;
  }
  renderSettings();
  show('settings');
}

// ------------------------------------------------------------------ orbs and badges
function renderOrbs(): void {
  const list = $('orbList');
  list.innerHTML = '';
  for (const o of ORBS) {
    const open = owned(o);
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `tile${save.skin === o.id ? ' on' : ''}${open ? '' : ' locked'}`;
    el.style.setProperty('--c', `rgb(${o.rgb.join(',')})`);
    el.innerHTML = `<span class="swatch"></span><b></b><small></small><span class="state">${save.skin === o.id ? `${icon('check')}EQUIPPED` : open ? '' : `${icon('lock')}LOCKED`}</span>`;
    el.querySelector('b')!.textContent = o.name;
    el.querySelector('small')!.textContent = open ? (save.skin === o.id ? 'Your ball right now' : 'Tap to equip') : o.how;
    el.setAttribute('aria-label', `${o.name} orb${open ? '' : `, locked: ${o.how}`}`);
    el.addEventListener('click', () => { if (!open) return; save.skin = o.id; persist(); renderOrbs(); });
    list.appendChild(el);
  }
}
function renderBadges(): void {
  const list = $('badgeList');
  list.innerHTML = '';
  let got = 0;
  for (const b of BADGES) {
    const has = !!save.badges[b.id];
    if (has) got++;
    const el = document.createElement('div');
    el.className = `tile${has ? ' got' : ' locked'}`;
    el.innerHTML = `<span class="star">${icon('badge')}</span><b></b><small></small><span class="state">${has ? `${icon('check')}EARNED` : icon('lock')}</span>`;
    el.querySelector('.star svg')!.setAttribute('style', 'width:100%;height:100%');
    el.querySelector('b')!.textContent = b.name;
    el.querySelector('small')!.textContent = b.desc;
    list.appendChild(el);
  }
  $('badgeCount').textContent = `${got} of ${BADGES.length} earned. Each one says how to earn it.`;
}

function renderQuests(): void {
  const list = $('questList');
  list.innerHTML = '';
  let done = 0;
  for (const p of PACKS) {
    const id = p.level.id;
    const both = questSet(id, save.quests);
    const orb = ORBS.find((o) => o.needs === `quests:${id}`);
    const g = document.createElement('div');
    g.className = 'qgroup';
    g.style.setProperty('--tint', (LEVEL_UI[id] ?? { col: '#19e3ff' }).col);
    const rows = questsFor(id).map((q) => {
      const on = !!save.quests[q.id];
      if (on) done++;
      return `<div class="qrow${on ? ' on' : ''}">${icon('quest')}<div><b>${q.name}</b>${q.desc}</div><span class="state">${on ? 'DONE' : ''}</span></div>`;
    });
    g.innerHTML = `<h4><span></span><small>${TIERS[id] ?? ''}</small></h4>${rows.join('')}${orb ? `<div class="qreward${both ? ' on' : ''}"><span class="dot" style="background:rgb(${orb.rgb.join(',')})"></span>${both ? `Both done: the ${orb.name} orb is yours` : `Both quests: the ${orb.name} orb`}</div>` : ''}`;
    g.querySelector('h4 span')!.textContent = shortTitle(p);
    list.appendChild(g);
  }
  $('questCount').textContent = `${done} of ${QUESTS.length} done. A quest is completed by a clear that counts: not practice, not autoplay.`;
}

// ------------------------------------------------------------------ wiring
$('lvBack').addEventListener('click', () => show('title'));
$('playBtn').addEventListener('click', () => begin(false));
$('practiceBtn').addEventListener('click', () => begin(true));
$('orbsBtn').addEventListener('click', () => { renderOrbs(); show('orbs'); });
$('badgesBtn').addEventListener('click', () => { renderBadges(); show('badges'); });
$('settingsBtn').addEventListener('click', () => openSettings('levels'));
$('orbsClose').addEventListener('click', () => show('levels'));
$('badgesClose').addEventListener('click', () => show('levels'));
$('questsBtn').addEventListener('click', () => { renderQuests(); show('quests'); });
$('questsClose').addEventListener('click', () => show('levels'));
$('pauseBtn').addEventListener('click', pause);
$('resumeBtn').addEventListener('click', resume);
$('pauseRestartBtn').addEventListener('click', () => startRun(-1, true));
$('pausePracticeBtn').addEventListener('click', () => { if (!run) return; const seg = run.level.segAt(Math.max(0, run.time)); practice = true; if (seg.t0 <= run.t0 + 0.01) startRun(); else startRun(seg.t0); });
$('pauseSkipBtn').addEventListener('click', () => { practice = true; startRun(buildStart()); });
$('pauseSettingsBtn').addEventListener('click', () => openSettings('pause'));
$('pauseQuitBtn').addEventListener('click', quit);
$('pauseSyncCal').addEventListener('click', () => { run?.stop(); run = null; openCalib(true); });
$('retryBtn').addEventListener('click', () => { session.far = 0; session.newBest = false; startRun(); });
$('nextBtn').addEventListener('click', () => { if (levelIdx + 1 < PACKS.length && levelOpen(levelIdx + 1)) { run?.stop(); run = null; focusLevel(levelIdx + 1); show('levels'); } });
$('resLevelsBtn').addEventListener('click', toLevels);
$('resSyncCal').addEventListener('click', () => { run?.stop(); run = null; openCalib(true); });
$('tutorSkip').addEventListener('click', () => { run?.stop(); endTutorial(); });
$('settingsClose').addEventListener('click', closeSettings);
$('setMusic').addEventListener('input', (e) => { save.music = Number((e.target as HTMLInputElement).value); audio.setVolumes(save.music, save.sfx); showVolumes(); });
$('setSfx').addEventListener('input', (e) => { save.sfx = Number((e.target as HTMLInputElement).value); audio.setVolumes(save.music, save.sfx); audio.hit('impact', 0.6); showVolumes(); });
$('setHit').addEventListener('input', (e) => { save.hitVol = Number((e.target as HTMLInputElement).value); audio.hit('hit', save.hitVol); showVolumes(); });
for (const id of ['setMusic', 'setSfx', 'setHit']) $(id).addEventListener('change', persist); // saved as soon as the slider is let go
$('aoMinus').addEventListener('click', () => nudge('audioOffset', -5));
$('aoPlus').addEventListener('click', () => nudge('audioOffset', 5));
$('voMinus').addEventListener('click', () => nudge('visualOffset', -5));
$('voPlus').addEventListener('click', () => nudge('visualOffset', 5));
$('setMotion').addEventListener('click', () => toggle('reducedMotion'));
$('setSync').addEventListener('click', () => toggle('syncOverlay'));
$('setUnlock').addEventListener('click', () => toggle('unlockAll'));
$('setHaptics').addEventListener('click', () => { toggle('haptics'); feel('big'); });
$('gcBtn').addEventListener('click', () => void gameCenter.show());
$('ranksBtn').addEventListener('click', () => void gameCenter.show());
$('ranksBtn').classList.toggle('hidden', !gameCenter.available);
$('installBtn').addEventListener('click', () => { void installEvent?.prompt(); installEvent = null; renderSettings(); });
$<HTMLAnchorElement>('privacyLink').href = isNative ? `${import.meta.env.VITE_SITE_URL}privacy.html` : './privacy.html';
$('syncBtn').addEventListener('click', () => { audio.ensure(); audio.setVolumes(save.music, save.sfx); openCalib(true); });
$('calibBtn').addEventListener('click', () => openCalib(false));
$('botBtn').addEventListener('click', () => { botMode = true; practice = false; session.far = session.onBeat = session.judged = session.streak = session.attempts = 0; session.drop = -1; startRun(); });
$('replayTutorial').addEventListener('click', () => { save.tutorialDone = false; persist(); focusLevel(0, false); practice = false; botMode = false; audio.ensure(); startTutorial(); });
$('recordBtn').addEventListener('click', () => { run?.stop(); run = null; audio.stopPreview(0.2); record.open(); });
$('calAudioTab').addEventListener('click', () => { cal.mode = 'audio'; cal.running = false; cal.taps = []; $('calResult').textContent = ''; renderCal(); });
$('calVisualTab').addEventListener('click', () => { cal.mode = 'visual'; cal.running = false; cal.taps = []; $('calResult').textContent = ''; void audio.suspend().then(() => audio.resume()); renderCal(); });
$('calStart').addEventListener('click', calStart);
$('calClose').addEventListener('click', closeCalib);
$('calPad').addEventListener('pointerdown', (e) => { e.preventDefault(); calTap(stamp(e)); });

const record = initRecord({
  pack: () => PACKS[levelIdx],
  show: (s) => { if (s === 'record') show('record'); else { renderSettings(); show('settings'); } },
  play: (from) => { botMode = false; practice = true; startRun(from); }
});
for (const p of PACKS) void refreshBars(p);

const credits = $('creditList');
for (const t of manifest.tracks) { const d = document.createElement('div'); d.textContent = creditLine(t); credits.appendChild(d); }
$('licenceNote').textContent = manifest.licenceNote;

function tick(now: number): void {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  if (run && (screen === 'play' || screen === 'pause')) {
    run.frame(now);
    if (!run.opts.bot) for (const ev of run.events) {
      if (ev.kind === 'hop' || ev.kind === 'flip') feel(ev.smash || ev.sling ? 'big' : 'tap');
      else if (ev.kind === 'tick') feel('tap'); // gold along a hold: a light tick under the thumb
      else if (ev.kind === 'star') feel('win');
      else if (ev.kind === 'drop') feel('big');
      else if (ev.kind === 'crash') feel('crash');
      else if (ev.kind === 'finale') feel('win');
    }
    for (const ev of run.events) if (ev.kind === 'star') toast('STAR COLLECTED', true);
    renderer.draw(run, now, dt);
    updateHud(run);
  } else if (screen === 'calib' && cal.mode === 'visual') {
    renderer.drawMetronome(now, cal.running ? Math.max(0, (now - cal.startPerf) / 1000 / CAL_PERIOD) % 1 : 0);
  } else {
    audio.tick(now);
    renderer.drawIdle(now, dt);
    if (screen === 'record') record.tick(now);
  }
}
function loop(now: number): void {
  tick(now);
  requestAnimationFrame(loop);
}

// The App Store build: full screen, and Game Center gets everything already earned on this device.
fullScreen();
void gameCenter.signIn().then((ok) => {
  if (!ok) return;
  for (const [id, b] of Object.entries(save.bests)) if (b.pct > 0 && !id.includes('-')) gameCenter.best(id, b.pct);
  for (const id of Object.keys(save.badges)) if (save.badges[id]) gameCenter.badge(id);
});
// The website keeps a copy of itself, so it opens with no connection after the first visit.
if (import.meta.env.PROD && import.meta.env.MODE !== 'single' && !isNative && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('./sw.js').catch(() => undefined); });
}

buildMap();
document.body.classList.add('boot');
show('title');
window.setTimeout(() => document.body.classList.remove('boot'), 400);
requestAnimationFrame(loop);

// Hooks for tests and debugging; the game itself never reads these.
Object.assign(window, {
  __omo: {
    audio, save, renderer, session, sync, get run() { return run; }, get screen() { return screen; }, tick, show,
    level: (i: number) => focusLevel(i), select: (id: string) => select(id, true), quests: () => { renderQuests(); show('quests'); },
    start: (bot: boolean, prac = false, from = -1) => { botMode = bot; practice = prac; startRun(from); },
    tutorial: startTutorial, results: (cleared: boolean) => { if (run) showResults(run, cleared, run.pct); }, orbs: () => { renderOrbs(); show('orbs'); }, badges: () => { renderBadges(); show('badges'); }, settings: () => openSettings('levels')
  }
});
