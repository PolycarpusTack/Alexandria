# TASK-008: TypeScript Migration

**Priority**: P2 - Medium  
**Estimated Time**: 24-32 hours  
**Assignee**: _________________  
**Status**: [ ] Not Started

## Overview
Migrate the codebase from JavaScript to TypeScript for better type safety, IDE support, and maintainability.

## Migration Strategy

### Phase 1: Setup and Configuration (4 hours)

#### 1. Install Dependencies
```bash
npm install --save-dev typescript @types/node @types/jest
npm install --save-dev @typescript-eslint/parser @typescript-eslint/eslint-plugin
npm install --save-dev ts-jest @types/jest
```

#### 2. TypeScript Configuration
**File**: `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "allowJs": true,
    "checkJs": true,
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@alexandria/shared": ["node_modules/@alexandria/shared/dist"]
    }
  },
  "include": [
    "src/**/*",
    "index.ts",
    "tests/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "coverage"
  ]
}
```

#### 3. Update Build Configuration
**File**: `webpack.config.ts`

```typescript
import path from 'path';
import { Configuration } from 'webpack';

const config: Configuration = {
  mode: 'production',
  entry: './index.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'apicarus.bundle.js',
    library: {
      type: 'module'
    }
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  externals: {
    '@alexandria/shared': '@alexandria/shared'
  }
};

export default config;
```

### Phase 2: Type Definitions (8 hours)

#### 1. Core Types
**File**: `src/types/index.ts`

```typescript
// HTTP Types
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export interface Request {
  method: HTTPMethod;
  url: string;
  headers: Record<string, string>;
  params: Record<string, string>;
  body?: string | object;
  auth?: AuthConfig;
  timeout?: number;
}

export interface Response {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  size: number;
  time: number;
  cached?: boolean;
}

// Auth Types
export type AuthType = 'none' | 'bearer' | 'basic' | 'api-key';

export interface AuthConfig {
  type: AuthType;
  credentials?: BearerAuth | BasicAuth | ApiKeyAuth;
}

export interface BearerAuth {
  token: string;
}

export interface BasicAuth {
  username: string;
  password: string;
}

export interface ApiKeyAuth {
  key: string;
  value: string;
  location: 'header' | 'query';
}

// Collection Types
export interface Collection {
  id: string;
  name: string;
  description?: string;
  requests: SavedRequest[];
  variables?: Record<string, any>;
  sharing?: SharingConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface SavedRequest extends Request {
  id: string;
  name: string;
  description?: string;
  collectionId: string;
}

export interface SharingConfig {
  visibility: 'private' | 'team' | 'public';
  teamIds?: string[];
  permissions?: Permission[];
}

// Environment Types
export interface Environment {
  id: string;
  name: string;
  variables: Record<string, string>;
  active: boolean;
}

// History Types
export interface HistoryItem {
  id: string;
  request: Request;
  response?: Response;
  timestamp: Date;
  duration?: number;
}

// UI Types
export interface UIState {
  activeTab: TabType;
  isLoading: boolean;
  error: Error | null;
  activePanel: PanelType;
}

export type TabType = 'params' | 'headers' | 'body' | 'auth';
export type PanelType = 'main' | 'sidebar' | 'settings';

// Plugin Types
export interface PluginState {
  request: Request;
  ui: UIState;
  collections: Collection[];
  environments: Environment[];
  history: HistoryItem[];
  response: Response | null;
  settings: Settings;
}

export interface Settings {
  timeout: number;
  followRedirects: boolean;
  validateSSL: boolean;
  enableCache: boolean;
  enableAI: boolean;
  theme: 'light' | 'dark' | 'auto';
}
```

#### 2. Alexandria Platform Types
**File**: `src/types/alexandria.d.ts`

```typescript
declare module '@alexandria/shared' {
  export interface PluginContext {
    ui: UIService;
    dataService: DataService;
    aiService: AIService;
    apiService: APIService;
    logger: Logger;
    permissions: PermissionService;
  }

  export interface PluginLifecycle {
    onActivate(context: PluginContext): Promise<void>;
    onDeactivate(): Promise<void>;
    onUpdate?(previousVersion: string): Promise<void>;
    onUninstall?(): Promise<void>;
  }

  export interface UIService {
    registerPanel(config: PanelConfig): void;
    registerCommand(config: CommandConfig): void;
    showNotification(notification: Notification): void;
    showDialog(dialog: DialogConfig): Promise<any>;
  }

  export interface DataService {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T): Promise<void>;
    remove(key: string): Promise<void>;
    clear(): Promise<void>;
  }

  export interface AIService {
    generateText(prompt: string, options?: AIOptions): Promise<string>;
    analyzeCode(code: string): Promise<CodeAnalysis>;
  }

  export interface Logger {
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
    debug(message: string, ...args: any[]): void;
  }
}
```

