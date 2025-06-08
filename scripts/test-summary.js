#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

class TestSummaryGenerator {
  constructor() {
    this.results = {
      passed: [],
      failed: [],
      skipped: [],
      total: 0,
      startTime: new Date(),
      endTime: null,
      duration: 0
    };
    this.currentTestSuite = '';
    this.currentTest = '';
    this.failureBuffer = [];
    this.outputBuffer = [];
  }

  parseJestOutput(line) {
    // Parse test suite headers
    const suiteMatch = line.match(/^\s*(PASS|FAIL|RUNS)\s+(.+)/);
    if (suiteMatch) {
      this.currentTestSuite = suiteMatch[2].trim();
      return;
    }

    // Parse individual test results
    const testMatch = line.match(/^\s*(✓|✕|○)\s+(.+?)(?:\s+\((\d+)\s*ms\))?$/);
    if (testMatch) {
      const status = testMatch[1];
      const testName = testMatch[2];
      const duration = testMatch[3] || '0';
      
      const testResult = {
        suite: this.currentTestSuite,
        name: testName,
        duration: parseInt(duration),
        timestamp: new Date().toISOString()
      };

      if (status === '✓') {
        this.results.passed.push(testResult);
      } else if (status === '✕') {
        this.currentTest = testName;
        this.results.failed.push({
          ...testResult,
          error: '' // Will be populated from error output
        });
      } else if (status === '○') {
        this.results.skipped.push(testResult);
      }
      return;
    }

    // Capture failure details
    if (this.currentTest && line.includes('●')) {
      this.failureBuffer = [];
    } else if (this.currentTest && this.failureBuffer !== null) {
      if (line.trim() === '') {
        // End of failure output
        const failedTest = this.results.failed.find(
          t => t.name === this.currentTest && t.suite === this.currentTestSuite
        );
        if (failedTest) {
          failedTest.error = this.failureBuffer.join('\n').trim();
        }
        this.failureBuffer = null;
        this.currentTest = '';
      } else {
        this.failureBuffer.push(line);
      }
    }

    // Capture coverage summary
    if (line.includes('Coverage summary')) {
      this.outputBuffer.push('\n' + chalk.cyan.bold('Coverage Summary:'));
    } else if (line.match(/^\s*(Statements|Branches|Functions|Lines)/)) {
      this.outputBuffer.push(line);
    }
  }

  generateSummary() {
    const totalTests = this.results.passed.length + this.results.failed.length + this.results.skipped.length;
    const passRate = totalTests > 0 ? ((this.results.passed.length / totalTests) * 100).toFixed(2) : 0;
    
    const summary = {
      summary: {
        total: totalTests,
        passed: this.results.passed.length,
        failed: this.results.failed.length,
        skipped: this.results.skipped.length,
        passRate: `${passRate}%`,
        duration: `${this.results.duration}ms`,
        timestamp: this.results.startTime.toISOString()
      },
      passed: this.results.passed,
      failed: this.results.failed.map(test => ({
        suite: test.suite,
        name: test.name,
        duration: test.duration,
        error: test.error,
        errorSummary: this.extractErrorSummary(test.error)
      })),
      skipped: this.results.skipped
    };

    return summary;
  }

