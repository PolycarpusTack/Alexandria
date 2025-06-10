import { MnemosyneCore, KnowledgeNode } from '../../core/MnemosyneCore';
import { Template, TemplateMetadata, TemplateQuery } from './types';
import * as path from 'path';
import * as fs from 'fs/promises';

export class MnemosyneTemplateRepository {
  private mnemosyne: MnemosyneCore;
  private templatesPath: string;
  private templateCache: Map<string, Template> = new Map();
  private categoryIndex: Map<string, Set<string>> = new Map();
  
  constructor(mnemosyne: MnemosyneCore) {
    this.mnemosyne = mnemosyne;
    this.templatesPath = path.join(
      mnemosyne.getKnowledgeBasePath(),
      'templates'
    );
    this.initializeRepository();
  }

  /**
   * Initialize repository and load templates
   */
  private async initializeRepository(): Promise<void> {
    // Ensure template directories exist
    await this.ensureDirectories();
    
    // Load existing templates
    await this.loadTemplates();
    
    // Index templates in knowledge graph
    await this.indexTemplatesInKnowledgeGraph();
  }

  /**
   * Get template by ID with knowledge graph enrichment
   */
  async getTemplate(templateId: string): Promise<Template | null> {
    // Check cache first
    if (this.templateCache.has(templateId)) {
      return this.templateCache.get(templateId)!;
    }
    
    // Try to load from file system
    const template = await this.loadTemplateFromFile(templateId);
    if (template) {
      // Enrich with knowledge graph data
      const enriched = await this.enrichTemplateWithKnowledge(template);
      this.templateCache.set(templateId, enriched);
      return enriched;
    }
    
    // Try to find in knowledge graph
    const knowledgeNode = await this.mnemosyne.knowledgeGraph.getNode(
      templateId,
      'template'
    );
    
    if (knowledgeNode) {
      return this.nodeToTemplate(knowledgeNode);
    }
    
    return null;
  }

  /**
   * Save template to repository and knowledge graph
   */
  async saveTemplate(template: Template): Promise<void> {
    // Validate template
    this.validateTemplate(template);
    
    // Save to file system
    const category = template.metadata?.category || 'uncategorized';
    const filename = `${template.id}.hbs`;
    const filepath = path.join(this.templatesPath, category, filename);
    
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, template.content, 'utf-8');
    
    // Save metadata
    const metadataPath = filepath.replace('.hbs', '.meta.json');
    await fs.writeFile(
      metadataPath,
      JSON.stringify(template.metadata, null, 2),
      'utf-8'
    );
    
    // Update knowledge graph
    await this.mnemosyne.knowledgeGraph.upsertNode({
      type: 'template',
      id: template.id,
      title: template.name,
      content: template.content,
      metadata: {
        ...template.metadata,
        lastModified: new Date(),
        modifiedBy: this.mnemosyne.getCurrentUser().id
      }
    });
    
    // Update cache and indices
    this.templateCache.set(template.id, template);
    this.updateCategoryIndex(template);
    
    // Track in analytics
    await this.mnemosyne.analytics.track('template.saved', {
      templateId: template.id,
      category: category,
      isNew: !this.templateCache.has(template.id)
    });
  }

  /**
   * Search templates with knowledge graph integration
   */
  async searchTemplates(query: TemplateQuery): Promise<Template[]> {
    const results: Template[] = [];
    
    // Text search in template content
    if (query.text) {
      const textMatches = await this.searchByText(query.text);
      results.push(...textMatches);
    }
    
    // Category filter
    if (query.category) {
      const categoryTemplates = this.categoryIndex.get(query.category) || new Set();
      const filtered = Array.from(categoryTemplates)
        .map(id => this.templateCache.get(id))
        .filter(Boolean) as Template[];
      results.push(...filtered);
    }
    
    // Tag filter using knowledge graph
    if (query.tags && query.tags.length > 0) {
      const taggedNodes = await this.mnemosyne.knowledgeGraph.findByTags(
        query.tags,
        'template'
      );
      const taggedTemplates = await Promise.all(
        taggedNodes.map(node => this.nodeToTemplate(node))
      );
      results.push(...taggedTemplates);
    }
    
    // Related to specific document
    if (query.relatedTo) {
      const related = await this.mnemosyne.knowledgeGraph.getRelated(
        query.relatedTo,
        {
          types: ['template'],
          depth: query.relationDepth || 2
        }
      );
      const relatedTemplates = await Promise.all(
        related.map(node => this.nodeToTemplate(node))
      );
      results.push(...relatedTemplates);
    }
    
    // Remove duplicates and sort by relevance
    const uniqueResults = this.deduplicateTemplates(results);
    return this.sortByRelevance(uniqueResults, query);
  }

  /**
   * Get template recommendations based on context
   */
  async getRecommendations(
    context: {
      documentType?: string;
      tags?: string[];
      userId?: string;
      recentTemplates?: string[];
    }
  ): Promise<Template[]> {
    const recommendations: Map<string, number> = new Map();
    
    // Get templates used in similar contexts
    if (context.documentType) {
      const similarDocs = await this.mnemosyne.knowledgeGraph.query({
        type: 'document',
        metadata: { documentType: context.documentType }
      });
      
      for (const doc of similarDocs) {
        if (doc.metadata?.templateId) {
          const score = recommendations.get(doc.metadata.templateId) || 0;
          recommendations.set(doc.metadata.templateId, score + 1);
        }
      }
    }
    
    // Boost templates with matching tags
    if (context.tags) {
      const taggedTemplates = await this.searchTemplates({ tags: context.tags });
      taggedTemplates.forEach(template => {
        const score = recommendations.get(template.id) || 0;
        recommendations.set(template.id, score + 2); // Higher weight for tags
      });
    }
    
    // Consider user's template history
    if (context.userId) {
      const userHistory = await this.mnemosyne.analytics.getUserTemplateHistory(
        context.userId,
        { limit: 20 }
      );
      userHistory.forEach(entry => {
        const score = recommendations.get(entry.templateId) || 0;
        recommendations.set(entry.templateId, score + 0.5); // Lower weight for history
      });
    }
    
    // Exclude recently used templates if specified
    if (context.recentTemplates) {
      context.recentTemplates.forEach(id => recommendations.delete(id));
    }
    
    // Convert to sorted template list
    const sortedIds = Array.from(recommendations.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => id);
    
    return Promise.all(
      sortedIds.map(id => this.getTemplate(id))
    ).then(templates => templates.filter(Boolean) as Template[]);
  }

  /**
   * Version control integration
   */
  async getTemplateHistory(templateId: string): Promise<TemplateVersion[]> {
    const node = await this.mnemosyne.knowledgeGraph.getNode(templateId, 'template');
    if (!node) return [];
    
    // Get version history from knowledge graph
    const versions = await this.mnemosyne.knowledgeGraph.getVersionHistory(templateId);
    
    return versions.map(version => ({
      version: version.version,
      timestamp: version.timestamp,
      author: version.author,
      changes: version.changes,
      content: version.content
    }));
  }

  private async enrichTemplateWithKnowledge(template: Template): Promise<Template> {
    // Add knowledge graph connections
    const connections = await this.mnemosyne.knowledgeGraph.getConnections(
      template.id
    );
    
    return {
      ...template,
      metadata: {
        ...template.metadata,
        knowledgeConnections: connections,
        usageStats: await this.getTemplateUsageStats(template.id)
      }
    };
  }
}