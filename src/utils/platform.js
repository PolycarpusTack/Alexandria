/**
 * Platform utilities for Vite configuration
 * This is a simplified JavaScript version for use in vite.config.mjs
 */

export function getPlatform() {
  switch (process.platform) {
    case 'win32':
      return 'windows';
    case 'darwin':
      return 'macos';
    case 'linux':
      return 'linux';
    default:
      return 'unknown';
  }
}

export function canUseNativeEsbuild() {
  // Check if we can use native esbuild
  // For now, return true unless we're on an unsupported platform
  const platform = getPlatform();
  const arch = process.arch;
  
  // Native esbuild is supported on most common platforms
  if (platform === 'windows' && (arch === 'x64' || arch === 'ia32')) return true;
  if (platform === 'macos' && (arch === 'x64' || arch === 'arm64')) return true;
  if (platform === 'linux' && (arch === 'x64' || arch === 'arm64')) return true;
  
  return false;
}

export function logPlatformInfo() {
  console.log(`Platform: ${getPlatform()}`);
  console.log(`Architecture: ${process.arch}`);
  console.log(`Node version: ${process.version}`);
}