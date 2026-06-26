import { defineConfig } from 'tsup';

// Entry points grow as adapters/CLI land. Today: the core + bundled tools.
export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  treeshake: true,
  sourcemap: true,
  external: ['react', 'react-dom', 'typescript'],
});
