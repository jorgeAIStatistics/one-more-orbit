// The smoothness audit (the owner's brief, 2026-11-26): a perfect run of a whole level in a real Chrome window on this
// Mac (off-screen, at the display's own rate), recording every frame: the time, the song time, the camera (centre and
// zoom) and Orbin (on the screen, and in the world). tools/check/smooth.py turns it into speed and acceleration plots
// and a list of rough moments.  node smooth.mjs <which: first|ambush|0|1|2|3> <end s> <out.json> [w h]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [which, endS, out] = [process.argv[2], Number(process.argv[3]), process.argv[4]];
const W = Number(process.argv[5] || 390), H = Number(process.argv[6] || 844);
const b = await chromium.launch({ channel: 'chrome', headless: false, args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--window-position=4000,3000', `--window-size=${W + 20},${H + 140}`, '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
const page = await (await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 })).newPage();
page.on('pageerror', (e) => console.log('ERR', String(e).slice(0, 200)));
await page.addInitScript(() => { Storage.prototype.setItem = function () {}; });
await page.addInitScript((w) => { window.__W = w; }, which);
await page.goto(`http://localhost:${process.env.OMO_PORT || 5199}/?look=2`, { waitUntil: 'load' }); await page.waitForTimeout(1500);
await page.evaluate(() => {
  const o = window.__omo, r = o.renderer; Object.assign(o.save, { music: 0, sfx: 0, hitVol: 0, tutorialDone: true, calibrated: true, unlockAll: true }); o.save.story.open = o.save.story.prologue = o.save.story.cold = true; o.opening.stop(); o.coldScene.stop(); o.show('levels');
  const w = window.__W; if (w === 'first') o.first(true); else if (w === 'ambush') o.ambush(true); else if (w === 'guardian') o.guardian(true); else { o.level(Number(w)); o.start(true); }
  window.__S = [];
  const f = (t) => { const run = o.run; if (run && run.state === 'playing') { const U = r.rad(r.cam); window.__S.push([+t.toFixed(2), +run.time.toFixed(4), +r.camX.toFixed(2), +r.camY.toFixed(2), +U.toFixed(3), +r.ballXY[0].toFixed(2), +r.ballXY[1].toFixed(2), +(r.pf ?? 0).toFixed(4), +r.cam.toFixed(4), +r.camScale.toFixed(4), +r.punchS.toFixed(4), +r.zoomS.toFixed(4), +r.speedK.toFixed(4), +r.baseR.toFixed(4)]); } window.__raf = requestAnimationFrame(f); };
  window.__raf = requestAnimationFrame(f);
});
await page.waitForFunction((e) => window.__omo.run && (window.__omo.run.time > e || window.__omo.screen !== 'play'), endS, { timeout: 300000, polling: 250 }).catch(() => {});
const S = await page.evaluate(() => { cancelAnimationFrame(window.__raf); return window.__S; });
// (every moment something is meant to happen on the beat: taps, landings)
const beats = await page.evaluate(() => { const c = window.__omo.run?.course; if (!c) return []; const out = []; for (const p of c.presses) { out.push(+(p.beat * c.spb).toFixed(3)); out.push(+(p.land * c.spb).toFixed(3)); if (p.leap) out.push(+(p.leap.b1 * c.spb).toFixed(3)); } return out; });
fs.writeFileSync(out, JSON.stringify({ which, w: W, h: H, cols: ['t', 'song', 'camX', 'camY', 'U', 'ballX', 'ballY', 'pf', 'cam', 'camScale', 'punchS', 'zoomS', 'speedK', 'baseR'], rows: S, beats }));
console.log(`${which}: ${S.length} frames recorded`);
await b.close();
