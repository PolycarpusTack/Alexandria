/**
 * Template Manager Service - Manages code generation templates
 */

import { Logger } from '../../../../utils/logger';
import { EventBus } from '../../../../core/event-bus/interfaces';
import { 
  CodeTemplate,
  TemplateVariable,
  ITemplateManagerService
} from '../interfaces';
import { TemplateRepository } from '../repositories/template-repository';
import { v4 as uuidv4 } from 'uuid';

export class TemplateManagerService implements ITemplateManagerService {
  private templatesCache: Map<string, CodeTemplate> = new Map();
  private builtInTemplates: CodeTemplate[] = [];

  constructor(
    private logger: Logger,
    private eventBus: EventBus,
    private templateRepository: TemplateRepository
  ) {
    this.initializeBuiltInTemplates();
  }

  async getTemplates(): Promise<CodeTemplate[]> {
    try {
      // Get custom templates from repository
      const customTemplates = await this.templateRepository.getAllTemplates();
      
      // Combine with built-in templates
      const allTemplates = [...this.builtInTemplates, ...customTemplates];
      
      // Update cache
      allTemplates.forEach(template => {
        this.templatesCache.set(template.id, template);
      });

      return allTemplates;
    } catch (error) {
      this.logger.error('Failed to get templates', { error });
      throw error;
    }
  }

  async getTemplate(id: string): Promise<CodeTemplate | null> {
    // Check cache first
    if (this.templatesCache.has(id)) {
      return this.templatesCache.get(id)!;
    }

    // Check built-in templates
    const builtIn = this.builtInTemplates.find(t => t.id === id);
    if (builtIn) {
      return builtIn;
    }

    // Load from repository
    try {
      const template = await this.templateRepository.getTemplate(id);
      if (template) {
        this.templatesCache.set(id, template);
      }
      return template;
    } catch (error) {
      this.logger.error('Failed to get template', { error, id });
      return null;
    }
  }

