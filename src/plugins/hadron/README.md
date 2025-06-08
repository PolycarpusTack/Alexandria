# Crash Analyzer Plugin

A plugin for Alexandria platform that analyzes software crash files to reduce debugging time.

## Features

- Secure file upload for crash logs and code snippets
- AI-powered analysis using locally deployed Ollama LLM
- Various analysis options (explain crash, suggest fixes)
- Storage of analysis history
- Database integration for persistent storage

## Code Coverage

<!-- Code coverage badges will be automatically generated here -->

## Development

### Installation

```bash
npm install
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Generate detailed coverage report
npm run test:coverage:detailed

# Generate coverage report for CI environments
npm run test:coverage:ci

# Generate coverage badges for README
npm run test:coverage:badges

# Run complete coverage reporting process
npm run coverage:report
```

### Automated Coverage Reporting

The project includes a shell script to automate the coverage reporting process:

```bash
# Run the automated coverage reporting script
./generate-coverage.sh
```

This script will:
1. Run tests with coverage
2. Generate README badges
3. Extract coverage statistics
4. Compare coverage with thresholds
5. Report results

### Coverage Requirements

The project has the following coverage requirements:
- Branches: 70%
- Functions: 70%
- Lines: 70%
- Statements: 70%

### Coverage Reports

After running the coverage tests, the following reports are generated:

- **HTML Report**: `./coverage/lcov-report/index.html` - Detailed HTML coverage report
- **LCOV Report**: `./coverage/lcov.info` - Standard LCOV format for integrations
- **JSON Summary**: `./coverage/coverage-summary.json` - JSON format for badges and CI systems
- **JUnit XML Report**: `./coverage/junit.xml` - XML report for CI/CD systems

### Continuous Integration

The coverage reports are integrated with the CI pipeline, which:
1. Runs tests with coverage
2. Verifies coverage thresholds
3. Generates coverage badges
4. Fails the build if coverage requirements are not met