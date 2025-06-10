/**
 * Unit tests for ChatInterface component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInterface } from '../../ui/components/ChatInterface';
import { useAlfredService } from '../../ui/hooks/useAlfredService';
import { useToast } from '../../../client/components/ui/use-toast';
import { ChatSession, ChatMessage } from '../../src/interfaces';

// Mock dependencies
jest.mock('../../ui/hooks/useAlfredService');
jest.mock('../../../client/components/ui/use-toast');
jest.mock('../../ui/components/CodeBlock', () => ({
  CodeBlock: ({ content }: { content: string }) => <div>{content}</div>
}));

// Mock date-fns
jest.mock('date-fns', () => ({
  format: jest.fn((date) => '12:00')
}));

const mockUseAlfredService = useAlfredService as jest.MockedFunction<typeof useAlfredService>;
const mockUseToast = useToast as jest.MockedFunction<typeof useToast>;

describe('ChatInterface', () => {
  const mockSession: ChatSession = {
    id: 'test-session',
    name: 'Test Session',
    projectId: 'test-project',
    messages: [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date(),
        metadata: {}
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Hi there!',
        timestamp: new Date(),
        metadata: {
          model: 'test-model',
          tokensUsed: 10,
          processingTime: 100
        }
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: { model: 'test-model', totalTokens: 10 }
  };

  const mockAlfredService = {
    getSession: jest.fn().mockResolvedValue(mockSession),
    sendMessage: jest.fn().mockResolvedValue({
      id: 'msg-3',
      role: 'assistant',
      content: 'AI response',
      timestamp: new Date()
    })
  };

  const mockToast = jest.fn();

  beforeEach(() => {
    mockUseAlfredService.mockReturnValue(mockAlfredService as any);
    mockUseToast.mockReturnValue({ toast: mockToast } as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render loading state initially', () => {
      mockAlfredService.getSession.mockImplementation(() => new Promise(() => {}));
      
      render(<ChatInterface sessionId="test-session" />);
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('should render empty state when session not found', async () => {
      mockAlfredService.getSession.mockResolvedValue(null);
      
      render(<ChatInterface sessionId="test-session" />);
      
      await waitFor(() => {
        expect(screen.getByText('Session not found')).toBeInTheDocument();
      });
    });

    it('should render chat interface with messages', async () => {
      render(<ChatInterface sessionId="test-session" />);
      
      await waitFor(() => {
        expect(screen.getByText('Hello')).toBeInTheDocument();
        expect(screen.getByText('Hi there!')).toBeInTheDocument();
      });
    });

    it('should display session name in header', async () => {
      render(<ChatInterface sessionId="test-session" />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Session')).toBeInTheDocument();
      });
    });

    it('should display project context if provided', async () => {
      const projectContext = {
        projectName: 'Test Project',
        projectType: 'node',
        structure: {
          totalFiles: 100,
          statistics: {
            totalFiles: 100,
            languageBreakdown: { typescript: 80, javascript: 20 }
          }
        },
        analyzedAt: new Date()
      };
      
      render(<ChatInterface sessionId="test-session" projectContext={projectContext} />);
      
      await waitFor(() => {
        expect(screen.getByText(/Test Project.*node/)).toBeInTheDocument();
      });
    });
  });

  describe('Message Display', () => {
    it('should display user messages with correct styling', async () => {
      render(<ChatInterface sessionId="test-session" />);
      
      await waitFor(() => {
        const userMessage = screen.getByText('Hello').closest('.alfred-chat-message');
        expect(userMessage).toHaveClass('user');
      });
    });

    it('should display assistant messages with correct styling', async () => {
      render(<ChatInterface sessionId="test-session" />);
      
      await waitFor(() => {
        const assistantMessage = screen.getByText('Hi there!').closest('.alfred-chat-message');
        expect(assistantMessage).toHaveClass('assistant');
      });
    });

    it('should display message metadata', async () => {
      render(<ChatInterface sessionId="test-session" />);
      
      await waitFor(() => {
        expect(screen.getByText(/Model: test-model/)).toBeInTheDocument();
        expect(screen.getByText(/Tokens: 10/)).toBeInTheDocument();
        expect(screen.getByText(/Time: 100ms/)).toBeInTheDocument();
      });
    });

    it('should display timestamps', async () => {
      render(<ChatInterface sessionId="test-session" />);
      
      await waitFor(() => {
        const timestamps = screen.getAllByText('12:00');
        expect(timestamps).toHaveLength(2);
      });
    });
  });

  describe('User Interactions', () => {
    it('should send message when clicking send button', async () => {
      const user = userEvent.setup();
      render(<ChatInterface sessionId="test-session" />);
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Type your message/)).toBeInTheDocument();
      });
      
      const input = screen.getByPlaceholderText(/Type your message/);
      const sendButton = screen.getByRole('button', { name: /send/i });
      
      await user.type(input, 'Test message');
      await user.click(sendButton);
      
      expect(mockAlfredService.sendMessage).toHaveBeenCalledWith('test-session', 'Test message');
      expect(input).toHaveValue('');
    });

    it('should send message when pressing Enter', async () => {
      const user = userEvent.setup();
      render(<ChatInterface sessionId="test-session" />);
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Type your message/)).toBeInTheDocument();
      });
      
      const input = screen.getByPlaceholderText(/Type your message/);
      
      await user.type(input, 'Test message{Enter}');
      
      expect(mockAlfredService.sendMessage).toHaveBeenCalledWith('test-session', 'Test message');
    });

    it('should not send empty messages', async () => {
      const user = userEvent.setup();
      render(<ChatInterface sessionId="test-session" />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
      });
      
      const sendButton = screen.getByRole('button', { name: /send/i });
      
      await user.click(sendButton);
      
      expect(mockAlfredService.sendMessage).not.toHaveBeenCalled();
    });

    it('should show loading state while sending', async () => {
      mockAlfredService.sendMessage.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );
      
      const user = userEvent.setup();
      render(<ChatInterface sessionId="test-session" />);
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Type your message/)).toBeInTheDocument();
      });
      
      const input = screen.getByPlaceholderText(/Type your message/);
      
      await user.type(input, 'Test message{Enter}');
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('should copy message content', async () => {
      const user = userEvent.setup();
      
      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn().mockResolvedValue(undefined)
        }
      });
      
      render(<ChatInterface sessionId="test-session" />);
      
      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /copy/i })).toHaveLength(2);
      });
      
      const copyButtons = screen.getAllByRole('button', { name: /copy/i });
      await user.click(copyButtons[0]);
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Hello');
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Copied to clipboard'
      }));
    });

    it('should download session', async () => {
      const user = userEvent.setup();
      
      // Mock URL and document methods
      const mockCreateObjectURL = jest.fn().mockReturnValue('blob:url');
      const mockRevokeObjectURL = jest.fn();
      const mockClick = jest.fn();
      
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;
      
      jest.spyOn(document, 'createElement').mockImplementation((tag) => {
        if (tag === 'a') {
          return { click: mockClick } as any;
        }
        return document.createElement(tag);
      });
      
      render(<ChatInterface sessionId="test-session" />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
      });
      
      const downloadButton = screen.getByRole('button', { name: /download/i });
      await user.click(downloadButton);
      
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:url');
    });

    it('should refresh session', async () => {
      const user = userEvent.setup();
      render(<ChatInterface sessionId="test-session" />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
      });
      
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      await user.click(refreshButton);
      
      expect(mockAlfredService.getSession).toHaveBeenCalledTimes(2);
    });
  });

  describe('Quick Actions', () => {
    it('should display quick actions when input is empty', async () => {
      render(<ChatInterface sessionId="test-session" />);
      
      await waitFor(() => {
        expect(screen.getByText('Generate Code')).toBeInTheDocument();
        expect(screen.getByText('Explain Code')).toBeInTheDocument();
        expect(screen.getByText('Refactor')).toBeInTheDocument();
        expect(screen.getByText('Add Tests')).toBeInTheDocument();
        expect(screen.getByText('Documentation')).toBeInTheDocument();
        expect(screen.getByText('Optimize')).toBeInTheDocument();
      });
    });

    it('should populate input when clicking quick action', async () => {
      const user = userEvent.setup();
      render(<ChatInterface sessionId="test-session" />);
      
      await waitFor(() => {
        expect(screen.getByText('Generate Code')).toBeInTheDocument();
      });
      
      const generateButton = screen.getByText('Generate Code');
      await user.click(generateButton);
      
      const input = screen.getByPlaceholderText(/Type your message/);
      expect(input).toHaveValue('Generate code for: ');
    });

    it('should hide quick actions when typing', async () => {
      const user = userEvent.setup();
      render(<ChatInterface sessionId="test-session" />);
      
      await waitFor(() => {
        expect(screen.getByText('Generate Code')).toBeInTheDocument();
      });
      
      const input = screen.getByPlaceholderText(/Type your message/);
      await user.type(input, 'Test');
      
      expect(screen.queryByText('Generate Code')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should show error toast on load failure', async () => {
      mockAlfredService.getSession.mockRejectedValue(new Error('Load failed'));
      
      render(<ChatInterface sessionId="test-session" />);
      
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
          title: 'Error',
          description: 'Failed to load chat session',
          variant: 'destructive'
        }));
      });
    });

    it('should show error message on send failure', async () => {
      mockAlfredService.sendMessage.mockRejectedValue(new Error('Send failed'));
      
      const user = userEvent.setup();
      render(<ChatInterface sessionId="test-session" />);
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Type your message/)).toBeInTheDocument();
      });
      
      const input = screen.getByPlaceholderText(/Type your message/);
      await user.type(input, 'Test message{Enter}');
      
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
          title: 'Error',
          description: 'Failed to send message',
          variant: 'destructive'
        }));
      });
    });

    it('should handle clipboard copy failure gracefully', async () => {
      const user = userEvent.setup();
      
      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn().mockRejectedValue(new Error('Copy failed'))
        }
      });
      
      render(<ChatInterface sessionId="test-session" />);
      
      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /copy/i })).toHaveLength(2);
      });
      
      const copyButtons = screen.getAllByRole('button', { name: /copy/i });
      await user.click(copyButtons[0]);
      
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive'
      }));
    });
  });
});