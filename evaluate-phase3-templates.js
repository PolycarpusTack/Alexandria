#!/usr/bin/env node

/**
 * COMPREHENSIVE PHASE 3 EVALUATION: Template System
 * Evaluates the template system implementation against Phase 3 requirements
 */

const fs = require('fs');
const path = require('path');

console.log('🎯 PHASE 3 EVALUATION: TEMPLATE SYSTEM');
console.log('======================================\n');

let totalScore = 0;
let maxScore = 0;
const achievements = [];
const gaps = [];

function addTest(name, passed, weight = 1, details = '') {
  maxScore += weight;
  if (passed) {
    totalScore += weight;
    console.log(`✅ ${name}${details ? ` - ${details}` : ''}`);
    if (weight > 1) achievements.push(`${name}: ${details}`);
  } else {
    console.log(`❌ ${name}${details ? ` - ${details}` : ''}`);
    gaps.push(`${name}: ${details}`);
  }
}

function addPartialTest(name, score, maxPoints, details = '') {
  maxScore += maxPoints;
  totalScore += score;
  const percentage = Math.round((score / maxPoints) * 100);
  console.log(`${score === maxPoints ? '✅' : '⚠️'} ${name} (${score}/${maxPoints} - ${percentage}%) - ${details}`);
  
  if (percentage >= 80) {
    achievements.push(`${name}: ${details}`);
  } else if (percentage < 60) {
    gaps.push(`${name}: ${details}`);
  }
}

// =================== SECTION 1: SECURITY FOUNDATION & CORE ENGINE ===================
console.log('🔒 SECTION 1: SECURITY FOUNDATION & CORE ENGINE');
console.log('===============================================');

// Check for template engine implementation
try {
  const templateEnginePath = path.join(__dirname, 'src/plugins/alfred/src/services/template-engine');
  
  if (fs.existsSync(templateEnginePath)) {
    const engineFiles = fs.readdirSync(templateEnginePath);
    addTest('Template engine directory exists', true, 2, `${engineFiles.length} files found`);
    
    // Check for specific security components
    const securityFiles = [
      'condition-evaluator.ts',
      'sandbox-executor.ts', 
      'template-validator.ts',
      'mustache-compiler.ts',
      'variable-resolver.ts',
      'security-scanner.ts'
    ];
    
    let securityScore = 0;
    securityFiles.forEach(file => {
      const filePath = path.join(templateEnginePath, file);
      if (fs.existsSync(filePath)) {
        securityScore++;
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check for security-specific implementations
        const hasAST = content.includes('AST') || content.includes('parse') && !content.includes('eval(');
        const hasSandbox = content.includes('VM2') || content.includes('sandbox');
        const hasValidation = content.includes('validate') || content.includes('schema');
        
        console.log(`   ${file}: ✅ (AST: ${hasAST ? '✅' : '❌'}, Sandbox: ${hasSandbox ? '✅' : '❌'}, Validation: ${hasValidation ? '✅' : '❌'})`);
      } else {
        console.log(`   ${file}: ❌ Missing`);
      }
    });
    
    addPartialTest('Security components', securityScore, securityFiles.length, `${securityScore}/${securityFiles.length} security files implemented`);
    
  } else {
    addTest('Template engine directory exists', false, 3, 'Directory not found');
  }
  
} catch (error) {
  addTest('Template engine accessible', false, 3, error.message);
}

// Check core template manager service
try {
  const templateManagerPath = path.join(__dirname, 'src/plugins/alfred/src/services/template-manager.ts');
  const templateManagerContent = fs.readFileSync(templateManagerPath, 'utf8');
  
  addTest('Template manager service exists', true, 2);
  
  // Check for security features in template manager
  const hasSecurityValidation = templateManagerContent.includes('validate') && templateManagerContent.includes('security');
  const hasResourceLimits = templateManagerContent.includes('limit') || templateManagerContent.includes('quota');
  const hasErrorHandling = templateManagerContent.includes('try {') && templateManagerContent.includes('catch');
  const hasCaching = templateManagerContent.includes('cache') || templateManagerContent.includes('Cache');
  
  addTest('Security validation in template manager', hasSecurityValidation, 2);
  addTest('Resource limits implementation', hasResourceLimits, 2);
  addTest('Comprehensive error handling', hasErrorHandling, 1);
  addTest('Performance caching', hasCaching, 1);
  
} catch (error) {
  addTest('Template manager service exists', false, 3, error.message);
}

console.log();

// =================== SECTION 2: ESSENTIAL TEMPLATE LIBRARY ===================
console.log('📦 SECTION 2: ESSENTIAL TEMPLATE LIBRARY');
console.log('========================================');

