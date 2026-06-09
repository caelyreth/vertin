import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['lib/src/**/*.ts'],
      exclude: [
        'lib/src/types.ts',
        'lib/src/tint.ts', // refer to `@uttr/tint`
      ],
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 95,
        statements: 100,
      },
    },
  },
})