  async createTemplate(templateData: Omit<CodeTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<CodeTemplate> {
    const template: CodeTemplate = {
      ...templateData,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    try {
      // Validate template
      const codeGenerator = await import('./code-generator');
      const isValid = await codeGenerator.CodeGeneratorService.prototype.validateTemplate.call(
        { logger: this.logger },
        template
      );

      if (!isValid) {
        throw new Error('Template validation failed');
      }

      // Save to repository
      await this.templateRepository.saveTemplate(template);
      
      // Update cache
      this.templatesCache.set(template.id, template);

      // Emit event
      this.eventBus.emit('alfred:template-created', {
        templateId: template.id,
        name: template.name,
        language: template.language
      });

      return template;
    } catch (error) {
      this.logger.error('Failed to create template', { error, templateName: templateData.name });
      throw error;
    }
  }

  async updateTemplate(id: string, updates: Partial<CodeTemplate>): Promise<CodeTemplate> {
    const existing = await this.getTemplate(id);
    if (!existing) {
      throw new Error(`Template not found: ${id}`);
    }

    // Don't allow updating built-in templates
    if (this.builtInTemplates.some(t => t.id === id)) {
      throw new Error('Cannot update built-in templates');
    }

    const updated: CodeTemplate = {
      ...existing,
      ...updates,
      id, // Ensure ID doesn't change
      createdAt: existing.createdAt, // Preserve creation date
      updatedAt: new Date()
    };

    try {
      // Save to repository
      await this.templateRepository.saveTemplate(updated);
      
      // Update cache
      this.templatesCache.set(id, updated);

      // Emit event
      this.eventBus.emit('alfred:template-updated', {
        templateId: id,
        changes: Object.keys(updates)
      });

      return updated;
    } catch (error) {
      this.logger.error('Failed to update template', { error, id });
      throw error;
    }
  }

  async deleteTemplate(id: string): Promise<void> {
    // Don't allow deleting built-in templates
    if (this.builtInTemplates.some(t => t.id === id)) {
      throw new Error('Cannot delete built-in templates');
    }

    try {
      await this.templateRepository.deleteTemplate(id);
      this.templatesCache.delete(id);

      this.eventBus.emit('alfred:template-deleted', { templateId: id });
    } catch (error) {
      this.logger.error('Failed to delete template', { error, id });
      throw error;
    }
  }

  async importTemplate(templateData: string): Promise<CodeTemplate> {
    try {
      const parsed = JSON.parse(templateData);
      
      // Remove id and timestamps from imported template
      const { id, createdAt, updatedAt, ...templateWithoutMeta } = parsed;
      
      return this.createTemplate(templateWithoutMeta);
    } catch (error) {
      this.logger.error('Failed to import template', { error });
      throw new Error('Invalid template format');
    }
  }

  async exportTemplate(id: string): Promise<string> {
    const template = await this.getTemplate(id);
    if (!template) {
      throw new Error(`Template not found: ${id}`);
    }

    return JSON.stringify(template, null, 2);
  }

  // Private helper methods

  private initializeBuiltInTemplates(): void {
    this.builtInTemplates = [
      // Python Class Template
      {
        id: 'builtin-python-class',
        name: 'Python Class',
        description: 'Basic Python class with constructor and methods',
        language: 'python',
        category: 'Basic',
        variables: [
          {
            name: 'className',
            type: 'string',
            description: 'Name of the class',
            required: true,
            default: 'MyClass'
          },
          {
            name: 'baseClass',
            type: 'string',
            description: 'Base class to inherit from',
            required: false,
            default: ''
          }
        ],
        template: `class {{className}}{{baseClass ? '(' + baseClass + ')' : ''}}:
    """{{className}} - Description here"""
    
    def __init__(self):
        """Initialize {{className}}"""
        super().__init__()
        
    def example_method(self):
        """Example method"""
        pass`,
        examples: [
          {
            name: 'Simple Class',
            variables: { className: 'Person', baseClass: '' },
            output: `class Person:
    """Person - Description here"""
    
    def __init__(self):
        """Initialize Person"""
        super().__init__()
        
    def example_method(self):
        """Example method"""
        pass`
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      },

      // React Component Template
      {
        id: 'builtin-react-component',
        name: 'React Component',
        description: 'React functional component with TypeScript',
        language: 'typescript',
        category: 'React',
        variables: [
          {
            name: 'componentName',
            type: 'string',
            description: 'Name of the component',
            required: true,
            default: 'MyComponent'
          },
          {
            name: 'props',
            type: 'string',
            description: 'Props interface properties',
            required: false,
            default: ''
          }
        ],
        template: `import React from 'react';

interface {{componentName}}Props {
  {{props}}
}

export const {{componentName}}: React.FC<{{componentName}}Props> = (props) => {
  return (
    <div className="{{componentName}}">
      <h1>{{componentName}}</h1>
    </div>
  );
};`,
        createdAt: new Date(),
        updatedAt: new Date()
      },

      // Express API Route Template
      {
        id: 'builtin-express-route',
        name: 'Express API Route',
        description: 'Express.js API route with error handling',
        language: 'javascript',
        category: 'API',
        variables: [
          {
            name: 'routeName',
            type: 'string',
            description: 'Name of the route',
            required: true,
            default: 'users'
          },
          {
            name: 'method',
            type: 'string',
            description: 'HTTP method',
            required: true,
            default: 'get',
            validation: '^(get|post|put|delete|patch)$'
          }
        ],
        template: `// {{routeName}} route
router.{{method}}('/{{routeName}}', async (req, res, next) => {
  try {
    // Your logic here
    const result = await {{routeName}}Service.getAll();
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});`,
        createdAt: new Date(),
        updatedAt: new Date()
      },

      // Unit Test Template
      {
        id: 'builtin-unit-test',
        name: 'Unit Test',
        description: 'Basic unit test template',
        language: 'javascript',
        category: 'Testing',
        variables: [
          {
            name: 'testSubject',
            type: 'string',
            description: 'What is being tested',
            required: true,
            default: 'Calculator'
          },
          {
            name: 'functionName',
            type: 'string',
            description: 'Function to test',
            required: true,
            default: 'add'
          }
        ],
        template: `describe('{{testSubject}}', () => {
  describe('{{functionName}}', () => {
    it('should work correctly', () => {
      // Arrange
      const input = {};
      const expected = {};
      
      // Act
      const result = {{testSubject}}.{{functionName}}(input);
      
      // Assert
      expect(result).toEqual(expected);
    });
    
    it('should handle edge cases', () => {
      // Add edge case tests
    });
  });
});`,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }
}