### Phase 3: Component Migration (12 hours)

#### 1. Main Plugin Class
**File**: `index.ts`

```typescript
import { PluginLifecycle, PluginContext } from '@alexandria/shared';
import { 
  Request, 
  Response, 
  Collection, 
  Environment, 
  HistoryItem,
  PluginState 
} from './src/types';
import { RequestBuilder } from './src/components/RequestBuilder';
import { ResponseViewer } from './src/components/ResponseViewer';
import { CollectionManager } from './src/components/CollectionManager';
import { Store } from './src/store/Store';

export default class ApicarusPlugin implements PluginLifecycle {
  public readonly name = 'Apicarus';
  public readonly version = '1.0.0';
  
  private context!: PluginContext;
  private store!: Store<PluginState>;
  private requestBuilder!: RequestBuilder;
  private responseViewer!: ResponseViewer;
  private collectionManager!: CollectionManager;
  private isReady = false;
  
  async onActivate(context: PluginContext): Promise<void> {
    this.context = context;
    
    try {
      await this.initialize();
      this.isReady = true;
    } catch (error) {
      this.context.logger.error('Failed to activate plugin', error);
      throw error;
    }
  }
  
  async onDeactivate(): Promise<void> {
    try {
      await this.cleanup();
      this.isReady = false;
    } catch (error) {
      this.context.logger.error('Failed to deactivate plugin', error);
    }
  }
  
  private async initialize(): Promise<void> {
    // Initialize store
    const savedState = await this.loadState();
    this.store = new Store<PluginState>(savedState);
    
    // Initialize components
    this.requestBuilder = new RequestBuilder(this.store, this.context);
    this.responseViewer = new ResponseViewer(this.store, this.context);
    this.collectionManager = new CollectionManager(this.store, this.context);
    
    // Register UI
    await this.registerUI();
    
    // Setup listeners
    this.setupEventListeners();
  }
  
  private async loadState(): Promise<Partial<PluginState>> {
    const saved = await this.context.dataService.get<Partial<PluginState>>('apicarus_state');
    return saved || {};
  }
  
  public async sendRequest(request?: Request): Promise<Response> {
    const requestToSend = request || this.store.getState().request;
    
    // Validate
    this.validateRequest(requestToSend);
    
    // Update UI
    this.store.dispatch({
      type: 'SET',
      path: 'ui.isLoading',
      value: true
    });
    
    try {
      const response = await this.executeRequest(requestToSend);
      
      // Update state
      this.store.dispatch({
        type: 'SET',
        path: 'response',
        value: response
      });
      
      // Add to history
      this.addToHistory(requestToSend, response);
      
      return response;
    } catch (error) {
      this.handleError(error);
      throw error;
    } finally {
      this.store.dispatch({
        type: 'SET',
        path: 'ui.isLoading',
        value: false
      });
    }
  }
  
  private validateRequest(request: Request): void {
    if (!request.url) {
      throw new Error('URL is required');
    }
    
    if (!this.isValidUrl(request.url)) {
      throw new Error('Invalid URL format');
    }
  }
  
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}
```

#### 2. Component Base Class
**File**: `src/components/Component.ts`

```typescript
import { Store } from '../store/Store';
import { PluginContext } from '@alexandria/shared';

export abstract class Component<T = any> {
  protected store: Store<T>;
  protected context: PluginContext;
  private subscriptions: (() => void)[] = [];
  
  constructor(store: Store<T>, context: PluginContext) {
    this.store = store;
    this.context = context;
  }
  
  protected subscribe(path: string, callback: (change: any) => void): void {
    const unsubscribe = this.store.subscribe(path, callback);
    this.subscriptions.push(unsubscribe);
  }
  
  public destroy(): void {
    this.subscriptions.forEach(unsub => unsub());
    this.subscriptions = [];
  }
  
  protected abstract render(): string;
  
  public mount(container: HTMLElement | string): void {
    const element = typeof container === 'string' 
      ? document.getElementById(container) 
      : container;
      
    if (!element) {
      throw new Error('Container not found');
    }
    
    element.innerHTML = this.render();
    this.afterMount(element);
  }
  
  protected afterMount(element: HTMLElement): void {
    // Override in subclasses
  }
}
```

