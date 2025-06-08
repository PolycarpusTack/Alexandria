import { PostgresDataService } from '../pg-data-service';
import { ConnectionPool } from '../connection-pool';
import { MigrationRunner } from '../migrations/migration-runner';
import { logger } from '../../../utils/logger';
import { User } from '../../system/interfaces';

// Mock dependencies
jest.mock('../connection-pool');
jest.mock('../migrations/migration-runner');
jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('PostgresDataService', () => {
  let dataService: PostgresDataService;
  let mockConnectionPool: jest.Mocked<ConnectionPool>;
  
  const testOptions = {
    host: 'localhost',
    port: 5432,
    database: 'test',
    user: 'test',
    password: 'test',
    runMigrations: false
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock connection pool
    mockConnectionPool = {
      initialize: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
      query: jest.fn(),
      transaction: jest.fn(),
      getClient: jest.fn(),
      getStats: jest.fn(),
      isHealthy: jest.fn()
    } as any;

    // Mock ConnectionPool constructor
    (ConnectionPool as jest.MockedClass<typeof ConnectionPool>).mockImplementation(() => mockConnectionPool);
    
    // Create data service
    dataService = new PostgresDataService(testOptions, logger);
  });

  describe('initialize', () => {
    it('should initialize connection pool', async () => {
      await dataService.initialize();
      
      expect(mockConnectionPool.initialize).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith('PostgreSQL data service initialized successfully');
    });

    it('should throw error if already initialized', async () => {
      await dataService.initialize();
      
      await expect(dataService.initialize()).rejects.toThrow('PostgreSQL data service is already initialized');
    });

    it('should run migrations if enabled', async () => {
      const optionsWithMigrations = { ...testOptions, runMigrations: true };
      const serviceWithMigrations = new PostgresDataService(optionsWithMigrations, logger);
      
      const mockRunner = {
        runMigrations: jest.fn().mockResolvedValue(undefined)
      };
      
      (MigrationRunner as jest.MockedClass<typeof MigrationRunner>).mockImplementation(() => mockRunner as any);
      
      await serviceWithMigrations.initialize();
      
      expect(mockRunner.runMigrations).toHaveBeenCalledTimes(1);
    });
  });

  describe('disconnect', () => {
    it('should shutdown connection pool', async () => {
      await dataService.initialize();
      await dataService.disconnect();
      
      expect(mockConnectionPool.shutdown).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith('PostgreSQL connection closed successfully');
    });

    it('should throw error if not initialized', async () => {
      await expect(dataService.disconnect()).rejects.toThrow('PostgreSQL data service is not initialized');
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      await dataService.initialize();
    });

    it('should execute query without transaction', async () => {
      const mockResult = {
        rows: [{ id: 1, name: 'test' }],
        rowCount: 1
      };
      
      mockConnectionPool.query.mockResolvedValue(mockResult);
      
      const result = await dataService.query('SELECT * FROM test');
      
      expect(mockConnectionPool.query).toHaveBeenCalledWith('SELECT * FROM test', undefined);
      expect(result.rows).toEqual(mockResult.rows);
      expect(result.rowCount).toBe(1);
    });

    it('should execute query with transaction', async () => {
      const mockResult = {
        rows: [{ id: 1, name: 'test' }],
        rowCount: 1,
        fields: [{ name: 'id', dataTypeID: 23 }]
      };
      
      mockConnectionPool.transaction.mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue(mockResult)
        };
        return callback(mockClient as any);
      });
      
      const result = await dataService.query('SELECT * FROM test', [], { useTransaction: true });
      
      expect(mockConnectionPool.transaction).toHaveBeenCalled();
      expect(result.rows).toEqual(mockResult.rows);
    });

    it('should throw error if not initialized', async () => {
      await dataService.disconnect();
      
      await expect(dataService.query('SELECT 1')).rejects.toThrow('PostgreSQL data service is not initialized');
    });
  });

  describe('find', () => {
    beforeEach(async () => {
      await dataService.initialize();
      
      mockConnectionPool.query.mockResolvedValue({
        rows: [
          { id: '1', name: 'User 1' },
          { id: '2', name: 'User 2' }
        ],
        rowCount: 2
      });
    });

    it('should find entities without criteria', async () => {
      const result = await dataService.find('users');
      
      expect(mockConnectionPool.query).toHaveBeenCalledWith(
        'SELECT * FROM "users"',
        []
      );
      expect(result).toHaveLength(2);
    });

    it('should find entities with criteria', async () => {
      const result = await dataService.find('users', { active: true });
      
      expect(mockConnectionPool.query).toHaveBeenCalledWith(
        'SELECT * FROM "users" WHERE "active" = $1',
        [true]
      );
    });

    it('should handle null values in criteria', async () => {
      const result = await dataService.find('users', { deleted_at: null });
      
      expect(mockConnectionPool.query).toHaveBeenCalledWith(
        'SELECT * FROM "users" WHERE "deleted_at" IS NULL',
        []
      );
    });

    it('should apply ordering and pagination', async () => {
      const result = await dataService.find('users', {}, {
        orderBy: 'created_at',
        orderDirection: 'DESC',
        limit: 10,
        offset: 20
      });
      
      expect(mockConnectionPool.query).toHaveBeenCalledWith(
        'SELECT * FROM "users" ORDER BY "created_at" DESC LIMIT 10 OFFSET 20',
        []
      );
    });
  });

  describe('create', () => {
    beforeEach(async () => {
      await dataService.initialize();
      
      mockConnectionPool.query.mockResolvedValue({
        rows: [{ id: '123', name: 'New User', email: 'test@example.com' }],
        rowCount: 1
      });
    });

    it('should create new entity', async () => {
      const data = { name: 'New User', email: 'test@example.com' };
      const result = await dataService.create('users', data);
      
      expect(mockConnectionPool.query).toHaveBeenCalledWith(
        'INSERT INTO "users" ("name", "email") VALUES ($1, $2) RETURNING *',
        ['New User', 'test@example.com']
      );
      expect(result.id).toBe('123');
    });

    it('should use provided id if given', async () => {
      const data = { id: '456', name: 'User with ID' };
      await dataService.create('users', data);
      
      expect(mockConnectionPool.query).toHaveBeenCalledWith(
        'INSERT INTO "users" ("id", "name") VALUES ($1, $2) RETURNING *',
        ['456', 'User with ID']
      );
    });
  });

  describe('update', () => {
    beforeEach(async () => {
      await dataService.initialize();
      
      mockConnectionPool.query.mockResolvedValue({
        rows: [{ id: '123', name: 'Updated User' }],
        rowCount: 1
      });
    });

    it('should update entity', async () => {
      const result = await dataService.update('users', '123', { name: 'Updated User' });
      
      expect(mockConnectionPool.query).toHaveBeenCalledWith(
        'UPDATE "users" SET "name" = $1 WHERE id = $2 RETURNING *',
        ['Updated User', '123']
      );
      expect(result.name).toBe('Updated User');
    });

    it('should throw error if entity not found', async () => {
      mockConnectionPool.query.mockResolvedValue({
        rows: [],
        rowCount: 0
      });
      
      await expect(dataService.update('users', '999', { name: 'Test' }))
        .rejects.toThrow('Entity not found: users with ID 999');
    });
  });

  describe('delete', () => {
    beforeEach(async () => {
      await dataService.initialize();
    });

    it('should delete entity and return true', async () => {
      mockConnectionPool.query.mockResolvedValue({
        rows: [],
        rowCount: 1
      });
      
      const result = await dataService.delete('users', '123');
      
      expect(mockConnectionPool.query).toHaveBeenCalledWith(
        'DELETE FROM "users" WHERE id = $1',
        ['123']
      );
      expect(result).toBe(true);
    });

    it('should return false if entity not found', async () => {
      mockConnectionPool.query.mockResolvedValue({
        rows: [],
        rowCount: 0
      });
      
      const result = await dataService.delete('users', '999');
      expect(result).toBe(false);
    });
  });

  describe('repository integration', () => {
    beforeEach(async () => {
      await dataService.initialize();
    });

    it('should have user repository', () => {
      expect(dataService.users).toBeDefined();
      expect(dataService.users.findById).toBeDefined();
      expect(dataService.users.findByUsername).toBeDefined();
    });

    it('should have case repository', () => {
      expect(dataService.cases).toBeDefined();
      expect(dataService.cases.findById).toBeDefined();
      expect(dataService.cases.findByStatus).toBeDefined();
    });

    it('should have log repository', () => {
      expect(dataService.logs).toBeDefined();
      expect(dataService.logs.create).toBeDefined();
      expect(dataService.logs.findByDateRange).toBeDefined();
    });

    it('should have plugin storage repository', () => {
      expect(dataService.pluginStorage).toBeDefined();
      expect(dataService.pluginStorage.get).toBeDefined();
      expect(dataService.pluginStorage.set).toBeDefined();
    });
  });
});