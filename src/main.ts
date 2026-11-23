import './style.css';
import { audio } from './audio/audio';
import { BADGES, ORBS } from './game/extras';
import { PACKS as ALL_PACKS, SLICE, creditLine, manifest } from './game/packs';
import { GdRenderer as Renderer } from './gd/render';
import { refreshBars } from './gd/presses';
import { GdRun as Run } from './gd/run';
import { initRecord } from './record';
import { bestFor, persist, save } from './save';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
type Screen = 'menu' | 'play' | 'pause' | 'results' | 'settings' | 'calib' | 'credits' | 'extras' | 'record';

const unlockAll = /[?&]unlock=1/.test(location.search); // testing aid
const PACKS = ALL_PACKS.filter((p) => SLICE.includes(p.level.id));
let levelIdx = Math.max(0, Math.min(PACKS.length - 1, save.level || 0));
let pack = PACKS[levelIdx];
/** The setlist is the difficulty curve: clearing a level unlocks the next. */
const levelOpen = (i: number) => unlockAll || i === 0 || bestFor(PACKS[i - 1].level.id).cleared;
function selectLevel(i: number): void {
  levelIdx = (i + PACKS.length) % PACKS.length;
  pack = PACKS[levelIdx];
  save.level = levelIdx;
  persist();
  renderMenu();
}
const renderer = new Renderer($<HTMLCanvasElement>('stage'));
let screen: Screen = 'menu';
let settingsFrom: Screen = 'menu';
let run: Run | null = null;
let botMode = /[?&]bot=1/.test(location.search);
let practice = false;
let lastFrame = performance.now();

/** Input events carry the time the tap happened; fall back to "now" on browsers that report something else. */
const stamp = (e: Event) => (Math.abs(e.timeStamp - performance.now()) < 2000 ? e.timeStamp : performance.now());
const fmtMs = (ms: number) => `${ms > 0 ? '+' : ''}${Math.round(ms)} ms`;
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

function show(s: Screen): void {
  screen = s;
  for (const id of ['menu', 'pause', 'results', 'settings', 'calib', 'credits', 'extras', 'record']) $(id).classList.toggle('hidden', id !== s);
  $('hud').classList.toggle('hidden', !(s === 'play' || s === 'pause'));
  if (s === 'menu') renderMenu();
}

// ------------------------------------------------------------------ menu
function renderMenu(): void {
  const b = bestFor(pack.level.id);
  const open = levelOpen(levelIdx);
  $('levelNo').textContent = `LEVEL ${levelIdx + 1} OF ${PACKS.length}`;
  $('trackName').textContent = (open ? '' : 'Locked: ') + pack.level.title;
  const spb = 60 / pack.audio.bpm;
  const lab = pack.level.lab;
  $('menuTag').textContent = lab ? `FEEL LAB · ${fmtTime(lab[0] * spb)} TO ${fmtTime(lab[1] * spb)} OF THE SONG` : 'ONE MORE ORBIT';
  $('trackMeta').textContent = `${pack.level.artist} · ${pack.audio.bpm} BPM · ${lab ? `build-up into the first drop · ${Math.round((lab[1] - lab[0]) * spb)} s` : fmtTime(pack.audio.length)}`;
  $('levelRating').textContent = `★ ${pack.chart.stars.toFixed(1)}`;
  $('levelBest').textContent = b.attempts === 0
    ? 'Not played yet'
    : `Best ${b.cleared ? 100 : b.pct}% · ${b.attempts} attempt${b.attempts === 1 ? '' : 's'}${b.cleared ? ' · CLEARED' : ''}`;
  $('practiceBtn').classList.toggle('on', practice);
  $('botBtn').classList.toggle('on', botMode);
  const play = $<HTMLButtonElement>('playBtn');
  play.disabled = !open;
  play.textContent = !open ? `CLEAR ${PACKS[levelIdx - 1].level.title.replace(/ \(.*/, '').toUpperCase()} TO UNLOCK` : botMode ? 'WATCH AUTOPLAY' : practice ? 'PRACTICE' : 'PLAY';
}