#### 3. RequestBuilder Component
**File**: `src/components/RequestBuilder.ts`

```typescript
import { Component } from './Component';
import { PluginState, Request, HTTPMethod } from '../types';
import { ValidationUtils } from '../utils/validation';

export class RequestBuilder extends Component<PluginState> {
  private activeTab: 'params' | 'headers' | 'body' | 'auth' = 'params';
  
  protected render(): string {
    const request = this.store.getState().request;
    
    return `
      <div class="request-builder">
        ${this.renderMethodAndUrl(request)}
        ${this.renderTabs()}
        ${this.renderTabContent(request)}
      </div>
    `;
  }
  
  private renderMethodAndUrl(request: Request): string {
    return `
      <div class="request-input-group">
        <select id="method-select" value="${request.method}">
          ${this.renderMethodOptions(request.method)}
        </select>
        <input 
          type="text" 
          id="url-input"
          value="${request.url}"
          placeholder="Enter request URL"
        />
        <button id="send-button" class="btn-primary">Send</button>
      </div>
    `;
  }
  
  private renderMethodOptions(selected: HTTPMethod): string {
    const methods: HTTPMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
    
    return methods
      .map(method => `
        <option value="${method}" ${method === selected ? 'selected' : ''}>
          ${method}
        </option>
      `)
      .join('');
  }
  
  protected afterMount(element: HTMLElement): void {
    // Attach event listeners
    const methodSelect = element.querySelector<HTMLSelectElement>('#method-select');
    const urlInput = element.querySelector<HTMLInputElement>('#url-input');
    const sendButton = element.querySelector<HTMLButtonElement>('#send-button');
    
    methodSelect?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.updateMethod(target.value as HTTPMethod);
    });
    
    urlInput?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      this.updateUrl(target.value);
    });
    
    sendButton?.addEventListener('click', () => {
      this.sendRequest();
    });
    
    // Subscribe to state changes
    this.subscribe('request', () => {
      this.mount(element);
    });
  }
  
  private updateMethod(method: HTTPMethod): void {
    this.store.dispatch({
      type: 'UPDATE',
      path: 'request',
      value: { method }
    });
  }
  
  private updateUrl(url: string): void {
    this.store.dispatch({
      type: 'UPDATE',
      path: 'request',
      value: { url }
    });
    
    // Parse and extract params
    this.parseUrlParams(url);
  }
  
  private parseUrlParams(url: string): void {
    try {
      const urlObj = new URL(url);
      const params: Record<string, string> = {};
      
      urlObj.searchParams.forEach((value, key) => {
        params[key] = value;
      });
      
      this.store.dispatch({
        type: 'UPDATE',
        path: 'request',
        value: { params }
      });
    } catch {
      // Invalid URL, ignore
    }
  }
  
  private async sendRequest(): Promise<void> {
    const plugin = (window as any).Alexandria.plugins.get('apicarus');
    await plugin.sendRequest();
  }
}
```

### Phase 4: Testing Migration (4 hours)

#### 1. Update Jest Configuration
**File**: `jest.config.ts`

```typescript
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@alexandria/shared$': '<rootDir>/tests/mocks/alexandria.ts'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    'index.ts',
    '!src/**/*.test.ts',
    '!src/**/*.d.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};

export default config;
```

#### 2. Test File Migration
**File**: `tests/components/RequestBuilder.test.ts`

