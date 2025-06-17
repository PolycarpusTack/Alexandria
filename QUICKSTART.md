# Alexandria Platform - Quick Start Guide

## 🎉 Server is Running!

The Alexandria Platform minimal server is now running at: **http://localhost:4000**

### Available Endpoints:
- http://localhost:4000 - Main dashboard
- http://localhost:4000/api/health - System health check
- http://localhost:4000/api/plugins - List all plugins
- http://localhost:4000/api/ai-models - Available AI models
- http://localhost:4000/api/activity - System activity

## 📋 Current Status

### ✅ What's Working:
- Basic HTTP server serving the Alexandria Platform
- Mock API endpoints for testing
- No dependency requirements (uses only Node.js built-in modules)

### ⚠️ Known Issues:
1. **Node Modules Permission Issues**: The `node_modules` directory has permission problems on Windows
2. **TypeScript Compilation Errors**: Some import statements need to be fixed
3. **Express Type Definitions**: Conflict between custom and standard Express types

## 🔧 How to Fix Development Environment

### Option 1: Fix Node Modules (Recommended)
```powershell
# Run PowerShell as Administrator
cd C:\Projects\Alexandria

# Remove corrupted node_modules
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json, pnpm-lock.yaml -ErrorAction SilentlyContinue

# Reinstall with pnpm
pnpm install --shamefully-hoist

# Or use npm as fallback
npm install --force --legacy-peer-deps
```

### Option 2: Fix TypeScript Issues
1. The file `src/types/express.d.ts` has been renamed to `express-user.d.ts` to avoid conflicts
2. Add `"moduleResolution": "node"` to `tsconfig.json` (already done)
3. Install missing type definitions:
   ```bash
   pnpm add -D @types/express @types/cors @types/helmet
   ```

### Option 3: Use WSL (Windows Subsystem for Linux)
If Windows continues to have issues:
```bash
# Install WSL
wsl --install

# In WSL, clone and setup the project
cd ~
git clone [your-repo-url]
cd Alexandria
pnpm install
pnpm dev
```

## 🚀 Starting Development (After Fixes)

### Full Development Mode:
```bash
# Start both server and client
pnpm dev

# Or start separately:
pnpm dev:server  # Backend on port 4000
pnpm dev:client  # Frontend on port 5173
```

### Minimal Mode (Current):
```bash
# Run the minimal server (no dependencies)
node minimal-server.js

# Or use the batch file
RUN_ALEXANDRIA.bat
```

## 📁 Project Structure

```
C:\Projects\Alexandria\
├── src/                    # Source code
│   ├── index.ts           # Main server entry point
│   ├── core/              # Core system modules
│   ├── plugins/           # Plugin modules (ALFRED, Hadron, Heimdall)
│   └── client/            # React frontend
├── public/                # Static files
├── minimal-server.js      # Dependency-free server
├── RUN_ALEXANDRIA.bat     # Quick start script
└── package.json          # Project dependencies
```

## 🎯 Next Steps

1. **Fix Permissions**: Run the fix commands as Administrator
2. **Install Dependencies**: Use `pnpm install --shamefully-hoist`
3. **Start Full Dev**: Run `pnpm dev` for the complete environment
4. **Access the UI**: Open http://localhost:4000 in your browser

## 🆘 Troubleshooting

### "Cannot find module" errors:
- Dependencies are not installed properly
- Run: `pnpm install --force`

### Permission denied errors:
- Close all editors and terminals
- Run PowerShell as Administrator
- Delete and reinstall node_modules

### Rollup/Vite errors:
- Install platform-specific package: `npm i -D @rollup/rollup-win32-x64-msvc`

## 📞 Support

For additional help:
- Check the project documentation in `/docs`
- Review TypeScript errors in the IDE
- Use the minimal server for basic functionality

---
*Alexandria Platform v0.1.0 - Modular AI-Enhanced Customer Care & Services Platform*
