// Readability over a whole level: closest lit marks, Orbin's distance to the edge, path 1.5 s ahead in view.
import { chromium } from 'playwright-core';
const which = process.argv[2] || 'heroes', W = 390, H = 844;
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
page.on('pageerror', (e) => console.log('ERR', String(e).slice(0, 300)));
await page.addInitScript(() => { Storage.prototype.setItem = function () {}; });
await page.goto(`http://localhost:${process.env.OMO_PORT || 5199}/?look=2`, { waitUntil: 'load' }); await page.waitForTimeout(1500);
await page.evaluate((w) => { const o = window.__omo; Object.assign(o.save, { music: 0, sfx: 0, hitVol: 0, tutorialDone: true, calibrated: true, unlockAll: true }); o.save.story.open = o.save.story.prologue = o.save.story.cold = true; o.opening.stop(); o.coldScene.stop(); o.show('levels'); if (w === 'first') o.first(true); else if (w === 'ambush') o.ambush(true); else if (w === 'guardian') o.guardian(true); else { o.level(Number(w)); o.start(true); }
  const r = o.renderer, M = (window.__M = { cue: [], edge: [], ahead: [] });
  const f = () => { const run = o.run; if (run && run.state === 'playing' && run.time > 0.5) { const c = run.course, beat = run.time / c.spb, cx = r.w / 2, cy = r.h * 0.52;
      const q = r.cues; if (q.length >= 2) M.cue.push([Math.hypot(q[0].x - q[1].x, q[0].y - q[1].y), +run.time.toFixed(2)]);
      const [bx, by] = r.ballXY, X = bx + cx, Y = by + cy; if (!run.finale) M.edge.push([Math.min(X, r.w - X, Y, r.h - Y), +run.time.toFixed(2)]);
      const b2 = beat + 1.5 / c.spb, h = c.at(b2), [ax, ay] = r.wxy(h.planet, -Math.PI / 2 + c.angle(b2), r.rad(h.rho)); M.ahead.push([Math.min(ax + cx, r.w - ax - cx, ay + cy, r.h - ay - cy), +run.time.toFixed(2)]); }
    requestAnimationFrame(f); }; requestAnimationFrame(f); }, which === 'first' ? 'first' : which === 'heroes' ? '0' : which);
await page.waitForFunction(() => window.__omo.run && (window.__omo.run.state !== 'playing' && window.__omo.run.time > 5 || window.__omo.run.time > window.__omo.run.course.end * window.__omo.run.course.spb - 1), null, { timeout: 200000, polling: 200 });
const M = await page.evaluate(() => window.__M);
const worst = (a, n = 4) => [...a].sort((x, y) => x[0] - y[0]).slice(0, n).map(([v, t]) => `${Math.round(v)} px at ${t}`);
console.log(which, 'closest lit marks', worst(M.cue).join(', '));
console.log(which, 'Orbin nearest the edge', worst(M.edge).join(', '));
console.log(which, 'path 1.5 s ahead, nearest the edge (negative = off screen)', worst(M.ahead).join(', '), '; frames off screen', M.ahead.filter((x) => x[0] < 0).length, 'of', M.ahead.length);
await b.close();
