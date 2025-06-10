/**
 * Custom Rollup configuration to avoid native binary dependencies
 * This configuration will be used by Vite when building the project
 */

export default {
  // Disable native code usage
  context: 'window',
  // Force usage of JavaScript implementation
  treeshake: {
    moduleSideEffects: 'no-external',
    propertyReadSideEffects: false,
    tryCatchDeoptimization: false
  },
  // Override the usage of native plugin
  plugins: []
};