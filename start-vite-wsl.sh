#!/bin/bash
# Start Vite in WSL environment

# Set Node to use POSIX paths
export NODE_OPTIONS="--experimental-modules"

# Clear any Windows path references
unset SYSTEMROOT
unset WINDIR

# Start Vite
echo "Starting Vite dev server in WSL mode..."
node_modules/.bin/vite --host