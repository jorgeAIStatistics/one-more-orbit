// App Store screenshots: stages screens on the dev server with tools/stage-shots.js and captures them at exact pixel sizes.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] || 'release/screenshots';
const SIZES = [['iphone-large-1290x2796', 430, 932], ['iphone-medium-1206x2622', 402, 874]];
const SHOTS = [['01 level select', 'levels'], ['02 drop', 'play'], ['03 twin orbit', 'twin'], ['04 level complete', 'finale'], ['05 results', 'clear'], ['06 badges', 'badges'], ['07 title', 'title']];
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const log = {};
for (const [dir, w, h] of SIZES) {
  mkdirSync(`${OUT}/${dir}`, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto('http://localhost:5173/?shots=1', { waitUntil: 'load' });
  await page.evaluate(async () => { await import('/tools/stage-shots.js'); });
  for (const [name, stage] of SHOTS) {
    const r = await page.evaluate((s) => window.__stage(s), stage);
    // the two gameplay shots are staged with autoplay: show an ordinary attempt label instead
    await page.evaluate((on) => { let st = document.getElementById('shotStyle'); if (!st) { st = document.createElement('style'); st.id = 'shotStyle'; document.head.appendChild(st); } st.textContent = on ? "#attempt{font-size:0!important}#attempt::after{content:'ATTEMPT 12';font-size:11px}#bestPct{visibility:hidden}" : ''; }, stage === 'play' || stage === 'twin');
    await page.waitForTimeout(120);
    if (stage === 'clear') await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/${dir}/${name}.jpg`, type: 'jpeg', quality: 92 });
    log[`${dir}/${name}`] = r.screen + (r.errs.length ? ' ' + r.errs[0] : '');
  }
  // the new settings rows, for a look (not a store shot)
  log[dir + ' errors'] = errs;
  await ctx.close();
}
console.log(JSON.stringify(log, null, 1));
await browser.close();