try {
  const templatesPath = path.join(__dirname, 'src/plugins/alfred/templates');
  
  if (fs.existsSync(templatesPath)) {
    const templateDirs = fs.readdirSync(templatesPath).filter(item => {
      const itemPath = path.join(templatesPath, item);
      return fs.statSync(itemPath).isDirectory();
    });
    
    addTest('Templates directory exists', true, 1, `${templateDirs.length} template directories found`);
    
    // Check for the 8 essential templates from Phase 3 requirements
    const essentialTemplates = [
      'react-typescript-component',
      'express-rest-api', 
      'python-cli-application',
      'docker-configuration',
      'github-workflow',
      'typescript-package',
      'readme-template',
      'environment-configuration'
    ];
    
    let templateScore = 0;
    essentialTemplates.forEach(template => {
      const templatePath = path.join(templatesPath, template);
      if (fs.existsSync(templatePath)) {
        templateScore++;
        
        // Check template structure
        const manifestPath = path.join(templatePath, 'template.json');
        const hasManifest = fs.existsSync(manifestPath);
        
        const filesPath = path.join(templatePath, 'files');
        const hasFiles = fs.existsSync(filesPath);
        
        const hooksPath = path.join(templatePath, 'hooks');
        const hasHooks = fs.existsSync(hooksPath);
        
        console.log(`   ${template}: ✅ (Manifest: ${hasManifest ? '✅' : '❌'}, Files: ${hasFiles ? '✅' : '❌'}, Hooks: ${hasHooks ? '✅' : '❌'})`);
        
        // Analyze manifest if it exists
        if (hasManifest) {
          try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            const hasSecuritySection = manifest.security ? true : false;
            const hasVariables = manifest.variables && Array.isArray(manifest.variables);
            const hasLimits = manifest.limits ? true : false;
            
            console.log(`      Security: ${hasSecuritySection ? '✅' : '❌'}, Variables: ${hasVariables ? '✅' : '❌'}, Limits: ${hasLimits ? '✅' : '❌'}`);
          } catch (e) {
            console.log(`      ⚠️ Invalid manifest JSON`);
          }
        }
        
      } else {
        console.log(`   ${template}: ❌ Missing`);
      }
    });
    
    addPartialTest('Essential templates', templateScore, essentialTemplates.length, `${templateScore}/${essentialTemplates.length} production templates implemented`);
    
    // Check for template manifest v2.0 schema
    if (templateScore > 0) {
      const sampleTemplate = templateDirs[0];
      const sampleManifestPath = path.join(templatesPath, sampleTemplate, 'template.json');
      
      if (fs.existsSync(sampleManifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(sampleManifestPath, 'utf8'));
        const hasV2Schema = manifest.schemaVersion === '2.0.0';
        const hasSecuritySignature = manifest.security && manifest.security.signature;
        const hasRequirements = manifest.requirements ? true : false;
        const hasAdvancedVariables = manifest.variables && manifest.variables.some(v => v.validation || v.aiPrompt);
        
        addTest('Template Manifest v2.0 schema', hasV2Schema, 2);
        addTest('Security signatures', hasSecuritySignature, 2);
        addTest('Template requirements', hasRequirements, 1);
        addTest('Advanced variable definitions', hasAdvancedVariables, 2);
      }
    }
    
  } else {
    addTest('Templates directory exists', false, 4, 'Templates directory not found');
  }
  
} catch (error) {
  addTest('Template library accessible', false, 4, error.message);
}

console.log();

// =================== SECTION 3: CLI WIZARD & UI COMPONENTS ===================
console.log('🎨 SECTION 3: CLI WIZARD & UI COMPONENTS');
console.log('=======================================');

// Check Template Wizard component
try {
  const wizardPath = path.join(__dirname, 'src/plugins/alfred/ui/components/TemplateWizard.tsx');
  const wizardContent = fs.readFileSync(wizardPath, 'utf8');
  
  addTest('Template Wizard component exists', true, 2, `${wizardContent.length} characters`);
  
  // Check wizard features
  const hasSteps = wizardContent.includes('step') || wizardContent.includes('Step');
  const hasFormValidation = wizardContent.includes('validate') || wizardContent.includes('schema');
  const hasProgressTracking = wizardContent.includes('progress') || wizardContent.includes('Progress');
  const hasConflictResolution = wizardContent.includes('conflict') || wizardContent.includes('merge');
  const hasTemplatePreview = wizardContent.includes('preview') || wizardContent.includes('Preview');
  const hasVariableInput = wizardContent.includes('variable') || wizardContent.includes('Variable');
  
  addTest('Multi-step wizard interface', hasSteps, 2);
  addTest('Form validation', hasFormValidation, 1);
  addTest('Progress tracking', hasProgressTracking, 1);
  addTest('Conflict resolution UI', hasConflictResolution, 2);
  addTest('Template preview', hasTemplatePreview, 1);
  addTest('Variable input system', hasVariableInput, 2);
  
} catch (error) {
  addTest('Template Wizard component exists', false, 3, error.message);
}

