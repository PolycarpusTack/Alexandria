#!/bin/bash

echo "Starting Alexandria Platform..."
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

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

# Start backend
echo -e "${GREEN}Starting backend server on port 4000...${NC}"
npx ts-node src/index.ts > logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend to start
echo "Waiting for backend to initialize..."
sleep 5

# Check if backend is running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}Backend failed to start!${NC}"
    echo "Check logs/backend.log for details"
    exit 1
fi

# Start frontend
echo -e "${GREEN}Starting frontend client on port 3000...${NC}"
npx vite > logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

# Function to cleanup
cleanup() {
    echo -e "\n${YELLOW}Shutting down Alexandria...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit
}

trap cleanup EXIT INT TERM

echo -e "\n${GREEN}Alexandria is starting up!${NC}"
echo ""
echo "Backend:  http://localhost:4000"
echo "Frontend: http://localhost:3000"
echo ""
echo "Logs:"
echo "  Backend:  logs/backend.log"
echo "  Frontend: logs/frontend.log"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Keep script running
wait