/** Starts an attempt. `from` is a song time (practice restarts from a checkpoint); `quick` shortens the run-in after a crash. */
function startRun(from = -1, quick = false): void {
  if (!levelOpen(levelIdx)) return;
  audio.ensure();
  audio.setVolumes(save.music, save.sfx);
  if (!botMode && !save.calibrated && from < 0 && !quick) { openCalib(true); return; } // first run: a quick sync check
  if (practice && !botMode && !save.practiced[pack.level.id]) { save.practiced[pack.level.id] = true; persist(); }
  run?.stop();
  const counted = !botMode && !practice;
  if (counted) {
    save.bests[pack.level.id] = { ...bestFor(pack.level.id), attempts: bestFor(pack.level.id).attempts + 1 };
    persist();
  }
  renderer.reset();
  run = new Run(pack, { bot: botMode, practice: practice && !botMode, startAt: from >= 0 ? from : undefined, leadIn: from >= 0 ? 1.5 : quick ? 1.2 : 2 }, onRunEnd);
  const b = bestFor(pack.level.id);
  $('dropMark').style.left = `${((run.level.dropTime - run.t0) / (run.t1 - run.t0)) * 100}%`;
  $('bestMark').style.left = `${b.cleared ? 100 : b.pct}%`;
  $('bestMark').classList.toggle('hidden', b.pct === 0 && !b.cleared);
  $('bestPct').textContent = b.cleared ? 'CLEARED' : `BEST ${b.pct}%`;
  $('attempt').textContent = botMode ? 'AUTOPLAY' : practice ? 'PRACTICE' : `ATTEMPT ${b.attempts}`;
  hudPct = -1;
  show('play');
  void run.start().then(() => { if (run && run.state === 'error') { alert(`Could not start the level: ${run.error}`); show('menu'); } });
}

let toastTimer = 0;
function toast(text: string): void {
  const el = $('toast');
  el.textContent = text;
  el.classList.remove('show');
  void el.offsetWidth; // restart the animation
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), 1600);
}

// ------------------------------------------------------------------ end of an attempt
/** A crash restarts at once (practice: from the last checkpoint). Only a clear shows a results screen. */
function onRunEnd(r: Run): void {
  if (r !== run) return;
  const id = r.pack.level.id;
  const prev = bestFor(id);
  const counted = !r.opts.bot && !r.opts.practice;
  if (r.state === 'failed') {
    if (r.opts.practice) {
      // back to the start of the section; the one before if you fell right at its start
      const seg = r.level.segAt(r.crashTime);
      const cp = r.crashTime - seg.t0 < 1.2 && seg.index > 0 ? r.level.segments[seg.index - 1].t0 : seg.t0;
      startRun(Math.max(cp, r.t0));
      return;
    }
    const pct = r.pct;
    if (counted && pct > prev.pct) {
      save.bests[id] = { ...prev, pct };
      persist();
      if (pct >= 2) toast(`NEW BEST ${pct}%`);
    }
    startRun(-1, true);
    return;
  }
  if (counted) save.bests[id] = { ...prev, pct: 100, cleared: true };
  persist();
  const s = r.sim;
  $('resUnlocks').textContent = '';
  $('resTag').textContent = r.opts.bot ? 'AUTOPLAY · NOT SAVED' : r.opts.practice ? 'PRACTICE · NOT SAVED' : prev.cleared ? `ATTEMPT ${prev.attempts}` : '★ FIRST CLEAR ★';
  $('resTitle').textContent = r.pack.level.lab ? 'LAB COMPLETE' : 'LEVEL COMPLETE';
  $('resSub').textContent = r.level.title;
  $('resAttempts').textContent = counted ? String(bestFor(id).attempts) : '–';
  $('resOnBeat').textContent = s.judged ? `${Math.round((s.onBeat / s.judged) * 100)}%` : '–';
  $('resStreak').textContent = String(s.bestStreak);
  const sm = r.smoothness();
  const move = `Movement check: ${sm.frames} frames, clock speed never more than ${sm.worstPct.toFixed(2)}% off (average ${sm.meanPct.toFixed(3)}%)`;
  console.log(`[one more orbit] ${r.opts.bot ? 'autoplay' : 'run'} cleared ${r.level.title}: ${s.onBeat}/${s.judged} taps on the beat, best streak ${s.bestStreak}, drop ${r.dropFull ? 'in full' : 'small'}. ${move}`);
  $('resNote').textContent = r.opts.bot ? move : r.dropFull === false ? 'You reached the drop out of flow, so it played small. Arrive on the beat for the full one.' : r.dropFull ? 'You hit the drop in flow.' : '';
  show('results');
}

// ------------------------------------------------------------------ HUD
let hudPct = -1;
let hudSeg = '';
function updateHud(r: Run): void {
  const pct = r.pct;
  if (pct !== hudPct) { hudPct = pct; $('pct').textContent = `${pct}%`; }
  $('progFill').style.transform = `scaleX(${r.progress.toFixed(4)})`;
  const label = r.level.segAt(Math.max(0, r.time)).label;
  if (label !== hudSeg) { hudSeg = label; $('section').textContent = label; }
}

// ------------------------------------------------------------------ input: one button
function tap(t: number): void {
  if (run && screen === 'play' && !run.opts.bot) run.tap(t);
}

