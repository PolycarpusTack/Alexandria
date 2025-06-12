import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EnhancedChatInterface } from '../../../ui/components/enhanced/EnhancedChatInterface';
import { ChatMessage, StreamChunk } from '../../../src/interfaces';

// Mock toast
jest.mock('@client/components/ui/use-toast', () => ({
  toast: jest.fn()
}));

// Mock dependencies
const mockSendMessage = jest.fn();
const mockStreamMessage = jest.fn();
const mockStopStream = jest.fn();

const defaultProps = {
  sessionId: 'test-session-123',
  messages: [] as ChatMessage[],
  onSendMessage: mockSendMessage,
  onStreamMessage: mockStreamMessage,
  onStopStream: mockStopStream,
  isStreaming: false,
  isLoading: false
};

const mockMessages: ChatMessage[] = [
  {
    id: 'msg-1',
    sessionId: 'test-session-123',
    content: 'Hello Alfred!',
    role: 'user',
    timestamp: new Date('2024-01-01T10:00:00Z')
  },
  {
    id: 'msg-2',
    sessionId: 'test-session-123',
    content: 'Hello! How can I help you today?',
    role: 'assistant',
    timestamp: new Date('2024-01-01T10:00:01Z'),
    metadata: {
      type: 'chat',
      responseTime: 1500
    }
  },
  {
    id: 'msg-3',
    sessionId: 'test-session-123',
    content: 'Can you generate a React component?',
    role: 'user',
    timestamp: new Date('2024-01-01T10:01:00Z')
  },
  {
    id: 'msg-4',
    sessionId: 'test-session-123',
    content: '```typescript\nimport React from "react";\n\nconst Button = () => {\n  return <button>Click me</button>;\n};\n\nexport default Button;\n```\n\nHere\'s a simple React button component.',
    role: 'assistant',
    timestamp: new Date('2024-01-01T10:01:05Z'),
    metadata: {
      type: 'code-generation',
      responseTime: 3000
    }
  }
];

