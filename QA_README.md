# Alexandria QA Environment

This document provides instructions for running and testing the Alexandria platform in a QA environment.

## Overview

The QA environment is designed to provide a consistent testing environment for the Alexandria platform. It includes:

- A built version of the application (both server and client)
- Mock services for external dependencies (like Ollama)
- In-memory database for reproducible testing
- Enhanced logging for debugging
- Preconfigured environment settings

## Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- npm 8.0.0 or higher
- Git (for cloning the repository)

### Running the QA Environment

#### Windows

1. Open a command prompt
2. Navigate to the Alexandria project directory
3. Run the following command:

```
start-qa.bat
```

#### macOS/Linux

1. Open a terminal
2. Navigate to the Alexandria project directory
3. Run the following command:

```bash
node start-qa.js
```

or

```bash
chmod +x start-qa.js  # Make executable if needed
./start-qa.js
```

### Accessing the Application

Once the QA environment is running, you can access the application at:

- Main UI: http://localhost:4000
- API: http://localhost:4000/api
- Static UI: http://localhost:4000/static

## Testing Features

### Default Credentials

The QA environment includes a default admin user:

- Username: admin
- Password: temp_password (simulated in development mode)

### Available Plugins

The platform has the following plugins available for testing:

1. **Crash Analyzer Plugin**
   - Upload and analyze crash logs
   - Generate AI-powered analysis of error causes
   - View crash statistics

2. **Log Visualization Plugin**
   - Connect to various log sources
   - Search and filter logs
   - Create visualizations and dashboards

### Mock Services

The QA environment includes the following mock services:

1. **Ollama Mock**
   - Simulates the Ollama API for LLM interactions
   - Returns predictable responses for testing
   - Accessible at http://localhost:11434

## QA Test Plan

1. **Authentication Tests**
   - Login with default credentials
   - Verify token-based authentication
   - Test authorization for protected routes

2. **Core Platform Tests**
   - Verify plugin loading and initialization
   - Test event bus communication
   - Check feature flag functionality

3. **Plugin Tests**
   - Test Crash Analyzer plugin functionality
   - Test Log Visualization plugin functionality
   - Verify plugin interaction with core services

4. **UI Tests**
   - Verify responsive design on different screen sizes
   - Test accessibility features
   - Check theme switching functionality

## Troubleshooting

### Common Issues

1. **Port Conflicts**
   - If port 4000 is already in use, you can change the port in the `.env.qa` file or set the `QA_PORT` environment variable.

2. **Build Failures**
   - Check if all dependencies are installed: `npm install`
   - Verify that Node.js and npm versions meet the requirements

3. **Mock Service Issues**
   - Check if the mock services are running with: `netstat -an | findstr 11434`
   - Verify the mock service logs for errors

### Getting Help

For more help, please refer to the project documentation or contact the development team.