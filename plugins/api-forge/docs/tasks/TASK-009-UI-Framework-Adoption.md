# TASK-009: Modern UI Framework Adoption

**Priority**: P3 - Low  
**Estimated Time**: 40-48 hours  
**Assignee**: _________________  
**Status**: [ ] Not Started

## Overview
Migrate from vanilla JavaScript/HTML string templates to a modern UI framework (React) for better component lifecycle management, state handling, and maintainability.

## Framework Selection

**Chosen Framework**: React 18
- **Reasons**:
  - Component-based architecture
  - Virtual DOM for performance
  - Large ecosystem
  - TypeScript support
  - Alexandria platform compatibility

## Migration Strategy

### Phase 1: Setup React Infrastructure (8 hours)

#### 1. Install Dependencies
```bash
npm install react react-dom
npm install --save-dev @types/react @types/react-dom
npm install --save-dev @vitejs/plugin-react
npm install @tanstack/react-query zustand
```

#### 2. Update Build Configuration
**File**: `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.tsx'),
      name: 'ApicarusPlugin',
      formats: ['es'],
      fileName: 'apicarus'
    },
    rollupOptions: {
      external: ['react', 'react-dom', '@alexandria/shared'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM'
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

### Phase 2: Core React Components (16 hours)

#### 1. Main App Component
**File**: `src/App.tsx`

```tsx
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { usePluginStore } from './store/pluginStore';
import { RequestBuilder } from './components/RequestBuilder';
import { ResponseViewer } from './components/ResponseViewer';
import { Sidebar } from './components/Sidebar';
import { AIAssistant } from './components/AIAssistant';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/main.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

export const App: React.FC = () => {
  const { activePanel, theme } = usePluginStore();

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <div className={`apicarus-app theme-${theme}`}>
          <div className="app-layout">
            <Sidebar />
            <main className="main-content">
              {activePanel === 'request' && <RequestBuilder />}
              {activePanel === 'response' && <ResponseViewer />}
            </main>
            <AIAssistant />
          </div>
        </div>
      </ErrorBoundary>
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
    </QueryClientProvider>
  );
};
```

#### 2. Request Builder Component
**File**: `src/components/RequestBuilder.tsx`

```tsx
import React, { useState, useCallback, useMemo } from 'react';
import { usePluginStore } from '../store/pluginStore';
import { useRequest } from '../hooks/useRequest';
import { MethodSelector } from './MethodSelector';
import { UrlInput } from './UrlInput';
import { TabPanel } from './TabPanel';
import { ParamsTab } from './tabs/ParamsTab';
import { HeadersTab } from './tabs/HeadersTab';
import { BodyTab } from './tabs/BodyTab';
import { AuthTab } from './tabs/AuthTab';
import { ValidationError } from '../utils/errors';
import type { HTTPMethod, TabType } from '../types';

