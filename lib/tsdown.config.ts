import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    './src/index.ts',
    './src/tint.ts',
  ],
  format: 'es',
  sourcemap: true,
  dts: true,
  tsconfig: './tsconfig.json',
})
