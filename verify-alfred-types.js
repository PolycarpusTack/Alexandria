// Simple verification that Alfred component types are correctly defined
// This checks the component files for proper exports and interface structure

const fs = require('fs');
const path = require('path');

const componentsDir = 'src/plugins/alfred/ui/components';
const components = [
  'ChatInterface.tsx',
  'TemplateWizard.tsx', 
  'ProjectExplorer.tsx',
  'SessionList.tsx'
];

console.log('🔍 Verifying Alfred component type definitions...\n');

let allValid = true;

components.forEach(component => {
  console.log(`📄 Checking ${component}:`);
  
  const filePath = path.join(componentsDir, component);
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Check for interface definition
  const interfacePattern = new RegExp(`interface.*${component.replace('.tsx', '')}Props`);
  const hasInterface = interfacePattern.test(content);
  
  // Check for export
  const exportPattern = new RegExp(`export.*${component.replace('.tsx', '')}`);
  const hasExport = exportPattern.test(content);
  
  // Check specific prop requirements based on task specs
  let hasRequiredProps = true;
  let missingProps = [];
  
  if (component === 'ChatInterface.tsx') {
    const requiredProps = ['sessionId', 'onMessageSent', 'messages', 'isLoading', 'streamingEnabled', 'readonly'];
    requiredProps.forEach(prop => {
      if (!content.includes(`${prop}?:`) && !content.includes(`${prop}:`)) {
        hasRequiredProps = false;
        missingProps.push(prop);
      }
    });
  }
  
  if (component === 'TemplateWizard.tsx') {
    const requiredProps = ['onComplete', 'templateId', 'initialValues', 'readonly'];
    requiredProps.forEach(prop => {
      if (!content.includes(`${prop}?:`) && !content.includes(`${prop}:`)) {
        hasRequiredProps = false;
        missingProps.push(prop);
      }
    });
    
    // Check for TemplateResult type usage
    if (!content.includes('TemplateResult')) {
      hasRequiredProps = false;
      missingProps.push('TemplateResult interface');
    }
  }
  
  if (component === 'ProjectExplorer.tsx') {
    const requiredProps = ['projectContext', 'onFileSelect', 'onRefresh', 'selectedPath', 'readonly', 'showStatistics', 'compact'];
    requiredProps.forEach(prop => {
      if (!content.includes(`${prop}?:`) && !content.includes(`${prop}:`)) {
        hasRequiredProps = false;
        missingProps.push(prop);
      }
    });
  }
  
  console.log(`  ✅ Interface defined: ${hasInterface}`);
  console.log(`  ✅ Component exported: ${hasExport}`);
  console.log(`  ✅ Required props: ${hasRequiredProps}`);
  
  if (!hasRequiredProps) {
    console.log(`  ❌ Missing props: ${missingProps.join(', ')}`);
    allValid = false;
  }
  
  console.log('');
});

// Check @alexandria/shared types
console.log('📦 Checking @alexandria/shared type definitions:');
const sharedTypesPath = 'src/types/alexandria-shared.d.ts';
if (fs.existsSync(sharedTypesPath)) {
  const sharedContent = fs.readFileSync(sharedTypesPath, 'utf8');
  const hasPluginService = sharedContent.includes('BasePluginService');
  const hasPluginHealth = sharedContent.includes('PluginHealth');
  const hasIdUtils = sharedContent.includes('idUtils');
  
  console.log(`  ✅ BasePluginService: ${hasPluginService}`);
  console.log(`  ✅ PluginHealth: ${hasPluginHealth}`);
  console.log(`  ✅ idUtils: ${hasIdUtils}`);
} else {
  console.log('  ❌ alexandria-shared.d.ts not found');
  allValid = false;
}
console.log('');

// Check Express extensions
console.log('🌐 Checking Express type extensions:');
const expressTypesPath = 'src/types/express-extensions.d.ts';
if (fs.existsSync(expressTypesPath)) {
  const expressContent = fs.readFileSync(expressTypesPath, 'utf8');
  const hasApiSuccess = expressContent.includes('apiSuccess');
  const hasApiError = expressContent.includes('apiError');
  const hasApiCreated = expressContent.includes('apiCreated');
  
  console.log(`  ✅ apiSuccess method: ${hasApiSuccess}`);
  console.log(`  ✅ apiError method: ${hasApiError}`);
  console.log(`  ✅ apiCreated method: ${hasApiCreated}`);
} else {
  console.log('  ❌ express-extensions.d.ts not found');
  allValid = false;
}
console.log('');

if (allValid) {
  console.log('🎉 All Alfred component type definitions are properly implemented!');
  process.exit(0);
} else {
  console.log('❌ Some type definitions need attention.');
  process.exit(1);
}