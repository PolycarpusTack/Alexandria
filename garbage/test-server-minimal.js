const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Minimal test server running' });
});

// Test login endpoint
app.post('/api/auth/login', (req, res) => {
  console.log('Login request received:', req.body);
  
  const { username, password } = req.body;
  
  if (username === 'demo' && password === 'demo') {
    res.json({
      token: 'test-token-' + Date.now(),
      user: {
        id: 'test-user-id',
        username: 'demo',
        email: 'demo@test.com',
        roles: ['user']
      }
    });
  } else {
    res.status(401).json({
      error: 'Invalid credentials'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Minimal test server running on http://localhost:${PORT}`);
  console.log('Test endpoints:');
  console.log('- GET  /api/health');
  console.log('- POST /api/auth/login (use demo/demo)');
});