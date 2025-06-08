#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Simple color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  dim: '\x1b[2m'
};

class SimpleTestSummary {
  constructor() {
    this.results = {
      passed: [],
      failed: [],
      skipped: [],
      suites: new Map(),
      startTime: new Date()
    };
    this.currentSuite = '';
    this.inFailureBlock = false;
    this.currentFailure = null;
    this.failureBuffer = [];
  }

  colorize(text, color) {
    return `${colors[color] || ''}${text}${colors.reset}`;
  }

  parseOutput(line) {
    // Detect test suite
    const suiteMatch = line.match(/^\s*(PASS|FAIL)\s+(.+?)\s+(?:\((.+?)\))?$/);
    if (suiteMatch) {
      const status = suiteMatch[1];
      const suitePath = suiteMatch[2];
      const duration = suiteMatch[3];
      
      this.currentSuite = suitePath;
      if (!this.results.suites.has(suitePath)) {
        this.results.suites.set(suitePath, {
          status,
          duration,
          tests: []
        });
      }
      return;
    }

    // Detect individual tests
    const testMatch = line.match(/^\s*(✓|✕|○)\s+(.+?)(?:\s+\((\d+)\s*ms\))?$/);
    if (testMatch) {
      const icon = testMatch[1];
      const testName = testMatch[2];
      const duration = parseInt(testMatch[3] || '0');
      
      const test = {
        name: testName,
        suite: this.currentSuite,
        duration
      };

      if (icon === '✓') {
        this.results.passed.push(test);
      } else if (icon === '✕') {
        this.results.failed.push(test);
        this.currentFailure = test;
        this.failureBuffer = [];
      } else if (icon === '○') {
        this.results.skipped.push(test);
      }

      if (this.currentSuite && this.results.suites.has(this.currentSuite)) {
        this.results.suites.get(this.currentSuite).tests.push({
          ...test,
          status: icon
        });
      }
      return;
    }

    // Capture failure details
    if (this.currentFailure && line.includes('●')) {
      this.inFailureBlock = true;
      this.failureBuffer = [];
    } else if (this.inFailureBlock) {
      if (line.trim() === '' && this.failureBuffer.length > 0) {
        // End of failure block
        this.currentFailure.error = this.failureBuffer.join('\n').trim();
        this.inFailureBlock = false;
        this.currentFailure = null;
      } else if (line.trim()) {
        this.failureBuffer.push(line);
      }
    }

    // Pass through the line
    console.log(line);
  }

