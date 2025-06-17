import { 
  MnemosyneCore, 
  KnowledgeNode, 
  DocumentContext,
  KnowledgeGraph 
} from '../../core/MnemosyneCore';
import { Template, TemplateContext, RenderOptions } from './types';

export class MnemosyneTemplateEngine {
  private mnemosyne: MnemosyneCore;
  private knowledgeGraph: KnowledgeGraph;
  private templates: Map<string, Template> = new Map();
  private alfred?: any;
  
  constructor(mnemosyne: MnemosyneCore) {
    this.mnemosyne = mnemosyne;
    this.knowledgeGraph = mnemosyne.getKnowledgeGraph();
    this.initializeAlfred();
  }

  private async initializeAlfred(): Promise<void> {
    try {
      const alexandria = this.mnemosyne.getAlexandriaContext();
      this.alfred = await alexandria.getPlugin('alfred');
    } catch (error) {
      console.log('ALFRED not available for template generation');
    }
  }

  /**
   * Render a template with Mnemosyne-enhanced context
   */
  async render(
    templateId: string, 
    userContext: any = {},
    options: RenderOptions = {}
  ): Promise<string> {
    const template = await this.getTemplate(templateId);
    const context = await this.buildMnemosyneContext(templateId, userContext);
    
    // Track template usage in knowledge graph
    await this.knowledgeGraph.recordUsage({
      type: 'template',
      id: templateId,
      context: context.document?.id,
      timestamp: new Date()
    });
    
    return this.renderTemplate(template, context, options);
  }
  
  /**
   * Build enhanced context with Mnemosyne knowledge
   */
  private async buildMnemosyneContext(
    templateId: string,
    userContext: any
  ): Promise<TemplateContext> {
    const activeDoc = this.mnemosyne.getActiveDocument();
    const user = this.mnemosyne.getCurrentUser();
    
    // Get related knowledge from graph
    const relatedKnowledge = await this.knowledgeGraph.getRelated(
      activeDoc?.id || templateId,
      { 
        depth: 2,
        types: ['document', 'template', 'snippet'],
        limit: 10
      }
    );
    
    // Get usage patterns
    const usagePatterns = await this.mnemosyne.analytics.getTemplateUsage(
      templateId,
      { timeframe: '30d', groupBy: 'context' }
    );
    
    // Build comprehensive context
    const context: TemplateContext = {
      // User-provided context
      ...userContext,
      
      // Mnemosyne system context
      mnemosyne: {
        id: this.generateKnowledgeId(),
        version: this.mnemosyne.version,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        
        // Active document context
        document: activeDoc ? {
          id: activeDoc.id,
          title: activeDoc.title,
          type: activeDoc.type,
          tags: activeDoc.tags,
          author: activeDoc.author
        } : null,
        
        // Knowledge graph data
        related: relatedKnowledge.map(node => ({
          id: node.id,
          title: node.title,
          link: `mnemosyne://${node.id}`,
          relevance: node.relevance,
          type: node.type
        })),
        
        // User knowledge profile
        userProfile: {
          name: user.name,
          expertise: user.expertise || [],
          recentDocs: await this.mnemosyne.getRecentDocuments(user.id, 5),
          preferences: user.templatePreferences || {}
        },
        
        // Usage insights
        insights: {
          popularVariables: this.extractPopularVariables(usagePatterns),
          commonPatterns: usagePatterns.patterns,
          suggestedValues: await this.suggestVariableValues(templateId, userContext)
        }
      },
      
      // Alexandria platform context
      alexandria: await this.getAlexandriaContext()
    };
    
    return context;
  }
  
