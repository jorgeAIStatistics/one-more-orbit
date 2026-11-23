import './style.css';
import { audio } from './audio/audio';
import { errorStats } from './game/engine';
import { BADGES, ORBS, earned } from './game/extras';
import { PACKS, creditLine, manifest } from './game/packs';
import { Run } from './game/run';
import { Renderer } from './render/renderer';
import { bestFor, persist, save } from './save';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
type Screen = 'menu' | 'play' | 'pause' | 'results' | 'settings' | 'calib' | 'credits' | 'extras';

const unlockAll = /[?&]unlock=1/.test(location.search); // testing aid
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
  for (const id of ['menu', 'pause', 'results', 'settings', 'calib', 'credits', 'extras']) $(id).classList.toggle('hidden', id !== s);
  $('hud').classList.toggle('hidden', !(s === 'play' || s === 'pause'));
  if (s === 'menu') renderMenu();
}

// ------------------------------------------------------------------ menu
function renderMenu(): void {
  const b = bestFor(pack.level.id);
  const open = levelOpen(levelIdx);
  $('levelNo').textContent = `LEVEL ${levelIdx + 1} OF ${PACKS.length}`;
  $('trackName').textContent = (open ? '' : 'Locked: ') + pack.level.title;
  $('trackMeta').textContent = `${pack.level.artist} · ${pack.audio.bpm} BPM · ${fmtTime(pack.audio.length)} · drop at ${fmtTime(pack.audio.dropTime)}`;
  $('levelRating').textContent = `★ ${pack.chart.stars.toFixed(1)}`;
  $('levelBest').textContent = b.attempts === 0
    ? 'Not played yet'
    : `Best ${b.grade || '-'} · ${b.accuracy.toFixed(2)}% · ${b.score} · reached ${b.pct}% · ${b.attempts} attempt${b.attempts === 1 ? '' : 's'}${b.cleared ? ' · CLEARED' : ''}`;
  $('practiceBtn').classList.toggle('on', practice);
  $('hardcoreBtn').classList.toggle('on', save.hardcore);
  $('botBtn').classList.toggle('on', botMode);
  const play = $<HTMLButtonElement>('playBtn');
  play.disabled = !open;
  play.textContent = !open ? `CLEAR ${PACKS[levelIdx - 1].level.title.replace(/ \(.*/, '').toUpperCase()} TO UNLOCK` : botMode ? 'WATCH AUTOPLAY' : practice ? 'PRACTICE' : 'PLAY';
}

/** Starts an attempt. `from` is a song time: practice restarts from the last checkpoint. */
function startRun(from = 0): void {
  if (!levelOpen(levelIdx)) return;
  if (practice && !botMode && !save.practiced[pack.level.id]) { save.practiced[pack.level.id] = true; persist(); }
  audio.ensure();
  audio.setVolumes(save.music, save.sfx);
  run?.stop();
  const counted = !botMode && !practice;
  if (counted) {
    save.bests[pack.level.id] = { ...bestFor(pack.level.id), attempts: bestFor(pack.level.id).attempts + 1 };
    persist();
  }
  renderer.reset();
  run = new Run(pack, { bot: botMode, practice: practice && !botMode, hardcore: save.hardcore && counted, startAt: from }, onRunEnd);
  $('dropMark').style.left = `${(run.level.dropTime / run.level.endTime) * 100}%`;
  show('play');
  void run.start().then(() => { if (run && run.state === 'error') { alert(`Could not start the level: ${run.error}`); show('menu'); } });
}

