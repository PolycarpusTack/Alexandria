/**
 * CSS Asset Generator
 * Handles generation and optimization of CSS assets
 */

import { minify as minifyCSS } from 'csso';
import { ThemeConfig, CSSAssetConfig } from './types';
import { createHash } from 'crypto';

export class CSSGenerator {
  private themes: Map<string, ThemeConfig>;

  constructor() {
    this.initializeThemes();
  }

  /**
   * Generate CSS content based on configuration
   */
  async generateCSS(config: CSSAssetConfig): Promise<string> {
    const cssBlocks: string[] = [];

    // Add reset styles if requested
    if (config.includeResetStyles) {
      cssBlocks.push(this.getResetCSS());
    }

    // Add theme styles
    const themeCSS = this.generateThemeCSS(config.theme);
    cssBlocks.push(themeCSS);

    // Add print styles if requested
    if (config.includePrintStyles) {
      cssBlocks.push(this.getPrintCSS());
    }

    // Add custom CSS if provided
    if (config.customCSS) {
      cssBlocks.push(await this.processCustomCSS(config.customCSS, config.cssScopingPrefix));
    }

    return cssBlocks.join('\n\n');
  }

  /**
   * Generate theme-specific CSS
   */
  generateThemeCSS(themeName: string): string {
    const theme = this.themes.get(themeName) || this.themes.get('minimal')!;
    
    return `
/* Theme: ${theme.name} */
:root {
  --primary-color: ${theme.primaryColor || '#000'};
  --secondary-color: ${theme.secondaryColor || '#666'};
  --background-color: ${theme.backgroundColor || '#fff'};
  --text-color: ${theme.textColor || '#333'};
  --link-color: ${theme.linkColor || '#0066cc'};
  --border-color: ${theme.borderColor || '#e0e0e0'};
  --code-bg: ${theme.codeBackground || '#f5f5f5'};
  --max-width: ${theme.maxWidth || '800px'};
  --font-family: ${theme.fontFamily || "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"};
  --font-mono: ${theme.monospaceFontFamily || "'Consolas', 'Monaco', 'Courier New', monospace"};
}

${this.getBaseStyles()}
${this.getComponentStyles()}
${this.getUtilityStyles()}
`;
  }

  /**
   * Get base/reset CSS styles
   */
  private getResetCSS(): string {
    return `
/* CSS Reset */
*, *::before, *::after {
  box-sizing: border-box;
}

* {
  margin: 0;
}

html, body {
  height: 100%;
}

body {
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

img, picture, video, canvas, svg {
  display: block;
  max-width: 100%;
}

input, button, textarea, select {
  font: inherit;
}

p, h1, h2, h3, h4, h5, h6 {
  overflow-wrap: break-word;
}
`;
  }

  /**
   * Get base styles for all themes
   */
  private getBaseStyles(): string {
    return `
/* Base Styles */
body {
  font-family: var(--font-family);
  color: var(--text-color);
  background: var(--background-color);
  line-height: 1.6;
  margin: 0;
  padding: 0;
}

.container {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 2rem;
}

/* Typography */
h1, h2, h3, h4, h5, h6 {
  color: var(--primary-color);
  margin-top: 2rem;
  margin-bottom: 1rem;
  line-height: 1.2;
}

h1 { font-size: 2.5rem; }
h2 { font-size: 2rem; }
h3 { font-size: 1.75rem; }
h4 { font-size: 1.5rem; }
h5 { font-size: 1.25rem; }
h6 { font-size: 1rem; }

p {
  margin-bottom: 1rem;
}

/* Links */
a {
  color: var(--link-color);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

/* Code */
code {
  font-family: var(--font-mono);
  background: var(--code-bg);
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-size: 0.9em;
}

pre {
  background: var(--code-bg);
  padding: 1rem;
  overflow-x: auto;
  border-radius: 5px;
  line-height: 1.4;
  margin-bottom: 1rem;
}

pre code {
  background: none;
  padding: 0;
}

/* Blockquotes */
blockquote {
  border-left: 4px solid var(--border-color);
  margin: 1rem 0;
  padding-left: 1rem;
  color: var(--secondary-color);
}

/* Tables */
table {
  border-collapse: collapse;
  width: 100%;
  margin: 1rem 0;
}

th, td {
  border: 1px solid var(--border-color);
  padding: 0.5rem;
  text-align: left;
}

th {
  background: var(--code-bg);
  font-weight: 600;
}

/* Images */
img {
  max-width: 100%;
  height: auto;
}
`;
  }

