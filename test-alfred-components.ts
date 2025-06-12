// Test Alfred component type definitions
import React from 'react';
import { TemplateWizard, TemplateWizardProps, TemplateResult } from './src/plugins/alfred/ui/components/TemplateWizard';
import { ChatInterface } from './src/plugins/alfred/ui/components/ChatInterface';
import { ProjectExplorer } from './src/plugins/alfred/ui/components/ProjectExplorer';
import { SessionList } from './src/plugins/alfred/ui/components/SessionList';

// Test component usage with proper props
function TestComponents() {
  const handleTemplateComplete = (result: TemplateResult) => {
    console.log('Template completed:', result);
  };

  const handleMessageSent = (message: string) => {
    console.log('Message sent:', message);
  };

  return React.createElement('div', {}, [
    React.createElement(TemplateWizard, {
      open: true,
      onComplete: handleTemplateComplete,
      readonly: false
    }),
    React.createElement(ChatInterface, {
      sessionId: 'test-session',
      onMessageSent: handleMessageSent,
      isLoading: false,
      streamingEnabled: true
    }),
    React.createElement(ProjectExplorer, {
      readonly: false,
      showStatistics: true
    }),
    React.createElement(SessionList, {
      sessions: [],
      currentSessionId: null,
      onSessionSelect: () => {},
      onSessionsChange: () => {}
    })
  ]);
}

export default TestComponents;