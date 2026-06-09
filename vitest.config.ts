import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['lib/src/**/*.ts'],
      exclude: ['lib/src/types.ts'],
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
    },
  },
})
