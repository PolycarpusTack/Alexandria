#!/bin/bash

echo "Starting Alexandria Platform (WSL Mode)..."
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

# Create logs directory if it doesn't exist
mkdir -p logs

# Function to check if port is in use
check_port() {
    lsof -ti:$1 >/dev/null 2>&1
}

# Kill processes on ports if needed
if check_port 4000; then
    echo -e "${YELLOW}Port 4000 is in use, killing process...${NC}"
    lsof -ti:4000 | xargs kill -9 2>/dev/null
fi

if check_port 3000; then
    echo -e "${YELLOW}Port 3000 is in use, killing process...${NC}"
    lsof -ti:3000 | xargs kill -9 2>/dev/null
fi

# Check if we can access node_modules
if [ ! -r "node_modules/.bin/ts-node" ]; then
    echo -e "${RED}Cannot read node_modules files from WSL!${NC}"
    echo ""
    echo -e "${YELLOW}This is a known Windows/WSL permission issue.${NC}"
    echo ""
    echo "Try running with node directly:"
    echo -e "${CYAN}node --loader ts-node/esm src/index.ts${NC}"
    echo ""
    echo "Or use the development script:"
    echo -e "${CYAN}npm run dev${NC}"
    exit 1
fi

# Try different methods to start the backend
echo -e "${GREEN}Starting backend server on port 4000...${NC}"

# Method 1: Try using npm script
if [ -f "package.json" ] && grep -q '"dev"' package.json; then
    echo "Using npm run dev..."
    npm run dev > logs/backend.log 2>&1 &
    BACKEND_PID=$!
# Method 2: Try node with ts-node loader
elif command -v node &> /dev/null; then
    echo "Using node with ts-node loader..."
    node --loader ts-node/esm src/index.ts > logs/backend.log 2>&1 &
    BACKEND_PID=$!
# Method 3: Direct npx
else
    echo "Using npx ts-node..."
    npx ts-node src/index.ts > logs/backend.log 2>&1 &
    BACKEND_PID=$!
fi

echo "Backend PID: $BACKEND_PID"

# Wait for backend to start
echo "Waiting for backend to initialize..."
sleep 5

# Check if backend is running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}Backend failed to start!${NC}"
    echo ""
    echo "Last 20 lines of backend.log:"
    tail -n 20 logs/backend.log
    echo ""
    echo -e "${YELLOW}Common fixes:${NC}"
    echo "1. Try running: npm run dev"
    echo "2. Check file permissions: ls -la node_modules/.bin/"
    echo "3. Run from Windows: Use PowerShell and run 'pnpm dev'"
    exit 1
fi

# If backend started, continue with frontend
echo -e "${GREEN}Backend started successfully!${NC}"

# Function to cleanup
cleanup() {
    echo -e "\n${YELLOW}Shutting down Alexandria...${NC}"
    kill $BACKEND_PID 2>/dev/null
    exit
}

trap cleanup EXIT INT TERM

echo -e "\n${GREEN}Alexandria is running!${NC}"
echo ""
echo "Backend:  http://localhost:4000"
echo ""
echo "Logs:"
echo "  Backend:  logs/backend.log"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Keep script running
wait