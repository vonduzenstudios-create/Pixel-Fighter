/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// Relative base so the build works on GitHub Pages under /Pixel-Fighter/.
// Two pages: the game (index.html) and the standalone changelog (whats-new.html).
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    rollupOptions: { input: { main: 'index.html', whatsnew: 'whats-new.html' } },
  },
  test: { include: ['tests/**/*.test.ts'] },
});
