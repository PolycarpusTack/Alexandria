import { EnvironmentManager } from '../src/components/EnvironmentManager';
import { TestHelpers } from './utils/testHelpers';

describe('EnvironmentManager', () => {
  let manager;
  let mockPlugin;

  beforeEach(() => {
    mockPlugin = {
      ...TestHelpers.createMockPlugin(),
      environments: []
    };
    
    manager = new EnvironmentManager(mockPlugin);
  });

  describe('Environment CRUD', () => {
    test('should create environment', async () => {
      const env = await manager.createEnvironment({
        name: 'Production',
        variables: {
          baseUrl: 'https://api.prod.com',
          apiKey: 'prod-key'
        }
      });
      
      expect(env).toHaveProperty('id');
      expect(env.name).toBe('Production');
      expect(env.variables.baseUrl).toBe('https://api.prod.com');
    });

    test('should update environment variables', async () => {
      const env = { id: 'env1', variables: { foo: 'bar' } };
      mockPlugin.environments = [env];
      
      await manager.updateVariables('env1', {
        foo: 'updated',
        new: 'value'
      });
      
      expect(env.variables.foo).toBe('updated');
      expect(env.variables.new).toBe('value');
    });

    test('should activate environment', async () => {
      const env = { id: 'env1', name: 'Test' };
      mockPlugin.environments = [env];
      
      await manager.activateEnvironment('env1');
      
      expect(mockPlugin.activeEnvironment).toBe('env1');
    });
  });

  describe('Variable Substitution', () => {
    test('should substitute simple variables', () => {
      manager.activeVariables = {
        baseUrl: 'http://localhost:3000',
        token: 'abc123'
      };
      
      const result = manager.substituteVariables(
        '{{baseUrl}}/api/auth'
      );
      
      expect(result).toBe('http://localhost:3000/api/auth');
    });

    test('should handle nested variables', () => {
      manager.activeVariables = {
        env: 'prod',
        'prod.url': 'https://api.prod.com'
      };
      
      const result = manager.substituteVariables(
        '{{{{env}}.url}}/endpoint'
      );
      
      expect(result).toBe('https://api.prod.com/endpoint');
    });

    test('should handle missing variables', () => {
      manager.activeVariables = {};
      
      const result = manager.substituteVariables(
        '{{missing}}/api'
      );
      
      expect(result).toBe('{{missing}}/api');
    });

    test('should substitute in objects', () => {
      manager.activeVariables = {
        apiKey: 'secret123'
      };
      
      const obj = {
        headers: {
          'Authorization': 'Bearer {{apiKey}}',
          'Content-Type': 'application/json'
        }
      };
      
      const result = manager.substituteInObject(obj);
      
      expect(result.headers.Authorization).toBe('Bearer secret123');
    });
  });

  describe('Import/Export', () => {
    test('should export environment', () => {
      const env = {
        id: 'env1',
        name: 'Staging',
        variables: { url: 'staging.com' }
      };
      
      const exported = manager.exportEnvironment(env);
      
      expect(exported).toContain('Staging');
      expect(exported).toContain('staging.com');
    });

    test('should import environment file', async () => {
      const envFile = `
        # Production Environment
        BASE_URL=https://api.prod.com
        API_KEY=prod-key-123
        DEBUG=false
      `;
      
      const imported = await manager.importEnvironmentFile(envFile);
      
      expect(imported.variables.BASE_URL).toBe('https://api.prod.com');
      expect(imported.variables.API_KEY).toBe('prod-key-123');
      expect(imported.variables.DEBUG).toBe('false');
    });

    test('should handle malformed env files', async () => {
      const malformedFile = `
        INVALID_LINE_WITHOUT_EQUALS
        GOOD_VAR=value
        =INVALID_EQUALS_AT_START
      `;
      
      const imported = await manager.importEnvironmentFile(malformedFile);
      
      // Should only import valid lines
      expect(imported.variables.GOOD_VAR).toBe('value');
      expect(imported.variables.INVALID_LINE_WITHOUT_EQUALS).toBeUndefined();
    });
  });

  describe('Security', () => {
    test('should mask sensitive variable values in logs', () => {
      const env = {
        name: 'Test',
        variables: {
          apiKey: 'secret123',
          password: 'topsecret',
          publicUrl: 'https://api.test.com'
        }
      };
      
      const masked = manager.maskSensitiveVariables(env);
      
      expect(masked.variables.apiKey).toBe('***');
      expect(masked.variables.password).toBe('***');
      expect(masked.variables.publicUrl).toBe('https://api.test.com'); // Not sensitive
    });

    test('should validate variable names', () => {
      const invalidNames = [
        '',           // Empty
        '123invalid', // Starts with number
        'with space', // Contains space
        'with-dash'   // Contains special char
      ];
      
      invalidNames.forEach(name => {
        expect(() => manager.validateVariableName(name)).toThrow();
      });
    });

    test('should allow valid variable names', () => {
      const validNames = [
        'baseUrl',
        'API_KEY',
        'token123',
        'env_prod'
      ];
      
      validNames.forEach(name => {
        expect(() => manager.validateVariableName(name)).not.toThrow();
      });
    });
  });

  describe('Variable Resolution', () => {
    test('should resolve variables in correct order', () => {
      manager.activeVariables = {
        env: 'prod',
        baseUrl: '{{env}}.example.com',
        fullUrl: 'https://{{baseUrl}}/api'
      };
      
      const result = manager.substituteVariables('{{fullUrl}}/users');
      
      expect(result).toBe('https://prod.example.com/api/users');
    });

    test('should detect circular references', () => {
      manager.activeVariables = {
        var1: '{{var2}}',
        var2: '{{var1}}'
      };
      
      expect(() => {
        manager.substituteVariables('{{var1}}');
      }).toThrow('Circular reference detected');
    });

    test('should handle complex nested substitution', () => {
      manager.activeVariables = {
        protocol: 'https',
        domain: 'api.example.com',
        version: 'v1',
        baseUrl: '{{protocol}}://{{domain}}/{{version}}',
        usersEndpoint: '{{baseUrl}}/users',
        userUrl: '{{usersEndpoint}}/123'
      };
      
      const result = manager.substituteVariables('{{userUrl}}');
      
      expect(result).toBe('https://api.example.com/v1/users/123');
    });
  });

  describe('Environment Switching', () => {
    beforeEach(() => {
      mockPlugin.environments = [
        {
          id: 'dev',
          name: 'Development',
          variables: { baseUrl: 'http://localhost:3000' }
        },
        {
          id: 'prod',
          name: 'Production',
          variables: { baseUrl: 'https://api.prod.com' }
        }
      ];
    });

    test('should switch active environment', async () => {
      await manager.activateEnvironment('dev');
      expect(manager.activeVariables.baseUrl).toBe('http://localhost:3000');
      
      await manager.activateEnvironment('prod');
      expect(manager.activeVariables.baseUrl).toBe('https://api.prod.com');
    });

    test('should handle switching to non-existent environment', async () => {
      await expect(
        manager.activateEnvironment('nonexistent')
      ).rejects.toThrow('Environment not found');
    });

    test('should maintain variable state during switch', async () => {
      await manager.activateEnvironment('dev');
      
      // Modify variables
      manager.activeVariables.customVar = 'test';
      
      // Switch environment
      await manager.activateEnvironment('prod');
      
      // Should not have custom variable from previous environment
      expect(manager.activeVariables.customVar).toBeUndefined();
    });
  });
});