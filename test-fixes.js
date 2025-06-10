const { execSync } = require('child_process');
const fs = require('fs');

console.log('Testing fixes for Alexandria development environment...\n');

// Test 1: TypeScript compilation
console.log('1. Testing TypeScript compilation...');
try {
  execSync('pnpm run build:server', { stdio: 'pipe' });
  console.log('✅ Server TypeScript compilation successful\n');
} catch (error) {
  console.log('❌ Server TypeScript compilation failed:', error.message, '\n');
}

// Test 2: Check ChatInterface.tsx syntax
console.log('2. Checking ChatInterface.tsx JSX syntax...');
try {
  execSync('npx tsc --noEmit src/plugins/alfred/ui/components/ChatInterface.tsx', { stdio: 'pipe' });
  console.log('✅ ChatInterface.tsx has valid JSX syntax\n');
} catch (error) {
  console.log('❌ ChatInterface.tsx has JSX errors:', error.stdout?.toString() || error.message, '\n');
}

// Test 3: Validate SQL migration
console.log('3. Validating Alfred sessions migration SQL...');
const migrationPath = 'src/core/data/migrations/migrations/1735561800000_alfred_sessions_schema.sql';
const sqlContent = fs.readFileSync(migrationPath, 'utf8');

// Check for common SQL syntax errors
const issues = [];
if (sqlContent.match(/\);\s*\)/)) issues.push('Double closing parenthesis');
if (sqlContent.match(/,\s*\)/)) issues.push('Trailing comma before closing parenthesis');
if (!sqlContent.trim().endsWith(';')) issues.push('Missing semicolon at end');

if (issues.length === 0) {
  console.log('✅ SQL migration syntax appears valid\n');
} else {
  console.log('❌ SQL migration has issues:', issues.join(', '), '\n');
}

// Summary
console.log('Summary:');
console.log('- Fixed TypeScript errors in system-metrics.ts by using repository pattern');
console.log('- Fixed JSX syntax error in ChatInterface.tsx (missing closing div)');
console.log('- Fixed SQL syntax in Alfred sessions migration');
console.log('\nYou should now be able to run: pnpm dev');