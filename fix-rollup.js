#!/usr/bin/env node

/**
 * Simplified Rollup fix - disable WASM override to prevent parsing issues
 * This script removes the complex WASM parsing fallback that was causing build errors
 */

const fs = require('fs');
const path = require('path');

console.log('Applying simplified Rollup fix...');

// Remove the problematic native.js override
const rollupNativePath = path.join(__dirname, 'node_modules', 'rollup', 'dist', 'native.js');
if (fs.existsSync(rollupNativePath)) {
  try {
    // Create a pure ES module override
    const simpleOverride = `// Pure ES Module override for Rollup native functions
// This prevents the complex WASM fallback that was causing parsing issues

export const hasNativeSupport = () => false;

export const requireWithFriendlyError = (id) => {
  console.warn(\`Native module \${id} not supported, using default Rollup implementation\`);
  // Return undefined to let Rollup use its default fallback
  return undefined;
};

// Export undefined functions to satisfy imports but let Rollup use defaults
export const parse = undefined;
export const parseAsync = undefined;
export const xxhashBase64Url = undefined;
export const xxhashBase36 = undefined;
export const xxhashBase16 = undefined;
`;
    fs.writeFileSync(rollupNativePath, simpleOverride);
    console.log('✅ Applied simplified native.js override');
  } catch (error) {
    console.warn('⚠️ Could not override native.js:', error.message);
  }
}

console.log('🎉 Simplified Rollup fix completed!');