import { PluginContext } from '../../../../../core/plugin-registry/interfaces';
import {
  MnemosyneTemplate,
  TemplateSearchCriteria,
  TemplateAnalytics,
  TemplateVariable,
  UsageMetrics,
  TemplateFeedback,
  TemplateImportOptions,
  TemplateExportOptions
} from './interfaces';
import { v4 as uuidv4 } from 'uuid';

export class TemplateRepository {
  constructor(private context: PluginContext) {}

  /**
   * Create a new template
   */
  async create(templateData: Omit<MnemosyneTemplate, 'id' | 'createdAt' | 'updatedAt' | 'analytics'>): Promise<MnemosyneTemplate> {
    const template: MnemosyneTemplate = {
      ...templateData,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
      analytics: this.getDefaultAnalytics()
    };

    const query = `
      INSERT INTO mnemosyne_templates (
        id, name, content, type, metadata, variables, relationships,
        analytics, created_at, updated_at, created_by, is_public, is_official
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const values = [
      template.id,
      template.name,
      template.content,
      template.type,
      JSON.stringify(template.metadata),
      JSON.stringify(template.variables),
      JSON.stringify(template.relationships),
      JSON.stringify(template.analytics),
      template.createdAt,
      template.updatedAt,
      template.createdBy,
      template.isPublic,
      template.isOfficial || false
    ];

    const result = await this.context.db.query(query, values);
    
    // Create template tags
    await this.updateTemplateTags(template.id, template.metadata.tags);
    
    // Emit creation event
    this.context.events.emit('mnemosyne:template:created', template);
    
    return this.mapToTemplate(result.rows[0]);
  }

  /**
   * Get template by ID
   */
  async getById(id: string): Promise<MnemosyneTemplate | null> {
    const query = `
      SELECT t.*, array_agg(DISTINCT tt.tag_name) as tags
      FROM mnemosyne_templates t
      LEFT JOIN mnemosyne_template_tags tt ON t.id = tt.template_id
      WHERE t.id = $1
      GROUP BY t.id
    `;

    const result = await this.context.db.query(query, [id]);
    return result.rows[0] ? this.mapToTemplate(result.rows[0]) : null;
  }

  /**
   * Update template
   */
  async update(id: string, updates: Partial<MnemosyneTemplate>): Promise<MnemosyneTemplate> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error('Template not found');
    }

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };

    const query = `
      UPDATE mnemosyne_templates
      SET name = $2, content = $3, type = $4, metadata = $5,
          variables = $6, relationships = $7, analytics = $8,
          updated_at = $9, is_public = $10, is_official = $11
      WHERE id = $1
      RETURNING *
    `;

    const values = [
      id,
      updated.name,
      updated.content,
      updated.type,
      JSON.stringify(updated.metadata),
      JSON.stringify(updated.variables),
      JSON.stringify(updated.relationships),
      JSON.stringify(updated.analytics),
      updated.updatedAt,
      updated.isPublic,
      updated.isOfficial
    ];

    const result = await this.context.db.query(query, values);
    
    // Update tags if they changed
    if (updates.metadata?.tags) {
      await this.updateTemplateTags(id, updates.metadata.tags);
    }

    // Emit update event
    this.context.events.emit('mnemosyne:template:updated', updated);
    
    return this.mapToTemplate(result.rows[0]);
  }

  /**
   * Delete template
   */
  async delete(id: string): Promise<void> {
    const query = `DELETE FROM mnemosyne_templates WHERE id = $1`;
    await this.context.db.query(query, [id]);
    
    // Clean up tags
    await this.context.db.query(`DELETE FROM mnemosyne_template_tags WHERE template_id = $1`, [id]);
    
    // Emit deletion event
    this.context.events.emit('mnemosyne:template:deleted', { id });
  }

  /**
   * Search templates
   */
  async search(criteria: TemplateSearchCriteria): Promise<MnemosyneTemplate[]> {
    let query = `
      SELECT DISTINCT t.*, array_agg(DISTINCT tt.tag_name) as tags
      FROM mnemosyne_templates t
      LEFT JOIN mnemosyne_template_tags tt ON t.id = tt.template_id
    `;

    const conditions: string[] = [];
    const params: any[] = [];

    // Build WHERE conditions
    if (criteria.query) {
      params.push(`%${criteria.query}%`);
      conditions.push(`(t.name ILIKE $${params.length} OR t.content ILIKE $${params.length})`);
    }

    if (criteria.category) {
      params.push(criteria.category);
      conditions.push(`t.metadata->>'category' = $${params.length}`);
    }

    if (criteria.type) {
      params.push(criteria.type);
      conditions.push(`t.type = $${params.length}`);
    }

    if (criteria.author) {
      params.push(criteria.author);
      conditions.push(`t.created_by = $${params.length}`);
    }

    if (criteria.difficulty) {
      params.push(criteria.difficulty);
      conditions.push(`t.metadata->>'difficulty' = $${params.length}`);
    }

    if (criteria.official !== undefined) {
      params.push(criteria.official);
      conditions.push(`t.is_official = $${params.length}`);
    }

    if (criteria.tags && criteria.tags.length > 0) {
      params.push(criteria.tags);
      conditions.push(`tt.tag_name = ANY($${params.length})`);
    }

    if (criteria.minRating) {
      params.push(criteria.minRating);
      conditions.push(`(t.analytics->>'satisfactionScore')::float >= $${params.length}`);
    }

    // Add WHERE clause
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Group by template
    query += ` GROUP BY t.id`;

    // Order by relevance and usage
    query += ` ORDER BY (t.analytics->>'usageCount')::int DESC, t.updated_at DESC`;

    // Limit results
    query += ` LIMIT 50`;

    const result = await this.context.db.query(query, params);
    return result.rows.map(row => this.mapToTemplate(row));
  }

  /**
   * Get templates by category
   */
  async getByCategory(category: string): Promise<MnemosyneTemplate[]> {
    return this.search({ category });
  }

  /**
   * Get popular templates
   */
  async getPopular(limit: number = 10): Promise<MnemosyneTemplate[]> {
    const query = `
      SELECT t.*, array_agg(DISTINCT tt.tag_name) as tags
      FROM mnemosyne_templates t
      LEFT JOIN mnemosyne_template_tags tt ON t.id = tt.template_id
      WHERE t.is_public = true
      GROUP BY t.id
      ORDER BY (t.analytics->>'usageCount')::int DESC
      LIMIT $1
    `;

    const result = await this.context.db.query(query, [limit]);
    return result.rows.map(row => this.mapToTemplate(row));
  }

  /**
   * Get recent templates
   */
  async getRecent(userId: string, limit: number = 10): Promise<MnemosyneTemplate[]> {
    const query = `
      SELECT DISTINCT t.*, array_agg(DISTINCT tt.tag_name) as tags
      FROM mnemosyne_templates t
      LEFT JOIN mnemosyne_template_tags tt ON t.id = tt.template_id
      LEFT JOIN mnemosyne_template_usage tu ON t.id = tu.template_id
      WHERE tu.user_id = $1
      GROUP BY t.id
      ORDER BY tu.created_at DESC
      LIMIT $2
    `;

    const result = await this.context.db.query(query, [userId, limit]);
    return result.rows.map(row => this.mapToTemplate(row));
  }

  /**
   * Get user's templates
   */
  async getUserTemplates(userId: string): Promise<MnemosyneTemplate[]> {
    return this.search({ author: userId });
  }

  /**
   * Record template usage
   */
  async recordUsage(templateId: string, userId: string, context: any): Promise<void> {
    const usageQuery = `
      INSERT INTO mnemosyne_template_usage (
        id, template_id, user_id, context, created_at
      ) VALUES (gen_random_uuid(), $1, $2, $3, CURRENT_TIMESTAMP)
    `;

    await this.context.db.query(usageQuery, [
      templateId,
      userId,
      JSON.stringify(context)
    ]);

    // Update template analytics
    await this.updateUsageAnalytics(templateId);
  }

  /**
   * Add feedback for template
   */
  async addFeedback(templateId: string, feedback: TemplateFeedback): Promise<void> {
    const query = `
      INSERT INTO mnemosyne_template_feedback (
        id, template_id, user_id, rating, comment, suggestions, created_at
      ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    `;

    await this.context.db.query(query, [
      templateId,
      feedback.userId,
      feedback.rating,
      feedback.comment,
      JSON.stringify(feedback.suggestions)
    ]);

    // Update satisfaction score
    await this.updateSatisfactionScore(templateId);
  }

  /**
   * Get template suggestions based on context
   */
  async getSuggestions(context: any): Promise<MnemosyneTemplate[]> {
    // This would use AI/ML to suggest relevant templates
    // For now, return popular templates in related categories
    const relatedCategories = this.extractCategoriesFromContext(context);
    
    if (relatedCategories.length === 0) {
      return this.getPopular(5);
    }

    const query = `
      SELECT t.*, array_agg(DISTINCT tt.tag_name) as tags
      FROM mnemosyne_templates t
      LEFT JOIN mnemosyne_template_tags tt ON t.id = tt.template_id
      WHERE t.metadata->>'category' = ANY($1)
      AND t.is_public = true
      GROUP BY t.id
      ORDER BY (t.analytics->>'usageCount')::int DESC
      LIMIT 5
    `;

    const result = await this.context.db.query(query, [relatedCategories]);
    return result.rows.map(row => this.mapToTemplate(row));
  }

  /**
   * Clone template for modification
   */
  async clone(templateId: string, userId: string, newName: string): Promise<MnemosyneTemplate> {
    const original = await this.getById(templateId);
    if (!original) {
      throw new Error('Template not found');
    }

    const cloned = {
      ...original,
      name: newName,
      createdBy: userId,
      isPublic: false,
      isOfficial: false,
      analytics: this.getDefaultAnalytics()
    };

    delete (cloned as any).id;
    delete (cloned as any).createdAt;
    delete (cloned as any).updatedAt;

    return this.create(cloned);
  }

  /**
   * Export template
   */
  async export(templateId: string, options: TemplateExportOptions): Promise<any> {
    const template = await this.getById(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    switch (options.format) {
      case 'json':
        return {
          template,
          metadata: options.includeMetadata ? template.metadata : undefined,
          analytics: options.includeAnalytics ? template.analytics : undefined
        };
      
      case 'markdown':
        return this.exportAsMarkdown(template, options);
      
      default:
        throw new Error(`Export format ${options.format} not supported`);
    }
  }

  /**
   * Import template
   */
  async import(data: any, options: TemplateImportOptions, userId: string): Promise<MnemosyneTemplate> {
    let templateData: any;

    switch (options.source) {
      case 'json':
        templateData = data;
        break;
      case 'markdown':
        templateData = this.parseMarkdownTemplate(data, options);
        break;
      default:
        throw new Error(`Import source ${options.source} not supported`);
    }

    // Ensure required fields
    templateData.createdBy = userId;
    templateData.isPublic = false;
    templateData.metadata = templateData.metadata || {};
    templateData.variables = templateData.variables || [];
    templateData.relationships = templateData.relationships || [];

    return this.create(templateData);
  }

  /**
   * Initialize database schema
   */
  async initializeSchema(): Promise<void> {
    const queries = [
      `CREATE TABLE IF NOT EXISTS mnemosyne_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        type VARCHAR(50) NOT NULL,
        metadata JSONB DEFAULT '{}',
        variables JSONB DEFAULT '[]',
        relationships JSONB DEFAULT '[]',
        analytics JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by UUID REFERENCES users(id),
        is_public BOOLEAN DEFAULT FALSE,
        is_official BOOLEAN DEFAULT FALSE
      )`,

      `CREATE TABLE IF NOT EXISTS mnemosyne_template_tags (
        template_id UUID REFERENCES mnemosyne_templates(id) ON DELETE CASCADE,
        tag_name VARCHAR(100) NOT NULL,
        PRIMARY KEY (template_id, tag_name)
      )`,

      `CREATE TABLE IF NOT EXISTS mnemosyne_template_usage (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id UUID REFERENCES mnemosyne_templates(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id),
        context JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS mnemosyne_template_feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id UUID REFERENCES mnemosyne_templates(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id),
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        suggestions JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Indexes
      `CREATE INDEX IF NOT EXISTS idx_templates_category ON mnemosyne_templates((metadata->>'category'))`,
      `CREATE INDEX IF NOT EXISTS idx_templates_type ON mnemosyne_templates(type)`,
      `CREATE INDEX IF NOT EXISTS idx_templates_public ON mnemosyne_templates(is_public)`,
      `CREATE INDEX IF NOT EXISTS idx_templates_usage ON mnemosyne_template_usage(template_id, created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_template_tags ON mnemosyne_template_tags(tag_name)`
    ];

    for (const query of queries) {
      await this.context.db.query(query);
    }
  }

