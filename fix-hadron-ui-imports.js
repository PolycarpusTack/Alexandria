#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// List of files to update
const filesToUpdate = [
  'src/plugins/hadron/ui/components/AlertDashboard.tsx',
  'src/plugins/hadron/ui/components/AnalyticsDashboard.tsx',
  'src/plugins/hadron/ui/components/AnalyticsFilters.tsx',
  'src/plugins/hadron/ui/components/AnalyticsNavigation.tsx',
  'src/plugins/hadron/ui/components/ChartCustomization.tsx',
  'src/plugins/hadron/ui/components/ChartInteractions.tsx',
  'src/plugins/hadron/ui/components/CodeSnippetDetail.tsx',
  'src/plugins/hadron/ui/components/CodeSnippetUpload.tsx',
  'src/plugins/hadron/ui/components/CrashLogList.tsx',
  'src/plugins/hadron/ui/components/DateRangePicker.tsx',
  'src/plugins/hadron/ui/components/DrillDownModal.tsx',
  'src/plugins/hadron/ui/components/LogViewer.tsx',
  'src/plugins/hadron/ui/components/MetricCard.tsx',
  'src/plugins/hadron/ui/components/OllamaStatusIndicator.tsx',
  'src/plugins/hadron/ui/components/RootCauseList.tsx',
  'src/plugins/hadron/ui/components/SecurityScanResults.tsx',
  'src/plugins/hadron/ui/components/StatsSummary.tsx',
  'src/plugins/hadron/ui/components/SystemInfo.tsx',
  'src/plugins/hadron/ui/components/UploadCrashLog.tsx',
  'src/plugins/hadron/ui/components/charts/TimeSeriesChart.tsx'
];

// Common UI component mappings
const componentMappings = {
  // Cards
  'Card': "import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../client/components/ui/card'",
  
  // Buttons and inputs
  'Button': "import { Button } from '../../../../client/components/ui/button'",
  'Input': "import { Input } from '../../../../client/components/ui/input'",
  'Textarea': "import { Textarea } from '../../../../client/components/ui/textarea'",
  
  // Selections
  'Select': "import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../client/components/ui/select'",
  'RadioGroup': "import { RadioGroup, RadioGroupItem } from '../../../../client/components/ui/radio-group'",
  'Checkbox': "import { Checkbox } from '../../../../client/components/ui/checkbox'",
  
  // Layout
  'Tabs': "import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../client/components/ui/tabs'",
  'Dialog': "import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '../../../../client/components/ui/dialog'",
  'Table': "import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../client/components/ui/table'",
  
  // Feedback
  'Badge': "import { Badge } from '../../../../client/components/ui/badge'",
  'Progress': "import { Progress } from '../../../../client/components/ui/progress'",
  'Alert': "import { Alert, AlertDescription, AlertTitle } from '../../../../client/components/ui/alert'",
  'toast': "import { useToast } from '../../../../client/components/ui/use-toast'",
  
  // Icons
  'Spinner': "import { Loader2 } from 'lucide-react'",
  'EmptyState': "// EmptyState needs custom implementation",
  'Pagination': "// Pagination needs custom implementation"
};

function fixImports(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Find imports from ui/components
    const importRegex = /import\s*{([^}]+)}\s*from\s*['"]\.\.\/\.\.\/\.\.\/\.\.\/ui\/components['"];?/g;
    const chartImportRegex = /import\s*{([^}]+)}\s*from\s*['"]\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/ui\/components\/\w+['"];?/g;
    
    // Extract all imported components
    let allImports = new Set();
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      const imports = match[1].split(',').map(i => i.trim());
      imports.forEach(imp => allImports.add(imp));
    }
    
    while ((match = chartImportRegex.exec(content)) !== null) {
      const imports = match[1].split(',').map(i => i.trim());
      imports.forEach(imp => allImports.add(imp));
    }
    
    if (allImports.size > 0) {
      // Remove old import statements
      content = content.replace(importRegex, '');
      content = content.replace(chartImportRegex, '');
      
      // Group imports by their new import path
      const importGroups = {};
      const customImplementations = [];
      
      allImports.forEach(component => {
        const mapping = componentMappings[component];
        if (mapping) {
          if (mapping.includes('needs custom implementation')) {
            customImplementations.push(mapping);
          } else {
            importGroups[mapping] = true;
          }
        } else {
          console.log(`Warning: No mapping found for component: ${component} in ${filePath}`);
        }
      });
      
      // Build new import statements
      let newImports = Object.keys(importGroups).join(';\n');
      if (customImplementations.length > 0) {
        newImports += ';\n' + customImplementations.join(';\n');
      }
      
      // Find where to insert new imports (after the last import or at the beginning)
      const lastImportMatch = content.match(/import[^;]+;[\s\n]*(?=\n)/g);
      if (lastImportMatch) {
        const lastImport = lastImportMatch[lastImportMatch.length - 1];
        const insertPos = content.lastIndexOf(lastImport) + lastImport.length;
        content = content.slice(0, insertPos) + '\n' + newImports + content.slice(insertPos);
      } else {
        content = newImports + '\n\n' + content;
      }
      
      // Replace Spinner with Loader2
      content = content.replace(/\<Spinner\s/g, '<Loader2 className="animate-spin" ');
      content = content.replace(/\<Spinner\/\>/g, '<Loader2 className="animate-spin" />');
      
      // Update toast usage
      if (content.includes('toast(')) {
        // Add toast hook if not already present
        if (!content.includes('useToast')) {
          const componentMatch = content.match(/export\s+(?:const|function)\s+\w+.*?{/);
          if (componentMatch) {
            const insertPos = content.indexOf(componentMatch[0]) + componentMatch[0].length;
            content = content.slice(0, insertPos) + '\n  const { toast } = useToast();' + content.slice(insertPos);
          }
        }
      }
      
      modified = true;
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`✓ Fixed imports in ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Fix chart-specific imports
function fixChartImports(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Fix chart-specific import paths
    content = content.replace(
      /from ['"]\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/ui\/components\/button['"];?/g,
      "from '../../../../../client/components/ui/button'"
    );
    
    fs.writeFileSync(filePath, content);
    return true;
  } catch (error) {
    console.error(`Error fixing chart imports in ${filePath}:`, error.message);
    return false;
  }
}

console.log('Fixing Hadron UI component imports...\n');

let fixedCount = 0;
filesToUpdate.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    if (file.includes('charts/')) {
      if (fixChartImports(fullPath)) fixedCount++;
    }
    if (fixImports(fullPath)) fixedCount++;
  } else {
    console.log(`✗ File not found: ${file}`);
  }
});

console.log(`\n✅ Fixed imports in ${fixedCount} files`);