import './style.css';
import { audio } from './audio/audio';
import { BADGES, ORBS, earned } from './game/extras';
import { PACKS as ALL_PACKS, SLICE, creditLine, manifest, type LevelPack } from './game/packs';
import { refreshBars } from './gd/presses';
import { GdRenderer as Renderer } from './gd/render';
import { GdRun as Run, TUTORIAL_BEATS } from './gd/run';
import { canHaptics, feel, fullScreen, gameCenter, isNative, watchBackground } from './native';
import { initRecord } from './record';
import { bestFor, persist, save } from './save';
import { LEVEL_UI, icon, levelArt } from './ui/art';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
type Screen = 'title' | 'levels' | 'play' | 'pause' | 'results' | 'settings' | 'calib' | 'orbs' | 'badges' | 'record';
const SCREENS: Screen[] = ['title', 'levels', 'pause', 'results', 'settings', 'calib', 'orbs', 'badges', 'record'];

const PACKS = ALL_PACKS.filter((p) => SLICE.includes(p.level.id));
const shortTitle = (p: LevelPack) => p.level.title.replace(/ \(.*/, '');
/** Each level's own palette (its drop's), for the scene behind the menus. */
const levelPalette = (p: LevelPack) => (p.level.segments.find((s) => s.core?.smash) ?? p.level.segments[0]).look.palette;
let levelIdx = Math.max(0, Math.min(PACKS.length - 1, save.level || 0));
let pack = PACKS[levelIdx];
/** The setlist is the difficulty curve: clearing a level unlocks the next. (Playtest builds can open them all in Settings.) */
const levelOpen = (i: number) => save.unlockAll || /[?&]unlock=1/.test(location.search) || i === 0 || bestFor(PACKS[i - 1].level.id).cleared;

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
  renderer.idlePal = s === 'title' ? 'deep' : levelPalette(pack);
  if (s === 'levels') { renderCards(); queuePreview(); }
  if (s === 'title' || s === 'play') audio.stopPreview(s === 'play' ? 0.9 : 0.4);
}

// ------------------------------------------------------------------ level select
const cards = $('cards');
function buildCards(): void {
  cards.innerHTML = '';
  $('dots').innerHTML = '';
  PACKS.forEach((p, i) => {
    const ui = LEVEL_UI[p.level.id] ?? { col: '#19e3ff', dots: 1 };
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `card${i === PACKS.length - 1 ? ' final' : ''}`;
    el.style.setProperty('--tint', ui.col);
    el.dataset.i = String(i);
    el.innerHTML = `<div class="art">${levelArt(p.level.id)}<span class="lvl">LEVEL ${i + 1}</span>${i === PACKS.length - 1 ? '<span class="tag">FINAL LEVEL</span>' : ''}<div class="lock hidden">${icon('lock')}<span></span></div></div>
      <div class="info"><h2></h2><div class="by"></div>
      <div class="diff">${Array.from({ length: 5 }, (_, k) => `<i class="${k < ui.dots ? 'on' : ''}"></i>`).join('')}<span></span></div>
      <div class="adds"></div>
      <div class="meter"><span>BEST</span><div><i></i></div><b></b></div>
      <div class="meter p"><span>PRACTICE</span><div><i></i></div><b></b></div>
      <div class="tries"></div></div>`;
    el.querySelector('h2')!.textContent = shortTitle(p);
    el.querySelector('.by')!.textContent = p.level.artist;
    el.querySelector('.diff span')!.textContent = (p.level.difficulty ?? '').toUpperCase();
    el.querySelector('.adds')!.textContent = p.level.adds ?? '';
    el.addEventListener('click', () => { if (i === levelIdx) begin(false); else focusLevel(i, true); });
    cards.appendChild(el);
    $('dots').appendChild(document.createElement('i'));
  });
}
function renderCards(): void {
  [...cards.children].forEach((node, i) => {
    const el = node as HTMLElement;
    const p = PACKS[i];
    const b = bestFor(p.level.id);
    const open = levelOpen(i);
    const best = b.cleared ? 100 : b.pct;
    const prac = Math.max(b.prac ?? 0, 0);
    el.classList.toggle('focus', i === levelIdx);
    el.classList.toggle('locked', !open);
    el.setAttribute('aria-label', `Level ${i + 1}, ${shortTitle(p)}, ${p.level.difficulty}${open ? `, best ${best} percent` : ', locked'}`);
    const lock = el.querySelector<HTMLElement>('.lock')!;
    lock.classList.toggle('hidden', open);
    if (!open) lock.querySelector('span')!.textContent = `Clear ${shortTitle(PACKS[i - 1])} to unlock`;
    const meters = el.querySelectorAll<HTMLElement>('.meter');
    meters[0].querySelector<HTMLElement>('i')!.style.width = `${best}%`;
    meters[0].querySelector('b')!.textContent = `${best}%`;
    meters[1].querySelector<HTMLElement>('i')!.style.width = `${prac}%`;
    meters[1].querySelector('b')!.textContent = `${prac}%`;
    el.querySelector('.tries')!.innerHTML = b.attempts ? `<b>${b.attempts}</b> attempt${b.attempts === 1 ? '' : 's'}${b.cleared ? ' · <b>cleared</b>' : ''}` : 'Not played yet';
    ($('dots').children[i] as HTMLElement).classList.toggle('on', i === levelIdx);
  });
  const open = levelOpen(levelIdx);
  $<HTMLButtonElement>('playBtn').disabled = !open;
  $<HTMLButtonElement>('practiceBtn').disabled = !open;
  $('playBtn').textContent = open ? 'PLAY' : 'LOCKED';
}
function focusLevel(i: number, scroll: boolean): void {
  i = Math.max(0, Math.min(PACKS.length - 1, i));
  const changed = i !== levelIdx;
  levelIdx = i;
  pack = PACKS[i];
  if (changed) { save.level = i; persist(); }
  renderCards();
  renderer.idlePal = levelPalette(pack);
  if (scroll) (cards.children[i] as HTMLElement).scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  if (changed) queuePreview();
}
let scrollTick = 0;
cards.addEventListener('scroll', () => {
  cancelAnimationFrame(scrollTick);
  scrollTick = requestAnimationFrame(() => {
    const mid = cards.scrollLeft + cards.clientWidth / 2;
    let best = levelIdx;
    let dist = Infinity;
    [...cards.children].forEach((n, i) => { const el = n as HTMLElement; const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid); if (d < dist) { dist = d; best = i; } });
    if (best !== levelIdx) focusLevel(best, false);
  });
}, { passive: true });
/** The focused level's song plays quietly from its drop: the preview. It needs one tap first (browsers hold audio until then). */
let audioReady = false;
let previewTimer = 0;
function queuePreview(): void {
  clearTimeout(previewTimer);
  if (!audioReady || screen !== 'levels') return;
  previewTimer = window.setTimeout(() => {
    if (screen !== 'levels') return;
    audio.setVolumes(save.music, save.sfx);
    void audio.preview(pack.audio, pack.audio.dropTime - pack.audio.offset - (4 * 60) / pack.audio.bpm);
  }, 320);
}

