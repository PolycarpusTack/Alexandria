import { EventEmitter } from 'events';
import { ProjectContext, FileAnalysis, ProjectPattern, CodeExample } from '../../interfaces';

export interface ProjectMetrics {
  linesOfCode: number;
  filesCount: number;
  testCoverage?: number;
  codeComplexity: 'low' | 'medium' | 'high';
  maintainabilityIndex: number;
  technicalDebt: Array<{ type: string; description: string; severity: 'low' | 'medium' | 'high' }>;
}

export interface ArchitectureAnalysis {
  pattern: 'mvc' | 'mvvm' | 'microservices' | 'monolith' | 'layered' | 'hexagonal' | 'unknown';
  components: Array<{ name: string; type: string; responsibilities: string[] }>;
  dependencies: Array<{ from: string; to: string; type: 'import' | 'api' | 'config' }>;
  concerns: string[];
}

export class ProjectAnalyzer extends EventEmitter {
  private fileTypeAnalyzers: Map<string, (content: string, filePath: string) => FileAnalysis>;
  private patternDetectors: Array<(files: FileAnalysis[]) => ProjectPattern[]>;

  constructor() {
    super();
    this.initializeAnalyzers();
    this.initializePatternDetectors();
  }

  async analyzeFileStructure(projectPath: string): Promise<{
    structure: any;
    fileTypes: Record<string, number>;
    directories: string[];
    configFiles: string[];
    testFiles: string[];
  }> {
    // This would integrate with Alexandria's file service
    // Mock implementation for now
    return {
      structure: {},
      fileTypes: {},
      directories: [],
      configFiles: [],
      testFiles: []
    };
  }

  async analyzeFile(filePath: string, content: string): Promise<FileAnalysis> {
    const extension = this.getFileExtension(filePath);
    const analyzer = this.fileTypeAnalyzers.get(extension);
    
    if (analyzer) {
      return analyzer(content, filePath);
    }

    // Default analysis for unknown file types
    return this.performGenericAnalysis(content, filePath);
  }

  async detectArchitecture(fileAnalyses: FileAnalysis[]): Promise<ArchitectureAnalysis> {
    const directoryStructure = this.analyzeDirectoryStructure(fileAnalyses);
    const importPatterns = this.analyzeImportPatterns(fileAnalyses);
    const namingConventions = this.analyzeNamingConventions(fileAnalyses);

    // Detect architecture pattern based on file organization and imports
    const pattern = this.detectArchitecturePattern(directoryStructure, importPatterns);
    
    return {
      pattern,
      components: this.identifyComponents(fileAnalyses, pattern),
      dependencies: this.mapDependencies(importPatterns),
      concerns: this.identifyArchitecturalConcerns(fileAnalyses, pattern)
    };
  }

  async calculateMetrics(fileAnalyses: FileAnalysis[]): Promise<ProjectMetrics> {
    const linesOfCode = fileAnalyses.reduce((total, file) => total + (file.linesOfCode || 0), 0);
    const filesCount = fileAnalyses.length;
    
    const complexity = this.calculateOverallComplexity(fileAnalyses);
    const maintainabilityIndex = this.calculateMaintainabilityIndex(fileAnalyses);
    const technicalDebt = this.identifyTechnicalDebt(fileAnalyses);

    return {
      linesOfCode,
      filesCount,
      codeComplexity: complexity,
      maintainabilityIndex,
      technicalDebt
    };
  }

  async extractBestPractices(fileAnalyses: FileAnalysis[]): Promise<{
    patterns: ProjectPattern[];
    antiPatterns: Array<{ pattern: string; occurrences: number; impact: string }>;
    recommendations: string[];
  }> {
    const patterns: ProjectPattern[] = [];
    const antiPatterns: Array<{ pattern: string; occurrences: number; impact: string }> = [];
    const recommendations: string[] = [];

    // Apply pattern detectors
    for (const detector of this.patternDetectors) {
      patterns.push(...detector(fileAnalyses));
    }

    // Detect anti-patterns
    antiPatterns.push(...this.detectAntiPatterns(fileAnalyses));

    // Generate recommendations based on analysis
    recommendations.push(...this.generateRecommendations(fileAnalyses, patterns, antiPatterns));

    return { patterns, antiPatterns, recommendations };
  }

