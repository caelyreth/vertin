import { defineConfig } from 'tsdown'

export default defineConfig({
  workspace: {
    include: ['lib'],
  },
  entry: ['src/index.ts'],
  dts: {
    oxc: true,
  },
  clean: true,
})
