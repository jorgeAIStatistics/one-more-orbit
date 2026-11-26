// Frames of a story beat on the map (node beatshots.mjs <out> <beat> <cleared ids, comma-separated>); its own save.
import { chromium } from 'playwright-core';
const out = process.argv[2], kind = process.argv[3] || 'heroes', ids = (process.argv[4] || 'heroes').split(',');
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 }); const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror', String(e).slice(0, 300)));
const best = { pct: 100, cleared: true, attempts: 1 };
const save = { core: 4, tutorialDone: true, calibrated: true, music: 0, sfx: 0, story: { cold: true, prologue: true, open: true, started: true, ...Object.fromEntries(ids.map((i) => [i, true])) }, bests: Object.fromEntries(['started', ...ids].filter(Boolean).map((i) => [i, best])) };
await page.addInitScript((s) => { localStorage.clear(); localStorage.setItem('one_more_orbit_v4', JSON.stringify(s)); Storage.prototype.setItem = function () {}; }, save);
await page.goto('http://localhost:5300/'); await page.waitForFunction(() => window.__omoReady === true); await page.waitForTimeout(800);
const at = ids.filter(Boolean).slice(-1)[0] || 'started';
await page.evaluate((at) => { const o = window.__omo; o.opening.stop(); o.coldScene.stop(); if (at !== 'started') o.select(at, true); o.show('levels'); }, at);
await page.waitForTimeout(1500);
await page.evaluate((k) => { window.__omo.sky.playBeat(k, () => { window.__done = true; }); }, kind);
const t0 = Date.now();
for (const s of [0.8, 2.2, 3.6, 5, 6.4, 7.8]) { await page.waitForTimeout(Math.max(0, s * 1000 - (Date.now() - t0))); await page.screenshot({ path: `${out}/beat-${kind}-${s}.jpg`, quality: 60 }); }
await b.close();
