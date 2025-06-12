import { PluginContext } from '../../../../../core/plugin-registry/interfaces';
import { Snippet, SnippetCategory, TemplateVariable } from './interfaces';
import { TemplateEngine } from './TemplateEngine';

export class SnippetManager {
  private templateEngine: TemplateEngine;

  constructor(private context: PluginContext) {
    this.templateEngine = new TemplateEngine(context);
  }

  /**
   * Create a new snippet
   */
  async create(
    snippetData: Omit<Snippet, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>
  ): Promise<Snippet> {
    const snippet: Snippet = {
      ...snippetData,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0
    };

    const query = `
      INSERT INTO mnemosyne_snippets (
        id, name, content, description, category, tags, language,
        variables, created_at, updated_at, created_by, usage_count, is_public
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const values = [
      snippet.id,
      snippet.name,
      snippet.content,
      snippet.description,
      snippet.category,
      JSON.stringify(snippet.tags),
      snippet.language,
      JSON.stringify(snippet.variables),
      snippet.createdAt,
      snippet.updatedAt,
      snippet.createdBy,
      snippet.usageCount,
      snippet.isPublic
    ];

    const result = await this.context.db.query(query, values);

    // Update category count
    await this.updateCategoryCount(snippet.category);

    // Emit creation event
    this.context.events.emit('mnemosyne:snippet:created', snippet);

    return this.mapToSnippet(result.rows[0]);
  }

  /**
   * Get snippet by ID
   */
  async getById(id: string): Promise<Snippet | null> {
    const query = `SELECT * FROM mnemosyne_snippets WHERE id = $1`;
    const result = await this.context.db.query(query, [id]);
    return result.rows[0] ? this.mapToSnippet(result.rows[0]) : null;
  }

  /**
   * Update snippet
   */
  async update(id: string, updates: Partial<Snippet>): Promise<Snippet> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error('Snippet not found');
    }

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };

    const query = `
      UPDATE mnemosyne_snippets
      SET name = $2, content = $3, description = $4, category = $5,
          tags = $6, language = $7, variables = $8, updated_at = $9, is_public = $10
      WHERE id = $1
      RETURNING *
    `;

    const values = [
      id,
      updated.name,
      updated.content,
      updated.description,
      updated.category,
      JSON.stringify(updated.tags),
      updated.language,
      JSON.stringify(updated.variables),
      updated.updatedAt,
      updated.isPublic
    ];

    const result = await this.context.db.query(query, values);

    // Update category count if category changed
    if (updates.category && updates.category !== existing.category) {
      await this.updateCategoryCount(existing.category);
      await this.updateCategoryCount(updates.category);
    }

    // Emit update event
    this.context.events.emit('mnemosyne:snippet:updated', updated);

    return this.mapToSnippet(result.rows[0]);
  }

  /**
   * Delete snippet
   */
  async delete(id: string): Promise<void> {
    const snippet = await this.getById(id);
    if (!snippet) {
      throw new Error('Snippet not found');
    }

    const query = `DELETE FROM mnemosyne_snippets WHERE id = $1`;
    await this.context.db.query(query, [id]);

    // Update category count
    await this.updateCategoryCount(snippet.category);

    // Emit deletion event
    this.context.events.emit('mnemosyne:snippet:deleted', { id });
  }

  /**
   * Search snippets
   */
  async search(
    query: string,
    filters?: {
      category?: string;
      language?: string;
      tags?: string[];
      isPublic?: boolean;
    }
  ): Promise<Snippet[]> {
    let sql = `
      SELECT * FROM mnemosyne_snippets
      WHERE 1=1
    `;
    const params: any[] = [];

    if (query) {
      params.push(`%${query}%`);
      sql += ` AND (name ILIKE $${params.length} OR content ILIKE $${params.length} OR description ILIKE $${params.length})`;
    }

    if (filters?.category) {
      params.push(filters.category);
      sql += ` AND category = $${params.length}`;
    }

    if (filters?.language) {
      params.push(filters.language);
      sql += ` AND language = $${params.length}`;
    }

    if (filters?.isPublic !== undefined) {
      params.push(filters.isPublic);
      sql += ` AND is_public = $${params.length}`;
    }

    if (filters?.tags && filters.tags.length > 0) {
      params.push(JSON.stringify(filters.tags));
      sql += ` AND tags ?| array[${filters.tags.map((_, i) => `$${params.length + i + 1}`).join(',')}]`;
      params.push(...filters.tags);
    }

    sql += ` ORDER BY usage_count DESC, updated_at DESC LIMIT 50`;

    const result = await this.context.db.query(sql, params);
    return result.rows.map((row) => this.mapToSnippet(row));
  }

  /**
   * Get snippets by category
   */
  async getByCategory(category: string): Promise<Snippet[]> {
    return this.search('', { category });
  }

  /**
   * Get snippets by language
   */
  async getByLanguage(language: string): Promise<Snippet[]> {
    return this.search('', { language });
  }

  /**
   * Get user's snippets
   */
  async getUserSnippets(userId: string): Promise<Snippet[]> {
    const query = `
      SELECT * FROM mnemosyne_snippets
      WHERE created_by = $1
      ORDER BY updated_at DESC
    `;
    const result = await this.context.db.query(query, [userId]);
    return result.rows.map((row) => this.mapToSnippet(row));
  }

  /**
   * Get popular snippets
   */
  async getPopular(limit: number = 10): Promise<Snippet[]> {
    const query = `
      SELECT * FROM mnemosyne_snippets
      WHERE is_public = true
      ORDER BY usage_count DESC
      LIMIT $1
    `;
    const result = await this.context.db.query(query, [limit]);
    return result.rows.map((row) => this.mapToSnippet(row));
  }

  /**
   * Render snippet with variables
   */
  async render(snippetId: string, variables: Record<string, any>): Promise<string> {
    const snippet = await this.getById(snippetId);
    if (!snippet) {
      throw new Error('Snippet not found');
    }

    // Record usage
    await this.recordUsage(snippetId);

    // Render with template engine
    return this.templateEngine.renderSnippet(snippet.content, variables);
  }

  /**
   * Get snippet categories
   */
  async getCategories(): Promise<SnippetCategory[]> {
    const query = `
      SELECT 
        category as name,
        COUNT(*) as snippet_count
      FROM mnemosyne_snippets
      WHERE category IS NOT NULL
      GROUP BY category
      ORDER BY snippet_count DESC, category ASC
    `;

    const result = await this.context.db.query(query);

    return result.rows.map((row) => ({
      id: row.name.toLowerCase().replace(/\s+/g, '-'),
      name: row.name,
      description: `${row.snippet_count} snippets`,
      snippetCount: parseInt(row.snippet_count)
    }));
  }

  /**
   * Create snippet category
   */
  async createCategory(
    category: Omit<SnippetCategory, 'id' | 'snippetCount'>
  ): Promise<SnippetCategory> {
    // Categories are created implicitly when snippets are added
    // This method could be used for explicit category management
    return {
      id: category.name.toLowerCase().replace(/\s+/g, '-'),
      ...category,
      snippetCount: 0
    };
  }

  /**
   * Get snippet suggestions based on context
   */
  async getSuggestions(context: {
    language?: string;
    keywords?: string[];
    currentContent?: string;
  }): Promise<Snippet[]> {
    // Build a smart query based on context
    let suggestions: Snippet[] = [];

    // First, try language-specific snippets
    if (context.language) {
      const languageSnippets = await this.getByLanguage(context.language);
      suggestions.push(...languageSnippets.slice(0, 5));
    }

    // Then, try keyword-based search
    if (context.keywords && context.keywords.length > 0) {
      for (const keyword of context.keywords) {
        const keywordSnippets = await this.search(keyword);
        suggestions.push(...keywordSnippets.slice(0, 3));
      }
    }

    // Finally, add popular snippets
    if (suggestions.length < 10) {
      const popular = await this.getPopular(10 - suggestions.length);
      suggestions.push(...popular);
    }

    // Remove duplicates and limit results
    const unique = suggestions.reduce((acc, current) => {
      if (!acc.find((item) => item.id === current.id)) {
        acc.push(current);
      }
      return acc;
    }, [] as Snippet[]);

    return unique.slice(0, 10);
  }

  /**
   * Clone snippet
   */
  async clone(snippetId: string, userId: string, newName: string): Promise<Snippet> {
    const original = await this.getById(snippetId);
    if (!original) {
      throw new Error('Snippet not found');
    }

    const cloned = {
      ...original,
      name: newName,
      createdBy: userId,
      isPublic: false
    };

    delete (cloned as any).id;
    delete (cloned as any).createdAt;
    delete (cloned as any).updatedAt;
    delete (cloned as any).usageCount;

    return this.create(cloned);
  }

  /**
   * Import snippets from various sources
   */
  async importFromVSCode(snippetsJson: any, userId: string): Promise<Snippet[]> {
    const imported: Snippet[] = [];

    for (const [name, snippet] of Object.entries(snippetsJson)) {
      const snippetData = snippet as any;

      try {
        const newSnippet = await this.create({
          name,
          content: Array.isArray(snippetData.body) ? snippetData.body.join('\n') : snippetData.body,
          description: snippetData.description || '',
          category: 'imported',
          tags: ['vscode', 'imported'],
          language: snippetData.scope || 'plaintext',
          variables: this.extractVariablesFromVSCodeSnippet(snippetData.body),
          createdBy: userId,
          isPublic: false
        });

        imported.push(newSnippet);
      } catch (error) {
        this.context.logger.warn('Failed to import snippet', { name, error });
      }
    }

    return imported;
  }

  /**
   * Export snippets
   */
  async export(snippetIds: string[], format: 'json' | 'vscode'): Promise<any> {
    const snippets = await Promise.all(snippetIds.map((id) => this.getById(id)));

    const validSnippets = snippets.filter(Boolean) as Snippet[];

    if (format === 'vscode') {
      return this.exportToVSCode(validSnippets);
    }

    return validSnippets;
  }

  /**
   * Initialize database schema
   */
  async initializeSchema(): Promise<void> {
    const queries = [
      `CREATE TABLE IF NOT EXISTS mnemosyne_snippets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        description TEXT,
        category VARCHAR(100),
        tags JSONB DEFAULT '[]',
        language VARCHAR(50),
        variables JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by UUID REFERENCES users(id),
        usage_count INTEGER DEFAULT 0,
        is_public BOOLEAN DEFAULT FALSE
      )`,

      // Indexes
      `CREATE INDEX IF NOT EXISTS idx_snippets_category ON mnemosyne_snippets(category)`,
      `CREATE INDEX IF NOT EXISTS idx_snippets_language ON mnemosyne_snippets(language)`,
      `CREATE INDEX IF NOT EXISTS idx_snippets_tags ON mnemosyne_snippets USING gin(tags)`,
      `CREATE INDEX IF NOT EXISTS idx_snippets_usage ON mnemosyne_snippets(usage_count DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_snippets_public ON mnemosyne_snippets(is_public)`
    ];

    for (const query of queries) {
      await this.context.db.query(query);
    }
  }

  // Private helper methods

  private async recordUsage(snippetId: string): Promise<void> {
    const query = `
      UPDATE mnemosyne_snippets
      SET usage_count = usage_count + 1
      WHERE id = $1
    `;
    await this.context.db.query(query, [snippetId]);
  }

  private async updateCategoryCount(category: string): Promise<void> {
    // Categories are dynamically calculated, so no explicit update needed
    // This method exists for future use if we add explicit category tables
  }

  private extractVariablesFromVSCodeSnippet(body: string | string[]): TemplateVariable[] {
    const content = Array.isArray(body) ? body.join('\n') : body;
    const variables: TemplateVariable[] = [];

    // VS Code uses $1, $2, ${1:default}, ${name:default} syntax
    const regex = /\$\{?(\d+|[a-zA-Z_][a-zA-Z0-9_]*):?([^}]*)\}?/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const [, name, defaultValue] = match;

      if (!variables.find((v) => v.name === name)) {
        variables.push({
          name,
          type: 'string',
          description: `Variable from VS Code snippet: ${name}`,
          defaultValue: defaultValue || undefined,
          required: false
        });
      }
    }

    return variables;
  }

  private exportToVSCode(snippets: Snippet[]): Record<string, any> {
    const vscodeSnippets: Record<string, any> = {};

    for (const snippet of snippets) {
      vscodeSnippets[snippet.name] = {
        scope: snippet.language || 'plaintext',
        prefix: snippet.name.toLowerCase().replace(/\s+/g, '-'),
        body: snippet.content.split('\n'),
        description: snippet.description || snippet.name
      };
    }

    return vscodeSnippets;
  }

  private mapToSnippet(row: any): Snippet {
    return {
      id: row.id,
      name: row.name,
      content: row.content,
      description: row.description,
      category: row.category,
      tags: JSON.parse(row.tags || '[]'),
      language: row.language,
      variables: JSON.parse(row.variables || '[]'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      usageCount: row.usage_count,
      isPublic: row.is_public
    };
  }
}
