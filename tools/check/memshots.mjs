// Stills of a memory film (node memshots.mjs <world> <times> <out dir>)
import { chromium } from 'playwright-core';
const [world, times, out] = [process.argv[2], process.argv[3].split(',').map(Number), process.argv[4]];
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
await page.addInitScript(() => { Storage.prototype.setItem = function () {}; });
await page.goto(`http://localhost:${process.env.OMO_PORT || 5199}/?look=2`, { waitUntil: 'load' }); await page.waitForTimeout(1500);
await page.evaluate(() => { const o = window.__omo; o.save.story.open = o.save.story.prologue = o.save.story.cold = true; o.opening.stop(); o.coldScene.stop(); o.toTitle(); });
for (const t of times) { await page.evaluate(([w, t]) => window.__omo.memoryFilm.seek(w, t), [world, t]); await page.waitForTimeout(250); await page.screenshot({ path: `${out}/m${String(t).padStart(5, '0')}.jpg`, quality: 85 }); }
await b.close();
