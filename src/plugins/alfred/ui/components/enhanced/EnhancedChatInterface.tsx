import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import { Textarea } from '@client/components/ui/textarea';
import { ScrollArea } from '@client/components/ui/scroll-area';
import { Badge } from '@client/components/ui/badge';
import { toast } from '@client/components/ui/use-toast';
import { 
  Send, 
  Mic, 
  MicOff, 
  Square, 
  MoreVertical, 
  Settings, 
  Download,
  Zap,
  Code,
  FileText,
  Keyboard
} from 'lucide-react';
import { CodeBlock } from './CodeBlock';
import { ChatMessage, StreamChunk, ProjectContext } from '../../../src/interfaces';

interface EnhancedChatInterfaceProps {
  sessionId: string;
  messages: ChatMessage[];
  projectContext?: ProjectContext;
  onSendMessage: (content: string) => Promise<void>;
  onStreamMessage?: (content: string) => AsyncIterableIterator<StreamChunk>;
  isStreaming?: boolean;
  onStopStream?: () => void;
  isLoading?: boolean;
  theme?: 'light' | 'dark';
  showKeyboardShortcuts?: boolean;
}

interface KeyboardShortcut {
  key: string;
  description: string;
  action: () => void;
}

export const EnhancedChatInterface: React.FC<EnhancedChatInterfaceProps> = ({
  sessionId,
  messages,
  projectContext,
  onSendMessage,
  onStreamMessage,
  isStreaming = false,
  onStopStream,
  isLoading = false,
  theme = 'dark',
  showKeyboardShortcuts = true
}) => {
  const [input, setInput] = useState('');
  const [isMultiline, setIsMultiline] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Keyboard shortcuts
  const shortcuts: KeyboardShortcut[] = [
    {
      key: 'Ctrl+Enter',
      description: 'Send message',
      action: () => handleSendMessage()
    },
    {
      key: 'Shift+Enter',
      description: 'New line',
      action: () => setIsMultiline(true)
    },
    {
      key: 'Ctrl+K',
      description: 'Clear input',
      action: () => setInput('')
    },
    {
      key: 'Ctrl+/',
      description: 'Show shortcuts',
      action: () => setShowShortcuts(!showShortcuts)
    },
    {
      key: 'Escape',
      description: 'Stop streaming',
      action: () => isStreaming && onStopStream?.()
    },
    {
      key: 'Ctrl+D',
      description: 'Download chat',
      action: () => handleDownloadChat()
    }
  ];

  // Keyboard event handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Global shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'Enter':
          if (!e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
          }
          break;
        case 'k':
          e.preventDefault();
          setInput('');
          break;
        case '/':
          e.preventDefault();
          setShowShortcuts(!showShortcuts);
          break;
        case 'd':
          e.preventDefault();
          handleDownloadChat();
          break;
      }
    }
    
    if (e.key === 'Escape') {
      if (isStreaming) {
        onStopStream?.();
      } else if (showShortcuts) {
        setShowShortcuts(false);
      }
    }
  }, [isStreaming, showShortcuts, onStopStream]);

  // Register global keyboard shortcuts
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading || isStreaming) return;

    const messageContent = input.trim();
    setInput('');
    setIsMultiline(false);

    try {
      if (onStreamMessage) {
        setStreamingMessage('');
        const stream = onStreamMessage(messageContent);
        
        for await (const chunk of stream) {
          setStreamingMessage(prev => prev + chunk.content);
          
          if (chunk.done) {
            setStreamingMessage('');
            break;
          }
        }
      } else {
        await onSendMessage(messageContent);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        setIsMultiline(true);
      } else if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        handleSendMessage();
      } else if (!isMultiline) {
        e.preventDefault();
        handleSendMessage();
      }
    }
  };

  const handleDownloadChat = () => {
    const chatContent = messages.map(msg => 
      `${msg.role === 'user' ? 'User' : 'Alfred'}: ${msg.content}`
    ).join('\n\n');
    
    const blob = new Blob([chatContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alfred-chat-${sessionId}-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Downloaded",
      description: "Chat history saved successfully",
      duration: 2000,
    });
  };

  const renderMessage = (message: ChatMessage, index: number) => {
    const isUser = message.role === 'user';
    const hasCode = message.content.includes('```');

    return (
      <div
        key={message.id || index}
        className={`message-container mb-4 ${isUser ? 'user-message' : 'assistant-message'}`}
      >
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
          <div
            className={`max-w-[80%] rounded-lg p-4 ${
              isUser 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            }`}
          >
            {/* Message header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {isUser ? 'You' : 'Alfred'}
                </span>
                {message.metadata?.type && (
                  <Badge variant="secondary" className="text-xs">
                    {message.metadata.type === 'code-generation' && <Code className="w-3 h-3 mr-1" />}
                    {message.metadata.type === 'template-generation' && <FileText className="w-3 h-3 mr-1" />}
                    {message.metadata.type}
                  </Badge>
                )}
              </div>
              <span className="text-xs opacity-70">
                {new Date(message.timestamp).toLocaleTimeString()}
              </span>
            </div>

            {/* Message content */}
            <div className="message-content">
              {hasCode ? (
                <MessageWithCode content={message.content} theme={theme} />
              ) : (
                <div className="whitespace-pre-wrap">{message.content}</div>
              )}
            </div>

            {/* Message metadata */}
            {message.metadata?.responseTime && (
              <div className="text-xs opacity-70 mt-2">
                Response time: {message.metadata.responseTime}ms
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`enhanced-chat-interface h-full flex flex-col ${theme}`}>
      {/* Header */}
      <div className="chat-header flex items-center justify-between p-4 border-b bg-white dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold">Alfred Assistant</h2>
          {projectContext && (
            <Badge variant="outline" className="ml-2">
              {projectContext.projectName}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {showKeyboardShortcuts && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowShortcuts(!showShortcuts)}
              title="Keyboard shortcuts (Ctrl+/)"
            >
              <Keyboard className="w-4 h-4" />
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownloadChat}
            title="Download chat (Ctrl+D)"
          >
            <Download className="w-4 h-4" />
          </Button>
          
          <Button variant="ghost" size="sm" title="More options">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <div className="messages-container">
          {messages.map((message, index) => renderMessage(message, index))}
          
          {/* Streaming message */}
          {streamingMessage && (
            <div className="message-container mb-4 assistant-message">
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg p-4 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium">Alfred</span>
                    <Badge variant="secondary" className="text-xs">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1" />
                      streaming
                    </Badge>
                  </div>
                  <div className="whitespace-pre-wrap">{streamingMessage}</div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Keyboard shortcuts overlay */}
      {showShortcuts && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Keyboard Shortcuts</h3>
            <div className="space-y-2">
              {shortcuts.map((shortcut, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-sm">{shortcut.description}</span>
                  <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">
                    {shortcut.key}
                  </kbd>
                </div>
              ))}
            </div>
            <Button
              className="w-full mt-4"
              onClick={() => setShowShortcuts(false)}
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="chat-input border-t bg-white dark:bg-gray-900 p-4">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={isMultiline ? "Type your message... (Ctrl+Enter to send)" : "Type your message... (Enter to send, Shift+Enter for new line)"}
              className="min-h-[44px] max-h-32 resize-none"
              disabled={isLoading || isStreaming}
              rows={isMultiline ? 3 : 1}
            />
          </div>
          
          <div className="flex items-center gap-1">
            {isStreaming ? (
              <Button
                onClick={onStopStream}
                variant="destructive"
                size="sm"
                className="h-[44px]"
                title="Stop streaming (Esc)"
              >
                <Square className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSendMessage}
                disabled={!input.trim() || isLoading}
                size="sm"
                className="h-[44px]"
                title="Send message (Ctrl+Enter)"
              >
                <Send className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Input hints */}
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span>Ctrl+Enter to send</span>
            <span>Ctrl+K to clear</span>
            <span>Ctrl+/ for shortcuts</span>
          </div>
          {input.length > 0 && (
            <span>{input.length} characters</span>
          )}
        </div>
      </div>
    </div>
  );
};

// Component to render messages with code blocks
const MessageWithCode: React.FC<{ content: string; theme: 'light' | 'dark' }> = ({
  content,
  theme
}) => {
  const parts = content.split(/(```[\s\S]*?```)/);
  
  return (
    <div>
      {parts.map((part, index) => {
        if (part.startsWith('```')) {
          const match = part.match(/```(\w+)?\n?([\s\S]*?)```/);
          if (match) {
            const language = match[1] || 'text';
            const code = match[2];
            return (
              <div key={index} className="my-2">
                <CodeBlock
                  code={code}
                  language={language}
                  theme={theme}
                  showLineNumbers={code.split('\n').length > 3}
                />
              </div>
            );
          }
        }
        
        return part ? (
          <div key={index} className="whitespace-pre-wrap">
            {part}
          </div>
        ) : null;
      })}
    </div>
  );
};