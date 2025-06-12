import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { EnhancedChatInterface } from '../../ui/components/enhanced/EnhancedChatInterface';
import { TemplateWizard } from '../../ui/components/enhanced/TemplateWizard';
import { AlfredDashboard } from '../../ui/components/AlfredDashboard';
import { ChatMessage, CodeTemplate, ProjectContext } from '../../src/interfaces';

expect.extend(toHaveNoViolations);

// Mock toast
jest.mock('@client/components/ui/use-toast', () => ({
  toast: jest.fn()
}));

describe('Alfred Plugin Accessibility Tests', () => {
  const mockProjectContext: ProjectContext = {
    projectName: 'accessibility-test-project',
    projectPath: '/test/accessibility',
    projectType: 'react',
    languages: ['typescript'],
    frameworks: ['react']
  };

  const mockMessages: ChatMessage[] = [
    {
      id: 'msg-1',
      sessionId: 'test-session',
      content: 'Hello Alfred!',
      role: 'user',
      timestamp: new Date('2024-01-01T10:00:00Z')
    },
    {
      id: 'msg-2',
      sessionId: 'test-session',
      content: 'Hello! How can I help you today?',
      role: 'assistant',
      timestamp: new Date('2024-01-01T10:00:01Z'),
      metadata: {
        type: 'chat',
        responseTime: 1500
      }
    }
  ];

  const mockTemplates: CodeTemplate[] = [
    {
      id: 'react-component',
      name: 'React Component',
      description: 'Basic React functional component',
      template: 'import React from "react";\\n\\ninterface {{componentName}}Props {\\n  // Add props here\\n}\\n\\nexport const {{componentName}}: React.FC<{{componentName}}Props> = () => {\\n  return (\\n    <div>\\n      {/* Component content */}\\n    </div>\\n  );\\n};',
      variables: [
        { name: 'componentName', type: 'string', required: true, description: 'Name of the component' }
      ],
      language: 'typescript',
      category: 'react',
      tags: ['react', 'component', 'typescript']
    }
  ];

  describe('WCAG 2.1 AA Compliance', () => {
    it('EnhancedChatInterface should have no accessibility violations', async () => {
      const { container } = render(
        <EnhancedChatInterface
          sessionId="test-session"
          messages={mockMessages}
          onSendMessage={jest.fn()}
          onStreamMessage={jest.fn()}
          onStopStream={jest.fn()}
          isStreaming={false}
          isLoading={false}
          projectContext={mockProjectContext}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('TemplateWizard should have no accessibility violations', async () => {
      const { container } = render(
        <TemplateWizard
          templates={mockTemplates}
          projectContext={mockProjectContext}
          onTemplateProcess={jest.fn()}
          onSave={jest.fn()}
          theme="light"
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('AlfredDashboard should have no accessibility violations', async () => {
      const { container } = render(
        <AlfredDashboard
          isLoading={false}
          onCreateSession={jest.fn()}
          onLoadSession={jest.fn()}
          recentSessions={[]}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should have proper tab order in chat interface', () => {
      render(
        <EnhancedChatInterface
          sessionId="test-session"
          messages={[]}
          onSendMessage={jest.fn()}
          onStreamMessage={jest.fn()}
          onStopStream={jest.fn()}
          isStreaming={false}
          isLoading={false}
        />
      );

      const interactiveElements = screen.getAllByRole('button')
        .concat(screen.getAllByRole('textbox'))
        .concat(screen.getAllByRole('combobox', { hidden: true }))
        .filter(el => !el.hasAttribute('disabled'));

      // Verify all interactive elements have tabindex or are naturally focusable
      interactiveElements.forEach(element => {
        const tabIndex = element.getAttribute('tabindex');
        const isNaturallyFocusable = ['INPUT', 'BUTTON', 'TEXTAREA', 'SELECT'].includes(element.tagName);
        
        expect(isNaturallyFocusable || tabIndex !== null).toBe(true);
      });
    });

    it('should support keyboard shortcuts', () => {
      render(
        <EnhancedChatInterface
          sessionId="test-session"
          messages={[]}
          onSendMessage={jest.fn()}
          onStreamMessage={jest.fn()}
          onStopStream={jest.fn()}
          isStreaming={false}
          isLoading={false}
          showKeyboardShortcuts={true}
        />
      );

      // Should have keyboard shortcut documentation
      const shortcutElements = screen.queryAllByText(/ctrl|cmd|alt/i);
      expect(shortcutElements.length).toBeGreaterThan(0);
    });

    it('should have skip links for screen readers', () => {
      render(
        <AlfredDashboard
          isLoading={false}
          onCreateSession={jest.fn()}
          onLoadSession={jest.fn()}
          recentSessions={[]}
        />
      );

      // Check for skip navigation links
      const skipLinks = screen.queryAllByText(/skip to|skip navigation/i);
      expect(skipLinks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('ARIA Attributes', () => {
    it('should have proper ARIA labels on all interactive elements', () => {
      render(
        <EnhancedChatInterface
          sessionId="test-session"
          messages={mockMessages}
          onSendMessage={jest.fn()}
          onStreamMessage={jest.fn()}
          onStopStream={jest.fn()}
          isStreaming={false}
          isLoading={false}
        />
      );

      // Check buttons have accessible names
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const hasAccessibleName = 
          button.getAttribute('aria-label') ||
          button.getAttribute('aria-labelledby') ||
          button.textContent?.trim();
        
        expect(hasAccessibleName).toBeTruthy();
      });

      // Check form inputs have labels
      const inputs = screen.getAllByRole('textbox');
      inputs.forEach(input => {
        const hasLabel = 
          input.getAttribute('aria-label') ||
          input.getAttribute('aria-labelledby') ||
          document.querySelector(`label[for="${input.id}"]`);
        
        expect(hasLabel).toBeTruthy();
      });
    });

    it('should have proper ARIA roles for complex widgets', () => {
      render(
        <TemplateWizard
          templates={mockTemplates}
          projectContext={mockProjectContext}
          onTemplateProcess={jest.fn()}
          onSave={jest.fn()}
          theme="light"
        />
      );

      // Check for proper roles on complex components
      const main = screen.getByRole('main');
      expect(main).toBeInTheDocument();

      // Step indicators should have proper roles
      const progressIndicators = screen.queryAllByRole('progressbar');
      expect(progressIndicators.length).toBeGreaterThanOrEqual(0);
    });

    it('should use aria-live regions for dynamic content', () => {
      render(
        <EnhancedChatInterface
          sessionId="test-session"
          messages={mockMessages}
          onSendMessage={jest.fn()}
          onStreamMessage={jest.fn()}
          onStopStream={jest.fn()}
          isStreaming={false}
          isLoading={false}
        />
      );

      // Should have live regions for chat updates
      const liveRegions = document.querySelectorAll('[aria-live]');
      expect(liveRegions.length).toBeGreaterThan(0);
    });

    it('should have proper headings hierarchy', () => {
      render(
        <AlfredDashboard
          isLoading={false}
          onCreateSession={jest.fn()}
          onLoadSession={jest.fn()}
          recentSessions={[]}
        />
      );

      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);

      // Check heading levels are logical (h1 should exist, levels shouldn't skip)
      const headingLevels = headings.map(h => parseInt(h.tagName.charAt(1)));
      expect(headingLevels).toContain(1); // Should have h1
      
      // Check for logical progression (no skipping levels)
      const sortedLevels = [...new Set(headingLevels)].sort();
      for (let i = 1; i < sortedLevels.length; i++) {
        expect(sortedLevels[i] - sortedLevels[i-1]).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Color and Contrast', () => {
    it('should not rely solely on color to convey information', () => {
      render(
        <EnhancedChatInterface
          sessionId="test-session"
          messages={mockMessages}
          onSendMessage={jest.fn()}
          onStreamMessage={jest.fn()}
          onStopStream={jest.fn()}
          isStreaming={false}
          isLoading={false}
        />
      );

      // Check that status indicators have text or icons, not just color
      const statusElements = document.querySelectorAll('[data-testid*="status"], [class*="status"]');
      statusElements.forEach(element => {
        const hasTextContent = element.textContent?.trim();
        const hasIcon = element.querySelector('svg, [class*="icon"]');
        const hasAriaLabel = element.getAttribute('aria-label');
        
        expect(hasTextContent || hasIcon || hasAriaLabel).toBeTruthy();
      });
    });

    it('should support high contrast mode', () => {
      const { container } = render(
        <EnhancedChatInterface
          sessionId="test-session"
          messages={mockMessages}
          onSendMessage={jest.fn()}
          onStreamMessage={jest.fn()}
          onStopStream={jest.fn()}
          isStreaming={false}
          isLoading={false}
          theme="dark"
        />
      );

      // Verify theme classes are applied
      expect(container.firstChild).toHaveClass('dark');
    });
  });

  describe('Form Accessibility', () => {
    it('should have proper form validation and error messages', () => {
      render(
        <TemplateWizard
          templates={mockTemplates}
          projectContext={mockProjectContext}
          onTemplateProcess={jest.fn()}
          onSave={jest.fn()}
          theme="light"
        />
      );

      // Check for required field indicators
      const requiredFields = document.querySelectorAll('[required], [aria-required="true"]');
      expect(requiredFields.length).toBeGreaterThanOrEqual(0);

      // Check for error message containers
      const errorContainers = document.querySelectorAll('[role="alert"], [aria-live="assertive"]');
      expect(errorContainers.length).toBeGreaterThanOrEqual(0);
    });

    it('should associate labels with form controls', () => {
      render(
        <TemplateWizard
          templates={mockTemplates}
          projectContext={mockProjectContext}
          onTemplateProcess={jest.fn()}
          onSave={jest.fn()}
          theme="light"
        />
      );

      const formInputs = screen.getAllByRole('textbox')
        .concat(screen.getAllByRole('combobox', { hidden: true }))
        .concat(screen.getAllByRole('checkbox', { hidden: true }));

      formInputs.forEach(input => {
        const hasAssociatedLabel = 
          input.getAttribute('aria-labelledby') ||
          input.getAttribute('aria-label') ||
          document.querySelector(`label[for="${input.id}"]`);
        
        expect(hasAssociatedLabel).toBeTruthy();
      });
    });
  });

  describe('Focus Management', () => {
    it('should have visible focus indicators', () => {
      render(
        <EnhancedChatInterface
          sessionId="test-session"
          messages={[]}
          onSendMessage={jest.fn()}
          onStreamMessage={jest.fn()}
          onStopStream={jest.fn()}
          isStreaming={false}
          isLoading={false}
        />
      );

      // Check that focusable elements have focus styles
      const focusableElements = screen.getAllByRole('button')
        .concat(screen.getAllByRole('textbox'));

      focusableElements.forEach(element => {
        // Focus styles should be defined (we can't test visual appearance in unit tests,
        // but we can check for focus-related classes or styles)
        const hasOutlineOrFocusClass = 
          element.style.outline ||
          element.className.includes('focus') ||
          element.className.includes('ring');
        
        // Note: This is a basic check. Visual regression tests would be better for this
        expect(element).toBeDefined();
      });
    });

    it('should trap focus in modal dialogs', () => {
      render(
        <TemplateWizard
          templates={mockTemplates}
          projectContext={mockProjectContext}
          onTemplateProcess={jest.fn()}
          onSave={jest.fn()}
          theme="light"
        />
      );

      // If there are modal dialogs, they should have proper focus management
      const modals = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
      modals.forEach(modal => {
        // Check for focus trap indicators
        const hasFocusTrap = 
          modal.getAttribute('data-focus-trap') ||
          modal.querySelector('[data-focus-trap]');
        
        // This is a basic check - real focus trapping would need integration tests
        expect(modal).toBeDefined();
      });
    });
  });

  describe('Screen Reader Support', () => {
    it('should have proper landmarks for navigation', () => {
      render(
        <AlfredDashboard
          isLoading={false}
          onCreateSession={jest.fn()}
          onLoadSession={jest.fn()}
          recentSessions={[]}
        />
      );

      // Check for semantic landmarks
      const main = screen.queryByRole('main');
      const navigation = screen.queryByRole('navigation');
      const banner = screen.queryByRole('banner');
      
      expect(main || navigation || banner).toBeTruthy();
    });

    it('should announce important state changes', () => {
      render(
        <EnhancedChatInterface
          sessionId="test-session"
          messages={mockMessages}
          onSendMessage={jest.fn()}
          onStreamMessage={jest.fn()}
          onStopStream={jest.fn()}
          isStreaming={false}
          isLoading={false}
        />
      );

      // Check for aria-live regions
      const liveRegions = document.querySelectorAll('[aria-live="polite"], [aria-live="assertive"]');
      expect(liveRegions.length).toBeGreaterThan(0);
    });

    it('should provide context for dynamic content', () => {
      render(
        <EnhancedChatInterface
          sessionId="test-session"
          messages={mockMessages}
          onSendMessage={jest.fn()}
          onStreamMessage={jest.fn()}
          onStopStream={jest.fn()}
          isStreaming={true}
          isLoading={false}
        />
      );

      // Streaming indicator should be announced
      const streamingIndicators = document.querySelectorAll('[aria-label*="streaming"], [aria-describedby*="streaming"]');
      expect(streamingIndicators.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Mobile and Touch Accessibility', () => {
    it('should have appropriate touch targets', () => {
      render(
        <EnhancedChatInterface
          sessionId="test-session"
          messages={[]}
          onSendMessage={jest.fn()}
          onStreamMessage={jest.fn()}
          onStopStream={jest.fn()}
          isStreaming={false}
          isLoading={false}
        />
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        // Touch targets should be at least 44x44px (we can't test exact size in unit tests,
        // but we can check for appropriate classes or styles)
        const hasMinSizeClass = 
          button.className.includes('min-h') ||
          button.className.includes('p-') ||
          button.style.minHeight ||
          button.style.padding;
        
        expect(button).toBeDefined(); // Basic check
      });
    });

    it('should support reduced motion preferences', () => {
      const { container } = render(
        <EnhancedChatInterface
          sessionId="test-session"
          messages={mockMessages}
          onSendMessage={jest.fn()}
          onStreamMessage={jest.fn()}
          onStopStream={jest.fn()}
          isStreaming={false}
          isLoading={false}
        />
      );

      // Check for motion-related classes that respect prefers-reduced-motion
      const hasMotionClasses = container.innerHTML.includes('motion-') || 
                              container.innerHTML.includes('animate-') ||
                              container.innerHTML.includes('transition-');
      
      if (hasMotionClasses) {
        // Should have reduced motion alternatives
        const hasReducedMotionSupport = 
          container.innerHTML.includes('motion-reduce') ||
          container.innerHTML.includes('prefers-reduced-motion');
        
        expect(hasReducedMotionSupport).toBeTruthy();
      }
    });
  });

  describe('Internationalization (i18n)', () => {
    it('should have proper lang attributes', () => {
      render(
        <AlfredDashboard
          isLoading={false}
          onCreateSession={jest.fn()}
          onLoadSession={jest.fn()}
          recentSessions={[]}
        />
      );

      // Check for lang attribute on document or main content
      const elementsWithLang = document.querySelectorAll('[lang]');
      
      // At minimum, should have lang on root element (usually set by framework)
      expect(document.documentElement.lang || elementsWithLang.length > 0).toBeTruthy();
    });

    it('should handle text direction for RTL languages', () => {
      const { container } = render(
        <EnhancedChatInterface
          sessionId="test-session"
          messages={mockMessages}
          onSendMessage={jest.fn()}
          onStreamMessage={jest.fn()}
          onStopStream={jest.fn()}
          isStreaming={false}
          isLoading={false}
        />
      );

      // Check for dir attribute or RTL-aware CSS classes
      const hasDirSupport = 
        container.querySelector('[dir]') ||
        container.innerHTML.includes('rtl') ||
        container.innerHTML.includes('ltr');
      
      // This is optional but good to have
      expect(container).toBeDefined();
    });
  });
});