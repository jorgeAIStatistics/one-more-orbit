// The cold open's last seconds and the opening after it: every frame, on this Mac's GPU (a window off-screen).
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'chrome', headless: false, args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--window-position=4000,3000', '--window-size=1500,960', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
const page = await (await b.newContext({ viewport: null })).newPage();
page.on('pageerror', (e) => console.log('ERR', String(e).slice(0, 200))); page.on('console', (m) => { if (m.text().startsWith('TIMING')) console.log(m.text()); });
await page.addInitScript(() => { Storage.prototype.setItem = function () {}; });
await page.goto('http://localhost:5199/?cold', { waitUntil: 'load' }); await page.waitForTimeout(1500);
await page.evaluate(() => { const s = window.__omo.coldScene; s.press(true, 10, 400); s.press(false); s.idleAfter = 0.8; window.__F = []; let last = performance.now(); const f = (t) => { window.__F.push([t - last, window.__omo.screen, window.__omo.screen === 'cold' ? +s.time().toFixed(2) : -1]); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f); });
await page.waitForFunction(() => window.__omo.screen === 'prologue', null, { timeout: 120000, polling: 100 });
await page.waitForTimeout(8000);
const F = (await page.evaluate(() => window.__F)).slice(3);
const by = (pred) => { const d = F.filter(pred).map((x) => x[0]).sort((a, b) => a - b); return { frames: d.length, avg: +(d.reduce((a, b) => a + b, 0) / d.length).toFixed(2), worst: +d[d.length - 1].toFixed(1), over17: d.filter((x) => x > 17).length }; };
console.log('the film', JSON.stringify(by((x) => x[1] === 'cold')));
console.log('the opening, its first 8 s', JSON.stringify(by((x) => x[1] === 'prologue')));
console.log('worst', JSON.stringify([...F].sort((a, b) => b[0] - a[0]).slice(0, 6).map((x) => [+x[0].toFixed(1), x[1], x[2]])));
await page.screenshot({ path: process.argv[2] });
await b.close();
