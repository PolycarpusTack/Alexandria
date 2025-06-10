/**
 * Project Analyzer Service - Analyzes project structure and detects project types
 */

import { Logger } from '../../../../utils/logger';
import { EventBus } from '../../../../core/event-bus/interfaces';
import { StorageService } from '../../../../core/services/storage/interfaces';
import { 
  ProjectContext, 
  ProjectType, 
  ProjectStructure, 
  FileNode,
  ProjectStatistics,
  DependencyInfo,
  IProjectAnalyzerService 
} from '../interfaces';
import * as path from 'path';
import * as fs from 'fs/promises';

export class ProjectAnalyzerService implements IProjectAnalyzerService {
  private projectCache: Map<string, ProjectContext> = new Map();
  private filePatterns: Map<string, string[]> = new Map([
    ['python', ['*.py', 'requirements.txt', 'setup.py', 'pyproject.toml']],
    ['javascript', ['*.js', '*.jsx', 'package.json', 'yarn.lock']],
    ['typescript', ['*.ts', '*.tsx', 'tsconfig.json', 'package.json']],
    ['java', ['*.java', 'pom.xml', 'build.gradle']],
    ['csharp', ['*.cs', '*.csproj', '*.sln']],
    ['go', ['*.go', 'go.mod', 'go.sum']],
    ['rust', ['*.rs', 'Cargo.toml', 'Cargo.lock']],
    ['smalltalk', ['*.st', '*.class', '*.changes']]
  ]);

  constructor(
    private logger: Logger,
    private eventBus: EventBus,
    private storageService: StorageService
  ) {}

  async analyzeProject(projectPath: string): Promise<ProjectContext> {
    this.logger.info('Analyzing project', { projectPath });

    try {
      // Check cache first
      const cached = this.projectCache.get(projectPath);
      if (cached && this.isCacheValid(cached)) {
        return cached;
      }

      // Verify path exists
      const exists = await fs.access(projectPath).then(() => true).catch(() => false);
      if (!exists) {
        throw new Error(`Project path does not exist: ${projectPath}`);
      }

      // Extract project name
      const projectName = path.basename(projectPath);

      // Detect project type
      const projectType = await this.detectProjectType(projectPath);

      // Extract project structure
      const structure = await this.extractProjectStructure(projectPath);

      // Create context
      const context: ProjectContext = {
        projectPath,
        projectName,
        projectType,
        structure,
        analyzedAt: new Date()
      };

      // Cache the result
      this.projectCache.set(projectPath, context);

      // Emit event
      this.eventBus.emit('alfred:project-analyzed', {
        projectPath,
        projectType,
        fileCount: structure.statistics.totalFiles,
        languages: Object.keys(structure.statistics.languageBreakdown)
      });

      return context;

    } catch (error) {
      this.logger.error('Failed to analyze project', { error, projectPath });
      throw error;
    }
  }

  async analyzeCurrentProject(): Promise<ProjectContext | null> {
    // Get current project from Alexandria's project service
    const currentProjectPath = process.cwd();
    if (!currentProjectPath) {
      return null;
    }

    return this.analyzeProject(currentProjectPath);
  }

  async updateProjectStructure(filePath: string, changeType: string): Promise<void> {
    // Find which project this file belongs to
    const projectPath = await this.findProjectRoot(filePath);
    if (!projectPath) {
      return;
    }

    // Invalidate cache
    const cached = this.projectCache.get(projectPath);
    if (cached) {
      // For now, just invalidate. In future, we could do incremental updates
      this.projectCache.delete(projectPath);
      
      // Re-analyze in background
      this.analyzeProject(projectPath).catch(error => {
        this.logger.error('Failed to re-analyze project after file change', { error });
      });
    }
  }

