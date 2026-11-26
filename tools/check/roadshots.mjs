// The map, redesigned (2026-11-26): stills at 0 stars, 2 (just before the ambush) and all; a level card; and a
// recording of the story beat after Emberwick. Its own browser and save (never the owner's). node roadshots.mjs <out> [w h]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const out = process.argv[2], W = Number(process.argv[3] || 390), H = Number(process.argv[4] || 844), PORT = process.env.OMO_PORT || 5300;
const only = process.env.ONLY || '';
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const best = { pct: 100, cleared: true, attempts: 1, score: 0, accuracy: 0, grade: '' };
const W4 = ['heroes', 'skyhigh', 'blank', 'invincible'];
const saveFor = (ids, story = {}, feats = {}) => ({ core: 4, tutorialDone: true, calibrated: true, music: 0, sfx: 0, hitVol: 0,
  story: { cold: true, prologue: true, open: true, started: true, 'map:started': true, ...Object.fromEntries(ids.map((i) => [i, true])), ...story },
  bests: Object.fromEntries(['started', ...ids].map((i) => [i, best])), feats, gold: {} });
async function open(save, video) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, ...(video ? { recordVideo: { dir: out, size: { width: W, height: H } } } : {}) });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', String(e).slice(0, 300)));
  await page.addInitScript((s) => { localStorage.clear(); localStorage.setItem('one_more_orbit_v4', JSON.stringify(s)); Storage.prototype.setItem = function () {}; }, save);
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__omoReady === true);
  await page.waitForTimeout(800);
  return { ctx, page };
}
const shot = async (name, save, f, wait = 2600) => {
  if (only && !name.includes(only)) return;
  const { ctx, page } = await open(save);
  await page.evaluate((src) => { const o = window.__omo; o.opening.stop(); o.coldScene.stop(); o.show('levels'); (0, eval)(src)(o); }, `(${f})`);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}/${name}.jpg`, quality: 88 });
  await ctx.close(); console.log('shot', name);
};
await shot('map 0 stars', saveFor([]), (o) => o.select('heroes', true));
await shot('map 2 stars (before the ambush)', saveFor(['heroes', 'skyhigh'], { 'map:heroes': true }, { 'shards:heroes': true, 'clean:skyhigh': true }), (o) => o.select('skyhigh', true));
const all = Object.fromEntries(W4.flatMap((id) => [[`shards:${id}`, true], [`clean:${id}`, true]]).concat([['clean:ambush', true], ['clean:royalty', true]]));
await shot('map all stars', { ...saveFor([...W4, 'royalty', 'ambush', ...W4.map((i) => `${i}-b`)], { ambush: true, lastmemory: true, end: true }, all), gold: Object.fromEntries([...W4, 'royalty'].map((i) => [i, 100])) }, (o) => o.select('invincible', true));
await shot('level card (Cirra)', saveFor(['heroes', 'skyhigh'], { 'map:arrive:skyhigh': true }, { 'shards:skyhigh': true }), (o) => { o.select('skyhigh', true); o.sky.openCard('skyhigh'); }, 1800);
await shot('the Landing card', saveFor(['heroes']), (o) => { o.sky.place('landing'); o.sky.openCard('landing'); }, 1800);
await shot('arrival at Glassmere', saveFor(['heroes', 'skyhigh'], { ambush: true }), (o) => { o.select('blank', true); o.sky.openCard('blank', ['Glassmere, the still lake.', 'Vell, waiting under the water.']); }, 1500);
// the story beat after Emberwick, recorded (as a player sees it: back on the map after the memory, the beat plays)
if (!only || 'recording'.includes(only)) {
  const { ctx, page } = await open(saveFor(['heroes']), true);
  await page.evaluate(() => { const o = window.__omo; o.opening.stop(); o.coldScene.stop(); o.select('heroes', true); o.show('levels'); });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const o = window.__omo; o.sky.playBeat('heroes', () => { window.__beatDone = true; }); });
  await page.waitForFunction(() => window.__beatDone === true, null, { timeout: 20000 });
  await page.waitForTimeout(2500);
  const v = page.video(); await ctx.close();
  fs.renameSync(await v.path(), `${out}/after Emberwick (story beat).webm`); console.log('recorded');
}
await b.close();
