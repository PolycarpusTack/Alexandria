/**
 * Site Analyzer - Analyzes documents to build site structure
 */

import { Document as MnemosyneDocument, KnowledgeGraph } from '../../../../core/MnemosyneCore';
import { 
  SiteStructure,
  PageInfo,
  StaticSiteOptions,
  KnowledgeGraphData,
  GraphNode,
  GraphEdge,
  GraphCluster
} from '../core/types';
import * as path from 'path';

export class SiteAnalyzer {
  /**
   * Analyze documents and build site structure
   */
  async analyzeSiteStructure(
    documents: MnemosyneDocument[],
    knowledgeGraph: KnowledgeGraph,
    options: StaticSiteOptions
  ): Promise<SiteStructure> {
    const structure: SiteStructure = {
      pages: new Map(),
      navigation: [],
      tagHierarchy: new Map(),
      dateHierarchy: new Map()
    };
    
    // First pass: Create page info for each document
    for (const doc of documents) {
      const pageInfo = await this.createPageInfo(doc, options);
      structure.pages.set(doc.id, pageInfo);
    }
    
    // Second pass: Build relationships
    await this.buildRelationships(structure, documents, knowledgeGraph);
    
    // Build tag hierarchy
    this.buildTagHierarchy(structure);
    
    // Build date hierarchy if enabled
    if (options.groupByDate) {
      this.buildDateHierarchy(structure);
    }
    
    // Build knowledge graph data if enabled
    if (options.includeKnowledgeGraph) {
      structure.knowledgeGraph = await this.buildKnowledgeGraphData(
        documents,
        knowledgeGraph,
        structure
      );
    }
    
    return structure;
  }

  /**
   * Create page info from document
   */
  private async createPageInfo(
    document: MnemosyneDocument,
    options: StaticSiteOptions
  ): Promise<PageInfo> {
    const pagePath = this.generatePagePath(document, options);
    const level = this.calculatePageLevel(pagePath);
    
    return {
      id: document.id,
      path: pagePath,
      title: document.title,
      tags: document.metadata?.tags || [],
      created: new Date(document.metadata?.created || Date.now()),
      modified: new Date(document.metadata?.modified || Date.now()),
      backlinks: [],
      outlinks: [],
      level
    };
  }

  /**
   * Build relationships between pages
   */
  private async buildRelationships(
    structure: SiteStructure,
    documents: MnemosyneDocument[],
    knowledgeGraph: KnowledgeGraph
  ): Promise<void> {
    // Extract links from content
    for (const doc of documents) {
      const pageInfo = structure.pages.get(doc.id);
      if (!pageInfo) continue;
      
      // Find outgoing links in content
      const links = this.extractLinks(doc.content || '');
      for (const link of links) {
        const targetPage = this.findPageByPath(structure, link);
        if (targetPage) {
          pageInfo.outlinks.push(targetPage.id);
          targetPage.backlinks.push(doc.id);
        }
      }
      
      // Add relationships from knowledge graph
      if (knowledgeGraph) {
        const relationships = await knowledgeGraph.getRelationships(doc.id);
        for (const rel of relationships) {
          if (rel.type === 'links-to' && structure.pages.has(rel.targetId)) {
            if (!pageInfo.outlinks.includes(rel.targetId)) {
              pageInfo.outlinks.push(rel.targetId);
            }
            const targetInfo = structure.pages.get(rel.targetId);
            if (targetInfo && !targetInfo.backlinks.includes(doc.id)) {
              targetInfo.backlinks.push(doc.id);
            }
          }
        }
      }
    }
  }

  /**
   * Build tag hierarchy
   */
  private buildTagHierarchy(structure: SiteStructure): void {
    for (const [pageId, pageInfo] of structure.pages) {
      for (const tag of pageInfo.tags) {
        if (!structure.tagHierarchy.has(tag)) {
          structure.tagHierarchy.set(tag, []);
        }
        structure.tagHierarchy.get(tag)!.push(pageId);
      }
    }
  }

  /**
   * Build date hierarchy
   */
  private buildDateHierarchy(structure: SiteStructure): void {
    for (const [pageId, pageInfo] of structure.pages) {
      const year = pageInfo.created.getFullYear().toString();
      const month = `${year}-${String(pageInfo.created.getMonth() + 1).padStart(2, '0')}`;
      
      // Year hierarchy
      if (!structure.dateHierarchy.has(year)) {
        structure.dateHierarchy.set(year, []);
      }
      structure.dateHierarchy.get(year)!.push(pageId);
      
      // Month hierarchy
      if (!structure.dateHierarchy.has(month)) {
        structure.dateHierarchy.set(month, []);
      }
      structure.dateHierarchy.get(month)!.push(pageId);
    }
  }