  async extractCodeExamples(fileAnalyses: FileAnalysis[], maxExamples: number = 10): Promise<CodeExample[]> {
    const examples: CodeExample[] = [];
    const seenPatterns = new Set<string>();

    for (const file of fileAnalyses) {
      if (examples.length >= maxExamples) break;

      // Extract function definitions
      const functions = this.extractFunctions(file);
      for (const func of functions) {
        if (examples.length >= maxExamples) break;
        if (!seenPatterns.has(func.pattern)) {
          examples.push(func);
          seenPatterns.add(func.pattern);
        }
      }

      // Extract class definitions
      const classes = this.extractClasses(file);
      for (const cls of classes) {
        if (examples.length >= maxExamples) break;
        if (!seenPatterns.has(cls.pattern)) {
          examples.push(cls);
          seenPatterns.add(cls.pattern);
        }
      }

      // Extract import patterns
      const imports = this.extractImportPatterns(file);
      for (const imp of imports) {
        if (examples.length >= maxExamples) break;
        if (!seenPatterns.has(imp.pattern)) {
          examples.push(imp);
          seenPatterns.add(imp.pattern);
        }
      }
    }

    return examples;
  }

  // Private helper methods

  private initializeAnalyzers(): void {
    this.fileTypeAnalyzers = new Map();

    // TypeScript/JavaScript analyzer
    this.fileTypeAnalyzers.set('.ts', (content, filePath) => this.analyzeTypeScript(content, filePath));
    this.fileTypeAnalyzers.set('.js', (content, filePath) => this.analyzeJavaScript(content, filePath));
    this.fileTypeAnalyzers.set('.tsx', (content, filePath) => this.analyzeReact(content, filePath));
    this.fileTypeAnalyzers.set('.jsx', (content, filePath) => this.analyzeReact(content, filePath));

    // Python analyzer
    this.fileTypeAnalyzers.set('.py', (content, filePath) => this.analyzePython(content, filePath));

    // Java analyzer
    this.fileTypeAnalyzers.set('.java', (content, filePath) => this.analyzeJava(content, filePath));

    // Configuration files
    this.fileTypeAnalyzers.set('.json', (content, filePath) => this.analyzeJSON(content, filePath));
    this.fileTypeAnalyzers.set('.yml', (content, filePath) => this.analyzeYAML(content, filePath));
    this.fileTypeAnalyzers.set('.yaml', (content, filePath) => this.analyzeYAML(content, filePath));
  }

  private initializePatternDetectors(): void {
    this.patternDetectors = [
      this.detectMVCPattern.bind(this),
      this.detectRepositoryPattern.bind(this),
      this.detectFactoryPattern.bind(this),
      this.detectObserverPattern.bind(this),
      this.detectSingletonPattern.bind(this),
      this.detectDecoratorPattern.bind(this),
      this.detectStrategyPattern.bind(this),
      this.detectCommandPattern.bind(this),
    ];
  }

  private analyzeTypeScript(content: string, filePath: string): FileAnalysis {
    const imports = this.extractTypeScriptImports(content);
    const exports = this.extractTypeScriptExports(content);
    const functions = this.extractTypeScriptFunctions(content);
    const classes = this.extractTypeScriptClasses(content);
    const interfaces = this.extractTypeScriptInterfaces(content);

    return {
      filePath,
      language: 'typescript',
      linesOfCode: content.split('\n').length,
      imports,
      exports,
      functions: functions.map(f => f.name),
      classes: classes.map(c => c.name),
      interfaces: interfaces.map(i => i.name),
      dependencies: imports.filter(imp => !imp.startsWith('.') && !imp.startsWith('/')),
      frameworks: this.detectFrameworks(imports),
      patterns: this.detectFilePatterns(content, 'typescript'),
      complexity: this.calculateFileComplexity(content),
      testFile: filePath.includes('.test.') || filePath.includes('.spec.'),
      metadata: {
        hasTypes: true,
        hasJSDoc: content.includes('/**'),
        hasAsync: content.includes('async '),
        hasGenerics: content.includes('<T>') || content.includes('<T,')
      }
    };
  }

