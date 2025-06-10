# Hadron Plugin - AI-Powered Crash Analysis

The Hadron plugin is a comprehensive crash analysis solution for the Alexandria platform that uses AI to provide intelligent insights into software crashes, reducing debugging time and improving software quality.

## 🚀 Features

### Core Capabilities
- **🔍 AI-Powered Analysis**: Advanced crash log analysis using large language models
- **📊 Real-time Analytics**: Comprehensive dashboards with crash trends and patterns  
- **⚠️ Intelligent Alerts**: Configurable alerts for crash patterns and anomalies
- **🔒 Enterprise Security**: File scanning, encryption, and access controls
- **🧪 Code Analysis**: Static analysis for security, performance, and quality issues
- **📈 Performance Monitoring**: Real-time system health and performance metrics

### Advanced Features
- **Multi-Platform Support**: iOS, Android, Web, Desktop crash log formats
- **Centralized AI Integration**: Uses Alexandria's shared AI service for optimal performance
- **Batch Processing**: Efficient handling of large crash log volumes
- **Export Capabilities**: PDF, CSV, JSON export for reporting and integration
- **API Integration**: RESTful APIs for external tool integration
- **Real-time Updates**: WebSocket support for live dashboard updates

## 📚 Documentation

### For Users
- **[User Guide](docs/USER_GUIDE.md)** - Complete guide for using the Hadron plugin
- **[FAQ](docs/USER_GUIDE.md#faq)** - Frequently asked questions and troubleshooting

### For Developers  
- **[API Reference](docs/API_REFERENCE.md)** - Complete API documentation with examples
- **[Plugin Development](../../../docs/development/plugin-development.md)** - Alexandria plugin development guide

### For Administrators
- **[Administrator Guide](docs/ADMINISTRATOR_GUIDE.md)** - Installation, configuration, and maintenance
- **[Centralized AI Integration](CENTRALIZED_AI_INTEGRATION.md)** - AI service architecture and benefits

## 🛠 Quick Start

### Prerequisites
- Alexandria platform v2.0+
- AI service (Ollama or compatible) configured
- Appropriate user permissions

### Basic Usage
1. **Upload Crash Log**: Use the "Upload Crash Log" button in the Hadron dashboard
2. **Wait for Analysis**: AI analysis typically completes in 1-3 minutes
3. **Review Results**: Examine root causes, confidence scores, and troubleshooting steps
4. **Take Action**: Follow recommended fixes and monitor trends

### API Example
```bash
# Upload crash log via API
curl -X POST https://your-instance.com/api/hadron/crash-analyzer/logs \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@crash.log" \
  -F 'metadata={"platform":"iOS","appVersion":"1.2.3"}'
```

## 🏗 Architecture

### System Components
```
Alexandria Platform
├── Hadron Plugin
│   ├── 🔄 Centralized AI Adapter
│   ├── 🔍 Crash Analysis Service  
│   ├── 📊 Analytics Service
│   ├── 🔒 Security Service
│   └── 📁 File Storage Service
├── 🤖 Core AI Service
├── 🗃️ Database Service
└── 💾 File Storage System
```

### Key Improvements
- **Centralized AI Integration**: Moved from direct Ollama integration to Alexandria's centralized AI service
- **Enhanced Security**: Comprehensive file scanning and threat detection
- **Improved Performance**: Caching, batch processing, and resource optimization
- **Better Scalability**: Horizontal scaling support and load balancing

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