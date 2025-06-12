import { PluginContext } from '../../../../../core/plugin-registry/interfaces';
import {
  MnemosyneTemplate,
  TemplateGenerationRequest,
  TemplateContext,
  TemplateVariable,
  TemplateEvolutionSuggestion
} from './interfaces';
import { TemplateRepository } from './TemplateRepository';
import { TemplateEngine } from './TemplateEngine';

export class AITemplateGenerator {
  private templateRepository: TemplateRepository;
  private templateEngine: TemplateEngine;

  constructor(private context: PluginContext) {
    this.templateRepository = new TemplateRepository(context);
    this.templateEngine = new TemplateEngine(context);
  }

  /**
   * Generate a template using ALFRED AI
   */
  async generateTemplate(request: TemplateGenerationRequest): Promise<MnemosyneTemplate> {
    try {
      // Check if ALFRED plugin is available
      const alfredPlugin = this.context.plugins?.get('alfred');
      if (!alfredPlugin) {
        throw new Error('ALFRED plugin not available for AI generation');
      }

      // Enhance the prompt with context
      const enhancedPrompt = await this.enhancePrompt(request);

      // Generate template content using ALFRED
      const generatedContent = await this.callAlfredGeneration(enhancedPrompt, request);

      // Extract variables from generated content
      const variables = this.extractVariablesFromContent(generatedContent);

      // Create template metadata
      const metadata = await this.generateMetadata(request, generatedContent);

      // Create the template
      const template = await this.templateRepository.create({
        name: this.generateTemplateName(request),
        content: generatedContent,
        type: request.type,
        metadata,
        variables,
        relationships: await this.generateRelationships(request),
        createdBy: this.context.user.id,
        isPublic: false,
        isOfficial: false
      });

      // Emit generation event
      this.context.events.emit('mnemosyne:template:generated', {
        templateId: template.id,
        request,
        aiModel: 'alfred'
      });

      return template;
    } catch (error) {
      this.context.logger.error('Template generation failed', {
        request,
        error: error.message
      });
      throw new Error(`Template generation failed: ${error.message}`);
    }
  }

