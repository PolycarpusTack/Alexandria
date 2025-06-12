/**
 * Platform detection and utility functions
 */

import { execSync } from 'child_process';
import * as os from 'os';
import { createLogger } from './logger';

const logger = createLogger({ serviceName: 'platform-utils' });

/**
 * Platform types
 */
export type Platform = 'windows' | 'macos' | 'linux' | 'unknown';
export type Architecture = 'x64' | 'arm64' | 'ia32' | 'unknown';

/**
 * Get the current platform
 */
export function getPlatform(): Platform {
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

/**
 * Get the current architecture
 */
export function getArchitecture(): Architecture {
  switch (process.arch) {
    case 'x64':
      return 'x64';
    case 'arm64':
      return 'arm64';
    case 'ia32':
      return 'ia32';
    default:
      return 'unknown';
  }
}

/**
 * Check if running on Windows
 */
export function isWindows(): boolean {
  return getPlatform() === 'windows';
}

/**
 * Check if running on macOS
 */
export function isMacOS(): boolean {
  return getPlatform() === 'macos';
}

/**
 * Check if running on Linux
 */
export function isLinux(): boolean {
  return getPlatform() === 'linux';
}

/**
 * Check if native esbuild is available for the current platform
 */
export function canUseNativeEsbuild(): boolean {
  const platform = getPlatform();
  const arch = getArchitecture();

  // Check if we're in a known good configuration
  const supportedConfigs = [
    { platform: 'windows', arch: 'x64' },
    { platform: 'macos', arch: 'x64' },
    { platform: 'macos', arch: 'arm64' },
    { platform: 'linux', arch: 'x64' },
    { platform: 'linux', arch: 'arm64' }
  ];

  return supportedConfigs.some(
    (config) => config.platform === platform && config.arch === arch
  );
}

/**
 * Get platform-specific path separator
 */
export function getPathSeparator(): string {
  return isWindows() ? '\\' : '/';
}

/**
 * Convert path to platform-specific format
 */
export function toPlatformPath(path: string): string {
  if (isWindows()) {
    return path.replace(/\//g, '\\');
  }
  return path.replace(/\\/g, '/');
}

/**
 * Get platform-specific environment info
 */
export function getPlatformInfo(): {
  platform: Platform;
  architecture: Architecture;
  nodeVersion: string;
  osVersion: string;
  cpuCores: number;
  totalMemory: string;
  freeMemory: string;
} {
  return {
    platform: getPlatform(),
    architecture: getArchitecture(),
    nodeVersion: process.version,
    osVersion: os.release(),
    cpuCores: os.cpus().length,
    totalMemory: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
    freeMemory: `${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`
  };
}

/**
 * Execute a platform-specific command
 */
export function execPlatformCommand(commands: {
  windows?: string;
  macos?: string;
  linux?: string;
  default: string;
}): string {
  const platform = getPlatform();
  const command =
    platform === 'unknown'
      ? commands.default
      : commands[platform as keyof typeof commands] || commands.default;

  try {
    return execSync(command, { encoding: 'utf-8' }).trim();
  } catch (error) {
    throw new Error(`Failed to execute command on ${platform}: ${error}`);
  }
}

/**
 * Log platform information
 */
export function logPlatformInfo(): void {
  const info = getPlatformInfo();
  logger.info('Platform Information', {
    platform: `${info.platform} (${info.architecture})`,
    nodeVersion: info.nodeVersion,
    osVersion: info.osVersion,
    cpuCores: info.cpuCores,
    memory: `${info.freeMemory} free / ${info.totalMemory} total`,
    nativeESBuild: canUseNativeEsbuild() ? 'Available' : 'Not Available (using WASM)'
  });
}
