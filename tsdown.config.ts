import { defineConfig } from 'tsdown'

export default defineConfig({
  workspace: {
    include: ['lib'],
  },
  entry: ['src/index.ts'],
  platform: 'neutral',
  fixedExtension: true,
  dts: true,
  exports: true,
  clean: true,
})