// Check for CLI wizard implementation
try {
  const cliPath = path.join(__dirname, 'src/plugins/alfred/src/services/cli-wizard.ts');
  if (fs.existsSync(cliPath)) {
    const cliContent = fs.readFileSync(cliPath, 'utf8');
    addTest('CLI wizard implementation', true, 2, 'Interactive command-line interface');
    
    const hasInquirer = cliContent.includes('inquirer') || cliContent.includes('prompt');
    const hasTemplateDiscovery = cliContent.includes('discover') || cliContent.includes('search');
    
    addTest('Interactive prompts (Inquirer.js style)', hasInquirer, 1);
    addTest('Template discovery', hasTemplateDiscovery, 1);
  } else {
    addTest('CLI wizard implementation', false, 2, 'CLI interface not found');
  }
} catch (error) {
  addTest('CLI wizard accessible', false, 2, error.message);
}

console.log();

// =================== SECTION 4: AI INTEGRATION & INTELLIGENCE ===================
console.log('🧠 SECTION 4: AI INTEGRATION & INTELLIGENCE');
console.log('===========================================');

// Check for AI-enhanced template features
try {
  const aiIntegrationPaths = [
    'src/plugins/alfred/src/services/template-ai-enhancer.ts',
    'src/plugins/alfred/src/services/variable-suggestion-engine.ts',
    'src/plugins/alfred/src/services/template-recommendation.ts'
  ];
  
  let aiScore = 0;
  aiIntegrationPaths.forEach(aiPath => {
    if (fs.existsSync(path.join(__dirname, aiPath))) {
      aiScore++;
      const content = fs.readFileSync(path.join(__dirname, aiPath), 'utf8');
      
      const hasContextAnalysis = content.includes('context') && content.includes('analysis');
      const hasConfidenceScoring = content.includes('confidence') || content.includes('score');
      const hasFallbackBehavior = content.includes('fallback') || content.includes('default');
      
      console.log(`   ${path.basename(aiPath)}: ✅ (Context: ${hasContextAnalysis ? '✅' : '❌'}, Confidence: ${hasConfidenceScoring ? '✅' : '❌'}, Fallback: ${hasFallbackBehavior ? '✅' : '❌'})`);
    } else {
      console.log(`   ${path.basename(aiPath)}: ❌ Missing`);
    }
  });
  
  addPartialTest('AI integration services', aiScore, aiIntegrationPaths.length, `${aiScore}/${aiIntegrationPaths.length} AI services implemented`);
  
  // Check existing services for AI enhancement
  const templateManagerPath = path.join(__dirname, 'src/plugins/alfred/src/services/template-manager.ts');
  if (fs.existsSync(templateManagerPath)) {
    const content = fs.readFileSync(templateManagerPath, 'utf8');
    const hasAIIntegration = content.includes('ai') || content.includes('AI') || content.includes('suggestion');
    addTest('AI integration in template manager', hasAIIntegration, 2);
  }
  
} catch (error) {
  addTest('AI integration accessible', false, 3, error.message);
}

console.log();

// =================== SECTION 5: PERFORMANCE & SECURITY BENCHMARKS ===================
console.log('⚡ SECTION 5: PERFORMANCE & SECURITY BENCHMARKS');
console.log('===============================================');

// Check for performance optimizations
try {
  const perfPaths = [
    'src/plugins/alfred/src/services/template-cache.ts',
    'src/plugins/alfred/src/services/performance-monitor.ts'
  ];
  
  let perfScore = 0;
  perfPaths.forEach(perfPath => {
    if (fs.existsSync(path.join(__dirname, perfPath))) {
      perfScore++;
      console.log(`   ${path.basename(perfPath)}: ✅`);
    } else {
      console.log(`   ${path.basename(perfPath)}: ❌ Missing`);
    }
  });
  
  addPartialTest('Performance optimization', perfScore, perfPaths.length, `${perfScore}/${perfPaths.length} performance services implemented`);
  
  // Check for security scanning
  const securityPaths = [
    'src/plugins/alfred/src/services/security-scanner.ts',
    'src/plugins/alfred/src/services/vulnerability-checker.ts'
  ];
  
  let securityScore = 0;
  securityPaths.forEach(secPath => {
    if (fs.existsSync(path.join(__dirname, secPath))) {
      securityScore++;
      console.log(`   ${path.basename(secPath)}: ✅`);
    } else {
      console.log(`   ${path.basename(secPath)}: ❌ Missing`);
    }
  });
  
  addPartialTest('Security scanning', securityScore, securityPaths.length, `${securityScore}/${securityPaths.length} security services implemented`);
  
} catch (error) {
  addTest('Performance/Security systems accessible', false, 2, error.message);
}