  private analyzeJavaScript(content: string, filePath: string): FileAnalysis {
    const imports = this.extractJavaScriptImports(content);
    const exports = this.extractJavaScriptExports(content);
    const functions = this.extractJavaScriptFunctions(content);

    return {
      filePath,
      language: 'javascript',
      linesOfCode: content.split('\n').length,
      imports,
      exports,
      functions,
      dependencies: imports.filter(imp => !imp.startsWith('.') && !imp.startsWith('/')),
      frameworks: this.detectFrameworks(imports),
      patterns: this.detectFilePatterns(content, 'javascript'),
      complexity: this.calculateFileComplexity(content),
      testFile: filePath.includes('.test.') || filePath.includes('.spec.'),
      metadata: {
        hasTypes: false,
        hasJSDoc: content.includes('/**'),
        hasAsync: content.includes('async '),
        usesES6: content.includes('=>') || content.includes('const ') || content.includes('let ')
      }
    };
  }

  private analyzeReact(content: string, filePath: string): FileAnalysis {
    const baseAnalysis = filePath.endsWith('.tsx') 
      ? this.analyzeTypeScript(content, filePath)
      : this.analyzeJavaScript(content, filePath);

    // Add React-specific analysis
    const components = this.extractReactComponents(content);
    const hooks = this.extractReactHooks(content);

    return {
      ...baseAnalysis,
      language: filePath.endsWith('.tsx') ? 'typescript-react' : 'javascript-react',
      components: components.map(c => c.name),
      hooks,
      patterns: [
        ...baseAnalysis.patterns || [],
        ...this.detectReactPatterns(content)
      ],
      metadata: {
        ...baseAnalysis.metadata,
        isComponent: components.length > 0,
        usesHooks: hooks.length > 0,
        hasJSX: content.includes('<') && content.includes('>'),
        isClassComponent: content.includes('extends Component'),
        isFunctionalComponent: content.includes('function ') && content.includes('return')
      }
    };
  }

  private analyzePython(content: string, filePath: string): FileAnalysis {
    const imports = this.extractPythonImports(content);
    const functions = this.extractPythonFunctions(content);
    const classes = this.extractPythonClasses(content);

    return {
      filePath,
      language: 'python',
      linesOfCode: content.split('\n').length,
      imports,
      functions,
      classes,
      dependencies: imports.filter(imp => !imp.startsWith('.')),
      frameworks: this.detectPythonFrameworks(imports),
      patterns: this.detectFilePatterns(content, 'python'),
      complexity: this.calculateFileComplexity(content),
      testFile: filePath.includes('test_') || filePath.includes('_test.py'),
      metadata: {
        hasDocstrings: content.includes('"""') || content.includes("'''"),
        hasTypeHints: content.includes(': ') || content.includes('->'),
        pythonVersion: this.detectPythonVersion(content)
      }
    };
  }

  private analyzeJava(content: string, filePath: string): FileAnalysis {
    const imports = this.extractJavaImports(content);
    const classes = this.extractJavaClasses(content);
    const methods = this.extractJavaMethods(content);

    return {
      filePath,
      language: 'java',
      linesOfCode: content.split('\n').length,
      imports,
      classes,
      functions: methods,
      dependencies: imports.filter(imp => !imp.startsWith('java.lang')),
      frameworks: this.detectJavaFrameworks(imports),
      patterns: this.detectFilePatterns(content, 'java'),
      complexity: this.calculateFileComplexity(content),
      testFile: filePath.includes('Test.java') || content.includes('@Test'),
      metadata: {
        hasAnnotations: content.includes('@'),
        hasGenerics: content.includes('<T>') || content.includes('<?>'),
        isInterface: content.includes('interface '),
        isAbstract: content.includes('abstract ')
      }
    };
  }

