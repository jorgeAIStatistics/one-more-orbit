// The Stillness concepts: stills at three moments, and a six-second motion test (frames for mux / ffmpeg).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const out = process.argv[2]; fs.mkdirSync(`${out}/motion`, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1210, height: 540 }, deviceScaleFactor: 1 });
p.on('pageerror', (e) => console.log('ERR', String(e).slice(0, 300)));
await p.goto('http://localhost:5199/mockups/art/stillness.html?still'); await p.waitForFunction(() => document.title === 'ready', null, { timeout: 60000 });
for (const t of [1.2, 2.8, 4.3]) { await p.evaluate((t) => window.draw(t), t); await p.screenshot({ path: `${out}/still-${t}.jpg`, type: 'jpeg', quality: 88 }); }
for (let i = 0; i < 180; i++) { await p.evaluate((t) => window.draw(t), i / 30); await p.screenshot({ path: `${out}/motion/m${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 82 }); }
await b.close();