// ------------------------------------------------------------------ starting a level
/** PLAY or PRACTICE from the level select: sync check on a first run, the tutorial before level 1, then the card opens into the level. */
function begin(asPractice: boolean): void {
  if (!levelOpen(levelIdx) || $('levels').classList.contains('launch')) return;
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
  if (!levelOpen(levelIdx)) return;
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
    $('tcLevel').textContent = `LEVEL ${levelIdx + 1} · ${(pack.level.difficulty ?? '').toUpperCase()}${practice ? ' · PRACTICE' : ''}`;
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
    if (counted && pct > prev.pct) { save.bests[id] = { ...prev, pct }; persist(); session.newBest = true; gameCenter.best(id, pct); }
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
  if (cleared && counted) {
    save.bests[id] = { ...prev, pct: 100, cleared: true };
    const done = ALL_PACKS.map((p) => p.level.id).filter((x) => bestFor(x).cleared);
    const onBeatPct = r.sim.judged ? (r.sim.onBeat / r.sim.judged) * 100 : 0;
    const fresh = earned(id, { onBeatPct, dropPower: r.dropPower, bestStreak: r.sim.bestStreak, attempts: bestFor(id).attempts, practised: !!save.practiced[id] }, done).filter((b) => !save.badges[b]);
    if (first && levelIdx + 1 < PACKS.length && !save.unlockAll) unlocks.push(`<div class="unlock">${icon('play')}<div>NEXT LEVEL UNLOCKED<small>${shortTitle(PACKS[levelIdx + 1])} · ${PACKS[levelIdx + 1].level.difficulty}</small></div></div>`);
    gameCenter.best(id, 100);
    gameCenter.flow(id, onBeatPct);
    for (const bid of fresh) {
      save.badges[bid] = true;
      gameCenter.badge(bid);
      const b = BADGES.find((x) => x.id === bid);
      if (b) unlocks.push(`<div class="unlock">${icon('badge')}<div>BADGE: ${b.name.toUpperCase()}<small>${b.desc}</small></div></div>`);
      for (const o of ORBS) if (o.needs === bid) unlocks.push(`<div class="unlock"><span class="dot" style="background:rgb(${o.rgb.join(',')})"></span><div>ORB: ${o.name.toUpperCase()}<small>Equip it under Orbs</small></div></div>`);
    }
  }
  if (cleared && r.opts.practice) save.bests[id] = { ...bestFor(id), prac: 100 };
  persist();
  const pct = cleared ? 100 : Math.max(session.far, reached);
  $('results').querySelector('.results')!.classList.toggle('clear', cleared);
  $('resLevel').textContent = `LEVEL ${levelIdx + 1} · ${shortTitle(r.pack)} · ${(r.pack.level.difficulty ?? '').toUpperCase()}${r.opts.bot ? ' · AUTOPLAY' : r.opts.practice ? ' · PRACTICE' : ''}`;
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
  const sm = r.smoothness();
  $('resNote').textContent = r.opts.bot ? `Autoplay. Movement check: ${sm.frames} frames, clock speed never more than ${sm.worstPct.toFixed(2)}% off.` : cleared && r.dropFull === false ? `The drop played at ${Math.round(r.dropPower * 100)}%. Tap the roll's notes and arrive in flow for the full one.` : cleared && r.course.holds.length ? `Gold holds collected in full: ${r.sim.holdsFull} of ${r.course.holds.length}.` : '';
  console.log(`[one more orbit] ${r.opts.bot ? 'autoplay' : 'run'} ${cleared ? 'cleared' : 'left'} ${r.level.title}: ${r.sim.onBeat}/${r.sim.judged} taps on the beat, best streak ${r.sim.bestStreak}, drop at ${Math.round(r.dropPower * 100)}%. Movement check: ${sm.frames} frames, clock speed never more than ${sm.worstPct.toFixed(2)}% off (average ${sm.meanPct.toFixed(3)}%)`);
  showSync('resSyncText', 'resSyncFix');
  const next = $<HTMLButtonElement>('nextBtn');
  next.disabled = !(levelIdx + 1 < PACKS.length && levelOpen(levelIdx + 1));
  next.style.opacity = next.disabled ? '0.4' : '1';
  botMode = false;
  show('results');
}

