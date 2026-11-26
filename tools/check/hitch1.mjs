// Every frame of whole scenes in a real Chrome window on this Mac's GPU (placed off-screen): average, p99, worst,
// frames that missed the display (over 12.5 ms at 120 Hz, over 17 ms at 60 Hz), and when the worst ones happened.
// node hitch.mjs <port> <label>
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const port = process.argv[2] || '5199', label = process.argv[3] || 'run';
const b = await chromium.launch({ channel: 'chrome', headless: false, args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--window-position=4000,3000', '--window-size=1500,960', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
const ctx = await b.newContext({ viewport: null });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('ERR', String(e).slice(0, 200)));
await page.addInitScript(() => { Storage.prototype.setItem = function () {}; });
const go = async (q) => { await page.goto(`http://localhost:${port}/${q}`, { waitUntil: 'load' }); await page.waitForTimeout(1500); };
const rec = (clock) => page.evaluate((clock) => { window.__F = []; let last = performance.now(); const f = (t) => { let c = -1; try { c = eval(clock); } catch { /* */ } window.__F.push([t - last, c]); last = t; window.__raf = requestAnimationFrame(f); }; window.__raf = requestAnimationFrame(f); }, clock);
const stop = async (name) => {
  const F = (await page.evaluate(() => { cancelAnimationFrame(window.__raf); return window.__F; })).slice(3);
  const d = F.map((x) => x[0]).sort((a, b) => a - b), n = d.length;
  const worst = [...F].sort((a, b) => b[0] - a[0]).slice(0, 5).map(([ms, c]) => `${ms.toFixed(1)} ms at ${typeof c === 'number' ? c.toFixed(2) : c}`);
  const out = { name, frames: n, avg: +(d.reduce((a, b) => a + b, 0) / n).toFixed(2), p99: +d[Math.floor(n * 0.99)].toFixed(1), worst: +d[n - 1].toFixed(1), over12: d.filter((x) => x > 12.5).length, over17: d.filter((x) => x > 17).length, worstAt: worst };
  console.log(JSON.stringify(out)); return out;
};
const prep = () => page.evaluate(() => { const o = window.__omo; Object.assign(o.save, { music: 0, sfx: 0, hitVol: 0, tutorialDone: true, calibrated: true, unlockAll: true }); o.save.story.open = o.save.story.prologue = o.save.story.cold = true; o.opening.stop(); o.coldScene.stop(); o.show('levels'); });
const R = [];
const lv = async (name, start, end) => { await go('?look=2'); await prep(); await rec('window.__omo.run ? window.__omo.run.time : -1'); await page.evaluate(start); await page.waitForFunction((e) => window.__omo.run && (window.__omo.run.time > e || window.__omo.screen !== 'play'), end, { timeout: 200000, polling: 200 }).catch(() => {}); R.push(await stop(name)); };
const which = process.argv[5] || '0', endAt = Number(process.argv[6] || 60);
await page.addInitScript((w) => { window.__W = w; }, which);
await lv(process.argv[4] || 'level', () => { const o = window.__omo, w = window.__W; if (w === 'first') o.first(true); else { o.level(Number(w)); o.start(true); } }, endAt);

await b.close();
