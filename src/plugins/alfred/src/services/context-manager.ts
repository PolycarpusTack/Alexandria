/**
 * Context Manager - Enhanced context management for better AI responses
 */

import { Logger } from '../../../../utils/logger';
import { EventBus } from '../../../../core/event-bus/interfaces';
import { StorageService } from '../../../../core/services/storage/interfaces';

export interface ContextSnapshot {
  id: string;
  projectPath: string;
  files: Array<{
    path: string;
    content: string;
    language: string;
    importance: number; // 1-10 scale
  }>;
  recentChanges: Array<{
    file: string;
    changeType: 'created' | 'modified' | 'deleted';
    timestamp: Date;
    preview: string;
  }>;
  dependencies: string[];
  patterns: string[];
  codeStyle: {
    indentation: 'tabs' | 'spaces';
    spaceCount?: number;
    quotingStyle: 'single' | 'double';
    namingConvention: 'camelCase' | 'snake_case' | 'PascalCase';
  };
  createdAt: Date;
}

export class ContextManager {
  private contexts: Map<string, ContextSnapshot> = new Map();
  private readonly MAX_CONTEXT_AGE = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_FILE_SIZE = 50000; // 50KB max per file in context

  constructor(
    private logger: Logger,
    private eventBus: EventBus,
    private storageService: StorageService
  ) {
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.eventBus.on('alfred:file:created', this.handleFileChange.bind(this));
    this.eventBus.on('alfred:file:updated', this.handleFileChange.bind(this));
    this.eventBus.on('alfred:file:deleted', this.handleFileChange.bind(this));
  }

  async createContextSnapshot(projectPath: string): Promise<ContextSnapshot> {
    this.logger.info('Creating context snapshot', { projectPath });

    try {
      const snapshot: ContextSnapshot = {
        id: `${projectPath}-${Date.now()}`,
        projectPath,
        files: await this.analyzeImportantFiles(projectPath),
        recentChanges: await this.getRecentChanges(projectPath),
        dependencies: await this.extractDependencies(projectPath),
        patterns: await this.detectCodePatterns(projectPath),
        codeStyle: await this.analyzeCodeStyle(projectPath),
        createdAt: new Date()
      };

      this.contexts.set(projectPath, snapshot);
      this.cleanupOldContexts();

      return snapshot;
    } catch (error) {
      this.logger.error('Failed to create context snapshot', { error, projectPath });
      throw error;
    }
  }

  async getContextForAI(projectPath: string): Promise<string> {
    let snapshot = this.contexts.get(projectPath);
    
    if (!snapshot || this.isContextStale(snapshot)) {
      snapshot = await this.createContextSnapshot(projectPath);
    }

    return this.formatContextForAI(snapshot);
  }

