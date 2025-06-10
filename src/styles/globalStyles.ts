// Alexandria Platform - Global CSS Module
// This module exports the global CSS as a string for easy injection into plugins and components

export const alexandriaGlobalCSS = `
/* Import this CSS in your plugin or component to maintain consistent theming */
@import url('/src/styles/global.css');
`;

// Function to inject global styles into a document or shadow DOM
export function injectAlexandriaStyles(target: Document | ShadowRoot = document): void {
  const styleId = 'alexandria-global-styles';
  
  // Check if styles are already injected
  if (target.getElementById(styleId)) {
    return;
  }
  
  // Create style element
  const styleElement = document.createElement('style');
  styleElement.id = styleId;
  
  // Fetch and inject the global CSS
  fetch('/src/styles/global.css')
    .then(response => response.text())
    .then(css => {
      styleElement.textContent = css;
      if (target instanceof Document) {
        target.head.appendChild(styleElement);
      } else {
        target.appendChild(styleElement);
      }
    })
    .catch(error => {
      console.error('Failed to load Alexandria global styles:', error);
    });
}
// Function to apply theme class to a plugin container
export function applyPluginTheme(element: HTMLElement, pluginName: 'alfred' | 'hadron' | 'heimdall'): void {
  element.classList.add('plugin-container', `theme-${pluginName}`);
}

// Function to get CSS variables programmatically
export function getThemeVariable(variableName: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--${variableName}`).trim();
}

// Function to set CSS variables dynamically
export function setThemeVariable(variableName: string, value: string): void {
  document.documentElement.style.setProperty(`--${variableName}`, value);
}

// Predefined theme configurations for plugins
export const pluginThemes = {
  alfred: {
    name: 'ALFRED',
    primaryColor: 'var(--color-alfred)',
    icon: 'fa-solid fa-code'
  },
  hadron: {
    name: 'Hadron',
    primaryColor: 'var(--color-hadron)',
    icon: 'fa-solid fa-file-magnifying-glass'
  },
  heimdall: {
    name: 'Heimdall',
    primaryColor: 'var(--color-heimdall)',
    icon: 'fa-solid fa-chart-bar'
  }
};