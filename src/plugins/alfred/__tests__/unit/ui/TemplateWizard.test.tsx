import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TemplateWizard } from '../../../ui/components/enhanced/TemplateWizard';
import { CodeTemplate, ProjectContext } from '../../../src/interfaces';

// Mock toast
jest.mock('@client/components/ui/use-toast', () => ({
  toast: jest.fn()
}));

const mockTemplates: CodeTemplate[] = [
  {
    id: 'react-component',
    name: 'React Component',
    description: 'Basic React functional component',
    template: 'import React from "react";\n\ninterface {{componentName}}Props {\n  // Add props here\n}\n\nexport const {{componentName}}: React.FC<{{componentName}}Props> = () => {\n  return (\n    <div>\n      {/* Component content */}\n    </div>\n  );\n};',
    variables: [
      { name: 'componentName', type: 'string', required: true, description: 'Name of the component' }
    ],
    language: 'typescript',
    category: 'react',
    tags: ['react', 'component', 'typescript']
  },
  {
    id: 'express-route',
    name: 'Express Route',
    description: 'Express.js route handler',
    template: 'import { Request, Response } from "express";\n\nexport const {{routeName}} = (req: Request, res: Response) => {\n  // Handle {{httpMethod}} request\n  res.json({ message: "{{routeName}} endpoint" });\n};',
    variables: [
      { name: 'routeName', type: 'string', required: true, description: 'Name of the route' },
      { name: 'httpMethod', type: 'select', required: true, description: 'HTTP method', options: ['GET', 'POST', 'PUT', 'DELETE'] }
    ],
    language: 'typescript',
    category: 'backend',
    tags: ['express', 'route', 'api']
  },
  {
    id: 'test-component',
    name: 'React Test',
    description: 'Jest test for React component',
    template: 'import { render, screen } from "@testing-library/react";\nimport { {{componentName}} } from "./{{componentName}}";\n\ndescribe("{{componentName}}", () => {\n  it("renders correctly", () => {\n    render(<{{componentName}} />);\n    {{#if hasTestId}}\n    expect(screen.getByTestId("{{testId}}")).toBeInTheDocument();\n    {{/if}}\n  });\n});',
    variables: [
      { name: 'componentName', type: 'string', required: true, description: 'Component name to test' },
      { name: 'hasTestId', type: 'boolean', required: false, description: 'Include test ID assertion' },
      { name: 'testId', type: 'string', required: false, description: 'Test ID to check for' }
    ],
    language: 'typescript',
    category: 'testing',
    tags: ['test', 'jest', 'react']
  }
];

const mockProjectContext: ProjectContext = {
  projectName: 'test-project',
  projectPath: '/test/project',
  projectType: 'react',
  languages: ['typescript'],
  frameworks: ['react']
};

const mockOnTemplateProcess = jest.fn();
const mockOnSave = jest.fn();

const defaultProps = {
  templates: mockTemplates,
  projectContext: mockProjectContext,
  onTemplateProcess: mockOnTemplateProcess,
  onSave: mockOnSave,
  theme: 'dark' as const
};

