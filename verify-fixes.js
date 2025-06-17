/**
 * Alexandria Platform - Root Issue Verification
 * Checks if all core issues have been resolved
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('\n🔍 Alexandria Platform - Verifying Root Fixes\n');

let issues = [];
let fixed = [];

// Check 1: Node modules accessibility
console.log('Checking node_modules accessibility...');
try {
    const nodeModulesPath = path.join(__dirname, 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
        fs.readdirSync(nodeModulesPath);
        fixed.push('✅ node_modules is accessible');
    } else {
        issues.push('❌ node_modules directory not found');
    }
} catch (error) {
    issues.push('❌ node_modules permission issues: ' + error.message);
}

// Check 2: Required dependencies
console.log('Checking required dependencies...');
const requiredDeps = ['express', 'cors', 'helmet', 'typescript', '@types/express', '@types/node'];
requiredDeps.forEach(dep => {
    const depPath = path.join(__dirname, 'node_modules', dep);
    if (fs.existsSync(depPath)) {
        fixed.push(`✅ ${dep} is installed`);
    } else {
        issues.push(`❌ Missing dependency: ${dep}`);
    }
});

// Check 3: TypeScript configuration
console.log('Checking TypeScript configuration...');
try {
    const tsconfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8'));
    if (tsconfig.compilerOptions.moduleResolution === 'node') {
        fixed.push('✅ TypeScript moduleResolution is set to "node"');
    } else {
        issues.push('❌ TypeScript moduleResolution not set to "node"');
    }
} catch (error) {
    issues.push('❌ Cannot read tsconfig.json: ' + error.message);
}

// Check 4: Core module exports
console.log('Checking core module exports...');
const coreFiles = [
    'src/utils/logger.ts',
    'src/core/index.ts',
    'src/api/versioning.ts',
    'src/api/v1/index.ts',
    'src/api/swagger.ts'
];

coreFiles.forEach(file => {
    if (fs.existsSync(file)) {
        fixed.push(`✅ ${file} exists`);
    } else {
        issues.push(`❌ Missing file: ${file}`);
    }
});

// Check 5: TypeScript compilation
console.log('Checking TypeScript compilation...');
try {
    execSync('npx tsc --noEmit', { stdio: 'pipe' });
    fixed.push('✅ TypeScript compilation successful');
} catch (error) {
    const output = error.stdout?.toString() || error.message;
    const errorCount = (output.match(/error TS/g) || []).length;
    if (errorCount > 0) {
        issues.push(`❌ TypeScript compilation has ${errorCount} errors`);
    }
}

// Check 6: Express type conflicts
console.log('Checking for type conflicts...');
const conflictingFiles = [
    'src/types/express.d.ts',
    'src/types/express-custom.d.ts',
    'src/types/express-enhanced.d.ts'
];

let hasConflicts = false;
conflictingFiles.forEach(file => {
    if (fs.existsSync(file)) {
        issues.push(`❌ Conflicting type file still exists: ${file}`);
        hasConflicts = true;
    }
});

if (!hasConflicts) {
    fixed.push('✅ No conflicting Express type files');
}

// Check 7: Windows-specific Rollup bindings
console.log('Checking Rollup bindings...');
const rollupPath = path.join(__dirname, 'node_modules', '@rollup', 'rollup-win32-x64-msvc');
if (fs.existsSync(rollupPath)) {
    fixed.push('✅ Windows Rollup bindings installed');
} else {
    issues.push('❌ Missing @rollup/rollup-win32-x64-msvc');
}

// Check 8: Package.json workspace references
console.log('Checking package.json...');
try {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    let hasWorkspaceRefs = false;
    
    if (pkg.dependencies) {
        Object.values(pkg.dependencies).forEach(value => {
            if (value === 'workspace:*') {
                hasWorkspaceRefs = true;
            }
        });
    }
    
    if (hasWorkspaceRefs) {
        issues.push('❌ package.json still contains workspace:* references');
    } else {
        fixed.push('✅ package.json has no workspace references');
    }
} catch (error) {
    issues.push('❌ Cannot read package.json: ' + error.message);
}

// Summary
console.log('\n' + '='.repeat(80));
console.log('VERIFICATION SUMMARY');
console.log('='.repeat(80) + '\n');

if (fixed.length > 0) {
    console.log('FIXED ISSUES (' + fixed.length + '):\n');
    fixed.forEach(item => console.log('  ' + item));
}

if (issues.length > 0) {
    console.log('\nREMAINING ISSUES (' + issues.length + '):\n');
    issues.forEach(item => console.log('  ' + item));
    
    console.log('\n' + '='.repeat(80));
    console.log('RECOMMENDED ACTIONS:');
    console.log('='.repeat(80) + '\n');
    
    if (issues.some(i => i.includes('node_modules'))) {
        console.log('1. Run FIX_EVERYTHING.bat as Administrator');
    }
    
    if (issues.some(i => i.includes('Missing dependency'))) {
        console.log('2. Run: npm install --force --legacy-peer-deps');
    }
    
    if (issues.some(i => i.includes('TypeScript compilation'))) {
        console.log('3. Run: npx tsc --noEmit to see specific errors');
    }
    
    if (issues.some(i => i.includes('workspace:*'))) {
        console.log('4. Run the PowerShell fix script to clean package.json');
    }
} else {
    console.log('\n🎉 ALL ROOT ISSUES HAVE BEEN FIXED! 🎉\n');
    console.log('You can now run: npm run dev');
}

console.log('\n' + '='.repeat(80) + '\n');

// Return exit code based on issues
process.exit(issues.length > 0 ? 1 : 0);
