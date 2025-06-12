// Helper methods for Alfred AI Adapter
import { ProjectContext, ChatMessage, CodeGenerationOptions } from '../interfaces';

export class AlfredAIHelpers {
  static buildProjectContextPrompt(context: ProjectContext): string {
    let prompt = 'Project Context:\n';
    
    if (context.projectType) {
      prompt += `- Project Type: ${context.projectType}\n`;
    }
    
    if (context.languages?.length) {
      prompt += `- Languages: ${context.languages.join(', ')}\n`;
    }
    
    if (context.frameworks?.length) {
      prompt += `- Frameworks: ${context.frameworks.join(', ')}\n`;
    }
    
    if (context.dependencies?.length) {
      prompt += `- Dependencies: ${context.dependencies.slice(0, 10).join(', ')}\n`;
    }
    
    if (context.codeStyle) {
      prompt += `- Code Style: ${JSON.stringify(context.codeStyle)}\n`;
    }
    
    if (context.currentFile) {
      prompt += `- Current File: ${context.currentFile.path} (${context.currentFile.language})\n`;
    }
    
    return prompt;
  }

  static buildCodePrompt(
    userPrompt: string, 
    context: ProjectContext, 
    options: CodeGenerationOptions
  ): string {
    let enhancedPrompt = `Generate ${options.language || 'appropriate'} code for: ${userPrompt}\n\n`;

    // Add project context
    if (context) {
      enhancedPrompt += this.buildProjectContextPrompt(context) + '\n';
    }

    enhancedPrompt += 'Requirements:\n';
    enhancedPrompt += '- Follow project conventions and patterns\n';
    enhancedPrompt += '- Include appropriate error handling\n';
    enhancedPrompt += '- Use modern best practices\n';

    if (options.includeComments) {
      enhancedPrompt += '- Include clear, helpful comments\n';
    }
    
    if (options.includeTests) {
      enhancedPrompt += '- Include unit tests\n';
    }
    
    if (options.style) {
      enhancedPrompt += `- Use ${options.style} programming style\n`;
    }

    if (context.codeExamples?.length) {
      enhancedPrompt += '\nExisting code examples for reference:\n';
      context.codeExamples.slice(0, 2).forEach(example => {
        enhancedPrompt += `\`\`\`${example.language}\n${example.code}\n\`\`\`\n`;
      });
    }

    return enhancedPrompt;
  }

  static buildSuggestionPrompt(
    code: string, 
    cursorPosition: { line: number; column: number }, 
    context: ProjectContext
  ): string {
    const lines = code.split('\n');
    const currentLine = lines[cursorPosition.line] || '';
    const contextBefore = lines.slice(Math.max(0, cursorPosition.line - 3), cursorPosition.line).join('\n');
    const contextAfter = lines.slice(cursorPosition.line + 1, Math.min(lines.length, cursorPosition.line + 4)).join('\n');
    
    let prompt = 'Analyze this code and provide intelligent suggestions:\n\n';
    
    if (context) {
      prompt += this.buildProjectContextPrompt(context) + '\n';
    }
    
    prompt += `Context before cursor:\n\`\`\`\n${contextBefore}\n\`\`\`\n\n`;
    prompt += `Current line: "${currentLine}" (cursor at column ${cursorPosition.column})\n\n`;
    prompt += `Context after cursor:\n\`\`\`\n${contextAfter}\n\`\`\`\n\n`;
    
    prompt += 'Provide up to 5 practical suggestions as JSON array with format:\n';
    prompt += '[{"suggestion": "code", "confidence": 0.9, "type": "completion|import|refactor|fix|test", "description": "brief explanation"}]';

    return prompt;
  }

  static buildConversationMessages(
    history: ChatMessage[], 
    newMessage: string, 
    context?: ProjectContext, 
    sessionId?: string
  ): string {
    let conversation = '';
    
    if (context) {
      conversation += this.buildProjectContextPrompt(context) + '\n\n';
    }
    
    if (sessionId) {
      conversation += `Session: ${sessionId}\n\n`;
    }
    
    // Add recent history (last 5 messages)
    const recentHistory = history.slice(-5);
    if (recentHistory.length > 0) {
      conversation += 'Recent conversation:\n';
      recentHistory.forEach(msg => {
        const role = msg.role === 'user' ? 'Human' : 'Alfred';
        conversation += `${role}: ${msg.content}\n`;
      });
      conversation += '\n';
    }
    
    conversation += `Human: ${newMessage}\nAlfred:`;
    
    return conversation;
  }

  static buildCodingAssistantSystemPrompt(context?: ProjectContext, sessionId?: string): string {
    let prompt = `You are Alfred, an AI coding assistant integrated into the Alexandria development platform. You help developers with:

- Code generation and review
- Architecture and design guidance  
- Debugging and troubleshooting
- Performance optimization advice
- Testing strategies
- Documentation assistance

Always provide practical, actionable advice. When generating code, ensure it's production-ready with proper error handling.`;

    if (context) {
      prompt += `\n\nProject Context:
- Type: ${context.projectType || 'Unknown'}
- Languages: ${context.languages?.join(', ') || 'Unknown'}`;
      
      if (context.frameworks?.length) {
        prompt += `\n- Frameworks: ${context.frameworks.join(', ')}`;
      }
    }

    if (sessionId) {
      prompt += `\n\nSession: ${sessionId}`;
    }

    return prompt;
  }

  static extractCodeFromResponse(content: string): { code: string; language: string; explanation?: string } {
    // Extract code blocks from markdown
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const matches = [...content.matchAll(codeBlockRegex)];
    
    if (matches.length > 0) {
      const firstMatch = matches[0];
      return {
        code: firstMatch[2].trim(),
        language: firstMatch[1] || 'text',
        explanation: content.replace(codeBlockRegex, '').trim()
      };
    }

    // If no code blocks, treat entire content as code
    return {
      code: content.trim(),
      language: 'text'
    };
  }

