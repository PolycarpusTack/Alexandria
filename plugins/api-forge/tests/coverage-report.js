#!/usr/bin/env node

/**
 * Coverage reporting utility for Apicarus plugin
 * Generates comprehensive test coverage reports
 */

const fs = require('fs');
const path = require('path');

class CoverageReporter {
  constructor() {
    this.coverageDir = path.join(__dirname, '../coverage');
    this.reportFile = path.join(this.coverageDir, 'coverage-summary.json');
  }

  /**
   * Generate coverage report
   */
  async generateReport() {
    try {
      if (!fs.existsSync(this.reportFile)) {
        console.warn('Coverage data not found. Run tests with coverage first.');
        return;
      }

      const coverageData = JSON.parse(fs.readFileSync(this.reportFile, 'utf8'));
      
      console.log('\n📊 Test Coverage Report\n');
      console.log('=' * 50);
      
      this.printOverallCoverage(coverageData.total);
      this.printFileCoverage(coverageData);
      this.generateHTMLReport();
      this.checkThresholds(coverageData.total);
      
    } catch (error) {
      console.error('Error generating coverage report:', error.message);
    }
  }

  /**
   * Print overall coverage statistics
   */
  printOverallCoverage(total) {
    console.log('Overall Coverage:');
    console.log(`  Lines:      ${this.formatPercentage(total.lines.pct)}% (${total.lines.covered}/${total.lines.total})`);
    console.log(`  Functions:  ${this.formatPercentage(total.functions.pct)}% (${total.functions.covered}/${total.functions.total})`);
    console.log(`  Branches:   ${this.formatPercentage(total.branches.pct)}% (${total.branches.covered}/${total.branches.total})`);
    console.log(`  Statements: ${this.formatPercentage(total.statements.pct)}% (${total.statements.covered}/${total.statements.total})`);
    console.log();
  }

  /**
   * Print per-file coverage
   */
  printFileCoverage(coverageData) {
    console.log('File Coverage:');
    
    const files = Object.keys(coverageData).filter(key => key !== 'total');
    files.sort();
    
    files.forEach(file => {
      const data = coverageData[file];
      const filename = path.relative(process.cwd(), file);
      const linesPct = this.formatPercentage(data.lines.pct);
      
      console.log(`  ${filename.padEnd(40)} ${linesPct}%`);
    });
    console.log();
  }

  /**
   * Generate HTML report
   */
  generateHTMLReport() {
    const htmlReport = path.join(this.coverageDir, 'lcov-report/index.html');
    
    if (fs.existsSync(htmlReport)) {
      console.log(`📈 Detailed HTML report: file://${path.resolve(htmlReport)}`);
    }
  }

  /**
   * Check coverage thresholds
   */
  checkThresholds(total) {
    const thresholds = {
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80
    };

    const failures = [];
    
    Object.keys(thresholds).forEach(metric => {
      const actual = total[metric].pct;
      const required = thresholds[metric];
      
      if (actual < required) {
        failures.push(`${metric}: ${actual}% < ${required}%`);
      }
    });

    if (failures.length > 0) {
      console.log('❌ Coverage thresholds not met:');
      failures.forEach(failure => console.log(`  ${failure}`));
      process.exit(1);
    } else {
      console.log('✅ All coverage thresholds met!');
    }
  }

  /**
   * Format percentage for display
   */
  formatPercentage(pct) {
    if (pct === undefined || pct === null) return '0.00';
    return pct.toFixed(2);
  }

  /**
   * Generate coverage badge
   */
  generateBadge(total) {
    const linesCoverage = total.lines.pct;
    let color = 'red';
    
    if (linesCoverage >= 90) color = 'brightgreen';
    else if (linesCoverage >= 80) color = 'green';
    else if (linesCoverage >= 70) color = 'yellow';
    else if (linesCoverage >= 60) color = 'orange';
    
    const badge = `https://img.shields.io/badge/coverage-${linesCoverage.toFixed(1)}%25-${color}`;
    console.log(`\n📛 Coverage badge: ${badge}`);
    
    return badge;
  }
}

// CLI usage
if (require.main === module) {
  const reporter = new CoverageReporter();
  reporter.generateReport();
}

module.exports = CoverageReporter;