  extractErrorSummary(error) {
    if (!error) return 'Unknown error';
    
    // Extract the most relevant error message
    const lines = error.split('\n');
    
    // Look for assertion errors
    const assertionMatch = error.match(/Expected:(.+?)Received:(.+?)(?:\n|$)/s);
    if (assertionMatch) {
      return `Expected: ${assertionMatch[1].trim()} but received: ${assertionMatch[2].trim()}`;
    }
    
    // Look for error messages
    const errorMatch = error.match(/Error:\s*(.+?)(?:\n|$)/);
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

  printConsoleSummary(summary) {
    console.log('\n' + chalk.bold('═'.repeat(80)));
    console.log(chalk.bold.white('TEST EXECUTION SUMMARY'));
    console.log(chalk.bold('═'.repeat(80)) + '\n');

    // Summary stats
    console.log(chalk.bold('Overall Statistics:'));
    console.log(`  Total Tests: ${summary.summary.total}`);
    console.log(`  ${chalk.green('✓ Passed')}: ${summary.summary.passed}`);
    console.log(`  ${chalk.red('✕ Failed')}: ${summary.summary.failed}`);
    console.log(`  ${chalk.yellow('○ Skipped')}: ${summary.summary.skipped}`);
    console.log(`  Pass Rate: ${summary.summary.passRate}`);
    console.log(`  Duration: ${summary.summary.duration}`);
    console.log(`  Timestamp: ${new Date(summary.summary.timestamp).toLocaleString()}\n`);

    // Failed tests details
    if (summary.failed.length > 0) {
      console.log(chalk.red.bold('\nFailed Tests:'));
      console.log(chalk.red('─'.repeat(80)));
      
      summary.failed.forEach((test, index) => {
        console.log(`\n${chalk.red.bold(`${index + 1}.`)} ${chalk.white(test.name)}`);
        console.log(`   Suite: ${test.suite}`);
        console.log(`   Duration: ${test.duration}ms`);
        console.log(`   ${chalk.red('Error')}: ${test.errorSummary}`);
        
        if (process.argv.includes('--verbose')) {
          console.log(`   ${chalk.dim('Full Error:')}`);
          console.log(test.error.split('\n').map(line => '     ' + line).join('\n'));
        }
      });
    }

    // Top slowest tests
    const allTests = [...summary.passed, ...summary.failed];
    const slowestTests = allTests
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5);
    
    if (slowestTests.length > 0) {
      console.log(chalk.yellow.bold('\n\nSlowest Tests:'));
      console.log(chalk.yellow('─'.repeat(80)));
      slowestTests.forEach((test, index) => {
        console.log(`${index + 1}. ${test.name} (${test.duration}ms) - ${test.suite}`);
      });
    }

    // Coverage output if captured
    if (this.outputBuffer.length > 0) {
      console.log('\n' + this.outputBuffer.join('\n'));
    }

    console.log('\n' + chalk.bold('═'.repeat(80)) + '\n');
  }

  saveToFile(summary, filename) {
    const outputPath = path.join(process.cwd(), 'logs', filename);
    
    // Ensure logs directory exists
    if (!fs.existsSync(path.dirname(outputPath))) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    }
    
    fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));
    console.log(chalk.green(`\n✓ Detailed test summary saved to: ${outputPath}`));
  }

  async run() {
    console.log(chalk.cyan.bold('Running tests and generating summary...\n'));
    
    const testArgs = process.argv.slice(2).filter(arg => 
      !['--summary', '--verbose', '--save'].includes(arg)
    );
    
    const jestArgs = ['test', '--json', '--outputFile=jest-results.json', ...testArgs];
    
    return new Promise((resolve) => {
      const jestProcess = spawn('npm', jestArgs, {
        stdio: ['inherit', 'pipe', 'pipe'],
        shell: true
      });

      jestProcess.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach(line => {
          console.log(line); // Pass through original output
          this.parseJestOutput(line);
        });
      });

      jestProcess.stderr.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach(line => {
          console.error(line); // Pass through original output
          this.parseJestOutput(line);
        });
      });

      jestProcess.on('close', (code) => {
        this.results.endTime = new Date();
        this.results.duration = this.results.endTime - this.results.startTime;
        
        // Try to read Jest's JSON output for more accurate results
        const jestResultsPath = path.join(process.cwd(), 'jest-results.json');
        if (fs.existsSync(jestResultsPath)) {
          try {
            const jestResults = JSON.parse(fs.readFileSync(jestResultsPath, 'utf8'));
            this.processJestJsonResults(jestResults);
            fs.unlinkSync(jestResultsPath); // Clean up
          } catch (error) {
            console.warn('Could not parse Jest JSON results:', error.message);
          }
        }
        
        const summary = this.generateSummary();
        this.printConsoleSummary(summary);
        
        if (process.argv.includes('--save')) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          this.saveToFile(summary, `test-summary-${timestamp}.json`);
        }
        
        resolve(code);
      });
    });
  }

  processJestJsonResults(jestResults) {
    // Override with more accurate Jest JSON results if available
    if (jestResults.testResults) {
      this.results.passed = [];
      this.results.failed = [];
      this.results.skipped = [];
      
      jestResults.testResults.forEach(suite => {
        suite.assertionResults.forEach(test => {
          const testInfo = {
            suite: suite.name,
            name: test.title,
            duration: test.duration || 0,
            timestamp: new Date().toISOString()
          };
          
          if (test.status === 'passed') {
            this.results.passed.push(testInfo);
          } else if (test.status === 'failed') {
            this.results.failed.push({
              ...testInfo,
              error: test.failureMessages.join('\n'),
              errorSummary: this.extractErrorSummary(test.failureMessages.join('\n'))
            });
          } else if (test.status === 'skipped' || test.status === 'pending') {
            this.results.skipped.push(testInfo);
          }
        });
      });
    }
  }
}

// Main execution
const generator = new TestSummaryGenerator();
generator.run().then(exitCode => {
  process.exit(exitCode);
}).catch(error => {
  console.error(chalk.red('Error running test summary:'), error);
  process.exit(1);
});