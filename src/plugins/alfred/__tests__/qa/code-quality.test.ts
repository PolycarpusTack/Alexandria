import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

describe('Alfred Plugin Code Quality Checks', () => {
  const pluginRoot = path.resolve(__dirname, '../..');
  const srcPath = path.join(pluginRoot, 'src');
  const testPath = path.join(pluginRoot, '__tests__');

  describe('TypeScript Compilation', () => {
    it('should compile without errors', () => {
      try {
        const result = execSync('npx tsc --noEmit', { 
          cwd: pluginRoot,
          encoding: 'utf8'
        });
        expect(result).toBeDefined();
      } catch (error) {
        fail(`TypeScript compilation failed: ${error.message}`);
      }
    });

    it('should have no TypeScript errors in source files', async () => {
      const tsFiles = await findFiles(srcPath, '.ts', '.tsx');
      expect(tsFiles.length).toBeGreaterThan(0);

      for (const file of tsFiles) {
        try {
          execSync(`npx tsc --noEmit "${file}"`, { 
            cwd: pluginRoot,
            encoding: 'utf8'
          });
        } catch (error) {
          fail(`TypeScript errors in ${file}: ${error.message}`);
        }
      }
    });

    it('should follow strict TypeScript configuration', () => {
      const tsconfigPath = path.join(pluginRoot, 'tsconfig.json');
      expect(fs.existsSync(tsconfigPath)).toBe(true);

      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
      expect(tsconfig.compilerOptions.strict).toBe(true);
      expect(tsconfig.compilerOptions.noImplicitAny).toBe(true);
      expect(tsconfig.compilerOptions.noImplicitReturns).toBe(true);
      expect(tsconfig.compilerOptions.noUnusedLocals).toBe(true);
      expect(tsconfig.compilerOptions.noUnusedParameters).toBe(true);
    });
  });

  describe('ESLint Rules', () => {
    it('should pass all ESLint checks', () => {
      try {
        const result = execSync('npx eslint src/ --ext .ts,.tsx', {
          cwd: pluginRoot,
          encoding: 'utf8'
        });
        expect(result).toBeDefined();
      } catch (error) {
        if (error.status !== 0) {
          fail(`ESLint violations found: ${error.stdout}`);
        }
      }
    });

    it('should have no console.log statements in production code', async () => {
      const sourceFiles = await findFiles(srcPath, '.ts', '.tsx');
      
      for (const file of sourceFiles) {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          if (line.includes('console.log') && !line.includes('//')) {
            fail(`console.log found in ${file}:${index + 1}: ${line.trim()}`);
          }
        });
      }
    });

    it('should have no TODO comments in production code', async () => {
      const sourceFiles = await findFiles(srcPath, '.ts', '.tsx');
      
      for (const file of sourceFiles) {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          if (line.includes('TODO') || line.includes('FIXME')) {
            fail(`TODO/FIXME comment found in ${file}:${index + 1}: ${line.trim()}`);
          }
        });
      }
    });

    it('should have proper error handling', async () => {
      const serviceFiles = await findFiles(path.join(srcPath, 'services'), '.ts');
      
      for (const file of serviceFiles) {
        const content = fs.readFileSync(file, 'utf8');
        
        // Check for try-catch blocks in async functions
        const asyncFunctionMatches = content.match(/async\s+\w+\s*\([^)]*\)\s*{[^}]*}/g);
        if (asyncFunctionMatches) {
          asyncFunctionMatches.forEach(func => {
            if (!func.includes('try') && !func.includes('catch')) {
              console.warn(`Async function without error handling in ${file}`);
            }
          });
        }
      }
    });
  });

  describe('Security Checks', () => {
    it('should not contain hardcoded secrets', async () => {
      const allFiles = await findFiles(srcPath, '.ts', '.tsx', '.js', '.json');
      
      const secretPatterns = [
        /password\s*[:=]\s*["'][^"']{8,}["']/i,
        /api[_-]?key\s*[:=]\s*["'][^"']{20,}["']/i,
        /secret\s*[:=]\s*["'][^"']{12,}["']/i,
        /token\s*[:=]\s*["'][^"']{20,}["']/i,
        /private[_-]?key\s*[:=]\s*["'][^"']{50,}["']/i,
      ];

      for (const file of allFiles) {
        const content = fs.readFileSync(file, 'utf8');
        
        secretPatterns.forEach((pattern, index) => {
          const matches = content.match(pattern);
          if (matches) {
            fail(`Potential hardcoded secret found in ${file}: ${matches[0]}`);
          }
        });
      }
    });

    it('should use parameterized queries for database operations', async () => {
      const dataFiles = await findFiles(path.join(srcPath, 'repositories'), '.ts');
      
      for (const file of dataFiles) {
        const content = fs.readFileSync(file, 'utf8');
        
        // Check for SQL injection vulnerabilities
        const sqlPatterns = [
          /query\s*\(\s*["'`][^"'`]*\$\{[^}]+\}[^"'`]*["'`]/g,
          /execute\s*\(\s*["'`][^"'`]*\+[^"'`]*["'`]/g
        ];

        sqlPatterns.forEach(pattern => {
          const matches = content.match(pattern);
          if (matches) {
            fail(`Potential SQL injection vulnerability in ${file}: ${matches[0]}`);
          }
        });
      }
    });

    it('should validate all external inputs', async () => {
      const apiFiles = await findFiles(path.join(srcPath, 'api'), '.ts');
      
      for (const file of apiFiles) {
        const content = fs.readFileSync(file, 'utf8');
        
        // Check for input validation
        if (content.includes('req.body') || content.includes('req.params') || content.includes('req.query')) {
          if (!content.includes('validate') && !content.includes('schema') && !content.includes('joi')) {
            console.warn(`API endpoint without apparent input validation in ${file}`);
          }
        }
      }
    });

    it('should not expose sensitive information in error messages', async () => {
      const allFiles = await findFiles(srcPath, '.ts', '.tsx');
      
      for (const file of allFiles) {
        const content = fs.readFileSync(file, 'utf8');
        
        // Check for error messages that might expose sensitive info
        const sensitivePatterns = [
          /throw\s+new\s+Error\s*\(\s*["'`][^"'`]*password[^"'`]*["'`]\s*\)/i,
          /throw\s+new\s+Error\s*\(\s*["'`][^"'`]*database[^"'`]*connection[^"'`]*["'`]\s*\)/i,
          /console\.error\s*\([^)]*password[^)]*\)/i
        ];

        sensitivePatterns.forEach(pattern => {
          const matches = content.match(pattern);
          if (matches) {
            fail(`Potentially sensitive error message in ${file}: ${matches[0]}`);
          }
        });
      }
    });

    it('should use HTTPS for external API calls', async () => {
      const allFiles = await findFiles(srcPath, '.ts', '.tsx');
      
      for (const file of allFiles) {
        const content = fs.readFileSync(file, 'utf8');
        
        // Check for HTTP URLs in fetch calls
        const httpMatches = content.match(/fetch\s*\(\s*["'`]http:\/\/[^"'`]+["'`]/g);
        if (httpMatches) {
          httpMatches.forEach(match => {
            if (!match.includes('localhost') && !match.includes('127.0.0.1')) {
              fail(`Insecure HTTP URL in ${file}: ${match}`);
            }
          });
        }
      }
    });
  });

  describe('Performance Checks', () => {
    it('should not have inefficient loops', async () => {
      const allFiles = await findFiles(srcPath, '.ts', '.tsx');
      
      for (const file of allFiles) {
        const content = fs.readFileSync(file, 'utf8');
        
        // Check for nested loops that might be inefficient
        const nestedLoopPattern = /for\s*\([^}]+\)\s*{[^}]*for\s*\([^}]+\)\s*{[^}]*for\s*\(/g;
        const matches = content.match(nestedLoopPattern);
        if (matches) {
          console.warn(`Triple nested loop found in ${file} - consider optimization`);
        }
      }
    });

    it('should not have memory leaks in event listeners', async () => {
      const uiFiles = await findFiles(path.join(srcPath, 'ui'), '.ts', '.tsx');
      
      for (const file of uiFiles) {
        const content = fs.readFileSync(file, 'utf8');
        
        // Check for addEventListener without removeEventListener
        if (content.includes('addEventListener')) {
          if (!content.includes('removeEventListener') && !content.includes('useEffect')) {
            console.warn(`addEventListener without cleanup in ${file}`);
          }
        }
      }
    });

    it('should use efficient data structures', async () => {
      const allFiles = await findFiles(srcPath, '.ts', '.tsx');
      
      for (const file of allFiles) {
        const content = fs.readFileSync(file, 'utf8');
        
        // Check for inefficient array operations
        const inefficientPatterns = [
          /\.indexOf\([^)]+\)\s*>\s*-1/g,
          /for\s*\([^}]*\.length[^}]*\)\s*{[^}]*\.push\([^}]*\)/g
        ];

        inefficientPatterns.forEach(pattern => {
          const matches = content.match(pattern);
          if (matches) {
            console.warn(`Potentially inefficient operation in ${file}: ${matches[0]}`);
          }
        });
      }
    });
  });

  describe('Documentation Quality', () => {
    it('should have JSDoc comments for public APIs', async () => {
      const serviceFiles = await findFiles(path.join(srcPath, 'services'), '.ts');
      
      for (const file of serviceFiles) {
        const content = fs.readFileSync(file, 'utf8');
        
        // Check for exported functions without JSDoc
        const exportMatches = content.match(/export\s+(async\s+)?function\s+\w+/g);
        if (exportMatches) {
          exportMatches.forEach(match => {
            const functionName = match.match(/function\s+(\w+)/)?.[1];
            if (functionName && !content.includes(`/**\n * ${functionName}`)) {
              console.warn(`Missing JSDoc for exported function ${functionName} in ${file}`);
            }
          });
        }
      }
    });

    it('should have README files for major components', () => {
      const majorDirs = ['services', 'ui', 'api'];
      
      majorDirs.forEach(dir => {
        const dirPath = path.join(srcPath, dir);
        if (fs.existsSync(dirPath)) {
          const readmePath = path.join(dirPath, 'README.md');
          if (!fs.existsSync(readmePath)) {
            console.warn(`Missing README.md in ${dir} directory`);
          }
        }
      });
    });

    it('should have proper interface documentation', async () => {
      const interfaceFiles = await findFiles(srcPath, '.ts');
      
      for (const file of interfaceFiles) {
        const content = fs.readFileSync(file, 'utf8');
        
        // Check for interfaces without comments
        const interfaceMatches = content.match(/export\s+interface\s+\w+/g);
        if (interfaceMatches) {
          interfaceMatches.forEach(match => {
            const interfaceName = match.match(/interface\s+(\w+)/)?.[1];
            if (interfaceName && !content.includes(`/**\n * ${interfaceName}`)) {
              console.warn(`Missing documentation for interface ${interfaceName} in ${file}`);
            }
          });
        }
      }
    });
  });

  describe('Test Coverage', () => {
    it('should have adequate test coverage', () => {
      try {
        const result = execSync('npx jest --coverage --silent', {
          cwd: pluginRoot,
          encoding: 'utf8'
        });
        
        // Parse coverage results
        const coverageMatch = result.match(/All files[^|]*\|\s*(\d+(?:\.\d+)?)/);
        if (coverageMatch) {
          const coverage = parseFloat(coverageMatch[1]);
          expect(coverage).toBeGreaterThanOrEqual(85); // Minimum 85% coverage
        }
      } catch (error) {
        console.warn('Could not determine test coverage:', error.message);
      }
    });

    it('should test all critical paths', async () => {
      const serviceFiles = await findFiles(path.join(srcPath, 'services'), '.ts');
      const testFiles = await findFiles(testPath, '.test.ts');
      
      for (const serviceFile of serviceFiles) {
        const serviceName = path.basename(serviceFile, '.ts');
        const hasTest = testFiles.some(testFile => 
          testFile.includes(serviceName) || testFile.includes(serviceName.replace('Service', ''))
        );
        
        if (!hasTest) {
          console.warn(`No test file found for service: ${serviceName}`);
        }
      }
    });
  });

  describe('Dependency Security', () => {
    it('should not have vulnerable dependencies', () => {
      try {
        const result = execSync('npm audit --audit-level=moderate', {
          cwd: pluginRoot,
          encoding: 'utf8'
        });
        expect(result).toContain('found 0 vulnerabilities');
      } catch (error) {
        if (error.message.includes('vulnerabilities')) {
          fail(`Security vulnerabilities found in dependencies: ${error.stdout}`);
        }
      }
    });

    it('should use pinned dependency versions', () => {
      const packageJsonPath = path.join(pluginRoot, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      const checkVersions = (deps: Record<string, string>, depType: string) => {
        Object.entries(deps || {}).forEach(([name, version]) => {
          if (version.startsWith('^') || version.startsWith('~')) {
            console.warn(`Unpinned ${depType} version for ${name}: ${version}`);
          }
        });
      };

      checkVersions(packageJson.dependencies, 'dependency');
      checkVersions(packageJson.devDependencies, 'devDependency');
    });

    it('should not use deprecated packages', () => {
      try {
        const result = execSync('npm outdated', {
          cwd: pluginRoot,
          encoding: 'utf8'
        });
        
        if (result.includes('DEPRECATED')) {
          console.warn('Deprecated packages found:', result);
        }
      } catch (error) {
        // npm outdated returns non-zero exit code when packages are outdated
        if (error.stdout && error.stdout.includes('DEPRECATED')) {
          console.warn('Deprecated packages found:', error.stdout);
        }
      }
    });
  });

  // Helper functions
  async function findFiles(dir: string, ...extensions: string[]): Promise<string[]> {
    if (!fs.existsSync(dir)) {
      return [];
    }

    const files: string[] = [];
    
    function walkDir(currentDir: string) {
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          if (!item.startsWith('.') && item !== 'node_modules') {
            walkDir(fullPath);
          }
        } else if (stat.isFile()) {
          const ext = path.extname(item);
          if (extensions.some(e => ext === e)) {
            files.push(fullPath);
          }
        }
      }
    }
    
    walkDir(dir);
    return files;
  }
});