// Test setup file
import 'reflect-metadata';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.MNEMOSYNE_DB_HOST = 'localhost';
process.env.MNEMOSYNE_DB_PORT = '5432';
process.env.MNEMOSYNE_DB_USER = 'test';
process.env.MNEMOSYNE_DB_PASSWORD = 'test';
process.env.MNEMOSYNE_DB_NAME = 'test';
process.env.JWT_SECRET = 'test-secret';

// Global test utilities
export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  username: 'testuser',
  email: 'test@example.com',
  role: 'user',
  permissions: ['read', 'write'],
  ...overrides
});

export const createMockNode = (overrides = {}) => ({
  id: 'test-node-id',
  title: 'Test Node',
  content: 'Test content',
  type: 'document',
  parentId: null,
  metadata: { tags: [], author: null, version: 1 },
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides
});

// Clean up after tests
afterAll(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});