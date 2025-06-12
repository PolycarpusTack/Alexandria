/**
 * Security Service interfaces for the Alexandria Platform
 *
 * These interfaces define the security services including authentication,
 * authorization, data encryption, and audit logging.
 */

import { User } from '../system/interfaces';

/**
 * Login credentials
 */
export interface Credentials {
  username: string;
  password: string;
}

/**
 * Authentication token payload
 */
export interface TokenPayload {
  userId: string;
  username: string;
  roles: string[];
  permissions: string[];
  exp: number; // Expiration timestamp
  iat: number; // Issued at timestamp
}

/**
 * Authentication result
 */
export interface AuthResult {
  user: User;
  token: string;
  refreshToken?: string;
  expiresIn: number; // in seconds
}

/**
 * Authentication Service interface
 */
export interface AuthenticationService {
  /**
   * Initialize authentication service
   */
  initialize(): Promise<void>;

  /**
   * Authenticate a user with username and password
   */
  authenticate(credentials: Credentials): Promise<AuthResult>;

  /**
   * Validate an authentication token
   */
  validateToken(token: string): Promise<TokenPayload>;

  /**
   * Refresh an authentication token
   */
  refreshToken(refreshToken: string): Promise<AuthResult>;

  /**
   * Invalidate a token (logout)
   */
  invalidateToken(token: string): Promise<boolean>;

  /**
   * Register a new user
   */
  registerUser(userData: {
    username: string;
    email: string;
    password: string;
    roles?: string[];
  }): Promise<User>;

  /**
   * Change a user's password
   */
  changePassword(userId: string, oldPassword: string, newPassword: string): Promise<boolean>;

  /**
   * Reset a user's password (admin function)
   */
  resetPassword(userId: string, newPassword: string): Promise<boolean>;

  /**
   * Hash a password
   */
  hashPassword(password: string): Promise<string>;

  /**
   * Compare a password with a hash
   */
  comparePassword(password: string, hash: string): Promise<boolean>;

  /**
   * Destroy the authentication service and clean up resources
   */
  destroy?(): void;

  /**
   * Check if the service is properly initialized
   */
  isServiceInitialized?(): boolean;
}

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  granted: boolean;
  reason?: string;
}

/**
 * Authorization Service interface
 */
export interface AuthorizationService {
  /**
   * Initialize authorization service
   */
  initialize(): Promise<void>;

  /**
   * Check if a user has a specific permission
   */
  hasPermission(user: User, permission: string): PermissionCheckResult;

  /**
   * Check if a user has any of the specified permissions
   */
  hasAnyPermission(user: User, permissions: string[]): PermissionCheckResult;

  /**
   * Check if a user has all of the specified permissions
   */
  hasAllPermissions(user: User, permissions: string[]): PermissionCheckResult;

  /**
   * Check if a user has a specific role
   */
  hasRole(user: User, role: string): PermissionCheckResult;

  /**
   * Get all permissions for a specific role
   */
  getPermissionsForRole(role: string): Promise<string[]>;

  /**
   * Set permissions for a role
   */
  setPermissionsForRole(role: string, permissions: string[]): Promise<boolean>;

  /**
   * Get all available roles
   */
  getAllRoles(): Promise<{ role: string; permissions: string[] }[]>;

  /**
   * Get all available permissions
   */
  getAllPermissions(): Promise<string[]>;
}

/**
 * Encryption options
 */
export interface EncryptionOptions {
  algorithm?: string;
  keySize?: number;
}

/**
 * Encrypted data
 */
export interface EncryptedData {
  data: string; // Base64-encoded encrypted data
  iv: string; // Base64-encoded initialization vector
  authTag?: string; // Base64-encoded authentication tag (for GCM mode)
}

/**
 * Encryption Service interface
 */
export interface EncryptionService {
  /**
   * Initialize encryption service
   */
  initialize(): Promise<void>;

  /**
   * Encrypt data
   */
  encrypt(data: string | object, options?: EncryptionOptions): Promise<EncryptedData>;

  /**
   * Decrypt data
   */
  decrypt(encryptedData: EncryptedData): Promise<string>;

  /**
   * Generate a secure random string
   */
  generateSecureToken(length: number): string;

  /**
   * Hash data (one-way)
   */
  hash(data: string): Promise<string>;

