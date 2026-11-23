// Measures how smoothly the ball moves on screen. Plays stretches of each level in Chrome (phone size, muted) and
// records where the ball is drawn every frame. A "jolt" is a frame where the ball's step differs from the step before
// it by more than a smooth path allows: the ball visibly twitches there.
//   npm run dev   (in another terminal)
//   node tools/smooth-check.mjs            needs: npm i -D playwright-core, and Google Chrome
import { chromium } from 'playwright-core';
const URL = process.env.OMO_URL || 'http://localhost:5173/';
// [level index, start beat, seconds, how it is played]
const RUNS = [[0, 62, 14, 'bot'], [0, 62, 14, 'human'], [1, 60, 14, 'human'], [2, 124, 14, 'human'], [3, 78, 14, 'human'], [0, 8, 12, 'human']];
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto(URL, { waitUntil: 'load' });
const rows = [];
for (const [lvl, beat0, secs, how] of RUNS) {
  const r = await page.evaluate(async ([lvl, beat0, secs, how]) => {
    const o = window.__omo;
    Storage.prototype.setItem = function () {};
    Object.assign(o.save, { music: 0, sfx: 0, hitVol: 0, calibrated: true, tutorialDone: true, unlockAll: true, audioOffset: 0, visualOffset: 0 });
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    o.show('levels'); o.level(lvl); await wait(80);
    const bot = how === 'bot';
    o.start(bot, true, 0); await wait(300);
    const spb = o.run.level.spb; o.run.stop(); o.show('levels'); o.level(lvl); await wait(60);
    o.start(bot, true, beat0 * spb);
    for (let i = 0; i < 200 && o.run.state !== 'playing'; i++) await wait(30);
    // a person: taps land 0 to 45 ms either side of the note, and each reaches the game up to a frame late
    let k = 0; let seed = 7;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    let offs = [];
    const feed = bot ? 0 : setInterval(() => {
      const run = o.run; if (!run || run.state !== 'playing') return;
      const taps = run.course.taps;
      while (k < taps.length && taps[k] * spb < Math.max(run.startAt, run.time - 0.3)) k++;
      if (offs[k] === undefined) offs[k] = (rnd() - 0.5) * 0.09;
      if (k < taps.length && run.clock.at(performance.now()) >= taps[k] * spb + offs[k]) { run.tap(performance.now() - rnd() * 16); k++; }
    }, 2);
    const pts = [];
    await new Promise((res) => {
      const end = performance.now() + secs * 1000 + 1500; let begun = 0;
      const f = (t) => {
        const run = o.run;
        if (run && run.state === 'playing' && run.time >= run.startAt) { if (!begun) begun = t; pts.push([t, o.renderer.ballXY[0], o.renderer.ballXY[1], run.time / spb, run.sim.mode === 'flight' ? 1 : 0]); }
        if (t < end && !(begun && t - begun > secs * 1000)) requestAnimationFrame(f); else res();
      };
      requestAnimationFrame(f);
    });
    clearInterval(feed);
    const crashed = o.run.sim.crashed;
    o.run.stop(); o.show('levels');
    // steps and jolts
    const jolts = []; let steps = [];
    for (let i = 2; i < pts.length; i++) {
      const dt1 = pts[i][0] - pts[i - 1][0], dt0 = pts[i - 1][0] - pts[i - 2][0];
      if (dt1 > 30 || dt0 > 30 || dt1 < 4 || dt0 < 4) continue; // a dropped frame is not the ball's doing
      const vx1 = (pts[i][1] - pts[i - 1][1]) / dt1, vy1 = (pts[i][2] - pts[i - 1][2]) / dt1;
      const vx0 = (pts[i - 1][1] - pts[i - 2][1]) / dt0, vy0 = (pts[i - 1][2] - pts[i - 2][2]) / dt0;
      const j = Math.hypot(vx1 - vx0, vy1 - vy0) * 16.7; // change of step, in px per 60 Hz frame
      steps.push(Math.hypot(vx1, vy1) * 16.7);
      jolts.push([j, +pts[i][3].toFixed(2), pts[i][4]]);
    }
    steps.sort((a, b) => a - b);
    const big = jolts.filter((x) => x[0] > 2);
    const worst = [...jolts].sort((a, b) => b[0] - a[0]).slice(0, 6).map((x) => `${x[0].toFixed(1)}px@${x[1]}${x[2] ? 'f' : 'g'}`);
    return { level: o.run ? '' : '', frames: pts.length, medianStep: +steps[Math.floor(steps.length / 2)].toFixed(2), jolts2px: big.length, jolts5px: jolts.filter((x) => x[0] > 5).length, maxJolt: +Math.max(...jolts.map((x) => x[0])).toFixed(1), worst, crashed };
  }, [lvl, beat0, secs, how]);
  rows.push({ run: `L${lvl + 1} beat ${beat0} ${how}`, ...r });
}
for (const r of rows) console.log(`${r.run.padEnd(22)} frames ${String(r.frames).padStart(4)}  step ${r.medianStep}px  jolts>2px ${String(r.jolts2px).padStart(3)}  >5px ${String(r.jolts5px).padStart(3)}  max ${r.maxJolt}px  worst ${r.worst.join(' ')}${r.crashed ? '  (crashed)' : ''}`);
if (errs.length) console.log('errors', errs.slice(0, 3));
await browser.close();
