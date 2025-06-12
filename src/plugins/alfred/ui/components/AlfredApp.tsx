import React, { useState, useEffect } from 'react';
import { ThemeProvider } from '@client/styles/ThemeProvider';
import { ErrorBoundary } from './enhanced/ErrorBoundary';
import { EnhancedChatInterface } from './enhanced/EnhancedChatInterface';
import { TemplateWizard } from './enhanced/TemplateWizard';
import { CommandPalette, useCommandPalette, createDefaultCommands } from './enhanced/CommandPalette';
import { useAccessibility } from '../hooks/useAccessibility';
import { PerformanceMonitor } from '../../src/utils/performance-monitor';
import { AlfredErrorHandler } from '../../src/utils/error-handler';
import { Button } from '@client/components/ui/button';
import { Badge } from '@client/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@client/components/ui/tabs';
import { 
  MessageSquare, 
  FileText, 
  Settings, 
  Zap,
  User,
  Bell,
  HelpCircle,
  Monitor
} from 'lucide-react';

interface AlfredAppProps {
  userId: string;
  projectContext?: any;
  theme?: 'light' | 'dark';
  onThemeChange?: (theme: 'light' | 'dark') => void;
}

export const AlfredApp: React.FC<AlfredAppProps> = ({
  userId,
  projectContext,
  theme = 'dark',
  onThemeChange
}) => {
  const [activeTab, setActiveTab] = useState('chat');
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  
  // Hooks
  const { announce, ScreenReaderAnnouncer } = useAccessibility();
  const { isOpen, open, close, recentCommands, addRecentCommand } = useCommandPalette();
  
  // Services
  const [perfMonitor] = useState(() => new PerformanceMonitor());
  const [errorHandler] = useState(() => new AlfredErrorHandler());

  // Initialize Alfred services
  useEffect(() => {
    const initializeServices = async () => {
      try {
        setIsLoading(true);
        announce('Alfred is starting up...');
        
        // Load initial data
        await perfMonitor.measureAsync('alfred-initialization', async () => {
          // Initialize chat session
          // Load templates
          // Setup event listeners
        });
        
        announce('Alfred is ready to assist you');
      } catch (error) {
        errorHandler.handleError(error as Error, {
          component: 'AlfredApp',
          action: 'initialization',
          userId
        });
        announce('Alfred failed to start. Please try refreshing.');
      } finally {
        setIsLoading(false);
      }
    };

    initializeServices();
  }, [userId]);

  // Command palette actions
  const commands = createDefaultCommands({
    onNewChat: () => {
      setActiveTab('chat');
      setCurrentSession(null);
      setMessages([]);
      announce('New chat session started');
    },
    onOpenTemplateWizard: () => {
      setActiveTab('templates');
      announce('Template wizard opened');
    },
    onGenerateCode: () => {
      setActiveTab('chat');
      announce('Code generation mode activated');
    },
    onAnalyzeProject: async () => {
      announce('Analyzing project...');
      // Trigger project analysis
    },
    onDownloadChat: () => {
      // Download current chat
      announce('Chat downloaded');
    },
    onShowSettings: () => {
      setActiveTab('settings');
      announce('Settings opened');
    },
    onShowKeyboardShortcuts: () => {
      open();
    }
  });

  // Event handlers
  const handleSendMessage = async (content: string) => {
    try {
      setIsLoading(true);
      
      await perfMonitor.measureAsync('send-message', async () => {
        // Send message to Alfred service
        const newMessage = {
          id: Date.now().toString(),
          content,
          role: 'user',
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, newMessage]);
        
        // Simulate AI response
        setTimeout(() => {
          const response = {
            id: (Date.now() + 1).toString(),
            content: `I understand you want help with: ${content}. Let me assist you with that.`,
            role: 'assistant',
            timestamp: new Date()
          };
          setMessages(prev => [...prev, response]);
          announce('Alfred has responded');
        }, 1000);
      });
    } catch (error) {
      errorHandler.handleError(error as Error, {
        component: 'AlfredApp',
        action: 'send-message',
        userId,
        sessionId: currentSession
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTemplateProcess = async (template: any, variables: any) => {
    try {
      return await perfMonitor.measureAsync('process-template', async () => {
        // Process template with variables
        return {
          content: `// Generated from ${template.name}\n// Variables: ${JSON.stringify(variables, null, 2)}`,
          files: []
        };
      });
    } catch (error) {
      errorHandler.handleError(error as Error, {
        component: 'AlfredApp',
        action: 'process-template',
        userId
      });
      throw error;
    }
  };

  // Tab content components
  const renderTabContent = () => {
    switch (activeTab) {
      case 'chat':
        return (
          <ErrorBoundary onError={(error, errorInfo) => 
            errorHandler.handleError(error, { component: 'ChatInterface' })
          }>
            <EnhancedChatInterface
              sessionId={currentSession || 'default'}
              messages={messages}
              projectContext={projectContext}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              theme={theme}
            />
          </ErrorBoundary>
        );

      case 'templates':
        return (
          <ErrorBoundary onError={(error, errorInfo) => 
            errorHandler.handleError(error, { component: 'TemplateWizard' })
          }>
            <TemplateWizard
              templates={templates}
              projectContext={projectContext}
              onTemplateProcess={handleTemplateProcess}
              theme={theme}
            />
          </ErrorBoundary>
        );

      case 'settings':
        return (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">Alfred Settings</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Theme</span>
                <Button
                  variant="outline"
                  onClick={() => onThemeChange?.(theme === 'dark' ? 'light' : 'dark')}
                >
                  {theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <span>Notifications</span>
                <Badge variant="secondary">{notifications.length} pending</Badge>
              </div>
            </div>
          </div>
        );

      case 'help':
        return (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">Help & Support</h2>
            <div className="space-y-4">
              <p>Alfred is your AI-powered coding assistant. Use the command palette (Ctrl+K) for quick actions.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <h3 className="font-semibold mb-2">Getting Started</h3>
                  <p className="text-sm">Start a conversation or use templates to generate code.</p>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <h3 className="font-semibold mb-2">Keyboard Shortcuts</h3>
                  <p className="text-sm">Press Ctrl+/ to see all available shortcuts.</p>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <div className={`alfred-app h-full flex flex-col ${theme}`}>
        <ScreenReaderAnnouncer />
        
        {/* Header */}
        <header className="alfred-header border-b bg-white dark:bg-gray-900 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="w-6 h-6 text-blue-500" />
              <h1 className="text-xl font-bold">Alfred Assistant</h1>
              {projectContext && (
                <Badge variant="outline" className="ml-2">
                  {projectContext.projectName}
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <Button variant="ghost" size="sm" className="relative">
                  <Bell className="w-4 h-4" />
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs"
                  >
                    {notifications.length}
                  </Badge>
                </Button>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab('help')}
                title="Help"
              >
                <HelpCircle className="w-4 h-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab('settings')}
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="alfred-content flex-1 flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-4 mx-4 mt-4">
              <TabsTrigger value="chat" className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="templates" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Templates
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Settings
              </TabsTrigger>
              <TabsTrigger value="help" className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4" />
                Help
              </TabsTrigger>
            </TabsList>
            
            <div className="flex-1 p-4">
              <TabsContent value={activeTab} className="h-full m-0">
                {renderTabContent()}
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Command Palette */}
        <CommandPalette
          isOpen={isOpen}
          onClose={close}
          commands={commands}
          recentCommands={recentCommands}
          onCommandExecute={addRecentCommand}
          theme={theme}
        />

        {/* Status Bar */}
        <footer className="alfred-status-bar border-t bg-gray-50 dark:bg-gray-800 px-4 py-2">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                Connected
              </span>
              {currentSession && (
                <span>Session: {currentSession.slice(0, 8)}...</span>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              <span>Alfred v1.0.0</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={open}
                className="h-6 px-2 text-xs"
                title="Command Palette (Ctrl+K)"
              >
                <Monitor className="w-3 h-3 mr-1" />
                Ctrl+K
              </Button>
            </div>
          </div>
        </footer>
      </div>
    </ThemeProvider>
  );
};