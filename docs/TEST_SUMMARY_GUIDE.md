# Test Summary and Reporting Guide

This guide explains how to use the test summary and reporting tools in the Alexandria project.

## Overview

The Alexandria project includes two main test reporting tools:

1. **test-summary.js** - A real-time test runner with console summary
2. **test-report-generator.js** - An advanced report generator with multiple output formats

## Quick Start

### Basic Test Summary

```bash
# Run tests with a console summary
pnpm test:summary

# Save the summary to a JSON file
pnpm test:summary:save

# Show verbose output with full error details
pnpm test:summary:verbose
```

### Advanced Test Reports

```bash
# Generate console report (default)
pnpm test:report

# Generate HTML report
pnpm test:report:html

# Generate JSON report
pnpm test:report:json

# Generate Markdown report
pnpm test:report:markdown
```

## Test Summary Tool

The test summary tool (`scripts/test-summary.js`) provides real-time test output with a comprehensive summary.

### Features

- **Real-time output**: See test results as they run
- **Failure details**: Summarized error messages for quick debugging
- **Performance metrics**: Identifies slowest tests
- **Coverage summary**: If coverage is enabled
- **JSON export**: Save results for further analysis

### Usage Examples

```bash
# Run all tests with summary
pnpm test:summary

# Run specific test files
pnpm test:summary src/core/__tests__/

# Run with pattern matching
pnpm test:summary --testNamePattern="authentication"

# Save results with timestamp
pnpm test:summary:save

# Verbose mode for debugging
pnpm test:summary:verbose
```

### Output Format

The console output includes:

```
════════════════════════════════════════════════════════════════════════════════
TEST EXECUTION SUMMARY
════════════════════════════════════════════════════════════════════════════════

Overall Statistics:
  Total Tests: 142
  ✓ Passed: 138
  ✕ Failed: 4
  ○ Skipped: 0
  Pass Rate: 97.18%
  Duration: 12543ms
  Timestamp: 1/8/2025, 10:30:45 AM

Failed Tests:
────────────────────────────────────────────────────────────────────────────────

1. should validate user input correctly
   Suite: src/core/__tests__/validation.test.ts
   Duration: 23ms
   Error: Expected: "valid" but received: "invalid"

Slowest Tests:
────────────────────────────────────────────────────────────────────────────────
1. should handle large file uploads (1523ms) - src/services/__tests__/upload.test.ts
2. should process complex queries (892ms) - src/core/__tests__/query.test.ts
```

## Advanced Report Generator

The report generator (`scripts/test-report-generator.js`) provides multiple output formats for different use cases.

### Output Formats

#### 1. Console Report (Default)
- Colored output for terminal
- Grouped by test suites
- Failed tests highlighted
- Performance metrics

#### 2. HTML Report
- Interactive web page
- Visual statistics
- Expandable test details
- Error message formatting

#### 3. JSON Report
- Machine-readable format
- Complete test metadata
- Coverage information
- Suitable for CI/CD integration

#### 4. Markdown Report
- Documentation-friendly format
- GitHub/GitLab compatible
- Table summaries
- Code block formatting for errors

### Command Line Options

```bash
# Specify output format
node scripts/test-report-generator.js --format html

# Specify output file
node scripts/test-report-generator.js --format json --output results.json

# Include passed test details
node scripts/test-report-generator.js --include-passed

# Verbose mode
node scripts/test-report-generator.js --verbose
```

### Integration with CI/CD

Example GitHub Actions workflow:

```yaml
- name: Run tests with report
  run: |
    pnpm test:report:json --output test-results.json
    pnpm test:report:html --output test-results.html
    
- name: Upload test results
  uses: actions/upload-artifact@v3
  with:
    name: test-results
    path: |
      test-results.json
      test-results.html
```

## Debugging Failed Tests

When tests fail, use these strategies:

### 1. Quick Summary
```bash
pnpm test:summary
```
Shows concise error summaries for each failed test.

### 2. Verbose Details
```bash
pnpm test:summary:verbose
```
Shows full stack traces and error details.

### 3. HTML Report
```bash
pnpm test:report:html
```
Creates an interactive report you can open in a browser.

### 4. Focus on Failed Tests
```bash
# Run only failed tests from last run
pnpm test --onlyFailures
```

### 5. Watch Mode with Summary
```bash
# Run tests in watch mode
pnpm test --watch
```

## Best Practices

1. **Regular Summaries**: Run `pnpm test:summary` before commits
2. **Save CI Results**: Use `--save` or `--output` in CI pipelines
3. **HTML for Reviews**: Generate HTML reports for code reviews
4. **Track Performance**: Monitor slowest tests over time
5. **Fix Failures First**: Address test failures before adding features

## Troubleshooting

### Common Issues

1. **No output generated**
   - Ensure Jest is properly configured
   - Check that tests are actually running

2. **Missing test details**
   - Use `--verbose` flag
   - Check Jest configuration for reporter settings

3. **Large output files**
   - Filter tests before running
   - Use specific test patterns

4. **Performance issues**
   - Run tests in parallel (Jest default)
   - Use `--maxWorkers` to control parallelism

## Examples

### Generate a comprehensive test report for debugging:
```bash
pnpm test:summary:verbose --save
```

### Create reports for documentation:
```bash
pnpm test:report:markdown --output docs/test-results.md
```

### Quick failure analysis:
```bash
pnpm test:summary | grep -A 5 "Failed Tests:"
```

### CI/CD pipeline example:
```bash
# Run tests and generate multiple reports
pnpm test:report:json --output test-results.json
pnpm test:report:html --output test-results.html

# Check if tests passed
if [ $? -eq 0 ]; then
  echo "All tests passed!"
else
  echo "Tests failed. Check test-results.html for details."
  exit 1
fi
```