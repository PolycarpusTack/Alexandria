#!/bin/bash

# Script to verify and install missing dependencies
echo "Verifying dependencies..."

# Create a temporary file to store missing dependencies
MISSING_DEPS=""
MISSING_TYPES=""

# Define required dependencies
DEPS=(
  "@radix-ui/react-tooltip"
  "multer"
  "axios"
  "lucide-react"
)

# Define required type definitions
TYPES=(
  "@types/multer"
  "@types/axios"
)

# Check each dependency
for dep in "${DEPS[@]}"; do
  if ! npm list "$dep" 2>/dev/null | grep -q "$dep"; then
    echo "$dep is not installed"
    MISSING_DEPS="$MISSING_DEPS $dep"
  else
    echo "$dep is installed"
  fi
done

# Check each type definition
for type in "${TYPES[@]}"; do
  if ! npm list "$type" --dev 2>/dev/null | grep -q "$type"; then
    echo "$type is not installed"
    MISSING_TYPES="$MISSING_TYPES $type"
  else
    echo "$type is installed"
  fi
done

# Install missing dependencies
if [ ! -z "$MISSING_DEPS" ]; then
  echo "Installing missing dependencies: $MISSING_DEPS"
  npm install $MISSING_DEPS
else
  echo "All dependencies are installed"
fi

# Install missing type definitions
if [ ! -z "$MISSING_TYPES" ]; then
  echo "Installing missing type definitions: $MISSING_TYPES"
  npm install --save-dev $MISSING_TYPES
else
  echo "All type definitions are installed"
fi

echo "Dependency verification complete"