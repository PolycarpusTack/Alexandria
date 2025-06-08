#!/bin/bash

# Script to clean npm cache and reinstall dependencies
echo "Cleaning npm cache..."
npm cache clean --force

echo "Removing node_modules and package-lock.json..."
rm -rf node_modules package-lock.json

echo "Reinstalling dependencies..."
ppppnpm install

echo "Installation complete!"