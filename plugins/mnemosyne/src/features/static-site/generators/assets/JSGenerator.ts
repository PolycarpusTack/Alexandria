/**
 * JavaScript Asset Generator
 * Handles generation and optimization of JavaScript assets
 */

import { minify } from 'terser';
import { JSAssetConfig } from './types';
import { createHash } from 'crypto';

export class JSGenerator {
  /**
   * Generate JavaScript content based on configuration
   */
  async generateJS(config: JSAssetConfig): Promise<string> {
    const jsModules: string[] = [];

    // Add module wrapper based on format
    const moduleStart = this.getModuleStart(config.moduleFormat || 'iife');
    const moduleEnd = this.getModuleEnd(config.moduleFormat || 'iife');

    jsModules.push(moduleStart);

    // Add search functionality
    if (config.includeSearch) {
      jsModules.push(this.generateSearchJS());
    }

    // Add navigation functionality
    if (config.includeNavigation) {
      jsModules.push(this.generateNavigationJS());
    }

    // Add analytics
    if (config.includeAnalytics && config.analyticsId) {
      jsModules.push(this.generateAnalyticsJS(config.analyticsId));
    }

    // Add graph visualization
    if (config.includeGraph) {
      jsModules.push(this.generateGraphJS());
    }

    // Add custom JavaScript
    if (config.customJS) {
      jsModules.push(await this.processCustomJS(config.customJS));
    }

    jsModules.push(moduleEnd);

    return jsModules.join('\n\n');
  }

  /**
   * Generate search functionality JavaScript
   */
  private generateSearchJS(): string {
    return `
/* Search Module */
const Search = (function() {
  let searchIndex = null;
  let searchInput = null;
  let searchResults = null;

  async function init() {
    searchInput = document.getElementById('search-input');
    searchResults = document.getElementById('search-results');
    
    if (!searchInput || !searchResults) return;
    
    // Load search index
    try {
      const response = await fetch('/search-index.json');
      searchIndex = await response.json();
    } catch (error) {
      console.error('Failed to load search index:', error);
      return;
    }
    
    // Setup event listeners
    searchInput.addEventListener('input', debounce(handleSearch, 300));
    searchInput.addEventListener('focus', () => searchResults.classList.add('active'));
    document.addEventListener('click', handleClickOutside);
  }

  function handleSearch(event) {
    const query = event.target.value.toLowerCase().trim();
    
    if (!query) {
      clearResults();
      return;
    }
    
    const results = performSearch(query);
    displayResults(results);
  }

  function performSearch(query) {
    if (!searchIndex) return [];
    
    const terms = query.split(/\\s+/);
    const results = [];
    
    for (const item of searchIndex) {
      let score = 0;
      const titleLower = item.title.toLowerCase();
      const contentLower = (item.content || '').toLowerCase();
      const tagsLower = (item.tags || []).map(t => t.toLowerCase());
      
      // Score based on matches
      for (const term of terms) {
        if (titleLower.includes(term)) score += 10;
        if (contentLower.includes(term)) score += 5;
        if (tagsLower.some(tag => tag.includes(term))) score += 3;
      }
      
      if (score > 0) {
        results.push({ ...item, score });
      }
    }
    
    // Sort by score
    return results.sort((a, b) => b.score - a.score).slice(0, 10);
  }

  function displayResults(results) {
    if (results.length === 0) {
      searchResults.innerHTML = '<div class="search-no-results">No results found</div>';
      return;
    }
    
    const html = results.map(result => \`
      <a href="\${result.url}" class="search-result">
        <div class="search-result-title">\${escapeHtml(result.title)}</div>
        <div class="search-result-excerpt">\${escapeHtml(result.excerpt || '')}</div>
      </a>
    \`).join('');
    
    searchResults.innerHTML = html;
  }

  function clearResults() {
    searchResults.innerHTML = '';
    searchResults.classList.remove('active');
  }

  function handleClickOutside(event) {
    if (!searchInput.contains(event.target) && !searchResults.contains(event.target)) {
      clearResults();
    }
  }

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  function escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  return { init };
})();
`;
  }

  /**
   * Generate navigation JavaScript
   */
  private generateNavigationJS(): string {
    return `
/* Navigation Module */
const Navigation = (function() {
  let mobileMenuButton = null;
  let navigationMenu = null;
  let currentPath = null;

  function init() {
    currentPath = window.location.pathname;
    mobileMenuButton = document.getElementById('mobile-menu-button');
    navigationMenu = document.getElementById('navigation-menu');
    
    if (mobileMenuButton && navigationMenu) {
      mobileMenuButton.addEventListener('click', toggleMobileMenu);
    }
    
    highlightCurrentPage();
    setupSmoothScroll();
  }

  function toggleMobileMenu() {
    navigationMenu.classList.toggle('active');
    mobileMenuButton.classList.toggle('active');
    document.body.classList.toggle('menu-open');
  }

  function highlightCurrentPage() {
    const links = document.querySelectorAll('.navigation a');
    links.forEach(link => {
      if (link.getAttribute('href') === currentPath) {
        link.classList.add('active');
      }
    });
  }

  function setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      });
    });
  }

  return { init };
})();
`;
  }

