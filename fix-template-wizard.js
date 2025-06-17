/**
 * Final TypeScript fix for TemplateWizard
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/plugins/alfred/ui/components/enhanced/TemplateWizard.tsx');

console.log('🔧 Applying final fix to TemplateWizard.tsx...');

if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Remove the 'theme' prop from CodeBlock if it's causing issues
    content = content.replace(
        /theme={theme}/g,
        '// theme prop removed for compatibility'
    );
    
    // Make sure the component is properly exported
    if (!content.includes('export default TemplateWizard')) {
        content = content.trimEnd() + '\n\nexport default TemplateWizard;\n';
    }
    
    fs.writeFileSync(filePath, content);
    console.log('✅ Fixed TemplateWizard.tsx');
} else {
    console.error('❌ TemplateWizard.tsx not found');
}
