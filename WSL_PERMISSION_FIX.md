# Alexandria WSL Permission Issue - Solutions

## 🔍 The Problem
When running from WSL, you're getting:
```
Error: EACCES: permission denied, open '/mnt/c/Projects/Alexandria/node_modules/ts-node/dist/bin.js'
```

This happens because:
- Files were installed from Windows (with Windows permissions)
- WSL is trying to execute those files (with Linux permissions)
- Windows/WSL permission mapping isn't perfect

## 🚀 Quick Solutions - Try These In Order:

### Solution 1: Run Dev from Windows Instead (Easiest!)
This is often the simplest approach:

**Windows PowerShell:**
```powershell
cd C:\Projects\Alexandria
pnpm dev
```
Then access the app from your browser normally at http://localhost:3000

### Solution 2: Use the WSL Quick Start
**In WSL:**
```bash
cd /mnt/c/Projects/Alexandria
chmod +x wsl-quick-start.sh
./wsl-quick-start.sh
```

### Solution 3: Compile First, Then Run
**In WSL:**
```bash
cd /mnt/c/Projects/Alexandria
node wsl-compile-run.js
```
This compiles TypeScript to JavaScript first, avoiding ts-node permission issues.

### Solution 4: Direct Node Execution
**In WSL:**
```bash
cd /mnt/c/Projects/Alexandria
node dev-robust.js
```

### Solution 5: Fix Permissions (More Complex)
**In WSL (as sudo):**
```bash
# Make node_modules executable
sudo chmod -R 755 node_modules/

# Or specifically for ts-node
sudo chmod -R 755 node_modules/ts-node/
sudo chmod -R 755 node_modules/.bin/
```

## 📊 Comparison of Approaches

| Method | Pros | Cons |
|--------|------|------|
| Run from Windows | Always works, no permission issues | Need PowerShell open |
| WSL Quick Start | Simple command | May hit same issue |
| Compile First | Avoids ts-node entirely | Extra compilation step |
| Fix Permissions | Permanent fix | Requires sudo access |
| Direct Node | Uses existing scripts | Depends on script setup |

## 🏆 Recommended Approach

**For immediate results:**
1. **Use Windows PowerShell** to run `pnpm dev`
2. Keep WSL for code editing only
3. Access the app from any browser

**For a permanent fix:**
1. Always run servers from Windows side (it owns the files)
2. Use WSL for git, editing, and other development tasks

## 🔧 What We've Created to Help:

1. **`wsl-quick-start.sh`** - Simple starter script
2. **`wsl-compile-run.js`** - Compiles TS then runs JS
3. **`wsl-dev-fixed.sh`** - Enhanced error handling
4. **`WSL_PERMISSION_FIX.md`** - This guide

## 💡 Long-Term Solutions

### Option A: Two-Terminal Workflow
- Terminal 1 (PowerShell): `pnpm dev`
- Terminal 2 (WSL): All other development

### Option B: WSL-Only Development
- Move project to `~/Projects/Alexandria` in WSL
- Install everything from within WSL
- No more permission conflicts

### Option C: Docker Development
- Containerize the development environment
- Consistent permissions across all systems

## 🎯 Quick Win Right Now

Open PowerShell and run:
```powershell
cd C:\Projects\Alexandria
pnpm dev
```

Your Alexandria platform should start successfully! 🚀