  private analyzeJSON(content: string, filePath: string): FileAnalysis {
    try {
      const parsed = JSON.parse(content);
      
      return {
        filePath,
        language: 'json',
        linesOfCode: content.split('\n').length,
        patterns: this.detectJSONPatterns(parsed, filePath),
        metadata: {
          isValid: true,
          isPackageJson: filePath.includes('package.json'),
          isTsConfig: filePath.includes('tsconfig.json'),
          isManifest: filePath.includes('manifest.json'),
          keysCount: Object.keys(parsed).length
        }
      };
    } catch (error) {
      return {
        filePath,
        language: 'json',
        linesOfCode: content.split('\n').length,
        patterns: [],
        metadata: {
          isValid: false,
          parseError: error.message
        }
      };
    }
  }

  private analyzeYAML(content: string, filePath: string): FileAnalysis {
    return {
      filePath,
      language: 'yaml',
      linesOfCode: content.split('\n').length,
      patterns: this.detectYAMLPatterns(content, filePath),
      metadata: {
        isDockerCompose: filePath.includes('docker-compose'),
        isKubernetes: content.includes('apiVersion:'),
        isGitHubAction: filePath.includes('.github/workflows'),
        isCIConfig: filePath.includes('.yml') && (content.includes('build:') || content.includes('steps:'))
      }
    };
  }

  private performGenericAnalysis(content: string, filePath: string): FileAnalysis {
    return {
      filePath,
      language: this.detectLanguageFromExtension(filePath) || 'unknown',
      linesOfCode: content.split('\n').length,
      patterns: [],
      metadata: {
        fileSize: content.length,
        isEmpty: content.trim().length === 0
      }
    };
  }

  // Pattern detection methods (simplified implementations)

  private detectMVCPattern(files: FileAnalysis[]): ProjectPattern[] {
    const hasControllers = files.some(f => f.filePath.includes('controller'));
    const hasModels = files.some(f => f.filePath.includes('model'));
    const hasViews = files.some(f => f.filePath.includes('view') || f.filePath.includes('component'));

    if (hasControllers && hasModels && hasViews) {
      return [{
        name: 'MVC Architecture',
        type: 'architectural',
        confidence: 0.8,
        description: 'Model-View-Controller pattern detected',
        occurrences: 1,
        benefits: ['Separation of concerns', 'Maintainable code structure'],
        examples: []
      }];
    }

    return [];
  }

  private detectRepositoryPattern(files: FileAnalysis[]): ProjectPattern[] {
    const repositoryFiles = files.filter(f => 
      f.filePath.toLowerCase().includes('repository') ||
      f.classes?.some(cls => cls.toLowerCase().includes('repository'))
    );

    if (repositoryFiles.length > 0) {
      return [{
        name: 'Repository Pattern',
        type: 'design',
        confidence: 0.9,
        description: 'Repository pattern for data access abstraction',
        occurrences: repositoryFiles.length,
        benefits: ['Data access abstraction', 'Testability'],
        examples: []
      }];
    }

    return [];
  }

  // Additional pattern detectors would be implemented similarly...
  private detectFactoryPattern(files: FileAnalysis[]): ProjectPattern[] { return []; }
  private detectObserverPattern(files: FileAnalysis[]): ProjectPattern[] { return []; }
  private detectSingletonPattern(files: FileAnalysis[]): ProjectPattern[] { return []; }
  private detectDecoratorPattern(files: FileAnalysis[]): ProjectPattern[] { return []; }
  private detectStrategyPattern(files: FileAnalysis[]): ProjectPattern[] { return []; }
  private detectCommandPattern(files: FileAnalysis[]): ProjectPattern[] { return []; }

  // Utility methods (simplified implementations)

  private getFileExtension(filePath: string): string {
    return '.' + filePath.split('.').pop()?.toLowerCase() || '';
  }

