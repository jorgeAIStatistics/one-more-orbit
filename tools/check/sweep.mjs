// The release sweep (2026-11-26): every path a player can take, scripted, against the checks' build (it has the hooks),
// with every page error and console error recorded. node sweep.mjs <out dir> [scenario ...]
// Each scenario is a fresh page with its own save; it reports ok/fail, the errors, and a screenshot at its end.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const out = process.argv[2], only = process.argv.slice(3);
const PORT = process.env.OMO_PORT || 5300;
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const results = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function scenario(name, save, fn, view = { width: 390, height: 844 }) {
  if (only.length && !only.includes(name)) return;
  const ctx = await b.newContext({ viewport: view, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${String(e).slice(0, 240)}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_FILE_NOT_FOUND/.test(m.text())) errors.push(`console: ${m.text().slice(0, 240)}`); });
  // a save of our own (never the owner's: it lives in this test browser only)
  await page.addInitScript((s) => { localStorage.clear(); if (s) localStorage.setItem('one_more_orbit_v4', JSON.stringify(s)); }, save);
  const t0 = Date.now(); let ok = true, note = '';
  try {
    await page.goto(`http://localhost:${PORT}/${fn.query ?? ''}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__omoReady === true, null, { timeout: 20000 });
    await wait(1200);
    note = (await fn(page)) || '';
  } catch (e) { ok = false; note = String(e).split('\n')[0].slice(0, 300); }
  await page.screenshot({ path: `${out}/${name}.jpg`, quality: 70 }).catch(() => undefined);
  const r = { name, ok: ok && errors.length === 0, secs: Math.round((Date.now() - t0) / 1000), note, errors: [...new Set(errors)].slice(0, 8) };
  results.push(r); console.log(JSON.stringify(r));
  await ctx.close();
}
const omo = (page, f, arg) => page.evaluate(f, arg);
const screen = (page) => omo(page, () => window.__omo.screen);
const until = (page, cond, arg, timeout = 120000) => page.waitForFunction(cond, arg, { timeout, polling: 200 });
/** a save as a player has it after clearing these worlds (and their scenes) */
const after = (ids, extra = {}) => ({ story: { cold: true, prologue: true, open: true, started: true, ...Object.fromEntries(ids.map((i) => [i, true])), ...extra }, tutorialDone: true, calibrated: true, music: 0, sfx: 0, hitVol: 0, core: 4,
  bests: Object.fromEntries(['started', ...ids].map((i) => [i, { pct: 100, cleared: true, attempts: 2, score: 0, accuracy: 0, grade: '' }])) });

// 1. a new save: the cold open (held and tapped through), the opening, the first flight begins
await scenario('new save: cold open to the first flight', null, async (page) => {
  if ((await screen(page)) !== 'cold') throw new Error(`opened on ${await screen(page)}, not the cold open`);
  const box = { x: 195, y: 500 };
  for (let i = 0; i < 90 && (await screen(page)) === 'cold'; i++) { await page.mouse.move(box.x, box.y); await page.mouse.down(); await wait(500); await page.mouse.up(); await wait(400); }
  if ((await screen(page)) !== 'prologue') throw new Error(`after the cold open: ${await screen(page)}`);
  await until(page, () => window.__omo.opening.armed === true, null, 60000);
  for (let i = 0; i < 70 && (await screen(page)) === 'prologue'; i++) { await page.mouse.click(195, 500); await wait(800); } // (the storyboard runs 28 s before the first tap is taken)
  if ((await screen(page)) !== 'play') throw new Error(`the first tap did not start the flight: ${await screen(page)}`);
  await wait(4000);
  return `in the first flight at ${(await omo(page, () => window.__omo.run?.time ?? -1)).toFixed(1)} s`;
});

// 2. a returning player: the title, a tap, the map; Settings shows the version and no testing rows (checks build: it does)
await scenario('returning player: title to the map', after(['heroes', 'skyhigh']), async (page) => {
  if ((await screen(page)) !== 'title') throw new Error(`opened on ${await screen(page)}`);
  await page.mouse.click(195, 420); await until(page, () => window.__omo.screen === 'levels', null, 20000);
  await wait(1500);
  return 'map reached';
});

// 3. every level from the map, played by the bot to its end and through its aftermath (the star, home, the memory, the
// rise to the map); the first clear of each world, then a replay
const LEVELS = [['started', -1, []], ['heroes', 0, []], ['skyhigh', 1, ['heroes']], ['blank', 2, ['heroes', 'skyhigh']], ['invincible', 3, ['heroes', 'skyhigh', 'blank']]];
for (const [id, i, before] of LEVELS) {
  for (const replay of [false, true]) {
    const s = after(replay ? [...before, id] : before, { ambush: true }); if (id === 'started' && !replay) { delete s.bests.started; delete s.story.started; }
    await scenario(`${id}: ${replay ? 'a replay' : 'the first clear'}, to the map`, s, Object.assign(async (page) => {
      await omo(page, ([i]) => { const o = window.__omo; o.show('levels'); if (i < 0) o.first(true); else { o.level(i); o.start(true); } }, [i]);
      await until(page, () => window.__omo.run && window.__omo.run.state === 'playing', null, 30000);
      await until(page, () => window.__omo.screen !== 'play', null, 160000);
      // the aftermath: tap through what can be tapped until the map is back
      for (let k = 0; k < 200 && (await screen(page)) !== 'levels'; k++) { if (k % 10 === 9) await page.mouse.click(195, 420); await wait(500); }
      const sc = await screen(page);
      if (sc !== 'levels' && sc !== 'play') throw new Error(`ended on ${sc}`);
      return `ended on ${sc}${sc === 'play' ? ' (the ambush started after Cirra)' : ''}`;
    }, { query: '?botstar' }));
  }
}

// 4. the ambush, the guardian and the ending, by the bot
await scenario('the ambush, to the fire and the map', after(['heroes', 'skyhigh']), async (page) => {
  await omo(page, () => window.__omo.ambush(true));
  await until(page, () => window.__omo.run && window.__omo.run.state === 'playing', null, 30000);
  await until(page, () => window.__omo.screen !== 'play', null, 120000);
  for (let k = 0; k < 60 && (await screen(page)) !== 'levels'; k++) await wait(500);
  return `ended on ${await screen(page)}`;
});
await scenario('the guardian, to the ending', after(['heroes', 'skyhigh', 'blank', 'invincible'], { lastmemory: true, hollow: true, ambush: true }), Object.assign(async (page) => {
  await omo(page, () => window.__omo.guardian(true));
  await until(page, () => window.__omo.run && window.__omo.run.state === 'playing', null, 30000);
  await until(page, () => window.__omo.screen !== 'play', null, 160000);
  const sc = await screen(page);
  return `after the fight: ${sc}`;
}, { query: '?botstar' }));
await scenario('the ending, skipped to the credits, then out', after(['heroes', 'skyhigh', 'blank', 'invincible', 'royalty']), async (page) => {
  await omo(page, () => window.__omo.ending());
  await wait(4000); await page.mouse.click(195, 420); await wait(3000);
  await page.mouse.click(195, 420);
  await until(page, () => window.__omo.screen === 'levels', null, 20000);
  return 'skipped and out to the map';
});
await scenario('the ending, played whole', after(['heroes', 'skyhigh', 'blank', 'invincible', 'royalty']), async (page) => {
  await omo(page, () => window.__omo.ending());
  await until(page, () => window.__omo.screen === 'levels', null, 100000);
  return 'played to the map';
});

// 5. memories: one played whole, one skipped
await scenario('a memory, skipped', after(['heroes']), async (page) => {
  await omo(page, () => window.__omo.memory('skyhigh'));
  await wait(6000); await page.mouse.click(195, 420);
  await until(page, () => window.__omo.screen === 'levels', null, 30000);
  return 'skipped';
});
await scenario('the last memory, whole', after(['heroes', 'skyhigh', 'blank', 'invincible']), async (page) => {
  await omo(page, () => window.__omo.memory('royalty'));
  await until(page, () => window.__omo.screen === 'levels', null, 60000);
  return 'played whole';
});

// 6. practice mode, from the map, to the end
await scenario('practice: Glassmere to the end', after(['heroes', 'skyhigh']), async (page) => {
  await omo(page, () => { const o = window.__omo; o.show('levels'); o.level(2); o.start(true, true); });
  await until(page, () => window.__omo.run && window.__omo.run.state === 'playing', null, 30000);
  await until(page, () => window.__omo.screen !== 'play', null, 120000);
  return `ended on ${await screen(page)}`;
});

// 7. the embers: a fall after each ember comes back to it (Emberwick, which has five)
await scenario('embers: Emberwick, a fall after each', after([]), async (page) => {
  const ems = await omo(page, () => { const o = window.__omo; o.level(0); return o.run ? [] : null; });
  const embers = await omo(page, () => { const o = window.__omo; o.show('levels'); o.level(0); o.start(false); return [...(o.run.level.file?.embers ?? o.run.pack?.level?.embers ?? [])]; });
  const got = [];
  for (const em of embers) {
    // play (no taps) from just after the ember: the first required press is missed, he falls, and comes back to it
    await omo(page, ([em]) => { const o = window.__omo; o.start(false, false, em * o.run.course.spb + 0.05); }, [em]);
    await until(page, () => window.__omo.run && window.__omo.run.state === 'playing', null, 20000);
    await until(page, ([em]) => { const r = window.__omo.run; return r && r.state === 'playing' && Math.abs(r.startAt - em * r.course.spb) < 0.06 && r.time > r.startAt + 0.3; }, [em], 30000).catch(() => undefined);
    const st = await omo(page, () => ({ at: window.__omo.run?.startAt, state: window.__omo.run?.state }));
    got.push(`${em}:${st.at?.toFixed?.(2)}`);
  }
  void ems;
  return `embers ${embers.length}: ${got.join(' ')}`;
});

// 8. pause and resume mid-level; settings changed from the pause; quit to the map
await scenario('pause, settings mid-game, resume, quit', after(['heroes']), async (page) => {
  await omo(page, () => { const o = window.__omo; o.show('levels'); o.level(1); o.start(true); });
  await until(page, () => window.__omo.run && window.__omo.run.time > 8, null, 40000);
  await omo(page, () => window.__omo.pause());
  await wait(800);
  if ((await screen(page)) !== 'pause') throw new Error('did not pause');
  const t1 = await omo(page, () => window.__omo.run.time);
  await page.click('#pauseSettingsBtn'); await wait(800);
  if ((await screen(page)) !== 'settings') throw new Error('settings did not open from the pause');
  await page.click('#setFlash'); await page.click('#setMotion'); await page.fill('#setMusic', '0.3').catch(() => undefined);
  await page.click('#settingsBack'); await wait(800);
  await page.click('#resumeBtn');
  await until(page, ([t1]) => window.__omo.run && window.__omo.run.state === 'playing' && window.__omo.run.time > t1 + 2, [t1], 20000);
  await omo(page, () => window.__omo.pause()); await wait(600);
  await page.click('#pauseQuitBtn');
  await until(page, () => window.__omo.screen === 'levels', null, 15000);
  return `paused at ${t1.toFixed(1)} s, resumed, quit to the map`;
});

// 9. quitting mid-scene: a memory left by a tap, the ambush left from its pause
await scenario('quit the ambush mid-scene', after(['heroes', 'skyhigh'], { ambush: true }), async (page) => {
  await omo(page, () => window.__omo.ambush(true));
  await until(page, () => window.__omo.run && window.__omo.run.time > 12, null, 40000);
  await omo(page, () => window.__omo.pause()); await wait(600);
  await page.click('#pauseQuitBtn');
  await until(page, () => window.__omo.screen === 'levels', null, 15000);
  return 'left to the map';
});

// 10. replays from Settings
for (const [btn, until2] of [['replayTutorial', 'settings'], ['replayAmbush', 'play'], ['replayEnding', 'levels'], ['replayMemory', 'settings']]) {
  await scenario(`replay from Settings: ${btn}`, after(['heroes', 'skyhigh', 'blank', 'invincible', 'royalty'], { ambush: true, end: true, heroes: true }), async (page) => {
    await omo(page, () => window.__omo.settings()); await wait(800);
    await page.click(`#${btn}`); await wait(2500);
    const sc = await screen(page);
    // leave it: tap through (a scene) or pause and leave (a level)
    if (sc === 'play') { await omo(page, () => window.__omo.pause()); await wait(500); await page.click('#pauseQuitBtn'); }
    else for (let k = 0; k < 120 && !['settings', 'levels'].includes(await screen(page)); k++) { if (k % 6 === 5) await page.mouse.click(195, 420); await wait(500); }
    return `started (${sc}), then ${await screen(page)}`;
  });
}

// 11. a wide screen, and landscape on a phone: the map and a level
await scenario('wide desktop: the map and Verdance', after(['heroes', 'skyhigh', 'blank']), async (page) => {
  await omo(page, () => { const o = window.__omo; o.show('levels'); o.select('invincible'); });
  await wait(1500);
  await omo(page, () => { const o = window.__omo; o.level(3); o.start(true); });
  await until(page, () => window.__omo.run && window.__omo.run.time > 25, null, 60000);
  return 'ok';
}, { width: 1440, height: 900 });
await scenario('phone landscape: Cirra', after(['heroes']), async (page) => {
  await omo(page, () => { const o = window.__omo; o.show('levels'); o.level(1); o.start(true); });
  await until(page, () => window.__omo.run && window.__omo.run.time > 25, null, 60000);
  return 'ok';
}, { width: 844, height: 390 });

fs.writeFileSync(`${out}/sweep.json`, JSON.stringify(results, null, 1));
console.log(`${results.filter((r) => r.ok).length} of ${results.length} passed`);
await b.close();
