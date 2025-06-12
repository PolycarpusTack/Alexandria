/**
 * Code Extraction Service
 *
 * Extracts code blocks from AI responses with intelligent file path detection
 * Based on the original Alfred's code extraction functionality
 */

import { Logger } from '../../../../utils/logger';
import { StorageService } from '../../../../core/services/storage/interfaces';
import { EventBus } from '../../../../core/event-bus/interfaces';
import * as path from 'path';

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

export interface CodeExtractionOptions {
  projectPath?: string;
  allowFileWriting?: boolean;
  maxFileSize?: number;
}

export interface FileWriteResult {
  success: boolean;
  filepath: string;
  error?: string;
  existed: boolean;
}

export class CodeExtractionService {
  private logger: Logger;
  private storageService?: StorageService;
  private eventBus?: EventBus;

  // Enhanced patterns for better AI response detection
  private readonly filePatterns = {
    python: /(?:^|\s|`)([a-zA-Z_][\w]*\.py)(?:\s|$|`)/g,
    javascript: /(?:^|\s|`)([\w-/.]+\.(?:js|jsx|mjs))(?:\s|$|`)/g,
    typescript: /(?:^|\s|`)([\w-/.]+\.(?:ts|tsx|d\.ts))(?:\s|$|`)/g,
    css: /(?:^|\s|`)([\w-/.]+\.(?:css|scss|sass|less|stylus))(?:\s|$|`)/g,
    html: /(?:^|\s|`)([\w-/.]+\.html?)(?:\s|$|`)/g,
    json: /(?:^|\s|`)([\w-/.]+\.json)(?:\s|$|`)/g,
    yaml: /(?:^|\s|`)([\w-/.]+\.ya?ml)(?:\s|$|`)/g,
    markdown: /(?:^|\s|`)([\w-/.]+\.md)(?:\s|$|`)/g,
    sql: /(?:^|\s|`)([\w-/.]+\.sql)(?:\s|$|`)/g,
    shell: /(?:^|\s|`)([\w-/.]+\.(?:sh|bash|zsh))(?:\s|$|`)/g,
    dockerfile: /(?:^|\s|`)(Dockerfile|dockerfile)(?:\s|$|`)/g,
    config: /(?:^|\s|`)([\w-/.]+\.(?:conf|config|cfg|ini|toml|env))(?:\s|$|`)/g
  };

