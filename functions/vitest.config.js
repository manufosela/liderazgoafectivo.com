import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['*.js'],
      exclude: ['*.test.js', 'vitest.config.js'],
      // Paths relative to the repository root, as SonarQube reads them.
      reporter: ['text', ['lcov', { projectRoot: '..' }]],
    },
  },
});
