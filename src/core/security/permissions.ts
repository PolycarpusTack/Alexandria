/**
 * Permission definitions for the Alexandria Platform
 *
 * This file contains all permission constants and categories used throughout the platform.
 */

/**
 * Comprehensive permission categories
 */
export const PERMISSION_CATEGORIES = {
  // Core permissions
  PLUGIN: [
    'plugin:install',
    'plugin:uninstall',
    'plugin:activate',
    'plugin:deactivate',
    'plugin:configure',
    'plugin:list',
    'plugin:read'
  ],

  // Database permissions
  DATABASE: [
    'database:access', // Basic database access
    'database:read', // Read operations
    'database:write', // Write operations
    'database:delete', // Delete operations
    'database:schema' // Schema modifications
  ],

  // Event system permissions
  EVENT: [
    'event:publish', // Publish events
    'event:subscribe', // Subscribe to events
    'event:list', // List available events
    'event:history' // View event history
  ],

  // AI/ML permissions
  AI: [
    'ml:execute', // Execute ML models
    'ml:train', // Train models
    'ml:manage', // Manage models
    'code:generate', // Generate code
    'code:analyze' // Analyze code
  ],

  // Project permissions
  PROJECT: [
    'project:analyze', // Analyze projects
    'project:read', // Read project data
    'project:write', // Modify projects
    'project:create', // Create projects
    'project:delete' // Delete projects
  ],

  // Template permissions
  TEMPLATE: [
    'template:manage', // Full template management
    'template:create', // Create templates
    'template:read', // Read templates
    'template:write', // Modify templates
    'template:delete' // Delete templates
  ],

  // Network permissions
  NETWORK: [
    'network:access', // Basic network access
    'network:external', // External API calls
    'network:internal' // Internal service calls
  ],

  // Analytics permissions
  ANALYTICS: [
    'analytics:read', // Read analytics data
    'analytics:write', // Write analytics data
    'analytics:export', // Export analytics
    'analytics:manage' // Manage analytics settings
  ],

  // Case management permissions (existing)
  CASE: ['read:cases', 'write:cases', 'delete:cases', 'export:cases'],

  // User management permissions (existing)
  USER: ['read:users', 'write:users', 'delete:users', 'read:profile', 'write:profile'],

  // System permissions (existing)
  SYSTEM: ['read:logs', 'read:reports', 'write:reports', 'read:public', 'manage:settings']
} as const;

/**
 * Flatten all permissions into a single array
 */
export const ALL_PERMISSIONS = Object.values(PERMISSION_CATEGORIES).flat();

/**
 * Default role permissions mapping
 */
export const ROLE_PERMISSIONS = {
  admin: ['*'], // Admin has all permissions

  user: [
    ...PERMISSION_CATEGORIES.PLUGIN,
    'database:read',
    'event:publish',
    'event:subscribe',
    'project:read',
    'template:read',
    'analytics:read',
    'read:cases',
    'write:cases',
    'read:profile',
    'write:profile'
  ],

  developer: [
    ...PERMISSION_CATEGORIES.PLUGIN,
    ...PERMISSION_CATEGORIES.DATABASE,
    ...PERMISSION_CATEGORIES.EVENT,
    ...PERMISSION_CATEGORIES.AI,
    ...PERMISSION_CATEGORIES.PROJECT,
    ...PERMISSION_CATEGORIES.TEMPLATE,
    'network:access',
    'network:internal',
    'analytics:read',
    'analytics:write',
    ...PERMISSION_CATEGORIES.CASE,
    'read:profile',
    'write:profile'
  ],

  support: [
    'plugin:list',
    'plugin:read',
    'database:read',
    'event:list',
    'event:history',
    'project:read',
    'analytics:read',
    'read:cases',
    'write:cases',
    'read:logs',
    'read:users'
  ],

  manager: [
    ...PERMISSION_CATEGORIES.PLUGIN,
    'database:read',
    'database:write',
    ...PERMISSION_CATEGORIES.EVENT,
    ...PERMISSION_CATEGORIES.PROJECT,
    'template:read',
    'template:manage',
    ...PERMISSION_CATEGORIES.ANALYTICS,
    ...PERMISSION_CATEGORIES.CASE,
    'read:logs',
    'read:users',
    'read:reports',
    'write:reports'
  ],

  guest: ['plugin:list', 'project:read', 'template:read', 'read:public']
} as const;

/**
 * Type definitions for permissions
 */
export type PermissionCategory = keyof typeof PERMISSION_CATEGORIES;
export type Permission = (typeof ALL_PERMISSIONS)[number];
export type Role = keyof typeof ROLE_PERMISSIONS;
