/**
 * UI Shell component for the Alexandria Platform
 * 
 * This component provides the main shell UI that contains the navigation,
 * header, footer, and content areas where plugins can contribute UI elements.
 */

import React from 'react';
import { UIShellProps, UIComponentPosition } from '../interfaces';
import { UIContextProvider, useUI } from '../ui-context';
import styled, { ThemeProvider, createGlobalStyle } from 'styled-components';

// Global styles
const GlobalStyle = createGlobalStyle`
  html, body, #root {
    height: 100%;
    margin: 0;
    padding: 0;
    font-family: ${props => props.theme.typography.fontFamily};
    font-size: ${props => props.theme.typography.fontSize.md};
    color: ${props => props.theme.colors.text.primary};
    background-color: ${props => props.theme.colors.background};
  }
  
  * {
    box-sizing: border-box;
  }
  
  a {
    color: ${props => props.theme.colors.primary};
    text-decoration: none;
    
    &:hover {
      text-decoration: underline;
    }
  }
`;

// Styled components
const Shell = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  max-width: 100vw;
`;

const Header = styled.header`
  display: flex;
  align-items: center;
  padding: ${props => props.theme.spacing.md};
  background-color: ${props => props.theme.colors.surface};
  box-shadow: ${props => props.theme.shadows.sm};
  z-index: ${props => props.theme.zIndex.sticky};
  height: 64px;
`;

const Logo = styled.div`
  font-size: ${props => props.theme.typography.fontSize.lg};
  font-weight: ${props => props.theme.typography.fontWeight.bold};
  color: ${props => props.theme.colors.primary};
  margin-right: ${props => props.theme.spacing.lg};
`;

const HeaderContent = styled.div`
  display: flex;
  align-items: center;
  flex: 1;
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.sm};
`;

const Main = styled.div`
  display: flex;
  flex: 1;
`;

const Sidebar = styled.aside`
  width: 250px;
  background-color: ${props => props.theme.colors.surface};
  border-right: 1px solid ${props => props.theme.colors.border};
  padding: ${props => props.theme.spacing.md};
  
  @media (max-width: 768px) {
    width: 200px;
  }
`;

const Content = styled.main`
  flex: 1;
  padding: ${props => props.theme.spacing.lg};
  overflow-y: auto;
`;

const Footer = styled.footer`
  padding: ${props => props.theme.spacing.md};
  background-color: ${props => props.theme.colors.surface};
  border-top: 1px solid ${props => props.theme.colors.border};
  text-align: center;
  color: ${props => props.theme.colors.text.secondary};
  font-size: ${props => props.theme.typography.fontSize.sm};
`;

/**
 * Shell wrapper component
 */
export const UIShell: React.FC<UIShellProps> = ({ uiRegistry, children }) => {
  return (
    <UIContextProvider uiRegistry={uiRegistry}>
      <ShellContent>{children}</ShellContent>
    </UIContextProvider>
  );
};

/**
 * Shell content component
 */
const ShellContent: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { theme, uiRegistry, toggleDarkMode, darkMode } = useUI();
  
  // Get components by position
  const headerComponents = uiRegistry.getComponentsByPosition(UIComponentPosition.HEADER);
  const sidebarComponents = uiRegistry.getComponentsByPosition(UIComponentPosition.SIDEBAR);
  const footerComponents = uiRegistry.getComponentsByPosition(UIComponentPosition.FOOTER);
  
  // Render component
  const renderComponent = (componentDef: ReturnType<typeof uiRegistry.getComponentsByPosition>[0]) => {
    const Component = componentDef.component;
    return <Component key={componentDef.id} {...(componentDef.props || {})} />;
  };
  
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <Shell>
        <Header>
          <Logo>Alexandria</Logo>
          <HeaderContent>
            {headerComponents.map(renderComponent)}
          </HeaderContent>
          <HeaderActions>
            <button onClick={toggleDarkMode}>
              {darkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
          </HeaderActions>
        </Header>
        <Main>
          <Sidebar>
            {sidebarComponents.map(renderComponent)}
          </Sidebar>
          <Content>
            {children}
          </Content>
        </Main>
        <Footer>
          {footerComponents.length > 0 ? (
            footerComponents.map(renderComponent)
          ) : (
            <div>Alexandria Platform &copy; {new Date().getFullYear()}</div>
          )}
        </Footer>
      </Shell>
    </ThemeProvider>
  );
};

export default UIShell;