/**
 * Client Application entry point for the Alexandria Platform
 * 
 * This file bootstraps the React client application for the platform.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import App from './App';
import { UIRegistryImpl, UIContextProvider } from './components/ui';
import { ThemeProvider } from './components/theme-provider';
import StyledThemeProvider from './styles/ThemeProvider';
import { createClientLogger } from './utils/client-logger';
import './global.css';

// Create UI Registry
const uiRegistry = new UIRegistryImpl(
  createClientLogger({
    level: 'debug',
    serviceName: 'alexandria-ui'
  })
);

// Get the root element
const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

// Render the app
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system">
      <StyledThemeProvider>
        <Router>
          <UIContextProvider uiRegistry={uiRegistry}>
            <App />
          </UIContextProvider>
        </Router>
      </StyledThemeProvider>
    </ThemeProvider>
  </React.StrictMode>
);

