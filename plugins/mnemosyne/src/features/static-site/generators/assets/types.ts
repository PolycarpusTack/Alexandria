/**
 * Asset Generator Types
 * Shared types for asset generation modules
 */

export interface AssetOptions {
  minify?: boolean;
  generateSourceMaps?: boolean;
  addHashes?: boolean;
  customCSS?: string;
  customJS?: string;
  optimizeImages?: boolean;
  imageFormats?: string[];
  imageQuality?: number;
}

export interface ThemeConfig {
  name: string;
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  linkColor?: string;
  borderColor?: string;
  codeBackground?: string;
  fontFamily?: string;
  monospaceFontFamily?: string;
  maxWidth?: string;
}

export interface ImageProcessingOptions {
  formats: string[];
  quality: number;
  maxWidth?: number;
  maxHeight?: number;
  generateThumbnails?: boolean;
  thumbnailSizes?: number[];
}

export interface FontAsset {
  src: string;
  family: string;
  weight?: string;
  style?: string;
  format?: string;
}

export interface PWAConfig {
  name: string;
  shortName: string;
  description: string;
  startUrl: string;
  display: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  themeColor: string;
  backgroundColor: string;
  icons: Array<{
    src: string;
    sizes: string;
    type: string;
  }>;
}

export interface AssetMetadata {
  originalPath?: string;
  processedAt: Date;
  size: number;
  hash: string;
  mimeType?: string;
}

export interface CSSAssetConfig {
  theme: string;
  customCSS?: string;
  includePrintStyles?: boolean;
  includeResetStyles?: boolean;
  cssScopingPrefix?: string;
}

export interface JSAssetConfig {
  includeSearch?: boolean;
  includeNavigation?: boolean;
  includeAnalytics?: boolean;
  analyticsId?: string;
  includeGraph?: boolean;
  customJS?: string;
  moduleFormat?: 'iife' | 'esm' | 'umd';
}

export interface AssetCacheEntry {
  path: string;
  content: string | Buffer;
  hash: string;
  metadata: AssetMetadata;
  expiresAt?: Date;
}