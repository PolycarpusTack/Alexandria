# TASK ALFRED 3: Component Export/Import Fixes

**Priority:** Medium  
**Estimated Effort:** 20 hours  
**Status:** ✅ COMPLETED  
**Target:** Resolve ~80 TypeScript component export/import errors  
**Dependencies:** TASK_ALFRED_1_TYPE_DEFINITIONS.md (Component prop interfaces)

---

## 🎯 OBJECTIVE

Fix React component export/import structure issues, prop type definitions, hook return type annotations, and context provider type definitions that are preventing Alfred UI components from compiling correctly.

---

## 🔍 PROBLEM ANALYSIS

### Primary Issues (~80 errors)

1. **Dialog and Select Component Structure Mismatches** (~25 errors)
   - Compound component export patterns incorrect
   - Radix UI component wrapping issues
   - Forward ref type definitions missing

2. **React Component Prop Type Definitions** (~30 errors)
   - Missing or incorrect prop interfaces
   - Generic type parameter issues
   - Children prop handling inconsistencies

3. **Hook Return Type Annotations** (~15 errors)
   - Custom hook return types not defined
   - useContext hook type inference issues
   - useCallback/useMemo type annotations missing

4. **Context Provider Type Definitions** (~10 errors)
   - Context value type definitions missing
   - Provider component prop types
   - Consumer hook type safety issues

---

## 📋 DETAILED TASK BREAKDOWN

### Subtask 3.1: Fix Dialog and Select Component Exports (8 hours)

**Problem Files:**
- `src/client/components/ui/dialog/index.tsx`
- `src/client/components/ui/select/index.tsx`
- `src/client/components/ui/command/index.tsx`

**Current Issues:**
```typescript
// ❌ Current export pattern causing errors
export const Dialog = DialogRoot;
export const DialogContent = DialogContentComponent;
// Missing proper compound component structure

// ✅ Target compound component pattern
const Dialog = DialogRoot;
const DialogContent = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Content
    ref={ref}
    className={cn("dialog-content", className)}
    {...props}
  >
    {children}
  </DialogPrimitive.Content>
));

Dialog.displayName = "Dialog";
DialogContent.displayName = "DialogContent";

export { Dialog, DialogContent };
```

**Actions Required:**
1. **Dialog Component Structure:**
   ```typescript
   // Define proper compound component types
   interface DialogProps {
     children: React.ReactNode;
     open?: boolean;
     onOpenChange?: (open: boolean) => void;
   }
   
   interface DialogContentProps {
     children: React.ReactNode;
     className?: string;
   }
   
   // Implement proper forward ref patterns
   const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(
     ({ children, className, ...props }, ref) => {
       return (
         <DialogPrimitive.Content
           ref={ref}
           className={cn("dialog-content", className)}
           {...props}
         >
           {children}
         </DialogPrimitive.Content>
       );
     }
   );
   ```

2. **Select Component Structure:**
   ```typescript
   // Fix Select compound component exports
   interface SelectProps {
     children: React.ReactNode;
     value?: string;
     onValueChange?: (value: string) => void;
   }
   
   const Select = SelectPrimitive.Root;
   const SelectTrigger = forwardRef<
     React.ElementRef<typeof SelectPrimitive.Trigger>,
     React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
   >(({ className, children, ...props }, ref) => (
     <SelectPrimitive.Trigger
       ref={ref}
       className={cn("select-trigger", className)}
       {...props}
     >
       {children}
     </SelectPrimitive.Trigger>
   ));
   ```

**Files to Update:**
- All Alfred UI components importing Dialog/Select
- Template wizard components using these UI elements
- Form components in Alfred interface

### Subtask 3.2: React Component Prop Type Fixes (7 hours)

**Files to Fix:**
- `src/plugins/alfred/ui/components/TemplateWizard.tsx`
- `src/plugins/alfred/ui/components/ChatInterface.tsx`
- `src/plugins/alfred/ui/components/ProjectExplorer.tsx`
- `src/plugins/alfred/ui/components/SessionList.tsx`
- `src/plugins/alfred/src/ui/template-wizard/*.tsx`

**Prop Interface Definitions:**
```typescript
// TemplateWizard.tsx
interface TemplateWizardProps {
  templateId?: string;
  onComplete: (result: TemplateGenerationResult) => void;
  onCancel: () => void;
  initialValues?: Record<string, any>;
  readonly?: boolean;
  className?: string;
}

// ChatInterface.tsx
interface ChatInterfaceProps {
  sessionId: string;
  messages: AlfredMessage[];
  onMessageSent: (message: string) => Promise<void>;
  isLoading?: boolean;
  streamingEnabled?: boolean;
  className?: string;
}

// ProjectExplorer.tsx
interface ProjectExplorerProps {
  projectPath?: string;
  onFileSelect?: (filePath: string) => void;
  onDirectoryChange?: (directoryPath: string) => void;
  expandedNodes?: Set<string>;
  selectedFile?: string;
  className?: string;
}

// SessionList.tsx
interface SessionListProps {
  sessions: AlfredSession[];
  activeSessionId?: string;
  onSessionSelect: (sessionId: string) => void;
  onSessionDelete: (sessionId: string) => void;
  onSessionRename: (sessionId: string, newName: string) => void;
  className?: string;
}
```