  static extractDependencies(code: string, language: string): string[] {
    const dependencies: string[] = [];

    switch (language?.toLowerCase()) {
      case 'javascript':
      case 'typescript':
        const jsImports = code.match(/import\s+.*from\s+['"]([^'"]+)['"]/g) || [];
        const jsRequires = code.match(/require\(['"]([^'"]+)['"]\)/g) || [];
        dependencies.push(...jsImports.map(imp => imp.match(/['"]([^'"]+)['"]/)?.[1] || ''));
        dependencies.push(...jsRequires.map(req => req.match(/['"]([^'"]+)['"]/)?.[1] || ''));
        break;
      
      case 'python':
        const pyImports = code.match(/^(?:from\s+(\S+)\s+import|import\s+(\S+))/gm) || [];
        dependencies.push(...pyImports.map(imp => {
          const fromMatch = imp.match(/from\s+(\S+)/);
          const importMatch = imp.match(/import\s+(\S+)/);
          return fromMatch?.[1] || importMatch?.[1] || '';
        }));
        break;

      case 'java':
        const javaImports = code.match(/import\s+([a-zA-Z0-9_.]+);/g) || [];
        dependencies.push(...javaImports.map(imp => imp.match(/import\s+([a-zA-Z0-9_.]+);/)?.[1] || ''));
        break;

      case 'go':
        const goImports = code.match(/import\s+['"]([^'"]+)['"]/g) || [];
        dependencies.push(...goImports.map(imp => imp.match(/['"]([^'"]+)['"]/)?.[1] || ''));
        break;
    }

    return dependencies.filter(dep => dep && !dep.startsWith('.') && !dep.startsWith('/'));
  }

  static detectWarnings(code: string, language: string): string[] {
    const warnings: string[] = [];

    // Generic security warnings
    if (code.includes('eval(')) {
      warnings.push('Uses eval() which can be a security risk');
    }

    if (code.includes('innerHTML') && language?.toLowerCase() === 'javascript') {
      warnings.push('Uses innerHTML - consider textContent for safety');
    }

    if (code.includes('console.log') && language?.toLowerCase().includes('javascript')) {
      warnings.push('Contains console.log statements - consider removing for production');
    }

    if (code.includes('TODO') || code.includes('FIXME') || code.includes('XXX')) {
      warnings.push('Contains TODO/FIXME comments that need attention');
    }

    // Language-specific warnings
    switch (language?.toLowerCase()) {
      case 'python':
        if (code.includes('subprocess.shell=True')) {
          warnings.push('subprocess with shell=True can be unsafe');
        }
        if (code.includes('pickle.loads')) {
          warnings.push('pickle.loads can execute arbitrary code');
        }
        break;

      case 'sql':
        if (code.includes('%s') || code.includes('{}')) {
          warnings.push('Possible SQL injection vulnerability - use parameterized queries');
        }
        break;
    }

    return warnings;
  }

  static hasComments(code: string, language: string): boolean {
    switch (language?.toLowerCase()) {
      case 'javascript':
      case 'typescript':
      case 'java':
      case 'c':
      case 'cpp':
        return code.includes('//') || code.includes('/*');
      
      case 'python':
      case 'ruby':
      case 'bash':
        return code.includes('#');
      
      case 'html':
      case 'xml':
        return code.includes('<!--');
      
      case 'css':
        return code.includes('/*');
      
      default:
        return code.includes('//') || code.includes('/*') || code.includes('#');
    }
  }

  static analyzeComplexity(code: string): 'low' | 'medium' | 'high' {
    const lines = code.split('\n').filter(line => line.trim()).length;
    const conditions = (code.match(/if|for|while|switch|catch|elif|except/g) || []).length;
    const functions = (code.match(/function|def|=>/g) || []).length;
    const classes = (code.match(/class\s+\w+/g) || []).length;
    
    const complexity = lines * 0.1 + conditions * 2 + functions * 1.5 + classes * 3;
    
    if (complexity < 15) return 'low';
    if (complexity < 40) return 'medium';
    return 'high';
  }

  static detectLanguage(content: string, context?: ProjectContext): string | undefined {
    if (content.includes('```')) {
      const match = content.match(/```(\w+)/);
      return match?.[1];
    }

    // Use context if available
    if (context?.languages?.length) {
      return context.languages[0];
    }

    return undefined;
  }

  static extractSuggestionsFromText(text: string): Array<{ suggestion: string; confidence: number; type: string }> {
    const suggestions: Array<{ suggestion: string; confidence: number; type: string }> = [];
    
    // Look for bullet points or numbered lists
    const lines = text.split('\n').filter(line => {
      const trimmed = line.trim();
      return trimmed && (trimmed.startsWith('-') || trimmed.startsWith('*') || /^\d+\./.test(trimmed));
    });
    
    for (const line of lines.slice(0, 5)) {
      const cleaned = line.replace(/^[\-\*\d\.\s]+/, '').trim();
      if (cleaned) {
        let type = 'completion';
        if (cleaned.toLowerCase().includes('import')) type = 'import';
        else if (cleaned.toLowerCase().includes('refactor')) type = 'refactor';
        else if (cleaned.toLowerCase().includes('fix')) type = 'fix';
        else if (cleaned.toLowerCase().includes('test')) type = 'test';
        
        suggestions.push({
          suggestion: cleaned,
          confidence: 0.6,
          type
        });
      }
    }
    
    return suggestions;
  }
}