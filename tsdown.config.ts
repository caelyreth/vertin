import { defineConfig } from 'tsdown'

export default defineConfig({
  workspace: {
    include: ['lib'],
  },
  entry: [
    'src/index.ts',
    'src/tint.ts',
  ],
  dts: {
    oxc: true,
  },
  clean: true,
})