export const RequestBuilder: React.FC = () => {
  const { request, updateRequest, isLoading } = usePluginStore();
  const { sendRequest } = useRequest();
  const [activeTab, setActiveTab] = useState<TabType>('params');

  const handleMethodChange = useCallback((method: HTTPMethod) => {
    updateRequest({ method });
  }, [updateRequest]);

  const handleUrlChange = useCallback((url: string) => {
    updateRequest({ url });
    // Parse and extract params
    try {
      const urlObj = new URL(url);
      const params: Record<string, string> = {};
      urlObj.searchParams.forEach((value, key) => {
        params[key] = value;
      });
      updateRequest({ params });
    } catch {
      // Invalid URL, ignore
    }
  }, [updateRequest]);

  const handleSend = useCallback(async () => {
    try {
      await sendRequest();
    } catch (error) {
      if (error instanceof ValidationError) {
        // Show validation error
        console.error('Validation error:', error.message);
      }
    }
  }, [sendRequest]);

  const tabs = useMemo(() => [
    { id: 'params' as const, label: 'Parameters', component: ParamsTab },
    { id: 'headers' as const, label: 'Headers', component: HeadersTab },
    { id: 'body' as const, label: 'Body', component: BodyTab },
    { id: 'auth' as const, label: 'Authorization', component: AuthTab },
  ], []);

  return (
    <div className="request-builder">
      <div className="request-header">
        <h2>Request</h2>
        <div className="request-actions">
          <button className="btn-icon" title="Import cURL">
            <i className="fa-solid fa-file-import" />
          </button>
          <button className="btn-icon" title="Generate Code">
            <i className="fa-solid fa-code" />
          </button>
        </div>
      </div>

      <div className="request-url-bar">
        <MethodSelector 
          value={request.method} 
          onChange={handleMethodChange} 
        />
        <UrlInput 
          value={request.url} 
          onChange={handleUrlChange}
          placeholder="Enter request URL"
        />
        <button 
          className="btn-primary"
          onClick={handleSend}
          disabled={isLoading || !request.url}
        >
          {isLoading ? (
            <>
              <i className="fa-solid fa-spinner fa-spin" />
              Sending...
            </>
          ) : (
            <>
              <i className="fa-solid fa-paper-plane" />
              Send
            </>
          )}
        </button>
      </div>

      <TabPanel
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
    </div>
  );
};
```

#### 3. Response Viewer Component
**File**: `src/components/ResponseViewer.tsx`

```tsx
import React, { useState, useMemo } from 'react';
import { usePluginStore } from '../store/pluginStore';
import { TabPanel } from './TabPanel';
import { ResponseBody } from './response/ResponseBody';
import { ResponseHeaders } from './response/ResponseHeaders';
import { ResponseCookies } from './response/ResponseCookies';
import { ResponseMeta } from './response/ResponseMeta';
import { formatBytes, formatDuration } from '../utils/format';

type ResponseTab = 'body' | 'headers' | 'cookies' | 'meta';

export const ResponseViewer: React.FC = () => {
  const { response, lastRequestDuration } = usePluginStore();
  const [activeTab, setActiveTab] = useState<ResponseTab>('body');

  const tabs = useMemo(() => [
    { id: 'body' as const, label: 'Body', component: ResponseBody },
    { id: 'headers' as const, label: 'Headers', component: ResponseHeaders },
    { id: 'cookies' as const, label: 'Cookies', component: ResponseCookies },
    { id: 'meta' as const, label: 'Meta', component: ResponseMeta },
  ], []);

  if (!response) {
    return (
      <div className="response-viewer empty">
        <div className="empty-state">
          <i className="fa-solid fa-cloud" />
          <p>Send a request to see the response</p>
        </div>
      </div>
    );
  }

  const statusClass = response.status >= 200 && response.status < 300 
    ? 'success' 
    : response.status >= 400 
    ? 'error' 
    : 'warning';

  return (
    <div className="response-viewer">
      <div className="response-header">
        <h2>Response</h2>
        <div className="response-stats">
          <span className={`status ${statusClass}`}>
            {response.status} {response.statusText}
          </span>
          <span className="time">
            <i className="fa-solid fa-clock" />
            {formatDuration(lastRequestDuration)}
          </span>
          <span className="size">
            <i className="fa-solid fa-download" />
            {formatBytes(response.size)}
          </span>
          {response.cached && (
            <span className="cached">
              <i className="fa-solid fa-database" />
              Cached
            </span>
          )}
        </div>
      </div>

      <TabPanel
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
    </div>
  );
};
```

#### 4. Zustand Store
**File**: `src/store/pluginStore.ts`

```typescript
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { 
  Request, 
  Response, 
  Collection, 
  Environment,
  PluginState 
} from '../types';

