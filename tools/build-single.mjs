// Turns the `vite build --mode single` output into one self-contained HTML file with the audio embedded,
// so the game can be double-clicked or sent to someone.  Usage: npm run build:single
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let html = readFileSync(resolve(root, 'dist-single/index.html'), 'utf8');
const audio = {};
for (const f of readdirSync(resolve(root, 'public/audio'))) {
  if (/\.(mp3|m4a|ogg)$/.test(f)) audio[`audio/${f}`] = readFileSync(resolve(root, 'public/audio', f)).toString('base64');
}
const tag = `<script>window.__OMO_AUDIO__=${JSON.stringify(audio)};</script>`;
if (!html.includes('</head>')) throw new Error('unexpected build output');
html = html.replace('</head>', () => `${tag}\n</head>`);
const out = resolve(root, process.argv[2] || '../one_more_orbit_v4.html');
writeFileSync(out, html);
console.log(`${out}  ${(html.length / 1e6).toFixed(2)} MB  (${Object.keys(audio).length} track${Object.keys(audio).length === 1 ? '' : 's'} embedded)`);
