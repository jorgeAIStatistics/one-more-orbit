import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

// `vite build`               -> dist/         static site (GitHub Pages, PWA, Capacitor webDir)
// `vite build --mode single` -> dist-single/  one HTML file; tools/build-single.mjs then embeds the audio
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [viteSingleFile()] : [pressesApi()],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    target: 'es2020',
    copyPublicDir: mode !== 'single'
  },
  // Record Mode saves presses.json while the game is open: the page reads it fresh itself, so no reload
  server: { port: 5173, watch: { ignored: ['**/levels/*/presses.json'] } }
}));