  /**
   * Build knowledge graph data for visualization
   */
  private async buildKnowledgeGraphData(
    documents: MnemosyneDocument[],
    knowledgeGraph: KnowledgeGraph,
    structure: SiteStructure
  ): Promise<KnowledgeGraphData> {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const clusters: GraphCluster[] = [];
    
    // Create nodes from documents
    for (const doc of documents) {
      nodes.push({
        id: doc.id,
        label: doc.title,
        type: doc.type || 'document',
        metadata: {
          tags: doc.metadata?.tags,
          created: doc.metadata?.created
        }
      });
    }
    
    // Create edges from relationships
    const edgeSet = new Set<string>();
    for (const [pageId, pageInfo] of structure.pages) {
      for (const targetId of pageInfo.outlinks) {
        const edgeKey = `${pageId}-${targetId}`;
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey);
          edges.push({
            source: pageId,
            target: targetId,
            type: 'links-to',
            weight: 1
          });
        }
      }
    }
    
    // Create clusters from tags
    for (const [tag, pageIds] of structure.tagHierarchy) {
      if (pageIds.length >= 3) { // Only create clusters with 3+ nodes
        clusters.push({
          id: `tag-${tag}`,
          nodes: pageIds,
          label: tag
        });
      }
    }
    
    // Calculate graph metadata
    const metadata = {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      density: (2 * edges.length) / (nodes.length * (nodes.length - 1)),
      diameter: await this.calculateGraphDiameter(nodes, edges)
    };
    
    return {
      nodes,
      edges,
      clusters,
      metadata
    };
  }

  /**
   * Generate page path from document
   */
  private generatePagePath(document: MnemosyneDocument, options: StaticSiteOptions): string {
    const slug = this.slugify(document.title);
    const ext = '.html';
    
    // Organize by date if enabled
    if (options.groupByDate && document.metadata?.created) {
      const date = new Date(document.metadata.created);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${year}/${month}/${slug}${ext}`;
    }
    
    // Organize by type
    if (document.type) {
      return `${document.type}/${slug}${ext}`;
    }
    
    // Default flat structure
    return `pages/${slug}${ext}`;
  }

  /**
   * Calculate page level based on path depth
   */
  private calculatePageLevel(pagePath: string): number {
    const segments = pagePath.split('/').filter(Boolean);
    return Math.max(0, segments.length - 1);
  }

  /**
   * Extract links from content
   */
  private extractLinks(content: string): string[] {
    const links: string[] = [];
    
    // Match markdown links: [text](url)
    const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    while ((match = markdownLinkRegex.exec(content)) !== null) {
      const url = match[2];
      if (this.isInternalLink(url)) {
        links.push(url);
      }
    }
    
    // Match HTML links: <a href="url">
    const htmlLinkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
    while ((match = htmlLinkRegex.exec(content)) !== null) {
      const url = match[1];
      if (this.isInternalLink(url)) {
        links.push(url);
      }
    }
    
    return links;
  }

  /**
   * Check if link is internal
   */
  private isInternalLink(url: string): boolean {
    return !url.startsWith('http://') && 
           !url.startsWith('https://') && 
           !url.startsWith('//') &&
           !url.startsWith('mailto:') &&
           !url.startsWith('#');
  }

  /**
   * Find page by path
   */
  private findPageByPath(structure: SiteStructure, targetPath: string): PageInfo | null {
    // Normalize path
    const normalizedPath = path.normalize(targetPath).replace(/\\/g, '/');
    
    for (const pageInfo of structure.pages.values()) {
      if (pageInfo.path === normalizedPath || 
          pageInfo.path === normalizedPath + '.html' ||
          pageInfo.path === normalizedPath + '/index.html') {
        return pageInfo;
      }
    }
    
    return null;
  }

  /**
   * Calculate graph diameter (longest shortest path)
   */
  private async calculateGraphDiameter(
    nodes: GraphNode[],
    edges: GraphEdge[]
  ): Promise<number> {
    // Simple BFS-based diameter calculation
    // For large graphs, this should be optimized
    const adjacency = new Map<string, Set<string>>();
    
    // Build adjacency list
    for (const node of nodes) {
      adjacency.set(node.id, new Set());
    }
    
    for (const edge of edges) {
      adjacency.get(edge.source)?.add(edge.target);
      adjacency.get(edge.target)?.add(edge.source); // Treat as undirected
    }
    
    let diameter = 0;
    
    // For each node, find shortest paths to all other nodes
    for (const startNode of nodes) {
      const distances = this.bfs(startNode.id, adjacency);
      const maxDistance = Math.max(...distances.values());
      if (maxDistance > diameter && maxDistance !== Infinity) {
        diameter = maxDistance;
      }
    }
    
    return diameter;
  }

  /**
   * Breadth-first search for shortest paths
   */
  private bfs(start: string, adjacency: Map<string, Set<string>>): Map<string, number> {
    const distances = new Map<string, number>();
    const queue: string[] = [start];
    distances.set(start, 0);
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentDistance = distances.get(current)!;
      
      const neighbors = adjacency.get(current) || new Set();
      for (const neighbor of neighbors) {
        if (!distances.has(neighbor)) {
          distances.set(neighbor, currentDistance + 1);
          queue.push(neighbor);
        }
      }
    }
    
    // Set infinity for unreachable nodes
    for (const nodeId of adjacency.keys()) {
      if (!distances.has(nodeId)) {
        distances.set(nodeId, Infinity);
      }
    }
    
    return distances;
  }

  /**
   * Convert string to URL-friendly slug
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
}