  /**
   * Enhance existing template with AI
   */
  async enhanceTemplate(
    templateId: string,
    enhancements: {
      addExamples?: boolean;
      optimizeStructure?: boolean;
      suggestVariables?: boolean;
      improveDescriptions?: boolean;
      addErrorHandling?: boolean;
    }
  ): Promise<MnemosyneTemplate> {
    const template = await this.templateRepository.getById(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    let enhancedContent = template.content;
    let enhancedVariables = [...template.variables];

    // Add examples
    if (enhancements.addExamples) {
      const examples = await this.generateExamples(template);
      enhancedContent = this.addExamplesToTemplate(enhancedContent, examples);
    }

    // Optimize structure
    if (enhancements.optimizeStructure) {
      enhancedContent = await this.optimizeTemplateStructure(enhancedContent);
    }

    // Suggest variables
    if (enhancements.suggestVariables) {
      const suggestedVars = await this.suggestVariables(template);
      enhancedVariables.push(...suggestedVars);
    }

    // Improve descriptions
    if (enhancements.improveDescriptions) {
      enhancedContent = await this.improveDescriptions(enhancedContent);
    }

    // Add error handling
    if (enhancements.addErrorHandling) {
      enhancedContent = await this.addErrorHandling(enhancedContent);
    }

    // Update the template
    return this.templateRepository.update(templateId, {
      content: enhancedContent,
      variables: enhancedVariables,
      metadata: {
        ...template.metadata,
        version: this.incrementVersion(template.metadata.version)
      }
    });
  }

  /**
   * Generate template suggestions based on context
   */
  async generateSuggestions(context: TemplateContext): Promise<string[]> {
    const alfredPlugin = this.context.plugins?.get('alfred');
    if (!alfredPlugin) {
      return this.getFallbackSuggestions(context);
    }

    try {
      const prompt = this.buildSuggestionPrompt(context);
      const response = await this.callAlfred('suggest', {
        prompt,
        context: this.contextToAlfredFormat(context),
        maxSuggestions: 5
      });

      return response.suggestions || [];
    } catch (error) {
      this.context.logger.warn('AI suggestion generation failed', { error });
      return this.getFallbackSuggestions(context);
    }
  }

  /**
   * Generate smart variable suggestions
   */
  async suggestVariables(template: MnemosyneTemplate): Promise<TemplateVariable[]> {
    const alfredPlugin = this.context.plugins?.get('alfred');
    if (!alfredPlugin) {
      return this.extractVariablesFromContent(template.content);
    }

    try {
      const prompt = `
        Analyze this template and suggest useful variables that could make it more flexible:
        
        Template: ${template.name}
        Category: ${template.metadata.category}
        Content: ${template.content.substring(0, 1000)}...
        
        Suggest variables that would make this template more reusable and flexible.
        Consider common patterns and best practices.
      `;

      const response = await this.callAlfred('analyze', {
        prompt,
        task: 'variable_suggestion',
        content: template.content
      });

      return this.parseVariableSuggestions(response.variables || []);
    } catch (error) {
      this.context.logger.warn('Variable suggestion failed', { error });
      return [];
    }
  }

  /**
   * Analyze template usage and suggest improvements
   */
  async analyzeAndSuggestImprovements(templateId: string): Promise<TemplateEvolutionSuggestion[]> {
    const template = await this.templateRepository.getById(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    // Get usage analytics
    const usageData = await this.getUsageAnalytics(templateId);

    // Analyze with AI
    const alfredPlugin = this.context.plugins?.get('alfred');
    if (!alfredPlugin) {
      return this.getRuleBasedSuggestions(template, usageData);
    }

    try {
      const prompt = `
        Analyze this template's usage patterns and suggest improvements:
        
        Template: ${template.name}
        Usage Count: ${template.analytics.usageCount}
        Satisfaction Score: ${template.analytics.satisfactionScore}
        Modification Rate: ${template.analytics.modificationRate}
        
        Common Modifications:
        ${template.analytics.commonModifications.map((m) => `- ${m.section}: ${m.changeType} (${m.frequency}% of users)`).join('\n')}
        
        User Feedback:
        ${template.analytics.userFeedback
          .slice(0, 5)
          .map((f) => `- ${f.rating}/5: ${f.comment}`)
          .join('\n')}
        
        Content: ${template.content}
        
        Suggest specific improvements based on usage patterns.
      `;

      const response = await this.callAlfred('analyze', {
        prompt,
        task: 'template_improvement',
        template,
        usageData
      });

      return this.parseImprovementSuggestions(response.improvements || []);
    } catch (error) {
      this.context.logger.warn('Template analysis failed', { error });
      return this.getRuleBasedSuggestions(template, usageData);
    }
  }

  /**
   * Generate contextual template based on current document
   */
  async generateContextualTemplate(
    currentDocumentId: string,
    templateType: string
  ): Promise<MnemosyneTemplate> {
    // Get current document context
    const document = await this.getCurrentDocument(currentDocumentId);
    if (!document) {
      throw new Error('Current document not found');
    }

    // Build context from document
    const context = await this.buildContextFromDocument(document);

    // Generate template request
    const request: TemplateGenerationRequest = {
      prompt: `Create a ${templateType} template based on the context of: ${document.title}`,
      type: 'document',
      context,
      constraints: {
        includeVariables: true,
        includeExamples: true,
        targetAudience: this.inferAudience(document)
      }
    };

    return this.generateTemplate(request);
  }

  // Private helper methods

  private async enhancePrompt(request: TemplateGenerationRequest): Promise<string> {
    let enhancedPrompt = request.prompt;

    // Add context information
    if (request.context) {
      enhancedPrompt += '\n\nContext:';

      if (request.context.project) {
        enhancedPrompt += `\n- Project: ${request.context.project.name} (${request.context.project.type})`;
        enhancedPrompt += `\n- Technologies: ${request.context.project.technologies.join(', ')}`;
      }

      if (request.context.user) {
        enhancedPrompt += `\n- User expertise: ${request.context.user.expertise.join(', ')}`;
      }
    }

    // Add constraints
    if (request.constraints) {
      enhancedPrompt += '\n\nRequirements:';

      if (request.constraints.targetAudience) {
        enhancedPrompt += `\n- Target audience: ${request.constraints.targetAudience}`;
      }

      if (request.constraints.includeVariables) {
        enhancedPrompt += '\n- Include template variables for customization';
      }

      if (request.constraints.includeExamples) {
        enhancedPrompt += '\n- Include practical examples';
      }
    }

    // Add template best practices
    enhancedPrompt += `
      
Template should follow these best practices:
- Use Handlebars syntax for variables: {{variableName}}
- Include clear descriptions and comments
- Provide sensible default values
- Use semantic variable names
- Include error handling where appropriate
- Follow markdown formatting conventions
    `;

    return enhancedPrompt;
  }

  private async callAlfredGeneration(
    prompt: string,
    request: TemplateGenerationRequest
  ): Promise<string> {
    // This would call the actual ALFRED plugin
    // For now, simulate AI generation
    return this.simulateAIGeneration(prompt, request);
  }

  private async callAlfred(action: string, params: any): Promise<any> {
    // This would call the actual ALFRED plugin
    // For now, return mock responses
    return this.getMockAlfredResponse(action, params);
  }

  private simulateAIGeneration(prompt: string, request: TemplateGenerationRequest): string {
    // Simulate AI-generated template based on request
    const templates = {
      'api-documentation': `# {{apiName}} API Documentation

## Overview
{{description}}

## Base URL
\`\`\`
{{baseUrl}}
\`\`\`

## Authentication
{{#if requiresAuth}}
This API requires authentication. Include your API key in the header:
\`\`\`
Authorization: Bearer {{apiKey}}
\`\`\`
{{/if}}

## Endpoints

### {{method}} {{endpoint}}
{{endpointDescription}}

**Parameters:**
{{#each parameters}}
- \`{{name}}\` ({{type}}) - {{description}}
{{/each}}

**Example Request:**
\`\`\`{{language}}
{{exampleRequest}}
\`\`\`

**Example Response:**
\`\`\`json
{{exampleResponse}}
\`\`\`

## Error Codes
{{#each errorCodes}}
- \`{{code}}\` - {{description}}
{{/each}}

## Rate Limiting
{{rateLimitInfo}}

---
*Generated on {{now}}*`,

      'meeting-notes': `# {{meetingTitle}}

**Date:** {{formatDate date}}
**Time:** {{startTime}} - {{endTime}}
**Location:** {{location}}

## Attendees
{{#each attendees}}
- {{name}} ({{role}})
{{/each}}

## Agenda
{{#each agendaItems}}
1. {{title}} - {{duration}}min
{{/each}}

## Discussion Points

### {{topicTitle}}
**Discussion:**
{{topicNotes}}

**Decisions:**
{{#each decisions}}
- {{description}}
{{/each}}

## Action Items
{{#each actionItems}}
- [ ] {{task}} - Assigned to: {{assignee}} - Due: {{dueDate}}
{{/each}}

## Next Steps
{{nextSteps}}

**Next Meeting:** {{nextMeetingDate}}

---
*Meeting notes template - {{now}}*`,

      'project-readme': `# {{projectName}}

{{description}}

## Installation

\`\`\`bash
{{installCommand}}
\`\`\`

## Usage

\`\`\`{{language}}
{{usageExample}}
\`\`\`

## Features

{{#each features}}
- {{description}}
{{/each}}

## Configuration

{{#if hasConfig}}
Create a \`{{configFile}}\` file:

\`\`\`{{configFormat}}
{{configExample}}
\`\`\`
{{/if}}

## API Reference

### {{mainClass}}

{{classDescription}}

#### Methods

{{#each methods}}
##### \`{{name}}({{parameters}})\`
{{description}}

**Parameters:**
{{#each params}}
- \`{{name}}\` ({{type}}) - {{description}}
{{/each}}

**Returns:** {{returnType}}

{{/each}}

## Contributing

{{contributingGuidelines}}

## License

{{license}}

---
*Generated with Mnemosyne Templates*`
    };

    // Extract template type from prompt
    const templateType = this.extractTemplateType(prompt);
    return templates[templateType] || templates['project-readme'];
  }

  private extractTemplateType(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes('api') || lowerPrompt.includes('documentation')) {
      return 'api-documentation';
    }
    if (lowerPrompt.includes('meeting') || lowerPrompt.includes('notes')) {
      return 'meeting-notes';
    }

    return 'project-readme';
  }

  private extractVariablesFromContent(content: string): TemplateVariable[] {
    const variables = this.templateEngine.extractVariables(content);

    return variables.map((name) => ({
      name,
      type: this.inferVariableType(name, content),
      description: this.generateVariableDescription(name),
      required: this.isVariableRequired(name, content)
    }));
  }

  private inferVariableType(name: string, content: string): TemplateVariable['type'] {
    const lowerName = name.toLowerCase();

    if (lowerName.includes('date') || lowerName.includes('time')) {
      return 'date';
    }
    if (lowerName.includes('count') || lowerName.includes('number') || lowerName.includes('id')) {
      return 'number';
    }
    if (lowerName.includes('enable') || lowerName.includes('is') || lowerName.includes('has')) {
      return 'boolean';
    }
    if (lowerName.includes('list') || lowerName.includes('items') || lowerName.includes('tags')) {
      return 'array';
    }

    return 'string';
  }

  private generateVariableDescription(name: string): string {
    // Generate human-readable description from variable name
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  private isVariableRequired(name: string, content: string): boolean {
    // Check if variable appears in conditional blocks
    const conditionalRegex = new RegExp(`\\{\\{#if\\s+${name}\\}\\}`, 'i');
    return !conditionalRegex.test(content);
  }

  private async generateMetadata(
    request: TemplateGenerationRequest,
    content: string
  ): Promise<any> {
    return {
      category: request.category || this.inferCategory(request.prompt),
      tags: this.generateTags(request, content),
      author: 'AI Generated',
      version: '1.0.0',
      description: this.generateDescription(request.prompt),
      usage: {
        totalUses: 0,
        lastUsed: new Date(),
        averageCompletionTime: 0,
        modificationRate: 0,
        satisfactionScore: 0,
        successRate: 0
      },
      difficulty: request.constraints?.targetAudience === 'beginner' ? 'beginner' : 'intermediate',
      estimatedTime: this.estimateCompletionTime(content)
    };
  }

  private inferCategory(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes('api') || lowerPrompt.includes('documentation')) {
      return 'documentation';
    }
    if (lowerPrompt.includes('meeting') || lowerPrompt.includes('notes')) {
      return 'collaboration';
    }
    if (lowerPrompt.includes('project') || lowerPrompt.includes('readme')) {
      return 'project-management';
    }

    return 'general';
  }

  private generateTags(request: TemplateGenerationRequest, content: string): string[] {
    const tags = ['ai-generated'];

    if (request.category) {
      tags.push(request.category);
    }

    // Extract tags from content analysis
    const contentTags = this.extractTagsFromContent(content);
    tags.push(...contentTags);

    return [...new Set(tags)]; // Remove duplicates
  }

  private extractTagsFromContent(content: string): string[] {
    const tags: string[] = [];
    const lowerContent = content.toLowerCase();

    // Common patterns
    if (lowerContent.includes('api')) tags.push('api');
    if (lowerContent.includes('rest')) tags.push('rest');
    if (lowerContent.includes('graphql')) tags.push('graphql');
    if (lowerContent.includes('documentation')) tags.push('docs');
    if (lowerContent.includes('meeting')) tags.push('meeting');
    if (lowerContent.includes('project')) tags.push('project');

    return tags;
  }

  private generateDescription(prompt: string): string {
    return `AI-generated template based on: ${prompt}`;
  }

  private estimateCompletionTime(content: string): number {
    // Estimate based on content length and complexity
    const wordCount = content.split(/\s+/).length;
    const variableCount = (content.match(/\{\{[^}]+\}\}/g) || []).length;

    // Base time + variable complexity
    return Math.max(5, Math.ceil(wordCount / 100) + variableCount * 2);
  }