// ------------------------------------------------------------------ results
function onRunEnd(r: Run): void {
  if (r !== run) return;
  const e = r.engine;
  const failed = e.failed;
  if (failed && r.opts.practice) {
    // practice: back to the last checkpoint (the start of the section; the one before if you fell right at its start)
    const seg = r.level.segAt(e.failT);
    const cp = e.failT - seg.t0 < 1.2 && seg.index > 0 ? r.level.segments[seg.index - 1].t0 : seg.t0;
    startRun(cp);
    return;
  }
  const pct = failed ? Math.floor(r.progress * 100) : 100;
  const id = r.pack.level.id;
  const prev = bestFor(id);
  const counted = !r.opts.bot && !r.opts.practice;
  const fresh: string[] = [];
  const newBest = counted && !failed && e.score > prev.score;
  if (counted) {
    const b = { ...prev };
    b.pct = Math.max(b.pct, pct);
    if (!failed) {
      b.cleared = true;
      if (e.score > b.score) { b.score = e.score; b.grade = e.grade; }
      b.accuracy = Math.max(b.accuracy, e.accuracy);
    }
    save.bests[id] = b;
    if (!failed) {
      const cleared = PACKS.map((p) => p.level.id).filter((x) => bestFor(x).cleared);
      for (const bid of earned(id, e.grade, e.counts.miss, !!r.opts.hardcore, !!save.practiced[id], cleared)) if (!save.badges[bid]) { save.badges[bid] = true; fresh.push(bid); }
    }
  }
  const news = fresh.map((bid) => BADGES.find((x) => x.id === bid)?.name || bid).map((n) => `Badge: ${n}`);
  for (const o of ORBS) if (o.needs && fresh.includes(o.needs)) news.push(`Orb: ${o.name}`);
  if (counted && !failed && !prev.cleared && levelIdx + 1 < PACKS.length) news.push(`Level: ${PACKS[levelIdx + 1].level.title.replace(/ \(.*/, '')}`);
  $('resUnlocks').textContent = news.length ? `Unlocked  ${news.join(' · ')}` : '';
  for (const s of r.level.segments) if (s.teach && s.t1 < r.time) save.teachSeen[s.id] = true;
  persist();
  const grade = e.grade;
  $('resTag').textContent = r.opts.bot ? 'AUTOPLAY · NOT SAVED' : r.opts.practice ? 'PRACTICE · NOT SAVED' : newBest ? '★ NEW BEST ★' : `ATTEMPT ${bestFor(id).attempts}`;
  const g = $('resGrade');
  g.textContent = grade;
  g.className = `grade g-${grade}`;
  $('resTitle').textContent = failed ? `FAILED AT ${pct}%` : 'LEVEL COMPLETE';
  $('resSub').textContent = `${r.level.title}${r.opts.hardcore ? ' · HARDCORE' : ''}${failed ? ` · best ${Math.max(prev.pct, pct)}%` : ''}`;
  $('resAcc').textContent = `${e.accuracy.toFixed(2)}%`;
  $('resScore').textContent = String(e.score);
  $('resCombo').textContent = String(e.maxCombo);
  $('resP').textContent = String(e.counts.perfect);
  $('resG').textContent = String(e.counts.great);
  $('resO').textContent = String(e.counts.good);
  $('resM').textContent = String(e.counts.miss);
  // timeline: how far you got, every miss, the main drop
  $('tlFill').style.transform = `scaleX(${pct / 100})`;
  $('tlDrop').style.left = `${(r.level.dropTime / r.level.endTime) * 100}%`;
  const marks = $('tlMarks');
  marks.innerHTML = '';
  for (const ev of e.log) {
    if (ev.judge !== 'miss') continue;
    const i = document.createElement('i');
    i.style.left = `${Math.max(0, Math.min(100, (ev.t / r.level.endTime) * 100))}%`;
    marks.appendChild(i);
  }
  if (failed) {
    const i = document.createElement('i');
    i.className = 'fail';
    i.style.left = `${pct}%`;
    marks.appendChild(i);
  }
  const st = errorStats(e.errs);
  const mean = st.mean * 1000;
  $('resTiming').textContent = st.n < 3 ? '' : Math.abs(mean) < 3
    ? `Average timing: dead on the beat (spread ±${Math.round(st.sd * 1000)} ms)`
    : `Average timing: ${Math.abs(Math.round(mean))} ms ${mean > 0 ? 'late' : 'early'} (spread ±${Math.round(st.sd * 1000)} ms)`;
  const suggest = !r.opts.bot && st.n >= 20 && Math.abs(mean) >= 10 && st.sd * 1000 < 45;
  $('resOffset').classList.toggle('hidden', !suggest);
  if (suggest) {
    const next = Math.max(-200, Math.min(400, save.audioOffset + Math.round(mean)));
    $('resOffsetText').textContent = `You were ${Math.abs(Math.round(mean))} ms ${mean > 0 ? 'late' : 'early'} all run. Set audio offset to ${fmtMs(next)}?`;
    $('resOffsetApply').onclick = () => { save.audioOffset = next; persist(); $('resOffset').classList.add('hidden'); };
  }
  show('results');
}

