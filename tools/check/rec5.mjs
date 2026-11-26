// Records a stretch with Chrome's screencast, every frame stamped with the game's own clock.
// node rec5.mjs <first|heroes|cold> <outDir> <from> <to>
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [which, out, F0, T0] = process.argv.slice(2);
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const from = Number(F0), to = Number(T0);
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('ERR', String(e).slice(0, 300)));
await page.addInitScript(() => { Storage.prototype.setItem = function () {}; });
await page.goto(`http://localhost:5199/${which === 'cold' ? '?cold' : '?look=2'}`, { waitUntil: 'load' });
await page.waitForTimeout(900);
const cdp = await ctx.newCDPSession(page);
const frames = []; let n = 0, on = false;
cdp.on('Page.screencastFrame', async (f) => {
  if (on) { const name = `f${String(n++).padStart(5, '0')}.jpg`; fs.writeFileSync(`${out}/${name}`, Buffer.from(f.data, 'base64')); frames.push({ name, ts: f.metadata.timestamp }); }
  try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch { /* closing */ }
});
const clock = which === 'cold' ? '(window.__omo.coldScene.state === "scene" ? window.__omo.coldScene.time() : -99)' : '(window.__omo.run && window.__omo.run.state === "playing" ? window.__omo.run.time : -99)';
await page.evaluate(([w, from, clock]) => {
  const o = window.__omo;
  if (w === 'cold') { o.coldScene.press(true, 10, 400); o.coldScene.press(false); }
  else { Object.assign(o.save, { music: 0, sfx: 0, hitVol: 0, tutorialDone: true, calibrated: true, unlockAll: true }); o.save.story.open = o.save.story.prologue = o.save.story.cold = true; o.opening.stop(); o.coldScene.stop(); o.show('levels'); if (w === 'first') o.first(true); else { o.level(w === 'heroes' ? 0 : Number(w.slice(1))); o.start(true); } }
  const S = (window.__sync = []);
  const f = () => { const t = eval(clock); if (t > -50) S.push([Date.now() / 1000, t]); requestAnimationFrame(f); }; requestAnimationFrame(f);
}, [which, from, clock]);
await page.waitForFunction(([from, clock]) => eval(clock) >= from - 0.5, [from, clock], { timeout: 90000, polling: 16 });
on = true;
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 86, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 });
const ev = [];
if (which === 'cold') {
  // the player: holds from 20.4 s, lets go for a moment (the tide takes him back), holds again to the touch; then four heaves
  const T = () => page.evaluate(() => window.__omo.coldScene.time());
  const until = async (x) => { await page.waitForFunction((x) => window.__omo.coldScene.time() >= x, x, { polling: 16, timeout: 90000 }); };
  const act = async (down) => { await page.evaluate((d) => window.__omo.coldScene.press(d), down); ev.push([down ? 'down' : 'up', await T()]); };
  await until(20.4); await act(true); await until(21.7); await act(false); await until(22.5); await act(true);
  await page.waitForFunction(() => window.__omo.coldScene.phase === 'pull', null, { polling: 16, timeout: 20000 });
  await act(false);
  const t0 = await T();
  for (let i = 0; i < 4; i++) { await until(t0 + 0.9 + i * 0.85); await act(true); await page.waitForTimeout(70); await act(false); }
  await page.waitForFunction(() => window.__omo.coldScene.phase === 'loss', null, { polling: 16, timeout: 20000 });
  const st = await page.evaluate(() => { const s = window.__omo.coldScene; return { touch: s.touchT, heaves: s.heaves, slip: s.slipT }; });
  ev.push(['scene', st]);
  await page.waitForFunction(() => window.__omo.coldScene.state === 'done' || window.__omo.coldScene.time() - window.__omo.coldScene.slipT > 11.4, null, { polling: 30, timeout: 30000 });
} else await page.waitForFunction(([to, clock, from]) => eval(clock) >= to || (window.__omo.run && window.__omo.run.state !== 'playing' && window.__omo.run.time > from + 5), [to, clock, from], { timeout: 200000, polling: 50 });
on = false;
await cdp.send('Page.stopScreencast');
const S = await page.evaluate(() => window.__sync);
await b.close();
const n2 = S.length, mx = S.reduce((a, s) => a + s[0], 0) / n2, my = S.reduce((a, s) => a + s[1], 0) / n2;
const k = S.reduce((a, s) => a + (s[0] - mx) * (s[1] - my), 0) / S.reduce((a, s) => a + (s[0] - mx) ** 2, 0);
for (const f of frames) f.song = my + k * (f.ts - mx);
fs.writeFileSync(`${out}/frames.json`, JSON.stringify({ rate: k, from, to, frames, ev }));
console.log(which, 'frames', frames.length, 'clock', frames[0]?.song.toFixed(2), '->', frames.at(-1)?.song.toFixed(2), 'rate', k.toFixed(5), JSON.stringify(ev.at(-1)));
