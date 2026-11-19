import { defineConfig } from 'vitest/config';

// Unit tests of the site's browser scripts; the backend has its own config in functions/.
export default defineConfig({
  test: {
    include: ['src/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/scripts/**/*.js'],
      exclude: ['src/**/*.test.js'],
      reporter: ['text', 'lcov'],
    },
  },
});
