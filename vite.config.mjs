// Cross-platform Vite configuration for Alexandria
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { getPlatform, canUseNativeEsbuild, logPlatformInfo } from './src/utils/platform.js';

// Log platform information
logPlatformInfo();

// Use native esbuild if available, otherwise fall back to WASM
if (!canUseNativeEsbuild()) {
  console.log('⚠️  Native esbuild not available, using esbuild-wasm');
  process.env.ESBUILD_BINARY_PATH = 'esbuild-wasm';
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react({
    // Fix for WSL path issues
    fastRefresh: process.platform === 'win32' ? true : false,
    include: '**/*.{jsx,tsx}',
  })],
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), './src'),
      '@client': path.resolve(process.cwd(), './src/client'),
      '@core': path.resolve(process.cwd(), './src/core'),
      '@ui': path.resolve(process.cwd(), './src/client/components/ui'),
      '@utils': path.resolve(process.cwd(), './src/utils'),
'lucide-react': path.resolve(process.cwd(), 'node_modules/lucide-react/dist/umd/lucide-react.js')
    },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
    conditions: ['import', 'module', 'browser', 'default']
  },
  server: {
    port: 3000,
    fs: {
      strict: false,
      allow: ['..']
    },
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist/client',
    // Memory optimization settings
    sourcemap: false, // Disable sourcemaps in production to save memory
    minify: 'esbuild', // Use esbuild for faster minification
    chunkSizeWarningLimit: 1000, // Increase chunk size warning limit
    // Use esbuild-wasm for cross-platform compatibility
    esbuild: {
      target: 'es2020',
      drop: ['console', 'debugger'] // Remove console logs in production
    },
    rollupOptions: {
      // Platform-specific configuration
      ...(getPlatform() === 'windows' && {
        // Windows-specific Rollup options
        external: (id) => {
          // Exclude problematic native modules on Windows
          return id.includes('@rollup/rollup-linux') || id.includes('@esbuild/linux');
        }
      }),
      // Suppress warnings about missing binary modules
      onwarn(warning, warn) {
        if (warning.code === 'UNRESOLVED_IMPORT' && warning.source?.includes('rollup')) {
          return;
        }
        if (warning.code === 'UNRESOLVED_IMPORT' && warning.source?.includes('native.js')) {
          return;
        }
        if (warning.code === 'UNRESOLVED_IMPORT' && warning.source?.includes('lucide-react')) {
          return;
        }
        if (warning.code === 'UNRESOLVED_IMPORT' && warning.source?.includes('@radix-ui/react-select')) {
          return;
        }
        // Suppress platform-specific binary warnings
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && warning.message.includes('esbuild')) {
          return;
        }
        warn(warning);
      }
    }
  },
  optimizeDeps: {
    include: [
      'react', 
      'react-dom', 
      'react-router-dom', 
      'styled-components', 
      'lucide-react',
      'date-fns',
      '@radix-ui/react-select',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu'
    ],
    force: true,
    esbuildOptions: {
      mainFields: ['browser', 'module', 'main']
    }
  },
  define: {
    global: 'globalThis'
  }
});