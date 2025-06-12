#!/bin/bash
echo "=== Fixing node_modules installation issue ==="
echo ""
echo "Root cause: pnpm installation was interrupted, leaving temporary directories"
echo "and missing package.json files for many packages including vite."
echo ""
echo "This script will:"
echo "1. Remove all node_modules directories"
echo "2. Remove pnpm-lock.yaml to force a fresh resolution"
echo "3. Reinstall all dependencies"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
fi

echo "Step 1: Removing node_modules..."
find . -name "node_modules" -type d -prune -exec rm -rf '{}' + 2>/dev/null

echo "Step 2: Removing lock files..."
rm -f pnpm-lock.yaml package-lock.json yarn.lock

echo "Step 3: Clearing pnpm cache..."
pnpm store prune

echo "Step 4: Installing dependencies..."
pnpm install

echo ""
echo "Installation complete. Please restart your development server."