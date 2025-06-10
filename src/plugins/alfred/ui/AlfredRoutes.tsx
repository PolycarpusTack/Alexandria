import React from 'react';
import { Routes, Route, useParams } from 'react-router-dom';
import { AlfredDashboard } from './components/AlfredDashboard';
import { ChatInterface } from './components/ChatInterface';
import { ProjectExplorer } from './components/ProjectExplorer';
import { TemplateManager } from './components/TemplateManager';

// Wrapper component to extract route params for ChatInterface
const ChatInterfaceWrapper: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  return <ChatInterface sessionId={sessionId || 'default'} />;
};

export const AlfredRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<AlfredDashboard />} />
      <Route path="/chat/:sessionId?" element={<ChatInterfaceWrapper />} />
      <Route path="/projects" element={<ProjectExplorer />} />
      <Route path="/templates" element={<TemplateManager />} />
    </Routes>
  );
};