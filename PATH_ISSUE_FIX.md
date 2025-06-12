# Alexandria Platform - PATH Issue Resolution

## 🔍 What Happened
npm successfully installed pnpm (`changed 1 package in 13s`) but PowerShell can't find it because the PATH hasn't been updated in the current session.

## 🚀 Immediate Solutions - Try These In Order:

### Solution 1: Use Direct Path (Quickest)
```powershell
cd C:\Projects\Alexandria
.\pnpm-direct.ps1
```
This script uses the full path to pnpm without needing PATH.

### Solution 2: Double-Click Batch File
Just double-click: **`quick-fix.bat`**
This will run pnpm using its direct location.

### Solution 3: New PowerShell Window
1. **Close** your current PowerShell window
2. Open a **new** PowerShell window (PATH will be refreshed)
3. Run:
   ```powershell
   cd C:\Projects\Alexandria
   pnpm --version
   ```
4. If you see a version number, run:
   ```powershell
   .\win-install.ps1
   ```

### Solution 4: Use npm Instead
Since npm is working fine:
```powershell
.\npm-install.ps1
```

## 📍 Where pnpm Was Installed
npm installed pnpm to: `%APPDATA%\npm\pnpm.cmd`
Which is typically: `C:\Users\[YourUsername]\AppData\Roaming\npm\pnpm.cmd`

## 🔧 Manual Verification
Check if pnpm exists:
```powershell
Test-Path "$env:APPDATA\npm\pnpm.cmd"
```

If it shows `True`, run:
```powershell
& "$env:APPDATA\npm\pnpm.cmd" --version
```

## 💡 Why This Happens
- npm installs global packages to `%APPDATA%\npm\`
- This folder needs to be in your PATH
- PowerShell doesn't refresh PATH automatically
- New PowerShell windows will have the updated PATH

## ✅ Quick Win
The fastest solution right now is probably:
```powershell
.\pnpm-direct.ps1
```
Or just double-click `quick-fix.bat`!