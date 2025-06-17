/**
 * Shared types and interfaces for static site generation
 */

export interface StaticSiteOptions {
  // Site configuration
  outputDir: string;
  baseUrl?: string;
  siteName?: string;
  
  // Theme and templates
  theme?: 'minimal' | 'academic' | 'blog' | 'documentation' | 'knowledge-base';
  templateId?: string;
  customCSS?: string;
  customJS?: string;
  
  // Content organization
  generateIndex?: boolean;
  generateSitemap?: boolean;
  generateRSS?: boolean;
  generateSearch?: boolean;
  groupByTags?: boolean;
  groupByDate?: boolean;
  
  // Navigation
  includeNavigation?: boolean;
  includeBacklinks?: boolean;
  includeBreadcrumbs?: boolean;
  includeTagCloud?: boolean;
  
  // Knowledge graph features
  includeKnowledgeGraph?: boolean;
  graphVisualization?: 'd3' | 'cytoscape' | 'vis' | 'force-graph';
  interactiveGraph?: boolean;
  
  // Search functionality
  searchType?: 'lunr' | 'fuse' | 'elasticlunr' | 'client-side';
  indexContent?: boolean;
  
  // Performance optimization
  enableMinification?: boolean;
  enableCompression?: boolean;
  enableLazyLoading?: boolean;
  generatePWA?: boolean;
  
  // SEO and metadata
  enableSEO?: boolean;
  generateOpenGraph?: boolean;
  generateTwitterCards?: boolean;
  robotsTxt?: string;
  
  // Analytics integration
  analyticsId?: string;
  analyticsProvider?: 'google' | 'plausible' | 'fathom' | 'custom';
  
  // Asset management
  optimizeImages?: boolean;
  generateThumbnails?: boolean;
  copyAssets?: boolean;
  assetDirs?: string[];
  
  // Development features
  generateDevServer?: boolean;
  enableHotReload?: boolean;
  watchFiles?: boolean;
}

export interface GeneratedSite {
  outputPath: string;
  pages: GeneratedPage[];
  assets: GeneratedAsset[];
  sitemap?: string;
  searchIndex?: any;
  buildManifest: BuildManifest;
  performanceMetrics: PerformanceMetrics;
}

export interface GeneratedPage {
  path: string;
  title: string;
  content: string;
  metadata: PageMetadata;
  dependencies: string[];
  size: number;
  generatedAt: Date;
}

export interface GeneratedAsset {
  path: string;
  type: 'css' | 'js' | 'image' | 'font' | 'data';
  size: number;
  hash: string;
  optimized: boolean;
}

export interface PageMetadata {
  title: string;
  description?: string;
  keywords?: string[];
  author?: string;
  created?: Date;
  modified?: Date;
  tags?: string[];
  readingTime?: number;
  wordCount?: number;
  relatedPages?: string[];
}

export interface BuildManifest {
  buildId: string;
  timestamp: Date;
  totalPages: number;
  totalAssets: number;
  totalSize: number;
  buildTime: number;
  version: string;
  dependencies: Record<string, string>;
}

export interface PerformanceMetrics {
  buildTime: number;
  pageGenerationTime: number;
  assetOptimizationTime: number;
  averagePageSize: number;
  compressionRatio?: number;
  lighthouseScore?: number;
}

export interface SiteStructure {
  pages: Map<string, PageInfo>;
  navigation: NavigationItem[];
  tagHierarchy: Map<string, string[]>;
  dateHierarchy: Map<string, string[]>;
  knowledgeGraph?: KnowledgeGraphData;
}

export interface PageInfo {
  id: string;
  path: string;
  title: string;
  tags: string[];
  created: Date;
  modified: Date;
  backlinks: string[];
  outlinks: string[];
  level: number;
}

export interface NavigationItem {
  title: string;
  path: string;
  children?: NavigationItem[];
  icon?: string;
  order?: number;
}

export interface KnowledgeGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: GraphCluster[];
  metadata: GraphMetadata;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  metadata?: any;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  weight?: number;
}

export interface GraphCluster {
  id: string;
  nodes: string[];
  label?: string;
}

export interface GraphMetadata {
  totalNodes: number;
  totalEdges: number;
  density: number;
  diameter?: number;
}

export interface SiteConfiguration {
  siteName: string;
  baseUrl: string;
  theme: string;
  navigation: NavigationItem[];
  metadata: SiteMetadata;
  features: SiteFeatures;
}

export interface SiteMetadata {
  title: string;
  description?: string;
  author?: string;
  language?: string;
  copyright?: string;
}

export interface SiteFeatures {
  search: boolean;
  analytics: boolean;
  comments: boolean;
  sharing: boolean;
}