/**
 * Performance-Optimized Mustache Compiler
 * 
 * High-performance template compilation with aggressive caching and optimization
 * Supports template pre-compilation, context analysis, and parallel rendering
 */

import { Logger } from '../../../../../utils/logger';
import { VariableMap, PerformanceMetrics, RenderedFile } from './interfaces';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

// Lightweight Mustache implementation (no external dependencies for security)
interface MustacheToken {
  type: 'text' | 'variable' | 'section' | 'inverted' | 'comment' | 'partial';
  value: string;
  start: number;
  end: number;
  children?: MustacheToken[];
}

interface CompiledTemplate {
  id: string;
  source: string;
  tokens: MustacheToken[];
  hash: string;
  compiledAt: Date;
  renderFunction: (context: VariableMap) => string;
  usageCount: number;
  lastUsed: Date;
  dependencies: Set<string>; // Variable dependencies
}

interface CacheOptions {
  maxSize: number; // Maximum cache size in MB
  maxEntries: number; // Maximum number of cached templates
  ttl: number; // Time to live in milliseconds
  enablePrecompilation: boolean;
  enableParallelRendering: boolean;
}

interface RenderOptions {
  enableCaching: boolean;
  timeout: number; // Render timeout in milliseconds
  contextValidation: boolean;
  partialResolver?: (name: string) => Promise<string>;
}

export class PerformanceOptimizedMustacheCompiler {
  private logger: Logger;
  private templateCache: Map<string, CompiledTemplate> = new Map();
  private renderCache: Map<string, { result: string; timestamp: Date }> = new Map();
  private options: Required<CacheOptions>;
  private renderOptions: Required<Omit<RenderOptions, 'partialResolver'>> & Pick<RenderOptions, 'partialResolver'>;

  // Performance tracking
  private metrics = {
    compilations: 0,
    cacheHits: 0,
    cacheMisses: 0,
    renderTime: 0,
    parseTime: 0,
    memoryUsage: 0
  };

  constructor(
    logger: Logger,
    cacheOptions: Partial<CacheOptions> = {},
    renderOptions: Partial<RenderOptions> = {}
  ) {
    this.logger = logger;
    
    this.options = {
      maxSize: cacheOptions.maxSize || 50, // 50MB
      maxEntries: cacheOptions.maxEntries || 1000,
      ttl: cacheOptions.ttl || 60 * 60 * 1000, // 1 hour
      enablePrecompilation: cacheOptions.enablePrecompilation ?? true,
      enableParallelRendering: cacheOptions.enableParallelRendering ?? true
    };

    this.renderOptions = {
      enableCaching: renderOptions.enableCaching ?? true,
      timeout: renderOptions.timeout || 30000, // 30 seconds
      contextValidation: renderOptions.contextValidation ?? true,
      partialResolver: renderOptions.partialResolver
    };

    // Setup periodic cache cleanup
    this.setupCacheCleanup();
  }

