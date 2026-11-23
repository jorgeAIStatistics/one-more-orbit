import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `vite build`               -> dist/         static site (GitHub Pages, PWA, Capacitor webDir)
// `vite build --mode single` -> dist-single/  one HTML file; tools/build-single.mjs then embeds the audio
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    target: 'es2020',
    copyPublicDir: mode !== 'single'
  },
  server: { port: 5173 }
}));
