/**
 * Chat Interface Component - Main chat UI for Alfred
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Card,
  CardContent 
} from '../../../../client/components/ui/card';
import { Button } from '../../../../client/components/ui/button';
import { Textarea } from '../../../../client/components/ui/textarea';
import { ScrollArea } from '../../../../client/components/ui/scroll-area';
import { Badge } from '../../../../client/components/ui/badge';
import { useToast } from '../../../../client/components/ui/use-toast';
import {      
  Send, 
  Copy, 
  Download, 
  RotateCcw,
  Code,
  User,
  Bot,
  Loader2,
  Lightbulb,
  Wand2,
  FileText,
  Clock,
  Zap,
  BookOpen,
  Settings
     } from 'lucide-react';
import { ChatMessage, ChatSession, ProjectContext } from '../../src/interfaces';
import { useAlfredContext } from '../hooks/useAlfredContext';
import { CodeBlock } from './CodeBlock';
import { format } from 'date-fns';
// CSS will be imported at the app level

interface ChatInterfaceProps {
  sessionId: string;
  projectContext?: ProjectContext;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  sessionId, 
  projectContext 
}) => {
  const { alfredService } = useAlfredContext();
  const { toast } = useToast();
  const [session, setSession] = useState<ChatSession | null>(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [smartSuggestions, setSmartSuggestions] = useState<string[]>([]);
  const [typingIndicator, setTypingIndicator] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Smart suggestions based on context
  const quickActions = [
    { icon: Code, label: 'Generate Code', prompt: 'Generate code for: ' },
    { icon: Lightbulb, label: 'Explain Code', prompt: 'Explain this code: ' },
    { icon: Wand2, label: 'Refactor', prompt: 'How can I refactor this code to be better: ' },
    { icon: FileText, label: 'Add Tests', prompt: 'Generate unit tests for: ' },
    { icon: BookOpen, label: 'Documentation', prompt: 'Generate documentation for: ' },
    { icon: Zap, label: 'Optimize', prompt: 'How can I optimize this code for performance: ' }
  ];

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [session?.messages]);

  const loadSession = async () => {
    if (!alfredService) return;
    setIsLoading(true);
    try {
      const loadedSession = await alfredService.getSession(sessionId);
      setSession(loadedSession);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load chat session',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || isSending || !alfredService) return;

    const userMessage = message.trim();
    setMessage('');
    setIsSending(true);

    try {
      // Optimistically add user message
      if (session) {
        const optimisticMessage: ChatMessage = {
          id: `temp-${Date.now()}`,
          role: 'user',
          content: userMessage,
          timestamp: new Date()
        };
        
        setSession({
          ...session,
          messages: [...session.messages, optimisticMessage]
        });
      }

      // Send to backend
      const response = await alfredService.sendMessage(sessionId, userMessage);
      
      // Reload session to get updated messages
      await loadSession();
      
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive'
      });
      // Reload to remove optimistic message
      await loadSession();
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: 'Copied',
      description: 'Message copied to clipboard'
    });
  };

  // Smart suggestions based on project context and chat history
  const generateSmartSuggestions = useCallback(() => {
    const suggestions: string[] = [];
    
    if (projectContext) {
      suggestions.push(`Analyze the ${projectContext.projectType} project structure`);
      suggestions.push(`What are the best practices for ${projectContext.projectType} development?`);
      suggestions.push(`How can I improve the performance of this ${projectContext.projectType} project?`);
    }

    // Recent messages context
    if (session?.messages.length) {
      const lastMessages = session.messages.slice(-3);
      const hasCodeInRecent = lastMessages.some(m => m.content.includes('```'));
      
      if (hasCodeInRecent) {
        suggestions.push('Explain the code you just provided');
        suggestions.push('Add error handling to this code');
        suggestions.push('Write unit tests for this code');
      }
    }

    // Default suggestions
    if (suggestions.length === 0) {
      suggestions.push('What can you help me with?');
      suggestions.push('Generate a boilerplate component');
      suggestions.push('Review my code for improvements');
      suggestions.push('Explain a programming concept');
    }

    setSmartSuggestions(suggestions.slice(0, 4));
  }, [projectContext, session?.messages]);

  const handleQuickAction = (prompt: string) => {
    setMessage(prompt);
    textareaRef.current?.focus();
  };

  const handleSuggestionClick = (suggestion: string) => {
    setMessage(suggestion);
    setShowSuggestions(false);
    textareaRef.current?.focus();
  };

  // Auto-generate suggestions when context changes
  useEffect(() => {
    generateSmartSuggestions();
  }, [generateSmartSuggestions]);

  // Simulate typing indicator for better UX
  const startTypingIndicator = () => {
    setTypingIndicator(true);
    setTimeout(() => setTypingIndicator(false), 2000);
  };

  const downloadSession = () => {
    if (!session) return;

    const content = session.messages
      .map(msg => `[${msg.role.toUpperCase()}] ${format(new Date(msg.timestamp), 'yyyy-MM-dd HH:mm:ss')}\n${msg.content}`)
      .join('\n\n---\n\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alfred-chat-${session.name}-${format(new Date(), 'yyyy-MM-dd')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <div className="alfred-loading">
        <Loader2 className="h-8 w-8 alfred-loading-spinner" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="alfred-empty-state">
        <Bot className="alfred-empty-state-icon" />
        <h3 className="alfred-empty-state-title">Session not found</h3>
        <p className="alfred-empty-state-description">The requested session could not be loaded.</p>
      </div>
    );
  }

  return (
    <div className="alfred-chat-interface">
      {/* Header */}
      <div className="chat-header">
        <div>
          <h3 className="font-medium">{session.name}</h3>
          {projectContext && (
            <p className="text-sm text-muted-foreground">
              {projectContext.projectName} • {projectContext.projectType}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={downloadSession}
            title="Download chat"
            className="btn btn-ghost"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadSession}
            title="Refresh"
            className="btn btn-ghost"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="alfred-chat-messages">
        <div className="space-y-4">
          {session.messages.map((msg) => (
            <div
              key={msg.id}
              className={`alfred-chat-message ${msg.role}`}
            >
              <div className={`alfred-chat-avatar ${msg.role}`}>
                {msg.role === 'user' ? (
                  <User className="h-5 w-5 text-white" />
                ) : (
                  <Bot className="h-5 w-5 text-white" />
                )}
              </div>
              
              <div className="alfred-chat-content">
                <div className="alfred-chat-bubble">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Badge variant={msg.role === 'user' ? 'default' : 'secondary'}>
                      {msg.role === 'user' ? 'You' : 'Alfred'}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(msg.timestamp), 'HH:mm')}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => copyMessage(msg.content)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <CodeBlock content={msg.content} />
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}

                  {msg.metadata && (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-xs text-muted-foreground">
                        Model: {msg.metadata.model} • 
                        Tokens: {msg.metadata.tokensUsed} • 
                        Time: {msg.metadata.processingTime}ms
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick Actions */}
      {message.length === 0 && (
        <div className="alfred-quick-actions">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => handleQuickAction(action.prompt)}
              className="alfred-quick-action"
            >
              <action.icon className="h-4 w-4" />
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="alfred-chat-input">
        <div className="alfred-chat-input-wrapper">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type your message... (Shift+Enter for new line)"
            className="alfred-chat-textarea"
            disabled={isSending}
          />
          <Button
            onClick={sendMessage}
            disabled={!message.trim() || isSending}
            className="btn btn-primary"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        {projectContext && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Code className="h-3 w-3" />
            <span>
              Context: {projectContext.structure.statistics.totalFiles} files, 
              {' '}{Object.keys(projectContext.structure.statistics.languageBreakdown).join(', ')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};