  // Private helper methods

  private getDefaultAnalytics(): TemplateAnalytics {
    return {
      usageCount: 0,
      averageCompletionTime: 0,
      modificationRate: 0,
      satisfactionScore: 0,
      knowledgeImpact: 0,
      evolutionScore: 0,
      commonModifications: [],
      userFeedback: []
    };
  }

  private async updateTemplateTags(templateId: string, tags: string[]): Promise<void> {
    // Delete existing tags
    await this.context.db.query(
      `DELETE FROM mnemosyne_template_tags WHERE template_id = $1`,
      [templateId]
    );

    // Insert new tags
    for (const tag of tags) {
      await this.context.db.query(
        `INSERT INTO mnemosyne_template_tags (template_id, tag_name) VALUES ($1, $2)`,
        [templateId, tag]
      );
    }
  }

  private async updateUsageAnalytics(templateId: string): Promise<void> {
    const usageQuery = `
      SELECT COUNT(*) as usage_count,
             AVG(EXTRACT(EPOCH FROM (completion_time - created_at))) as avg_time
      FROM mnemosyne_template_usage
      WHERE template_id = $1
    `;

    const result = await this.context.db.query(usageQuery, [templateId]);
    const stats = result.rows[0];

    // Update template analytics
    await this.context.db.query(
      `UPDATE mnemosyne_templates 
       SET analytics = jsonb_set(analytics, '{usageCount}', $2::text::jsonb)
       WHERE id = $1`,
      [templateId, stats.usage_count]
    );
  }

