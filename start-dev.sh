#!/bin/bash

echo "Starting Alexandria Development Environment..."

# Function to cleanup on exit
cleanup() {
    echo "Shutting down servers..."
    kill $SERVER_PID $CLIENT_PID 2>/dev/null
    exit
}

trap cleanup EXIT INT TERM

# Start backend server
echo "Starting backend server on port 4000..."
npx ts-node src/index.ts &
SERVER_PID=$!

# Wait for backend to start
sleep 5

# Start Vite dev server
echo "Starting Vite dev server on port 3000..."
npx vite &
CLIENT_PID=$!

echo "Development servers started!"
echo "Backend: http://localhost:4000"
echo "Frontend: http://localhost:3000"
echo "Press Ctrl+C to stop"

# Wait for processes
wait