  private async generateRelationships(request: TemplateGenerationRequest): Promise<any[]> {
    // Generate relationships based on context
    // This would integrate with the knowledge graph
    return [];
  }

  private generateTemplateName(request: TemplateGenerationRequest): string {
    // Extract name from prompt
    const prompt = request.prompt.toLowerCase();

    if (prompt.includes('api')) {
      return 'API Documentation Template';
    }
    if (prompt.includes('meeting')) {
      return 'Meeting Notes Template';
    }
    if (prompt.includes('readme')) {
      return 'Project README Template';
    }

    return 'Generated Template';
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.');
    const patch = parseInt(parts[2] || '0') + 1;
    return `${parts[0]}.${parts[1]}.${patch}`;
  }

  private getMockAlfredResponse(action: string, params: any): any {
    // Mock responses for development
    switch (action) {
      case 'suggest':
        return {
          suggestions: [
            'Add error handling section',
            'Include code examples',
            'Add troubleshooting guide',
            'Include performance considerations',
            'Add security best practices'
          ]
        };

      case 'analyze':
        if (params.task === 'variable_suggestion') {
          return {
            variables: [
              { name: 'projectName', type: 'string', description: 'Name of the project' },
              { name: 'version', type: 'string', description: 'Version number' },
              { name: 'author', type: 'string', description: 'Author name' }
            ]
          };
        }

        if (params.task === 'template_improvement') {
          return {
            improvements: [
              {
                type: 'add_section',
                description: 'Add troubleshooting section',
                impact: 'medium',
                evidence: ['Users frequently ask about common issues']
              }
            ]
          };
        }

        return {};

      default:
        return {};
    }
  }