  private async updateSatisfactionScore(templateId: string): Promise<void> {
    const feedbackQuery = `
      SELECT AVG(rating) as avg_rating
      FROM mnemosyne_template_feedback
      WHERE template_id = $1
    `;

    const result = await this.context.db.query(feedbackQuery, [templateId]);
    const avgRating = result.rows[0]?.avg_rating || 0;

    await this.context.db.query(
      `UPDATE mnemosyne_templates 
       SET analytics = jsonb_set(analytics, '{satisfactionScore}', $2::text::jsonb)
       WHERE id = $1`,
      [templateId, avgRating]
    );
  }

  private extractCategoriesFromContext(context: any): string[] {
    // Extract categories from context (simplified implementation)
    const categories = [];
    
    if (context.documentType) {
      categories.push(context.documentType);
    }
    
    if (context.project?.type) {
      categories.push(context.project.type);
    }
    
    return categories;
  }

  private exportAsMarkdown(template: MnemosyneTemplate, options: TemplateExportOptions): string {
    let content = `# ${template.name}\n\n`;
    
    if (options.includeMetadata) {
      content += `**Category:** ${template.metadata.category}\n`;
      content += `**Tags:** ${template.metadata.tags.join(', ')}\n`;
      content += `**Author:** ${template.metadata.author}\n\n`;
    }
    
    content += template.content;
    
    return content;
  }

