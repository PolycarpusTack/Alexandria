const http = require('http');
const fs = require('fs');
const path = require('path');

// Initialize core services with minimal dependencies
async function startMinimalServer() {
  console.log('🚀 Starting minimal Alexandria server...\n');
  
  // Test the core initialization
  try {
    const { initializeCore } = require('./dist/core');
    
    console.log('📦 Initializing core services...');
    const coreServices = await initializeCore({
      logLevel: 'info',
      environment: 'development',
      jwtSecret: 'test-jwt-secret-key-for-development',
      encryptionKey: 'test-encryption-key-for-development'
    });
    
    console.log('✅ Core services initialized successfully!\n');
    console.log('Available services:');
    console.log('  - Core System:', !!coreServices.coreSystem);
    console.log('  - Event Bus:', !!coreServices.eventBus);
    console.log('  - Plugin Registry:', !!coreServices.pluginRegistry);
    console.log('  - Feature Flags:', !!coreServices.featureFlags);
    console.log('  - Data Service:', !!coreServices.dataService);
    console.log('  - Security Service:', !!coreServices.securityService);
    
  } catch (error) {
    console.error('❌ Failed to initialize core:', error.message);
    console.error('\nStack trace:', error.stack);
  }
  
  // Create a minimal HTTP server
  const server = http.createServer((req, res) => {
    if (req.url === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', version: '0.1.0' }));
    } else if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <head><title>Alexandria Platform</title></head>
          <body>
            <h1>Alexandria Platform - Minimal Test Server</h1>
            <p>Core initialization test completed. Check console for details.</p>
            <p>API Health: <a href="/api/health">/api/health</a></p>
          </body>
        </html>
      `);
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });
  
  const PORT = 4000;
  server.listen(PORT, () => {
    console.log(`\n🖥️  Server running on http://localhost:${PORT}`);
    console.log('📍 Endpoints:');
    console.log('   - http://localhost:4000/');
    console.log('   - http://localhost:4000/api/health');
  });
}

startMinimalServer().catch(console.error);