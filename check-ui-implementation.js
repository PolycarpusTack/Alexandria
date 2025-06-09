#!/usr/bin/env node

/**
 * Quick fix script to ensure all UI components are properly connected
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Checking Alexandria UI implementation...\n');

// Check if enhanced layout is being used
const layoutSelectorPath = path.join(__dirname, 'src/client/components/layout-selector.tsx');
if (fs.existsSync(layoutSelectorPath)) {
  const content = fs.readFileSync(layoutSelectorPath, 'utf8');
  if (content.includes('enhanced')) {
    console.log('✅ Enhanced layout is available in layout selector');
  }
} else {
  console.log('❌ Layout selector not found');
}

// Check if theme provider exists
const themeProviderPath = path.join(__dirname, 'src/client/components/theme-provider.tsx');
if (fs.existsSync(themeProviderPath)) {
  console.log('✅ Theme provider exists');
} else {
  console.log('❌ Theme provider not found');
}

// Check routing
const appPath = path.join(__dirname, 'src/client/App.tsx');
if (fs.existsSync(appPath)) {
  const appContent = fs.readFileSync(appPath, 'utf8');
  if (appContent.includes('DynamicLayout')) {
    console.log('✅ Dynamic layout is integrated in App.tsx');
  }
  if (appContent.includes('Login')) {
    console.log('✅ Login page is routed');
  }
}

// Check for required dependencies in package.json
const packagePath = path.join(__dirname, 'package.json');
if (fs.existsSync(packagePath)) {
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const requiredDeps = ['react-router-dom', 'lucide-react', '@radix-ui/react-scroll-area'];
  
  console.log('\n📦 Checking dependencies:');
  requiredDeps.forEach(dep => {
    if (packageJson.dependencies[dep] || packageJson.devDependencies[dep]) {
      console.log(`✅ ${dep} is installed`);
    } else {
      console.log(`❌ ${dep} is missing - run: npm install ${dep}`);
    }
  });
}

console.log('\n🚀 Setup Instructions:');
console.log('1. Run the application: npm run dev');
console.log('2. Open browser console and run:');
console.log("   localStorage.setItem('alexandria-layout-mode', 'enhanced');");
console.log("   localStorage.setItem('alexandria-theme', 'dark');");
console.log("   location.reload();");
console.log('3. Login with username: demo, password: demo');
console.log('\n✨ Enjoy the new Alexandria UI!');