  private async analyzeImportantFiles(projectPath: string): Promise<Array<{
    path: string;
    content: string;
    language: string;
    importance: number;
  }>> {
    const files = await this.storageService.listFiles(projectPath, { recursive: true });
    const importantFiles: Array<{
      path: string;
      content: string;
      language: string;
      importance: number;
    }> = [];

    for (const file of files) {
      if (file.isDirectory) continue;
      
      const importance = this.calculateFileImportance(file.name, file.path);
      if (importance >= 6) { // Only include important files
        try {
          const content = await this.storageService.readFile(file.path);
          if (content.length <= this.MAX_FILE_SIZE) {
            importantFiles.push({
              path: file.path.replace(projectPath, '').replace(/^\//, ''),
              content: content.substring(0, this.MAX_FILE_SIZE),
              language: this.detectLanguage(file.name),
              importance
            });
          }
        } catch (error) {
          this.logger.warn('Failed to read file for context', { error, file: file.path });
        }
      }
    }

    return importantFiles.sort((a, b) => b.importance - a.importance).slice(0, 20); // Top 20 files
  }

  private calculateFileImportance(fileName: string, filePath: string): number {
    let importance = 5; // Base importance

    // Config files are highly important
    if (['package.json', 'tsconfig.json', 'requirements.txt', 'Cargo.toml', 'go.mod'].includes(fileName)) {
      importance += 4;
    }

    // README and documentation
    if (fileName.toLowerCase().includes('readme') || fileName.endsWith('.md')) {
      importance += 3;
    }

    // Main entry points
    if (['index.ts', 'index.js', 'main.py', 'main.ts', 'app.py', 'main.go'].includes(fileName)) {
      importance += 3;
    }

    // Test files are moderately important
    if (fileName.includes('test') || fileName.includes('spec')) {
      importance += 1;
    }

    // Files in root are more important
    if (filePath.split('/').length <= 2) {
      importance += 2;
    }

    // Type definition files
    if (fileName.endsWith('.d.ts')) {
      importance += 2;
    }

    // Recently modified files (would need file stats)
    // importance += recentlyModified ? 2 : 0;

    return Math.min(importance, 10);
  }

  private async getRecentChanges(projectPath: string): Promise<Array<{
    file: string;
    changeType: 'created' | 'modified' | 'deleted';
    timestamp: Date;
    preview: string;
  }>> {
    // This would integrate with file system watching or git history
    // For now, return empty array as placeholder
    return [];
  }

  private async extractDependencies(projectPath: string): Promise<string[]> {
    const dependencies: string[] = [];

    try {
      // Check package.json
      const packageJsonPath = `${projectPath}/package.json`;
      try {
        const packageJson = JSON.parse(await this.storageService.readFile(packageJsonPath));
        if (packageJson.dependencies) {
          dependencies.push(...Object.keys(packageJson.dependencies));
        }
        if (packageJson.devDependencies) {
          dependencies.push(...Object.keys(packageJson.devDependencies));
        }
      } catch {}

      // Check requirements.txt
      const requirementsPath = `${projectPath}/requirements.txt`;
      try {
        const requirements = await this.storageService.readFile(requirementsPath);
        const pythonDeps = requirements.split('\n')
          .filter(line => line.trim() && !line.startsWith('#'))
          .map(line => line.split('==')[0].split('>=')[0].split('<=')[0].trim());
        dependencies.push(...pythonDeps);
      } catch {}

      // Check Cargo.toml
      const cargoPath = `${projectPath}/Cargo.toml`;
      try {
        const cargoContent = await this.storageService.readFile(cargoPath);
        const depsSection = cargoContent.match(/\[dependencies\]([\s\S]*?)(?=\[|$)/);
        if (depsSection) {
          const rustDeps = depsSection[1].split('\n')
            .filter(line => line.includes('='))
            .map(line => line.split('=')[0].trim());
          dependencies.push(...rustDeps);
        }
      } catch {}

    } catch (error) {
      this.logger.warn('Failed to extract dependencies', { error, projectPath });
    }

    return [...new Set(dependencies)]; // Remove duplicates
  }

  private async detectCodePatterns(projectPath: string): Promise<string[]> {
    const patterns: string[] = [];

    // Detect common patterns by analyzing file structure
    const files = await this.storageService.listFiles(projectPath, { recursive: true });
    
    if (files.some(f => f.name === 'package.json')) {
      patterns.push('Node.js project');
    }
    
    if (files.some(f => f.name.includes('component') || f.name.includes('Component'))) {
      patterns.push('Component-based architecture');
    }
    
    if (files.some(f => f.path.includes('/test/') || f.path.includes('/__tests__/'))) {
      patterns.push('Test-driven development');
    }
    
    if (files.some(f => f.name === 'docker-compose.yml' || f.name === 'Dockerfile')) {
      patterns.push('Containerized application');
    }
    
    if (files.some(f => f.path.includes('/api/') || f.path.includes('/routes/'))) {
      patterns.push('API/REST architecture');
    }

    return patterns;
  }

  private async analyzeCodeStyle(projectPath: string): Promise<{
    indentation: 'tabs' | 'spaces';
    spaceCount?: number;
    quotingStyle: 'single' | 'double';
    namingConvention: 'camelCase' | 'snake_case' | 'PascalCase';
  }> {
    // Analyze a few source files to determine code style
    const files = await this.storageService.listFiles(projectPath, { recursive: true });
    const sourceFiles = files.filter(f => 
      f.name.endsWith('.ts') || f.name.endsWith('.js') || f.name.endsWith('.py')
    ).slice(0, 5);

    let spacesCount = 0;
    let tabsCount = 0;
    let singleQuotes = 0;
    let doubleQuotes = 0;
    let camelCaseCount = 0;
    let snakeCaseCount = 0;
    let pascalCaseCount = 0;

    for (const file of sourceFiles) {
      try {
        const content = await this.storageService.readFile(file.path);
        const lines = content.split('\n').slice(0, 100); // Analyze first 100 lines

        lines.forEach(line => {
          if (line.startsWith('  ')) spacesCount++;
          if (line.startsWith('\t')) tabsCount++;
          
          singleQuotes += (line.match(/'/g) || []).length;
          doubleQuotes += (line.match(/"/g) || []).length;
          
          const identifiers = line.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || [];
          identifiers.forEach(id => {
            if (/^[a-z][a-zA-Z0-9]*$/.test(id)) camelCaseCount++;
            if (/^[a-z][a-z0-9_]*$/.test(id)) snakeCaseCount++;
            if (/^[A-Z][a-zA-Z0-9]*$/.test(id)) pascalCaseCount++;
          });
        });
      } catch (error) {
        this.logger.warn('Failed to analyze file for code style', { error, file: file.path });
      }
    }

    return {
      indentation: tabsCount > spacesCount ? 'tabs' : 'spaces',
      spaceCount: spacesCount > tabsCount ? 2 : undefined,
      quotingStyle: singleQuotes > doubleQuotes ? 'single' : 'double',
      namingConvention: 
        camelCaseCount > snakeCaseCount && camelCaseCount > pascalCaseCount ? 'camelCase' :
        snakeCaseCount > pascalCaseCount ? 'snake_case' : 'PascalCase'
    };
  }

  private formatContextForAI(snapshot: ContextSnapshot): string {
    let context = `# Project Context for ${snapshot.projectPath}\n\n`;

    // Code style preferences
    context += `## Code Style\n`;
    context += `- Indentation: ${snapshot.codeStyle.indentation}${snapshot.codeStyle.spaceCount ? ` (${snapshot.codeStyle.spaceCount} spaces)` : ''}\n`;
    context += `- Quotes: ${snapshot.codeStyle.quotingStyle}\n`;
    context += `- Naming: ${snapshot.codeStyle.namingConvention}\n\n`;

    // Project patterns
    if (snapshot.patterns.length > 0) {
      context += `## Project Patterns\n`;
      snapshot.patterns.forEach(pattern => {
        context += `- ${pattern}\n`;
      });
      context += '\n';
    }

    // Dependencies
    if (snapshot.dependencies.length > 0) {
      context += `## Key Dependencies\n`;
      snapshot.dependencies.slice(0, 10).forEach(dep => {
        context += `- ${dep}\n`;
      });
      context += '\n';
    }

    // Important files (show structure only)
    if (snapshot.files.length > 0) {
      context += `## Key Files\n`;
      snapshot.files.slice(0, 5).forEach(file => {
        context += `- ${file.path} (${file.language}, importance: ${file.importance}/10)\n`;
      });
      context += '\n';
    }

    // Recent changes
    if (snapshot.recentChanges.length > 0) {
      context += `## Recent Changes\n`;
      snapshot.recentChanges.slice(0, 3).forEach(change => {
        context += `- ${change.file}: ${change.changeType} (${change.timestamp.toLocaleString()})\n`;
      });
      context += '\n';
    }

    context += `## Instructions\n`;
    context += `Please follow the established code style and patterns when generating code. `;
    context += `Consider the project dependencies and structure when making suggestions.\n`;

    return context;
  }

  private detectLanguage(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      ts: 'typescript', tsx: 'typescript',
      js: 'javascript', jsx: 'javascript',
      py: 'python', java: 'java', cs: 'csharp',
      go: 'go', rs: 'rust', rb: 'ruby',
      php: 'php', cpp: 'cpp', c: 'c'
    };
    return langMap[ext || ''] || 'text';
  }

  private isContextStale(snapshot: ContextSnapshot): boolean {
    return Date.now() - snapshot.createdAt.getTime() > this.MAX_CONTEXT_AGE;
  }

  private cleanupOldContexts(): void {
    const now = Date.now();
    for (const [key, snapshot] of this.contexts.entries()) {
      if (now - snapshot.createdAt.getTime() > this.MAX_CONTEXT_AGE) {
        this.contexts.delete(key);
      }
    }
  }

  private handleFileChange(event: any): void {
    const projectPath = event.projectPath;
    if (this.contexts.has(projectPath)) {
      // Invalidate context to force refresh
      this.contexts.delete(projectPath);
    }
  }
}