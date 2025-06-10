/**
 * Code Extraction Service
 * 
 * Extracts code blocks from AI responses with intelligent file path detection
 * Based on the original Alfred's code extraction functionality
 */

import { Logger } from '../../../../utils/logger';

export interface ExtractedCode {
  content: string;
  language: string;
  filename?: string;
  filepath?: string;
  startLine?: number;
  endLine?: number;
  isComplete: boolean;
  description?: string;
}

export interface CodeExtractionResult {
  blocks: ExtractedCode[];
  suggestedActions: string[];
  hasFileOperations: boolean;
}

export class CodeExtractionService {
  private logger: Logger;
  
  // Patterns from original Alfred
  private readonly filePatterns = {
    python: /(?:^|\s)([a-zA-Z_][\w]*\.py)(?:\s|$)/,
    javascript: /(?:^|\s)([\w-]+\.(?:js|jsx))(?:\s|$)/,
    typescript: /(?:^|\s)([\w-]+\.(?:ts|tsx))(?:\s|$)/,
    css: /(?:^|\s)([\w-]+\.(?:css|scss|sass|less))(?:\s|$)/,
    html: /(?:^|\s)([\w-]+\.html?)(?:\s|$)/,
    json: /(?:^|\s)([\w-]+\.json)(?:\s|$)/,
    yaml: /(?:^|\s)([\w-]+\.ya?ml)(?:\s|$)/,
    markdown: /(?:^|\s)([\w-]+\.md)(?:\s|$)/,
    sql: /(?:^|\s)([\w-]+\.sql)(?:\s|$)/,
    shell: /(?:^|\s)([\w-]+\.(?:sh|bash))(?:\s|$)/,
  };
  
  private readonly pathPatterns = {
    // File path patterns like "in src/components/Button.tsx"
    explicit: /(?:in|at|to|file:?)\s+([./]?(?:[\w-]+\/)*[\w-]+\.[\w]+)/gi,
    // Import/export statements
    import: /(?:from|import)\s+['"]([^'"]+)['"]/g,
    // Create/modify file mentions
    fileOperation: /(?:create|update|modify|edit|add|save)\s+(?:file\s+)?([./]?(?:[\w-]+\/)*[\w-]+\.[\w]+)/gi,
  };

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Extract code blocks from AI response text
   */
  extractCodeBlocks(text: string): CodeExtractionResult {
    const blocks: ExtractedCode[] = [];
    const suggestedActions: string[] = [];
    let hasFileOperations = false;

    // Extract markdown code blocks
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      const language = match[1] || 'plaintext';
      const content = match[2].trim();
      
      // Look for file information in the surrounding context
      const contextStart = Math.max(0, match.index - 200);
      const contextEnd = Math.min(text.length, match.index + match[0].length + 200);
      const context = text.substring(contextStart, contextEnd);
      
      const extractedBlock = this.analyzeCodeBlock(content, language, context);
      blocks.push(extractedBlock);
      
      // Check for file operations
      if (this.detectFileOperation(context)) {
        hasFileOperations = true;
        if (extractedBlock.filepath) {
          suggestedActions.push(`Save to ${extractedBlock.filepath}`);
        }
      }
    }