  async detectProjectType(projectPath: string): Promise<ProjectType> {
    const fileList = await this.listDirectoryRecursive(projectPath);
    const fileExtensions = new Map<string, number>();
    const markers = new Map<string, string[]>();

    // Count file extensions and look for marker files
    for (const file of fileList) {
      if (file.isDirectory) continue;

      const ext = path.extname(file.name).toLowerCase();
      if (ext) {
        fileExtensions.set(ext, (fileExtensions.get(ext) || 0) + 1);
      }

      // Check for marker files
      for (const [lang, patterns] of this.filePatterns) {
        for (const pattern of patterns) {
          if (this.matchesPattern(file.name, pattern)) {
            if (!markers.has(lang)) {
              markers.set(lang, []);
            }
            markers.get(lang)!.push(file.name);
          }
        }
      }
    }

    // Determine project type based on markers and file counts
    if (markers.has('python') && markers.get('python')!.includes('requirements.txt')) {
      return ProjectType.PYTHON;
    }
    if (markers.has('typescript') && markers.get('typescript')!.includes('tsconfig.json')) {
      return ProjectType.TYPESCRIPT;
    }
    if (markers.has('javascript') && markers.get('javascript')!.includes('package.json')) {
      return ProjectType.JAVASCRIPT;
    }
    if (markers.has('java') && (markers.get('java')!.includes('pom.xml') || markers.get('java')!.includes('build.gradle'))) {
      return ProjectType.JAVA;
    }
    if (markers.has('csharp') && markers.get('csharp')!.some(f => f.endsWith('.csproj'))) {
      return ProjectType.CSHARP;
    }
    if (markers.has('go') && markers.get('go')!.includes('go.mod')) {
      return ProjectType.GO;
    }
    if (markers.has('rust') && markers.get('rust')!.includes('Cargo.toml')) {
      return ProjectType.RUST;
    }
    if (markers.has('smalltalk')) {
      return ProjectType.SMALLTALK;
    }

    // Check by predominant file extension
    const sortedExtensions = Array.from(fileExtensions.entries())
      .sort(([, a], [, b]) => b - a);

    if (sortedExtensions.length > 0) {
      const [topExt] = sortedExtensions[0];
      const extToType: Record<string, ProjectType> = {
        '.py': ProjectType.PYTHON,
        '.js': ProjectType.JAVASCRIPT,
        '.ts': ProjectType.TYPESCRIPT,
        '.java': ProjectType.JAVA,
        '.cs': ProjectType.CSHARP,
        '.go': ProjectType.GO,
        '.rs': ProjectType.RUST,
        '.st': ProjectType.SMALLTALK
      };

      if (extToType[topExt]) {
        return extToType[topExt];
      }
    }

    // Check if mixed project
    if (fileExtensions.size > 3) {
      return ProjectType.MIXED;
    }

    return ProjectType.UNKNOWN;
  }

  async extractProjectStructure(projectPath: string): Promise<ProjectStructure> {
    const structure: ProjectStructure = {
      rootPath: projectPath,
      files: [],
      statistics: {
        totalFiles: 0,
        totalDirectories: 0,
        totalSize: 0,
        languageBreakdown: {},
        largestFiles: []
      }
    };

    // Build file tree
    structure.files = await this.buildFileTree(projectPath);

    // Calculate statistics
    await this.calculateStatistics(structure);

    // Extract dependencies
    structure.dependencies = await this.extractDependencies(projectPath);

    return structure;
  }

  // Private helper methods

  private async buildFileTree(dirPath: string, basePath?: string): Promise<FileNode[]> {
    if (!basePath) basePath = dirPath;

    try {
      const items = await this.storageService.listFiles(dirPath, { includeStats: true });
      const nodes: FileNode[] = [];

      for (const item of items) {
        const fullPath = path.join(dirPath, item.name);
        const relativePath = path.relative(basePath, fullPath);

        const node: FileNode = {
          name: item.name,
          path: relativePath,
          type: item.isDirectory ? 'directory' : 'file'
        };

        if (item.isDirectory) {
          // Skip common ignored directories
          if (this.shouldIgnoreDirectory(item.name)) {
            continue;
          }
          node.children = await this.buildFileTree(fullPath, basePath);
        } else {
          node.size = item.size;
          node.extension = path.extname(item.name).toLowerCase();
          node.language = this.detectLanguageFromExtension(node.extension);
        }

        nodes.push(node);
      }

      return nodes;
    } catch (error) {
      this.logger.warn(`Failed to build file tree for ${dirPath}`, { error });
      return [];
    }
  }