  private contextToAlfredFormat(context: TemplateContext): any {
    return {
      user: context.user,
      project: context.project,
      mnemosyne: {
        relatedDocs: context.mnemosyne.related?.length || 0,
        knowledgeScore: context.mnemosyne.knowledgeScore
      }
    };
  }

  private getFallbackSuggestions(context: TemplateContext): string[] {
    return [
      'Add more detailed examples',
      'Include common use cases',
      'Add troubleshooting section',
      'Include best practices',
      'Add validation steps'
    ];
  }

  private parseVariableSuggestions(suggestions: any[]): TemplateVariable[] {
    return suggestions.map((s) => ({
      name: s.name,
      type: s.type || 'string',
      description: s.description,
      required: s.required || false
    }));
  }

  private parseImprovementSuggestions(improvements: any[]): TemplateEvolutionSuggestion[] {
    return improvements.map((imp) => ({
      type: imp.type,
      description: imp.description,
      impact: imp.impact || 'medium',
      evidence: {
        usagePatterns: imp.evidence?.usagePatterns || [],
        userFeedback: imp.evidence?.userFeedback || [],
        successMetrics: imp.evidence?.successMetrics || {}
      },
      suggestedChange: imp.suggestedChange || imp.description
    }));
  }

  private async getUsageAnalytics(templateId: string): Promise<any> {
    // Get usage analytics from database
    const query = `
      SELECT 
        COUNT(*) as total_usage,
        AVG(completion_time) as avg_completion,
        array_agg(modifications) as common_modifications
      FROM mnemosyne_template_usage
      WHERE template_id = $1
    `;

    const result = await this.context.db.query(query, [templateId]);
    return result.rows[0] || {};
  }

