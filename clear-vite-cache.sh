#!/bin/bash
echo "Clearing Vite cache..."

# Delete Vite cache
if [ -d "node_modules/.vite" ]; then
    echo "Removing .vite cache directory..."
    rm -rf node_modules/.vite
fi

# Delete Vite temp files
if [ -d "node_modules/.vite-temp" ]; then
    echo "Removing .vite-temp directory..."
    rm -rf node_modules/.vite-temp
fi

# Delete dist folder
if [ -d "dist" ]; then
    echo "Removing dist directory..."
    rm -rf dist
fi

# Clear any Vite lock files
find . -name "*.vite-tmp*" -type f -delete 2>/dev/null || true

echo "Vite cache cleared successfully!"
echo "Please restart the development server."