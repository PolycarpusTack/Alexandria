const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class DeprecationScanner {
  constructor() {
    this.results = [];
  }

  /**
   * Scan for deprecated API usage
   */
  async scan(rootDir) {
    console.log('Scanning for deprecated API usage...\n');
    
    // First, check direct usage in source code
    await this.scanSourceCode(rootDir);
    
    // Then, check dependencies
    await this.scanDependencies(rootDir);
    
    // Use Node.js trace to find exact location
    await this.traceDeprecation();
    
    return this.results;
  }

  /**
   * Scan source code for deprecated APIs
   */
  async scanSourceCode(rootDir) {
    const deprecatedPatterns = [
      {
        pattern: /util\._extend/g,
        message: 'util._extend usage',
        replacement: 'Object.assign'
      },
      {
        pattern: /new Buffer\(/g,
        message: 'Buffer() constructor',
        replacement: 'Buffer.from() or Buffer.alloc()'
      },
      {
        pattern: /require\(['"]sys['"]\)/g,
        message: 'sys module',
        replacement: 'util module'
      }
    ];
    const files = this.getFiles(rootDir);
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      
      deprecatedPatterns.forEach(({ pattern, message, replacement }) => {
        lines.forEach((line, index) => {
          if (pattern.test(line)) {
            this.results.push({
              file: path.relative(rootDir, file),
              line: index + 1,
              code: line.trim(),
              type: 'direct'
            });
            
            console.log(`Found ${message} in ${file}:${index + 1}`);
            console.log(`  Code: ${line.trim()}`);
            console.log(`  Suggestion: Use ${replacement} instead\n`);
          }
        });
      });
    }
  }

  /**
   * Scan dependencies for deprecated API usage
   */
  async scanDependencies(rootDir) {
    const nodeModulesPath = path.join(rootDir, 'node_modules');
    
    // List of common packages known to use deprecated APIs
    const suspectPackages = [
      'ts-node-dev',
      'chokidar',
      'webpack',
      'babel-core',
      'gulp',
      'grunt'
    ];
    for (const pkg of suspectPackages) {
      const pkgPath = path.join(nodeModulesPath, pkg);
      if (fs.existsSync(pkgPath)) {
        const version = this.getPackageVersion(pkgPath);
        console.log(`Checking ${pkg} (v${version})...`);
        
        // Check if package has known issues
        const hasIssues = await this.checkPackageForDeprecations(pkg, version);
        if (hasIssues) {
          this.results.push({
            file: `node_modules/${pkg}`,
            line: 0,
            code: 'Package uses deprecated APIs',
            type: 'dependency',
            package: `${pkg}@${version}`
          });
        }
      }
    }
  }

  /**
   * Use Node.js trace to find exact deprecation source
   */
  async traceDeprecation() {
    console.log('\nRunning with deprecation trace...\n');
    
    try {
      // Create a test script that imports the app
      const testScript = `
        process.on('warning', (warning) => {
          if (warning.name === 'DeprecationWarning') {
            console.log('DEPRECATION_TRACE:', JSON.stringify({
              message: warning.message,
              stack: warning.stack
            }));
          }
        });
        require('../src/index.js');
      `;
      fs.writeFileSync('trace-deprecation.js', testScript);
      
      // Run with trace-deprecation flag
      const output = execSync(
        'node --trace-deprecation trace-deprecation.js',
        { encoding: 'utf-8', stdio: 'pipe' }
      ).toString();
      
      // Parse output for deprecation traces
      const traces = output.match(/DEPRECATION_TRACE:[\s\S]*?(?=DEPRECATION_TRACE:|$)/g);
      if (traces) {
        traces.forEach(trace => {
          console.log('Deprecation trace found:');
          console.log(trace);
        });
      }
      
      // Clean up
      fs.unlinkSync('trace-deprecation.js');
    } catch (error) {
      console.error('Failed to trace deprecation:', error.message);
    }
  }

  /**
   * Get all JavaScript and TypeScript files in directory
   */
  getFiles(dir, files = []) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      
      if (fs.statSync(fullPath).isDirectory()) {
        if (!item.includes('node_modules') && !item.startsWith('.')) {
          this.getFiles(fullPath, files);
        }
      } else if (item.endsWith('.ts') || item.endsWith('.js')) {
        files.push(fullPath);
      }
    }
    
    return files;
  }
  /**
   * Get package version
   */
  getPackageVersion(pkgPath) {
    try {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(pkgPath, 'package.json'), 'utf-8')
      );
      return packageJson.version;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Check if specific package version has deprecation issues
   */
  async checkPackageForDeprecations(pkg, version) {
    // Known packages with deprecation issues
    const knownIssues = {
      'ts-node-dev': '< 2.0.0', // Versions below 2.0.0 use util._extend
      'chokidar': '< 3.0.0',
      'webpack': '< 4.0.0'
    };

    if (knownIssues[pkg]) {
      // Simple version comparison (could be improved)
      return true; // For now, flag for manual review
    }

    return false;
  }
}

// Run scanner
if (require.main === module) {
  const scanner = new DeprecationScanner();
  scanner.scan(process.cwd()).then(results => {
    console.log(`\nFound ${results.length} deprecation issues.`);
    
    if (results.length > 0) {
      console.log('\nSummary:');
      results.forEach(result => {
        console.log(`- ${result.file}:${result.line} (${result.type})`);
      });
    }
  });
}

module.exports = DeprecationScanner;