describe('EnhancedChatInterface', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render chat interface with empty state', () => {
      render(<EnhancedChatInterface {...defaultProps} />);

      expect(screen.getByText('Alfred Assistant')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/type your message/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
    });

    it('should display project context badge when provided', () => {
      const projectContext = {
        projectName: 'test-project',
        projectPath: '/test/project',
        projectType: 'react',
        languages: ['typescript']
      };

      render(
        <EnhancedChatInterface 
          {...defaultProps} 
          projectContext={projectContext}
        />
      );

      expect(screen.getByText('test-project')).toBeInTheDocument();
    });

    it('should render existing messages', () => {
      render(<EnhancedChatInterface {...defaultProps} messages={mockMessages} />);

      expect(screen.getByText('Hello Alfred!')).toBeInTheDocument();
      expect(screen.getByText('Hello! How can I help you today?')).toBeInTheDocument();
      expect(screen.getByText('Can you generate a React component?')).toBeInTheDocument();
    });

    it('should render code blocks in messages', () => {
      render(<EnhancedChatInterface {...defaultProps} messages={mockMessages} />);

      // Should render code block
      expect(screen.getByText('import React from "react";')).toBeInTheDocument();
      expect(screen.getByText('typescript')).toBeInTheDocument(); // Language badge
    });

    it('should show message metadata', () => {
      render(<EnhancedChatInterface {...defaultProps} messages={mockMessages} />);

      expect(screen.getByText('code-generation')).toBeInTheDocument();
      expect(screen.getByText('3000ms')).toBeInTheDocument();
    });
  });

  describe('message input', () => {
    it('should handle text input', async () => {
      const user = userEvent.setup();
      render(<EnhancedChatInterface {...defaultProps} />);

      const input = screen.getByPlaceholderText(/type your message/i);
      await user.type(input, 'Hello Alfred');

      expect(input).toHaveValue('Hello Alfred');
    });

    it('should send message on send button click', async () => {
      const user = userEvent.setup();
      mockSendMessage.mockResolvedValue(undefined);

      render(<EnhancedChatInterface {...defaultProps} />);

      const input = screen.getByPlaceholderText(/type your message/i);
      const sendButton = screen.getByRole('button', { name: /send message/i });

      await user.type(input, 'Test message');
      await user.click(sendButton);

      expect(mockSendMessage).toHaveBeenCalledWith('Test message');
      expect(input).toHaveValue(''); // Input should be cleared
    });

    it('should send message on Enter key press', async () => {
      const user = userEvent.setup();
      mockSendMessage.mockResolvedValue(undefined);

      render(<EnhancedChatInterface {...defaultProps} />);

      const input = screen.getByPlaceholderText(/type your message/i);
      await user.type(input, 'Test message{enter}');

      expect(mockSendMessage).toHaveBeenCalledWith('Test message');
    });

    it('should send message on Ctrl+Enter', async () => {
      const user = userEvent.setup();
      mockSendMessage.mockResolvedValue(undefined);

      render(<EnhancedChatInterface {...defaultProps} />);

      const input = screen.getByPlaceholderText(/type your message/i);
      await user.type(input, 'Test message');
      await user.keyboard('{Control>}{Enter}{/Control}');

      expect(mockSendMessage).toHaveBeenCalledWith('Test message');
    });

    it('should create new line on Shift+Enter', async () => {
      const user = userEvent.setup();

      render(<EnhancedChatInterface {...defaultProps} />);

      const input = screen.getByPlaceholderText(/type your message/i) as HTMLTextAreaElement;
      await user.type(input, 'Line 1{Shift>}{Enter}{/Shift}Line 2');

      expect(input.value).toBe('Line 1\nLine 2');
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('should not send empty messages', async () => {
      const user = userEvent.setup();

      render(<EnhancedChatInterface {...defaultProps} />);

      const sendButton = screen.getByRole('button', { name: /send message/i });
      await user.click(sendButton);

      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('should disable input and button when loading', () => {
      render(<EnhancedChatInterface {...defaultProps} isLoading={true} />);

      const input = screen.getByPlaceholderText(/type your message/i);
      const sendButton = screen.getByRole('button', { name: /send message/i });

      expect(input).toBeDisabled();
      expect(sendButton).toBeDisabled();
    });
  });

  describe('keyboard shortcuts', () => {
    it('should clear input on Ctrl+K', async () => {
      const user = userEvent.setup();

      render(<EnhancedChatInterface {...defaultProps} />);

      const input = screen.getByPlaceholderText(/type your message/i);
      await user.type(input, 'Some text');
      await user.keyboard('{Control>}k{/Control}');

      expect(input).toHaveValue('');
    });

    it('should show keyboard shortcuts on Ctrl+/', async () => {
      const user = userEvent.setup();

      render(<EnhancedChatInterface {...defaultProps} showKeyboardShortcuts={true} />);

      await user.keyboard('{Control>}/{/Control}');

      await waitFor(() => {
        expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
      });
    });

    it('should close shortcuts overlay on Escape', async () => {
      const user = userEvent.setup();

      render(<EnhancedChatInterface {...defaultProps} showKeyboardShortcuts={true} />);

      // Open shortcuts
      await user.keyboard('{Control>}/{/Control}');
      await waitFor(() => {
        expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
      });

      // Close with Escape
      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
      });
    });
  });

  describe('streaming', () => {
    it('should show streaming indicator when streaming', () => {
      render(<EnhancedChatInterface {...defaultProps} isStreaming={true} />);

      expect(screen.getByRole('button', { name: /stop streaming/i })).toBeInTheDocument();
    });

    it('should call stop stream function when stop button clicked', async () => {
      const user = userEvent.setup();

      render(<EnhancedChatInterface {...defaultProps} isStreaming={true} />);

      const stopButton = screen.getByRole('button', { name: /stop streaming/i });
      await user.click(stopButton);

      expect(mockStopStream).toHaveBeenCalled();
    });

    it('should stop streaming on Escape key', async () => {
      const user = userEvent.setup();

      render(<EnhancedChatInterface {...defaultProps} isStreaming={true} />);

      await user.keyboard('{Escape}');

      expect(mockStopStream).toHaveBeenCalled();
    });

    it('should handle streaming messages with onStreamMessage', async () => {
      const user = userEvent.setup();
      
      // Mock streaming iterator
      const mockStreamIterator = {
        async *[Symbol.asyncIterator]() {
          yield { content: 'Hello ', done: false, metadata: {} };
          yield { content: 'world!', done: true, metadata: {} };
        }
      };

      mockStreamMessage.mockReturnValue(mockStreamIterator);

      render(<EnhancedChatInterface {...defaultProps} onStreamMessage={mockStreamMessage} />);

      const input = screen.getByPlaceholderText(/type your message/i);
      await user.type(input, 'Test streaming');
      await user.keyboard('{Enter}');

      expect(mockStreamMessage).toHaveBeenCalledWith('Test streaming');
    });
  });

  describe('actions', () => {
    it('should download chat when download button clicked', async () => {
      const user = userEvent.setup();
      
      // Mock URL.createObjectURL and other DOM APIs
      global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = jest.fn();
      
      const mockLink = {
        click: jest.fn(),
        href: '',
        download: ''
      };
      document.createElement = jest.fn().mockReturnValue(mockLink);
      document.body.appendChild = jest.fn();
      document.body.removeChild = jest.fn();

      render(<EnhancedChatInterface {...defaultProps} messages={mockMessages} />);

      const downloadButton = screen.getByRole('button', { name: /download chat/i });
      await user.click(downloadButton);

      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(mockLink.click).toHaveBeenCalled();
    });

    it('should copy code when copy button clicked', async () => {
      const user = userEvent.setup();
      
      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn().mockResolvedValue(undefined)
        }
      });

      render(<EnhancedChatInterface {...defaultProps} messages={mockMessages} />);

      const copyButton = screen.getAllByRole('button', { name: /copy to clipboard/i })[0];
      await user.click(copyButton);

      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<EnhancedChatInterface {...defaultProps} />);

      const input = screen.getByPlaceholderText(/type your message/i);
      const sendButton = screen.getByRole('button', { name: /send message/i });

      expect(input).toHaveAccessibleName();
      expect(sendButton).toHaveAccessibleName();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();

      render(<EnhancedChatInterface {...defaultProps} />);

      // Tab to input
      await user.tab();
      expect(screen.getByPlaceholderText(/type your message/i)).toHaveFocus();

      // Tab to send button
      await user.tab();
      expect(screen.getByRole('button', { name: /send message/i })).toHaveFocus();
    });

    it('should announce important actions to screen readers', async () => {
      const user = userEvent.setup();
      mockSendMessage.mockResolvedValue(undefined);

      render(<EnhancedChatInterface {...defaultProps} />);

      const input = screen.getByPlaceholderText(/type your message/i);
      await user.type(input, 'Test message');
      await user.keyboard('{Enter}');

      // Should have aria-live region for announcements
      expect(document.querySelector('[aria-live]')).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('should handle send message errors gracefully', async () => {
      const user = userEvent.setup();
      mockSendMessage.mockRejectedValue(new Error('Network error'));

      render(<EnhancedChatInterface {...defaultProps} />);

      const input = screen.getByPlaceholderText(/type your message/i);
      await user.type(input, 'Test message');
      await user.keyboard('{Enter}');

      // Should show error message or handle gracefully
      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalled();
      });
    });

    it('should handle streaming errors', async () => {
      const user = userEvent.setup();
      
      const mockErrorIterator = {
        async *[Symbol.asyncIterator]() {
          throw new Error('Streaming error');
        }
      };

      mockStreamMessage.mockReturnValue(mockErrorIterator);

      render(<EnhancedChatInterface {...defaultProps} onStreamMessage={mockStreamMessage} />);

      const input = screen.getByPlaceholderText(/type your message/i);
      await user.type(input, 'Test streaming');
      await user.keyboard('{Enter}');

      // Should handle the error gracefully
      await waitFor(() => {
        expect(mockStreamMessage).toHaveBeenCalled();
      });
    });
  });

  describe('message display', () => {
    it('should show timestamps in readable format', () => {
      render(<EnhancedChatInterface {...defaultProps} messages={mockMessages} />);

      // Should show formatted timestamps
      expect(screen.getByText(/10:00:00/)).toBeInTheDocument();
      expect(screen.getByText(/10:01:05/)).toBeInTheDocument();
    });

    it('should distinguish between user and assistant messages', () => {
      render(<EnhancedChatInterface {...defaultProps} messages={mockMessages} />);

      expect(screen.getByText('You')).toBeInTheDocument();
      expect(screen.getByText('Alfred')).toBeInTheDocument();
    });

    it('should show message type badges', () => {
      render(<EnhancedChatInterface {...defaultProps} messages={mockMessages} />);

      expect(screen.getByText('code-generation')).toBeInTheDocument();
    });

    it('should show response time metadata', () => {
      render(<EnhancedChatInterface {...defaultProps} messages={mockMessages} />);

      expect(screen.getByText('Response time: 1500ms')).toBeInTheDocument();
      expect(screen.getByText('Response time: 3000ms')).toBeInTheDocument();
    });
  });

  describe('theming', () => {
    it('should apply dark theme correctly', () => {
      const { container } = render(
        <EnhancedChatInterface {...defaultProps} theme="dark" />
      );

      expect(container.firstChild).toHaveClass('dark');
    });

    it('should apply light theme correctly', () => {
      const { container } = render(
        <EnhancedChatInterface {...defaultProps} theme="light" />
      );

      expect(container.firstChild).not.toHaveClass('dark');
    });
  });
});