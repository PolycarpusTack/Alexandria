#!/bin/bash
# TypeScript Dependencies Fix
echo "🔧 Installing missing TypeScript dependencies..."

pnpm add -w joi @types/joi
pnpm add -w @types/express@^4.17.0
pnpm add -w @types/node@^20.0.0

echo "✅ Dependencies installed!"
echo "Next: Run 'pnpm run build:server' to verify fixes"