// ------------------------------------------------------------------ HUD
let hudScore = -1;
let hudCombo = -1;
let hudSeg = '';
function updateHud(r: Run): void {
  const e = r.engine;
  if (e.score !== hudScore) { hudScore = e.score; $('score').textContent = String(e.score); }
  if (e.combo !== hudCombo) { hudCombo = e.combo; $('combo').textContent = String(e.combo); }
  $('acc').textContent = `${e.accuracy.toFixed(2)}%`;
  const hf = $('healthFill');
  hf.style.transform = `scaleX(${Math.max(0, e.health) / 100})`;
  hf.classList.toggle('low', e.health < 35);
  $('progFill').style.transform = `scaleX(${r.progress.toFixed(4)})`;
  const label = r.level.segAt(Math.max(0, r.time)).label + (r.opts.bot ? ' · AUTOPLAY' : r.opts.practice ? ' · PRACTICE' : r.opts.hardcore ? ' · HARDCORE' : '');
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
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('resize', () => renderer.resize());

// ------------------------------------------------------------------ settings
function renderSettings(): void {
  $<HTMLInputElement>('setMusic').value = String(save.music);
  $<HTMLInputElement>('setSfx').value = String(save.sfx);
  $('aoVal').textContent = fmtMs(save.audioOffset);
  $('voVal').textContent = fmtMs(save.visualOffset);
  $('setErrorBar').classList.toggle('on', save.errorBar);
  $('setMotion').classList.toggle('on', save.reducedMotion);
  $('setHardcore').classList.toggle('on', save.hardcore);
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
function toggle(key: 'errorBar' | 'reducedMotion' | 'hardcore'): void {
  save[key] = !save[key];
  persist();
  renderSettings();
}

// ------------------------------------------------------------------ calibration
// Audio: tap along to a click; the average distance between taps and clicks becomes the audio offset.
// Visual: no sound; tap when the ball crosses the gate; the average becomes the visual offset.
const CAL_PERIOD = 0.6;
const CAL_NEED = 14;
const cal = { mode: 'audio' as 'audio' | 'visual', running: false, clicks: [] as number[], taps: [] as number[], startPerf: 0, timer: 0 };

function renderCal(): void {
  $('calAudioTab').classList.toggle('on', cal.mode === 'audio');
  $('calVisualTab').classList.toggle('on', cal.mode === 'visual');
  $('calText').textContent = cal.mode === 'audio'
    ? 'Press Start, then tap in time with the click. Go by what you hear. Use the speakers or headphones you will play with.'
    : 'No sound here. Press Start, then tap each time the ball crosses the gate at the top of the ring.';
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
    const core = sorted.slice(2, -2);
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
    }
  }
  renderCal();
}
function openCalib(): void {
  cal.running = false;
  cal.taps = [];
  $('calResult').textContent = '';
  renderCal();
  show('calib');
}
function closeCalib(): void {
  cal.running = false;
  clearTimeout(cal.timer);
  void audio.suspend().then(() => audio.resume()); // drops any clicks still queued
  renderSettings();
  show('settings');
}

// ------------------------------------------------------------------ wiring
$('playBtn').addEventListener('click', () => startRun());
$('practiceBtn').addEventListener('click', () => { practice = !practice; renderMenu(); });
$('hardcoreBtn').addEventListener('click', () => { save.hardcore = !save.hardcore; persist(); renderMenu(); });
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
$('setErrorBar').addEventListener('click', () => toggle('errorBar'));
$('setMotion').addEventListener('click', () => toggle('reducedMotion'));
$('setHardcore').addEventListener('click', () => toggle('hardcore'));
$('calibBtn').addEventListener('click', openCalib);
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
  } else renderer.drawIdle(now, dt);
}
function loop(now: number): void {
  tick(now);
  requestAnimationFrame(loop);
}

show('menu');
requestAnimationFrame(loop);

// Hooks for tests and debugging; the game itself never reads these.
Object.assign(window, {
  __omo: { audio, save, get run() { return run; }, tick, level: selectLevel, start: (bot: boolean, prac = false, from = 0) => { botMode = bot; practice = prac; startRun(from); } }
});
