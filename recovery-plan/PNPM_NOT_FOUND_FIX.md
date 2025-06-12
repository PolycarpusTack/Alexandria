# UPDATED: Alexandria Windows Setup - pnpm Not Found Fix

## 🚨 Issue Identified
`pnpm` is not installed on Windows - it's only available in your WSL environment.

## 🎯 Solution Files Created

### Primary Setup Scripts:
1. **`setup-windows.ps1`** - Complete setup that installs pnpm if needed
2. **`setup-windows.bat`** - Same thing but as a batch file
3. **`npm-install.ps1`** - Alternative using npm if pnpm is problematic
4. **`PNPM_SETUP_GUIDE.md`** - Detailed troubleshooting guide

## 🚀 Immediate Action

### Choose ONE of these approaches:

#### Approach 1: PowerShell Setup (Recommended)
```powershell
cd C:\Projects\Alexandria
.\setup-windows.ps1
```

#### Approach 2: Batch File Setup
```cmd
cd C:\Projects\Alexandria
setup-windows.bat
```

#### Approach 3: Manual Installation
```powershell
# Install pnpm first
npm install -g pnpm

# Then run the original installer
.\win-install.ps1
```

#### Approach 4: Skip pnpm, use npm
```powershell
.\npm-install.ps1
```

## 📋 What These Scripts Do

**`setup-windows.ps1`** and **`setup-windows.bat`**:
- Check if Node.js is installed
- Check if pnpm is installed  
- Install pnpm if missing
- Run the full dependency installation

**`npm-install.ps1`**:
- Uses npm instead of pnpm
- Fallback option if pnpm won't install

## ✅ Success Indicators

You'll know it worked when you see:
- "✅ pnpm installed successfully"
- "✅ Dependencies installed successfully"
- No more "pnpm is not recognized" errors

## 🔄 After Successful Windows Setup

Switch to WSL:
```bash
cd /mnt/c/Projects/Alexandria
chmod +x wsl-dev.sh
./wsl-dev.sh
```

## 💡 Why This Two-System Approach?

- **Windows owns the files** (C:\ drive)
- **Windows must modify the files** (install packages)
- **WSL runs the code** (development server)
- **Both need their tools** (pnpm on both sides)

This avoids the permission conflicts that were blocking your project!

---
Ready? Start with `.\setup-windows.ps1` in PowerShell! 🚀