window.addEventListener('pointerdown', (e) => {
  if (screen !== 'play' || (e.target as HTMLElement).closest('button')) return;
  e.preventDefault();
  tap(stamp(e));
}, { passive: false });
window.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
  if (screen === 'calib') { if (e.code !== 'Escape') { e.preventDefault(); calTap(stamp(e)); } else closeCalib(); return; }
  if (screen === 'record') { if (record.key(e)) e.preventDefault(); return; }
  if (e.code === 'KeyR' && (screen === 'play' || screen === 'pause' || screen === 'results')) { startRun(); return; }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (screen === 'play') pause(); else if (screen === 'pause') resume(); else if (screen === 'settings') closeSettings(); else if (screen === 'credits' || screen === 'extras') show('menu');
    return;
  }
  if (screen === 'play') {
    if (e.code !== 'Tab') { e.preventDefault(); tap(stamp(e)); } // any key is the button
  } else if (e.code === 'Space' || e.code === 'Enter') {
    if (screen === 'menu' || screen === 'results') { e.preventDefault(); startRun(); } else if (screen === 'pause') resume();
  }
});

function pause(): void {
  if (!run || screen !== 'play' || run.state === 'failed' || run.state === 'done') return;
  run.pause();
  show('pause');
}
function resume(): void {
  if (!run || screen !== 'pause') return;
  show('play');
  run.resume();
}
function quit(): void {
  run?.stop();
  run = null;
  show('menu');
}
document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); record.halt(); } });
window.addEventListener('resize', () => renderer.resize());

// ------------------------------------------------------------------ settings
function renderSettings(): void {
  $<HTMLInputElement>('setMusic').value = String(save.music);
  $<HTMLInputElement>('setSfx').value = String(save.sfx);
  $('aoVal').textContent = fmtMs(save.audioOffset);
  $('voVal').textContent = fmtMs(save.visualOffset);
  $('setMotion').classList.toggle('on', save.reducedMotion);
  const lat = Math.round(audio.latency() * 1000);
  $('setInfo').textContent = audio.ctx ? `This device reports ${lat} ms of output delay, already compensated.` : '';
}
function openSettings(from: Screen): void {
  settingsFrom = from;
  audio.ensure();
  renderSettings();
  show('settings');
}
function closeSettings(): void {
  persist();
  show(settingsFrom === 'pause' ? 'pause' : 'menu');
}
function nudge(key: 'audioOffset' | 'visualOffset', by: number): void {
  save[key] = Math.max(-200, Math.min(400, save[key] + by));
  persist();
  renderSettings();
}
function toggle(key: 'reducedMotion'): void {
  save[key] = !save[key];
  persist();
  renderSettings();
}

// ------------------------------------------------------------------ calibration
// Audio: tap along to a click; the average distance between taps and clicks becomes the audio offset.
// Visual: no sound; tap when the ball crosses the mark; the average becomes the visual offset.
const CAL_PERIOD = 0.6;
const CAL_NEED = 8;
const cal = { mode: 'audio' as 'audio' | 'visual', running: false, clicks: [] as number[], taps: [] as number[], startPerf: 0, timer: 0, quick: false };

function renderCal(): void {
  $('calAudioTab').classList.toggle('on', cal.mode === 'audio');
  $('calVisualTab').classList.toggle('on', cal.mode === 'visual');
  $('calTabs').classList.toggle('hidden', cal.quick);
  $('calClose').textContent = cal.quick ? 'Skip' : 'Done';
  $('calText').textContent = cal.quick
    ? 'Quick sync check before your first run: tap along to the click 8 times. Go by what you hear.'
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
      if (cal.mode === 'audio') save.audioOffset = v; else save.visualOffset = v;
      persist();
      $('calResult').textContent = `${cal.mode === 'audio' ? 'Audio' : 'Visual'} offset set to ${fmtMs(v)} (your taps were within ±${Math.round(sd)} ms).`;
      if (cal.quick) { $('calResult').textContent += ' Starting…'; window.setTimeout(() => { if (screen === 'calib' && cal.quick) closeCalib(); }, 1100); }
    }
  }
  renderCal();
}
function openCalib(quick = false): void {
  cal.quick = quick;
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
    // done or skipped: either way it is not asked again (Settings has the full calibration)
    cal.quick = false;
    save.calibrated = true;
    persist();
    window.setTimeout(() => startRun(), 250);
    return;
  }
  renderSettings();
  show('settings');
}

