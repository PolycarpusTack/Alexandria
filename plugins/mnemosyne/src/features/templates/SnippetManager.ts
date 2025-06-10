import { MnemosyneCore, KnowledgeNode } from '../../core/MnemosyneCore';
import { Snippet, SnippetCategory, SnippetContext } from './types';

export class MnemosyneSnippetManager {
  private mnemosyne: MnemosyneCore;
  private snippets: Map<string, Snippet> = new Map();
  private categories: Map<string, SnippetCategory> = new Map();
  
  constructor(mnemosyne: MnemosyneCore) {
    this.mnemosyne = mnemosyne;
    this.initializeSnippets();
  }

  /**
   * Initialize snippet categories with Mnemosyne-specific snippets
   */
  private async initializeSnippets(): Promise<void> {
    // Knowledge linking snippets
    this.registerCategory('knowledge-links', {
      name: 'Knowledge Links',
      description: 'Snippets for linking to Mnemosyne knowledge base',
      icon: 'fa-link'
    });

    this.registerSnippet({
      id: 'mnemosyne-link',
      category: 'knowledge-links',
      prefix: 'mkl',
      name: 'Knowledge Link',
      description: 'Link to a knowledge base item',
      body: '[[${1:Title}|mnemosyne:${2:id}]]',
      variables: {
        Title: 'Display title for the link',
        id: 'Mnemosyne knowledge ID'
      }
    });

    this.registerSnippet({
      id: 'mnemosyne-ref',
      category: 'knowledge-links', 
      prefix: 'mkr',
      name: 'Knowledge Reference',
      description: 'Reference with context preview',
      body: [
        '{{#mnemosyne-ref id="${1:id}"}}',
        '  ${2:Custom preview text}',
        '{{/mnemosyne-ref}}'
      ].join('\n')
    });

    // Query snippets
    this.registerCategory('queries', {
      name: 'Knowledge Queries',
      description: 'Query the Mnemosyne knowledge base',
      icon: 'fa-database'
    });

    this.registerSnippet({
      id: 'knowledge-query',
      category: 'queries',
      prefix: 'mkq',
      name: 'Knowledge Query',
      description: 'Query knowledge base',
      body: [
        '```mnemosyne-query',
        'SELECT ${1:*} FROM knowledge_base',
        'WHERE ${2:condition}',
        'ORDER BY ${3:relevance} DESC',
        'LIMIT ${4:10}',
        '```'
      ].join('\n')
    });

    // Template variable snippets
    this.registerCategory('template-vars', {
      name: 'Template Variables',
      description: 'Mnemosyne template variables',
      icon: 'fa-code'
    });

    this.registerSnippet({
      id: 'mnemosyne-var',
      category: 'template-vars',
      prefix: 'mtv',
      name: 'Mnemosyne Variable',
      description: 'Insert Mnemosyne context variable',
      body: '{{mnemosyne.${1|id,version,created,updated,author,related|}}}',
      interactive: true
    });
  }

  /**
   * Get context-aware snippet suggestions
   */
  async suggestSnippets(context: SnippetContext): Promise<Snippet[]> {
    const suggestions: Snippet[] = [];
    
    // Get snippets based on current document type
    const docType = context.document?.type;
    if (docType) {
      const typeSnippets = await this.getSnippetsByDocType(docType);
      suggestions.push(...typeSnippets);
    }
    
    // Get frequently used snippets
    const frequentSnippets = await this.getFrequentSnippets(
      context.user.id,
      { limit: 5 }
    );
    suggestions.push(...frequentSnippets);
    
    // Get snippets from similar documents
    if (context.document) {
      const similarDocs = await this.mnemosyne.knowledgeGraph.findSimilar(
        context.document,
        { limit: 10 }
      );
      
      for (const doc of similarDocs) {
        const docSnippets = await this.extractSnippetsFromDocument(doc);
        suggestions.push(...docSnippets);
      }
    }
    
    // Rank by relevance
    return this.rankSnippets(suggestions, context);
  }

  /**
   * Create a snippet from selected text
   */
  async createSnippetFromSelection(
    selection: string,
    metadata: {
      name: string;
      description?: string;
      category?: string;
      variables?: Record<string, string>;
    }
  ): Promise<Snippet> {
    // Extract variables from selection
    const variables = this.extractVariables(selection);
    
    // Generate snippet body with placeholders
    const body = this.generateSnippetBody(selection, variables);
    
    const snippet: Snippet = {
      id: `custom-${Date.now()}`,
      category: metadata.category || 'custom',
      prefix: this.generatePrefix(metadata.name),
      name: metadata.name,
      description: metadata.description || '',
      body,
      variables: { ...variables, ...metadata.variables },
      metadata: {
        createdBy: this.mnemosyne.getCurrentUser().id,
        createdAt: new Date(),
        source: 'selection'
      }
    };
    
    // Store in knowledge graph
    await this.mnemosyne.knowledgeGraph.addNode({
      type: 'snippet',
      id: snippet.id,
      title: snippet.name,
      content: snippet.body,
      metadata: snippet
    });
    
    this.snippets.set(snippet.id, snippet);
    return snippet;
  }

  /**
   * Learn snippets from document usage patterns
   */
  async learnSnippetsFromUsage(): Promise<Snippet[]> {
    const recentDocs = await this.mnemosyne.getRecentDocuments(null, 100);
    const patterns = new Map<string, number>();
    
    // Analyze text patterns
    for (const doc of recentDocs) {
      const textPatterns = this.extractRepeatingPatterns(doc.content);
      textPatterns.forEach((count, pattern) => {
        const total = patterns.get(pattern) || 0;
        patterns.set(pattern, total + count);
      });
    }
    
    // Convert frequent patterns to snippets
    const learnedSnippets: Snippet[] = [];
    const threshold = 5; // Used at least 5 times
    
    patterns.forEach((count, pattern) => {
      if (count >= threshold && this.isValidSnippetPattern(pattern)) {
        const snippet = this.patternToSnippet(pattern, count);
        learnedSnippets.push(snippet);
      }
    });
    
    return learnedSnippets;
  }

  /**
   * Export snippets for sharing
   */
  async exportSnippets(
    snippetIds: string[],
    format: 'json' | 'vscode' | 'sublime' = 'json'
  ): Promise<string> {
    const snippetsToExport = snippetIds
      .map(id => this.snippets.get(id))
      .filter(Boolean) as Snippet[];
    
    switch (format) {
      case 'vscode':
        return this.exportToVSCode(snippetsToExport);
      case 'sublime':
        return this.exportToSublime(snippetsToExport);
      default:
        return JSON.stringify({
          version: '1.0',
          mnemosyne: this.mnemosyne.version,
          snippets: snippetsToExport
        }, null, 2);
    }
  }

  private registerSnippet(snippet: Snippet): void {
    this.snippets.set(snippet.id, snippet);
  }

  private registerCategory(id: string, category: SnippetCategory): void {
    this.categories.set(id, category);
  }
}