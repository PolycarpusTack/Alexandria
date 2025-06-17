// Mock Alexandria SDK for testing

export const mockAlexandriaContext = () => ({
  ui: {
    showNotification: jest.fn(),
    showDialog: jest.fn(),
    registerPanel: jest.fn(),
    registerCommand: jest.fn()
  },
  storage: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
    clear: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  },
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  },
  ai: {
    generateText: jest.fn()
  },
  dataService: {
    get: jest.fn(),
    set: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  },
  aiService: {
    generateText: jest.fn()
  },
  apiService: {
    request: jest.fn()
  }
});

export class PluginLifecycle {
  async onActivate(context) {}
  async onDeactivate() {}
}

export class PluginContext {
  constructor() {
    Object.assign(this, mockAlexandriaContext());
  }
}

export class AIService {
  async generateText(prompt, options = {}) {
    return 'Mock AI response';
  }
}