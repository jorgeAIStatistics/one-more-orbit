import { chromium } from 'playwright-core';
const out = process.argv[2], times = (process.argv[3] || '5,10.4,12.5,19.5,21,22.5,25.5,27.5,30.5,33,35.5,37').split(',').map(Number);
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('ERR', String(e).slice(0, 300)));
await page.addInitScript(() => { Storage.prototype.setItem = function () {}; });
await page.addInitScript((w) => { window.__W = w; }, process.argv[4] || '0');
await page.goto('http://localhost:5199/?look=2', { waitUntil: 'load' }); await page.waitForTimeout(1500);
await page.evaluate(() => { const o = window.__omo; Object.assign(o.save, { music: 0, sfx: 0, hitVol: 0, tutorialDone: true, calibrated: true, unlockAll: true }); o.save.story.open = o.save.story.prologue = o.save.story.cold = true; o.opening.stop(); o.coldScene.stop(); o.show('levels'); if (window.__W === 'first') o.first(true); else if (window.__W === 'ambush') o.ambush(true); else { o.level(Number(window.__W)); o.start(true); } });
for (const t of times) {
  await page.waitForFunction((t) => window.__omo.run && window.__omo.run.time >= t, t, { timeout: 90000, polling: 16 }).catch(() => console.log('timeout', t));
  const st = await page.evaluate(() => ({ t: window.__omo.run?.time, s: window.__omo.screen, dead: window.__omo.run?.sim?.crashed }));
  await page.screenshot({ path: `${out}/t${String(t).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 80 });
  console.log(t, JSON.stringify(st));
}
await b.close();