// ------------------------------------------------------------------ wiring
$('playBtn').addEventListener('click', () => startRun());
$('practiceBtn').addEventListener('click', () => { practice = !practice; renderMenu(); });
$('botBtn').addEventListener('click', () => { botMode = !botMode; renderMenu(); });
$('settingsBtn').addEventListener('click', () => openSettings('menu'));
$('creditsBtn').addEventListener('click', () => show('credits'));
$('creditsClose').addEventListener('click', () => show('menu'));
$('levelPrev').addEventListener('click', () => selectLevel(levelIdx - 1));
$('levelNext').addEventListener('click', () => selectLevel(levelIdx + 1));
$('extrasBtn').addEventListener('click', () => { renderExtras(); show('extras'); });
$('extrasClose').addEventListener('click', () => show('menu'));
$('pauseBtn').addEventListener('click', pause);
$('resumeBtn').addEventListener('click', resume);
$('pauseRestartBtn').addEventListener('click', () => startRun());
$('pauseSettingsBtn').addEventListener('click', () => openSettings('pause'));
$('pauseQuitBtn').addEventListener('click', quit);
$('retryBtn').addEventListener('click', () => startRun());
$('resMenuBtn').addEventListener('click', quit);
$('settingsClose').addEventListener('click', closeSettings);
$('setMusic').addEventListener('input', (e) => { save.music = Number((e.target as HTMLInputElement).value); audio.setVolumes(save.music, save.sfx); });
$('setSfx').addEventListener('input', (e) => { save.sfx = Number((e.target as HTMLInputElement).value); audio.setVolumes(save.music, save.sfx); audio.hit('tap'); });
$('aoMinus').addEventListener('click', () => nudge('audioOffset', -5));
$('aoPlus').addEventListener('click', () => nudge('audioOffset', 5));
$('voMinus').addEventListener('click', () => nudge('visualOffset', -5));
$('voPlus').addEventListener('click', () => nudge('visualOffset', 5));
$('setMotion').addEventListener('click', () => toggle('reducedMotion'));
$('calibBtn').addEventListener('click', () => openCalib());
$('recordBtn').addEventListener('click', () => { run?.stop(); run = null; record.open(); });
$('calAudioTab').addEventListener('click', () => { cal.mode = 'audio'; cal.running = false; cal.taps = []; $('calResult').textContent = ''; renderCal(); });
$('calVisualTab').addEventListener('click', () => { cal.mode = 'visual'; cal.running = false; cal.taps = []; $('calResult').textContent = ''; void audio.suspend().then(() => audio.resume()); renderCal(); });
$('calStart').addEventListener('click', calStart);
$('calClose').addEventListener('click', closeCalib);
$('calPad').addEventListener('pointerdown', (e) => { e.preventDefault(); calTap(stamp(e)); });

function renderExtras(): void {
  const orbs = $('orbList');
  orbs.innerHTML = '';
  for (const o of ORBS) {
    const open = !o.needs || !!save.badges[o.needs];
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `orb${save.skin === o.id ? ' on' : ''}${open ? '' : ' locked'}`;
    el.innerHTML = '<i></i><b></b><small></small>';
    (el.querySelector('i') as HTMLElement).style.background = `rgb(${o.rgb.join(',')})`;
    (el.querySelector('b') as HTMLElement).textContent = o.name;
    (el.querySelector('small') as HTMLElement).textContent = open ? (save.skin === o.id ? 'Equipped' : 'Tap to equip') : o.how;
    el.addEventListener('click', () => { if (!open) return; save.skin = o.id; persist(); renderExtras(); });
    orbs.appendChild(el);
  }
  const badges = $('badgeList');
  badges.innerHTML = '';
  for (const b of BADGES) {
    const el = document.createElement('div');
    el.className = `badge${save.badges[b.id] ? ' on' : ''}`;
    el.innerHTML = '<b></b><small></small>';
    (el.querySelector('b') as HTMLElement).textContent = b.name;
    (el.querySelector('small') as HTMLElement).textContent = b.desc;
    badges.appendChild(el);
  }
}

const record = initRecord({
  pack: () => pack,
  show: (s) => show(s),
  play: (from) => { botMode = false; practice = true; startRun(from); }
});
void refreshBars(pack);

const list = $('creditList');
for (const t of manifest.tracks) { const d = document.createElement('div'); d.className = 'credit'; d.textContent = creditLine(t); list.appendChild(d); }
$('licenceNote').textContent = manifest.licenceNote;

function tick(now: number): void {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  if (run && (screen === 'play' || screen === 'pause')) {
    run.frame(now);
    renderer.draw(run, now, dt);
    updateHud(run);
  } else if (screen === 'calib' && cal.mode === 'visual') {
    renderer.drawMetronome(now, cal.running ? Math.max(0, (now - cal.startPerf) / 1000 / CAL_PERIOD) % 1 : 0);
  } else {
    renderer.drawIdle(now, dt);
    if (screen === 'record') record.tick(now);
  }
}
function loop(now: number): void {
  tick(now);
  requestAnimationFrame(loop);
}

show('menu');
requestAnimationFrame(loop);

// Hooks for tests and debugging; the game itself never reads these.
Object.assign(window, {
  __omo: { audio, save, get run() { return run; }, get screen() { return screen; }, tick, level: selectLevel, start: (bot: boolean, prac = false, from = -1) => { botMode = bot; practice = prac; startRun(from); } }
});
