/**
 * Comprehensive test suite for SecurityService
 * 
 * Tests cover security service initialization, plugin action validation,
 * and integration with sub-services.
 */

import { SecurityServiceImpl } from '../security-service';
import { Logger } from '../../../utils/logger';
import { DataService } from '../../data/interfaces';
import { 
  AuthenticationService, 
  AuthorizationService, 
  EncryptionService, 
  AuditService, 
  ValidationService 
} from '../interfaces';

// Mock the sub-services
jest.mock('../authentication-service');
jest.mock('../authorization-service');
jest.mock('../encryption-service');
jest.mock('../audit-service');
jest.mock('../validation-service');

describe('SecurityService', () => {
  let securityService: SecurityServiceImpl;
  let mockLogger: jest.Mocked<Logger>;
  let mockDataService: jest.Mocked<DataService>;
  let mockAuditLogAction: jest.Mock;

  const defaultOptions = {
    jwtSecret: 'test-jwt-secret',
    tokenExpiration: 3600,
    encryptionKey: 'test-encryption-key-32-chars-long'
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any;

    // Mock data service
    mockDataService = {
      query: jest.fn(),
      execute: jest.fn(),
      transaction: jest.fn()
    } as any;

    // Mock audit log action
    mockAuditLogAction = jest.fn().mockResolvedValue(undefined);

    // Create security service instance
    securityService = new SecurityServiceImpl(
      mockLogger,
      mockDataService,
      defaultOptions
    );

    // Override audit service's logAction method
    securityService.audit.logAction = mockAuditLogAction;
  });

  describe('Initialization', () => {
    it('should create all sub-services on construction', () => {
      expect(securityService.authentication).toBeDefined();
      expect(securityService.authorization).toBeDefined();
      expect(securityService.encryption).toBeDefined();
      expect(securityService.audit).toBeDefined();
      expect(securityService.validation).toBeDefined();
    });

    it('should throw error if JWT secret is missing', () => {
      expect(() => {
        new SecurityServiceImpl(mockLogger, mockDataService, {
          ...defaultOptions,
          jwtSecret: ''
        });
      }).toThrow('JWT secret is required for security service initialization');
    });

    it('should throw error if encryption key is missing', () => {
      expect(() => {
        new SecurityServiceImpl(mockLogger, mockDataService, {
          ...defaultOptions,
          encryptionKey: ''
        });
      }).toThrow('Encryption key is required for security service initialization');
    });

    it('should initialize all sub-services successfully', async () => {
      const mockInitialize = jest.fn().mockResolvedValue(undefined);
      
      securityService.encryption.initialize = mockInitialize;
      securityService.authentication.initialize = mockInitialize;
      securityService.authorization.initialize = mockInitialize;
      securityService.audit.initialize = mockInitialize;
      securityService.validation.initialize = mockInitialize;

      await securityService.initialize();

      expect(mockInitialize).toHaveBeenCalledTimes(5);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Initializing security service',
        { component: 'SecurityService' }
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Security service initialized successfully',
        { component: 'SecurityService' }
      );
    });

    it('should throw error if already initialized', async () => {
      const mockInitialize = jest.fn().mockResolvedValue(undefined);
      
      securityService.encryption.initialize = mockInitialize;
      securityService.authentication.initialize = mockInitialize;
      securityService.authorization.initialize = mockInitialize;
      securityService.audit.initialize = mockInitialize;
      securityService.validation.initialize = mockInitialize;

      await securityService.initialize();

      await expect(securityService.initialize()).rejects.toThrow(
        'Security service is already initialized'
      );
    });

    it('should handle initialization errors from sub-services', async () => {
      const error = new Error('Sub-service init failed');
      securityService.encryption.initialize = jest.fn().mockRejectedValue(error);

      await expect(securityService.initialize()).rejects.toThrow(error);
    });
  });

  describe('Plugin Action Validation', () => {
    describe('readFile action', () => {
      it('should validate valid file path', async () => {
        await securityService.validatePluginAction('plugin-1', 'readFile', ['/valid/path/file.txt']);

        expect(mockAuditLogAction).toHaveBeenCalledWith({
          userId: 'plugin:plugin-1',
          action: 'readFile',
          resource: 'plugin-api',
          result: 'success',
          metadata: { pluginId: 'plugin-1' }
        });
      });

      it('should reject invalid file path', async () => {
        await expect(
          securityService.validatePluginAction('plugin-1', 'readFile', [null])
        ).rejects.toThrow('Invalid file path');

        expect(mockAuditLogAction).toHaveBeenCalledWith({
          userId: 'plugin:plugin-1',
          action: 'readFile',
          resource: 'plugin-api',
          result: 'failure',
          metadata: {
            pluginId: 'plugin-1',
            error: 'Invalid file path'
          }
        });
      });

      it('should reject path traversal attempts', async () => {
        await expect(
          securityService.validatePluginAction('plugin-1', 'readFile', ['../../../etc/passwd'])
        ).rejects.toThrow('Path traversal detected');

        await expect(
          securityService.validatePluginAction('plugin-1', 'readFile', ['~/sensitive/file'])
        ).rejects.toThrow('Path traversal detected');
      });
    });

    describe('writeFile action', () => {
      it('should validate valid file path', async () => {
        await securityService.validatePluginAction('plugin-1', 'writeFile', ['/valid/path/file.txt', 'content']);

        expect(mockAuditLogAction).toHaveBeenCalledWith({
          userId: 'plugin:plugin-1',
          action: 'writeFile',
          resource: 'plugin-api',
          result: 'success',
          metadata: { pluginId: 'plugin-1' }
        });
      });

      it('should reject invalid file path', async () => {
        await expect(
          securityService.validatePluginAction('plugin-1', 'writeFile', [''])
        ).rejects.toThrow('Invalid file path');
      });

      it('should reject path traversal attempts', async () => {
        await expect(
          securityService.validatePluginAction('plugin-1', 'writeFile', ['../../sensitive', 'content'])
        ).rejects.toThrow('Path traversal detected');
      });

      it('should reject writing to system directories', async () => {
        const systemPaths = [
          '/etc/passwd',
          '/usr/bin/file',
          '/bin/sh',
          '/sbin/init',
          '/boot/config',
          'C:\\Windows\\System32\\file.exe',
          'C:\\Program Files\\app\\file'
        ];

        for (const path of systemPaths) {
          await expect(
            securityService.validatePluginAction('plugin-1', 'writeFile', [path, 'content'])
          ).rejects.toThrow('Cannot write to system directories');
        }
      });
    });

    describe('makeHttpRequest action', () => {
      it('should validate valid HTTPS URL', async () => {
        await securityService.validatePluginAction('plugin-1', 'makeHttpRequest', ['https://api.example.com']);

        expect(mockAuditLogAction).toHaveBeenCalledWith({
          userId: 'plugin:plugin-1',
          action: 'makeHttpRequest',
          resource: 'plugin-api',
          result: 'success',
          metadata: { pluginId: 'plugin-1' }
        });
      });

      it('should validate valid HTTP URL', async () => {
        await securityService.validatePluginAction('plugin-1', 'makeHttpRequest', ['http://api.example.com']);

        expect(mockAuditLogAction).toHaveBeenCalledWith({
          userId: 'plugin:plugin-1',
          action: 'makeHttpRequest',
          resource: 'plugin-api',
          result: 'success',
          metadata: { pluginId: 'plugin-1' }
        });
      });

      it('should reject invalid URL', async () => {
        await expect(
          securityService.validatePluginAction('plugin-1', 'makeHttpRequest', [123])
        ).rejects.toThrow('Invalid URL');
      });

      it('should reject internal network access', async () => {
        const internalUrls = [
          'http://localhost:8080',
          'https://127.0.0.1:3000',
          'http://0.0.0.0:9000',
          'http://[::1]:8080'
        ];

        for (const url of internalUrls) {
          await expect(
            securityService.validatePluginAction('plugin-1', 'makeHttpRequest', [url])
          ).rejects.toThrow('Access to internal network is blocked');
        }
      });

      it('should reject non-HTTP protocols', async () => {
        const invalidProtocols = [
          'ftp://example.com',
          'file:///etc/passwd',
          'gopher://example.com',
          'telnet://example.com'
        ];

        for (const url of invalidProtocols) {
          await expect(
            securityService.validatePluginAction('plugin-1', 'makeHttpRequest', [url])
          ).rejects.toThrow('Only HTTP(S) protocols are allowed');
        }
      });
    });

    describe('accessDatabase action', () => {
      it('should validate safe SQL query', async () => {
        await securityService.validatePluginAction(
          'plugin-1', 
          'accessDatabase', 
          ['SELECT * FROM users WHERE id = ?']
        );

        expect(mockAuditLogAction).toHaveBeenCalledWith({
          userId: 'plugin:plugin-1',
          action: 'accessDatabase',
          resource: 'plugin-api',
          result: 'success',
          metadata: { pluginId: 'plugin-1' }
        });
      });

      it('should reject SQL injection attempts', async () => {
        const dangerousQueries = [
          "SELECT * FROM users; DROP TABLE users;--",
          "SELECT * FROM users WHERE id = '1' OR '1'='1'/*",
          "SELECT * FROM users*/; DROP TABLE users",
          "EXEC xp_cmdshell 'dir'",
          "EXEC sp_executesql 'DROP TABLE users'",
          "DELETE FROM users WHERE 1=1",
          "TRUNCATE TABLE users"
        ];

        for (const query of dangerousQueries) {
          await expect(
            securityService.validatePluginAction('plugin-1', 'accessDatabase', [query])
          ).rejects.toThrow('Potentially dangerous SQL detected');
        }
      });

      it('should handle non-string query parameters', async () => {
        // Should not throw for non-string parameters
        await securityService.validatePluginAction(
          'plugin-1', 
          'accessDatabase', 
          [{ query: 'SELECT * FROM users' }]
        );

        expect(mockAuditLogAction).toHaveBeenCalledWith({
          userId: 'plugin:plugin-1',
          action: 'accessDatabase',
          resource: 'plugin-api',
          result: 'success',
          metadata: { pluginId: 'plugin-1' }
        });
      });
    });

    describe('Unknown actions', () => {
      it('should allow unknown actions by default', async () => {
        await securityService.validatePluginAction(
          'plugin-1', 
          'unknownAction', 
          ['arg1', 'arg2']
        );

        expect(mockAuditLogAction).toHaveBeenCalledWith({
          userId: 'plugin:plugin-1',
          action: 'unknownAction',
          resource: 'plugin-api',
          result: 'success',
          metadata: { pluginId: 'plugin-1' }
        });
      });
    });

    describe('Audit logging', () => {
      it('should log pending action before validation', async () => {
        await securityService.validatePluginAction(
          'plugin-1', 
          'readFile', 
          ['/path/to/file']
        );

        expect(mockAuditLogAction).toHaveBeenCalledWith({
          userId: 'plugin:plugin-1',
          action: 'readFile',
          resource: 'plugin-api',
          result: 'pending',
          metadata: {
            pluginId: 'plugin-1',
            args: 'provided'
          }
        });
      });

      it('should log no args when empty', async () => {
        await securityService.validatePluginAction(
          'plugin-1', 
          'unknownAction', 
          []
        );

        expect(mockAuditLogAction).toHaveBeenCalledWith({
          userId: 'plugin:plugin-1',
          action: 'unknownAction',
          resource: 'plugin-api',
          result: 'pending',
          metadata: {
            pluginId: 'plugin-1',
            args: 'none'
          }
        });
      });

      it('should handle audit logging errors gracefully', async () => {
        mockAuditLogAction.mockRejectedValueOnce(new Error('Audit failed'));

        // Should not throw even if audit fails
        await expect(
          securityService.validatePluginAction('plugin-1', 'readFile', ['/path'])
        ).resolves.toBeUndefined();
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed URLs gracefully', async () => {
      await expect(
        securityService.validatePluginAction('plugin-1', 'makeHttpRequest', ['not-a-url'])
      ).rejects.toThrow();
    });

    it('should handle null/undefined plugin IDs', async () => {
      await securityService.validatePluginAction(
        null as any, 
        'readFile', 
        ['/path']
      );

      expect(mockAuditLogAction).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'plugin:null'
        })
      );
    });

    it('should handle errors in validation rules', async () => {
      // Force an error by passing invalid URL
      await expect(
        securityService.validatePluginAction('plugin-1', 'makeHttpRequest', [{}])
      ).rejects.toThrow();

      expect(mockAuditLogAction).toHaveBeenCalledWith(
        expect.objectContaining({
          result: 'failure',
          metadata: expect.objectContaining({
            error: expect.any(String)
          })
        })
      );
    });
  });
});