import { defineConfig } from 'vite';

// Relative base so the build works on GitHub Pages under /Pixel-Fighter/.
export default defineConfig({
  base: './',
  build: { target: 'es2022' },
});
