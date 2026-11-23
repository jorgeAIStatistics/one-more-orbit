// Dev helper for screenshots: stages each screen of the game with sample progress, music muted, nothing saved.
// In the dev server's page:  await import('/tools/stage-shots.js');  await __stage('levels')
// Names: title, levels, final, moon, hidden, gate, entry, play, twin, tutorial, pause, quit, finale, clear, settings, orbs, badges, quests, sync.
Storage.prototype.setItem = function () {};
Object.defineProperty(document, 'hidden', { get: () => false });
const o = window.__omo;
const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
Object.assign(o.save, { music: 0, sfx: 0, hitVol: 0, calibrated: true, calLatency: -1, tutorialDone: true, audioOffset: 0 });
window.__errs = [];
window.addEventListener('error', (e) => window.__errs.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => window.__errs.push('rej ' + String(e.reason)));
// the preview pane does not run animation frames while hidden, so the page is driven by a timer
const drive = () => { clearInterval(window.__drv); window.__drv = setInterval(() => { try { o.tick(performance.now()); } catch (e) { window.__errs.push(String((e && e.stack) || e).slice(0, 300)); } }, 12); };
drive();
const st = document.createElement('style');
st.textContent = '.screen,.finale,.node,.node *,.meter i,.track i{transition:none!important}';
document.head.appendChild(st);
const demo = (open) => {
  o.save.unlockAll = open;
  o.save.bests = { heroes: { score: 0, accuracy: 0, pct: 100, grade: '', cleared: true, attempts: 14, prac: 100 }, skyhigh: { score: 0, accuracy: 0, pct: 64, grade: '', cleared: false, attempts: 9, prac: 82 } };
  o.save.bests['heroes-b'] = { score: 0, accuracy: 0, pct: 41, grade: '', cleared: false, attempts: 6 };
  o.save.badges = { clear_heroes: true, few_tries: true, in_flow: true, full_drop: true };
  o.save.stars = { heroes: [true, true, true], skyhigh: [true, true, false] };
  o.save.quests = { heroes_drop: true, heroes_holds: true, skyhigh_beat: true };
  o.save.skin = 'cyan';
};
let feed = 0;
/** Plays the level by itself through the real tap path, each tap `late` seconds after its note. */
const feeder = (late) => {
  clearInterval(feed);
  let k = 0;
  let of = null;
  feed = setInterval(() => {
    const r = o.run;
    if (!r || r.state !== 'playing' || r.opts.bot) return;
    if (of !== r) { of = r; k = 0; }
    const taps = r.course.taps;
    while (k < taps.length && (taps[k] * r.level.spb < r.startAt || taps[k] * r.level.spb < r.time - 0.3)) k++;
    while (k < taps.length && r.clock.at(performance.now()) >= taps[k] * r.level.spb + late) { r.tap(performance.now()); k++; }
  }, 3);
};
const until = async (f, max = 30000) => { const t0 = performance.now(); while (!f() && performance.now() - t0 < max) await wait(40); };
const focus = async (i) => { o.show('levels'); o.level(i); await wait(350); };
const place = async (id) => { o.run && o.run.stop(); o.show('levels'); o.select(id); o.show('levels'); await wait(350); };
const beat = () => o.run.time / o.run.level.spb;
window.__stage = async (name) => {
  clearInterval(feed);
  drive();
  for (const id of ['titleCard', 'countIn', 'finale', 'toast']) $(id).removeAttribute('style');
  demo(false);
  let freeze = false;
  if (name === 'title') { o.run && o.run.stop(); o.show('title'); await wait(500); }
  else if (name === 'levels') await focus(1);
  else if (name === 'final') { demo(true); await focus(3); }
  else if (name === 'moon') await place('heroes-b');
  else if (name === 'hidden') await place('skyhigh-b');
  else if (name === 'gate') await place('gate');
  else if (name === 'quests') { o.show('levels'); o.quests(); await wait(300); }
  else if (name === 'entry') { await focus(1); o.start(false); await until(() => o.run.state === 'playing'); await wait(1300); $('titleCard').style.cssText = 'animation:none;opacity:1'; freeze = true; }
  else if (name === 'play') { await focus(0); o.start(true, false, (68 * 60) / 128); await until(() => beat() >= 72.6); freeze = true; }
  else if (name === 'twin') { demo(true); await focus(3); o.start(true, false, (80 * 60) / 100); await until(() => beat() >= 85.4); freeze = true; }
  else if (name === 'tutorial') { await focus(0); o.tutorial(); await until(() => beat() >= 5.2); freeze = true; }
  else if (name === 'pause') { await focus(1); o.start(false); feeder(0.012); await until(() => beat() >= 21); clearInterval(feed); $('pauseBtn').click(); await wait(300); }
  else if (name === 'quit') { await focus(1); o.start(false); feeder(0.012); await until(() => beat() >= 30); clearInterval(feed); $('pauseBtn').click(); await wait(100); $('pauseQuitBtn').click(); await wait(600); }
  else if (name === 'finale' || name === 'clear') {
    await focus(1);
    o.start(false, false, (156 * 60) / 128);
    feeder(0.008);
    await until(() => o.run && o.run.finale, 20000);
    if (name === 'finale') { await wait(1250); $('finale').style.cssText = 'opacity:1;transform:none'; freeze = true; } else { await until(() => o.screen === 'results', 12000); await wait(700); }
  }
  else if (name === 'settings') { o.run && o.run.stop(); o.show('levels'); o.settings(); await wait(300); }
  else if (name === 'orbs') { o.show('levels'); o.orbs(); await wait(300); }
  else if (name === 'badges') { o.show('levels'); o.badges(); await wait(300); }
  else if (name === 'sync') { o.show('levels'); o.settings(); await wait(100); $('syncBtn').click(); await wait(1500); for (let i = 0; i < 5; i++) { $('calPad').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })); await wait(600); } }
  if (freeze) clearInterval(window.__drv);
  await wait(1700);
  return { name, screen: o.screen, w: innerWidth, h: innerHeight, errs: window.__errs.slice(0, 2) };
};