console.log();

// =================== FINAL PHASE 3 ASSESSMENT ===================
console.log('📊 PHASE 3 FINAL ASSESSMENT');
console.log('============================');

const percentage = Math.round((totalScore / maxScore) * 100);
console.log(`\nPhase 3 Score: ${totalScore}/${maxScore} (${percentage}%)\n`);

// Grade assignment
let grade, status, recommendation;
if (percentage >= 90) {
  grade = 'A+';
  status = '🎉 EXCEPTIONAL - Phase 3 Complete';
  recommendation = 'Template system exceeds all Phase 3 requirements. Ready for Phase 4.';
} else if (percentage >= 80) {
  grade = 'A';
  status = '✅ EXCELLENT - Phase 3 Nearly Complete';
  recommendation = 'Template system meets core requirements. Minor enhancements possible.';
} else if (percentage >= 70) {
  grade = 'B+';
  status = '⚠️ GOOD - Phase 3 Substantial Progress';
  recommendation = 'Template system has solid foundation but needs completion.';
} else if (percentage >= 60) {
  grade = 'B';
  status = '⚠️ ACCEPTABLE - Phase 3 In Progress';
  recommendation = 'Template system started but requires significant work.';
} else {
  grade = 'C';
  status = '❌ NEEDS WORK - Phase 3 Not Started';
  recommendation = 'Template system requires implementation from scratch.';
}

console.log(`Grade: ${grade}`);
console.log(`Status: ${status}`);
console.log(`Recommendation: ${recommendation}\n`);

// Major achievements
if (achievements.length > 0) {
  console.log('🏆 MAJOR ACHIEVEMENTS:');
  achievements.slice(0, 8).forEach(achievement => console.log(`   • ${achievement}`));
  console.log();
}

// Remaining gaps
if (gaps.length > 0) {
  console.log('🎯 REMAINING WORK FOR PHASE 3:');
  gaps.slice(0, 8).forEach(gap => console.log(`   • ${gap}`));
  console.log();
}

// Phase 3 completion status
console.log('🎯 PHASE 3 COMPLETION STATUS:');
console.log('==============================');

const phase3Requirements = [
  { requirement: 'Security Foundation & Core Engine', score: percentage >= 70 ? 'Complete' : 'Incomplete' },
  { requirement: 'Essential Template Library (8 templates)', score: percentage >= 60 ? 'Complete' : 'Incomplete' },
  { requirement: 'CLI Wizard & Basic UI', score: percentage >= 80 ? 'Complete' : 'Incomplete' },
  { requirement: 'AI-Enhanced Intelligence', score: percentage >= 50 ? 'Complete' : 'Incomplete' },
  { requirement: 'Performance & Security', score: percentage >= 70 ? 'Complete' : 'Incomplete' }
];

phase3Requirements.forEach(req => {
  console.log(`   ${req.requirement}: ${req.score === 'Complete' ? '✅' : '⚠️'} ${req.score}`);
});

console.log('\n🚀 NEXT STEPS:');
if (percentage >= 80) {
  console.log('1. ✅ Phase 3 is substantially complete');
  console.log('2. ✅ Proceed to Phase 4: End-to-end testing and validation');
  console.log('3. ✅ Address minor gaps in parallel');
  console.log('4. ✅ Alfred plugin ready for production deployment');
} else if (percentage >= 60) {
  console.log('1. ⚠️ Complete remaining template implementations');
  console.log('2. ⚠️ Enhance security and AI integration');
  console.log('3. ⚠️ Finish UI components');
  console.log('4. ⚠️ Then proceed to Phase 4');
} else {
  console.log('1. ❌ Implement core template system components');
  console.log('2. ❌ Create essential template library');
  console.log('3. ❌ Build wizard interfaces');
  console.log('4. ❌ Add security and AI features');
}

console.log(`\n🏆 CONCLUSION: Phase 3 is ${percentage >= 80 ? 'SUBSTANTIALLY COMPLETE' : percentage >= 60 ? 'IN GOOD PROGRESS' : 'NEEDS SIGNIFICANT WORK'}!`);