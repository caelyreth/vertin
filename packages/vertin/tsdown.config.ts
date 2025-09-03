import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    entry: ['./src/index.ts'],
    format: 'es',
    sourcemap: true,
    outDir: 'dist',
    tsconfig: './tsconfig.json',
    dts: true,
  },
  {
    entry: './src/parser/index.ts',
    format: 'es',
    sourcemap: true,
    tsconfig: './tsconfig.json',
    outDir: 'dist/parser',
    dts: true,
  },
])
