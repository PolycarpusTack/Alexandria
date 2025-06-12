# QUICK FIX - Copy & Paste These Commands

## The Issue
pnpm was installed but PowerShell can't find it (PATH not refreshed).

## Solution: Use the Direct Path

Copy and paste these commands one by one:

```powershell
# 1. Check if pnpm exists
Test-Path "$env:APPDATA\npm\pnpm.cmd"
```

If it shows `True`, continue:

```powershell
# 2. Clean old files
Remove-Item -Path "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "pnpm-lock.yaml" -Force -ErrorAction SilentlyContinue

# 3. Install using full path
& "$env:APPDATA\npm\pnpm.cmd" install --force
```

## If That Doesn't Work

Option A - Try npm:
```powershell
npm install
npm install --workspaces
```

Option B - New PowerShell:
1. Close this PowerShell window
2. Open a new one
3. Type: `pnpm --version`
4. If it shows a version, run: `pnpm install --force`

## Verify Success
You'll see files being installed and no red error messages.

Then switch to WSL and run `./wsl-dev.sh`