interface PluginStore extends PluginState {
  // Actions
  updateRequest: (partial: Partial<Request>) => void;
  setResponse: (response: Response | null) => void;
  addCollection: (collection: Collection) => void;
  updateCollection: (id: string, updates: Partial<Collection>) => void;
  deleteCollection: (id: string) => void;
  setActiveEnvironment: (id: string | null) => void;
  addToHistory: (item: HistoryItem) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
}

export const usePluginStore = create<PluginStore>()(
  devtools(
    persist(
      immer((set) => ({
        // Initial state
        request: {
          method: 'GET',
          url: '',
          headers: {},
          params: {},
          body: '',
          auth: { type: 'none' }
        },
        response: null,
        collections: [],
        environments: [],
        activeEnvironment: null,
        history: [],
        isLoading: false,
        error: null,
        settings: {
          timeout: 30000,
          followRedirects: true,
          validateSSL: true,
          enableCache: true,
          enableAI: false,
          theme: 'auto'
        },

        // Actions
        updateRequest: (partial) => set((state) => {
          Object.assign(state.request, partial);
        }),

        setResponse: (response) => set((state) => {
          state.response = response;
        }),

        addCollection: (collection) => set((state) => {
          state.collections.push(collection);
        }),

        updateCollection: (id, updates) => set((state) => {
          const index = state.collections.findIndex(c => c.id === id);
          if (index !== -1) {
            Object.assign(state.collections[index], updates);
          }
        }),

        deleteCollection: (id) => set((state) => {
          state.collections = state.collections.filter(c => c.id !== id);
        }),

        setActiveEnvironment: (id) => set((state) => {
          state.activeEnvironment = id;
        }),

        addToHistory: (item) => set((state) => {
          state.history.unshift(item);
          if (state.history.length > 50) {
            state.history = state.history.slice(0, 50);
          }
        }),

        setLoading: (loading) => set((state) => {
          state.isLoading = loading;
        }),

        setError: (error) => set((state) => {
          state.error = error;
        }),
      })),
      {
        name: 'apicarus-storage',
        partialize: (state) => ({
          collections: state.collections,
          environments: state.environments,
          history: state.history,
          settings: state.settings,
        }),
      }
    ),
    {
      name: 'Apicarus',
    }
  )
);
```

### Phase 3: React Hooks (8 hours)

#### 1. Request Hook
**File**: `src/hooks/useRequest.ts`

```typescript
import { useMutation } from '@tanstack/react-query';
import { usePluginStore } from '../store/pluginStore';
import { RequestService } from '../services/RequestService';
import type { Request, Response } from '../types';

export const useRequest = () => {
  const { 
    request, 
    activeEnvironment, 
    environments, 
    setResponse, 
    setLoading, 
    addToHistory 
  } = usePluginStore();

  const requestService = new RequestService();

  const mutation = useMutation<Response, Error, Request>({
    mutationFn: async (req: Request) => {
      // Apply environment variables
      const environment = environments.find(e => e.id === activeEnvironment);
      if (environment) {
        req = requestService.applyEnvironmentVariables(req, environment.variables);
      }

      // Send request
      return requestService.send(req);
    },
    onMutate: () => {
      setLoading(true);
      setResponse(null);
    },
    onSuccess: (response, req) => {
      setResponse(response);
      addToHistory({
        id: Date.now().toString(),
        request: req,
        response,
        timestamp: new Date(),
        duration: response.time
      });
    },
    onError: (error) => {
      console.error('Request failed:', error);
    },
    onSettled: () => {
      setLoading(false);
    },
  });

  return {
    sendRequest: (customRequest?: Request) => 
      mutation.mutate(customRequest || request),
    isLoading: mutation.isLoading,
    error: mutation.error,
  };
};
```

#### 2. Collections Hook
**File**: `src/hooks/useCollections.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePluginStore } from '../store/pluginStore';
import { CollectionService } from '../services/CollectionService';
import type { Collection } from '../types';