  private async calculateStatistics(structure: ProjectStructure): Promise<void> {
    const stats = structure.statistics;
    const fileSizes: Array<{ path: string; size: number }> = [];

    const traverse = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.type === 'directory') {
          stats.totalDirectories++;
          if (node.children) {
            traverse(node.children);
          }
        } else {
          stats.totalFiles++;
          stats.totalSize += node.size || 0;
          
          if (node.language) {
            stats.languageBreakdown[node.language] = 
              (stats.languageBreakdown[node.language] || 0) + 1;
          }

          if (node.size) {
            fileSizes.push({ path: node.path, size: node.size });
          }
        }
      }
    };

    traverse(structure.files);

    // Get top 10 largest files
    stats.largestFiles = fileSizes
      .sort((a, b) => b.size - a.size)
      .slice(0, 10);
  }

  private async extractDependencies(projectPath: string): Promise<DependencyInfo[]> {
    const dependencies: DependencyInfo[] = [];

    // Check for package.json (Node.js)
    const packageJsonPath = path.join(projectPath, 'package.json');
    try {
      if (await fs.access(packageJsonPath).then(() => true).catch(() => false)) {
        const content = await this.storageService.readFile(packageJsonPath);
        const pkg = JSON.parse(content);
        
        // Runtime dependencies
        if (pkg.dependencies) {
          for (const [name, version] of Object.entries(pkg.dependencies)) {
            dependencies.push({
              name,
              version: version as string,
              type: 'runtime',
              source: 'package.json'
            });
          }
        }
        
        // Dev dependencies
        if (pkg.devDependencies) {
          for (const [name, version] of Object.entries(pkg.devDependencies)) {
            dependencies.push({
              name,
              version: version as string,
              type: 'dev',
              source: 'package.json'
            });
          }
        }
      }
    } catch (error) {
      this.logger.warn('Failed to parse package.json', { error });
    }

    // Check for requirements.txt (Python)
    const requirementsPath = path.join(projectPath, 'requirements.txt');
    try {
      if (await fs.access(requirementsPath).then(() => true).catch(() => false)) {
        const content = await this.storageService.readFile(requirementsPath);
        const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
        
        for (const line of lines) {
          const match = line.match(/^([^=<>!]+)([=<>!]+.+)?$/);
          if (match) {
            dependencies.push({
              name: match[1].trim(),
              version: match[2]?.trim() || '*',
              type: 'runtime',
              source: 'requirements.txt'
            });
          }
        }
      }
    } catch (error) {
      this.logger.warn('Failed to parse requirements.txt', { error });
    }

    // Add more dependency file parsers as needed...

    return dependencies;
  }

  private matchesPattern(filename: string, pattern: string): boolean {
    if (pattern.startsWith('*')) {
      return filename.endsWith(pattern.slice(1));
    }
    return filename === pattern;
  }

  private shouldIgnoreDirectory(name: string): boolean {
    const ignored = [
      'node_modules', '.git', '.svn', '.hg', '__pycache__',
      '.pytest_cache', '.vscode', '.idea', 'dist', 'build',
      'target', 'bin', 'obj', '.next', '.nuxt'
    ];
    return ignored.includes(name);
  }

  private detectLanguageFromExtension(ext: string): string | undefined {
    const extToLanguage: Record<string, string> = {
      '.py': 'Python',
      '.js': 'JavaScript',
      '.jsx': 'JavaScript',
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript',
      '.java': 'Java',
      '.cs': 'C#',
      '.go': 'Go',
      '.rs': 'Rust',
      '.cpp': 'C++',
      '.c': 'C',
      '.h': 'C/C++',
      '.hpp': 'C++',
      '.rb': 'Ruby',
      '.php': 'PHP',
      '.swift': 'Swift',
      '.kt': 'Kotlin',
      '.scala': 'Scala',
      '.r': 'R',
      '.m': 'MATLAB',
      '.st': 'Smalltalk'
    };

    return extToLanguage[ext];
  }

  private async findProjectRoot(filePath: string): Promise<string | null> {
    let currentPath = path.dirname(filePath);
    
    while (currentPath !== path.dirname(currentPath)) {
      // Check for project markers
      const markers = ['.git', 'package.json', 'requirements.txt', 'pom.xml', 'go.mod'];
      
      for (const marker of markers) {
        if (await fs.access(path.join(currentPath, marker)).then(() => true).catch(() => false)) {
          return currentPath;
        }
      }
      
      currentPath = path.dirname(currentPath);
    }
    
    return null;
  }

  private isCacheValid(context: ProjectContext): boolean {
    // Cache is valid for 5 minutes
    const cacheTimeout = 5 * 60 * 1000;
    return (Date.now() - context.analyzedAt.getTime()) < cacheTimeout;
  }

  private async listDirectoryRecursive(dirPath: string): Promise<Array<{ name: string; isDirectory: boolean }>> {
    const results: Array<{ name: string; isDirectory: boolean }> = [];
    
    async function* walk(dir: string): AsyncGenerator<{ name: string; isDirectory: boolean }> {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(dirPath, fullPath);
        
        if (entry.isDirectory()) {
          yield { name: relativePath, isDirectory: true };
          yield* walk(fullPath);
        } else {
          yield { name: relativePath, isDirectory: false };
        }
      }
    }
    
    for await (const item of walk(dirPath)) {
      results.push(item);
    }
    
    return results;
  }
}