  private readonly pathPatterns = {
    // Enhanced file path patterns with better AI response detection
    explicit:
      /(?:(?:in|at|to|file:?|path:?|filename:?|create|update|save)\s+)([./]?(?:[\w@-]+\/)*[\w@.-]+\.[\w]+)/gi,
    // Import/export/require statements
    import: /(?:from|import|require\()\s*['"`]([^'"`]+)['"`]/g,
    // Create/modify file mentions with action words
    fileOperation:
      /(?:create|update|modify|edit|add|save|write|generate|make)\s+(?:(?:a|an|the|new)\s+)?(?:file\s+)?(?:called\s+|named\s+)?([./]?(?:[\w@-]+\/)*[\w@.-]+\.[\w]+)/gi,
    // File paths in backticks or quotes
    quoted: /['"`]([./]?(?:[\w@-]+\/)*[\w@.-]+\.[\w]+)['"`]/g,
    // Relative paths starting with ./ or ../
    relative: /(\.[/.]+(?:[\w@-]+\/)*[\w@.-]+\.[\w]+)/g
  };

  constructor(logger: Logger, storageService?: StorageService, eventBus?: EventBus) {
    this.logger = logger;
    this.storageService = storageService;
    this.eventBus = eventBus;
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
    const patterns = [/lines?\s+(\d+)(?:\s*-\s*(\d+))?/i, /L(\d+)(?:-L(\d+))?/, /(\d+):(\d+)/];

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
      /(?:implement|create|add|update)\s+(?:a|an|the)?\s*([^.]+)\./i
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
      shell: ['sh', 'bash']
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
    return fileOpKeywords.some((keyword) => lowerContext.includes(keyword));
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

    lines.forEach((line) => {
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

    blocks.forEach((block) => {
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

  /**
   * Write extracted code blocks to files
   */
  async writeCodeBlocks(
    blocks: ExtractedCode[],
    options: CodeExtractionOptions = {}
  ): Promise<FileWriteResult[]> {
    if (!this.storageService) {
      throw new Error('Storage service not available for file writing');
    }

    const results: FileWriteResult[] = [];
    const { projectPath = '', allowFileWriting = true, maxFileSize = 1024 * 1024 } = options;

    if (!allowFileWriting) {
      this.logger.warn('File writing is disabled');
      return results;
    }

    for (const block of blocks) {
      if (!block.filepath || !block.isComplete) {
        continue;
      }

      // Check file size
      if (block.content.length > maxFileSize) {
        results.push({
          success: false,
          filepath: block.filepath,
          error: `File size exceeds maximum limit (${maxFileSize} bytes)`,
          existed: false
        });
        continue;
      }

      try {
        // Construct full path
        const fullPath = path.isAbsolute(block.filepath)
          ? block.filepath
          : path.join(projectPath, block.filepath);

        // Check if file exists
        const existed = await this.fileExists(fullPath);

        // Write file
        await this.storageService.writeFile(fullPath, block.content);

        results.push({
          success: true,
          filepath: fullPath,
          existed
        });

        // Publish event
        if (this.eventBus) {
          this.eventBus.publish('alfred:file:written', {
            filepath: fullPath,
            language: block.language,
            size: block.content.length,
            isNew: !existed
          });
        }

        this.logger.info(`Successfully wrote file: ${fullPath}`, {
          language: block.language,
          size: block.content.length,
          existed
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          success: false,
          filepath: block.filepath,
          error: errorMsg,
          existed: false
        });

        this.logger.error(`Failed to write file: ${block.filepath}`, { error });
      }
    }

    return results;
  }

  /**
   * Test extraction patterns with real AI responses
   */
  testExtractionPatterns(): void {
    const testResponses = [
      // Test case 1: Multiple code blocks with explicit file paths
      `Here's the implementation for your React component. Create a file called \`src/components/Button.tsx\`:

\`\`\`typescript
import React from 'react';

interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ onClick, children }) => {
  return <button onClick={onClick}>{children}</button>;
};
\`\`\`

And add the styles in \`src/components/Button.css\`:

\`\`\`css
.button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
\`\`\``,

      // Test case 2: Python with file operations
      `To fix this issue, update the file \`api/users.py\`:

\`\`\`python
from fastapi import FastAPI, HTTPException
from typing import List

app = FastAPI()

@app.get("/users")
async def get_users() -> List[dict]:
    return [{"id": 1, "name": "John"}]
\`\`\`

Also create \`requirements.txt\`:

\`\`\`
fastapi==0.68.0
uvicorn==0.15.0
\`\`\``,

      // Test case 3: Configuration files
      `Here's your Docker setup. Save this as \`Dockerfile\`:

\`\`\`dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
\`\`\`

And create \`docker-compose.yml\`:

\`\`\`yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
\`\`\``
    ];

    this.logger.info('Testing code extraction patterns...');

    testResponses.forEach((response, index) => {
      this.logger.info(`\nTest case ${index + 1}:`);
      const result = this.extractCodeBlocks(response);

      this.logger.info(`Found ${result.blocks.length} code blocks`);
      result.blocks.forEach((block, blockIndex) => {
        this.logger.info(`  Block ${blockIndex + 1}: ${block.language}`, {
          filepath: block.filepath,
          filename: block.filename,
          isComplete: block.isComplete,
          contentLength: block.content.length
        });
      });

      this.logger.info(`Suggested actions: ${result.suggestedActions.join(', ')}`);
      this.logger.info(`Has file operations: ${result.hasFileOperations}`);
    });
  }

  /**
   * Enhanced filename extraction with better AI response handling
   */
  private extractFilename(context: string, language: string): string | undefined {
    // Reset regex lastIndex to avoid issues with global regexes
    Object.values(this.pathPatterns).forEach((pattern) => (pattern.lastIndex = 0));
    Object.values(this.filePatterns).forEach((pattern) => (pattern.lastIndex = 0));

    // First try explicit path patterns
    for (const [patternName, pattern] of Object.entries(this.pathPatterns)) {
      pattern.lastIndex = 0; // Reset global regex
      const matches = Array.from(context.matchAll(pattern));

      for (const match of matches) {
        if (match[1]) {
          const pathStr = match[1];
          const filename = pathStr.split('/').pop();

          if (filename && this.hasValidExtension(filename, language)) {
            this.logger.debug(`Found filename via ${patternName} pattern: ${filename}`);
            return filename;
          }
        }
      }
    }

    // Then try language-specific patterns
    const langPattern = this.filePatterns[language];
    if (langPattern) {
      langPattern.lastIndex = 0;
      const matches = Array.from(context.matchAll(langPattern));

      for (const match of matches) {
        if (match[1]) {
          this.logger.debug(`Found filename via language pattern: ${match[1]}`);
          return match[1];
        }
      }
    }

    return undefined;
  }

  /**
   * Enhanced filepath extraction with better path resolution
   */
  private extractFilepath(context: string, filename: string): string | undefined {
    // Look for full path mentions containing the filename
    const escapedFilename = filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pathRegex = new RegExp(`([./]?(?:[\\w@-]+/)*${escapedFilename})`, 'gi');

    const matches = Array.from(context.matchAll(pathRegex));

    for (const match of matches) {
      if (match[1]) {
        const foundPath = match[1];
        // Prefer longer, more specific paths
        this.logger.debug(`Found filepath: ${foundPath}`);
        return foundPath;
      }
    }

    return undefined;
  }

  /**
   * Check if a file exists
   */
  private async fileExists(filepath: string): Promise<boolean> {
    try {
      if (this.storageService) {
        // Try to read file metadata
        await this.storageService.readFile(filepath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Validate extracted file paths
   */
  validateFilePath(filepath: string): { valid: boolean; reason?: string } {
    // Check for dangerous paths
    if (filepath.includes('..')) {
      return { valid: false, reason: 'Path traversal not allowed' };
    }

    // Check for absolute paths outside project
    if (path.isAbsolute(filepath) && !filepath.startsWith('/tmp/')) {
      return { valid: false, reason: 'Absolute paths outside project not allowed' };
    }

    // Check filename length
    const filename = path.basename(filepath);
    if (filename.length > 255) {
      return { valid: false, reason: 'Filename too long' };
    }

    // Check for valid characters
    if (!/^[a-zA-Z0-9._/-]+$/.test(filepath)) {
      return { valid: false, reason: 'Invalid characters in path' };
    }

    return { valid: true };
  }
}