export const useCollections = () => {
  const queryClient = useQueryClient();
  const { addCollection, updateCollection, deleteCollection } = usePluginStore();
  
  const service = new CollectionService();

  // Load collections
  const { data: collections = [] } = useQuery({
    queryKey: ['collections'],
    queryFn: () => service.loadAll(),
    staleTime: Infinity,
  });

  // Create collection
  const createMutation = useMutation({
    mutationFn: (data: Partial<Collection>) => service.create(data),
    onSuccess: (collection) => {
      addCollection(collection);
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });

  // Update collection
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Collection> }) => 
      service.update(id, data),
    onSuccess: (collection) => {
      updateCollection(collection.id, collection);
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });

  // Delete collection
  const deleteMutation = useMutation({
    mutationFn: (id: string) => service.delete(id),
    onSuccess: (_, id) => {
      deleteCollection(id);
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });

  return {
    collections,
    createCollection: createMutation.mutate,
    updateCollection: updateMutation.mutate,
    deleteCollection: deleteMutation.mutate,
    isCreating: createMutation.isLoading,
    isUpdating: updateMutation.isLoading,
    isDeleting: deleteMutation.isLoading,
  };
};
```

### Phase 4: UI Components Library (8 hours)

#### 1. Design System Components
**File**: `src/components/ui/Button.tsx`

```tsx
import React from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: string;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  children,
  disabled,
  className,
  ...props
}) => {
  return (
    <button
      className={clsx(
        'btn',
        `btn-${variant}`,
        `btn-${size}`,
        loading && 'btn-loading',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <i className="fa-solid fa-spinner fa-spin" />
      ) : icon ? (
        <i className={icon} />
      ) : null}
      {children}
    </button>
  );
};
```

#### 2. Form Components
**File**: `src/components/ui/Input.tsx`

```tsx
import React, { forwardRef } from 'react';
import { clsx } from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: string;
  rightIcon?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, className, ...props }, ref) => {
    const id = props.id || props.name;

    return (
      <div className="form-group">
        {label && (
          <label htmlFor={id} className="form-label">
            {label}
          </label>
        )}
        <div className="input-wrapper">
          {leftIcon && (
            <span className="input-icon left">
              <i className={leftIcon} />
            </span>
          )}
          <input
            ref={ref}
            id={id}
            className={clsx(
              'form-input',
              error && 'input-error',
              leftIcon && 'has-icon-left',
              rightIcon && 'has-icon-right',
              className
            )}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
            {...props}
          />
          {rightIcon && (
            <span className="input-icon right">
              <i className={rightIcon} />
            </span>
          )}
        </div>
        {error && (
          <span id={`${id}-error`} className="form-error">
            {error}
          </span>
        )}
        {hint && !error && (
          <span id={`${id}-hint`} className="form-hint">
            {hint}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
```

#### 3. Modal Component
**File**: `src/components/ui/Modal.tsx`

```tsx
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  footer,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      modalRef.current?.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={modalRef}
        className={clsx('modal', `modal-${size}`)}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
      >
        <div className="modal-header">
          <h2 id="modal-title" className="modal-title">
            {title}
          </h2>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.getElementById('modal-root') || document.body
  );
};
```

### Phase 5: Migration of Existing Features (8 hours)

#### 1. Collection Manager React Component
**File**: `src/components/CollectionManager.tsx`

```tsx
import React, { useState } from 'react';
import { useCollections } from '../hooks/useCollections';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { CollectionList } from './CollectionList';
import { ImportExportDialog } from './ImportExportDialog';
import type { Collection } from '../types';

export const CollectionManager: React.FC = () => {
  const { collections, createCollection, deleteCollection } = useCollections();
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [isImportModalOpen, setImportModalOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDescription, setNewCollectionDescription] = useState('');

  const handleCreate = async () => {
    if (!newCollectionName.trim()) return;

    await createCollection({
      name: newCollectionName,
      description: newCollectionDescription,
    });

    setNewCollectionName('');
    setNewCollectionDescription('');
    setCreateModalOpen(false);
  };

  return (
    <div className="collection-manager">
      <div className="section-header">
        <h3>Collections</h3>
        <div className="actions">
          <Button
            size="sm"
            icon="fa-solid fa-plus"
            onClick={() => setCreateModalOpen(true)}
          >
            New
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon="fa-solid fa-file-import"
            onClick={() => setImportModalOpen(true)}
          >
            Import
          </Button>
        </div>
      </div>

      <CollectionList
        collections={collections}
        onDelete={deleteCollection}
      />

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Collection"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreate}
              disabled={!newCollectionName.trim()}
            >
              Create
            </Button>
          </>
        }
      >
        <Input
          label="Name"
          value={newCollectionName}
          onChange={(e) => setNewCollectionName(e.target.value)}
          placeholder="My API Collection"
          autoFocus
        />
        <Input
          label="Description"
          value={newCollectionDescription}
          onChange={(e) => setNewCollectionDescription(e.target.value)}
          placeholder="Optional description"
        />
      </Modal>

      <ImportExportDialog
        isOpen={isImportModalOpen}
        onClose={() => setImportModalOpen(false)}
      />
    </div>
  );
};
```

### Phase 6: Testing React Components (8 hours)

#### 1. Component Testing Setup
**File**: `tests/setup.tsx`

```tsx
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

// Mock Alexandria context
global.Alexandria = {
  ui: {
    showNotification: vi.fn(),
    showDialog: vi.fn(),
  },
  plugins: {
    get: vi.fn(),
  },
};
```

#### 2. Component Tests
**File**: `tests/components/RequestBuilder.test.tsx`

```tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RequestBuilder } from '@/components/RequestBuilder';
import { usePluginStore } from '@/store/pluginStore';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('RequestBuilder', () => {
  beforeEach(() => {
    usePluginStore.setState({
      request: {
        method: 'GET',
        url: '',
        headers: {},
        params: {},
        body: '',
        auth: { type: 'none' },
      },
    });
  });

  test('renders request builder interface', () => {
    render(<RequestBuilder />, { wrapper: createWrapper() });

    expect(screen.getByText('Request')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter request URL')).toBeInTheDocument();
    expect(screen.getByText('Send')).toBeInTheDocument();
  });

  test('updates method on selection', async () => {
    const user = userEvent.setup();
    render(<RequestBuilder />, { wrapper: createWrapper() });

    const methodSelect = screen.getByRole('combobox');
    await user.selectOptions(methodSelect, 'POST');

    const state = usePluginStore.getState();
    expect(state.request.method).toBe('POST');
  });

  test('updates URL and extracts parameters', async () => {
    const user = userEvent.setup();
    render(<RequestBuilder />, { wrapper: createWrapper() });

    const urlInput = screen.getByPlaceholderText('Enter request URL');
    await user.type(urlInput, 'https://api.example.com?key=value&foo=bar');

    const state = usePluginStore.getState();
    expect(state.request.url).toBe('https://api.example.com?key=value&foo=bar');
    expect(state.request.params).toEqual({
      key: 'value',
      foo: 'bar',
    });
  });

  test('disables send button when loading', () => {
    usePluginStore.setState({ isLoading: true });
    render(<RequestBuilder />, { wrapper: createWrapper() });

    const sendButton = screen.getByText('Sending...');
    expect(sendButton).toBeDisabled();
  });

  test('shows validation error for invalid URL', async () => {
    const user = userEvent.setup();
    render(<RequestBuilder />, { wrapper: createWrapper() });

    const urlInput = screen.getByPlaceholderText('Enter request URL');
    await user.type(urlInput, 'not a valid url');

    const sendButton = screen.getByText('Send');
    await user.click(sendButton);

    // Should show error notification or validation message
    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Validation error')
      );
    });
  });
});
```

### Phase 7: Style Migration (4 hours)

#### 1. CSS Modules
**File**: `src/styles/components/RequestBuilder.module.css`

```css
.container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
}

