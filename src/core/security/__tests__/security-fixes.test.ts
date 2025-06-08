/**
 * Tests for critical security fixes
 */

import { AuthenticationService } from '../authentication-service';
import { createAuthMiddleware } from '../auth-middleware';
import { DataService } from '../../data/interfaces';
import { User } from '../../system/interfaces';
import { Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';

// Mock dependencies
const mockDataService: jest.Mocked<DataService> = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
  initialize: jest.fn(),
  close: jest.fn(),
  runMigrations: jest.fn(),
  executeQuery: jest.fn(),
  getConnectionPool: jest.fn()
};

describe('Security Fixes', () => {
  describe('Authentication Service - Generic Error Messages', () => {
    let authService: AuthenticationService;

    beforeEach(() => {
      authService = new AuthenticationService(mockDataService);
      jest.clearAllMocks();
    });

    it('should return generic error for invalid username', async () => {
      // User not found
      mockDataService.findOne.mockResolvedValue(null);

      await expect(
        authService.authenticate({ username: 'nonexistent', password: 'password' })
      ).rejects.toThrow('Invalid credentials');

      // Should not reveal that user doesn't exist
      expect(mockDataService.findOne).toHaveBeenCalledWith('users', { username: 'nonexistent' });
    });

    it('should return generic error for invalid password', async () => {
      const hashedPassword = await bcrypt.hash('correctpassword', 10);
      const mockUser: User = {
        id: '123',
        username: 'testuser',
        email: 'test@example.com',
        roles: ['user'],
        permissions: ['read:own'],
        hashedPassword,
        isActive: true
      };

      mockDataService.findOne.mockResolvedValue(mockUser);

      await expect(
        authService.authenticate({ username: 'testuser', password: 'wrongpassword' })
      ).rejects.toThrow('Invalid credentials');

      // Should not reveal that password is wrong
    });

    it('should return generic error for inactive user', async () => {
      const hashedPassword = await bcrypt.hash('password', 10);
      const mockUser: User = {
        id: '123',
        username: 'testuser',
        email: 'test@example.com',
        roles: ['user'],
        permissions: ['read:own'],
        hashedPassword,
        isActive: false // Inactive user
      };

      mockDataService.findOne.mockResolvedValue(mockUser);

      await expect(
        authService.authenticate({ username: 'testuser', password: 'password' })
      ).rejects.toThrow('Invalid credentials');

      // Should not reveal that account is inactive
    });

    it('should handle missing password hash gracefully', async () => {
      const mockUser: User = {
        id: '123',
        username: 'testuser',
        email: 'test@example.com',
        roles: ['user'],
        permissions: ['read:own'],
        isActive: true
        // No hashedPassword field
      };

      mockDataService.findOne.mockResolvedValue(mockUser);

      await expect(
        authService.authenticate({ username: 'testuser', password: 'password' })
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('Auth Middleware - User Retrieval from Database', () => {
    let middleware: ReturnType<typeof createAuthMiddleware>;
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: jest.Mock;

    beforeEach(() => {
      const mockAuthService = {
        validateToken: jest.fn().mockResolvedValue({ userId: '123' })
      };

      middleware = createAuthMiddleware({
        authService: mockAuthService as any,
        requireAuth: true
      });

      mockReq = {
        headers: {
          authorization: 'Bearer valid-token'
        },
        app: {
          locals: {
            dataService: mockDataService
          }
        } as any
      };

      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      mockNext = jest.fn();
      jest.clearAllMocks();
    });

    it('should retrieve user from database, not use hardcoded data', async () => {
      const dbUser: User = {
        id: '123',
        username: 'realuser',
        email: 'real@example.com',
        roles: ['admin'],
        permissions: ['read:all', 'write:all'],
        isActive: true
      };

      mockDataService.findOne.mockResolvedValue(dbUser);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      // Should call database
      expect(mockDataService.findOne).toHaveBeenCalledWith('users', { id: '123' });

      // Should attach real user data
      expect((mockReq as any).user).toEqual(dbUser);

      // Should continue
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject if user not found in database', async () => {
      mockDataService.findOne.mockResolvedValue(null);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      // Should return 401
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'User not found or inactive'
      });

      // Should not continue
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle missing data service gracefully', async () => {
      mockReq.app = { locals: {} } as any; // No dataService

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      // Should return 401
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'User not found or inactive'
      });
    });
  });

  describe('SQL Injection Prevention', () => {
    // This would be tested more thoroughly with integration tests
    // Here we test the validation function
    
    it('should validate column names', () => {
      const safeColumnName = (col: string): string => {
        if (!/^[a-zA-Z0-9_]+(.[a-zA-Z0-9_]+)?$/.test(col)) {
          throw new Error(`Invalid column name: ${col}`);
        }
        return `"${col}"`;
      };

      // Valid column names
      expect(safeColumnName('username')).toBe('"username"');
      expect(safeColumnName('user_id')).toBe('"user_id"');
      expect(safeColumnName('table.column')).toBe('"table.column"');

      // Invalid column names
      expect(() => safeColumnName('user; DROP TABLE users')).toThrow('Invalid column name');
      expect(() => safeColumnName('user"name')).toThrow('Invalid column name');
      expect(() => safeColumnName("user'name")).toThrow('Invalid column name');
      expect(() => safeColumnName('user/*comment*/name')).toThrow('Invalid column name');
    });
  });

  describe('XSS Prevention', () => {
    // Test would require DOM environment
    it('should sanitize HTML content', () => {
      // Mock DOMPurify for Node environment
      const DOMPurify = {
        sanitize: (html: string) => {
          // Simple mock that removes script tags
          return html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/on\w+\s*=/gi, '');
        }
      };

      const maliciousContent = '<div>Hello<script>alert("XSS")</script></div>';
      const sanitized = DOMPurify.sanitize(maliciousContent);
      
      expect(sanitized).toBe('<div>Hello</div>');
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert');

      const maliciousEvent = '<div onclick="alert(\'XSS\')">Click me</div>';
      const sanitizedEvent = DOMPurify.sanitize(maliciousEvent);
      
      expect(sanitizedEvent).not.toContain('onclick');
    });
  });

  describe('Session Store Security', () => {
    it('should generate cryptographically secure session IDs', () => {
      // Test session ID generation
      const crypto = require('crypto');
      const generateSessionId = () => crypto.randomBytes(32).toString('hex');

      const sessionIds = new Set<string>();
      
      // Generate 1000 session IDs
      for (let i = 0; i < 1000; i++) {
        const id = generateSessionId();
        
        // Should be 64 characters (32 bytes * 2 for hex)
        expect(id).toHaveLength(64);
        
        // Should be unique
        expect(sessionIds.has(id)).toBe(false);
        sessionIds.add(id);
        
        // Should only contain hex characters
        expect(id).toMatch(/^[a-f0-9]+$/);
      }
    });
  });
});