  extractErrorSummary(error) {
    if (!error) return 'Unknown error';
    
    const lines = error.split('\n');
    
    // Look for expect/received pattern
    const expectMatch = error.match(/expect\((.+?)\)\.(.+?)$/m);
    if (expectMatch) {
      return expectMatch[0];
    }
    
    // Look for Error: message
    const errorMatch = error.match(/Error:\s*(.+)/);
    if (errorMatch) {
      return errorMatch[1];
    }
    
    // Look for Expected/Received
    const expectedMatch = error.match(/Expected.*?:(.+?)(?:Received|$)/s);
    if (expectedMatch) {
      return `Expected: ${expectedMatch[1].trim()}`;
    }
    
    // Return first non-stack trace line
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('at ') && !trimmed.startsWith('>')) {
        return trimmed;
      }
    }
    
    return 'Test failed';
  }

  printSummary() {
    const endTime = new Date();
    const duration = endTime - this.results.startTime;
    const total = this.results.passed.length + this.results.failed.length + this.results.skipped.length;
    const passRate = total > 0 ? ((this.results.passed.length / total) * 100).toFixed(2) : 0;

    console.log('\n' + this.colorize('═'.repeat(80), 'bright'));
    console.log(this.colorize('TEST EXECUTION SUMMARY', 'bright'));
    console.log(this.colorize('═'.repeat(80), 'bright') + '\n');

    console.log(this.colorize('Overall Statistics:', 'bright'));
    console.log(`  Total Tests: ${total}`);
    console.log(`  ${this.colorize('✓ Passed', 'green')}: ${this.results.passed.length}`);
    console.log(`  ${this.colorize('✕ Failed', 'red')}: ${this.results.failed.length}`);
    console.log(`  ${this.colorize('○ Skipped', 'yellow')}: ${this.results.skipped.length}`);
    console.log(`  Pass Rate: ${passRate}%`);
    console.log(`  Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`  Completed: ${endTime.toLocaleString()}\n`);

    // Failed tests
    if (this.results.failed.length > 0) {
      console.log(this.colorize('\nFailed Tests:', 'red'));
      console.log(this.colorize('─'.repeat(80), 'red'));
      
      this.results.failed.forEach((test, index) => {
        console.log(`\n${this.colorize(`${index + 1}.`, 'red')} ${test.name}`);
        console.log(`   Suite: ${test.suite}`);
        console.log(`   Duration: ${test.duration}ms`);
        if (test.error) {
          const summary = this.extractErrorSummary(test.error);
          console.log(`   ${this.colorize('Error:', 'red')} ${summary}`);
          
          if (process.argv.includes('--verbose')) {
            console.log(this.colorize('\n   Full error:', 'dim'));
            console.log(test.error.split('\n').map(l => '     ' + l).join('\n'));
          }
        }
      });
    }

    // Slowest tests
    const allTests = [...this.results.passed, ...this.results.failed];
    const slowest = allTests.sort((a, b) => b.duration - a.duration).slice(0, 5);
    
    if (slowest.length > 0) {
      console.log(this.colorize('\n\nSlowest Tests:', 'yellow'));
      console.log(this.colorize('─'.repeat(80), 'yellow'));
      
      slowest.forEach((test, index) => {
        console.log(`${index + 1}. ${test.name} (${test.duration}ms)`);
        console.log(`   ${this.colorize(test.suite, 'dim')}`);
      });
    }

    console.log('\n' + this.colorize('═'.repeat(80), 'bright') + '\n');

    // Save to file if requested
    if (process.argv.includes('--save')) {
      this.saveResults();
    }
  }

  saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `test-summary-${timestamp}.json`;
    const filepath = path.join(process.cwd(), 'logs', filename);
    
    // Ensure logs directory exists
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    const data = {
      timestamp: new Date().toISOString(),
      duration: new Date() - this.results.startTime,
      totals: {
        tests: this.results.passed.length + this.results.failed.length + this.results.skipped.length,
        passed: this.results.passed.length,
        failed: this.results.failed.length,
        skipped: this.results.skipped.length
      },
      passed: this.results.passed,
      failed: this.results.failed.map(test => ({
        ...test,
        errorSummary: test.error ? this.extractErrorSummary(test.error) : 'Unknown error'
      })),
      skipped: this.results.skipped,
      suites: Array.from(this.results.suites.entries()).map(([name, data]) => ({
        name,
        ...data
      }))
    };
    
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    console.log(this.colorize(`\n✓ Test summary saved to: ${filepath}`, 'green'));
  }

  run() {
    // Get test command arguments
    const args = process.argv.slice(2).filter(arg => 
      arg !== '--save' && arg !== '--verbose'
    );
    
    // Determine if we should use npm or pnpm
    const hasPackageLock = fs.existsSync(path.join(process.cwd(), 'package-lock.json'));
    const hasPnpmLock = fs.existsSync(path.join(process.cwd(), 'pnpm-lock.yaml'));
    const command = hasPnpmLock ? 'pnpm' : 'npm';
    
    console.log(this.colorize(`Running tests with ${command}...`, 'cyan'));
    
    const testProcess = spawn(command, ['test', '--', ...args], {
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true
    });

    testProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => this.parseOutput(line));
    });

    testProcess.stderr.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => this.parseOutput(line));
    });

    testProcess.on('close', (code) => {
      this.printSummary();
      process.exit(code);
    });
  }
}

// Run the summary
const summary = new SimpleTestSummary();
summary.run();