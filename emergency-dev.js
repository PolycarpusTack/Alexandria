/**
 * Alexandria Platform - Emergency Development Starter
 * 
 * This script provides a minimal development environment when standard tools fail
 */

const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

console.log('\n🚀 Starting Alexandria Platform in Emergency Mode...\n');

// Simple TypeScript compilation
console.log('📦 Compiling TypeScript files...');

const tscPath = path.join(__dirname, 'node_modules', 'typescript', 'bin', 'tsc');

if (!fs.existsSync(tscPath)) {
  console.error('❌ TypeScript not found! Please run: pnpm install typescript');
  process.exit(1);
}

// Compile TypeScript with minimal config
const compileProcess = spawn('node', [tscPath, '--noEmit', 'false', '--outDir', 'dist'], {
  cwd: __dirname,
  shell: true
});

compileProcess.on('close', (code) => {
  if (code !== 0) {
    console.error('❌ TypeScript compilation failed!');
    console.log('\n💡 Starting server anyway with existing code...\n');
  } else {
    console.log('✅ TypeScript compilation complete!\n');
  }
  
  // Start the server using Node directly
  startServer();
});

function startServer() {
  console.log('🔧 Starting server with Node.js directly...\n');
  
  // Create a simple Express server inline
  const serverCode = `
    const express = require('express');
    const cors = require('cors');
    const path = require('path');
    
    const app = express();
    const PORT = process.env.PORT || 4000;
    
    // Middleware
    app.use(cors());
    app.use(express.json());
    app.use(express.static(path.join(__dirname, 'public')));
    
    // Basic routes
    app.get('/api/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        message: 'Alexandria Platform is running in emergency mode',
        timestamp: new Date().toISOString()
      });
    });
    
    app.get('/api/plugins', (req, res) => {
      res.json({
        plugins: [
          { id: 'alfred', name: 'ALFRED', status: 'active' },
          { id: 'hadron', name: 'Crash Analyzer', status: 'active' },
          { id: 'heimdall', name: 'Heimdall', status: 'inactive' }
        ]
      });
    });
    
    // Serve the HTML file
    app.get('/', (req, res) => {
      const htmlPath = path.join(__dirname, 'Alexandria Platform Enhanced UI.html');
      if (fs.existsSync(htmlPath)) {
        res.sendFile(htmlPath);
      } else {
        res.send('<h1>Alexandria Platform</h1><p>Emergency mode active. HTML file not found.</p>');
      }
    });
    
    app.listen(PORT, () => {
      console.log('✅ Server running at http://localhost:' + PORT);
      console.log('📝 API Health check: http://localhost:' + PORT + '/api/health');
      console.log('🔌 API Plugins: http://localhost:' + PORT + '/api/plugins');
    });
  `;
  
  // Write and run the emergency server
  fs.writeFileSync(path.join(__dirname, 'emergency-server.js'), serverCode);
  
  const serverProcess = spawn('node', ['emergency-server.js'], {
    cwd: __dirname,
    stdio: 'inherit'
  });
  
  // Also serve the HTML file directly if available
  const htmlFile = path.join(__dirname, 'Alexandria Platform Enhanced UI.html');
  if (fs.existsSync(htmlFile)) {
    console.log('\n🎨 HTML UI file found!');
    console.log('📂 You can open it directly in your browser:');
    console.log(`   file:///${htmlFile.replace(/\\/g, '/')}\n`);
  }
  
  // Simple static file server for the HTML
  const staticServer = http.createServer((req, res) => {
    if (req.url === '/' && fs.existsSync(htmlFile)) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      fs.createReadStream(htmlFile).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  
  staticServer.listen(5173, () => {
    console.log('🎨 Static UI server running at http://localhost:5173');
  });
  
  console.log('\n💡 Press Ctrl+C to stop the server\n');
  
  // Handle termination
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    if (serverProcess) serverProcess.kill();
    staticServer.close();
    process.exit(0);
  });
}

// If TypeScript compilation fails immediately, start server anyway
compileProcess.on('error', () => {
  console.log('⚠️  TypeScript compiler not accessible, starting server directly...');
  startServer();
});
