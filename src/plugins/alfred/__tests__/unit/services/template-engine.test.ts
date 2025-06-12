import { TemplateEngine } from '../../../src/services/template-engine/template-engine';
import { CodeTemplate, ProjectContext } from '../../../src/interfaces';

describe('TemplateEngine', () => {
  let templateEngine: TemplateEngine;
  let mockProjectContext: ProjectContext;

  beforeEach(() => {
    templateEngine = new TemplateEngine({
      securityEnabled: true,
      maxFileSize: 1024 * 1024,
      allowedFileTypes: ['.js', '.ts', '.tsx', '.jsx'],
      enableAdvancedFeatures: true
    });

    mockProjectContext = {
      projectName: 'test-project',
      projectPath: '/test/project',
      projectType: 'react',
      languages: ['typescript'],
      frameworks: ['react']
    };
  });

  describe('processTemplate', () => {
    it('should process simple variable substitution', async () => {
      const template: CodeTemplate = {
        id: 'simple-template',
        name: 'Simple Template',
        description: 'A simple template',
        template: 'Hello {{name}}! Welcome to {{project}}.',
        variables: [
          { name: 'name', type: 'string', required: true, description: 'User name' },
          { name: 'project', type: 'string', required: true, description: 'Project name' }
        ],
        language: 'text',
        category: 'example'
      };

      const variables = { name: 'World', project: 'Alfred' };
      const result = await templateEngine.processTemplate(template, variables, mockProjectContext);

      expect(result.content).toBe('Hello World! Welcome to Alfred.');
      expect(result.errors).toHaveLength(0);
      expect(result.metadata.variablesUsed).toContain('name');
      expect(result.metadata.variablesUsed).toContain('project');
    });

    it('should handle conditional blocks correctly', async () => {
      const template: CodeTemplate = {
        id: 'conditional-template',
        name: 'Conditional Template',
        description: 'Template with conditionals',
        template: '{{#if useTypeScript}}import type { Props } from "./types";{{/if}}\n\nconst Component = ({{#if useTypeScript}}props: Props{{else}}props{{/if}}) => {\n  return <div>{{componentName}}</div>;\n};',
        variables: [
          { name: 'useTypeScript', type: 'boolean', required: false, description: 'Use TypeScript' },
          { name: 'componentName', type: 'string', required: true, description: 'Component name' }
        ],
        language: 'typescript',
        category: 'react'
      };

      // Test with TypeScript enabled
      let result = await templateEngine.processTemplate(template, {
        useTypeScript: true,
        componentName: 'TestComponent'
      });

      expect(result.content).toContain('import type { Props }');
      expect(result.content).toContain('props: Props');
      expect(result.content).toContain('TestComponent');

      // Test with TypeScript disabled
      result = await templateEngine.processTemplate(template, {
        useTypeScript: false,
        componentName: 'TestComponent'
      });

      expect(result.content).not.toContain('import type');
      expect(result.content).toContain('(props)');
    });

    it('should validate required variables', async () => {
      const template: CodeTemplate = {
        id: 'required-vars',
        name: 'Required Variables Template',
        description: 'Template with required variables',
        template: '{{name}} - {{email}} - {{optional}}',
        variables: [
          { name: 'name', type: 'string', required: true, description: 'Name' },
          { name: 'email', type: 'string', required: true, description: 'Email' },
          { name: 'optional', type: 'string', required: false, description: 'Optional field' }
        ],
        language: 'text',
        category: 'example'
      };

      const result = await templateEngine.processTemplate(template, { name: 'John' });

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual(
        expect.objectContaining({
          type: 'missing_variable',
          variable: 'email',
          message: "Required variable 'email' is missing"
        })
      );
    });

    it('should detect and prevent security violations', async () => {
      const maliciousTemplate: CodeTemplate = {
        id: 'malicious-template',
        name: 'Malicious Template',
        description: 'Template with security issues',
        template: 'eval({{userInput}}) <script>alert("xss")</script>',
        variables: [
          { name: 'userInput', type: 'string', required: true, description: 'User input' }
        ],
        language: 'javascript',
        category: 'dangerous'
      };

      const result = await templateEngine.processTemplate(maliciousTemplate, { userInput: 'test' });

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.type === 'security_violation')).toBe(true);
    });

    it('should handle helper functions', async () => {
      const template: CodeTemplate = {
        id: 'helper-template',
        name: 'Helper Template',
        description: 'Template using helpers',
        template: '// Generated on {{timestamp}}\n// Component: {{capitalize componentName}}\n// UUID: {{uuid}}',
        variables: [
          { name: 'componentName', type: 'string', required: true, description: 'Component name' }
        ],
        language: 'typescript',
        category: 'react'
      };

      const result = await templateEngine.processTemplate(template, { componentName: 'testComponent' });

      expect(result.content).toContain('// Generated on');
      expect(result.content).toContain('Component: TestComponent');
      expect(result.content).toContain('UUID:');
      expect(result.errors).toHaveLength(0);
    });

    it('should generate multiple files when specified', async () => {
      const template: CodeTemplate = {
        id: 'multi-file-template',
        name: 'Multi-file Template',
        description: 'Template that generates multiple files',
        template: 'import React from "react";\n\nexport const {{componentName}} = () => {\n  return <div>{{componentName}}</div>;\n};',
        variables: [
          { name: 'componentName', type: 'string', required: true, description: 'Component name' },
          { 
            name: 'files', 
            type: 'array', 
            required: false, 
            description: 'Files to generate',
            defaultValue: [
              { name: '{{componentName}}.tsx', action: 'create' },
              { name: '{{componentName}}.test.tsx', template: 'import { render } from "@testing-library/react";\nimport { {{componentName}} } from "./{{componentName}}";\n\ndescribe("{{componentName}}", () => {\n  it("renders correctly", () => {\n    render(<{{componentName}} />);\n  });\n});', action: 'create' }
            ]
          }
        ],
        language: 'typescript',
        category: 'react'
      };

      const result = await templateEngine.processTemplate(template, {
        componentName: 'Button',
        files: [
          { name: 'Button.tsx', action: 'create' },
          { name: 'Button.test.tsx', template: 'test content for {{componentName}}', action: 'create' }
        ]
      });

      expect(result.files).toHaveLength(2);
      expect(result.files[0].path).toBe('Button.tsx');
      expect(result.files[1].path).toBe('Button.test.tsx');
      expect(result.files[1].content).toContain('test content for Button');
    });

    it('should handle template syntax errors gracefully', async () => {
      const invalidTemplate: CodeTemplate = {
        id: 'invalid-template',
        name: 'Invalid Template',
        description: 'Template with syntax errors',
        template: '{{#if unclosed}\nThis is broken',
        variables: [],
        language: 'text',
        category: 'error'
      };

      const result = await templateEngine.processTemplate(invalidTemplate, {});

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe('syntax_error');
    });

    it('should enhance variables with project context', async () => {
      const template: CodeTemplate = {
        id: 'context-template',
        name: 'Context Template',
        description: 'Template using project context',
        template: '// Project: {{project.name}}\n// Type: {{project.type}}\n// Author: {{author}}\n// Generated: {{timestamp}}',
        variables: [],
        language: 'typescript',
        category: 'header'
      };

      const result = await templateEngine.processTemplate(template, {}, mockProjectContext);

      expect(result.content).toContain('Project: test-project');
      expect(result.content).toContain('Type: react');
      expect(result.content).toContain('Author: Alfred AI Assistant');
      expect(result.content).toContain('Generated:');
    });
  });

  describe('custom helpers', () => {
    it('should allow adding custom helpers', () => {
      templateEngine.addCustomHelper('reverse', (str: string) => str.split('').reverse().join(''));

      const helpers = templateEngine.getCustomHelpers();
      expect(helpers).toContain('reverse');
    });

    it('should allow removing custom helpers', () => {
      templateEngine.addCustomHelper('testHelper', () => 'test');
      expect(templateEngine.getCustomHelpers()).toContain('testHelper');

      const removed = templateEngine.removeCustomHelper('testHelper');
      expect(removed).toBe(true);
      expect(templateEngine.getCustomHelpers()).not.toContain('testHelper');
    });

    it('should return false when removing non-existent helper', () => {
      const removed = templateEngine.removeCustomHelper('nonExistent');
      expect(removed).toBe(false);
    });
  });

  describe('variable extraction', () => {
    it('should extract variables from template content', () => {
      const templateContent = 'Hello {{name}}! Your email is {{email}}. {{helpers.capitalize name}} is {{age}} years old.';

      const variables = templateEngine.extractVariables(templateContent);

      expect(variables).toHaveLength(3);
      expect(variables.map(v => v.name)).toEqual(['name', 'email', 'age']);
      expect(variables.every(v => v.type === 'string')).toBe(true);
      expect(variables.every(v => v.required === true)).toBe(true);
    });

    it('should ignore helper and project variables', () => {
      const templateContent = '{{helpers.capitalize name}} {{project.name}} {{user.email}}';

      const variables = templateEngine.extractVariables(templateContent);

      expect(variables).toHaveLength(2); // Only 'name' and 'user'
      expect(variables.map(v => v.name)).toEqual(['name', 'user']);
    });
  });

  describe('template validation', () => {
    it('should validate template structure', async () => {
      const invalidTemplate = {
        id: 'invalid',
        name: '',
        description: 'Invalid template',
        template: null,
        variables: 'not an array',
        language: 'typescript',
        category: 'test'
      } as any;

      const result = await templateEngine.processTemplate(invalidTemplate, {});

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.type === 'syntax_error')).toBe(true);
    });
  });

  describe('advanced features', () => {
    it('should process repeat blocks', async () => {
      const template: CodeTemplate = {
        id: 'repeat-template',
        name: 'Repeat Template',
        description: 'Template with repeat blocks',
        template: '{{#repeat 3}}Item {{@index}}\n{{/repeat}}',
        variables: [],
        language: 'text',
        category: 'loop'
      };

      const result = await templateEngine.processTemplate(template, {});

      expect(result.content).toContain('Item 0');
      expect(result.content).toContain('Item 1');
      expect(result.content).toContain('Item 2');
    });

    it('should format code based on detected language', async () => {
      const template: CodeTemplate = {
        id: 'format-template',
        name: 'Format Template',
        description: 'Template for code formatting',
        template: 'function {{functionName}}(){return "{{returnValue}}";}',
        variables: [
          { name: 'functionName', type: 'string', required: true, description: 'Function name' },
          { name: 'returnValue', type: 'string', required: true, description: 'Return value' }
        ],
        language: 'javascript',
        category: 'function'
      };

      const result = await templateEngine.processTemplate(template, {
        functionName: 'test',
        returnValue: 'hello',
        language: 'javascript'
      });

      // Should have proper formatting
      expect(result.content).toContain('function test() {');
      expect(result.content).toContain('return "hello";');
    });
  });
});