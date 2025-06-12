# Quick Fix - Copy & Paste These Commands

## The Issue
The installation was partial - bin scripts exist but actual modules are empty.

## Quick Fix Commands
Run these commands one by one in PowerShell:

```powershell
# 1. Add vite directly
pnpm add -D vite

# 2. Add ts-node-dev directly  
pnpm add -D ts-node-dev

# 3. Start Alexandria
pnpm dev
```

## If That Doesn't Work
Run the complete fix:
```powershell
.\complete-fix.ps1
```

## Alternative: Use npm
Since the issue is with pnpm's partial installation:
```powershell
# Remove pnpm's lock file
Remove-Item pnpm-lock.yaml -Force

# Use npm instead
npm install
npm run dev
```