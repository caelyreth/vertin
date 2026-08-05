import { defineConfig } from 'tsdown'

export default defineConfig({
  workspace: {
    include: ['lib'],
  },
  entry: ['src/index.ts'],
  dts: true,
  exports: true,
  clean: true,
})
