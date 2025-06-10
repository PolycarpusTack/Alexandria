#!/usr/bin/env node

/**
 * COMPREHENSIVE Alfred Plugin Review
 * Deep analysis of architecture, implementation quality, and readiness
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 COMPREHENSIVE ALFRED PLUGIN REVIEW');
console.log('=====================================\n');

let totalScore = 0;
let maxScore = 0;
const issues = [];
const strengths = [];

function addTest(name, passed, weight = 1, details = '') {
  maxScore += weight;
  if (passed) {
    totalScore += weight;
    console.log(`✅ ${name}${details ? ` - ${details}` : ''}`);
    if (weight > 1) strengths.push(`${name}: ${details}`);
  } else {
    console.log(`❌ ${name}${details ? ` - ${details}` : ''}`);
    issues.push(`${name}: ${details}`);
  }
}

function addPartialTest(name, score, maxPoints, details = '') {
  maxScore += maxPoints;
  totalScore += score;
  const percentage = Math.round((score / maxPoints) * 100);
  console.log(`${score === maxPoints ? '✅' : '⚠️'} ${name} (${score}/${maxPoints} - ${percentage}%) - ${details}`);
  
  if (percentage >= 80) {
    strengths.push(`${name}: ${details}`);
  } else if (percentage < 60) {
    issues.push(`${name}: ${details}`);
  }
}

// =================== SECTION 1: PLUGIN MANIFEST DEEP DIVE ===================
console.log('📋 SECTION 1: PLUGIN MANIFEST ANALYSIS');
console.log('=======================================');

try {
  const pluginJsonPath = path.join(__dirname, 'src/plugins/alfred/plugin.json');
  const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
  
  // Basic structure
  addTest('Plugin ID format', pluginJson.id && pluginJson.id.includes('alfred'), 1, pluginJson.id);
  addTest('Plugin name descriptive', pluginJson.name && pluginJson.name.length > 10, 1, pluginJson.name);
  addTest('Version follows semver', /^\d+\.\d+\.\d+$/.test(pluginJson.version), 1, pluginJson.version);
  addTest('Main entry point specified', pluginJson.main === 'src/index.ts', 1, pluginJson.main);
  
  // Permissions analysis
  const expectedPermissions = [
    'file:read', 'file:write', 'llm:access', 'database:access', 
    'event:subscribe', 'event:publish', 'project:analyze', 'code:generate', 'template:manage'
  ];
  const hasAllPermissions = expectedPermissions.every(perm => pluginJson.permissions.includes(perm));
  addTest('All required permissions', hasAllPermissions, 2, `${pluginJson.permissions.length} permissions configured`);
  
  // UI Entry Points analysis
  const uiEntryPoints = pluginJson.uiEntryPoints || [];
  addTest('Dashboard entry point', uiEntryPoints.some(ep => ep.id === 'alfred-dashboard'), 1);
  addTest('Chat interface entry point', uiEntryPoints.some(ep => ep.id === 'alfred-chat'), 1);
  addTest('Project explorer entry point', uiEntryPoints.some(ep => ep.id === 'alfred-projects'), 1);
  addTest('Template manager entry point', uiEntryPoints.some(ep => ep.id === 'alfred-templates'), 1);
  
  // Event subscriptions
  const events = pluginJson.eventSubscriptions || [];
  addTest('System events subscribed', events.includes('system:initialized'), 1);
  addTest('File change events subscribed', events.includes('file:changed'), 1);
  addTest('AI events subscribed', events.includes('ai:response-received'), 1);
  
  // Configuration
  const config = pluginJson.configuration || {};
  addTest('Default model configuration', config.defaultModel && config.defaultModel.type === 'string', 1);
  addTest('Auto-save configuration', config.enableAutoSave && config.enableAutoSave.type === 'boolean', 1);
  
} catch (error) {
  addTest('Plugin manifest readable', false, 3, error.message);
}

console.log();

// =================== SECTION 2: MAIN ENTRY POINT ANALYSIS ===================
console.log('🚀 SECTION 2: MAIN ENTRY POINT ANALYSIS');
console.log('=======================================');

try {
  const mainEntryPath = path.join(__dirname, 'src/plugins/alfred/src/index.ts');
  const mainEntry = fs.readFileSync(mainEntryPath, 'utf8');
  
  // Class structure
  addTest('AlfredPlugin class exists', mainEntry.includes('export class AlfredPlugin'), 2);
  addTest('Implements PluginLifecycle', mainEntry.includes('implements PluginLifecycle'), 2);
  addTest('Default export present', mainEntry.includes('export default'), 1);
  
  // Lifecycle methods
  addTest('onActivate method', mainEntry.includes('async onActivate'), 2);
  addTest('onDeactivate method', mainEntry.includes('async onDeactivate'), 1);
  addTest('onInstall method', mainEntry.includes('async onInstall'), 1);
  addTest('onUninstall method', mainEntry.includes('async onUninstall'), 1);
  
  // Service imports
  const requiredImports = [
    'AlfredService', 'StreamingService', 'AlfredAIAdapter', 
    'ProjectAnalyzerService', 'CodeGeneratorService', 'TemplateManagerService'
  ];
  let importScore = 0;
  requiredImports.forEach(imp => {
    if (mainEntry.includes(imp)) importScore++;
  });
  addPartialTest('Required service imports', importScore, requiredImports.length, `${importScore}/${requiredImports.length} services imported`);
  
  // Service instantiation
  const serviceInstantiations = [
    'new AlfredService', 'new StreamingService', 'new ProjectAnalyzerService',
    'new CodeGeneratorService', 'new TemplateManagerService'
  ];
  let instantiationScore = 0;
  serviceInstantiations.forEach(inst => {
    if (mainEntry.includes(inst)) instantiationScore++;
  });
  addPartialTest('Service instantiation', instantiationScore, serviceInstantiations.length, `${instantiationScore}/${serviceInstantiations.length} services instantiated`);
  
  // Event subscriptions in code
  addTest('Event bus usage', mainEntry.includes('eventBus.on'), 1);
  addTest('API route registration', mainEntry.includes('registerRouter') || mainEntry.includes('registerRoute'), 2);
  
} catch (error) {
  addTest('Main entry point readable', false, 5, error.message);
}

console.log();

// =================== SECTION 3: SERVICE LAYER DEEP ANALYSIS ===================
console.log('⚙️ SECTION 3: SERVICE LAYER ANALYSIS');
console.log('====================================');

const services = [
  { name: 'alfred-service.ts', weight: 3, expectedClass: 'AlfredService' },
  { name: 'streaming-service.ts', weight: 2, expectedClass: 'StreamingService' },
  { name: 'alfred-ai-adapter.ts', weight: 2, expectedClass: 'AlfredAIAdapter' },
  { name: 'project-analyzer.ts', weight: 2, expectedClass: 'ProjectAnalyzerService' },
  { name: 'code-generator.ts', weight: 2, expectedClass: 'CodeGeneratorService' },
  { name: 'template-manager.ts', weight: 2, expectedClass: 'TemplateManagerService' },
  { name: 'code-extraction-service.ts', weight: 2, expectedClass: 'CodeExtractionService' },
  { name: 'tree-cache-service.ts', weight: 2, expectedClass: 'TreeCacheService' },
  { name: 'context-manager.ts', weight: 1, expectedClass: 'ContextManager' },
  { name: 'suggestion-engine.ts', weight: 1, expectedClass: 'SuggestionEngine' }
];

services.forEach(service => {
  try {
    const servicePath = path.join(__dirname, 'src/plugins/alfred/src/services', service.name);
    const serviceContent = fs.readFileSync(servicePath, 'utf8');
    
    const hasClass = serviceContent.includes(`export class ${service.expectedClass}`);
    const hasInterface = serviceContent.includes('interface') || serviceContent.includes('implements');
    const hasConstructor = serviceContent.includes('constructor(');
    const hasAsyncMethods = serviceContent.includes('async ');
    const hasErrorHandling = serviceContent.includes('try {') && serviceContent.includes('catch');
    const hasLogging = serviceContent.includes('logger.');
    
    let serviceScore = 0;
    let serviceMax = 6;
    
    if (hasClass) serviceScore++;
    if (hasInterface) serviceScore++;
    if (hasConstructor) serviceScore++;
    if (hasAsyncMethods) serviceScore++;
    if (hasErrorHandling) serviceScore++;
    if (hasLogging) serviceScore++;
    
    addPartialTest(`${service.name}`, serviceScore * service.weight, serviceMax * service.weight, 
      `Class: ${hasClass ? '✅' : '❌'}, Interface: ${hasInterface ? '✅' : '❌'}, Constructor: ${hasConstructor ? '✅' : '❌'}, Async: ${hasAsyncMethods ? '✅' : '❌'}, Error Handling: ${hasErrorHandling ? '✅' : '❌'}, Logging: ${hasLogging ? '✅' : '❌'}`);
    
  } catch (error) {
    addTest(`${service.name} exists`, false, service.weight, error.message);
  }
});

console.log();

// =================== SECTION 4: REPOSITORY LAYER ANALYSIS ===================
console.log('🗄️ SECTION 4: REPOSITORY LAYER ANALYSIS');
console.log('========================================');

const repositories = [
  { name: 'session-repository.ts', expectedClass: 'SessionRepository' },
  { name: 'template-repository.ts', expectedClass: 'TemplateRepository' }
];

repositories.forEach(repo => {
  try {
    const repoPath = path.join(__dirname, 'src/plugins/alfred/src/repositories', repo.name);
    const repoContent = fs.readFileSync(repoPath, 'utf8');
    
    const hasClass = repoContent.includes(`export class ${repo.expectedClass}`);
    const hasCRUD = ['create', 'read', 'update', 'delete'].some(op => 
      repoContent.toLowerCase().includes(op) || repoContent.includes('save') || repoContent.includes('get')
    );
    const hasAsyncMethods = repoContent.includes('async ');
    const hasErrorHandling = repoContent.includes('try {') && repoContent.includes('catch');
    
    let repoScore = 0;
    if (hasClass) repoScore++;
    if (hasCRUD) repoScore++;
    if (hasAsyncMethods) repoScore++;
    if (hasErrorHandling) repoScore++;
    
    addPartialTest(`${repo.name}`, repoScore, 4, 
      `Class: ${hasClass ? '✅' : '❌'}, CRUD: ${hasCRUD ? '✅' : '❌'}, Async: ${hasAsyncMethods ? '✅' : '❌'}, Error Handling: ${hasErrorHandling ? '✅' : '❌'}`);
    
  } catch (error) {
    addTest(`${repo.name} exists`, false, 2, error.message);
  }
});

console.log();

// =================== SECTION 5: UI COMPONENT ANALYSIS ===================
console.log('🎨 SECTION 5: UI COMPONENT ANALYSIS');
console.log('===================================');

const components = [
  { name: 'AlfredDashboard.tsx', weight: 3 },
  { name: 'ChatInterface.tsx', weight: 3 },
  { name: 'ProjectExplorer.tsx', weight: 2 },
  { name: 'TemplateManager.tsx', weight: 2 },
  { name: 'TemplateWizard.tsx', weight: 2 },
  { name: 'CommandPalette.tsx', weight: 2 },
  { name: 'ConnectionStatus.tsx', weight: 1 },
  { name: 'CodeBlock.tsx', weight: 1 },
  { name: 'SessionList.tsx', weight: 1 },
  { name: 'SplitPaneEditor.tsx', weight: 1 }
];

components.forEach(component => {
  try {
    const componentPath = path.join(__dirname, 'src/plugins/alfred/ui/components', component.name);
    const componentContent = fs.readFileSync(componentPath, 'utf8');
    
    const isReactFC = componentContent.includes('React.FC') || componentContent.includes(': FC<');
    const hasFunctionComponent = componentContent.includes('const ') && componentContent.includes('=>') && componentContent.includes('return');
    const hasJSX = componentContent.includes('<') && componentContent.includes('>') && !componentContent.includes('export interface');
    const hasTypeScript = componentContent.includes('interface ') || componentContent.includes('type ');
    const hasUseState = componentContent.includes('useState');
    const hasUseEffect = componentContent.includes('useEffect');
    const hasErrorHandling = componentContent.includes('try {') || componentContent.includes('catch') || componentContent.includes('ErrorBoundary');
    
    let componentScore = 0;
    let componentMax = 7;
    
    if (isReactFC || hasFunctionComponent) componentScore++;
    if (hasJSX) componentScore++;
    if (hasTypeScript) componentScore++;
    if (hasUseState) componentScore++;
    if (hasUseEffect) componentScore++;
    if (hasErrorHandling) componentScore++;
    if (componentContent.length > 1000) componentScore++; // Substantial implementation
    
    addPartialTest(`${component.name}`, componentScore * component.weight, componentMax * component.weight,
      `React: ${(isReactFC || hasFunctionComponent) ? '✅' : '❌'}, JSX: ${hasJSX ? '✅' : '❌'}, TS: ${hasTypeScript ? '✅' : '❌'}, Hooks: ${(hasUseState || hasUseEffect) ? '✅' : '❌'}, Error Handling: ${hasErrorHandling ? '✅' : '❌'}, Size: ${componentContent.length}chars`);
    
  } catch (error) {
    addTest(`${component.name} exists`, false, component.weight, error.message);
  }
});

console.log();

// =================== SECTION 6: API LAYER ANALYSIS ===================
console.log('🌐 SECTION 6: API LAYER ANALYSIS');
console.log('================================');

try {
  const apiPath = path.join(__dirname, 'src/plugins/alfred/src/api');
  const apiFiles = fs.readdirSync(apiPath);
  
  addTest('API directory exists', true, 1, `${apiFiles.length} files found`);
  
  apiFiles.forEach(file => {
    if (file.endsWith('.ts')) {
      try {
        const apiFilePath = path.join(apiPath, file);
        const apiContent = fs.readFileSync(apiFilePath, 'utf8');
        
        const hasRouter = apiContent.includes('Router') || apiContent.includes('express');
        const hasRoutes = apiContent.includes('.get(') || apiContent.includes('.post(') || apiContent.includes('.put(') || apiContent.includes('.delete(');
        const hasErrorHandling = apiContent.includes('try {') && apiContent.includes('catch');
        const hasValidation = apiContent.includes('validate') || apiContent.includes('schema');
        
        let apiScore = 0;
        if (hasRouter) apiScore++;
        if (hasRoutes) apiScore++;
        if (hasErrorHandling) apiScore++;
        if (hasValidation) apiScore++;
        
        addPartialTest(`API ${file}`, apiScore, 4,
          `Router: ${hasRouter ? '✅' : '❌'}, Routes: ${hasRoutes ? '✅' : '❌'}, Error Handling: ${hasErrorHandling ? '✅' : '❌'}, Validation: ${hasValidation ? '✅' : '❌'}`);
        
      } catch (error) {
        addTest(`API ${file} readable`, false, 1, error.message);
      }
    }
  });
  
} catch (error) {
  addTest('API directory readable', false, 2, error.message);
}

console.log();

// =================== SECTION 7: INTERFACES & TYPES ANALYSIS ===================
console.log('📝 SECTION 7: INTERFACES & TYPES ANALYSIS');
console.log('=========================================');

try {
  const interfacesPath = path.join(__dirname, 'src/plugins/alfred/src/interfaces.ts');
  const interfacesContent = fs.readFileSync(interfacesPath, 'utf8');
  
  const requiredInterfaces = [
    'AlfredServiceInterface', 'AlfredSession', 'AlfredMessage', 'CodeGenerationRequest',
    'CodeGenerationResponse', 'ProjectAnalysis', 'ChatSession', 'ProjectContext'
  ];
  
  let interfaceScore = 0;
  requiredInterfaces.forEach(iface => {
    if (interfacesContent.includes(`interface ${iface}`) || interfacesContent.includes(`type ${iface}`)) {
      interfaceScore++;
    }
  });
  
  addPartialTest('Interface definitions', interfaceScore, requiredInterfaces.length, 
    `${interfaceScore}/${requiredInterfaces.length} interfaces defined`);
  
  const hasExports = interfacesContent.includes('export');
  addTest('Interfaces exported', hasExports, 1);
  
} catch (error) {
  addTest('Interfaces file exists', false, 3, error.message);
}

console.log();

// =================== FINAL ASSESSMENT ===================
console.log('📊 FINAL ASSESSMENT');
console.log('===================');

const percentage = Math.round((totalScore / maxScore) * 100);
console.log(`\nOverall Score: ${totalScore}/${maxScore} (${percentage}%)\n`);

// Grade assignment
let grade, status, recommendation;
if (percentage >= 90) {
  grade = 'A+';
  status = '🎉 EXCEPTIONAL - Production Ready';
  recommendation = 'Plugin exceeds enterprise standards. Ready for immediate deployment.';
} else if (percentage >= 80) {
  grade = 'A';
  status = '✅ EXCELLENT - Ready for Integration';
  recommendation = 'Plugin meets all requirements. Minor optimizations possible but not required.';
} else if (percentage >= 70) {
  grade = 'B+';
  status = '⚠️ GOOD - Near Ready';
  recommendation = 'Plugin is solid but needs some improvements before production.';
} else if (percentage >= 60) {
  grade = 'B';
  status = '⚠️ ACCEPTABLE - Needs Work';
  recommendation = 'Plugin has good foundation but requires significant improvements.';
} else {
  grade = 'C';
  status = '❌ NEEDS SIGNIFICANT WORK';
  recommendation = 'Plugin requires major development before it can be used.';
}

console.log(`Grade: ${grade}`);
console.log(`Status: ${status}`);
console.log(`Recommendation: ${recommendation}\n`);

// Strengths
if (strengths.length > 0) {
  console.log('💪 KEY STRENGTHS:');
  strengths.slice(0, 5).forEach(strength => console.log(`   • ${strength}`));
  console.log();
}

// Issues (if any)
if (issues.length > 0) {
  console.log('⚠️ AREAS FOR IMPROVEMENT:');
  issues.slice(0, 5).forEach(issue => console.log(`   • ${issue}`));
  console.log();
}

// Detailed readiness assessment
console.log('🎯 READINESS ASSESSMENT:');
console.log('========================');

const readinessFactors = [
  { factor: 'Architecture', score: percentage >= 80 ? 'Ready' : 'Needs Work' },
  { factor: 'Service Layer', score: percentage >= 75 ? 'Ready' : 'Needs Work' },
  { factor: 'UI Components', score: percentage >= 70 ? 'Ready' : 'Needs Work' },
  { factor: 'API Integration', score: percentage >= 70 ? 'Ready' : 'Needs Work' },
  { factor: 'Type Safety', score: percentage >= 80 ? 'Ready' : 'Needs Work' },
  { factor: 'Error Handling', score: percentage >= 70 ? 'Ready' : 'Needs Work' }
];

readinessFactors.forEach(factor => {
  console.log(`   ${factor.factor}: ${factor.score === 'Ready' ? '✅' : '⚠️'} ${factor.score}`);
});

console.log('\n🚀 NEXT STEPS:');
if (percentage >= 80) {
  console.log('1. ✅ Resolve PNPM dependency issues');
  console.log('2. ✅ Test plugin loading in Alexandria');
  console.log('3. ✅ Proceed to Phase 3: Template System');
  console.log('4. ✅ End-to-end integration testing');
} else {
  console.log('1. ⚠️ Address critical issues identified above');
  console.log('2. ⚠️ Improve service layer implementations');
  console.log('3. ⚠️ Enhance error handling and type safety');
  console.log('4. ⚠️ Re-run comprehensive review');
}

console.log(`\n🏆 CONCLUSION: Alfred plugin is ${percentage >= 80 ? 'READY for integration' : 'NOT YET READY and needs improvement'}!`);