import { CollectionManager } from '../src/components/CollectionManager';
import { TestHelpers } from './utils/testHelpers';

describe('CollectionManager', () => {
  let manager;
  let mockPlugin;
  let mockStorage;

  beforeEach(() => {
    mockStorage = {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn()
    };
    
    mockPlugin = {
      ...TestHelpers.createMockPlugin(),
      storage: mockStorage
    };
    
    manager = new CollectionManager(mockPlugin);
  });

  describe('CRUD Operations', () => {
    test('should create a new collection', async () => {
      const collection = {
        name: 'Test Collection',
        description: 'Test'
      };
      
      const created = await manager.create(collection);
      
      expect(created).toHaveProperty('id');
      expect(created.name).toBe('Test Collection');
      expect(created.createdAt).toBeDefined();
      expect(mockStorage.set).toHaveBeenCalled();
    });

    test('should update existing collection', async () => {
      const collection = { id: '123', name: 'Old Name' };
      manager.collections.set('123', collection);
      
      await manager.update('123', { name: 'New Name' });
      
      expect(manager.collections.get('123').name).toBe('New Name');
      expect(mockStorage.set).toHaveBeenCalled();
    });

    test('should delete collection', async () => {
      manager.collections.set('123', { id: '123' });
      
      await manager.delete('123');
      
      expect(manager.collections.has('123')).toBe(false);
      expect(mockStorage.set).toHaveBeenCalled();
    });

    test('should handle delete of non-existent collection', async () => {
      await expect(manager.delete('999')).rejects.toThrow();
    });
  });

  describe('Import/Export', () => {
    test('should export collection', async () => {
      const collection = {
        id: '123',
        name: 'Export Test',
        requests: [
          { method: 'GET', url: 'http://api.test' }
        ]
      };
      manager.collections.set('123', collection);
      
      const exported = await manager.exportCollection('123');
      
      expect(exported).toHaveProperty('version');
      expect(exported).toHaveProperty('collection');
      expect(exported.collection.name).toBe('Export Test');
    });

    test('should import collection', async () => {
      const importData = {
        version: '1.0',
        collection: {
          name: 'Imported',
          requests: []
        }
      };
      
      await manager.importCollection(JSON.stringify(importData));
      
      const imported = Array.from(manager.collections.values())
        .find(c => c.name === 'Imported');
      
      expect(imported).toBeDefined();
      expect(imported.imported).toBe(true);
    });

    test('should validate import format', async () => {
      const invalidData = { invalid: 'format' };
      
      await expect(
        manager.importCollection(JSON.stringify(invalidData))
      ).rejects.toThrow('Invalid collection format');
    });
  });

  describe('Request Management', () => {
    test('should add request to collection', async () => {
      manager.collections.set('123', {
        id: '123',
        requests: []
      });
      
      const request = {
        method: 'POST',
        url: 'http://api.test/users'
      };
      
      await manager.addRequest('123', request);
      
      const collection = manager.collections.get('123');
      expect(collection.requests).toHaveLength(1);
      expect(collection.requests[0]).toMatchObject(request);
    });

    test('should remove request from collection', async () => {
      manager.collections.set('123', {
        id: '123',
        requests: [
          { id: 'req1', method: 'GET' },
          { id: 'req2', method: 'POST' }
        ]
      });
      
      await manager.removeRequest('123', 'req1');
      
      const collection = manager.collections.get('123');
      expect(collection.requests).toHaveLength(1);
      expect(collection.requests[0].id).toBe('req2');
    });
  });

  describe('Validation', () => {
    test('should validate collection name', async () => {
      const invalidCollection = {
        name: '', // Empty name
        description: 'Test'
      };
      
      await expect(manager.create(invalidCollection)).rejects.toThrow();
    });

    test('should validate request format', async () => {
      manager.collections.set('123', { id: '123', requests: [] });
      
      const invalidRequest = {
        // Missing required fields
        headers: {}
      };
      
      await expect(
        manager.addRequest('123', invalidRequest)
      ).rejects.toThrow();
    });

    test('should prevent duplicate collection names', async () => {
      await manager.create({ name: 'Test Collection' });
      
      await expect(
        manager.create({ name: 'Test Collection' })
      ).rejects.toThrow('Collection name already exists');
    });
  });

  describe('Search and Filter', () => {
    beforeEach(() => {
      manager.collections.set('1', {
        id: '1',
        name: 'API Tests',
        description: 'REST API testing',
        tags: ['api', 'rest']
      });
      
      manager.collections.set('2', {
        id: '2',
        name: 'Auth Tests',
        description: 'Authentication testing',
        tags: ['auth', 'security']
      });
    });

    test('should search collections by name', () => {
      const results = manager.search('API');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('API Tests');
    });

    test('should search collections by description', () => {
      const results = manager.search('Authentication');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Auth Tests');
    });

    test('should filter collections by tags', () => {
      const results = manager.filterByTag('api');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('API Tests');
    });

    test('should return empty array for no matches', () => {
      const results = manager.search('NonExistent');
      expect(results).toHaveLength(0);
    });
  });

  describe('Performance', () => {
    test('should handle large collections efficiently', async () => {
      // Create a large collection
      const largeCollection = {
        name: 'Large Collection',
        requests: Array(1000).fill().map((_, i) => ({
          id: `req${i}`,
          method: 'GET',
          url: `http://api.test/endpoint${i}`
        }))
      };
      
      const startTime = performance.now();
      await manager.create(largeCollection);
      const endTime = performance.now();
      
      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(1000);
    });

    test('should efficiently search through many collections', () => {
      // Add many collections
      for (let i = 0; i < 100; i++) {
        manager.collections.set(`${i}`, {
          id: `${i}`,
          name: `Collection ${i}`,
          description: `Test collection ${i}`
        });
      }
      
      const startTime = performance.now();
      const results = manager.search('Collection 50');
      const endTime = performance.now();
      
      expect(results).toHaveLength(1);
      expect(endTime - startTime).toBeLessThan(100); // Should be very fast
    });
  });
});