  /**
   * Generate analytics JavaScript
   */
  private generateAnalyticsJS(analyticsId: string): string {
    return `
/* Analytics Module */
const Analytics = (function() {
  const analyticsId = '${analyticsId}';
  
  function init() {
    // Google Analytics
    if (analyticsId.startsWith('G-') || analyticsId.startsWith('UA-')) {
      loadGoogleAnalytics();
    }
    
    // Track page views
    trackPageView();
    
    // Track outbound links
    setupLinkTracking();
  }

  function loadGoogleAnalytics() {
    const script = document.createElement('script');
    script.async = true;
    script.src = \`https://www.googletagmanager.com/gtag/js?id=\${analyticsId}\`;
    document.head.appendChild(script);
    
    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    gtag('js', new Date());
    gtag('config', analyticsId);
    window.gtag = gtag;
  }

  function trackPageView() {
    if (window.gtag) {
      gtag('event', 'page_view', {
        page_path: window.location.pathname,
        page_title: document.title
      });
    }
  }

  function setupLinkTracking() {
    document.addEventListener('click', function(e) {
      const link = e.target.closest('a');
      if (link && link.hostname !== window.location.hostname) {
        trackEvent('click', 'outbound', link.href);
      }
    });
  }

  function trackEvent(action, category, label, value) {
    if (window.gtag) {
      gtag('event', action, {
        event_category: category,
        event_label: label,
        value: value
      });
    }
  }

  return { init, trackEvent };
})();
`;
  }

  /**
   * Generate graph visualization JavaScript
   */
  private generateGraphJS(): string {
    return `
/* Graph Visualization Module */
const KnowledgeGraph = (function() {
  let container = null;
  let graphData = null;

  async function init() {
    container = document.getElementById('knowledge-graph');
    if (!container) return;
    
    try {
      const response = await fetch('/graph-data.json');
      graphData = await response.json();
      renderGraph();
    } catch (error) {
      console.error('Failed to load graph data:', error);
    }
  }

  function renderGraph() {
    // This is a simplified version - in production, use D3.js or similar
    const width = container.offsetWidth;
    const height = 400;
    
    const svg = createSVG(width, height);
    container.appendChild(svg);
    
    // Simple force simulation
    const nodes = graphData.nodes;
    const links = graphData.links;
    
    // Position nodes
    nodes.forEach((node, i) => {
      node.x = Math.random() * width;
      node.y = Math.random() * height;
    });
    
    // Draw links
    links.forEach(link => {
      const line = createLine(
        nodes[link.source],
        nodes[link.target]
      );
      svg.appendChild(line);
    });
    
    // Draw nodes
    nodes.forEach(node => {
      const circle = createNode(node);
      svg.appendChild(circle);
    });
  }

  function createSVG(width, height) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', \`0 0 \${width} \${height}\`);
    return svg;
  }

  function createNode(node) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', node.x);
    circle.setAttribute('cy', node.y);
    circle.setAttribute('r', '5');
    circle.setAttribute('fill', '#0066cc');
    
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', node.x + 10);
    text.setAttribute('y', node.y);
    text.setAttribute('font-size', '12');
    text.textContent = node.label;
    
    g.appendChild(circle);
    g.appendChild(text);
    
    return g;
  }

  function createLine(source, target) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', source.x);
    line.setAttribute('y1', source.y);
    line.setAttribute('x2', target.x);
    line.setAttribute('y2', target.y);
    line.setAttribute('stroke', '#ccc');
    line.setAttribute('stroke-width', '1');
    return line;
  }

  return { init };
})();
`;
  }

  /**
   * Process custom JavaScript
   */
  private async processCustomJS(customJS: string): Promise<string> {
    return `
/* Custom JavaScript */
${customJS}
`;
  }

  /**
   * Get module wrapper start
   */
  private getModuleStart(format: 'iife' | 'esm' | 'umd'): string {
    switch (format) {
      case 'iife':
        return '(function() {\n"use strict";';
      case 'esm':
        return '';
      case 'umd':
        return `(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MnemosyneSite = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  "use strict";`;
      default:
        return '';
    }
  }

  /**
   * Get module wrapper end
   */
  private getModuleEnd(format: 'iife' | 'esm' | 'umd'): string {
    switch (format) {
      case 'iife':
        return `
// Initialize modules
document.addEventListener('DOMContentLoaded', function() {
  if (typeof Search !== 'undefined') Search.init();
  if (typeof Navigation !== 'undefined') Navigation.init();
  if (typeof Analytics !== 'undefined') Analytics.init();
  if (typeof KnowledgeGraph !== 'undefined') KnowledgeGraph.init();
});

})();`;
      case 'esm':
        return `
export { Search, Navigation, Analytics, KnowledgeGraph };`;
      case 'umd':
        return `
  return {
    Search,
    Navigation,
    Analytics,
    KnowledgeGraph
  };
}));`;
      default:
        return '';
    }
  }

  /**
   * Minify JavaScript content
   */
  async minifyJS(js: string, generateSourceMap = false): Promise<{
    code: string;
    map?: string;
  }> {
    try {
      const result = await minify(js, {
        sourceMap: generateSourceMap ? {
          filename: 'bundle.js',
          url: 'bundle.js.map'
        } : false,
        compress: {
          drop_console: true,
          drop_debugger: true
        },
        mangle: true
      });

      return {
        code: result.code || js,
        map: result.map as string | undefined
      };
    } catch (error) {
      console.error('JavaScript minification failed:', error);
      return { code: js };
    }
  }

  /**
   * Generate JavaScript hash for cache busting
   */
  generateHash(content: string): string {
    return createHash('md5').update(content).digest('hex').substring(0, 8);
  }
}