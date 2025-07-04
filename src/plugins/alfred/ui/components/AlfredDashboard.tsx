/**
 * Alfred Dashboard - Main UI component for the Alfred plugin
 */

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent 
} from '../../../../client/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../client/components/ui/tabs';
import { Button } from '../../../../client/components/ui/button';
import { AlfredService } from '../../src/services/alfred-service';
import { StreamingService } from '../../src/services/streaming-service';
import { ProjectAnalyzer } from '../../src/services/project-analyzer';
import { CodeGenerator } from '../../src/services/code-generator';
import { TemplateManager } from '../../src/services/template-manager';
import { ChatInterface } from './ChatInterface';
import { ProjectExplorer } from './ProjectExplorer';
import { TemplateManager as TemplateManagerUI } from './TemplateManager';
import { SessionList } from './SessionList';
import { SplitPaneEditor } from './SplitPaneEditor';
import { Bot, FolderOpen, FileCode, History, MessageSquare, Code } from 'lucide-react';
import { createClientLogger } from '../../../../client/utils/client-logger';

// Add TypeScript declarations for window extensions
declare global {
  interface Window {
    getAlfredSessions?: () => any[];
    createAlfredSession?: (projectPath?: string) => any;
  }
}

const logger = createClientLogger({ serviceName: 'alfred-dashboard' });

interface AlfredDashboardProps {
  alfredService: AlfredService;
  streamingService: StreamingService;
  projectAnalyzer: ProjectAnalyzer;
  codeGenerator: CodeGenerator;
  templateManager: TemplateManager;
}

export function AlfredDashboard({
  alfredService,
  streamingService,
  projectAnalyzer,
  codeGenerator,
  templateManager
}: AlfredDashboardProps) {
  const [activeTab, setActiveTab] = useState('chat');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState([]);
  const [currentProject, setCurrentProject] = useState<string | undefined>();

  useEffect(() => {
    // Load sessions on mount
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      // First try getting sessions from the service
      let loadedSessions = [];
      try {
        loadedSessions = await alfredService.getSessions();
      } catch (error) {
        // If the service fails, try getting from the window helper
        logger.warn('Failed to load sessions from service, trying window helper', { error });
        if (window.getAlfredSessions) {
          loadedSessions = window.getAlfredSessions();
        }
      }
      
      // Use sessions if we got any
      if (loadedSessions && loadedSessions.length > 0) {
        setSessions(loadedSessions);
        
        // Set current session to the most recent one
        if (!currentSessionId) {
          setCurrentSessionId(loadedSessions[0].id);
        }
      } else {
        // Create a default session if none exist
        logger.info('No sessions found, creating default session');
        const newSession = await handleNewSession();
        if (newSession) {
          setSessions([newSession]);
          setCurrentSessionId(newSession.id);
        }
      }
    } catch (error) {
      logger.error('Failed to load sessions', { error });
      // Create dummy session as fallback
      const dummySession = {
        id: 'default-session',
        projectPath: 'C:/Projects/Alexandria',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: { model: 'default', totalTokens: 0 }
      };
      setSessions([dummySession]);
      setCurrentSessionId(dummySession.id);
    }
  };

  const handleNewSession = async () => {
    try {
      let session;
      try {
        session = await alfredService.createSession(currentProject);
      } catch (error) {
        // Try window helper if service fails
        logger.warn('Failed to create session via service, trying window helper', { error });
        if (window.createAlfredSession) {
          session = window.createAlfredSession(currentProject);
        }
      }
      
      if (session) {
        setCurrentSessionId(session.id);
        await loadSessions();
        setActiveTab('chat');
        return session;
      }
      return null;
    } catch (error) {
      logger.error('Failed to create new session', { error });
      return null;
    }
  };

  const handleSessionSelect = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setActiveTab('chat');
  };

  const handleProjectSelect = (projectPath: string) => {
    setCurrentProject(projectPath);
  };

  return (
    <div className="alfred-dashboard h-full flex flex-col">
      <Card className="flex-1 flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-6 w-6" />
              <CardTitle>ALFRED Assistant</CardTitle>
            </div>
            <Button onClick={handleNewSession} size="sm">
              New Chat
            </Button>
          </div>
          <CardDescription>
            AI-powered coding assistant for rapid development
            {currentProject && (
              <span className="ml-2 text-sm font-medium">
                • Project: {currentProject.split('/').pop()}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="flex-1 p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            <div className="px-6">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="chat" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Chat
                </TabsTrigger>
                <TabsTrigger value="editor" className="flex items-center gap-2">
                  <FileCode className="h-4 w-4" />
                  Editor
                </TabsTrigger>
                <TabsTrigger value="code" className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  Generate
                </TabsTrigger>
                <TabsTrigger value="sessions" className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Sessions
                </TabsTrigger>
                <TabsTrigger value="project" className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Project
                </TabsTrigger>
                <TabsTrigger value="templates" className="flex items-center gap-2">
                  <FileCode className="h-4 w-4" />
                  Templates
                </TabsTrigger>
              </TabsList>
            </div>
            
            <div className="flex-1 overflow-hidden">
              <TabsContent value="chat" className="h-full m-0">
                {currentSessionId ? (
                  <ChatInterface 
                    sessionId={currentSessionId}
                    alfredService={alfredService}
                    streamingService={streamingService}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground mb-4">
                        No active chat session
                      </p>
                      <Button onClick={handleNewSession}>
                        Start New Chat
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="editor" className="h-full m-0">
                <SplitPaneEditor
                  projectPath={currentProject}
                  alfredService={alfredService}
                  streamingService={streamingService}
                  onCodeGenerate={(code, file) => {
                    logger.info('Generated code for file', { file, codeLength: code.length });
                  }}
                />
              </TabsContent>
              
              <TabsContent value="code" className="h-full m-0 p-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Code Generation</h3>
                  <p className="text-sm text-muted-foreground">
                    Generate code using AI with templates and context
                  </p>
                  {/* Code generator component integration here */}
                </div>
              </TabsContent>
              
              <TabsContent value="sessions" className="h-full m-0 p-6">
                <SessionList 
                  sessions={sessions}
                  currentSessionId={currentSessionId}
                  onSessionSelect={handleSessionSelect}
                  onSessionsChange={loadSessions}
                  alfredService={alfredService}
                />
              </TabsContent>
              
              <TabsContent value="project" className="h-full m-0 p-6">
                <ProjectExplorer 
                  projectAnalyzer={projectAnalyzer}
                  onProjectSelect={handleProjectSelect}
                />
              </TabsContent>
              
              <TabsContent value="templates" className="h-full m-0 p-6">
                <TemplateManagerUI 
                  templateManager={templateManager}
                />
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}