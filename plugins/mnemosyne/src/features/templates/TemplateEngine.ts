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
}