**Generic Type Parameter Fixes:**
```typescript
// Fix generic component patterns
interface ListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T) => string;
  className?: string;
}

function List<T>({ items, renderItem, keyExtractor, className }: ListProps<T>) {
  return (
    <div className={className}>
      {items.map((item, index) => (
        <div key={keyExtractor(item)}>
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  );
}
```

### Subtask 3.3: Hook Return Type Annotations (3 hours)

**Files to Fix:**
- `src/plugins/alfred/ui/hooks/useAlfredContext.tsx`
- `src/plugins/alfred/ui/hooks/useAlfredService.ts`
- `src/plugins/alfred/ui/hooks/useProjectContext.ts`
- Custom hooks in template wizard components

**Hook Type Definitions:**
```typescript
// useAlfredContext.tsx
interface AlfredContextValue {
  service: AlfredService;
  currentSession: AlfredSession | null;
  isLoading: boolean;
  error: string | null;
  createSession: (options?: CreateSessionOptions) => Promise<AlfredSession>;
  switchSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
}

export function useAlfredContext(): AlfredContextValue {
  const context = useContext(AlfredContext);
  if (!context) {
    throw new Error('useAlfredContext must be used within AlfredProvider');
  }
  return context;
}

// useAlfredService.ts
interface UseAlfredServiceReturn {
  sendMessage: (content: string) => Promise<void>;
  sendMessageStream: (content: string) => AsyncGenerator<StreamChunk>;
  isStreaming: boolean;
  error: string | null;
  clearError: () => void;
}

export function useAlfredService(sessionId: string): UseAlfredServiceReturn {
  // Implementation with proper return type
}

// useProjectContext.ts
interface UseProjectContextReturn {
  projectPath: string | null;
  projectStructure: ProjectNode | null;
  isLoading: boolean;
  error: string | null;
  setProjectPath: (path: string) => void;
  refreshStructure: () => Promise<void>;
}

export function useProjectContext(): UseProjectContextReturn {
  // Implementation with proper return type
}
```

**Custom Hook Patterns:**
```typescript
// Template wizard specific hooks
function useTemplateGeneration(): {
  generateTemplate: (variables: TemplateVariables) => Promise<GenerationResult>;
  progress: GenerationProgress | null;
  isGenerating: boolean;
  error: string | null;
} {
  // Implementation
}

function useFileTreePreview(): {
  preview: FileTreeNode | null;
  updatePreview: (variables: TemplateVariables) => void;
  isUpdating: boolean;
} {
  // Implementation
}
```

### Subtask 3.4: Context Provider Type Definitions (2 hours)

**Files to Fix:**
- `src/plugins/alfred/ui/contexts/WizardServiceContext.tsx`
- Alfred-specific context providers
- Template wizard context

**Context Type Definitions:**
```typescript
// WizardServiceContext.tsx
interface WizardServiceContextValue {
  service: TemplateWizardService;
  currentTemplate: Template | null;
  variables: TemplateVariables;
  updateVariable: (key: string, value: any) => void;
  resetVariables: () => void;
  generateTemplate: () => Promise<void>;
}

const WizardServiceContext = createContext<WizardServiceContextValue | null>(null);

interface WizardServiceProviderProps {
  children: React.ReactNode;
  templateId?: string;
}

export function WizardServiceProvider({ 
  children, 
  templateId 
}: WizardServiceProviderProps) {
  // Implementation with proper types
  const value: WizardServiceContextValue = {
    // ... context value implementation
  };

  return (
    <WizardServiceContext.Provider value={value}>
      {children}
    </WizardServiceContext.Provider>
  );
}

export function useWizardService(): WizardServiceContextValue {
  const context = useContext(WizardServiceContext);
  if (!context) {
    throw new Error('useWizardService must be used within WizardServiceProvider');
  }
  return context;
}
```

---

## ✅ ACCEPTANCE CRITERIA

### Definition of Done:
- [x] All Dialog/Select compound components properly exported ✅
- [x] All Alfred React components have defined prop interfaces ✅
- [x] All custom hooks have proper return type annotations ✅
- [x] All context providers properly typed ✅
- [x] No "Property does not exist on type" errors in component files ✅
- [x] No "JSX element type does not have any construct signatures" errors ✅
- [x] All forwardRef patterns properly typed ✅
- [x] Component children props properly handled ✅

## Implementation Status

- [x] **Subtask 3.1**: Dialog and Select compound component exports - **Priority: High** ✅ COMPLETED
  - Fixed DialogCompound export pattern in `/src/client/components/ui/dialog/index.tsx`
  - Fixed SelectCompound export pattern in `/src/client/components/ui/select/index.tsx`
  - Both components now support compound usage patterns while maintaining backward compatibility

