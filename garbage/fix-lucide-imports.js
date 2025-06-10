#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing lucide-react imports...\n');

// Map of files and their icon imports
const filesToFix = {
  'src/client/components/ErrorBoundary.tsx': {
    oldImport: "import { CircleAlert } from '../lib/lucide-icons';",
    newImport: "import { AlertCircle } from 'lucide-react';"
  },
  'src/client/components/app-shell.tsx': {
    oldImport: /import\s*{\s*[\s\S]*?}\s*from\s*['"]\.\.\/lib\/lucide-icons['"];?/,
    newImport: `import {
  Bell,
  Search,
  Settings,
  Sun,
  Moon,
  Monitor,
  LogOut,
  Lightbulb,
} from 'lucide-react';`
  },
  'src/client/components/sidebar.tsx': {
    oldImport: /import\s*{\s*[\s\S]*?}\s*from\s*['"]\.\.\/lib\/lucide-icons['"];?/,
    newImport: `import {
  Home,
  Package,
  Settings,
  Bug,
  BarChart3 as BarChart,
  Database,
  Ticket,
  Book,
  Plus,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';`
  },
  'src/client/components/ui/command/index.tsx': {
    oldImport: "import { Search } from '../../../lib/lucide-icons';",
    newImport: "import { Search } from 'lucide-react';"
  },
  'src/client/components/ui/dialog/index.tsx': {
    oldImport: "import { X } from '../../../lib/lucide-icons';",
    newImport: "import { X } from 'lucide-react';"
  },
  'src/client/components/ui/dropdown-menu/index.tsx': {
    oldImport: "import { Check, ChevronRight, Circle } from '../../../lib/lucide-icons';",
    newImport: "import { Check, ChevronRight, Circle } from 'lucide-react';"
  },
  'src/client/components/ui/modal.tsx': {
    oldImport: "import { X } from '../../lib/lucide-icons'; // Import X icon",
    newImport: "import { X } from 'lucide-react';"
  },
  'src/client/components/ui/select/index.tsx': {
    oldImport: "import { Check, ChevronDown } from '../../../lib/lucide-icons';",
    newImport: "import { Check, ChevronDown } from 'lucide-react';"
  },
  'src/client/components/ui/toaster/index.tsx': {
    oldImport: "import { X } from '../../../lib/lucide-icons';",
    newImport: "import { X } from 'lucide-react';"
  },
  'src/client/pages/crash-analyzer/crash-log-dashboard.tsx': {
    oldImport: "import { Upload, Search, Plus, Filter, RefreshCw, ExternalLink, Trash2 } from '../../lib/lucide-icons';",
    newImport: "import { Upload, Search, Plus, Filter, RefreshCw, ExternalLink, Trash2 } from 'lucide-react';"
  },
  'src/client/pages/crash-analyzer/crash-log-detail/index.tsx': {
    oldImport: "import { ArrowLeft, RefreshCw, Trash2, MessageSquare } from '../../../lib/lucide-icons';",
    newImport: "import { ArrowLeft, RefreshCw, Trash2, MessageSquare } from 'lucide-react';"
  },
  'src/client/pages/crash-analyzer/crash-log-upload.tsx': {
    oldImport: "import { Upload, ArrowLeft } from '../../lib/lucide-icons';",
    newImport: "import { Upload, ArrowLeft } from 'lucide-react';"
  }
};

// Additional fixes needed in components
const componentFixes = {
  'src/client/components/ErrorBoundary.tsx': [
    { old: 'CircleAlert', new: 'AlertCircle' }
  ]
};

// Fix imports
Object.entries(filesToFix).forEach(([file, { oldImport, newImport }]) => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    if (typeof oldImport === 'string') {
      content = content.replace(oldImport, newImport);
    } else {
      content = content.replace(oldImport, newImport);
    }
    
    // Apply component-specific fixes
    if (componentFixes[file]) {
      componentFixes[file].forEach(({ old, new: newValue }) => {
        const regex = new RegExp(`<${old}`, 'g');
        content = content.replace(regex, `<${newValue}`);
      });
    }
    
    fs.writeFileSync(filePath, content);
    console.log(`✓ Fixed ${file}`);
  }
});

// Remove the lucide-icons.ts file as it's no longer needed
const lucideIconsPath = path.join(__dirname, 'src/client/lib/lucide-icons.ts');
if (fs.existsSync(lucideIconsPath)) {
  fs.unlinkSync(lucideIconsPath);
  console.log('\n✓ Removed src/client/lib/lucide-icons.ts');
}

console.log('\n✅ All lucide-react imports have been fixed!');