```typescript
import { RequestBuilder } from '@/components/RequestBuilder';
import { Store } from '@/store/Store';
import { PluginState } from '@/types';
import { mockPluginContext } from '../mocks/alexandria';

describe('RequestBuilder', () => {
  let component: RequestBuilder;
  let store: Store<PluginState>;
  let container: HTMLDivElement;
  
  beforeEach(() => {
    store = new Store<PluginState>({
      request: {
        method: 'GET',
        url: '',
        headers: {},
        params: {}
      }
    } as PluginState);
    
    container = document.createElement('div');
    document.body.appendChild(container);
    
    component = new RequestBuilder(store, mockPluginContext());
  });
  
  afterEach(() => {
    component.destroy();
    document.body.removeChild(container);
  });
  
  test('should render method select', () => {
    component.mount(container);
    
    const select = container.querySelector<HTMLSelectElement>('#method-select');
    expect(select).toBeTruthy();
    expect(select?.value).toBe('GET');
  });
  
  test('should update method on change', () => {
    component.mount(container);
    
    const select = container.querySelector<HTMLSelectElement>('#method-select');
    if (!select) throw new Error('Select not found');
    
    select.value = 'POST';
    select.dispatchEvent(new Event('change'));
    
    expect(store.getState().request.method).toBe('POST');
  });
  
  test('should parse URL parameters', () => {
    component.mount(container);
    
    const input = container.querySelector<HTMLInputElement>('#url-input');
    if (!input) throw new Error('Input not found');
    
    input.value = 'https://api.example.com?key=value&foo=bar';
    input.dispatchEvent(new Event('input'));
    
    const state = store.getState();
    expect(state.request.params).toEqual({
      key: 'value',
      foo: 'bar'
    });
  });
});
```

### Phase 5: Utility Migration (4 hours)

#### 1. Validation Utils
**File**: `src/utils/validation.ts`

```typescript
import { Request, Response } from '../types';

export class ValidationUtils {
  private static readonly URL_PATTERN = /^https?:\/\/.+/;
  private static readonly HEADER_NAME_PATTERN = /^[\w-]+$/;
  
  static isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }
  
  static isValidHeaderName(name: string): boolean {
    return this.HEADER_NAME_PATTERN.test(name);
  }
  
  static isValidHeaderValue(value: string): boolean {
    return !/[\r\n]/.test(value);
  }
  
  static validateRequest(request: Request): string[] {
    const errors: string[] = [];
    
    if (!request.url) {
      errors.push('URL is required');
    } else if (!this.isValidUrl(request.url)) {
      errors.push('Invalid URL format');
    }
    
    if (request.headers) {
      Object.entries(request.headers).forEach(([key, value]) => {
        if (!this.isValidHeaderName(key)) {
          errors.push(`Invalid header name: ${key}`);
        }
        if (!this.isValidHeaderValue(value)) {
          errors.push(`Invalid header value for ${key}`);
        }
      });
    }
    
    return errors;
  }
  
  static validateJson(json: string): { valid: boolean; error?: string } {
    try {
      JSON.parse(json);
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Invalid JSON' 
      };
    }
  }
}
```

#### 2. Error Classes
**File**: `src/utils/errors.ts`

```typescript
export abstract class ApicarusError extends Error {
  public readonly code: string;
  public readonly details: Record<string, any>;
  public readonly timestamp: Date;
  
  constructor(message: string, code: string, details: Record<string, any> = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.timestamp = new Date();
    
    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

export class NetworkError extends ApicarusError {
  constructor(message: string, details: Record<string, any> = {}) {
    super(message, 'NETWORK_ERROR', details);
  }
}

export class ValidationError extends ApicarusError {
  public readonly field?: string;
  public readonly value?: any;
  
  constructor(message: string, field?: string, value?: any) {
    super(message, 'VALIDATION_ERROR', { field, value });
    this.field = field;
    this.value = value;
  }
}

export class AuthenticationError extends ApicarusError {
  constructor(message: string, details: Record<string, any> = {}) {
    super(message, 'AUTH_ERROR', details);
  }
}

export class TimeoutError extends ApicarusError {
  public readonly timeout: number;
  
  constructor(message: string, timeout: number) {
    super(message, 'TIMEOUT_ERROR', { timeout });
    this.timeout = timeout;
  }
}
```

### Phase 6: Store Migration (4 hours)

**File**: `src/store/Store.ts`