  private parseMarkdownTemplate(content: string, options: TemplateImportOptions): any {
    // Basic markdown parsing (would be more sophisticated in practice)
    const lines = content.split('\n');
    const name = lines[0]?.replace(/^#+\s*/, '') || 'Imported Template';
    
    return {
      name,
      content,
      type: 'document',
      metadata: {
        category: 'imported',
        tags: [],
        author: 'Unknown',
        version: '1.0.0',
        usage: {
          totalUses: 0,
          lastUsed: new Date(),
          averageCompletionTime: 0,
          modificationRate: 0,
          satisfactionScore: 0,
          successRate: 0
        }
      },
      variables: options.extractVariables ? this.extractVariablesFromContent(content) : [],
      relationships: []
    };
  }

  private extractVariablesFromContent(content: string): TemplateVariable[] {
    const regex = /\{\{([^}]+)\}\}/g;
    const variables = new Set<string>();
    let match;

    while ((match = regex.exec(content)) !== null) {
      const variable = match[1].trim().split(' ')[0].split('.')[0];
      variables.add(variable);
    }

    return Array.from(variables).map(name => ({
      name,
      type: 'string' as const,
      description: `Variable extracted from template: ${name}`,
      required: false
    }));
  }

  private mapToTemplate(row: any): MnemosyneTemplate {
    return {
      id: row.id,
      name: row.name,
      content: row.content,
      type: row.type,
      metadata: {
        ...JSON.parse(row.metadata),
        tags: row.tags?.filter(Boolean) || []
      },
      variables: JSON.parse(row.variables),
      relationships: JSON.parse(row.relationships),
      analytics: JSON.parse(row.analytics),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      isPublic: row.is_public,
      isOfficial: row.is_official
    };
  }
}