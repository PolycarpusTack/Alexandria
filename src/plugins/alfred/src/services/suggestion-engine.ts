/**
 * Suggestion Engine - Provides intelligent code suggestions and improvements
 */

import { Logger } from '../../../../utils/logger';
import { AIService } from '../../../../core/services/ai-service/interfaces';
import { StorageService } from '../../../../core/services/storage/interfaces';

export interface CodeSuggestion {
  id: string;
  type: 'improvement' | 'refactor' | 'bug-fix' | 'optimization' | 'best-practice';
  title: string;
  description: string;
  confidence: number; // 0-100
  impact: 'low' | 'medium' | 'high';
  file: string;
  lineStart: number;
  lineEnd: number;
  originalCode: string;
  suggestedCode: string;
  explanation: string;
  tags: string[];
  timestamp: Date;
}

export interface SuggestionContext {
  projectPath: string;
  language: string;
  framework?: string;
  recentChanges: string[];
  codeStyle: any;
}

export class SuggestionEngine {
  private readonly SUGGESTION_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  private suggestionCache: Map<string, { suggestions: CodeSuggestion[]; timestamp: Date }> = new Map();

  constructor(
    private logger: Logger,
    private aiService: AIService,
    private storageService: StorageService
  ) {}

  async analyzePath(projectPath: string, filePath?: string): Promise<CodeSuggestion[]> {
    this.logger.info('Analyzing for suggestions', { projectPath, filePath });

    const cacheKey = `${projectPath}:${filePath || 'all'}`;
    const cached = this.suggestionCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp.getTime() < this.SUGGESTION_CACHE_TTL) {
      return cached.suggestions;
    }

