/**
 * Theme Provider component for the Alexandria Platform
 *
 * This component provides the styled-components theme to the application.
 */

import React from 'react';
import theme from './theme';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  return <StyledThemeProvider theme={theme}>{children}</StyledThemeProvider>;
};

export default ThemeProvider;