  /**
   * Intelligently suggest templates based on context
   */
  async suggestTemplates(context: DocumentContext): Promise<Template[]> {
    const suggestions: Template[] = [];
    
    // 1. Get templates used in similar documents
    const similarDocs = await this.knowledgeGraph.findSimilar(
      context.document,
      { threshold: 0.7, limit: 20 }
    );
    
    const templateUsage = new Map<string, number>();
    for (const doc of similarDocs) {
      if (doc.metadata?.templateId) {
        const count = templateUsage.get(doc.metadata.templateId) || 0;
        templateUsage.set(doc.metadata.templateId, count + 1);
      }
    }
    
    // 2. Get AI suggestions if ALFRED is available
    if (this.alfred) {
      const aiSuggestions = await this.alfred.generate({
        prompt: `Suggest templates for a ${context.document.type} document about "${context.document.title}"`,
        context: {
          documentType: context.document.type,
          tags: context.document.tags,
          similarTemplates: Array.from(templateUsage.keys()).slice(0, 5),
          userExpertise: context.user.expertise
        },
        model: 'codellama',
        maxTokens: 500
      });
      
      // Parse AI suggestions and add to list
      const parsedSuggestions = this.parseAISuggestions(aiSuggestions);
      suggestions.push(...parsedSuggestions);
    }
    
    // 3. Add frequently used templates
    const frequentTemplates = await this.getFrequentTemplates(
      context.user.id,
      context.document.type
    );
    suggestions.push(...frequentTemplates);
    
    // 4. Rank and deduplicate
    return this.rankTemplates(suggestions, context);
  }

  /**
   * Generate a new template using ALFRED
   */
  async generateTemplate(
    prompt: string,
    context: Partial<DocumentContext> = {}
  ): Promise<Template> {
    if (!this.alfred) {
      throw new Error('ALFRED is required for template generation');
    }
    
    // Enhance prompt with Mnemosyne context
    const enhancedPrompt = `
      Create a template for: ${prompt}
      
      Context:
      - Knowledge Base: ${this.mnemosyne.getKnowledgeBase().name}
      - Document Type: ${context.document?.type || 'general'}
      - User Expertise: ${context.user?.expertise?.join(', ') || 'general'}
      - Related Templates: ${await this.getRelatedTemplateNames(prompt)}
      
      Requirements:
      - Use Handlebars syntax for variables
      - Include Mnemosyne-specific variables (mnemosyne.*)
      - Add knowledge graph connections where relevant
      - Make it reusable and well-documented
    `;
    
    const generated = await this.alfred.generate({
      prompt: enhancedPrompt,
      model: 'codellama',
      temperature: 0.3,
      maxTokens: 2000
    });
    
    // Parse and validate generated template
    const template = this.parseGeneratedTemplate(generated);
    
    // Store in knowledge graph
    await this.knowledgeGraph.addNode({
      type: 'template',
      id: template.id,
      title: template.name,
      content: template.content,
      metadata: {
        generated: true,
        generatedBy: 'ALFRED',
        prompt: prompt,
        timestamp: new Date()
      }
    });
    
    return template;
  }
  
  // Missing helper methods
  
  private async getTemplate(templateId: string): Promise<Template> {
    // Check cache first
    if (this.templates.has(templateId)) {
      return this.templates.get(templateId)!;
    }
    
    // Load from knowledge graph
    const node = await this.knowledgeGraph.getNode(templateId);
    if (!node || node.type !== 'template') {
      throw new Error(`Template not found: ${templateId}`);
    }
    
    const template: Template = {
      id: node.id,
      name: node.title,
      content: node.content,
      variables: this.extractVariables(node.content),
      metadata: node.metadata
    };
    
    this.templates.set(templateId, template);
    return template;
  }
  
  private async renderTemplate(
    template: Template,
    context: TemplateContext,
    options: RenderOptions
  ): Promise<string> {
    // Simple Handlebars-like rendering
    let rendered = template.content;
    
    // Replace variables
    const variables = this.extractVariables(template.content);
    for (const variable of variables) {
      const value = this.getValueFromContext(variable, context);
      const pattern = new RegExp(`{{\\s*${variable}\\s*}}`, 'g');
      rendered = rendered.replace(pattern, value || '');
    }
    
    return rendered;
  }
  
  private extractVariables(content: string): string[] {
    const variablePattern = /{{\\s*([^}]+)\\s*}}/g;
    const variables: string[] = [];
    let match;
    
    while ((match = variablePattern.exec(content)) !== null) {
      variables.push(match[1].trim());
    }
    