    try {
      const suggestions: CodeSuggestion[] = [];
      
      if (filePath) {
        // Analyze specific file
        const fileSuggestions = await this.analyzeFile(projectPath, filePath);
        suggestions.push(...fileSuggestions);
      } else {
        // Analyze entire project
        const files = await this.getAnalyzableFiles(projectPath);
        for (const file of files.slice(0, 10)) { // Limit to avoid overwhelming
          const fileSuggestions = await this.analyzeFile(projectPath, file);
          suggestions.push(...fileSuggestions);
        }
      }

      // Cache results
      this.suggestionCache.set(cacheKey, {
        suggestions,
        timestamp: new Date()
      });

      return suggestions.sort((a, b) => {
        // Sort by impact and confidence
        const aScore = this.getImpactScore(a.impact) * (a.confidence / 100);
        const bScore = this.getImpactScore(b.impact) * (b.confidence / 100);
        return bScore - aScore;
      });

    } catch (error) {
      this.logger.error('Failed to analyze for suggestions', { error, projectPath, filePath });
      return [];
    }
  }

  private async analyzeFile(projectPath: string, relativePath: string): Promise<CodeSuggestion[]> {
    const fullPath = `${projectPath}/${relativePath}`;
    const suggestions: CodeSuggestion[] = [];

    try {
      const content = await this.storageService.readFile(fullPath);
      const lines = content.split('\n');
      
      // Skip very large files
      if (lines.length > 1000) {
        return suggestions;
      }

      // Quick static analysis
      suggestions.push(...this.performStaticAnalysis(relativePath, content, lines));
      
      // AI-powered analysis for smaller files
      if (content.length < 10000) {
        const aiSuggestions = await this.performAIAnalysis(relativePath, content);
        suggestions.push(...aiSuggestions);
      }

    } catch (error) {
      this.logger.warn('Failed to analyze file', { error, file: relativePath });
    }

    return suggestions;
  }

  private performStaticAnalysis(filePath: string, content: string, lines: string[]): CodeSuggestion[] {
    const suggestions: CodeSuggestion[] = [];
    const language = this.detectLanguage(filePath);

    // Common code smells and improvements
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmedLine = line.trim();

      // Long lines
      if (line.length > 120) {
        suggestions.push({
          id: `long-line-${filePath}-${lineNumber}`,
          type: 'best-practice',
          title: 'Long line detected',
          description: 'Line exceeds recommended length of 120 characters',
          confidence: 80,
          impact: 'low',
          file: filePath,
          lineStart: lineNumber,
          lineEnd: lineNumber,
          originalCode: line,
          suggestedCode: `// Consider breaking this line:\n${this.breakLongLine(line)}`,
          explanation: 'Long lines can be harder to read and may not fit in some editors or displays.',
          tags: ['readability', 'formatting'],
          timestamp: new Date()
        });
      }

      // TODO comments
      if (trimmedLine.includes('TODO') || trimmedLine.includes('FIXME')) {
        suggestions.push({
          id: `todo-${filePath}-${lineNumber}`,
          type: 'improvement',
          title: 'TODO/FIXME found',
          description: 'Consider addressing this TODO or FIXME comment',
          confidence: 60,
          impact: 'medium',
          file: filePath,
          lineStart: lineNumber,
          lineEnd: lineNumber,
          originalCode: line,
          suggestedCode: line,
          explanation: 'TODO and FIXME comments indicate incomplete or problematic code that should be addressed.',
          tags: ['technical-debt', 'maintenance'],
          timestamp: new Date()
        });
      }

      // Magic numbers (language-specific)
      if (language === 'typescript' || language === 'javascript') {
        const magicNumberMatch = trimmedLine.match(/\b(\d{2,})\b/);
        if (magicNumberMatch && !trimmedLine.includes('const') && !trimmedLine.includes('let')) {
          suggestions.push({
            id: `magic-number-${filePath}-${lineNumber}`,
            type: 'refactor',
            title: 'Magic number detected',
            description: `Consider extracting magic number ${magicNumberMatch[1]} to a named constant`,
            confidence: 70,
            impact: 'medium',
            file: filePath,
            lineStart: lineNumber,
            lineEnd: lineNumber,
            originalCode: line,
            suggestedCode: `const SOME_CONSTANT = ${magicNumberMatch[1]};\n// ... use SOME_CONSTANT instead`,
            explanation: 'Magic numbers make code harder to understand and maintain. Named constants are more descriptive.',
            tags: ['maintainability', 'readability'],
            timestamp: new Date()
          });
        }
      }

      // Empty catch blocks
      if (trimmedLine === 'catch {' || trimmedLine === 'catch (error) {') {
        const nextLine = lines[index + 1]?.trim();
        if (nextLine === '}' || nextLine === '// TODO: handle error') {
          suggestions.push({
            id: `empty-catch-${filePath}-${lineNumber}`,
            type: 'bug-fix',
            title: 'Empty catch block',
            description: 'Empty catch blocks hide errors and make debugging difficult',
            confidence: 90,
            impact: 'high',
            file: filePath,
            lineStart: lineNumber,
            lineEnd: lineNumber + 1,
            originalCode: `${line}\n${lines[index + 1] || ''}`,
            suggestedCode: `${line}\n  console.error('Error occurred:', error);\n  // Handle error appropriately\n}`,
            explanation: 'Always handle errors appropriately, even if just logging them.',
            tags: ['error-handling', 'debugging'],
            timestamp: new Date()
          });
        }
      }

      // Deprecated patterns
      if (trimmedLine.includes('var ') && (language === 'typescript' || language === 'javascript')) {
        suggestions.push({
          id: `var-usage-${filePath}-${lineNumber}`,
          type: 'improvement',
          title: 'Use const/let instead of var',
          description: 'var has function scope which can lead to bugs. Use const or let instead.',
          confidence: 85,
          impact: 'medium',
          file: filePath,
          lineStart: lineNumber,
          lineEnd: lineNumber,
          originalCode: line,
          suggestedCode: line.replace('var ', 'const '),
          explanation: 'const and let have block scope, which is more predictable and less error-prone.',
          tags: ['modernization', 'best-practice'],
          timestamp: new Date()
        });
      }
    });

    // File-level suggestions
    if (language === 'typescript' && !content.includes('export') && !content.includes('import')) {
      suggestions.push({
        id: `missing-modules-${filePath}`,
        type: 'improvement',
        title: 'Consider using modules',
        description: 'File has no imports/exports. Consider using ES modules for better organization.',
        confidence: 60,
        impact: 'low',
        file: filePath,
        lineStart: 1,
        lineEnd: 1,
        originalCode: '',
        suggestedCode: '// Add appropriate imports/exports',
        explanation: 'ES modules help organize code and manage dependencies.',
        tags: ['architecture', 'modularity'],
        timestamp: new Date()
      });
    }

    return suggestions;
  }

  private async performAIAnalysis(filePath: string, content: string): Promise<CodeSuggestion[]> {
    try {
      const prompt = `Analyze this code for improvements, refactoring opportunities, and best practices. 
Return suggestions in JSON format with: type, title, description, confidence (0-100), impact (low/medium/high), explanation, and tags.

Code:
\`\`\`
${content}
\`\`\`

Focus on:
1. Code quality and readability
2. Performance optimizations
3. Security considerations
4. Best practices for the language
5. Potential bugs or edge cases

Return up to 5 most important suggestions.`;

      const response = await this.aiService.query(prompt, {
        temperature: 0.3,
        maxTokens: 1000
      });

      const suggestions: CodeSuggestion[] = [];

      try {
        const aiSuggestions = JSON.parse(response);
        if (Array.isArray(aiSuggestions)) {
          aiSuggestions.forEach((suggestion, index) => {
            suggestions.push({
              id: `ai-${filePath}-${index}`,
              type: suggestion.type || 'improvement',
              title: suggestion.title || 'AI Suggestion',
              description: suggestion.description || '',
              confidence: Math.min(suggestion.confidence || 70, 95), // Cap AI confidence
              impact: suggestion.impact || 'medium',
              file: filePath,
              lineStart: 1,
              lineEnd: 1,
              originalCode: '',
              suggestedCode: suggestion.suggestedCode || '',
              explanation: suggestion.explanation || '',
              tags: Array.isArray(suggestion.tags) ? suggestion.tags : ['ai-generated'],
              timestamp: new Date()
            });
          });
        }
      } catch (parseError) {
        this.logger.warn('Failed to parse AI suggestions', { parseError, response });
      }

      return suggestions;

    } catch (error) {
      this.logger.warn('Failed to get AI analysis', { error, file: filePath });
      return [];
    }
  }

  private async getAnalyzableFiles(projectPath: string): Promise<string[]> {
    const files = await this.storageService.listFiles(projectPath, { recursive: true });
    return files
      .filter(f => !f.isDirectory && this.isAnalyzableFile(f.name))
      .map(f => f.path.replace(projectPath, '').replace(/^\//, ''))
      .slice(0, 20); // Limit number of files
  }

  private isAnalyzableFile(fileName: string): boolean {
    const ext = fileName.split('.').pop()?.toLowerCase();
    return ['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'cs', 'go', 'rs'].includes(ext || '');
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      ts: 'typescript', tsx: 'typescript',
      js: 'javascript', jsx: 'javascript',
      py: 'python', java: 'java', cs: 'csharp',
      go: 'go', rs: 'rust'
    };
    return langMap[ext || ''] || 'unknown';
  }

  private breakLongLine(line: string): string {
    // Simple line breaking - could be enhanced with language-specific rules
    if (line.includes(',')) {
      return line.replace(/,\s*/g, ',\n  ');
    }
    if (line.includes('&&') || line.includes('||')) {
      return line.replace(/\s*(&&|\|\|)\s*/g, '\n  $1 ');
    }
    return line;
  }

  private getImpactScore(impact: string): number {
    switch (impact) {
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 1;
    }
  }

  async applySuggestion(suggestion: CodeSuggestion, projectPath: string): Promise<void> {
    this.logger.info('Applying suggestion', { suggestionId: suggestion.id });
    
    try {
      const fullPath = `${projectPath}/${suggestion.file}`;
      const content = await this.storageService.readFile(fullPath);
      const lines = content.split('\n');
      
      // Replace the suggested lines
      const newLines = [
        ...lines.slice(0, suggestion.lineStart - 1),
        suggestion.suggestedCode,
        ...lines.slice(suggestion.lineEnd)
      ];
      
      await this.storageService.writeFile(fullPath, newLines.join('\n'));
      
      // Invalidate cache for this file
      const cacheKey = `${projectPath}:${suggestion.file}`;
      this.suggestionCache.delete(cacheKey);
      
    } catch (error) {
      this.logger.error('Failed to apply suggestion', { error, suggestionId: suggestion.id });
      throw error;
    }
  }

  async dismissSuggestion(suggestion: CodeSuggestion): Promise<void> {
    // In a real implementation, you might store dismissed suggestions
    this.logger.info('Suggestion dismissed', { suggestionId: suggestion.id });
  }

  clearCache(): void {
    this.suggestionCache.clear();
  }
}