    // Extract inline code that might be filenames
    const inlineCodeRegex = /`([^`]+)`/g;
    while ((match = inlineCodeRegex.exec(text)) !== null) {
      const code = match[1];
      if (this.looksLikeFilename(code)) {
        suggestedActions.push(`Create or update ${code}`);
      }
    }

    // Detect suggested file structure
    const fileStructure = this.extractFileStructure(text);
    if (fileStructure.length > 0) {
      suggestedActions.push('Create project structure');
    }

    return {
      blocks,
      suggestedActions: [...new Set(suggestedActions)], // Remove duplicates
      hasFileOperations
    };
  }

  /**
   * Analyze a code block to extract metadata
   */
  private analyzeCodeBlock(content: string, language: string, context: string): ExtractedCode {
    const result: ExtractedCode = {
      content,
      language,
      isComplete: this.isCompleteCode(content, language)
    };

    // Try to find filename from context
    const filename = this.extractFilename(context, language);
    if (filename) {
      result.filename = filename;
      result.filepath = this.extractFilepath(context, filename) || filename;
    }

    // Extract line numbers if mentioned
    const lineNumbers = this.extractLineNumbers(context);
    if (lineNumbers) {
      result.startLine = lineNumbers.start;
      result.endLine = lineNumbers.end;
    }

    // Extract description
    const description = this.extractDescription(context);
    if (description) {
      result.description = description;
    }

    return result;
  }

  /**
   * Extract filename from context
   */
  private extractFilename(context: string, language: string): string | undefined {
    // First try explicit path patterns
    for (const [, pattern] of Object.entries(this.pathPatterns)) {
      const match = pattern.exec(context);
      if (match && match[1]) {
        const path = match[1];
        const filename = path.split('/').pop();
        if (filename && this.hasValidExtension(filename, language)) {
          return filename;
        }
      }
    }

    // Then try language-specific patterns
    const langPattern = this.filePatterns[language];
    if (langPattern) {
      const match = langPattern.exec(context);
      if (match && match[1]) {
        return match[1];
      }
    }

    return undefined;
  }

  /**
   * Extract full filepath from context
   */
  private extractFilepath(context: string, filename: string): string | undefined {
    // Look for full path mentions
    const pathRegex = new RegExp(`([./]?(?:[\\w-]+/)*${filename.replace('.', '\\.')})`, 'gi');
    const match = pathRegex.exec(context);
    return match ? match[1] : undefined;
  }

  /**
   * Extract line numbers from context
   */
  private extractLineNumbers(context: string): { start: number; end: number } | undefined {
    const patterns = [
      /lines?\s+(\d+)(?:\s*-\s*(\d+))?/i,
      /L(\d+)(?:-L(\d+))?/,
      /(\d+):(\d+)/
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(context);
      if (match) {
        const start = parseInt(match[1]);
        const end = match[2] ? parseInt(match[2]) : start;
        return { start, end };
      }
    }

    return undefined;
  }

  /**
   * Extract description from context
   */
  private extractDescription(context: string): string | undefined {
    // Look for common description patterns
    const patterns = [
      /(?:this|the following|here's|here is)\s+(?:code|function|class|component)\s+(?:that|to|for)\s+([^.]+)\./i,
      /(?:implement|create|add|update)\s+(?:a|an|the)?\s*([^.]+)\./i,
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(context);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  /**
   * Check if code appears to be complete
   */
  private isCompleteCode(content: string, language: string): boolean {
    const lines = content.split('\n');
    
    // Check for common incomplete patterns
    if (content.includes('...') || content.includes('// ...')) {
      return false;
    }

    // Language-specific checks
    switch (language) {
      case 'python':
        // Check for incomplete function/class definitions
        const lastLine = lines[lines.length - 1].trim();
        return !lastLine.endsWith(':') && !content.includes('pass  # TODO');
        
      case 'javascript':
      case 'typescript':
        // Check for balanced braces
        const openBraces = (content.match(/{/g) || []).length;
        const closeBraces = (content.match(/}/g) || []).length;
        return openBraces === closeBraces;
        
      case 'html':
        // Check for balanced tags (simplified)
        const openTags = (content.match(/<[^/][^>]*>/g) || []).length;
        const closeTags = (content.match(/<\/[^>]+>/g) || []).length;
        return Math.abs(openTags - closeTags) <= 1; // Allow for self-closing tags
        
      default:
        return true;
    }
  }

  /**
   * Check if filename has valid extension for language
   */
  private hasValidExtension(filename: string, language: string): boolean {
    const extensionMap: Record<string, string[]> = {
      python: ['py'],
      javascript: ['js', 'jsx', 'mjs'],
      typescript: ['ts', 'tsx'],
      css: ['css', 'scss', 'sass', 'less'],
      html: ['html', 'htm'],
      json: ['json'],
      yaml: ['yml', 'yaml'],
      markdown: ['md'],
      sql: ['sql'],
      shell: ['sh', 'bash'],
    };

    const ext = filename.split('.').pop()?.toLowerCase();
    const validExts = extensionMap[language] || [];
    return ext ? validExts.includes(ext) : false;
  }

  /**
   * Detect if context suggests file operations
   */
  private detectFileOperation(context: string): boolean {
    const fileOpKeywords = [
      'create file',
      'create a new file',
      'save this',
      'save as',
      'add to',
      'update file',
      'modify file',
      'write to',
      'in your project',
      'to your codebase'
    ];

    const lowerContext = context.toLowerCase();
    return fileOpKeywords.some(keyword => lowerContext.includes(keyword));
  }

  /**
   * Check if string looks like a filename
   */
  private looksLikeFilename(str: string): boolean {
    // Check if it has a file extension
    const hasExtension = /\.\w{1,4}$/.test(str);
    // Check if it's a valid filename pattern
    const isValidPattern = /^[\w.-]+$/.test(str);
    // Check if it's not too long
    const reasonableLength = str.length < 50;
    
    return hasExtension && isValidPattern && reasonableLength;
  }

  /**
   * Extract file structure from text (e.g., project structure listings)
   */
  private extractFileStructure(text: string): string[] {
    const files: string[] = [];
    const lines = text.split('\n');
    
    // Look for tree-like structures
    const treePattern = /[│├└]\s*[-─]\s*([\w.-]+)/;
    // Look for indented file lists
    const indentPattern = /^\s{2,}([\w.-]+\.\w+)$/;
    
    lines.forEach(line => {
      let match = treePattern.exec(line);
      if (match && match[1]) {
        files.push(match[1]);
        return;
      }
      
      match = indentPattern.exec(line);
      if (match && match[1]) {
        files.push(match[1]);
      }
    });

    return files;
  }

  /**
   * Process extracted code blocks and prepare them for saving
   */
  processForSaving(blocks: ExtractedCode[]): Map<string, string> {
    const fileMap = new Map<string, string>();

    blocks.forEach(block => {
      if (block.filepath && block.isComplete) {
        // If we have line numbers, this might be a partial update
        if (block.startLine !== undefined) {
          this.logger.info('Partial file update detected', {
            file: block.filepath,
            lines: `${block.startLine}-${block.endLine}`
          });
        }
        
        fileMap.set(block.filepath, block.content);
      }
    });

    return fileMap;
  }
}