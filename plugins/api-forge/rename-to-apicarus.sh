#!/bin/bash

# Rename all references from api-forge to apicarus
find . -type f \( -name "*.js" -o -name "*.json" -o -name "*.md" \) -exec sed -i 's/api-forge/apicarus/g' {} +
find . -type f \( -name "*.js" -o -name "*.json" -o -name "*.md" \) -exec sed -i 's/API Forge/Apicarus/g' {} +
find . -type f \( -name "*.js" -o -name "*.json" -o -name "*.md" \) -exec sed -i 's/apiForge/apicarus/g' {} +
find . -type f \( -name "*.js" -o -name "*.json" -o -name "*.md" \) -exec sed -i 's/APIForge/Apicarus/g' {} +

# Rename files
mv API_FORGE_REVIEW.md APICARUS_REVIEW.md 2>/dev/null || true
for file in docs/api-forge-*.md; do
    if [ -f "$file" ]; then
        newname=$(echo "$file" | sed 's/api-forge/apicarus/g')
        mv "$file" "$newname"
    fi
done

echo "Rename completed!"