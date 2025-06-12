import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

// Shared utilities build configuration
export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'AlexandriaShared',
      formats: ['es', 'cjs'],
      fileName: (format) => format === 'es' ? 'index.mjs' : 'index.js',
    },
    rollupOptions: {
      external: ['joi', 'uuid', 'date-fns', 'express'],
      output: {
        globals: {
          joi: 'Joi',
          uuid: 'uuid',
          'date-fns': 'dateFns',
          express: 'express',
        },
      },
    },
    sourcemap: true,
    minify: 'esbuild',
    target: 'node18',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});