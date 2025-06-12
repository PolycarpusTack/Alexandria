# Alexandria Platform - Windows/WSL Quick Reference

## 🚀 Quick Start (After Setup)

### Daily Startup
```bash
# In WSL
cd /mnt/c/Projects/Alexandria
./wsl-dev.sh
```

### If Dependencies Changed
```powershell
# In Windows PowerShell
cd C:\Projects\Alexandria
.\win-install.ps1
```

## 📦 Managing Dependencies

### Add New Package
```powershell
# Production dependency
.\win-add-dep.ps1 express

# Dev dependency  
.\win-add-dep.ps1 -Dev @types/lodash

# To specific workspace
.\win-add-dep.ps1 -Workspace @alexandria/shared lodash
```

### Remove Package
```powershell
# From Windows PowerShell
pnpm remove express
```

## 🔧 Common Tasks

| Task | Where | Command |
|------|-------|---------|
| Install deps | Windows | `.\win-install.ps1` |
| Start dev | WSL | `./wsl-dev.sh` |
| Add package | Windows | `.\win-add-dep.ps1 <pkg>` |
| Build | Windows | `pnpm build` |
| Type check | WSL | `npx tsc --noEmit` |
| Clean all | Windows | `.\win-install.ps1` |

## ⚠️ Golden Rules

1. **ALWAYS** run `pnpm` commands from Windows PowerShell
2. **NEVER** run `pnpm install` from WSL
3. **IGNORE** VS Code dependency install prompts in WSL

## 🆘 Troubleshooting

### "Permission Denied" Error
```powershell
# Windows PowerShell (Admin)
.\win-install.ps1
```

### TypeScript Can't Find Types
```powershell
# Windows PowerShell
pnpm add -D @types/node @types/express
```

### Everything is Broken
```powershell
# Windows PowerShell - Nuclear Reset
Remove-Item -Path node_modules, .pnpm-store, pnpm-lock.yaml -Recurse -Force
.\win-install.ps1
```

## 📝 VS Code Settings

Add to `.vscode/settings.json`:
```json
{
  "npm.packageManager": "pnpm",
  "typescript.tsdk": "node_modules/typescript/lib",
  "remote.WSL.fileWatcher.polling": true
}
```