.title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.actions {
  display: flex;
  gap: 8px;
}

.urlBar {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
}

.methodSelector {
  width: 120px;
}

.urlInput {
  flex: 1;
}

.sendButton {
  min-width: 100px;
}

.tabs {
  flex: 1;
  overflow-y: auto;
}

/* Dark theme overrides */
:global(.theme-dark) .container {
  background: var(--color-bg-dark);
}

:global(.theme-dark) .urlBar {
  background: var(--color-bg-dark-secondary);
}
```

#### 2. Global Styles
**File**: `src/styles/main.css`

```css
/* Design tokens */
:root {
  /* Colors */
  --color-primary: #3b82f6;
  --color-primary-hover: #2563eb;
  --color-secondary: #6b7280;
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  
  /* Backgrounds */
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f9fafb;
  --color-bg-tertiary: #f3f4f6;
  
  /* Text */
  --color-text-primary: #111827;
  --color-text-secondary: #6b7280;
  --color-text-tertiary: #9ca3af;
  
  /* Borders */
  --color-border: #e5e7eb;
  --color-border-dark: #d1d5db;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
  
  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  
  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
  --transition-slow: 350ms ease;
}

/* Dark theme */
.theme-dark {
  --color-bg-primary: #1f2937;
  --color-bg-secondary: #111827;
  --color-bg-tertiary: #030712;
  
  --color-text-primary: #f9fafb;
  --color-text-secondary: #d1d5db;
  --color-text-tertiary: #9ca3af;
  
  --color-border: #374151;
  --color-border-dark: #1f2937;
}

