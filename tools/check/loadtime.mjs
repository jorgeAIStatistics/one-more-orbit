// First-load time of the public build on throttled connections (Chrome's network emulation): when the page shows
// something (the in-page first moment), when the game is up (window.__omoReady), and how much was downloaded by then
// and once the offline cache has filled. node loadtime.mjs <url>
import { chromium } from 'playwright-core';
const url = process.argv[2];
const NETS = { 'average 4G (9 Mbps, 85 ms)': [9e6 / 8, 85], 'slow 4G (1.6 Mbps, 150 ms)': [1.6e6 / 8, 150], 'broadband (40 Mbps, 20 ms)': [40e6 / 8, 20] };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
for (const [name, [bps, rtt]] of Object.entries(NETS)) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: rtt, downloadThroughput: bps, uploadThroughput: bps / 4 });
  let bytes = 0; cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength; });
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'commit' });
  await page.waitForSelector('#boot', { timeout: 60000 }); const tBoot = Date.now() - t0;
  await page.waitForFunction(() => window.__omoReady === true, null, { timeout: 120000 }); const tReady = Date.now() - t0, bReady = bytes;
  // the offline cache filling in the background (the service worker's install)
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller !== null || false, null, { timeout: 180000 }).catch(() => undefined);
  await page.waitForTimeout(2000);
  const sw = await page.evaluate(async () => { const ks = await caches.keys(); let n = 0; for (const k of ks) n += (await (await caches.open(k)).keys()).length; return n; }).catch(() => -1);
  console.log(JSON.stringify({ net: name, firstMomentMs: tBoot, gameReadyMs: tReady, mbAtReady: +(bReady / 1e6).toFixed(2), mbAfterCache: +(bytes / 1e6).toFixed(2), cachedFiles: sw, secsUntilCached: Math.round((Date.now() - t0) / 1000) }));
  await ctx.close();
}
await b.close();
