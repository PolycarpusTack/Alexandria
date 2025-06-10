/**
 * Core system interfaces for the Alexandria Platform
 *
 * These interfaces define the contracts that the core system and plugins must adhere to.
 * They provide stable APIs that won't change frequently to ensure backward compatibility.
 */
/**
 * Represents a request from a client to the system
 */
export interface Request {
    path: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    params: Record<string, string>;
    query: Record<string, string>;
    body: any;
    headers: Record<string, string>;
    user?: User;
}
/**
 * Represents a response from the system to a client
 */
export interface Response {
    status: number;
    body: any;
    headers: Record<string, string>;
    send: (data: any) => void;
    json: (data: any) => void;
    setStatus: (code: number) => Response;
    setHeader: (name: string, value: string) => Response;
}
/**
 * Represents a handler for processing requests
 */
export interface RequestHandler {
    handle: (request: Request, response: Response, next: () => void) => void | Promise<void>;
}
/**
 * Represents a route in the system
 */
export interface Route {
    path: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    handler: RequestHandler | RequestHandler[];
    permissions?: string[];
}
/**
 * Represents a user in the system
 */
export interface User {
    id: string;
    username: string;
    email: string;
    roles: string[];
    permissions: string[];
    metadata?: {
        passwordHash?: string;
        [key: string]: unknown;
    };
    isActive: boolean;
    hashedPassword?: string;
    createdAt?: Date;
    updatedAt?: Date;
    lastLoginAt?: Date;
    failedLoginAttempts?: number;
    lockedUntil?: Date;
}
/**
 * Represents a case in the customer care system
 */
export interface Case {
    id: string;
    title: string;
    description: string;
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    priority: 'low' | 'medium' | 'high' | 'critical';
    createdAt: Date;
    updatedAt: Date;
    assignedTo?: string;
    createdBy: string;
    tags: string[];
    metadata?: Record<string, any>;
}
/**
 * Represents a log entry in the system
 */
export interface LogEntry {
    id: string;
    timestamp: Date;
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
    message: string;
    context: Record<string, any>;
    source: string;
}
/**
 * Core system service interface
 */
export interface CoreSystem {
    initialize: () => Promise<void>;
    shutdown: () => Promise<void>;
    registerRoute: (route: Route) => void;
    removeRoute: (path: string, method: string) => void;
    getUserById: (id: string) => Promise<User | null>;
    getUserByUsername: (username: string) => Promise<User | null>;
    saveUser: (user: User) => Promise<User>;
    getCaseById: (id: string) => Promise<Case | null>;
    authenticate: (credentials: {
        username: string;
        password: string;
    }) => Promise<User | null>;
    authorize: (user: User, permission: string) => boolean;
    log: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
}
/**
 * UI Component registration interface
 */
export interface UIComponent {
    id: string;
    type: 'navigation' | 'content' | 'widget' | 'modal';
    position?: 'header' | 'sidebar' | 'main' | 'footer';
    component: any;
    props?: Record<string, any>;
    permissions?: string[];
}
/**
 * UI Shell interface for registering components
 */
export interface UIShell {
    registerComponent: (component: UIComponent) => void;
    unregisterComponent: (id: string) => void;
    getComponentsByType: (type: UIComponent['type']) => UIComponent[];
    getComponentsByPosition: (position: UIComponent['position']) => UIComponent[];
}
