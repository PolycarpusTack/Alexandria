#!/usr/bin/env node

/**
 * Comprehensive pnpm Conversion Script for Alexandria Platform
 * This script performs a complete migration from npm to pnpm with safety checks
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('');
  log('═'.repeat(50), 'cyan');
  log(`  ${title}`, 'cyan');
  log('═'.repeat(50), 'cyan');
  console.log('');
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n');
}

async function replaceInFile(filePath, replacements) {
  let content = await fs.readFile(filePath, 'utf8');
  let modified = false;
  
  for (const [search, replace] of replacements) {
    if (content.includes(search)) {
      content = content.replace(new RegExp(search, 'g'), replace);
      modified = true;
    }
  }
  
  if (modified) {
    await fs.writeFile(filePath, content);
    return true;
  }
  return false;
}

async function convertNpmToPnpm() {
  try {
    logSection('Alexandria Platform - Full pnpm Conversion');
    
    // Step 1: Check if pnpm is installed
    log('Checking pnpm installation...', 'yellow');
    try {
      execSync('pnpm --version', { stdio: 'pipe' });
      log('✓ pnpm is installed', 'green');
    } catch {
      log('Installing pnpm globally...', 'yellow');
      execSync('npm install -g pnpm', { stdio: 'inherit' });
      log('✓ pnpm installed successfully', 'green');
    }

    // Step 2: Create backup of critical files
    logSection('Creating Backups');
    const backupDir = '.npm-to-pnpm-backup';
    await fs.mkdir(backupDir, { recursive: true });
    
    const filesToBackup = ['package.json', '.npmrc', '.gitignore'];
    for (const file of filesToBackup) {
      if (await fileExists(file)) {
        await fs.copyFile(file, path.join(backupDir, file));
        log(`✓ Backed up ${file}`, 'green');
      }
    }

    // Step 3: Update package.json
    logSection('Updating package.json');
    const packageJson = await readJson('package.json');
    
    // Remove problematic packages
    if (packageJson.devDependencies) {
      delete packageJson.devDependencies['@types/express-rate-limit'];
      delete packageJson.devDependencies['@types/testing-library__jest-dom'];
      log('✓ Removed stub type packages', 'green');
    }
    
    // Update scripts to use pnpm
    if (packageJson.scripts) {
      for (const [key, value] of Object.entries(packageJson.scripts)) {
        if (typeof value === 'string') {
          packageJson.scripts[key] = value
            .replace(/npm run /g, 'pnpm run ')
            .replace(/npm install/g, 'pnpm install')
            .replace(/npm ci/g, 'pnpm install --frozen-lockfile')
            .replace(/npm test/g, 'pnpm test');
        }
      }
      log('✓ Updated package.json scripts', 'green');
    }
    
    await writeJson('package.json', packageJson);

    // Step 4: Create optimized .npmrc for pnpm
    logSection('Creating pnpm Configuration');
    const npmrcContent = `# pnpm configuration for Alexandria Platform
# Optimized for Windows compatibility

# Use hoisted node_modules structure
node-linker=hoisted

# Automatically install peers
auto-install-peers=true

# Use strict peer dependencies
strict-peer-dependencies=false

# Dedupe packages
dedupe-peer-dependents=true

# Allow optional dependencies to fail
optional=true

# Prefer offline installations
prefer-offline=true

# Use symlinks when possible
symlink=true

# Hoist all dependencies
public-hoist-pattern=*

# Hoist workspace packages
hoist-workspace-packages=true

# Set concurrent installations
network-concurrency=16

# Ignore deprecated warnings
loglevel=error

# Use the npm registry
registry=https://registry.npmjs.org/
`;
    await fs.writeFile('.npmrc', npmrcContent);
    log('✓ Created optimized .npmrc', 'green');

    // Step 5: Update all JavaScript files
    logSection('Updating JavaScript Files');
    const jsFiles = [
      'fix-dependencies.js',
      'fix-windows-npm-issues.js',
      'start-dev-simple.js',
      'start-qa.js',
      'scripts/platform-setup.js',
      'scripts/build.js',
      'scripts/test.js',
      'scripts/clean-cache.js',
      'scripts/multiplatform-build.js',
      'scripts/setup-database.js'
    ];

    for (const file of jsFiles) {
      if (await fileExists(file)) {
        const replacements = [
          ['npm install', 'pnpm install'],
          ['npm ci', 'pnpm install --frozen-lockfile'],
          ['npm run', 'pnpm run'],
          ['npm test', 'pnpm test'],
          ['npm --version', 'pnpm --version'],
          ['npm cache clean', 'pnpm store prune'],
          ['npm ls', 'pnpm ls'],
          ['npm update', 'pnpm update'],
          ['npm uninstall', 'pnpm remove'],
          ["'npm'", "'pnpm'"],
          ['"npm"', '"pnpm"']
        ];
        
        if (await replaceInFile(file, replacements)) {
          log(`✓ Updated ${file}`, 'green');
        }
      }
    }

    // Step 6: Update batch files
    logSection('Updating Batch Files');
    const batchFiles = [
      'Alexandria.bat',
      'build-windows.bat',
      'start-dev.bat',
      'start-qa.bat',
      'setup-windows.bat',
      'fix-typescript-errors.bat',
      'fix-esbuild-windows.bat',
      'qa-quick-start.bat',
      'dev-windows.bat',
      'QUICK_FIX.bat',
      'FIX_ALL_WINDOWS_ISSUES.bat'
    ];

    for (const file of batchFiles) {
      if (await fileExists(file)) {
        const replacements = [
          ['npm install', 'pnpm install'],
          ['npm run', 'pnpm run'],
          ['npm test', 'pnpm test'],
          ['call npm', 'call pnpm']
        ];
        
        if (await replaceInFile(file, replacements)) {
          log(`✓ Updated ${file}`, 'green');
        }
      }
    }

    // Step 7: Update PowerShell scripts
    logSection('Updating PowerShell Scripts');
    const psFiles = [
      'fix-windows-npm-issues.ps1',
      'build-windows.ps1',
      'fix-esbuild-windows.ps1',
      'windows-final-fix.ps1',
      'copy-alfred-to-plugin.ps1',
      'scripts/windows-enterprise-fix.ps1'
    ];

    for (const file of psFiles) {
      if (await fileExists(file)) {
        const replacements = [
          ['npm install', 'pnpm install'],
          ['npm run', 'pnpm run'],
          ['npm config', 'pnpm config'],
          ['npm cache', 'pnpm store']
        ];
        
        if (await replaceInFile(file, replacements)) {
          log(`✓ Updated ${file}`, 'green');
        }
      }
    }

    // Step 8: Update shell scripts
    logSection('Updating Shell Scripts');
    const shFiles = [
      'scripts/clean-reinstall.sh',
      'scripts/verify-deps.sh'
    ];

    for (const file of shFiles) {
      if (await fileExists(file)) {
        const replacements = [
          ['npm install', 'pnpm install'],
          ['npm run', 'pnpm run'],
          ['npm test', 'pnpm test']
        ];
        
        if (await replaceInFile(file, replacements)) {
          log(`✓ Updated ${file}`, 'green');
        }
      }
    }

    // Step 9: Create pnpm workspace configuration
    logSection('Creating Workspace Configuration');
    const workspaceYaml = `packages:
  # Plugin packages
  - 'src/plugins/*'
  # Tool packages  
  - 'tools/*'
`;
    await fs.writeFile('pnpm-workspace.yaml', workspaceYaml);
    log('✓ Created pnpm-workspace.yaml', 'green');

    // Step 10: Update .gitignore
    logSection('Updating .gitignore');
    const gitignorePath = '.gitignore';
    if (await fileExists(gitignorePath)) {
      let gitignore = await fs.readFile(gitignorePath, 'utf8');
      
      // Add pnpm-specific entries if not present
      const pnpmEntries = [
        '.pnpm-store/',
        'pnpm-debug.log*'
      ];
      
      for (const entry of pnpmEntries) {
        if (!gitignore.includes(entry)) {
          gitignore = gitignore.replace('node_modules/', `node_modules/\n${entry}`);
        }
      }
      
      await fs.writeFile(gitignorePath, gitignore);
      log('✓ Updated .gitignore', 'green');
    }

    // Step 11: Clean npm artifacts
    logSection('Cleaning npm Artifacts');
    
    if (await fileExists('node_modules')) {
      log('Removing node_modules...', 'yellow');
      await fs.rm('node_modules', { recursive: true, force: true });
      log('✓ Removed node_modules', 'green');
    }
    
    if (await fileExists('package-lock.json')) {
      await fs.unlink('package-lock.json');
      log('✓ Removed package-lock.json', 'green');
    }

    // Step 12: Install dependencies with pnpm
    logSection('Installing Dependencies with pnpm');
    log('This may take a few minutes...', 'yellow');
    
    try {
      execSync('pnpm install', { stdio: 'inherit' });
      log('✓ Dependencies installed successfully!', 'green');
    } catch (error) {
      log('✗ Installation failed. Trying with --no-optional flag...', 'red');
      execSync('pnpm install --no-optional', { stdio: 'inherit' });
      log('✓ Dependencies installed with --no-optional', 'green');
    }

    // Step 13: Create helper scripts
    logSection('Creating Helper Scripts');
    
    // Create pnpm-dev.bat
    const pnpmDevBat = `@echo off
echo Starting Alexandria with pnpm...
pnpm run dev
`;
    await fs.writeFile('pnpm-dev.bat', pnpmDevBat);
    log('✓ Created pnpm-dev.bat', 'green');

    // Create pnpm-commands.md
    const commandsGuide = `# pnpm Quick Reference for Alexandria

## Common Commands

\`\`\`bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test

# Add a dependency
pnpm add package-name

# Add a dev dependency
pnpm add -D package-name

# Remove a dependency
pnpm remove package-name

# Update dependencies
pnpm update

# Clean install (like npm ci)
pnpm install --frozen-lockfile

# Clear pnpm cache
pnpm store prune
\`\`\`
`;
    await fs.writeFile('pnpm-commands.md', commandsGuide);
    log('✓ Created pnpm-commands.md', 'green');

    // Final summary
    logSection('Conversion Complete!');
    log('✓ Successfully converted Alexandria to use pnpm', 'green');
    log('✓ All scripts and configurations have been updated', 'green');
    log('✓ Dependencies installed with pnpm', 'green');
    console.log('');
    log('You can now use:', 'cyan');
    log('  pnpm dev       - Start development server', 'white');
    log('  pnpm build     - Build for production', 'white');
    log('  pnpm test      - Run tests', 'white');
    console.log('');
    log('Backup files saved in: .npm-to-pnpm-backup/', 'yellow');
    
  } catch (error) {
    log(`✗ Error during conversion: ${error.message}`, 'red');
    log('Check .npm-to-pnpm-backup/ for backup files', 'yellow');
    process.exit(1);
  }
}

// Run the conversion
convertNpmToPnpm();