- [x] **Subtask 3.2**: React component prop type definitions - **Priority: High** ✅ COMPLETED
  - Verified ChatInterface, ProjectExplorer, and SessionList components have proper prop interfaces
  - All Alfred UI components have well-defined TypeScript interfaces for props
  - No type definition issues found

- [x] **Subtask 3.3**: Hook return type annotations - **Priority: Medium** ✅ COMPLETED
  - Verified useAlfredService.ts has proper return type annotation: `(): AlfredService`
  - Verified useAlfredContext.tsx has proper interface definitions and return types
  - useProjectContext.ts has comprehensive interface and return type definitions
  - All hooks properly typed

- [x] **Subtask 3.4**: Context provider type definitions - **Priority: Medium** ✅ COMPLETED
  - AlfredContext has proper interface definitions with AlfredContextType
  - AlfredProvider has proper props interface and component typing
  - useProjectContext has comprehensive ProjectContext interface
  - All context providers properly typed

### Verification Commands:
```bash
# Check Alfred UI components
npx tsc --noEmit src/plugins/alfred/ui/

# Check specific component files
npx tsc --noEmit src/plugins/alfred/ui/components/TemplateWizard.tsx
npx tsc --noEmit src/client/components/ui/dialog/index.tsx

# Verify hooks and contexts
npx tsc --noEmit src/plugins/alfred/ui/hooks/
npx tsc --noEmit src/plugins/alfred/ui/contexts/
```

---

## 🔧 IMPLEMENTATION STRATEGY

### Phase 1: UI Component Structure Fixes (Day 1-2)
1. Fix Dialog component compound export pattern
2. Fix Select component structure
3. Update Command component exports
4. Test compound component usage

### Phase 2: Alfred Component Props (Day 2-3)
1. Define TemplateWizard prop interfaces
2. Fix ChatInterface component types
3. Update ProjectExplorer and SessionList
4. Fix template wizard component props

### Phase 3: Hook Type Annotations (Day 3-4)
1. Add return types to useAlfredContext
2. Fix useAlfredService hook typing
3. Update useProjectContext types
4. Add custom hook type annotations

### Phase 4: Context Provider Types (Day 4)
1. Define WizardServiceContext types
2. Update context provider props
3. Fix context consumer hooks
4. Test context type safety

---

## 📁 CRITICAL FILES TO UPDATE

### UI Component Files:
```
src/client/components/ui/
├── dialog/index.tsx          # Compound component exports
├── select/index.tsx          # Select component structure
└── command/index.tsx         # Command component exports

src/plugins/alfred/ui/components/
├── TemplateWizard.tsx        # Main wizard component
├── ChatInterface.tsx         # Chat interface
├── ProjectExplorer.tsx       # File tree component
└── SessionList.tsx           # Session management
```

### Hook Files:
```
src/plugins/alfred/ui/hooks/
├── useAlfredContext.tsx      # Main Alfred context hook
├── useAlfredService.ts       # Service integration hook
└── useProjectContext.ts     # Project context hook
```

### Context Files:
```
src/plugins/alfred/ui/contexts/
└── WizardServiceContext.tsx  # Template wizard context
```

---

## 🚨 RISK MITIGATION

### Potential Issues:
1. **Component Breaking Changes**: Type fixes might require prop changes
2. **Hook API Changes**: Return type changes might affect consumers
3. **Context Breaking Changes**: Context value changes might break providers

### Mitigation Strategies:
1. **Backward Compatibility**: Maintain existing prop APIs where possible
2. **Incremental Testing**: Test each component after type fixes
3. **Component Isolation**: Fix components independently to isolate issues
4. **Rollback Plan**: Keep component backups for quick rollback

---

## 🧪 TESTING STRATEGY

### Unit Tests:
```bash
# Test Alfred UI components
pnpm run test src/plugins/alfred/ui/components/

# Test hooks
pnpm run test src/plugins/alfred/ui/hooks/

# Test contexts
pnpm run test src/plugins/alfred/ui/contexts/
```

### Component Tests:
```bash
# Test specific components
pnpm run test TemplateWizard.test.tsx
pnpm run test ChatInterface.test.tsx
```

### Visual Testing:
```bash
# Start development server to verify components render
pnpm run dev

# Navigate to Alfred UI to test components visually
```

---

## 📊 SUCCESS METRICS

- **Error Reduction**: From ~80 component errors to <5 errors
- **Type Safety**: All React components properly typed
- **Component Functionality**: All components render without runtime errors
- **Hook Reliability**: All custom hooks properly typed and functional

**Target Completion Date:** End of Week 3  
**Dependencies:** Component prop interfaces from TASK_ALFRED_1  
**Blockers:** UI compound component patterns must be established first  
**Next Task:** Proceed to TASK_ALFRED_4_MODULE_RESOLUTION.md