  private getRuleBasedSuggestions(
    template: MnemosyneTemplate,
    usageData: any
  ): TemplateEvolutionSuggestion[] {
    const suggestions: TemplateEvolutionSuggestion[] = [];

    // Rule-based analysis
    if (template.analytics.modificationRate > 0.7) {
      suggestions.push({
        type: 'modify_content',
        description: 'Template is frequently modified, consider making it more flexible',
        impact: 'high',
        evidence: {
          usagePatterns: ['High modification rate'],
          userFeedback: [],
          successMetrics: { modificationRate: template.analytics.modificationRate }
        },
        suggestedChange: 'Add more variables or conditional sections'
      });
    }

    if (template.analytics.satisfactionScore < 3) {
      suggestions.push({
        type: 'add_section',
        description: 'Low satisfaction score indicates missing content',
        impact: 'high',
        evidence: {
          usagePatterns: [],
          userFeedback: ['Low ratings'],
          successMetrics: { satisfactionScore: template.analytics.satisfactionScore }
        },
        suggestedChange: 'Add examples, improve descriptions, or add missing sections'
      });
    }

    return suggestions;
  }

  private async getCurrentDocument(documentId: string): Promise<any> {
    // This would fetch from Mnemosyne's document service
    return null;
  }

  private async buildContextFromDocument(document: any): Promise<Partial<TemplateContext>> {
    // Build context from document analysis
    return {
      mnemosyne: {
        id: document.id,
        version: document.version,
        created: document.createdAt,
        updated: document.updatedAt,
        related: [],
        prerequisites: [],
        learningPath: '',
        knowledgeScore: 0.5,
        collaborativeNotes: []
      },
      user: this.context.user,
      variables: {}
    };
  }

