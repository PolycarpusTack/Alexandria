/**
 * Alexandria Platform - Minimal Development Server
 * This creates a working server without requiring complex dependencies
 */

console.log('\n🚀 Alexandria Platform - Starting Minimal Server...\n');

// Basic HTTP server without Express
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 4000;

// MIME types for serving files
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// Mock data for API endpoints
const mockData = {
    health: {
        status: 'operational',
        message: 'Alexandria Platform is running',
        version: '0.1.0',
        timestamp: new Date().toISOString()
    },
    plugins: [
        {
            id: 'alfred',
            name: 'ALFRED',
            description: 'AI-powered coding assistant',
            status: 'active',
            version: '2.0.0',
            stats: {
                requests: 893,
                success: '98.2%',
                avgTime: '145ms'
            }
        },
        {
            id: 'hadron',
            name: 'Crash Analyzer',
            description: 'AI-powered crash log analysis',
            status: 'active',
            version: '1.0.0',
            stats: {
                logs: 24,
                accuracy: '89.4%',
                avgTime: '2.3s'
            }
        },
        {
            id: 'heimdall',
            name: 'Heimdall',
            description: 'Log visualization platform',
            status: 'inactive',
            version: '1.0.0',
            stats: {
                sources: '—',
                monitors: '—',
                alerts: '—'
            }
        }
    ],
    models: [
        { id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI', status: 'available' },
        { id: 'claude-3', name: 'Claude 3', provider: 'Anthropic', status: 'available' },
        { id: 'llama2', name: 'Llama 2', provider: 'Meta', status: 'available' },
        { id: 'codellama', name: 'CodeLlama', provider: 'Meta', status: 'available' }
    ],
    activity: {
        sessions: 147,
        logsProcessed: 1337,
        activeUsers: 23,
        systemLoad: {
            cpu: 23,
            memory: 47,
            disk: 68,
            apiLatency: 45
        }
    }
};

// Create the server
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // API Routes
    if (pathname.startsWith('/api/')) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        switch (pathname) {
            case '/api/health':
                res.end(JSON.stringify(mockData.health));
                break;
            case '/api/plugins':
                res.end(JSON.stringify({ plugins: mockData.plugins }));
                break;
            case '/api/ai-models':
                res.end(JSON.stringify({ models: mockData.models }));
                break;
            case '/api/activity':
                res.end(JSON.stringify(mockData.activity));
                break;
            default:
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'API endpoint not found' }));
        }
        return;
    }

    // Serve static files
    let filePath = '.' + pathname;
    if (filePath === './') {
        filePath = './public/index.html';
    }

    const extname = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // File not found, serve a default page
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(getDefaultHTML());
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${error.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`✅ Server is running at http://localhost:${PORT}`);
    console.log(`📡 API Health: http://localhost:${PORT}/api/health`);
    console.log(`🔌 Plugins: http://localhost:${PORT}/api/plugins`);
    console.log(`🤖 AI Models: http://localhost:${PORT}/api/ai-models`);
    console.log(`📊 Activity: http://localhost:${PORT}/api/activity`);
    console.log('\n💡 Press Ctrl+C to stop the server\n');
});

// Default HTML page
function getDefaultHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Alexandria Platform</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <style>
        body { background-color: #0d0d0d; color: #e5e5e5; }
        .card { background-color: #1a1a1a; border: 1px solid #262626; }
    </style>
</head>
<body class="font-sans">
    <div class="min-h-screen p-8">
        <div class="max-w-6xl mx-auto">
            <h1 class="text-4xl font-bold text-blue-500 mb-8">Alexandria Platform</h1>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <div class="card rounded-lg p-6">
                    <div class="flex items-center mb-4">
                        <i class="fas fa-heart-pulse text-green-500 text-2xl mr-3"></i>
                        <h2 class="text-xl font-semibold">System Status</h2>
                    </div>
                    <p class="text-green-500 font-semibold">✅ Operational</p>
                    <p class="text-sm text-gray-400 mt-2">All systems running normally</p>
                </div>
                
                <div class="card rounded-lg p-6">
                    <div class="flex items-center mb-4">
                        <i class="fas fa-puzzle-piece text-blue-500 text-2xl mr-3"></i>
                        <h2 class="text-xl font-semibold">Active Plugins</h2>
                    </div>
                    <p class="text-3xl font-bold text-blue-500">3</p>
                    <p class="text-sm text-gray-400 mt-2">ALFRED, Crash Analyzer, Heimdall</p>
                </div>
                
                <div class="card rounded-lg p-6">
                    <div class="flex items-center mb-4">
                        <i class="fas fa-brain text-purple-500 text-2xl mr-3"></i>
                        <h2 class="text-xl font-semibold">AI Models</h2>
                    </div>
                    <p class="text-3xl font-bold text-purple-500">4</p>
                    <p class="text-sm text-gray-400 mt-2">GPT-4, Claude 3, Llama 2, CodeLlama</p>
                </div>
            </div>
            
            <div class="card rounded-lg p-6">
                <h2 class="text-2xl font-semibold mb-4">API Endpoints</h2>
                <div class="space-y-2">
                    <a href="/api/health" class="block text-blue-400 hover:text-blue-300">
                        <i class="fas fa-link mr-2"></i>/api/health - System health check
                    </a>
                    <a href="/api/plugins" class="block text-blue-400 hover:text-blue-300">
                        <i class="fas fa-link mr-2"></i>/api/plugins - List all plugins
                    </a>
                    <a href="/api/ai-models" class="block text-blue-400 hover:text-blue-300">
                        <i class="fas fa-link mr-2"></i>/api/ai-models - Available AI models
                    </a>
                    <a href="/api/activity" class="block text-blue-400 hover:text-blue-300">
                        <i class="fas fa-link mr-2"></i>/api/activity - System activity
                    </a>
                </div>
            </div>
            
            <div class="mt-8 text-center text-gray-500">
                <p>Alexandria Platform v0.1.0 - Running in minimal mode</p>
            </div>
        </div>
    </div>
    
    <script>
        // Auto-refresh system status
        async function updateStatus() {
            try {
                const response = await fetch('/api/health');
                const data = await response.json();
                console.log('System status:', data);
            } catch (error) {
                console.error('Failed to fetch status:', error);
            }
        }
        
        // Update every 30 seconds
        setInterval(updateStatus, 30000);
        updateStatus();
    </script>
</body>
</html>`;
}
