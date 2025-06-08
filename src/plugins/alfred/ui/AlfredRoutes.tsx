import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AlfredDashboard } from './components/AlfredDashboard';
import { ChatInterface } from './components/ChatInterface';
import { ProjectExplorer } from './components/ProjectExplorer';
import { TemplateManager } from './components/TemplateManager';

export const AlfredRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<AlfredDashboard />} />
      <Route path="/chat/:sessionId?" element={<ChatInterface />} />
      <Route path="/projects" element={<ProjectExplorer />} />
      <Route path="/templates" element={<TemplateManager />} />
    </Routes>
  );
};