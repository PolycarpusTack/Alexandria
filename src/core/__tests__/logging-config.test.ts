/**
 * Tests for logging configuration
 */

import { getLoggingConfig, shouldLog, sanitizeLogData } from '../../config/logging.config';

describe('Logging Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getLoggingConfig', () => {
    it('should return production config when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';
      const config = getLoggingConfig();
      
      expect(config.level).toBe('warn');
      expect(config.format).toBe('json');
      expect(config.colorize).toBe(false);
      expect(config.maxFiles).toBe(30);
      expect(config.maxSize).toBe('100m');
    });

    it('should return development config when NODE_ENV is development', () => {
      process.env.NODE_ENV = 'development';
      const config = getLoggingConfig();
      
      expect(config.level).toBe('debug');
      expect(config.format).toBe('pretty');
      expect(config.colorize).toBe(true);
      expect(config.maxFiles).toBe(7);
      expect(config.maxSize).toBe('20m');
    });

    it('should return test config when NODE_ENV is test', () => {
      process.env.NODE_ENV = 'test';
      const config = getLoggingConfig();
      
      expect(config.level).toBe('error');
      expect(config.format).toBe('simple');
      expect(config.colorize).toBe(false);
    });

    it('should use LOG_LEVEL environment variable if set', () => {
      process.env.NODE_ENV = 'production';
      process.env.LOG_LEVEL = 'info';
      const config = getLoggingConfig();
      
      expect(config.level).toBe('info');
    });
  });

  describe('shouldLog', () => {
    it('should respect log level hierarchy', () => {
      const config = getLoggingConfig();
      config.level = 'warn';

      expect(shouldLog('error', 'test', config)).toBe(true);
      expect(shouldLog('warn', 'test', config)).toBe(true);
      expect(shouldLog('info', 'test', config)).toBe(false);
      expect(shouldLog('debug', 'test', config)).toBe(false);
    });

    it('should apply filters correctly', () => {
      const config = getLoggingConfig();
      config.level = 'debug';
      config.filters = [
        { level: 'debug', action: 'deny' },
        { component: 'security', level: 'info', action: 'allow' }
      ];

      expect(shouldLog('debug', 'test', config)).toBe(false);
      expect(shouldLog('info', 'test', config)).toBe(true);
      expect(shouldLog('info', 'security', config)).toBe(true);
    });

    it('should handle production filters', () => {
      process.env.NODE_ENV = 'production';
      const config = getLoggingConfig();

      // Debug should be denied in production
      expect(shouldLog('debug', 'random', config)).toBe(false);
      
      // Security component should be allowed at info level
      expect(shouldLog('info', 'security', config)).toBe(true);
      expect(shouldLog('info', 'authentication', config)).toBe(true);
      expect(shouldLog('info', 'audit', config)).toBe(true);
    });
  });

  describe('sanitizeLogData', () => {
    it('should sanitize sensitive keys', () => {
      const data = {
        username: 'john',
        password: 'secret123',
        token: 'abc123',
        apiKey: 'xyz789',
        data: 'normal data'
      };

      const sanitized = sanitizeLogData(data);

      expect(sanitized.username).toBe('john');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.token).toBe('[REDACTED]');
      expect(sanitized.apiKey).toBe('[REDACTED]');
      expect(sanitized.data).toBe('normal data');
    });

    it('should sanitize nested objects', () => {
      const data = {
        user: {
          name: 'john',
          credentials: {
            password: 'secret',
            secret: 'hidden'
          }
        }
      };

      const sanitized = sanitizeLogData(data);

      expect(sanitized.user.name).toBe('john');
      expect(sanitized.user.credentials.password).toBe('[REDACTED]');
      expect(sanitized.user.credentials.secret).toBe('[REDACTED]');
    });

    it('should handle non-object inputs', () => {
      expect(sanitizeLogData('string')).toBe('string');
      expect(sanitizeLogData(123)).toBe(123);
      expect(sanitizeLogData(null)).toBe(null);
      expect(sanitizeLogData(undefined)).toBe(undefined);
    });

    it('should detect sensitive keys case-insensitively', () => {
      const data = {
        PASSWORD: 'secret',
        ApiKey: 'key123',
        credit_card: '1234-5678-9012-3456'
      };

      const sanitized = sanitizeLogData(data);

      expect(sanitized.PASSWORD).toBe('[REDACTED]');
      expect(sanitized.ApiKey).toBe('[REDACTED]');
      expect(sanitized.credit_card).toBe('[REDACTED]');
    });
  });
});