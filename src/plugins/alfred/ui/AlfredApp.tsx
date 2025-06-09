import React, { useEffect, useState } from 'react';
import { PluginProvider } from '../../../client/context/plugin-context';
import { AlfredRoutes } from './AlfredRoutes';

// Mock API object for development
const createMockAlfredAPI = () => {
  return {
    getService: (serviceName: string) => {
      if (serviceName === 'alfred') {
        // Return a mock service for development
        return {
          async getSessions() {
            console.log('[Mock Alfred] Getting sessions');
            return [];
          },
          async createSession(title: string) {
            console.log('[Mock Alfred] Creating session:', title);
            return { id: 'mock-session-' + Date.now(), title, messages: [] };
          },
          async getSession(id: string) {
            console.log('[Mock Alfred] Getting session:', id);
            return null;
          },
          async sendMessage(sessionId: string, message: string) {
            console.log('[Mock Alfred] Sending message:', { sessionId, message });
            return { 
              content: 'This is a mock response. The Alfred service is not properly connected.',
              role: 'assistant' 
            };
          }
        };
      }
      return null;
    }
  };
};

export const AlfredApp: React.FC = () => {
  const [api, setApi] = useState<any>(null);

  useEffect(() => {
    // Try to get the real API from window.alfred
    if ((window as any).alfred && (window as any).alfred.api) {
      console.log('[AlfredApp] Using real Alfred API');
      setApi((window as any).alfred.api);
    } else {
      console.log('[AlfredApp] Using mock Alfred API');
      setApi(createMockAlfredAPI());
    }
  }, []);

  if (!api) {
    return <div>Loading Alfred plugin...</div>;
  }

  return (
    <PluginProvider pluginId="alfred" api={api}>
      <AlfredRoutes />
    </PluginProvider>
  );
};