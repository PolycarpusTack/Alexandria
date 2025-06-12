/**
 * Tests for Enhanced Permission Validator
 */

import { EnhancedPermissionValidator } from '../permission-validator-enhanced';

describe('EnhancedPermissionValidator', () => {
  let validator: EnhancedPermissionValidator;

  beforeEach(() => {
    validator = new EnhancedPermissionValidator();
  });

  describe('validatePluginPermissions', () => {
    it('should validate correct permissions', () => {
      const result = validator.validatePluginPermissions('test-plugin', [
        'file:read',
        'database:read',
        'event:emit'
      ]);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should provide helpful suggestions for typos', () => {
      const result = validator.validatePluginPermissions('test-plugin', [
        'databse:access' // typo
      ]);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unknown permission: databse:access');
      expect(result.suggestions.some((s) => s.includes('database:access'))).toBe(true);
    });

    it('should warn about dangerous permissions', () => {
      const result = validator.validatePluginPermissions('test-plugin', [
        'database:delete',
        'system:shutdown'
      ]);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some((w) => w.includes('potentially dangerous permissions'))).toBe(
        true
      );
    });

    it('should detect redundant permissions', () => {
      const result = validator.validatePluginPermissions('test-plugin', [
        'plugin:*',
        'plugin:communicate' // redundant
      ]);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some((w) => w.includes('Redundant permissions'))).toBe(true);
    });

    it('should warn about dangerous permission combinations', () => {
      const result = validator.validatePluginPermissions('test-plugin', [
        'file:write',
        'network:http'
      ]);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some((w) => w.includes('data exfiltration'))).toBe(true);
    });

    it('should handle wildcard permissions', () => {
      const result = validator.validatePluginPermissions('test-plugin', ['*']);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some((w) => w.includes('wildcard permission'))).toBe(true);
    });

    it('should handle category wildcards', () => {
      const result = validator.validatePluginPermissions('test-plugin', ['database:*']);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some((w) => w.includes('broad category permissions'))).toBe(true);
    });

    it('should suggest valid categories for unknown ones', () => {
      const result = validator.validatePluginPermissions('test-plugin', ['unknown:permission']);

      expect(result.isValid).toBe(false);
      expect(result.suggestions.some((s) => s.includes('Unknown category "unknown"'))).toBe(true);
    });
  });

  describe('getPermissionsByCategory', () => {
    it('should return permissions for a valid category', () => {
      const permissions = validator.getPermissionsByCategory('database');

      expect(permissions).toContain('database:read');
      expect(permissions).toContain('database:write');
      expect(permissions).toContain('database:delete');
    });

    it('should return empty array for invalid category', () => {
      const permissions = validator.getPermissionsByCategory('invalid');

      expect(permissions).toHaveLength(0);
    });
  });

  describe('isValidPermission', () => {
    it('should validate known permissions', () => {
      expect(validator.isValidPermission('file:read')).toBe(true);
      expect(validator.isValidPermission('database:write')).toBe(true);
    });

    it('should validate wildcard permissions', () => {
      expect(validator.isValidPermission('*')).toBe(true);
      expect(validator.isValidPermission('file:*')).toBe(true);
    });

    it('should reject invalid permissions', () => {
      expect(validator.isValidPermission('invalid:permission')).toBe(false);
      expect(validator.isValidPermission('file:invalid')).toBe(false);
    });
  });

  describe('findSimilarPermissions', () => {
    it('should find similar permissions based on Levenshtein distance', () => {
      const result = validator.validatePluginPermissions('test-plugin', [
        'fil:read' // missing 'e'
      ]);

      expect(result.suggestions.some((s) => s.includes('file:read'))).toBe(true);
    });

    it('should limit suggestions to top 3', () => {
      const result = validator.validatePluginPermissions('test-plugin', [
        'data' // could match many permissions
      ]);

      // Count suggestion items (each "Did you mean" line contains up to 3 suggestions)
      const suggestionCount = result.suggestions
        .filter((s) => s.includes('Did you mean'))
        .reduce((count, s) => {
          const matches = s.match(/[a-z]+:[a-z]+/g);
          return count + (matches ? matches.length : 0);
        }, 0);

      expect(suggestionCount).toBeLessThanOrEqual(3);
    });
  });
});
