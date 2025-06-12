#!/bin/bash
# Alexandria Platform - WSL Development Launcher

echo "==========================================="
echo "Alexandria Platform - WSL Development Mode"
echo "==========================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Not in Alexandria root directory${NC}"
    echo "Please run from /mnt/c/Projects/Alexandria"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${RED}❌ Missing node_modules!${NC}"
    echo ""
    echo "Please run these commands from Windows PowerShell:"
    echo -e "${CYAN}cd C:\\Projects\\Alexandria${NC}"
    echo -e "${CYAN}.\\win-install.ps1${NC}"
    exit 1
fi

# Check for critical TypeScript types
missing_types=()
for type in "@types/node" "@types/express" "@types/cors"; do
    if [ ! -d "node_modules/$type" ]; then
        missing_types+=("$type")
    fi
done

if [ ${#missing_types[@]} -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Missing TypeScript types:${NC}"
    printf '%s\n' "${missing_types[@]}"
    echo ""
    echo "Run from Windows PowerShell:"
    echo -e "${CYAN}cd C:\\Projects\\Alexandria${NC}"
    echo -e "${CYAN}pnpm add -D ${missing_types[@]}${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Dependencies detected${NC}"

# Check if start script exists
if [ ! -f "./start-alexandria.sh" ]; then
    echo -e "${YELLOW}⚠️  start-alexandria.sh not found, using pnpm dev${NC}"
    echo ""
    echo "Starting development servers..."
    pnpm dev
else
    # Make sure start script is executable
    chmod +x ./start-alexandria.sh
    echo "Starting Alexandria platform..."
    ./start-alexandria.sh
fi