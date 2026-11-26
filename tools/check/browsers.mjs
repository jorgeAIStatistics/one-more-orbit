// Browsers and devices (the release pass, 2026-11-26): the checks' build in Chrome, WebKit (Safari's engine) and
// Firefox, at phone, small phone, landscape, laptop and wide sizes (with touch and mobile emulation where it applies).
// In each: the page boots, the map shows, a level (Cirra) is played by the bot for 20 s (its song decoded and playing),
// frame times are measured, errors recorded, and a screenshot kept. node browsers.mjs <out dir>
import { chromium, webkit, firefox, devices } from 'playwright-core';
import fs from 'node:fs';
const out = process.argv[2], PORT = process.env.OMO_PORT || 5300;
const ENGINES = { chrome: [chromium, { channel: 'chrome' }], webkit: [webkit, {}], firefox: [firefox, {}] };
const SIZES = [
  ['desktop laptop 1280x800', { viewport: { width: 1280, height: 800 } }, ['chrome', 'webkit', 'firefox']],
  ['desktop wide 1920x1080', { viewport: { width: 1920, height: 1080 } }, ['chrome', 'webkit', 'firefox']],
  ['desktop phone-sized window 390x844', { viewport: { width: 390, height: 844 } }, ['chrome', 'webkit', 'firefox']],
  ['iPhone 13 (Safari engine)', devices['iPhone 13'], ['webkit']],
  ['iPhone SE, small (Safari engine)', devices['iPhone SE'], ['webkit']],
  ['iPhone 13 landscape (Safari engine)', devices['iPhone 13 landscape'], ['webkit']],
  ['Android, Pixel 7 (Chrome)', devices['Pixel 7'], ['chrome']],
  ['Android, Galaxy S9+ (Chrome)', devices['Galaxy S9+'], ['chrome']],
];
const save = { story: { cold: true, prologue: true, open: true, started: true, heroes: true }, tutorialDone: true, calibrated: true, music: 0, sfx: 0, hitVol: 0, core: 4, bests: { started: { pct: 100, cleared: true, attempts: 1 }, heroes: { pct: 100, cleared: true, attempts: 1 } } };
const rows = [];
const PICK = (process.env.ENGINES || 'chrome,webkit,firefox').split(',');
for (const [engine, [bt, opts]] of Object.entries(ENGINES)) {
  if (!PICK.includes(engine)) continue;
  let b;
  try { b = await bt.launch({ ...opts, headless: true, args: engine === 'chrome' ? ['--autoplay-policy=no-user-gesture-required'] : [] }); } catch (e) { rows.push({ engine, size: '-', ok: false, note: `could not launch: ${String(e).split('\n')[0]}` }); continue; }
  for (const [size, dev, engines] of SIZES) {
    if (!engines.includes(engine)) continue;
    const { defaultBrowserType, ...ctxOpts } = dev; void defaultBrowserType;
    if (engine === 'firefox') delete ctxOpts.isMobile;
    const ctx = await b.newContext(ctxOpts); const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
    await page.addInitScript((s) => { localStorage.clear(); localStorage.setItem('one_more_orbit_v4', JSON.stringify(s)); }, save);
    const r = { engine, size, ok: true, note: '' };
    try {
      const t0 = Date.now();
      await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__omoReady === true, null, { timeout: 30000 }); r.bootMs = Date.now() - t0;
      // a first touch (a tap anywhere) wakes the sound everywhere; the title then goes up to the map
      await page.mouse.click(ctxOpts.viewport.width / 2, ctxOpts.viewport.height / 2);
      await page.waitForFunction(() => window.__omo.screen === 'levels', null, { timeout: 15000 }).catch(() => undefined);
      r.audio = await page.evaluate(() => window.__omo.audio.ctx ? window.__omo.audio.ctx.state : 'none');
      await page.evaluate(() => { const o = window.__omo; o.level(1); o.start(true); });
      await page.waitForFunction(() => window.__omo.run && window.__omo.run.state === 'playing', null, { timeout: 40000 });
      r.songPlaying = await page.evaluate(() => !!window.__omo.run.music);
      await page.evaluate(() => { window.__F = []; let last = performance.now(); const f = (t) => { window.__F.push(t - last); last = t; window.__raf = requestAnimationFrame(f); }; window.__raf = requestAnimationFrame(f); });
      await page.waitForTimeout(20000);
      const F = (await page.evaluate(() => { cancelAnimationFrame(window.__raf); return window.__F; })).slice(5).sort((a, b) => a - b);
      r.frames = F.length; r.avgMs = +(F.reduce((a, b) => a + b, 0) / F.length).toFixed(2); r.p99Ms = +F[Math.floor(F.length * 0.99)].toFixed(1); r.worstMs = +F[F.length - 1].toFixed(1);
      r.songTime = +(await page.evaluate(() => window.__omo.run.time)).toFixed(1);
      await page.screenshot({ path: `${out}/${engine} - ${size}.jpg`, quality: 70 });
    } catch (e) { r.ok = false; r.note = String(e).split('\n')[0].slice(0, 200); await page.screenshot({ path: `${out}/${engine} - ${size} (failed).jpg`, quality: 70 }).catch(() => undefined); }
    r.errors = [...new Set(errors)].slice(0, 5); if (r.errors.length) r.ok = false;
    rows.push(r); console.log(JSON.stringify(r));
    await ctx.close();
  }
  await b.close();
}
fs.writeFileSync(`${out}/browsers-${PICK.join('-')}.json`, JSON.stringify(rows, null, 1));