  /**
   * Get component-specific styles
   */
  private getComponentStyles(): string {
    return `
/* Components */
.navigation {
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 2rem;
  padding: 1rem 0;
}

.navigation ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  gap: 2rem;
}

.navigation li {
  margin: 0;
}

.search-box {
  margin: 2rem 0;
}

.search-box input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 1rem;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 1rem 0;
}

.tag {
  background: var(--code-bg);
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  font-size: 0.875rem;
}

.metadata {
  color: var(--secondary-color);
  font-size: 0.875rem;
  margin: 1rem 0;
}

.footer {
  border-top: 1px solid var(--border-color);
  margin-top: 4rem;
  padding-top: 2rem;
  text-align: center;
  color: var(--secondary-color);
}
`;
  }

  /**
   * Get utility styles
   */
  private getUtilityStyles(): string {
    return `
/* Utilities */
.text-center { text-align: center; }
.text-left { text-align: left; }
.text-right { text-align: right; }

.mt-1 { margin-top: 0.5rem; }
.mt-2 { margin-top: 1rem; }
.mt-3 { margin-top: 2rem; }
.mt-4 { margin-top: 3rem; }

.mb-1 { margin-bottom: 0.5rem; }
.mb-2 { margin-bottom: 1rem; }
.mb-3 { margin-bottom: 2rem; }
.mb-4 { margin-bottom: 3rem; }

.hidden { display: none; }
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
`;
  }

  /**
   * Get print-specific styles
   */
  private getPrintCSS(): string {
    return `
/* Print Styles */
@media print {
  body {
    color: #000;
    background: #fff;
  }
  
  .navigation,
  .search-box,
  .footer {
    display: none;
  }
  
  a {
    color: #000;
    text-decoration: underline;
  }
  
  a[href^="http"]:after {
    content: " (" attr(href) ")";
  }
  
  pre {
    white-space: pre-wrap;
  }
  
  @page {
    margin: 2cm;
  }
  
  h1, h2, h3 {
    page-break-after: avoid;
  }
  
  p, blockquote, pre {
    orphans: 3;
    widows: 3;
  }
}
`;
  }

  /**
   * Process and scope custom CSS
   */
  private async processCustomCSS(customCSS: string, scopingPrefix?: string): Promise<string> {
    let processedCSS = customCSS;

    // Add scoping prefix if provided
    if (scopingPrefix) {
      processedCSS = this.scopeCSS(processedCSS, scopingPrefix);
    }

    return `
/* Custom Styles */
${processedCSS}
`;
  }

  /**
   * Scope CSS selectors with a prefix
   */
  private scopeCSS(css: string, prefix: string): string {
    // Simple scoping - in production, use a proper CSS parser
    return css.replace(/^([^{]+){/gm, (match, selector) => {
      const scopedSelector = selector
        .split(',')
        .map((s: string) => `${prefix} ${s.trim()}`)
        .join(', ');
      return `${scopedSelector} {`;
    });
  }

  /**
   * Minify CSS content
   */
  async minifyCSS(css: string): Promise<string> {
    try {
      const result = minifyCSS(css);
      return result.css;
    } catch (error) {
      console.error('CSS minification failed:', error);
      return css; // Return original if minification fails
    }
  }

  /**
   * Generate CSS hash for cache busting
   */
  generateHash(content: string): string {
    return createHash('md5').update(content).digest('hex').substring(0, 8);
  }

  /**
   * Initialize available themes
   */
  private initializeThemes(): void {
    this.themes = new Map([
      ['minimal', {
        name: 'minimal',
        primaryColor: '#000',
        secondaryColor: '#666',
        backgroundColor: '#fff',
        textColor: '#333',
        linkColor: '#0066cc',
        borderColor: '#e0e0e0',
        codeBackground: '#f5f5f5'
      }],
      ['dark', {
        name: 'dark',
        primaryColor: '#fff',
        secondaryColor: '#aaa',
        backgroundColor: '#1a1a1a',
        textColor: '#e0e0e0',
        linkColor: '#66b3ff',
        borderColor: '#333',
        codeBackground: '#2a2a2a'
      }],
      ['academic', {
        name: 'academic',
        primaryColor: '#2c3e50',
        secondaryColor: '#7f8c8d',
        backgroundColor: '#fff',
        textColor: '#34495e',
        linkColor: '#3498db',
        borderColor: '#ecf0f1',
        codeBackground: '#f8f9fa',
        fontFamily: "'Georgia', 'Times New Roman', serif"
      }]
    ]);
  }
}