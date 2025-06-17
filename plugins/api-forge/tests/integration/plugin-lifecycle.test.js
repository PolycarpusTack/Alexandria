import ApicarusPlugin from '../../index.js';
import { mockAlexandriaContext } from '../mocks/alexandria-sdk.js';

describe('Plugin Lifecycle Integration', () => {
  let plugin;
  let context;

  beforeEach(() => {
    context = mockAlexandriaContext();
    plugin = new ApicarusPlugin();
  });

  afterEach(async () => {
    if (plugin.isReady) {
      await plugin.onDeactivate();
    }
  });

  test('should complete full activation cycle', async () => {
    await plugin.onActivate(context);
    
    expect(plugin.context).toBe(context);
    expect(plugin.requestBuilder).toBeDefined();
    expect(plugin.responseViewer).toBeDefined();
    expect(plugin.collectionManager).toBeDefined();
    expect(plugin.environmentManager).toBeDefined();
    expect(plugin.codeGenerator).toBeDefined();
    expect(plugin.aiAssistant).toBeDefined();
    expect(context.ui.registerPanel).toHaveBeenCalledTimes(3);
    expect(context.ui.registerCommand).toHaveBeenCalledTimes(6);
  });

  test('should handle activation errors gracefully', async () => {
    context.storage.get.mockRejectedValue(new Error('Storage error'));
    
    await plugin.onActivate(context);
    
    // Should still activate despite storage error
    expect(plugin.context).toBe(context);
    expect(context.logger.error).toHaveBeenCalled();
  });

  test('should clean up on deactivation', async () => {
    await plugin.onActivate(context);
    await plugin.onDeactivate();
    
    expect(context.storage.set).toHaveBeenCalled(); // Save state
  });

  test('should persist and restore state', async () => {
    // First activation
    await plugin.onActivate(context);
    plugin.collections = [{ id: '1', name: 'Test' }];
    await plugin.onDeactivate();
    
    // Second activation with saved data
    const newPlugin = new ApicarusPlugin();
    context.storage.get.mockResolvedValue({
      collections: [{ id: '1', name: 'Test' }]
    });
    
    await newPlugin.onActivate(context);
    
    expect(newPlugin.collections).toEqual([{ id: '1', name: 'Test' }]);
  });

  test('should initialize performance optimizations', async () => {
    await plugin.onActivate(context);
    
    expect(plugin.performanceMonitor).toBeDefined();
    expect(plugin.requestDeduplicator).toBeDefined();
    expect(plugin.cacheManager).toBeDefined();
    expect(plugin.updaters.size).toBeGreaterThan(0);
  });

  test('should setup store with middleware', async () => {
    process.env.NODE_ENV = 'development';
    
    await plugin.onActivate(context);
    
    expect(plugin.store).toBeDefined();
    expect(plugin.devTools).toBeDefined(); // DevTools in development
    
    process.env.NODE_ENV = 'test';
  });

  test('should handle store initialization failure', async () => {
    // Mock store failure
    const originalStore = plugin.store;
    plugin.store = null;
    
    await plugin.onActivate(context);
    
    // Should continue with legacy state management
    expect(plugin.store).toBeNull();
    expect(context.logger.error).toHaveBeenCalled();
  });

  test('should setup event listeners', async () => {
    await plugin.onActivate(context);
    
    expect(plugin.eventManager).toBeDefined();
    expect(plugin.keyboardHandler).toBeDefined();
  });

  test('should initialize virtual lists for large datasets', async () => {
    // Create large collections to trigger virtual lists
    plugin.collections = Array(150).fill().map((_, i) => ({
      id: `col-${i}`,
      name: `Collection ${i}`
    }));
    
    await plugin.onActivate(context);
    
    // Virtual lists should be available for large datasets
    expect(plugin.collectionList).toBeDefined();
  });

  test('should handle memory cleanup on deactivation', async () => {
    await plugin.onActivate(context);
    
    // Add some data to clean up
    plugin.responseCache.set('test', { data: 'test' });
    plugin.updaters.set('test', { cancel: jest.fn() });
    
    await plugin.onDeactivate();
    
    // Should clean up memory
    expect(plugin.responseCache.size).toBe(0);
    expect(plugin.updaters.size).toBe(0);
  });

  test('should maintain backward compatibility', async () => {
    // Test with old data format
    context.storage.get.mockResolvedValue({
      // Old format
      savedData: {
        collections: [{ id: '1', name: 'Old Collection' }],
        environments: [{ id: 'env1', name: 'Old Env' }]
      }
    });
    
    await plugin.onActivate(context);
    
    // Should handle migration gracefully
    expect(plugin.collections).toBeDefined();
    expect(plugin.environments).toBeDefined();
  });

  test('should handle concurrent activation attempts', async () => {
    const activation1 = plugin.onActivate(context);
    const activation2 = plugin.onActivate(context);
    
    await Promise.all([activation1, activation2]);
    
    // Should handle gracefully without errors
    expect(plugin.context).toBe(context);
  });

  test('should validate context requirements', async () => {
    const invalidContext = {};
    
    await plugin.onActivate(invalidContext);
    
    // Should handle missing services gracefully
    expect(plugin.context).toBe(invalidContext);
  });
});