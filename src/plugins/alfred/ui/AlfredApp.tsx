import React from 'react';
import { AlfredProvider } from './hooks/useAlfredContext';
import { AlfredRoutes } from './AlfredRoutes';
import './styles/alfred-enhanced.css';

export const AlfredApp: React.FC = () => {
  return (
    <AlfredProvider>
      <AlfredRoutes />
    </AlfredProvider>
  );
};