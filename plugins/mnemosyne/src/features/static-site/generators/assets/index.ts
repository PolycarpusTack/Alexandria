/**
 * Asset Generation Module Exports
 * Provides access to all asset generation functionality
 */

// Export main manager
export { AssetManager } from './AssetManager';

// Export individual generators for advanced usage
export { CSSGenerator } from './CSSGenerator';
export { JSGenerator } from './JSGenerator';
export { ImageProcessor } from './ImageProcessor';
export { PWAGenerator } from './PWAGenerator';
export { FontManager } from './FontManager';

// Export types
export * from './types';

// Default export for convenience
import { AssetManager } from './AssetManager';
export default AssetManager;