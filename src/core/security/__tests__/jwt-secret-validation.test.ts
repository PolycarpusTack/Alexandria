/**
 * JWT Secret Validation Security Test
 * 
 * This test ensures that JWT secret validation cannot be bypassed
 * and that production environments enforce strong secrets.
 */

import { JwtAuthenticationService } from '../authentication-service';
import { Logger } from '../../../utils/logger';
import { DataService } from '../../data/interfaces';

describe('JWT Secret Security Validation', () => {
  let mockLogger: Logger;
  let mockDataService: DataService;

  beforeEach(() => {
    // Reset environment
    delete process.env.JWT_SECRET;
    delete process.env.NODE_ENV;

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    } as any;

    mockDataService = {
      users: {
        findByUsername: jest.fn(),
        findByEmail: jest.fn(),
        findById: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      }
    } as any;
  });

  afterEach(() => {
    // Clean up environment
    delete process.env.JWT_SECRET;
    delete process.env.NODE_ENV;
  });

  describe('Production Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should throw error when JWT_SECRET env var is not set', () => {
      expect(() => {
        new JwtAuthenticationService(mockLogger, mockDataService, {
          jwtSecret: ''
        });
      }).toThrow('JWT secret is required and must be provided in options');
    });

    it('should throw error when JWT_SECRET is undefined', () => {
      expect(() => {
        new JwtAuthenticationService(mockLogger, mockDataService, {
          jwtSecret: undefined as any
        });
      }).toThrow('JWT secret is required and must be provided in options');
    });

    it('should throw error when JWT_SECRET is null', () => {
      expect(() => {
        new JwtAuthenticationService(mockLogger, mockDataService, {
          jwtSecret: null as any
        });
      }).toThrow('JWT secret is required and must be provided in options');
    });

    it('should throw error for short secrets in production', () => {
      expect(() => {
        new JwtAuthenticationService(mockLogger, mockDataService, {
          jwtSecret: 'short-secret-that-is-not-64-chars'
        });
      }).toThrow('JWT secret must be at least 64 characters long in production');
    });

    it('should throw error for weak secrets', () => {
      const weakSecrets = ['alexandria-dev-secret', 'secret', 'password', 'changeme', 'test', 'demo'];
      
      weakSecrets.forEach(weakSecret => {
        expect(() => {
          new JwtAuthenticationService(mockLogger, mockDataService, {
            jwtSecret: weakSecret
          });
        }).toThrow('JWT secret appears to be a weak or default value');
      });
    });

    it('should throw error for repeated pattern secrets', () => {
      expect(() => {
        new JwtAuthenticationService(mockLogger, mockDataService, {
          jwtSecret: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
        });
      }).toThrow('JWT secret cannot be a repeated pattern');
    });

    it('should accept strong secrets in production', () => {
      const strongSecret = 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0u1V2w3X4y5Z6!@#$%^&*()_+';
      
      expect(() => {
        new JwtAuthenticationService(mockLogger, mockDataService, {
          jwtSecret: strongSecret
        });
      }).not.toThrow();
    });
  });

  describe('Development Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should still require a JWT secret in development', () => {
      expect(() => {
        new JwtAuthenticationService(mockLogger, mockDataService, {
          jwtSecret: ''
        });
      }).toThrow('JWT secret is required and must be provided in options');
    });

    it('should allow shorter secrets in development (min 32 chars)', () => {
      const devSecret = 'dev-secret-with-32-characters!!!';
      
      expect(() => {
        new JwtAuthenticationService(mockLogger, mockDataService, {
          jwtSecret: devSecret
        });
      }).not.toThrow();
    });

    it('should warn about weak secrets in development', () => {
      const weakSecret = 'alexandria-dev-secret-with-more-than-32-characters';
      
      expect(() => {
        new JwtAuthenticationService(mockLogger, mockDataService, {
          jwtSecret: weakSecret
        });
      }).toThrow('JWT secret appears to be a weak or default value');
    });
  });

  describe('Token Security', () => {
    it('should not create valid tokens with empty secret', async () => {
      // This test ensures that even if validation is somehow bypassed,
      // JWT operations will fail with invalid secrets
      const jwt = require('jsonwebtoken');
      
      expect(() => {
        jwt.sign({ userId: 'test' }, '', { expiresIn: '1h' });
      }).toThrow();
    });

    it('should not verify tokens with mismatched secrets', () => {
      const jwt = require('jsonwebtoken');
      const secret1 = 'secret-one-with-sufficient-length-for-testing!!';
      const secret2 = 'secret-two-with-sufficient-length-for-testing!!';
      
      const token = jwt.sign({ userId: 'test' }, secret1, { expiresIn: '1h' });
      
      expect(() => {
        jwt.verify(token, secret2);
      }).toThrow();
    });
  });
});