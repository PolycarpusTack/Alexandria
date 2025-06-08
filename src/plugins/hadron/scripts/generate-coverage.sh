#!/bin/bash

# Ensure script directory exists
mkdir -p "$(dirname "$0")"

# Run tests with coverage
echo "Running tests with coverage..."
npm run test:coverage

# Generate coverage report
echo "Generating coverage report..."
npm run test:coverage:detailed

# Generate badges if istanbul-badges-readme is installed
if npm list istanbul-badges-readme > /dev/null 2>&1; then
  echo "Generating coverage badges..."
  npm run test:coverage:badges
else
  echo "istanbul-badges-readme not installed. Skipping badge generation."
  echo "To install, run: npm install --save-dev istanbul-badges-readme"
fi

echo "Coverage report generated successfully."
echo "View HTML report at: ./coverage/index.html"