  /**
   * Verify a hash
   */
  verifyHash(data: string, hash: string): Promise<boolean>;
}

/**
 * Audit event types
 */
export enum AuditEventType {
  USER_LOGIN = 'user.login',
  USER_LOGOUT = 'user.logout',
  USER_CREATED = 'user.created',
  USER_UPDATED = 'user.updated',
  USER_DELETED = 'user.deleted',
  PERMISSION_GRANTED = 'permission.granted',
  PERMISSION_REVOKED = 'permission.revoked',
  CASE_CREATED = 'case.created',
  CASE_UPDATED = 'case.updated',
  CASE_DELETED = 'case.deleted',
  PLUGIN_INSTALLED = 'plugin.installed',
  PLUGIN_ACTIVATED = 'plugin.activated',
  PLUGIN_DEACTIVATED = 'plugin.deactivated',
  PLUGIN_UNINSTALLED = 'plugin.uninstalled',
  SYSTEM_ERROR = 'system.error',
  DATA_EXPORTED = 'data.exported',
  SETTINGS_CHANGED = 'settings.changed'
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  type: AuditEventType;
  user: {
    id: string;
    username: string;
  } | null;
  action: string;
  resource: {
    type: string;
    id: string;
  };
  details: Record<string, any>;
  ip?: string;
  userAgent?: string;
  status: 'success' | 'failure';
  reason?: string;
}

/**
 * Audit Service interface
 */
export interface AuditService {
  /**
   * Initialize audit service
   */
  initialize(): Promise<void>;

  /**
   * Log an audit event
   */
  logEvent(event: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<AuditLogEntry>;

  /**
   * Search audit logs
   */
  searchLogs(options: {
    from?: Date;
    to?: Date;
    types?: AuditEventType[];
    userId?: string;
    resourceType?: string;
    resourceId?: string;
    status?: 'success' | 'failure';
    limit?: number;
    offset?: number;
  }): Promise<AuditLogEntry[]>;

  /**
   * Get audit logs for a specific resource
   */
  getLogsForResource(resourceType: string, resourceId: string): Promise<AuditLogEntry[]>;

  /**
   * Get audit logs for a specific user
   */
  getLogsForUser(userId: string): Promise<AuditLogEntry[]>;

  /**
   * Get audit log count
   */
  getLogCount(options?: {
    from?: Date;
    to?: Date;
    types?: AuditEventType[];
    userId?: string;
    resourceType?: string;
    resourceId?: string;
    status?: 'success' | 'failure';
  }): Promise<number>;
}

/**
 * Input validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Input validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validation rule
 */
export interface ValidationRule {
  type: 'required' | 'minLength' | 'maxLength' | 'pattern' | 'enum' | 'custom';
  message: string;
  params?: Record<string, any>;
  validate: (value: any, context?: Record<string, any>) => boolean;
}

/**
 * Validation schema
 */
export interface ValidationSchema {
  [field: string]: ValidationRule[];
}

/**
 * Input Validation Service interface
 */
export interface ValidationService {
  /**
   * Initialize validation service
   */
  initialize(): Promise<void>;

  /**
   * Validate input data against a schema
   */
  validate(data: Record<string, any>, schema: ValidationSchema): ValidationResult;

  /**
   * Sanitize input data
   */
  sanitize(
    data: Record<string, any>,
    options?: {
      allowHtml?: boolean;
      allowScripts?: boolean;
      allowIframes?: boolean;
      allowedTags?: string[];
      allowedAttributes?: Record<string, string[]>;
    }
  ): Record<string, any>;

  /**
   * Create a validation schema
   */
  createSchema(schema: Record<string, any>): ValidationSchema;

  /**
   * Get common validation rules
   */
  getRules(): Record<string, (params?: any) => ValidationRule>;
}

/**
 * Security Service that combines all security services
 */
export interface SecurityService {
  /**
   * Authentication service
   */
  authentication: AuthenticationService;

  /**
   * Authorization service
   */
  authorization: AuthorizationService;

  /**
   * Encryption service
   */
  encryption: EncryptionService;

  /**
   * Audit service
   */
  audit: AuditService;

  /**
   * Validation service
   */
  validation: ValidationService;

  /**
   * Initialize security service
   */
  initialize(): Promise<void>;
}
