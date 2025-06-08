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
import { useAlfredService } from '../hooks/useAlfredService';
import { CodeBlock } from './CodeBlock';
import { format } from 'date-fns';

interface ChatInterfaceProps {
  sessionId: string;
  projectContext?: ProjectContext;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  sessionId, 
  projectContext 
}) => {
  const alfredService = useAlfredService();
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
    if (!message.trim() || isSending) return;

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
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Session not found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-3 flex items-center justify-between">
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
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadSession}
            title="Refresh"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-6">
        <div className="space-y-4">
          {session.messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role !== 'user' && (
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                </div>
              )}
              
              <div
                className={`max-w-[80%] ${
                  msg.role === 'user' ? 'order-1' : ''
                }`}
              >
                <Card>
                  <CardContent className="p-4">
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
                  </CardContent>
                </Card>
              </div>

              {msg.role === 'user' && (
                <div className="flex-shrink-0 order-2">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                    <User className="h-5 w-5" />
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Quick Actions */}
      {message.length === 0 && (
        <div className="border-t border-b px-4 py-3 bg-muted/30">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Quick Actions</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <Button
                key={action.label}
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction(action.prompt)}
                className="text-xs"
              >
                <action.icon className="h-3 w-3 mr-1" />
                {action.label}
              </Button>
            ))}
          </div>
          
          {/* Smart Suggestions */}
          {smartSuggestions.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Suggestions</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSuggestions(!showSuggestions)}
                  className="ml-auto h-6 w-6 p-0"
                >
                  <Settings className="h-3 w-3" />
                </Button>
              </div>
              
              {showSuggestions && (
                <div className="space-y-1">
                  {smartSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="block w-full text-left text-xs px-2 py-1 rounded hover:bg-muted/50 transition-colors"
                    >
                      "{suggestion}"
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type your message... (Shift+Enter for new line)"
            className="min-h-[80px] resize-none"
            disabled={isSending}
          />
          <div className="flex flex-col gap-2">
            <Button
              onClick={sendMessage}
              disabled={!message.trim() || isSending}
              className="h-full"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
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