    return [...new Set(variables)];
  }
  
  private getValueFromContext(variable: string, context: any): string {
    const parts = variable.split('.');
    let value = context;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return '';
      }
    }
    
    return String(value);
  }
  
  private generateKnowledgeId(): string {
    return `mnemosyne-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private async getAlexandriaContext(): Promise<any> {
    try {
      const alexandria = this.mnemosyne.getAlexandriaContext();
      return {
        version: alexandria.version,
        plugins: alexandria.getActivePlugins(),
        platform: alexandria.platform
      };
    } catch {
      return {};
    }
  }
  
  private extractPopularVariables(usagePatterns: any): string[] {
    if (!usagePatterns || !usagePatterns.variables) {
      return [];
    }
    
    return Object.entries(usagePatterns.variables)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 10)
      .map(([variable]) => variable);
  }
  
  private async suggestVariableValues(
    templateId: string,
    userContext: any
  ): Promise<Record<string, string[]>> {
    // Simple suggestion based on context
    const suggestions: Record<string, string[]> = {};
    
    // Add common suggestions
    suggestions['title'] = [userContext.title || 'Untitled'];
    suggestions['date'] = [new Date().toISOString().split('T')[0]];
    suggestions['author'] = [userContext.author || 'Unknown'];
    
    return suggestions;
  }
  
  private parseAISuggestions(aiResponse: string): Template[] {
    // Simple parsing of AI suggestions
    const templates: Template[] = [];
    
    try {
      const lines = aiResponse.split('\n');
      let currentTemplate: Partial<Template> | null = null;
      
      for (const line of lines) {
        if (line.startsWith('Template:')) {
          if (currentTemplate && currentTemplate.name && currentTemplate.content) {
            templates.push(currentTemplate as Template);
          }
          currentTemplate = {
            id: this.generateKnowledgeId(),
            name: line.replace('Template:', '').trim(),
            content: '',
            variables: []
          };
        } else if (currentTemplate && line.trim()) {
          currentTemplate.content += line + '\n';
        }
      }
      
      if (currentTemplate && currentTemplate.name && currentTemplate.content) {
        templates.push(currentTemplate as Template);
      }
    } catch (error) {
      console.error('Failed to parse AI suggestions:', error);
    }
    
    return templates;
  }
  
  private async getFrequentTemplates(
    userId: string,
    documentType: string
  ): Promise<Template[]> {
    const usage = await this.mnemosyne.analytics.getTemplateUsageByUser(userId, {
      documentType,
      limit: 5
    });
    
    const templates: Template[] = [];
    for (const item of usage) {
      try {
        const template = await this.getTemplate(item.templateId);
        templates.push(template);
      } catch (error) {
        // Skip missing templates
      }
    }
    
    return templates;
  }
  
  private async rankTemplates(
    templates: Template[],
    context: DocumentContext
  ): Promise<Template[]> {
    // Simple ranking based on relevance
    const scored = templates.map(template => {
      let score = 0;
      
      // Check title match
      if (template.name.toLowerCase().includes(context.document.type.toLowerCase())) {
        score += 2;
      }
      
      // Check tag matches
      const templateTags = template.metadata?.tags || [];
      for (const tag of context.document.tags) {
        if (templateTags.includes(tag)) {
          score += 1;
        }
      }
      
      return { template, score };
    });
    
    // Sort by score and remove duplicates
    const seen = new Set<string>();
    return scored
      .sort((a, b) => b.score - a.score)
      .filter(({ template }) => {
        if (seen.has(template.id)) {
          return false;
        }
        seen.add(template.id);
        return true;
      })
      .map(({ template }) => template);
  }
  
  private async getRelatedTemplateNames(prompt: string): Promise<string> {
    const searchTerms = prompt.toLowerCase().split(' ');
    const relatedTemplates: string[] = [];
    
    // Search existing templates
    for (const [id, template] of this.templates) {
      const nameWords = template.name.toLowerCase().split(' ');
      if (searchTerms.some(term => nameWords.includes(term))) {
        relatedTemplates.push(template.name);
      }
    }
    
    return relatedTemplates.slice(0, 3).join(', ') || 'None';
  }
  
  private parseGeneratedTemplate(generated: string): Template {
    // Extract template from generated content
    const lines = generated.split('\n');
    let name = 'Generated Template';
    let content = '';
    let inContent = false;
    
    for (const line of lines) {
      if (line.startsWith('Name:') || line.startsWith('Title:')) {
        name = line.replace(/^(Name|Title):\s*/, '').trim();
      } else if (line.startsWith('Content:') || line.startsWith('Template:')) {
        inContent = true;
      } else if (inContent) {
        content += line + '\n';
      }
    }
    
    return {
      id: this.generateKnowledgeId(),
      name,
      content: content.trim(),
      variables: this.extractVariables(content),
      metadata: {
        generated: true,
        generatedAt: new Date()
      }
    };
  }
}