  private extractTypeScriptImports(content: string): string[] {
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    const imports = [];
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    return imports;
  }

  private extractTypeScriptExports(content: string): string[] {
    const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type)\s+(\w+)/g;
    const exports = [];
    let match;
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }
    return exports;
  }

  private extractTypeScriptFunctions(content: string): Array<{ name: string; async: boolean }> {
    const functionRegex = /(async\s+)?function\s+(\w+)|(\w+)\s*:\s*\([^)]*\)\s*=>/g;
    const functions = [];
    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      functions.push({
        name: match[2] || match[3],
        async: !!match[1]
      });
    }
    return functions;
  }

  private extractTypeScriptClasses(content: string): Array<{ name: string; extends?: string }> {
    const classRegex = /class\s+(\w+)(?:\s+extends\s+(\w+))?/g;
    const classes = [];
    let match;
    while ((match = classRegex.exec(content)) !== null) {
      classes.push({
        name: match[1],
        extends: match[2]
      });
    }
    return classes;
  }

  private extractTypeScriptInterfaces(content: string): Array<{ name: string }> {
    const interfaceRegex = /interface\s+(\w+)/g;
    const interfaces = [];
    let match;
    while ((match = interfaceRegex.exec(content)) !== null) {
      interfaces.push({ name: match[1] });
    }
    return interfaces;
  }

  // Additional extraction methods would be implemented for other languages...

  private detectFrameworks(imports: string[]): string[] {
    const frameworks = [];
    const frameworkMap = {
      'react': ['react'],
      'vue': ['vue'],
      'angular': ['@angular/core'],
      'express': ['express'],
      'fastify': ['fastify'],
      'nest': ['@nestjs/core'],
      'next': ['next']
    };

    for (const [framework, patterns] of Object.entries(frameworkMap)) {
      if (patterns.some(pattern => imports.some(imp => imp.includes(pattern)))) {
        frameworks.push(framework);
      }
    }

    return frameworks;
  }

  private detectFilePatterns(content: string, language: string): string[] {
    const patterns = [];
    
    if (content.includes('singleton')) patterns.push('singleton');
    if (content.includes('factory')) patterns.push('factory');
    if (content.includes('observer')) patterns.push('observer');
    
    return patterns;
  }

  private calculateFileComplexity(content: string): number {
    const lines = content.split('\n').length;
    const conditions = (content.match(/if|for|while|switch|catch/g) || []).length;
    const functions = (content.match(/function|def|=>/g) || []).length;
    
    return Math.round((lines * 0.1) + (conditions * 2) + (functions * 1.5));
  }

  private extractJavaScriptImports(content: string): string[] {
    // Similar to TypeScript but also handle require statements
    const imports = this.extractTypeScriptImports(content);
    const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
    let match;
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    return imports;
  }

  private extractJavaScriptExports(content: string): string[] {
    return this.extractTypeScriptExports(content);
  }

  private extractJavaScriptFunctions(content: string): string[] {
    const functionRegex = /function\s+(\w+)|(\w+)\s*=\s*function|(\w+)\s*=\s*\([^)]*\)\s*=>/g;
    const functions = [];
    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      functions.push(match[1] || match[2] || match[3]);
    }
    return functions;
  }

  // More extraction and analysis methods would be implemented...

  private analyzeDirectoryStructure(fileAnalyses: FileAnalysis[]): any {
    // Analyze how files are organized in directories
    return {};
  }

  private analyzeImportPatterns(fileAnalyses: FileAnalysis[]): any {
    // Analyze import/dependency patterns
    return {};
  }

  private analyzeNamingConventions(fileAnalyses: FileAnalysis[]): any {
    // Analyze naming conventions across the project
    return {};
  }

  private detectArchitecturePattern(directoryStructure: any, importPatterns: any): ArchitectureAnalysis['pattern'] {
    // Logic to detect architectural pattern
    return 'unknown';
  }

  private identifyComponents(fileAnalyses: FileAnalysis[], pattern: ArchitectureAnalysis['pattern']): ArchitectureAnalysis['components'] {
    return [];
  }

  private mapDependencies(importPatterns: any): ArchitectureAnalysis['dependencies'] {
    return [];
  }

  private identifyArchitecturalConcerns(fileAnalyses: FileAnalysis[], pattern: ArchitectureAnalysis['pattern']): string[] {
    return [];
  }

  private calculateOverallComplexity(fileAnalyses: FileAnalysis[]): 'low' | 'medium' | 'high' {
    const avgComplexity = fileAnalyses.reduce((sum, file) => sum + (file.complexity || 0), 0) / fileAnalyses.length;
    
    if (avgComplexity < 10) return 'low';
    if (avgComplexity < 25) return 'medium';
    return 'high';
  }

  private calculateMaintainabilityIndex(fileAnalyses: FileAnalysis[]): number {
    // Simplified maintainability calculation
    return 75;
  }

  private identifyTechnicalDebt(fileAnalyses: FileAnalysis[]): ProjectMetrics['technicalDebt'] {
    const debt = [];
    
    // Look for common technical debt indicators
    for (const file of fileAnalyses) {
      if (file.complexity && file.complexity > 30) {
        debt.push({
          type: 'high-complexity',
          description: `File ${file.filePath} has high complexity (${file.complexity})`,
          severity: 'high' as const
        });
      }
    }
    
    return debt;
  }

  private detectAntiPatterns(fileAnalyses: FileAnalysis[]): Array<{ pattern: string; occurrences: number; impact: string }> {
    const antiPatterns = [];
    
    // Detect common anti-patterns
    const godClasses = fileAnalyses.filter(f => (f.linesOfCode || 0) > 1000);
    if (godClasses.length > 0) {
      antiPatterns.push({
        pattern: 'God Class',
        occurrences: godClasses.length,
        impact: 'Reduces maintainability and testability'
      });
    }
    
    return antiPatterns;
  }

  private generateRecommendations(
    fileAnalyses: FileAnalysis[], 
    patterns: ProjectPattern[], 
    antiPatterns: any[]
  ): string[] {
    const recommendations = [];
    
    if (antiPatterns.length > 0) {
      recommendations.push('Consider refactoring large files into smaller, focused modules');
    }
    
    if (patterns.length < 3) {
      recommendations.push('Consider implementing design patterns to improve code structure');
    }
    
    return recommendations;
  }

  private extractFunctions(file: FileAnalysis): CodeExample[] {
    return [];
  }

  private extractClasses(file: FileAnalysis): CodeExample[] {
    return [];
  }

  private extractImportPatterns(file: FileAnalysis): CodeExample[] {
    return [];
  }

  private extractReactComponents(content: string): Array<{ name: string }> {
    return [];
  }

  private extractReactHooks(content: string): string[] {
    return [];
  }

  private detectReactPatterns(content: string): string[] {
    return [];
  }

  private extractPythonImports(content: string): string[] {
    return [];
  }

  private extractPythonFunctions(content: string): string[] {
    return [];
  }

  private extractPythonClasses(content: string): string[] {
    return [];
  }

  private detectPythonFrameworks(imports: string[]): string[] {
    return [];
  }

  private detectPythonVersion(content: string): string {
    return '3.x';
  }

  private extractJavaImports(content: string): string[] {
    return [];
  }

  private extractJavaClasses(content: string): string[] {
    return [];
  }

  private extractJavaMethods(content: string): string[] {
    return [];
  }

  private detectJavaFrameworks(imports: string[]): string[] {
    return [];
  }

  private detectJSONPatterns(parsed: any, filePath: string): string[] {
    return [];
  }

  private detectYAMLPatterns(content: string, filePath: string): string[] {
    return [];
  }

  private detectLanguageFromExtension(filePath: string): string | null {
    const ext = this.getFileExtension(filePath);
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.jsx': 'javascript-react',
      '.tsx': 'typescript-react',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby'
    };
    return languageMap[ext] || null;
  }
}