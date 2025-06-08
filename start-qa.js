#!/usr/bin/env node

/**
 * Alexandria QA Environment Launcher
 * 
 * This script sets up a QA environment for Alexandria by:
 * 1. Building the server and client
 * 2. Setting up environment variables for QA testing
 * 3. Starting the server with the built frontend
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuration
const QA_PORT = process.env.QA_PORT || 4000;
const QA_ENV = 'development';
const USE_IN_MEMORY_DB = true; // Use in-memory database for QA

// ANSI color codes for prettier console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Print a formatted message to the console
 */
function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  let prefix = '';
  
  switch (type) {
    case 'info':
      prefix = `${colors.blue}[INFO]${colors.reset}`;
      break;
    case 'success':
      prefix = `${colors.green}[SUCCESS]${colors.reset}`;
      break;
    case 'warning':
      prefix = `${colors.yellow}[WARNING]${colors.reset}`;
      break;
    case 'error':
      prefix = `${colors.red}[ERROR]${colors.reset}`;
      break;
    case 'step':
      prefix = `${colors.cyan}[STEP]${colors.reset}`;
      break;
  }
  
  console.log(`${prefix} ${colors.dim}${timestamp}${colors.reset} ${message}`);
}

/**
 * Run a command and return a promise that resolves when the command completes
 */
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
    
    proc.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Create a temporary .env file for QA
 */
function createQaEnvFile() {
  const envContent = `# QA Environment Configuration
PORT=${QA_PORT}
NODE_ENV=${QA_ENV}
JWT_SECRET=qa_test_secret_key
ENCRYPTION_KEY=qa_test_encryption_key
PLATFORM_VERSION=0.1.0
PLUGINS_DIR=./src/plugins

# Ollama (mock for QA)
OLLAMA_BASE_URL=http://localhost:11434/api
DEFAULT_LLM_MODEL=llama2:8b-chat-q4

# Database
USE_POSTGRES=false
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=alexandria_qa
POSTGRES_SSL=false

# Logging
LOG_LEVEL=debug
`;

  try {
    fs.writeFileSync(path.join(__dirname, '.env.qa'), envContent);
    log('Created QA environment configuration', 'success');
    return true;
  } catch (err) {
    log(`Failed to create QA environment file: ${err.message}`, 'error');
    return false;
  }
}

/**
 * Check system requirements
 */
async function checkRequirements() {
  log('Checking system requirements...', 'step');
  
  // Check Node.js version
  const nodeVersion = process.version;
  const requiredVersion = '>=18.0.0';
  
  log(`Node.js version: ${nodeVersion}`);
  
  try {
    // Simple version check
    const versionNum = nodeVersion.substring(1); // Remove the 'v' prefix
    const [major] = versionNum.split('.');
    
    if (parseInt(major) < 18) {
      log(`Node.js ${requiredVersion} is required, but you have ${nodeVersion}`, 'error');
      return false;
    }
  } catch (err) {
    log(`Failed to check Node.js version: ${err.message}`, 'error');
    return false;
  }
  
  // Check npm
  try {
    const npmVersion = execSync('ppppnpm --version').toString().trim();
    log(`npm version: ${npmVersion}`);
  } catch (err) {
    log('npm not found or not working properly', 'error');
    return false;
  }
  
  // Check if required directories exist
  const requiredDirs = ['src', 'public'];
  for (const dir of requiredDirs) {
    if (!fs.existsSync(path.join(__dirname, dir))) {
      log(`Required directory ${dir} not found`, 'error');
      return false;
    }
  }
  
  log('All system requirements satisfied', 'success');
  return true;
}

/**
 * Build the application
 */
async function buildApplication() {
  log('Building Alexandria for QA...', 'step');
  
  try {
    // Fix rollup first (to avoid issues with WASM)
    await runCommand('node', ['fix-rollup.js']);
    
    // Build server
    log('Building server...');
    await runCommand('pnpm', ['run', 'build:server']);
    
    // Build client
    log('Building client...');
    await runCommand('pnpm', ['run', 'build:client']);
    
    log('Build completed successfully', 'success');
    return true;
  } catch (err) {
    log(`Build failed: ${err.message}`, 'error');
    return false;
  }
}

/**
 * Install Ollama mock for QA
 */
