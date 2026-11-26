// Stills of the map at a number of stars home (node mapshots.mjs <out dir> [w h])
import { chromium } from 'playwright-core';
const out = process.argv[2], W = Number(process.argv[3] || 390), H = Number(process.argv[4] || 844);
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: W > 900 ? 1 : 2 })).newPage();
await page.addInitScript(() => { Storage.prototype.setItem = function () {}; });
for (const n of [0, 2, 4, 5]) {
  await page.goto(`http://localhost:${process.env.OMO_PORT || 5199}/?look=2`, { waitUntil: 'load' }); await page.waitForTimeout(1500);
  await page.evaluate((n) => { const o = window.__omo; o.save.story.open = o.save.story.prologue = o.save.story.cold = true; o.save.tutorialDone = true; o.opening.stop(); o.coldScene.stop();
    const ids = ['heroes', 'skyhigh', 'blank', 'invincible', 'royalty'].slice(0, n); for (const id of ids) o.save.bests[id] = { pct: 100, cleared: true, attempts: 1 }; if (n >= 2) o.save.story.ambush = true; o.show('levels'); if (n === 2) { o.select('skyhigh'); o.sky.chosen = 'skyhigh'; } }, n);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${out}/map-${n}.jpg`, quality: 85 });
}
await b.close();