  private inferAudience(document: any): string {
    // Infer target audience from document analysis
    return 'general';
  }

  // Additional helper methods for template enhancement
  private async generateExamples(template: MnemosyneTemplate): Promise<string[]> {
    // Generate relevant examples for the template
    return [
      `Example usage of ${template.name}`,
      'Common implementation pattern',
      'Best practice example'
    ];
  }

  private addExamplesToTemplate(content: string, examples: string[]): string {
    const exampleSection =
      '\n\n## Examples\n\n' +
      examples.map((example, i) => `### Example ${i + 1}\n${example}`).join('\n\n');

    return content + exampleSection;
  }

  private async optimizeTemplateStructure(content: string): Promise<string> {
    // AI-powered structure optimization
    // For now, just ensure consistent formatting
    return content
      .replace(/\n{3,}/g, '\n\n')
      .replace(/#+\s*(.+)/g, (match, title) => `## ${title.trim()}`)
      .trim();
  }

  private async improveDescriptions(content: string): Promise<string> {
    // Enhance descriptions with AI
    return content; // Placeholder
  }

  private async addErrorHandling(content: string): Promise<string> {
    // Add error handling sections where appropriate
    if (!content.includes('Error') && !content.includes('Troubleshooting')) {
      return (
        content +
        '\n\n## Error Handling\n\n{{#if hasErrors}}\nCommon issues and solutions:\n{{#each errors}}\n- **{{error}}**: {{solution}}\n{{/each}}\n{{/if}}'
      );
    }
    return content;
  }

  private buildSuggestionPrompt(context: TemplateContext): string {
    return `
      Based on the current context, suggest relevant templates:
      
      User: ${context.user.name} (${context.user.expertise.join(', ')})
      Project: ${context.project?.name || 'Unknown'}
      Recent Activity: ${context.mnemosyne.related.length} related documents
      
      Suggest template types that would be useful in this context.
    `;
  }
}
