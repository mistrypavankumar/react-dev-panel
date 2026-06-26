import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'adapters/next': 'src/adapters/next.ts',
    'adapters/vite': 'src/adapters/vite.ts',
    'adapters/server': 'src/adapters/server.ts',
    'cli/index': 'src/cli/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  treeshake: true,
  sourcemap: true,
  // React, MUI/Emotion, react-icons, the optional TS compiler, and Node-only deps stay external.
  external: [
    'react',
    'react-dom',
    '@mui/material',
    '@emotion/react',
    '@emotion/styled',
    'react-icons',
    'typescript',
    'launch-editor',
  ],
});
