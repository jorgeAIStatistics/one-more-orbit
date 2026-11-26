// Stills of every menu screen (node menushots.mjs <out dir> <tag>): settings, pause, results, glows, stars, credits, logbook, the map with a world chosen
import { chromium } from 'playwright-core';
const [out, tag] = [process.argv[2], process.argv[3] || 'now'];
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
await page.addInitScript(() => { Storage.prototype.setItem = function () {}; });
const go = async () => { await page.goto(`http://localhost:${process.env.OMO_PORT || 5199}/?look=2`, { waitUntil: 'load' }); await page.waitForTimeout(1200); await page.evaluate(() => { const o = window.__omo; o.save.story.open = o.save.story.prologue = o.save.story.cold = true; o.save.tutorialDone = true; o.save.calibrated = true; o.save.music = o.save.sfx = 0; for (const id of ['heroes', 'skyhigh']) o.save.bests[id] = { pct: 100, cleared: true, attempts: 3 }; o.opening.stop(); o.coldScene.stop(); }); };
const shot = async (name, fn, wait = 1200) => { await go(); await page.evaluate(fn); await page.waitForTimeout(wait); await page.screenshot({ path: `${out}/${tag}-${name}.jpg`, quality: 82 }); };
await shot('settings', () => window.__omo.settings());
await shot('glows', () => window.__omo.orbs());
await shot('stars', () => window.__omo.stars());
await shot('credits', () => window.__omo.credits());
await shot('logbook', () => window.__omo.logbook());
await shot('map-chosen', () => { const o = window.__omo; o.show('levels'); o.select('skyhigh'); o.sky.chosen = 'skyhigh'; }, 1800);
await shot('pause', () => { const o = window.__omo; o.level(1); o.start(false); setTimeout(() => o.pause(), 2500); }, 3600);
await shot('results', () => { const o = window.__omo; o.level(1); o.start(true); setTimeout(() => o.results(false), 3000); }, 4200);
await b.close();
