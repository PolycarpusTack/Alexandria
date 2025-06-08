#!/bin/bash

# This script generates coverage reports for the Hadron crash analyzer plugin

# Ensure we're in the right directory
cd "$(dirname "$0")"

echo "🧪 Running tests with coverage..."
npm run test:coverage:detailed

echo "📊 Generating coverage badges..."
npm run test:coverage:badges

echo "📝 Generating coverage summary..."
if [ -f "./coverage/lcov-report/index.html" ]; then
  echo "✅ Coverage report generated: ./coverage/lcov-report/index.html"
  
  # Extract summary statistics
  LINES=$(grep -A 4 "Lines" ./coverage/lcov-report/index.html | grep "strong" | sed -E 's/.*>([0-9.]+)%.*/\1/')
  STATEMENTS=$(grep -A 4 "Statements" ./coverage/lcov-report/index.html | grep "strong" | sed -E 's/.*>([0-9.]+)%.*/\1/')
  FUNCTIONS=$(grep -A 4 "Functions" ./coverage/lcov-report/index.html | grep "strong" | sed -E 's/.*>([0-9.]+)%.*/\1/')
  BRANCHES=$(grep -A 4 "Branches" ./coverage/lcov-report/index.html | grep "strong" | sed -E 's/.*>([0-9.]+)%.*/\1/')
  
  echo "📈 Coverage Summary:"
  echo "  🔹 Lines: $LINES%"
  echo "  🔹 Statements: $STATEMENTS%"
  echo "  🔹 Functions: $FUNCTIONS%"
  echo "  🔹 Branches: $BRANCHES%"
  
  # Compare with threshold
  THRESHOLD=70
  FAILED=0
  
  if (( $(echo "$LINES < $THRESHOLD" | bc -l) )); then
    echo "❌ Lines coverage below threshold: $LINES% < $THRESHOLD%"
    FAILED=1
  fi
  
  if (( $(echo "$STATEMENTS < $THRESHOLD" | bc -l) )); then
    echo "❌ Statements coverage below threshold: $STATEMENTS% < $THRESHOLD%"
    FAILED=1
  fi
  
  if (( $(echo "$FUNCTIONS < $THRESHOLD" | bc -l) )); then
    echo "❌ Functions coverage below threshold: $FUNCTIONS% < $THRESHOLD%"
    FAILED=1
  fi
  
  if (( $(echo "$BRANCHES < $THRESHOLD" | bc -l) )); then
    echo "❌ Branches coverage below threshold: $BRANCHES% < $THRESHOLD%"
    FAILED=1
  fi
  
  if [ $FAILED -eq 0 ]; then
    echo "✅ All coverage thresholds met!"
  else
    echo "⚠️ Some coverage thresholds not met!"
  fi
else
  echo "❌ Coverage report not found!"
fi

echo "✨ Done!"