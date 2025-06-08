#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

class TestReportGenerator {
  constructor(options = {}) {
    this.options = {
      format: options.format || 'console', // console, json, html, markdown
      output: options.output || null,
      verbose: options.verbose || false,
      includePassedDetails: options.includePassedDetails || false,
      ...options
    };
    
    this.testData = {
      suites: new Map(),
      totals: {
        tests: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0
      },
      startTime: new Date(),
      endTime: null,
      coverage: null
    };
  }

  async runTests() {
    const jestArgs = ['test', '--json'];
    
    // Add any additional jest arguments
    const additionalArgs = process.argv.slice(2).filter(arg => 
      !['--format', '--output', '--verbose', '--include-passed'].some(flag => arg.startsWith(flag))
    );
    
    jestArgs.push(...additionalArgs);
    
    return new Promise((resolve, reject) => {
      let jsonOutput = '';
      let errorOutput = '';
      
      const jestProcess = spawn('npm', jestArgs, {
        stdio: ['inherit', 'pipe', 'pipe'],
        shell: true
      });

      jestProcess.stdout.on('data', (data) => {
        const output = data.toString();
        if (this.options.verbose) {
          console.log(chalk.dim(output));
        }
        jsonOutput += output;
      });

      jestProcess.stderr.on('data', (data) => {
        const output = data.toString();
        errorOutput += output;
        if (this.options.verbose) {
          console.error(chalk.dim(output));
        }
      });

      jestProcess.on('close', (code) => {
        try {
          // Try to find JSON in the output
          const jsonMatch = jsonOutput.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            console.error(chalk.red('No JSON output found from Jest.'));
            console.error(chalk.yellow('Make sure Jest is installed and configured properly.'));
            if (errorOutput) {
              console.error(chalk.red('Error output:'), errorOutput);
            }
            reject(new Error('No JSON output from Jest'));
            return;
          }
          
          const results = JSON.parse(jsonMatch[0]);
          this.processResults(results);
          this.generateReport();
          resolve(code);
        } catch (error) {
          console.error(chalk.red('Failed to parse Jest output:'), error.message);
          if (this.options.verbose && jsonOutput) {
            console.error(chalk.dim('Raw output:'), jsonOutput.substring(0, 500));
          }
          reject(error);
        }
      });
    });
  }

  processResults(jestResults) {
    this.testData.endTime = new Date();
    this.testData.duration = this.testData.endTime - this.testData.startTime;
    
    if (jestResults.coverageMap) {
      this.testData.coverage = this.processCoverage(jestResults.coverageMap);
    }
    
    // Handle case where testResults might not exist
    if (!jestResults.testResults) {
      console.error(chalk.yellow('Warning: No test results found in Jest output'));
      return;
    }
    
    jestResults.testResults.forEach(suite => {
      const suiteData = {
        name: path.relative(process.cwd(), suite.name),
        duration: suite.endTime - suite.startTime,
        tests: [],
        passed: 0,
        failed: 0,
        skipped: 0
      };
      
      suite.assertionResults.forEach(test => {
        const testData = {
          name: test.fullName || test.title,
          status: test.status,
          duration: test.duration || 0,
          ancestorTitles: test.ancestorTitles || [],
          failureMessages: test.failureMessages || [],
          failureDetails: test.failureDetails || []
        };
        
        suiteData.tests.push(testData);
        
        switch (test.status) {
          case 'passed':
            suiteData.passed++;
            this.testData.totals.passed++;
            break;
          case 'failed':
            suiteData.failed++;
            this.testData.totals.failed++;
            break;
          case 'skipped':
          case 'pending':
            suiteData.skipped++;
            this.testData.totals.skipped++;
            break;
        }
        
        this.testData.totals.tests++;
      });
      
      this.testData.suites.set(suite.name, suiteData);
    });
    
    this.testData.totals.duration = this.testData.duration;
  }

  processCoverage(coverageMap) {
    const coverage = {
      statements: { total: 0, covered: 0, percentage: 0 },
      branches: { total: 0, covered: 0, percentage: 0 },
      functions: { total: 0, covered: 0, percentage: 0 },
      lines: { total: 0, covered: 0, percentage: 0 }
    };
    
    // Process coverage data if available
    // This is a simplified version - expand as needed
    
    return coverage;
  }

  generateReport() {
    switch (this.options.format) {
      case 'json':
        this.generateJsonReport();
        break;
      case 'html':
        this.generateHtmlReport();
        break;
      case 'markdown':
        this.generateMarkdownReport();
        break;
      case 'console':
      default:
        this.generateConsoleReport();
        break;
    }
  }

  generateConsoleReport() {
    console.log('\n' + chalk.bold('═'.repeat(80)));
    console.log(chalk.bold.cyan('TEST EXECUTION REPORT'));
    console.log(chalk.bold('═'.repeat(80)) + '\n');

    // Summary
    const passRate = this.testData.totals.tests > 0 
      ? ((this.testData.totals.passed / this.testData.totals.tests) * 100).toFixed(2) 
      : 0;
    
    console.log(chalk.bold('Summary:'));
    console.log(`  Total Tests: ${this.testData.totals.tests}`);
    console.log(`  ${chalk.green('✓ Passed')}: ${this.testData.totals.passed}`);
    console.log(`  ${chalk.red('✕ Failed')}: ${this.testData.totals.failed}`);
    console.log(`  ${chalk.yellow('○ Skipped')}: ${this.testData.totals.skipped}`);
    console.log(`  Pass Rate: ${passRate}%`);
    console.log(`  Duration: ${(this.testData.duration / 1000).toFixed(2)}s\n`);

    // Failed tests by suite
    const failedSuites = Array.from(this.testData.suites.entries())
      .filter(([_, suite]) => suite.failed > 0)
      .sort((a, b) => b[1].failed - a[1].failed);
    
    if (failedSuites.length > 0) {
      console.log(chalk.red.bold('Failed Tests by Suite:'));
      console.log(chalk.red('─'.repeat(80)));
      
      failedSuites.forEach(([suiteName, suite]) => {
        console.log(`\n${chalk.bold(suite.name)} (${suite.failed} failed)`);
        
        suite.tests
          .filter(test => test.status === 'failed')
          .forEach(test => {
            console.log(`  ${chalk.red('✕')} ${test.name}`);
            
            if (test.failureMessages.length > 0) {
              const errorSummary = this.extractErrorSummary(test.failureMessages[0]);
              console.log(`    ${chalk.dim('→')} ${chalk.red(errorSummary)}`);
              
              if (this.options.verbose) {
                test.failureMessages.forEach(msg => {
                  console.log(chalk.dim(msg.split('\n').map(line => '      ' + line).join('\n')));
                });
              }
            }
          });
      });
    }

    // Slowest tests
    const allTests = [];
    this.testData.suites.forEach(suite => {
      suite.tests.forEach(test => {
        allTests.push({
          ...test,
          suiteName: suite.name
        });
      });
    });
    
    const slowestTests = allTests
      .filter(test => test.status === 'passed' || test.status === 'failed')
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);
    
    if (slowestTests.length > 0) {
      console.log(chalk.yellow.bold('\n\nSlowest Tests:'));
      console.log(chalk.yellow('─'.repeat(80)));
      
      slowestTests.forEach((test, index) => {
        const emoji = test.status === 'passed' ? chalk.green('✓') : chalk.red('✕');
        console.log(`${index + 1}. ${emoji} ${test.name} (${test.duration}ms)`);
        console.log(`   ${chalk.dim(test.suiteName)}`);
      });
    }

    // Test suites summary
    if (this.options.verbose || this.options.includePassedDetails) {
      console.log(chalk.cyan.bold('\n\nTest Suites Summary:'));
      console.log(chalk.cyan('─'.repeat(80)));
      
      Array.from(this.testData.suites.entries())
        .sort((a, b) => b[1].duration - a[1].duration)
        .forEach(([_, suite]) => {
          const passRate = suite.tests.length > 0
            ? ((suite.passed / suite.tests.length) * 100).toFixed(0)
            : 0;
          
          const statusIcon = suite.failed === 0 ? chalk.green('✓') : chalk.red('✕');
          console.log(`\n${statusIcon} ${chalk.bold(suite.name)}`);
          console.log(`  Tests: ${suite.tests.length} | Passed: ${suite.passed} | Failed: ${suite.failed} | Skipped: ${suite.skipped}`);
          console.log(`  Duration: ${suite.duration}ms | Pass Rate: ${passRate}%`);
        });
    }

    console.log('\n' + chalk.bold('═'.repeat(80)) + '\n');
  }

  generateJsonReport() {
    const report = {
      metadata: {
        timestamp: new Date().toISOString(),
        duration: this.testData.duration,
        format: 'json',
        version: '1.0.0'
      },
      summary: this.testData.totals,
      suites: Array.from(this.testData.suites.entries()).map(([name, suite]) => ({
        name: suite.name,
        ...suite
      })),
      coverage: this.testData.coverage
    };

    const output = JSON.stringify(report, null, 2);
    
    if (this.options.output) {
      fs.writeFileSync(this.options.output, output);
      console.log(chalk.green(`✓ JSON report saved to: ${this.options.output}`));
    } else {
      console.log(output);
    }
  }

  generateHtmlReport() {
    const passRate = this.testData.totals.tests > 0 
      ? ((this.testData.totals.passed / this.testData.totals.tests) * 100).toFixed(2) 
      : 0;
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Report - ${new Date().toLocaleDateString()}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .header {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            text-align: center;
        }
        .stat-value {
            font-size: 2em;
            font-weight: bold;
            margin: 10px 0;
        }
        .passed { color: #10b981; }
        .failed { color: #ef4444; }
        .skipped { color: #f59e0b; }
        .suite {
            background: white;
            padding: 20px;
            margin-bottom: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .test {
            padding: 10px;
            margin: 5px 0;
            border-left: 4px solid;
            background: #f9fafb;
        }
        .test.passed { border-color: #10b981; }
        .test.failed { border-color: #ef4444; }
        .test.skipped { border-color: #f59e0b; }
        .error-message {
            background: #fee;
            padding: 10px;
            margin-top: 10px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 0.9em;
            overflow-x: auto;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Test Execution Report</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
        <p>Duration: ${(this.testData.duration / 1000).toFixed(2)}s</p>
    </div>
    
    <div class="summary">
        <div class="stat-card">
            <div class="stat-label">Total Tests</div>
            <div class="stat-value">${this.testData.totals.tests}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Passed</div>
            <div class="stat-value passed">${this.testData.totals.passed}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Failed</div>
            <div class="stat-value failed">${this.testData.totals.failed}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Skipped</div>
            <div class="stat-value skipped">${this.testData.totals.skipped}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Pass Rate</div>
            <div class="stat-value">${passRate}%</div>
        </div>
    </div>
    
    ${Array.from(this.testData.suites.entries()).map(([_, suite]) => `
        <div class="suite">
            <h2>${suite.name}</h2>
            <p>Tests: ${suite.tests.length} | Passed: ${suite.passed} | Failed: ${suite.failed} | Duration: ${suite.duration}ms</p>
            
            ${suite.tests.filter(test => test.status === 'failed' || this.options.includePassedDetails).map(test => `
                <div class="test ${test.status}">
                    <strong>${test.status === 'passed' ? '✓' : test.status === 'failed' ? '✕' : '○'} ${test.name}</strong>
                    ${test.duration ? `<span style="float: right; color: #666;">${test.duration}ms</span>` : ''}
                    ${test.failureMessages.length > 0 ? `
                        <div class="error-message">
                            ${test.failureMessages[0].replace(/\n/g, '<br>')}
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    `).join('')}
</body>
</html>`;

    const outputPath = this.options.output || `test-report-${Date.now()}.html`;
    fs.writeFileSync(outputPath, html);
    console.log(chalk.green(`✓ HTML report saved to: ${outputPath}`));
  }

  generateMarkdownReport() {
    const passRate = this.testData.totals.tests > 0 
      ? ((this.testData.totals.passed / this.testData.totals.tests) * 100).toFixed(2) 
      : 0;
    
    let markdown = `# Test Execution Report

Generated: ${new Date().toLocaleString()}  
Duration: ${(this.testData.duration / 1000).toFixed(2)}s

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | ${this.testData.totals.tests} |
| ✅ Passed | ${this.testData.totals.passed} |
| ❌ Failed | ${this.testData.totals.failed} |
| ⏭️ Skipped | ${this.testData.totals.skipped} |
| Pass Rate | ${passRate}% |

## Test Results by Suite

`;

    Array.from(this.testData.suites.entries()).forEach(([_, suite]) => {
      markdown += `### ${suite.name}\n\n`;
      markdown += `- **Tests:** ${suite.tests.length}\n`;
      markdown += `- **Passed:** ${suite.passed}\n`;
      markdown += `- **Failed:** ${suite.failed}\n`;
      markdown += `- **Duration:** ${suite.duration}ms\n\n`;
      
      const failedTests = suite.tests.filter(test => test.status === 'failed');
      if (failedTests.length > 0) {
        markdown += `#### Failed Tests\n\n`;
        
        failedTests.forEach(test => {
          markdown += `- ❌ **${test.name}**\n`;
          if (test.failureMessages.length > 0) {
            markdown += `  \`\`\`\n${test.failureMessages[0]}\n  \`\`\`\n\n`;
          }
        });
      }
      
      markdown += '\n---\n\n';
    });

    const outputPath = this.options.output || `test-report-${Date.now()}.md`;
    fs.writeFileSync(outputPath, markdown);
    console.log(chalk.green(`✓ Markdown report saved to: ${outputPath}`));
  }

  extractErrorSummary(errorMessage) {
    if (!errorMessage) return 'Unknown error';
    
    const lines = errorMessage.split('\n');
    
    // Look for assertion errors
    const assertionMatch = errorMessage.match(/Expected:(.+?)Received:(.+?)(?:\n|$)/s);
    if (assertionMatch) {
      return `Expected: ${assertionMatch[1].trim()} but received: ${assertionMatch[2].trim()}`;
    }
    
    // Look for error messages
    const errorMatch = errorMessage.match(/Error:\s*(.+?)(?:\n|$)/);
    if (errorMatch) {
      return errorMatch[1].trim();
    }
    
    // Return first meaningful line
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('at ')) {
        return trimmed;
      }
    }
    
    return 'Test failed';
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  format: 'console',
  output: null,
  verbose: false,
  includePassedDetails: false
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--format' && args[i + 1]) {
    options.format = args[i + 1];
    i++;
  } else if (args[i] === '--output' && args[i + 1]) {
    options.output = args[i + 1];
    i++;
  } else if (args[i] === '--verbose') {
    options.verbose = true;
  } else if (args[i] === '--include-passed') {
    options.includePassedDetails = true;
  }
}

// Run the report generator
const generator = new TestReportGenerator(options);
generator.runTests().catch(error => {
  console.error(chalk.red('Error generating test report:'), error);
  process.exit(1);
});