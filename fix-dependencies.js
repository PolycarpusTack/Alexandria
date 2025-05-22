/**
 * Script to fix missing dependencies for the Alexandria Platform
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Define the dependencies to add
const missingDependencies = {
  dependencies: {
    '@radix-ui/react-tooltip': '^1.0.7',
    '@radix-ui/react-dropdown-menu': '^2.0.5',
    '@radix-ui/react-dialog': '^1.0.4',
    '@radix-ui/react-slot': '^1.0.2',
    'styled-components': '^6.1.18'
  },
  devDependencies: {
    '@types/styled-components': '^5.1.34'
  }
};

// Read the current package.json
const packageJsonPath = path.join(__dirname, 'package.json');
const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
const packageJson = JSON.parse(packageJsonContent);

// Update dependencies
let hasChanges = false;
Object.entries(missingDependencies).forEach(([dependencyType, dependencies]) => {
  Object.entries(dependencies).forEach(([packageName, version]) => {
    if (!packageJson[dependencyType][packageName]) {
      console.log(`Adding ${packageName}@${version} to ${dependencyType}`);
      packageJson[dependencyType][packageName] = version;
      hasChanges = true;
    }
  });
});

// Write the updated package.json
if (hasChanges) {
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('Updated package.json with missing dependencies');

  // Install the dependencies
  console.log('Installing missing dependencies...');
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('Successfully installed missing dependencies');
  } catch (error) {
    console.error('Error installing dependencies:', error.message);
  }
} else {
  console.log('No missing dependencies found');
}