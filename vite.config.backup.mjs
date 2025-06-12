// Cross-platform Vite configuration for Alexandria
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Simple platform detection without requiring Node.js modules in ESM context
const isWindows = process.platform === 'win32';

// Platform-specific esbuild handling
// Removed esbuild-wasm configuration as it causes issues

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react({
    // Fix for WSL path issues
    fastRefresh: process.platform === 'win32' ? true : false,
    include: '**/*.{jsx,tsx}',
  })],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@client': path.resolve(__dirname, './src/client'),
      '@core': path.resolve(__dirname, './src/core'),
      '@ui': path.resolve(__dirname, './src/client/components/ui'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@alexandria/shared': path.resolve(__dirname, './packages/shared/src'),
      '@alexandria/ui-components': path.resolve(__dirname, './packages/ui-components/src'),
      'lucide-react': path.resolve(__dirname, 'node_modules/lucide-react/dist/umd/lucide-react.js'),
      // Map logger imports to browser version for client-side code
      '../utils/logger': path.resolve(__dirname, './src/utils/logger.browser.ts'),
      './logger': path.resolve(__dirname, './src/utils/logger.browser.ts')
    },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
    conditions: ['import', 'module', 'browser', 'default']
  },
  server: {
    port: 5173,
    host: true,
    fs: {
      strict: false,
      allow: ['..']
    },
    hmr: {
      port: 5173,
      host: 'localhost'
    },
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('proxy error', err);
          });
        }
      }
    }
  },
  build: {
    outDir: 'dist/client',
    // Memory optimization settings
    sourcemap: false, // Disable sourcemaps in production to save memory
    minify: 'esbuild', // Use esbuild for faster minification
    chunkSizeWarningLimit: 500, // Lower chunk size warning limit
    // Use esbuild-wasm for cross-platform compatibility
    esbuild: {
      target: 'es2020',
      drop: ['console', 'debugger'] // Remove console logs in production
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor libraries
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select', '@radix-ui/react-tabs'],
          'vendor-charts': ['chart.js', 'recharts'],
          'vendor-icons': ['lucide-react'],
          'vendor-utils': ['date-fns', 'clsx', 'tailwind-merge', 'class-variance-authority'],
          // Alexandria specific chunks
          'alexandria-plugins': ['../plugins/alfred/ui/index', '../plugins/hadron/ui/index'],
          'alexandria-core': ['../core/services/ai-service/index', '../utils/logger.browser']
        }
      },
      // Platform-specific configuration
      ...(isWindows && {
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