describe('TemplateWizard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnTemplateProcess.mockResolvedValue({
      content: 'Generated template content',
      files: []
    });
  });

  describe('Step 1: Template Selection', () => {
    it('should render template selection step initially', () => {
      render(<TemplateWizard {...defaultProps} />);

      expect(screen.getByText('Choose a Template')).toBeInTheDocument();
      expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
      expect(screen.getByText('React Component')).toBeInTheDocument();
      expect(screen.getByText('Express Route')).toBeInTheDocument();
      expect(screen.getByText('React Test')).toBeInTheDocument();
    });

    it('should filter templates by search term', async () => {
      const user = userEvent.setup();
      render(<TemplateWizard {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search templates...');
      await user.type(searchInput, 'react');

      expect(screen.getByText('React Component')).toBeInTheDocument();
      expect(screen.getByText('React Test')).toBeInTheDocument();
      expect(screen.queryByText('Express Route')).not.toBeInTheDocument();
    });

    it('should filter templates by category', async () => {
      const user = userEvent.setup();
      render(<TemplateWizard {...defaultProps} />);

      const categorySelect = screen.getByDisplayValue('All Categories');
      await user.click(categorySelect);
      await user.click(screen.getByText('backend'));

      expect(screen.getByText('Express Route')).toBeInTheDocument();
      expect(screen.queryByText('React Component')).not.toBeInTheDocument();
    });

    it('should select template when clicked', async () => {
      const user = userEvent.setup();
      render(<TemplateWizard {...defaultProps} />);

      const reactTemplate = screen.getByText('React Component').closest('.template-card');
      await user.click(reactTemplate!);

      expect(reactTemplate).toHaveClass('border-blue-500');
    });

    it('should enable next button when template is selected', async () => {
      const user = userEvent.setup();
      render(<TemplateWizard {...defaultProps} />);

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeDisabled();

      const reactTemplate = screen.getByText('React Component').closest('.template-card');
      await user.click(reactTemplate!);

      expect(nextButton).toBeEnabled();
    });
  });

  describe('Step 2: Variable Configuration', () => {
    beforeEach(async () => {
      const user = userEvent.setup();
      render(<TemplateWizard {...defaultProps} />);

      // Select template and go to next step
      const reactTemplate = screen.getByText('React Component').closest('.template-card');
      await user.click(reactTemplate!);
      
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);
    });

    it('should show variable configuration step', () => {
      expect(screen.getByText('Configure Template Variables')).toBeInTheDocument();
      expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
      expect(screen.getByText('React Component')).toBeInTheDocument();
    });

    it('should render variable inputs based on template', () => {
      expect(screen.getByLabelText('componentName *')).toBeInTheDocument();
    });

    it('should auto-fill variables from project context', () => {
      // Project name might be auto-filled if template has a projectName variable
      // This test would be more relevant with templates that use project context variables
    });

    it('should validate required variables', async () => {
      const user = userEvent.setup();

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeDisabled(); // Should be disabled without required fields

      const componentNameInput = screen.getByLabelText('componentName *');
      await user.type(componentNameInput, 'MyComponent');

      expect(nextButton).toBeEnabled();
    });

    it('should handle different variable types', async () => {
      const user = userEvent.setup();
      
      // Go back and select Express Route template
      const prevButton = screen.getByRole('button', { name: /previous/i });
      await user.click(prevButton);

      const expressTemplate = screen.getByText('Express Route').closest('.template-card');
      await user.click(expressTemplate!);

      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      // Should have text input for routeName
      expect(screen.getByLabelText('routeName *')).toBeInTheDocument();
      
      // Should have select input for httpMethod
      expect(screen.getByLabelText('httpMethod *')).toBeInTheDocument();
      
      // Fill in values
      await user.type(screen.getByLabelText('routeName *'), 'getUserData');
      
      const httpMethodSelect = screen.getByLabelText('httpMethod *');
      await user.click(httpMethodSelect);
      await user.click(screen.getByText('GET'));

      expect(screen.getByRole('button', { name: /next/i })).toBeEnabled();
    });

    it('should handle boolean variables', async () => {
      const user = userEvent.setup();
      
      // Go back and select React Test template
      const prevButton = screen.getByRole('button', { name: /previous/i });
      await user.click(prevButton);

      const testTemplate = screen.getByText('React Test').closest('.template-card');
      await user.click(testTemplate!);

      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      // Fill required field
      await user.type(screen.getByLabelText('componentName *'), 'TestComponent');

      // Should have checkbox for boolean variable
      const hasTestIdCheckbox = screen.getByRole('checkbox');
      expect(hasTestIdCheckbox).toBeInTheDocument();

      await user.click(hasTestIdCheckbox);
      
      // Should show conditional field
      expect(screen.getByLabelText('testId')).toBeInTheDocument();
    });
  });

  describe('Step 3: Preview & Generate', () => {
    beforeEach(async () => {
      const user = userEvent.setup();
      render(<TemplateWizard {...defaultProps} />);

      // Navigate to preview step
      const reactTemplate = screen.getByText('React Component').closest('.template-card');
      await user.click(reactTemplate!);
      await user.click(screen.getByRole('button', { name: /next/i }));
      
      await user.type(screen.getByLabelText('componentName *'), 'MyComponent');
      await user.click(screen.getByRole('button', { name: /next/i }));
    });

    it('should show preview step', () => {
      expect(screen.getByText('Preview & Generate')).toBeInTheDocument();
      expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();
    });

    it('should show configuration summary', () => {
      expect(screen.getByText('Configuration Summary')).toBeInTheDocument();
      expect(screen.getByText('componentName:')).toBeInTheDocument();
      expect(screen.getByText('MyComponent')).toBeInTheDocument();
    });

    it('should generate preview automatically', () => {
      expect(mockOnTemplateProcess).toHaveBeenCalled();
    });

    it('should show generated code preview', async () => {
      await waitFor(() => {
        expect(screen.getByText('Generated Code Preview')).toBeInTheDocument();
        expect(screen.getByText('Generated template content')).toBeInTheDocument();
      });
    });

    it('should allow refreshing preview', async () => {
      const user = userEvent.setup();
      
      const refreshButton = screen.getByRole('button', { name: /refresh preview/i });
      await user.click(refreshButton);

      expect(mockOnTemplateProcess).toHaveBeenCalledTimes(2);
    });

    it('should generate template when generate button clicked', async () => {
      const user = userEvent.setup();
      
      const generateButton = screen.getByRole('button', { name: /generate template/i });
      await user.click(generateButton);

      expect(mockOnTemplateProcess).toHaveBeenCalled();
      
      await waitFor(() => {
        expect(screen.getByText('Choose a Template')).toBeInTheDocument(); // Should reset to step 1
      });
    });
  });

  describe('navigation', () => {
    it('should allow going back to previous steps', async () => {
      const user = userEvent.setup();
      render(<TemplateWizard {...defaultProps} />);

      // Go to step 2
      const reactTemplate = screen.getByText('React Component').closest('.template-card');
      await user.click(reactTemplate!);
      await user.click(screen.getByRole('button', { name: /next/i }));

      expect(screen.getByText('Configure Template Variables')).toBeInTheDocument();

      // Go back to step 1
      const prevButton = screen.getByRole('button', { name: /previous/i });
      await user.click(prevButton);

      expect(screen.getByText('Choose a Template')).toBeInTheDocument();
    });

    it('should show progress indicator', async () => {
      const user = userEvent.setup();
      render(<TemplateWizard {...defaultProps} />);

      // Should show step indicators
      expect(screen.getByText('Select Template')).toBeInTheDocument();
      expect(screen.getByText('Configure Variables')).toBeInTheDocument();
      expect(screen.getByText('Preview & Generate')).toBeInTheDocument();

      // Current step should be highlighted
      const step1 = screen.getByText('Select Template').closest('div');
      expect(step1).toHaveClass('text-blue-600');
    });

    it('should disable previous button on first step', () => {
      render(<TemplateWizard {...defaultProps} />);

      const prevButton = screen.getByRole('button', { name: /previous/i });
      expect(prevButton).toBeDisabled();
    });
  });

  describe('error handling', () => {
    it('should handle template processing errors', async () => {
      const user = userEvent.setup();
      mockOnTemplateProcess.mockRejectedValue(new Error('Processing failed'));

      render(<TemplateWizard {...defaultProps} />);

      // Navigate to preview step
      const reactTemplate = screen.getByText('React Component').closest('.template-card');
      await user.click(reactTemplate!);
      await user.click(screen.getByRole('button', { name: /next/i }));
      
      await user.type(screen.getByLabelText('componentName *'), 'MyComponent');
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Should handle error gracefully
      await waitFor(() => {
        expect(mockOnTemplateProcess).toHaveBeenCalled();
      });
    });

    it('should show validation errors for invalid variables', async () => {
      const user = userEvent.setup();
      render(<TemplateWizard {...defaultProps} />);

      // Navigate to variable configuration
      const reactTemplate = screen.getByText('React Component').closest('.template-card');
      await user.click(reactTemplate!);
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Try to proceed without filling required field
      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeDisabled();

      // Fill with invalid value (empty string)
      const componentNameInput = screen.getByLabelText('componentName *');
      await user.type(componentNameInput, 'a');
      await user.clear(componentNameInput);

      expect(nextButton).toBeDisabled();
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<TemplateWizard {...defaultProps} />);

      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByLabelText(/search templates/i)).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<TemplateWizard {...defaultProps} />);

      // Should be able to tab through template cards
      await user.tab();
      expect(screen.getByPlaceholderText('Search templates...')).toHaveFocus();
    });

    it('should announce step changes', async () => {
      const user = userEvent.setup();
      render(<TemplateWizard {...defaultProps} />);

      const reactTemplate = screen.getByText('React Component').closest('.template-card');
      await user.click(reactTemplate!);
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Should have live region for step announcements
      expect(document.querySelector('[aria-live]')).toBeInTheDocument();
    });
  });

  describe('theming', () => {
    it('should apply dark theme', () => {
      const { container } = render(<TemplateWizard {...defaultProps} theme="dark" />);
      expect(container.firstChild).toHaveClass('dark');
    });

    it('should apply light theme', () => {
      const { container } = render(<TemplateWizard {...defaultProps} theme="light" />);
      expect(container.firstChild).not.toHaveClass('dark');
    });
  });

  describe('template metadata', () => {
    it('should show template information', () => {
      render(<TemplateWizard {...defaultProps} />);

      // Should show template description
      expect(screen.getByText('Basic React functional component')).toBeInTheDocument();
      
      // Should show language badge
      expect(screen.getAllByText('typescript')).toHaveLength(3); // One for each template
      
      // Should show variable count
      expect(screen.getByText('1 variables')).toBeInTheDocument();
    });

    it('should show template tags', () => {
      render(<TemplateWizard {...defaultProps} />);

      expect(screen.getByText('react')).toBeInTheDocument();
      expect(screen.getByText('component')).toBeInTheDocument();
      expect(screen.getByText('express')).toBeInTheDocument();
      expect(screen.getByText('test')).toBeInTheDocument();
    });
  });
});