```typescript
export interface Action {
  type: 'SET' | 'UPDATE' | 'DELETE' | 'PUSH' | 'REMOVE' | 'RESET';
  path?: string;
  value?: any;
  id?: string | number;
  state?: any;
}

export interface Change<T = any> {
  action: Action;
  prevValue: T;
  nextValue: T;
  state: T;
}

export type Listener<T = any> = (change: Change<T>) => void;
export type Middleware<T = any> = (action: Action, state: T) => Action | null;

export class Store<T extends Record<string, any>> {
  private state: T;
  private listeners = new Map<string, Set<Listener>>();
  private middleware: Middleware<T>[] = [];
  private history: Change<T>[] = [];
  private readonly maxHistory = 50;
  
  constructor(initialState: T) {
    this.state = this.deepClone(initialState);
  }
  
  getState(): T {
    return this.deepClone(this.state);
  }
  
  get<K extends keyof T>(key: K): T[K] {
    return this.deepClone(this.state[key]);
  }
  
  dispatch(action: Action): void {
    const prevState = this.deepClone(this.state);
    
    // Run middleware
    let nextAction: Action | null = action;
    for (const mw of this.middleware) {
      nextAction = mw(nextAction, this.getState());
      if (!nextAction) return;
    }
    
    // Apply action
    this.state = this.reducer(this.state, nextAction);
    
    // Record history
    this.addToHistory(nextAction, prevState);
    
    // Notify listeners
    this.notify(nextAction, prevState);
  }
  
  subscribe(path: string, listener: Listener): () => void {
    if (!this.listeners.has(path)) {
      this.listeners.set(path, new Set());
    }
    
    this.listeners.get(path)!.add(listener);
    
    return () => {
      const pathListeners = this.listeners.get(path);
      if (pathListeners) {
        pathListeners.delete(listener);
        if (pathListeners.size === 0) {
          this.listeners.delete(path);
        }
      }
    };
  }
  
  use(middleware: Middleware<T>): void {
    this.middleware.push(middleware);
  }
  
  private reducer(state: T, action: Action): T {
    switch (action.type) {
      case 'SET':
        if (!action.path) return state;
        return this.setByPath(state, action.path, action.value);
        
      case 'UPDATE':
        if (!action.path) return state;
        const current = this.getByPath(state, action.path);
        return this.setByPath(state, action.path, { ...current, ...action.value });
        
      case 'DELETE':
        if (!action.path) return state;
        return this.deleteByPath(state, action.path);
        
      case 'RESET':
        return action.state || {} as T;
        
      default:
        return state;
    }
  }
  
  private getByPath(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => 
      current?.[key], obj
    );
  }
  
  private setByPath(obj: T, path: string, value: any): T {
    const keys = path.split('.');
    const newObj = this.deepClone(obj);
    
    let current: any = newObj;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key]) {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
    return newObj;
  }
  
  private deleteByPath(obj: T, path: string): T {
    const keys = path.split('.');
    const newObj = this.deepClone(obj);
    
    let current: any = newObj;
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
      if (!current) return newObj;
    }
    
    delete current[keys[keys.length - 1]];
    return newObj;
  }
  
  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
  
  private notify(action: Action, prevState: T): void {
    const change: Change<T> = {
      action,
      prevValue: prevState,
      nextValue: this.state,
      state: this.getState()
    };
    
    // Notify global listeners
    this.notifyPath('*', change);
    
    // Notify path-specific listeners
    if (action.path) {
      this.notifyPath(action.path, change);
    }
  }
  
  private notifyPath(path: string, change: Change<T>): void {
    const listeners = this.listeners.get(path);
    if (listeners) {
      listeners.forEach(listener => listener(change));
    }
  }
  
  private addToHistory(action: Action, prevState: T): void {
    this.history.push({
      action,
      prevValue: prevState,
      nextValue: this.state,
      state: this.getState()
    });
    
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }
  
  getHistory(): ReadonlyArray<Change<T>> {
    return [...this.history];
  }
}
```

## Migration Checklist

- [ ] TypeScript configuration setup
- [ ] Build tools updated
- [ ] Type definitions created
- [ ] Main plugin class migrated
- [ ] All components migrated
- [ ] Utilities migrated
- [ ] Store migrated
- [ ] Tests migrated
- [ ] Documentation updated
- [ ] CI/CD updated
- [ ] No `any` types (except where necessary)
- [ ] Strict mode enabled
- [ ] All tests passing

## Benefits of Migration

1. **Type Safety**: Catch errors at compile time
2. **Better IDE Support**: Autocomplete, refactoring
3. **Self-documenting**: Types serve as documentation
4. **Easier Refactoring**: Type system helps with changes
5. **Better Collaboration**: Clear contracts between components

## Common Migration Issues

1. **Implicit any**: Enable `noImplicitAny` and fix all instances
2. **Null checks**: Enable `strictNullChecks` and handle nulls
3. **Type assertions**: Avoid using `as` excessively
4. **Module resolution**: Update import paths
5. **Build time**: TypeScript compilation adds time

## Next Steps

1. Start with type definitions
2. Migrate utilities first (pure functions)
3. Then components (one at a time)
4. Finally the main plugin
5. Update tests as you go
6. Enable strict mode gradually