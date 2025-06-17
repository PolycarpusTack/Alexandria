/**
 * Shared types and interfaces for PDF export
 */

export interface PDFExportOptions {
  // Page configuration
  format?: 'A4' | 'Letter' | 'A3' | 'A5' | 'Legal' | 'Tabloid';
  orientation?: 'portrait' | 'landscape';
  scale?: number;
  
  // Margins and spacing
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  
  // Headers and footers
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  headerHeight?: string;
  footerHeight?: string;
  
  // Content options
  tableOfContents?: boolean;
  tocDepth?: number;
  includeIndex?: boolean;
  includeGlossary?: boolean;
  includeBacklinks?: boolean;
  includeBibliography?: boolean;
  
  // Visual enhancements
  printBackground?: boolean;
  colorMode?: 'color' | 'grayscale' | 'monochrome';
  quality?: 'draft' | 'normal' | 'high' | 'print';
  
  // Knowledge graph integration
  includeKnowledgeGraph?: boolean;
  graphLayout?: 'hierarchical' | 'force' | 'circular' | 'tree';
  graphDepth?: number;
  
  // Security and metadata
  security?: PDFSecurity;
  metadata?: PDFMetadata;
  
  // Advanced features
  bookmarks?: boolean;
  annotations?: boolean;
  crossReferences?: boolean;
  footnotes?: boolean;
  watermark?: WatermarkOptions;
  
  // Template integration
  templateId?: string;
  templateVariables?: Record<string, any>;
  customCSS?: string;
  customJS?: string;
  
  // Performance optimization
  chunkSize?: number;
  parallelRendering?: boolean;
  cacheEnabled?: boolean;
  compressionLevel?: number;
}

export interface PDFSecurity {
  password?: string;
  permissions?: {
    printing?: boolean;
    modifying?: boolean;
    copying?: boolean;
    annotating?: boolean;
  };
}

export interface PDFMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
}

export interface WatermarkOptions {
  text?: string;
  image?: string;
  opacity?: number;
  position?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  rotation?: number;
  scale?: number;
}

export interface ProcessedContent {
  documents: ProcessedDocument[];
  tableOfContents?: TableOfContents;
  index?: ContentIndex;
  glossary?: Glossary;
  bibliography?: Bibliography;
  knowledgeGraph?: KnowledgeGraphData;
  metadata: ExportMetadata;
  analytics: ContentAnalytics;
}

export interface ProcessedDocument {
  id: string;
  title: string;
  content: string;
  htmlContent: string;
  metadata: DocumentMetadata;
  backlinks: Backlink[];
  outlinks: Outlink[];
  headings: Heading[];
  footnotes: Footnote[];
  images: ImageReference[];
  tables: TableReference[];
  codeBlocks: CodeBlock[];
  citations: Citation[];
  keywords: string[];
  readingTime: number;
  complexity: number;
  pageBreaks: PageBreak[];
}

export interface TableOfContents {
  title: string;
  sections: TOCSection[];
  depth: number;
  pageMapping: Map<string, number>;
  crossReferences: Map<string, string[]>;
}

export interface TOCSection {
  id: string;
  title: string;
  level: number;
  page?: number;
  subsections: TOCSection[];
  documentId: string;
  anchor: string;
  wordCount: number;
}

export interface ContentIndex {
  terms: Map<string, IndexEntry[]>;
  categories: Map<string, string[]>;
}

export interface IndexEntry {
  term: string;
  documentId: string;
  pageNumber: number;
  context: string;
  frequency: number;
}

export interface Glossary {
  terms: GlossaryTerm[];
  acronyms: Map<string, string>;
}

export interface GlossaryTerm {
  term: string;
  definition: string;
  relatedTerms: string[];
  references: string[];
}

export interface Bibliography {
  entries: BibliographyEntry[];
  citationStyle: 'APA' | 'MLA' | 'Chicago' | 'Harvard';
}

export interface BibliographyEntry {
  id: string;
  type: 'book' | 'article' | 'website' | 'paper' | 'other';
  authors: string[];
  title: string;
  year?: number;
  publisher?: string;
  url?: string;
  doi?: string;
  isbn?: string;
  pages?: string;
  journal?: string;
  volume?: string;
  issue?: string;
}

export interface KnowledgeGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  layout: any;
  stats: {
    nodeCount: number;
    edgeCount: number;
    density: number;
    clusters: number;
  };
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  metadata?: any;
  position?: { x: number; y: number };
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  weight?: number;
  label?: string;
}

export interface ExportMetadata {
  exportDate: Date;
  documentCount: number;
  totalPages: number;
  fileSize: number;
  version: string;
  generator: string;
}

export interface ContentAnalytics {
  totalWords: number;
  averageReadingTime: number;
  complexityScore: number;
  keyTopics: string[];
  documentStructure: {
    headings: number;
    paragraphs: number;
    lists: number;
    tables: number;
    images: number;
    codeBlocks: number;
  };
}

export interface DocumentMetadata {
  created?: Date;
  modified?: Date;
  author?: string;
  tags?: string[];
  category?: string;
  version?: number;
}

export interface Backlink {
  sourceId: string;
  sourceTitle: string;
  context: string;
  anchor: string;
}

export interface Outlink {
  targetId: string;
  targetTitle: string;
  anchor: string;
  isExternal: boolean;
}

export interface Heading {
  id: string;
  text: string;
  level: number;
  anchor: string;
  pageNumber?: number;
}

export interface Footnote {
  id: string;
  number: number;
  content: string;
  reference: string;
}

export interface ImageReference {
  id: string;
  src: string;
  alt: string;
  caption?: string;
  pageNumber?: number;
}

export interface TableReference {
  id: string;
  caption?: string;
  headers: string[];
  rowCount: number;
  columnCount: number;
  pageNumber?: number;
}

export interface CodeBlock {
  id: string;
  language?: string;
  content: string;
  lineCount: number;
  pageNumber?: number;
}

export interface Citation {
  id: string;
  text: string;
  source: string;
  pageNumber?: number;
}

export interface PageBreak {
  type: 'auto' | 'manual' | 'section';
  position: number;
  reason?: string;
}