import { chromium } from 'playwright-core';
const out = process.argv[2], times = (process.argv[3] || '14,18,21,24,27,30').split(',').map(Number);
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
page.on('pageerror', (e) => console.log('ERR', String(e).slice(0, 300)));
await page.addInitScript(() => { Storage.prototype.setItem = function () {}; });
await page.goto('http://localhost:5199/?cold', { waitUntil: 'load' }); await page.waitForTimeout(1500);
await page.evaluate(() => { const s = window.__omo.coldScene; s.press(true, 10, 400); s.press(false); s.idleAfter = 0.8; });
for (const t of times) { await page.waitForFunction((t) => window.__omo.coldScene.time() >= t, t, { timeout: 90000, polling: 16 }); await page.screenshot({ path: `${out}/c${String(t).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 80 }); }
await b.close();
