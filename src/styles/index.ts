// Alexandria Platform Styles - Main Export
export * from './globalStyles';

// Re-export for convenience
export { alexandriaGlobalCSS as globalCSS } from './globalStyles';

// CSS file path for direct imports
export const CSS_FILE_PATH = '/src/styles/global.css';

// Quick style injection for immediate use
export function quickStyleSetup(): void {
  import('./globalStyles').then(({ injectAlexandriaStyles }) => {
    injectAlexandriaStyles();
  });
}