  /**
   * Compile template with aggressive caching and optimization
   */
  async compileTemplate(templateId: string, source: string): Promise<CompiledTemplate> {
    const startTime = Date.now();

    // Check cache first
    const cached = this.templateCache.get(templateId);
    if (cached && this.isCacheValid(cached)) {
      cached.usageCount++;
      cached.lastUsed = new Date();
      this.metrics.cacheHits++;
      
      this.logger.debug('Template cache hit', { 
        templateId, 
        usageCount: cached.usageCount,
        age: Date.now() - cached.compiledAt.getTime()
      });
      
      return cached;
    }

    this.metrics.cacheMisses++;

    // Generate unique hash for the template
    const hash = this.generateTemplateHash(source);

    // Check if we already have this exact template compiled under different ID
    for (const [id, template] of this.templateCache.entries()) {
      if (template.hash === hash && this.isCacheValid(template)) {
        // Clone the cached template with new ID
        const cloned: CompiledTemplate = {
          ...template,
          id: templateId,
          usageCount: template.usageCount + 1,
          lastUsed: new Date()
        };
        
        this.templateCache.set(templateId, cloned);
        this.metrics.cacheHits++;
        
        this.logger.debug('Template hash match found', { templateId, originalId: id });
        return cloned;
      }
    }

    try {
      // Parse template tokens
      const parseStartTime = Date.now();
      const tokens = this.parseTemplate(source);
      this.metrics.parseTime += Date.now() - parseStartTime;

      // Pre-compile render function for performance
      const renderFunction = this.options.enablePrecompilation
        ? this.compileRenderFunction(tokens)
        : (context: VariableMap) => this.renderTokens(tokens, context);

      // Extract variable dependencies
      const dependencies = this.extractDependencies(tokens);

      const compiled: CompiledTemplate = {
        id: templateId,
        source,
        tokens,
        hash,
        compiledAt: new Date(),
        renderFunction,
        usageCount: 1,
        lastUsed: new Date(),
        dependencies
      };

      // Manage cache size before adding
      this.manageCacheSize();
      this.templateCache.set(templateId, compiled);
      this.metrics.compilations++;

      const duration = Date.now() - startTime;
      this.logger.info('Template compiled successfully', {
        templateId,
        tokenCount: this.countTokens(tokens),
        dependencies: dependencies.size,
        duration: `${duration}ms`
      });

      return compiled;

    } catch (error) {
      this.logger.error('Template compilation failed', { templateId, error });
      throw new Error(`Template compilation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Render template with context and caching
   */
  async renderTemplate(
    templateId: string,
    context: VariableMap,
    options: Partial<RenderOptions> = {}
  ): Promise<{ content: string; performance: PerformanceMetrics }> {
    const startTime = Date.now();
    const renderOpts = { ...this.renderOptions, ...options };

    try {
      // Validate context if enabled
      if (renderOpts.contextValidation) {
        this.validateContext(context);
      }

      // Check render cache
      const cacheKey = this.generateRenderCacheKey(templateId, context);
      if (renderOpts.enableCaching) {
        const cached = this.renderCache.get(cacheKey);
        if (cached && this.isRenderCacheValid(cached)) {
          this.logger.debug('Render cache hit', { templateId, cacheKey: cacheKey.substring(0, 16) });
          return {
            content: cached.result,
            performance: {
              parseTime: 0,
              renderTime: Date.now() - startTime,
              totalTime: Date.now() - startTime,
              memoryUsage: cached.result.length * 2,
              filesGenerated: 1,
              cacheHits: 1,
              cacheMisses: 0
            }
          };
        }
      }

      // Get compiled template
      const template = this.templateCache.get(templateId);
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      // Set render timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Template render timeout')), renderOpts.timeout);
      });

      // Render with timeout protection
      const renderPromise = this.performRender(template, context, renderOpts);
      const content = await Promise.race([renderPromise, timeoutPromise]);

      // Cache result
      if (renderOpts.enableCaching) {
        this.renderCache.set(cacheKey, {
          result: content,
          timestamp: new Date()
        });
      }

      const totalTime = Date.now() - startTime;
      this.metrics.renderTime += totalTime;

      const performance: PerformanceMetrics = {
        parseTime: 0, // Already compiled
        renderTime: totalTime,
        totalTime,
        memoryUsage: content.length * 2, // Rough estimation
        filesGenerated: 1,
        cacheHits: 0,
        cacheMisses: 1
      };

      this.logger.debug('Template rendered successfully', {
        templateId,
        contentLength: content.length,
        renderTime: `${totalTime}ms`
      });

      return { content, performance };

    } catch (error) {
      this.logger.error('Template render failed', { templateId, error });
      throw new Error(`Template render failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Batch render multiple templates in parallel
   */
  async renderTemplates(
    templates: Array<{ id: string; context: VariableMap }>,
    options: Partial<RenderOptions> = {}
  ): Promise<Map<string, RenderedFile>> {
    if (!this.options.enableParallelRendering) {
      // Sequential rendering fallback
      const results = new Map<string, RenderedFile>();
      for (const template of templates) {
        const result = await this.renderTemplate(template.id, template.context, options);
        results.set(template.id, {
          path: template.id,
          content: result.content,
          language: this.detectLanguage(template.id),
          size: result.content.length,
          checksum: this.generateChecksum(result.content)
        });
      }
      return results;
    }

    // Parallel rendering with concurrency control
    const batchSize = 10; // Limit concurrent renders
    const results = new Map<string, RenderedFile>();

    for (let i = 0; i < templates.length; i += batchSize) {
      const batch = templates.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (template) => {
        try {
          const result = await this.renderTemplate(template.id, template.context, options);
          return {
            id: template.id,
            file: {
              path: template.id,
              content: result.content,
              language: this.detectLanguage(template.id),
              size: result.content.length,
              checksum: this.generateChecksum(result.content)
            }
          };
        } catch (error) {
          this.logger.error('Batch render failed for template', { id: template.id, error });
          throw error;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      for (const { id, file } of batchResults) {
        results.set(id, file);
      }
    }

    this.logger.info('Batch template rendering completed', {
      templateCount: templates.length,
      successCount: results.size
    });

    return results;
  }

  /**
   * Parse Mustache template into tokens
   */
  private parseTemplate(source: string): MustacheToken[] {
    const tokens: MustacheToken[] = [];
    const openTag = '{{';
    const closeTag = '}}';
    
    let position = 0;
    let line = 1;

    while (position < source.length) {
      const openIndex = source.indexOf(openTag, position);
      
      if (openIndex === -1) {
        // No more tags, add remaining text
        if (position < source.length) {
          tokens.push({
            type: 'text',
            value: source.substring(position),
            start: position,
            end: source.length
          });
        }
        break;
      }

      // Add text before tag
      if (openIndex > position) {
        tokens.push({
          type: 'text',
          value: source.substring(position, openIndex),
          start: position,
          end: openIndex
        });
      }

      // Find closing tag
      const closeIndex = source.indexOf(closeTag, openIndex + openTag.length);
      if (closeIndex === -1) {
        throw new Error(`Unclosed tag at position ${openIndex}`);
      }

      // Extract tag content
      const tagContent = source.substring(openIndex + openTag.length, closeIndex).trim();
      const tagStart = openIndex;
      const tagEnd = closeIndex + closeTag.length;

      // Parse tag type and value
      let type: MustacheToken['type'] = 'variable';
      let value = tagContent;

      if (tagContent.startsWith('#')) {
        type = 'section';
        value = tagContent.substring(1).trim();
      } else if (tagContent.startsWith('^')) {
        type = 'inverted';
        value = tagContent.substring(1).trim();
      } else if (tagContent.startsWith('/')) {
        type = 'section'; // Closing section - will be handled during nesting
        value = tagContent.substring(1).trim();
      } else if (tagContent.startsWith('!')) {
        type = 'comment';
        value = tagContent.substring(1).trim();
      } else if (tagContent.startsWith('>')) {
        type = 'partial';
        value = tagContent.substring(1).trim();
      } else if (tagContent.startsWith('&') || tagContent.startsWith('{')) {
        type = 'variable'; // Unescaped variable
        value = tagContent.replace(/^[&{]/, '').replace(/}$/, '').trim();
      }

      tokens.push({
        type,
        value,
        start: tagStart,
        end: tagEnd
      });

      position = tagEnd;
    }

    return this.nestSections(tokens);
  }

  /**
   * Nest section tokens for proper rendering
   */
  private nestSections(tokens: MustacheToken[]): MustacheToken[] {
    const nested: MustacheToken[] = [];
    const stack: MustacheToken[] = [];

    for (const token of tokens) {
      if (token.type === 'section' && !token.value.startsWith('/')) {
        // Opening section
        token.children = [];
        stack.push(token);
        
        if (stack.length === 1) {
          nested.push(token);
        } else {
          stack[stack.length - 2].children!.push(token);
        }
      } else if (token.type === 'section' && token.value.startsWith('/')) {
        // Closing section
        const sectionName = token.value.substring(1);
        const current = stack.pop();
        
        if (!current || current.value !== sectionName) {
          throw new Error(`Mismatched section: expected ${current?.value}, got ${sectionName}`);
        }
      } else {
        // Regular token
        if (stack.length > 0) {
          stack[stack.length - 1].children!.push(token);
        } else {
          nested.push(token);
        }
      }
    }

    if (stack.length > 0) {
      throw new Error(`Unclosed sections: ${stack.map(s => s.value).join(', ')}`);
    }

    return nested;
  }

  /**
   * Compile render function for performance
   */
  private compileRenderFunction(tokens: MustacheToken[]): (context: VariableMap) => string {
    // Generate optimized JavaScript function
    const functionBody = this.generateRenderCode(tokens);
    
    try {
      // Create function with safe context access
      return new Function('context', 'helpers', `
        'use strict';
        const escapeHtml = helpers.escapeHtml;
        const getValue = helpers.getValue;
        const isTruthy = helpers.isTruthy;
        
        ${functionBody}
      `).bind(null, undefined, {
        escapeHtml: this.escapeHtml.bind(this),
        getValue: this.getValue.bind(this),
        isTruthy: this.isTruthy.bind(this)
      });
    } catch (error) {
      this.logger.warn('Failed to compile render function, using interpreter', { error });
      return (context: VariableMap) => this.renderTokens(tokens, context);
    }
  }

  /**
   * Generate JavaScript code for template rendering
   */
  private generateRenderCode(tokens: MustacheToken[]): string {
    const code: string[] = [];
    code.push('let result = "";');

    const generateTokenCode = (tokens: MustacheToken[], depth = 0): void => {
      for (const token of tokens) {
        switch (token.type) {
          case 'text':
            code.push(`result += ${JSON.stringify(token.value)};`);
            break;
            
          case 'variable':
            code.push(`result += escapeHtml(getValue(context, ${JSON.stringify(token.value)}));`);
            break;
            
          case 'section':
            const varName = `section_${depth}_${Math.random().toString(36).substring(2)}`;
            code.push(`const ${varName} = getValue(context, ${JSON.stringify(token.value)});`);
            code.push(`if (isTruthy(${varName})) {`);
            code.push(`  if (Array.isArray(${varName})) {`);
            code.push(`    for (const item of ${varName}) {`);
            code.push(`      const oldContext = context;`);
            code.push(`      context = { ...context, ...item };`);
            if (token.children) generateTokenCode(token.children, depth + 1);
            code.push(`      context = oldContext;`);
            code.push(`    }`);
            code.push(`  } else {`);
            if (token.children) generateTokenCode(token.children, depth + 1);
            code.push(`  }`);
            code.push(`}`);
            break;
            
          case 'inverted':
            const invertedVarName = `inverted_${depth}_${Math.random().toString(36).substring(2)}`;
            code.push(`const ${invertedVarName} = getValue(context, ${JSON.stringify(token.value)});`);
            code.push(`if (!isTruthy(${invertedVarName})) {`);
            if (token.children) generateTokenCode(token.children, depth + 1);
            code.push(`}`);
            break;
            
          case 'comment':
            // Comments are ignored
            break;
            
          case 'partial':
            // Partials would need special handling - skip for now
            code.push(`// Partial: ${token.value}`);
            break;
        }
      }
    };

    generateTokenCode(tokens);
    code.push('return result;');
    
    return code.join('\n');
  }

  /**
   * Render tokens using interpreter (fallback method)
   */
  private renderTokens(tokens: MustacheToken[], context: VariableMap): string {
    let result = '';

    for (const token of tokens) {
      switch (token.type) {
        case 'text':
          result += token.value;
          break;
          
        case 'variable':
          const value = this.getValue(context, token.value);
          result += this.escapeHtml(value);
          break;
          
        case 'section':
          const sectionValue = this.getValue(context, token.value);
          if (this.isTruthy(sectionValue)) {
            if (Array.isArray(sectionValue)) {
              for (const item of sectionValue) {
                const newContext = { ...context, ...item };
                result += this.renderTokens(token.children || [], newContext);
              }
            } else {
              result += this.renderTokens(token.children || [], context);
            }
          }
          break;
          
        case 'inverted':
          const invertedValue = this.getValue(context, token.value);
          if (!this.isTruthy(invertedValue)) {
            result += this.renderTokens(token.children || [], context);
          }
          break;
          
        case 'comment':
          // Comments are ignored
          break;
          
        case 'partial':
          // Partials would need special handling
          result += `<!-- Partial: ${token.value} -->`;
          break;
      }
    }

    return result;
  }

  /**
   * Perform the actual rendering
   */
  private async performRender(
    template: CompiledTemplate,
    context: VariableMap,
    options: Required<Omit<RenderOptions, 'partialResolver'>> & Pick<RenderOptions, 'partialResolver'>
  ): Promise<string> {
    try {
      return template.renderFunction(context);
    } catch (error) {
      this.logger.error('Render function failed, falling back to interpreter', { 
        templateId: template.id, 
        error 
      });
      return this.renderTokens(template.tokens, context);
    }
  }

  /**
   * Extract variable dependencies from tokens
   */
  private extractDependencies(tokens: MustacheToken[]): Set<string> {
    const dependencies = new Set<string>();

    const extractFromTokens = (tokens: MustacheToken[]): void => {
      for (const token of tokens) {
        if (token.type === 'variable' || token.type === 'section' || token.type === 'inverted') {
          dependencies.add(token.value);
        }
        if (token.children) {
          extractFromTokens(token.children);
        }
      }
    };

    extractFromTokens(tokens);
    return dependencies;
  }

  /**
   * Get value from context with dot notation support
   */
  private getValue(context: VariableMap, path: string): any {
    if (!path) return undefined;
    
    const keys = path.split('.');
    let value: any = context;
    
    for (const key of keys) {
      if (value == null) return undefined;
      value = value[key];
    }
    
    return value;
  }

  /**
   * Check if value is truthy for Mustache logic
   */
  private isTruthy(value: any): boolean {
    if (value == null) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value.length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return !!value;
  }

  /**
   * Escape HTML characters
   */
  private escapeHtml(value: any): string {
    if (value == null) return '';
    
    const str = String(value);
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Generate template hash
   */
  private generateTemplateHash(source: string): string {
    return crypto.createHash('sha256').update(source).digest('hex');
  }

  /**
   * Generate render cache key
   */
  private generateRenderCacheKey(templateId: string, context: VariableMap): string {
    const contextStr = JSON.stringify(context, Object.keys(context).sort());
    return crypto.createHash('sha256').update(`${templateId}:${contextStr}`).digest('hex');
  }

  /**
   * Generate content checksum
   */
  private generateChecksum(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Detect language from filename
   */
  private detectLanguage(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const langMap: Record<string, string> = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'tsx',
      '.jsx': 'jsx',
      '.py': 'python',
      '.java': 'java',
      '.c': 'c',
      '.cpp': 'cpp',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby',
      '.cs': 'csharp',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.json': 'json',
      '.xml': 'xml',
      '.yml': 'yaml',
      '.yaml': 'yaml',
      '.md': 'markdown',
      '.sh': 'bash',
      '.bat': 'batch',
      '.ps1': 'powershell'
    };
    
    return langMap[ext] || 'text';
  }

  /**
   * Validate rendering context
   */
  private validateContext(context: VariableMap): void {
    if (context == null) {
      throw new Error('Render context cannot be null or undefined');
    }
    
    if (typeof context !== 'object') {
      throw new Error('Render context must be an object');
    }

    // Check for potentially dangerous values
    const checkValue = (value: any, path: string): void => {
      if (typeof value === 'function') {
        throw new Error(`Function values not allowed in context: ${path}`);
      }
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [key, val] of Object.entries(value)) {
          checkValue(val, `${path}.${key}`);
        }
      }
    };

    for (const [key, value] of Object.entries(context)) {
      checkValue(value, key);
    }
  }

  /**
   * Check if template cache entry is valid
   */
  private isCacheValid(template: CompiledTemplate): boolean {
    const age = Date.now() - template.compiledAt.getTime();
    return age < this.options.ttl;
  }

  /**
   * Check if render cache entry is valid
   */
  private isRenderCacheValid(cached: { result: string; timestamp: Date }): boolean {
    const age = Date.now() - cached.timestamp.getTime();
    return age < this.options.ttl / 2; // Render cache has shorter TTL
  }

  /**
   * Count tokens recursively
   */
  private countTokens(tokens: MustacheToken[]): number {
    let count = tokens.length;
    for (const token of tokens) {
      if (token.children) {
        count += this.countTokens(token.children);
      }
    }
    return count;
  }

  /**
   * Manage cache size to prevent memory bloat
   */
  private manageCacheSize(): void {
    const currentSize = this.estimateCacheSize();
    const maxSizeBytes = this.options.maxSize * 1024 * 1024;

    // Remove old entries if cache is too large
    while ((this.templateCache.size >= this.options.maxEntries || currentSize > maxSizeBytes) && this.templateCache.size > 0) {
      let oldestKey: string | null = null;
      let oldestTime = Date.now();

      for (const [key, template] of this.templateCache.entries()) {
        if (template.lastUsed.getTime() < oldestTime) {
          oldestKey = key;
          oldestTime = template.lastUsed.getTime();
        }
      }

      if (oldestKey) {
        this.templateCache.delete(oldestKey);
        this.logger.debug('Evicted template from cache', { templateId: oldestKey });
      } else {
        break;
      }
    }
  }

  /**
   * Estimate cache size in bytes
   */
  private estimateCacheSize(): number {
    let size = 0;
    for (const template of this.templateCache.values()) {
      size += template.source.length * 2; // String storage
      size += JSON.stringify(template.tokens).length; // Token storage
      size += 1000; // Metadata overhead
    }
    return size;
  }

  /**
   * Setup periodic cache cleanup
   */
  private setupCacheCleanup(): void {
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60000); // Clean every minute
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let removedCount = 0;

    // Clean template cache
    for (const [key, template] of this.templateCache.entries()) {
      if (now - template.compiledAt.getTime() > this.options.ttl) {
        this.templateCache.delete(key);
        removedCount++;
      }
    }

    // Clean render cache
    const renderTTL = this.options.ttl / 2;
    for (const [key, cached] of this.renderCache.entries()) {
      if (now - cached.timestamp.getTime() > renderTTL) {
        this.renderCache.delete(key);
      }
    }

    if (removedCount > 0) {
      this.logger.debug('Cleaned up expired cache entries', { removedCount });
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics(): typeof this.metrics & {
    cacheSize: number;
    templateCount: number;
    renderCacheSize: number;
  } {
    return {
      ...this.metrics,
      cacheSize: this.estimateCacheSize(),
      templateCount: this.templateCache.size,
      renderCacheSize: this.renderCache.size
    };
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.templateCache.clear();
    this.renderCache.clear();
    this.logger.info('All template caches cleared');
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.clearCache();
  }
}