async function setupMocks() {
  log('Setting up mock services for QA...', 'step');
  
  const mocksDir = path.join(__dirname, 'mocks');
  
  // Create mocks directory if it doesn't exist
  if (!fs.existsSync(mocksDir)) {
    fs.mkdirSync(mocksDir, { recursive: true });
  }
  
  // Create a simple Ollama mock service
  const ollamaMockPath = path.join(mocksDir, 'ollama-mock.js');
  const ollamaMockContent = `
const express = require('express');
const app = express();
const PORT = 11434;

app.use(express.json());

// Ollama API mock
app.post('/api/generate', (req, res) => {
  // Simulate a streaming response
  res.setHeader('Content-Type', 'text/event-stream');
  
  const model = req.body.model || 'llama2';
  const prompt = req.body.prompt || '';
  
  // Log the request for debugging
  console.log(\`[Ollama Mock] Generate request for model: \${model}\`);
  console.log(\`[Ollama Mock] Prompt: \${prompt.substring(0, 100)}...\`);
  
  // Send a mock response
  setTimeout(() => {
    res.write(JSON.stringify({
      model,
      created_at: new Date().toISOString(),
      response: "This is a mock response from the Ollama mock service for QA testing. " + 
                "I am simulating an LLM response to your query. " + 
                "The prompt you provided was about: " + 
                prompt.substring(0, 50) + "..."
    }));
    res.end();
  }, 500);
});

// Ollama models endpoint
app.get('/api/models', (req, res) => {
  res.json({
    models: [
      { name: "llama2:8b-chat-q4", modified_at: new Date().toISOString() },
      { name: "mistral:7b-instruct-q4", modified_at: new Date().toISOString() }
    ]
  });
});

app.listen(PORT, () => {
  console.log(\`Ollama mock service running at http://localhost:\${PORT}\`);
});
`;

  try {
    fs.writeFileSync(ollamaMockPath, ollamaMockContent);
    log('Created Ollama mock service', 'success');
    return true;
  } catch (err) {
    log(`Failed to create mock services: ${err.message}`, 'error');
    return false;
  }
}

/**
 * Start the server for QA
 */
async function startServer() {
  log('Starting Alexandria QA server...', 'step');
  
  // Copy the QA env file to .env for the server to use
  try {
    fs.copyFileSync(path.join(__dirname, '.env.qa'), path.join(__dirname, '.env'));
  } catch (err) {
    log(`Failed to set up environment: ${err.message}`, 'error');
    return false;
  }
  
  // Start the Ollama mock service
  const ollamaMockProcess = spawn('node', [path.join(__dirname, 'mocks', 'ollama-mock.js')], {
    stdio: 'inherit',
    detached: true
  });
  
  // Start the server
  const serverProcess = spawn('node', ['dist/index.js'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: QA_ENV,
      PORT: QA_PORT.toString()
    }
  });
  
  serverProcess.on('close', (code) => {
    log(`Server process exited with code ${code}`, code === 0 ? 'info' : 'error');
    
    // Clean up the Ollama mock process
    if (ollamaMockProcess && !ollamaMockProcess.killed) {
      ollamaMockProcess.kill();
    }
  });
  
  // Print access information
  log('', 'info');
  log(`${colors.bright}Alexandria QA Server is running!${colors.reset}`, 'success');
  log(`${colors.green}- Main UI: http://localhost:${QA_PORT}${colors.reset}`);
  log(`${colors.green}- API: http://localhost:${QA_PORT}/api${colors.reset}`);
  log(`${colors.green}- Static UI: http://localhost:${QA_PORT}/static${colors.reset}`);
  log('', 'info');
  log(`Press ${colors.cyan}Ctrl+C${colors.reset} to stop the server`);
  
  // Handle termination signals
  process.on('SIGINT', () => {
    log('Shutting down QA environment...', 'step');
    
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill('SIGINT');
    }
    
    if (ollamaMockProcess && !ollamaMockProcess.killed) {
      ollamaMockProcess.kill('SIGINT');
    }
    
    process.exit(0);
  });
  
  return true;
}

/**
 * Main entry point
 */
async function main() {
  console.log('\n' + 
    colors.cyan + '╔════════════════════════════════════════════╗\n' +
    colors.cyan + '║      ' + colors.bright + 'Alexandria Platform - QA Mode' + colors.cyan + '      ║\n' +
    colors.cyan + '╚════════════════════════════════════════════╝' + colors.reset + '\n'
  );
  
  try {
    // Check requirements
    if (!await checkRequirements()) {
      process.exit(1);
    }
    
    // Create QA environment file
    if (!createQaEnvFile()) {
      process.exit(1);
    }
    
    // Build the application
    if (!await buildApplication()) {
      process.exit(1);
    }
    
    // Set up mocks
    if (!await setupMocks()) {
      process.exit(1);
    }
    
    // Start the server
    if (!await startServer()) {
      process.exit(1);
    }
  } catch (err) {
    log(`Unexpected error: ${err.message}`, 'error');
    process.exit(1);
  }
}

// Run the main function
main();