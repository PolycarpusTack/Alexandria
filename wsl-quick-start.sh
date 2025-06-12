#!/bin/bash

echo "========================================"
echo "Alexandria Platform - WSL Quick Start"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

# Create logs directory
mkdir -p logs

# Method 1: Try using npm/pnpm dev directly
echo -e "${CYAN}Attempting to start with npm run dev...${NC}"
echo ""

# First, let's check if we can run basic node commands
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js not found in WSL!${NC}"
    echo "Please install Node.js in WSL:"
    echo "  curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -"
    echo "  sudo apt-get install -y nodejs"
    exit 1
fi

# Check if pnpm is available in WSL
if command -v pnpm &> /dev/null; then
    echo -e "${GREEN}Using pnpm dev${NC}"
    pnpm dev
elif command -v npm &> /dev/null; then
    echo -e "${GREEN}Using npm run dev${NC}"
    npm run dev
else
    echo -e "${RED}Neither pnpm nor npm found in WSL!${NC}"
    echo ""
    echo -e "${YELLOW}Alternative: Run from Windows PowerShell${NC}"
    echo "1. Open PowerShell"
    echo "2. cd C:\\Projects\\Alexandria"
    echo "3. pnpm dev"
fi