// ------------------------------------------------------------------ HUD
const hud = { pct: -1, seg: '', count: '', crashShown: false, lesson: -1, finale: false };
function updateHud(r: Run): void {
  harvest(r);
  drawSyncOverlay();
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
    if (e.code === 'ArrowLeft') focusLevel(levelIdx - 1, true); else if (e.code === 'ArrowRight') focusLevel(levelIdx + 1, true);
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
    const open = !o.needs || !!save.badges[o.needs];
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

// ------------------------------------------------------------------ wiring
$('lvBack').addEventListener('click', () => show('title'));
$('lvPrev').addEventListener('click', () => focusLevel(levelIdx - 1, true));
$('lvNext').addEventListener('click', () => focusLevel(levelIdx + 1, true));
$('playBtn').addEventListener('click', () => begin(false));
$('practiceBtn').addEventListener('click', () => begin(true));
$('orbsBtn').addEventListener('click', () => { renderOrbs(); show('orbs'); });
$('badgesBtn').addEventListener('click', () => { renderBadges(); show('badges'); });
$('settingsBtn').addEventListener('click', () => openSettings('levels'));
$('orbsClose').addEventListener('click', () => show('levels'));
$('badgesClose').addEventListener('click', () => show('levels'));
$('pauseBtn').addEventListener('click', pause);
$('resumeBtn').addEventListener('click', resume);
$('pauseRestartBtn').addEventListener('click', () => startRun(-1, true));
$('pausePracticeBtn').addEventListener('click', () => { if (!run) return; const seg = run.level.segAt(Math.max(0, run.time)); practice = true; if (seg.t0 <= run.t0 + 0.01) startRun(); else startRun(seg.t0); });
$('pauseSkipBtn').addEventListener('click', () => { practice = true; startRun(buildStart()); });
$('pauseSettingsBtn').addEventListener('click', () => openSettings('pause'));
$('pauseQuitBtn').addEventListener('click', quit);
$('pauseSyncCal').addEventListener('click', () => { run?.stop(); run = null; openCalib(true); });
$('retryBtn').addEventListener('click', () => { session.far = 0; session.newBest = false; startRun(); });
$('nextBtn').addEventListener('click', () => { if (levelIdx + 1 < PACKS.length && levelOpen(levelIdx + 1)) { run?.stop(); run = null; focusLevel(levelIdx + 1, false); show('levels'); focusLevel(levelIdx, true); } });
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
  pack: () => pack,
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
      else if (ev.kind === 'drop') feel('big');
      else if (ev.kind === 'crash') feel('crash');
      else if (ev.kind === 'finale') feel('win');
    }
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
  for (const [id, b] of Object.entries(save.bests)) if (b.pct > 0) gameCenter.best(id, b.pct);
  for (const id of Object.keys(save.badges)) if (save.badges[id]) gameCenter.badge(id);
});
// The website keeps a copy of itself, so it opens with no connection after the first visit.
if (import.meta.env.PROD && import.meta.env.MODE !== 'single' && !isNative && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('./sw.js').catch(() => undefined); });
}

buildCards();
document.body.classList.add('boot');
show('title');
window.setTimeout(() => document.body.classList.remove('boot'), 400);
requestAnimationFrame(() => (cards.children[levelIdx] as HTMLElement | undefined)?.scrollIntoView({ inline: 'center', block: 'nearest' }));
requestAnimationFrame(loop);

// Hooks for tests and debugging; the game itself never reads these.
Object.assign(window, {
  __omo: {
    audio, save, renderer, session, sync, get run() { return run; }, get screen() { return screen; }, tick, show,
    level: (i: number) => focusLevel(i, false),
    start: (bot: boolean, prac = false, from = -1) => { botMode = bot; practice = prac; startRun(from); },
    tutorial: startTutorial, results: (cleared: boolean) => { if (run) showResults(run, cleared, run.pct); }, orbs: () => { renderOrbs(); show('orbs'); }, badges: () => { renderBadges(); show('badges'); }, settings: () => openSettings('levels')
  }
});
