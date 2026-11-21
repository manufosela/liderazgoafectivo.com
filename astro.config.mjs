// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // No script is inlined into the HTML, so a page can run under a CSP with script-src 'self' (see /audiolibro).
  vite: { build: { assetsInlineLimit: 0 } },
});
