// Jest setup file for Mnemosyne plugin tests

// Mock logger for testing
global.mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock data service for testing
global.mockDataService = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  query: jest.fn(),
  transaction: jest.fn()
};

// Mock event bus for testing
global.mockEventBus = {
  emit: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  once: jest.fn()
};

// Mock plugin context for testing
global.mockPluginContext = {
  services: {
    logger: global.mockLogger,
    eventBus: global.mockEventBus,
    data: global.mockDataService,
    ui: {
      registerComponent: jest.fn(),
      unregisterComponent: jest.fn(),
      getComponent: jest.fn()
    },
    featureFlags: {
      isEnabled: jest.fn().mockReturnValue(true),
      getFlags: jest.fn().mockReturnValue({})
    },
    security: {
      checkPermission: jest.fn().mockReturnValue(true),
      encryptData: jest.fn(),
      decryptData: jest.fn()
    },
    api: {
      request: jest.fn()
    }
  },
  manifest: {
    id: 'mnemosyne',
    name: 'Mnemosyne Knowledge Management',
    version: '0.1.0'
  }
};

// Setup test utilities
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
});

afterEach(() => {
  // Clean up after each test
  jest.restoreAllMocks();
});