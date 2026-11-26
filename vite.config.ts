import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const root = fileURLToPath(new URL('.', import.meta.url));

/** Dev server only: Record Mode reads and writes levels/<id>/presses.json through this. */
function pressesApi(): Plugin {
  return {
    name: 'omo-presses',
    configureServer(server) {
      server.middlewares.use('/__presses', (req, res) => {
        const id = (req.url || '').replace(/^\//, '').replace(/[?#].*$/, '');
        const file = resolve(root, 'levels', id, 'presses.json');
        if (!/^[a-z0-9_-]+$/i.test(id) || !existsSync(resolve(root, 'levels', id, 'level.json'))) { res.statusCode = 404; res.end('no such level'); return; }
        if (req.method === 'GET') {
          res.setHeader('content-type', 'application/json');
          res.end(existsSync(file) ? readFileSync(file, 'utf8') : '{"bars":{}}');
        } else if (req.method === 'POST') {
          let body = '';
          req.on('data', (d) => { body += d; if (body.length > 2e6) req.destroy(); });
          req.on('end', () => {
            try {
              const doc = JSON.parse(body) as { bars?: unknown };
              if (!doc || typeof doc.bars !== 'object') throw new Error('bars missing');
              writeFileSync(file, JSON.stringify(doc, null, 1) + '\n');
              res.setHeader('content-type', 'application/json');
              res.end('{"ok":true}');
            } catch (e) { res.statusCode = 400; res.end(String(e)); }
          });
        } else { res.statusCode = 405; res.end(); }
      });
    }
  };
}

/**
 * Dev and preview servers: the phone check (`?phonecheck`) sends its frame times here, and they are appended to
 * frames-phone.log in the project folder (one JSON line per run), so the numbers from the iPhone can be read on the Mac.
 */
function framesApi(): Plugin {
  const handle = (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse): void => {
    if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
    let body = '';
    req.on('data', (d) => { body += d; if (body.length > 2e5) req.destroy(); });
    req.on('end', () => {
      try { JSON.parse(body); appendFileSync(resolve(root, 'frames-phone.log'), body.replace(/\n/g, ' ') + '\n'); res.end('{"ok":true}'); } catch (e) { res.statusCode = 400; res.end(String(e)); }
    });
  };
  return {
    name: 'omo-frames',
    configureServer(server) { server.middlewares.use('/__frames', handle); },
    configurePreviewServer(server) { server.middlewares.use('/__frames', handle); }
  };
}

/** iPhone screens (CSS points, pixel ratio) that have a launch image in public/splash; see tools/make-icons.py. */
const SPLASH: [number, number, number][] = [[440, 956, 3], [430, 932, 3], [420, 912, 3], [402, 874, 3], [393, 852, 3], [390, 844, 3], [428, 926, 3], [375, 812, 3], [414, 896, 3], [414, 896, 2], [375, 667, 2]];

/**
 * Site build only. Makes the game work offline after the first visit: writes sw.js with the list of every built
 * file (the name of its cache changes whenever a file does, so an update replaces the old copy), and adds the
 * launch images iOS shows for a home-screen web app.
 */
/** the sounds a player of the public build can hear; the rest (old songs, sketches) are for the test chambers only */
const HEARD_AUDIO = ['started', 'startedbed', 'opening', 'coldopen', 'nebula', 'volcano', 'flutter', 'luna', 'willow', 'darkness', 'throne', 'longroad', 'memfilm', 'hub0', 'hub1', 'fire0', 'fire1', 'sting1', 'sting2', 'helion1', 'helion2', 'helion3', 'helion4', 'helion5'];
/** saved on the first visit (the first ten minutes: the cold open, the opening, the first stage, the Landing); every other
 * song is saved the first time it is played, so a world played once plays again with no connection */
const FIRST_AUDIO = ['coldopen', 'nebula', 'opening', 'startedbed', 'started', 'sting1', 'fire0', 'fire1', 'hub0', 'hub1', 'helion1'];
function offline(mode: string): Plugin {
  let outDir = resolve(root, 'dist');
  return {
    name: 'omo-offline',
    apply: 'build',
    configResolved(cfg) { outDir = resolve(cfg.root, cfg.build.outDir); }, // (the folder actually built: --outDir included)
    transformIndexHtml() {
      return SPLASH.map(([w, h, r]) => ({
        tag: 'link',
        attrs: { rel: 'apple-touch-startup-image', href: `./splash/${w}x${h}@${r}.png`, media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)` },
        injectTo: 'head' as const
      }));
    },
    closeBundle() {
      const dist = outDir;
      if (!existsSync(resolve(dist, 'index.html'))) return;
      const files: string[] = [];
      const walk = (dir: string): void => {
        for (const name of readdirSync(dir)) {
          const full = resolve(dir, name);
          if (statSync(full).isDirectory()) walk(full); else files.push(relative(dist, full).split('\\').join('/'));
        }
      };
      walk(dist);
      // the public build leaves out what no player hears (the checks' build keeps it all, for the test chambers)
      if (mode !== 'checks') for (const f of files.splice(0)) { const m = /^audio\/([a-z0-9]+)\.mp3$/.exec(f); if (m && !HEARD_AUDIO.includes(m[1])) unlinkSync(resolve(dist, f)); else files.push(f); }
      // launch images are only read by iOS when the app is added to the home screen: no need to keep them offline
      const keep = files.filter((f) => f !== 'sw.js' && !f.startsWith('splash/') && !f.endsWith('.DS_Store') && !(f.startsWith('audio/') && !FIRST_AUDIO.includes(f.slice(6, -4)))).sort();
      const hash = createHash('sha1');
      for (const f of keep) { hash.update(f); hash.update(readFileSync(resolve(dist, f))); }
      const sw = readFileSync(resolve(root, 'tools/sw.template.js'), 'utf8')
        .replace('__CACHE__', `omo-${hash.digest('hex').slice(0, 12)}`)
        .replace('__FILES__', JSON.stringify(['./', ...keep]));
      writeFileSync(resolve(dist, 'sw.js'), sw);
    }
  };
}

// `vite build`               -> dist/         static site (GitHub Pages, PWA, Capacitor webDir)
// `vite build --mode single` -> dist-single/  one HTML file; tools/build-single.mjs then embeds the audio
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { version: string };
export default defineConfig(({ mode }) => ({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)) },
  plugins: mode === 'single' ? [viteSingleFile()] : [pressesApi(), framesApi(), offline(mode)],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    target: 'es2020',
    copyPublicDir: mode !== 'single'
  },
  // Record Mode saves presses.json while the game is open: the page reads it fresh itself, so no reload
  server: { port: 5173, watch: { ignored: ['**/levels/*/presses.json'] } }
}));