/* Base styles */
* {
  box-sizing: border-box;
}

.apicarus-app {
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
}

/* Layout */
.app-layout {
  display: flex;
  height: 100%;
}

.sidebar {
  width: 280px;
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
  overflow-y: auto;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Components */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  outline: none;
}

.btn:focus-visible {
  box-shadow: 0 0 0 2px var(--color-primary);
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-secondary {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-bg-secondary);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Forms */
.form-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 14px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  transition: all var(--transition-fast);
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgb(59 130 246 / 0.1);
}

.form-input::placeholder {
  color: var(--color-text-tertiary);
}

/* Animations */
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slideUp {
  animation: slideUp var(--transition-normal) ease-out;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.fa-spin {
  animation: spin 1s linear infinite;
}
```

## Migration Benefits

1. **Component Reusability**: Share UI components across features
2. **Better State Management**: Zustand provides predictable state updates
3. **Performance**: React's virtual DOM and memoization
4. **Developer Experience**: Hot reload, React DevTools
5. **Testing**: Better testing utilities with React Testing Library
6. **Type Safety**: Full TypeScript support
7. **Ecosystem**: Access to React ecosystem (libraries, tools)

## Migration Strategy

1. **Incremental Migration**: Migrate one component at a time
2. **Parallel Development**: Keep vanilla JS version working during migration
3. **Feature Parity**: Ensure all features work in React version
4. **Performance Testing**: Compare performance metrics
5. **User Testing**: Get feedback on new UI

## Acceptance Criteria

- [ ] All components migrated to React
- [ ] State management with Zustand
- [ ] React Query for data fetching
- [ ] Component tests with RTL
- [ ] Performance equal or better
- [ ] Accessibility maintained
- [ ] Dark theme support
- [ ] Responsive design
- [ ] No regression in features
- [ ] Documentation updated

## Risks and Mitigation

1. **Bundle Size**: Mitigate with code splitting and lazy loading
2. **Learning Curve**: Provide React training/documentation
3. **Migration Time**: Use incremental approach
4. **Compatibility**: Ensure Alexandria platform supports React
5. **Performance**: Profile and optimize as needed