#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Files that need special handling
const specialFiles = [
  'src/plugins/hadron/ui/components/FeedbackDialog.tsx',
  'src/plugins/hadron/ui/components/FeedbackAnalytics.tsx',
  'src/plugins/hadron/ui/components/DateRangePicker.tsx',
  'src/plugins/hadron/ui/components/DrillDownModal.tsx',
  'src/plugins/hadron/ui/components/ChartCustomization.tsx',
  'src/plugins/hadron/ui/components/ChartInteractions.tsx'
];

// Fix remaining component imports
function fixRemainingImports() {
  // Fix AlertDashboard - add missing imports and fix toast
  const alertDashboardPath = path.join(__dirname, 'src/plugins/hadron/ui/components/AlertDashboard.tsx');
  if (fs.existsSync(alertDashboardPath)) {
    let content = fs.readFileSync(alertDashboardPath, 'utf8');
    
    // Add missing Switch import
    if (!content.includes("import { Switch }") && content.includes("Switch")) {
      const dialogImportMatch = content.match(/import { Dialog[^}]+} from[^;]+;/);
      if (dialogImportMatch) {
        const insertPos = content.indexOf(dialogImportMatch[0]) + dialogImportMatch[0].length;
        content = content.slice(0, insertPos) + 
          "\nimport { Switch } from '../../../../client/components/ui/switch';" + 
          content.slice(insertPos);
      }
    }
    
    // Fix toast usage
    if (!content.includes("const { toast } = useToast()") && content.includes("toast({")) {
      // Find the component function
      const componentMatch = content.match(/export const AlertDashboard[^{]*{/);
      if (componentMatch) {
        const insertPos = content.indexOf(componentMatch[0]) + componentMatch[0].length;
        content = content.slice(0, insertPos) + 
          "\n  const { toast } = useToast();" + 
          content.slice(insertPos);
      }
    }
    
    fs.writeFileSync(alertDashboardPath, content);
    console.log('✓ Fixed remaining imports in AlertDashboard.tsx');
  }
  
  // Fix files with Spinner usage
  const filesToFixSpinner = [
    'src/plugins/hadron/ui/components/Dashboard.tsx',
    'src/plugins/hadron/ui/components/CrashLogDetail.tsx'
  ];
  
  filesToFixSpinner.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Replace Spinner component usage with Loader2
      if (content.includes('<Spinner')) {
        content = content.replace(/\<Spinner\s*/g, '<Loader2 className="animate-spin" ');
        content = content.replace(/\<Spinner\/\>/g, '<Loader2 className="animate-spin" />');
        
        // Add Loader2 import if not present
        if (!content.includes('Loader2') && !content.includes('lucide-react')) {
          const lastImportMatch = content.match(/import[^;]+from[^;]+;[\s\n]*(?=\n)/g);
          if (lastImportMatch) {
            const lastImport = lastImportMatch[lastImportMatch.length - 1];
            const insertPos = content.lastIndexOf(lastImport) + lastImport.length;
            content = content.slice(0, insertPos) + 
              "\nimport { Loader2 } from 'lucide-react';" + 
              content.slice(insertPos);
          }
        }
      }
      
      fs.writeFileSync(filePath, content);
      console.log(`✓ Fixed Spinner usage in ${file}`);
    }
  });
  
  // Fix EmptyState usage
  const filesWithEmptyState = [
    'src/plugins/hadron/ui/components/Dashboard.tsx',
    'src/plugins/hadron/ui/components/AnalyticsDashboard.tsx'
  ];
  
  filesWithEmptyState.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Replace EmptyState with custom implementation
      if (content.includes('<EmptyState')) {
        // Create a simple empty state component inline
        const emptyStateComponent = `
const EmptyState = ({ title, description, icon: Icon, action }: { 
  title: string; 
  description?: string; 
  icon?: any;
  action?: React.ReactNode;
}) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    {Icon && <Icon className="h-12 w-12 text-muted-foreground mb-4" />}
    <h3 className="text-lg font-medium mb-2">{title}</h3>
    {description && <p className="text-sm text-muted-foreground mb-4">{description}</p>}
    {action}
  </div>
);`;
        
        // Add component before the main component
        const mainComponentMatch = content.match(/export (?:const|function) \w+/);
        if (mainComponentMatch) {
          const insertPos = content.lastIndexOf(mainComponentMatch[0]);
          content = content.slice(0, insertPos) + emptyStateComponent + '\n\n' + content.slice(insertPos);
        }
      }
      
      fs.writeFileSync(filePath, content);
      console.log(`✓ Fixed EmptyState usage in ${file}`);
    }
  });
  
  // Fix Pagination usage
  const filesWithPagination = ['src/plugins/hadron/ui/components/Dashboard.tsx'];
  
  filesWithPagination.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Replace Pagination with custom implementation
      if (content.includes('<Pagination')) {
        // Create a simple pagination component inline
        const paginationComponent = `
const Pagination = ({ 
  currentPage, 
  totalPages, 
  onPageChange 
}: { 
  currentPage: number; 
  totalPages: number; 
  onPageChange: (page: number) => void;
}) => (
  <div className="flex items-center justify-center gap-2 mt-4">
    <Button
      variant="outline"
      size="sm"
      onClick={() => onPageChange(currentPage - 1)}
      disabled={currentPage === 1}
    >
      Previous
    </Button>
    <span className="text-sm text-muted-foreground">
      Page {currentPage} of {totalPages}
    </span>
    <Button
      variant="outline"
      size="sm"
      onClick={() => onPageChange(currentPage + 1)}
      disabled={currentPage === totalPages}
    >
      Next
    </Button>
  </div>
);`;
        
        // Add component before the main component
        const mainComponentMatch = content.match(/export (?:const|function) \w+/);
        if (mainComponentMatch) {
          const insertPos = content.lastIndexOf(mainComponentMatch[0]);
          content = content.slice(0, insertPos) + paginationComponent + '\n\n' + content.slice(insertPos);
        }
      }
      
      fs.writeFileSync(filePath, content);
      console.log(`✓ Fixed Pagination usage in ${file}`);
    }
  });
}

console.log('Fixing remaining Hadron UI imports...\n');
fixRemainingImports();
console.log('\n✅ Completed fixing remaining imports');