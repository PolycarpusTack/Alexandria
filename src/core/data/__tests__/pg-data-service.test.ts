/**
 * Comprehensive Test Suite for PostgreSQL Data Service
 * 
 * This test suite provides complete coverage for the PostgresDataService class,
 * testing CRUD operations, security validation, transaction handling, error scenarios,
 * and performance characteristics.
 */

import { PostgresDataService } from '../pg-data-service';
import { Logger } from '../../../utils/logger';
import { Pool, Client, PoolConfig } from 'pg';
import { DatabaseConfig } from '../database-config';
import { AlexandriaError, DatabaseError, ValidationError } from '../../errors';

// Mock pg module
jest.mock('pg', () => ({
  Pool: jest.fn(),
  Client: jest.fn()
}));

describe('PostgresDataService', () => {
  let dataService: PostgresDataService;
  let mockLogger: jest.Mocked<Logger>;
  let mockPool: jest.Mocked<Pool>;
  let mockClient: jest.Mocked<Client>;
  let mockConfig: DatabaseConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup logger mock
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      child: jest.fn(() => mockLogger)
    } as any;
    
    // Setup pool mock
    mockPool = {
      connect: jest.fn(),
      end: jest.fn(),
      query: jest.fn(),
      on: jest.fn(),
      totalCount: 10,
      idleCount: 5,
      waitingCount: 0
    } as any;
    
    // Setup client mock
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
      on: jest.fn()
    } as any;
    
    (Pool as jest.MockedClass<typeof Pool>).mockImplementation(() => mockPool);
    
    // Setup config
    mockConfig = {
      host: 'localhost',
      port: 5432,
      database: 'test_db',
      username: 'test_user',
      password: 'test_pass',
      ssl: false,
      maxConnections: 10,
      connectionTimeout: 5000,
      idleTimeout: 30000,
      statementTimeout: 60000
    };
    
    dataService = new PostgresDataService(mockConfig, mockLogger);
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const service = new PostgresDataService({} as DatabaseConfig, mockLogger);
      expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
        host: 'localhost',
        port: 5432,
        database: 'alexandria',
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        statement_timeout: 60000
      }));
    });

    it('should initialize with custom configuration', () => {
      const customConfig = {
        host: 'custom-host',
        port: 3306,
        database: 'custom_db',
        username: 'custom_user',
        password: 'custom_pass',
        ssl: true,
        maxConnections: 20,
        connectionTimeout: 10000,
        idleTimeout: 60000,
        statementTimeout: 120000
      };
      
      const service = new PostgresDataService(customConfig, mockLogger);
      
      expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
        host: 'custom-host',
        port: 3306,
        database: 'custom_db',
        user: 'custom_user',
        password: 'custom_pass',
        ssl: true,
        max: 20,
        idleTimeoutMillis: 60000,
        connectionTimeoutMillis: 10000,
        statement_timeout: 120000
      }));
    });

    it('should setup pool event handlers', async () => {
      await dataService.initialize();
      
      expect(mockPool.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockPool.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockPool.on).toHaveBeenCalledWith('remove', expect.any(Function));
    });

    it('should handle pool connection errors', async () => {
      const errorHandler = jest.fn();
      mockPool.on.mockImplementation((event, handler) => {
        if (event === 'error') {
          errorHandler.mockImplementation(handler);
        }
      });
      
      await dataService.initialize();
      
      const testError = new Error('Connection failed');
      errorHandler(testError);
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Database pool error',
        expect.objectContaining({
          error: testError.message
        })
      );
    });

    it('should throw error if already initialized', async () => {
      await dataService.initialize();
      
      await expect(dataService.initialize()).rejects.toThrow(
        'Data service is already initialized'
      );
    });
  });

  describe('Connection Management', () => {
    beforeEach(async () => {
      await dataService.initialize();
    });

    it('should get client from pool', async () => {
      mockPool.connect.mockResolvedValue(mockClient);
      
      const client = await (dataService as any).getClient();
      
      expect(mockPool.connect).toHaveBeenCalled();
      expect(client).toBe(mockClient);
    });

    it('should handle connection timeout', async () => {
      mockPool.connect.mockRejectedValue(new Error('Connection timeout'));
      
      await expect((dataService as any).getClient()).rejects.toThrow(
        DatabaseError
      );
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get database client',
        expect.any(Object)
      );
    });

    it('should release client properly', async () => {
      await (dataService as any).releaseClient(mockClient);
      
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle client release errors', async () => {
      mockClient.release.mockImplementation(() => {
        throw new Error('Release failed');
      });
      
      await (dataService as any).releaseClient(mockClient);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to release database client',
        expect.any(Object)
      );
    });
  });

  describe('CRUD Operations', () => {
    beforeEach(async () => {
      await dataService.initialize();
      mockPool.connect.mockResolvedValue(mockClient);
    });

    describe('create', () => {
      it('should create entity successfully', async () => {
        const mockResult = {
          rows: [{ id: '123', name: 'Test Entity', created_at: new Date() }],
          rowCount: 1
        };
        mockClient.query.mockResolvedValue(mockResult);
        
        const result = await dataService.create('test_table', {
          name: 'Test Entity',
          description: 'Test Description'
        });
        
        expect(result).toEqual(mockResult.rows[0]);
        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO test_table'),
          expect.any(Array)
        );
      });

      it('should handle creation with reserved SQL keywords', async () => {
        const mockResult = {
          rows: [{ id: '123', name: 'Test' }],
          rowCount: 1
        };
        mockClient.query.mockResolvedValue(mockResult);
        
        await dataService.create('test_table', {
          'order': 'Test Order',
          'select': 'Test Select'
        });
        
        const queryCall = mockClient.query.mock.calls[0];
        const query = queryCall[0];
        
        // Should properly quote reserved keywords
        expect(query).toContain('"order"');
        expect(query).toContain('"select"');
      });

      it('should validate entity data', async () => {
        await expect(dataService.create('test_table', null as any))
          .rejects.toThrow(ValidationError);
        
        await expect(dataService.create('test_table', {} as any))
          .rejects.toThrow(ValidationError);
      });

      it('should handle database constraints', async () => {
        const constraintError = new Error('duplicate key value violates unique constraint');
        (constraintError as any).code = '23505';
        mockClient.query.mockRejectedValue(constraintError);
        
        await expect(dataService.create('test_table', { name: 'Test' }))
          .rejects.toThrow(DatabaseError);
      });

      it('should prevent SQL injection in table name', async () => {
        await expect(dataService.create('test_table; DROP TABLE users; --', { name: 'Test' }))
          .rejects.toThrow(ValidationError);
      });
    });

    describe('findById', () => {
      it('should find entity by ID', async () => {
        const mockResult = {
          rows: [{ id: '123', name: 'Test Entity' }],
          rowCount: 1
        };
        mockClient.query.mockResolvedValue(mockResult);
        
        const result = await dataService.findById('test_table', '123');
        
        expect(result).toEqual(mockResult.rows[0]);
        expect(mockClient.query).toHaveBeenCalledWith(
          'SELECT * FROM test_table WHERE id = $1',
          ['123']
        );
      });

      it('should return null for non-existent entity', async () => {
        const mockResult = { rows: [], rowCount: 0 };
        mockClient.query.mockResolvedValue(mockResult);
        
        const result = await dataService.findById('test_table', 'non-existent');
        
        expect(result).toBeNull();
      });

      it('should validate ID parameter', async () => {
        await expect(dataService.findById('test_table', null as any))
          .rejects.toThrow(ValidationError);
        
        await expect(dataService.findById('test_table', ''))
          .rejects.toThrow(ValidationError);
      });
    });

    describe('findAll', () => {
      it('should find all entities', async () => {
        const mockResult = {
          rows: [
            { id: '1', name: 'Entity 1' },
            { id: '2', name: 'Entity 2' }
          ],
          rowCount: 2
        };
        mockClient.query.mockResolvedValue(mockResult);
        
        const result = await dataService.findAll('test_table');
        
        expect(result).toEqual(mockResult.rows);
        expect(mockClient.query).toHaveBeenCalledWith(
          'SELECT * FROM test_table',
          []
        );
      });

      it('should handle empty results', async () => {
        const mockResult = { rows: [], rowCount: 0 };
        mockClient.query.mockResolvedValue(mockResult);
        
        const result = await dataService.findAll('test_table');
        
        expect(result).toEqual([]);
      });

      it('should apply filters', async () => {
        const mockResult = { rows: [{ id: '1', name: 'Test' }], rowCount: 1 };
        mockClient.query.mockResolvedValue(mockResult);
        
        await dataService.findAll('test_table', { name: 'Test', active: true });
        
        expect(mockClient.query).toHaveBeenCalledWith(
          'SELECT * FROM test_table WHERE name = $1 AND active = $2',
          ['Test', true]
        );
      });

      it('should handle complex filter values', async () => {
        const mockResult = { rows: [], rowCount: 0 };
        mockClient.query.mockResolvedValue(mockResult);
        
        await dataService.findAll('test_table', {
          tags: ['tag1', 'tag2'],
          count: 0,
          nullable: null
        });
        
        const queryCall = mockClient.query.mock.calls[0];
        const query = queryCall[0];
        const params = queryCall[1];
        
        expect(query).toContain('tags = $1');
        expect(query).toContain('count = $2');
        expect(query).toContain('nullable IS NULL');
        expect(params).toContain(JSON.stringify(['tag1', 'tag2']));
        expect(params).toContain(0);
        expect(params).not.toContain(null);
      });
    });

    describe('update', () => {
      it('should update entity successfully', async () => {
        const mockResult = {
          rows: [{ id: '123', name: 'Updated Entity', updated_at: new Date() }],
          rowCount: 1
        };
        mockClient.query.mockResolvedValue(mockResult);
        
        const result = await dataService.update('test_table', '123', {
          name: 'Updated Entity',
          description: 'Updated Description'
        });
        
        expect(result).toEqual(mockResult.rows[0]);
        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE test_table SET'),
          expect.arrayContaining(['Updated Entity', 'Updated Description', '123'])
        );
      });

      it('should handle no rows affected', async () => {
        const mockResult = { rows: [], rowCount: 0 };
        mockClient.query.mockResolvedValue(mockResult);
        
        const result = await dataService.update('test_table', 'non-existent', {
          name: 'Updated'
        });
        
        expect(result).toBeNull();
      });

      it('should validate update data', async () => {
        await expect(dataService.update('test_table', '123', null as any))
          .rejects.toThrow(ValidationError);
        
        await expect(dataService.update('test_table', '123', {}))
          .rejects.toThrow(ValidationError);
      });

      it('should handle reserved SQL keywords in updates', async () => {
        const mockResult = { rows: [{ id: '123' }], rowCount: 1 };
        mockClient.query.mockResolvedValue(mockResult);
        
        await dataService.update('test_table', '123', {
          'order': 'new order',
          'group': 'new group'
        });
        
        const queryCall = mockClient.query.mock.calls[0];
        const query = queryCall[0];
        
        expect(query).toContain('"order" = $1');
        expect(query).toContain('"group" = $2');
      });
    });

    describe('delete', () => {
      it('should delete entity successfully', async () => {
        const mockResult = { rowCount: 1 };
        mockClient.query.mockResolvedValue(mockResult);
        
        const result = await dataService.delete('test_table', '123');
        
        expect(result).toBe(true);
        expect(mockClient.query).toHaveBeenCalledWith(
          'DELETE FROM test_table WHERE id = $1',
          ['123']
        );
      });

      it('should return false for non-existent entity', async () => {
        const mockResult = { rowCount: 0 };
        mockClient.query.mockResolvedValue(mockResult);
        
        const result = await dataService.delete('test_table', 'non-existent');
        
        expect(result).toBe(false);
      });

      it('should validate ID parameter', async () => {
        await expect(dataService.delete('test_table', null as any))
          .rejects.toThrow(ValidationError);
      });
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      await dataService.initialize();
      mockPool.connect.mockResolvedValue(mockClient);
    });

    describe('query', () => {
      it('should execute raw query successfully', async () => {
        const mockResult = {
          rows: [{ count: 5 }],
          rowCount: 1
        };
        mockClient.query.mockResolvedValue(mockResult);
        
        const result = await dataService.query(
          'SELECT COUNT(*) as count FROM test_table WHERE active = $1',
          [true]
        );
        
        expect(result).toEqual(mockResult);
        expect(mockClient.query).toHaveBeenCalledWith(
          'SELECT COUNT(*) as count FROM test_table WHERE active = $1',
          [true]
        );
      });

      it('should handle query without parameters', async () => {
        const mockResult = { rows: [], rowCount: 0 };
        mockClient.query.mockResolvedValue(mockResult);
        
        await dataService.query('SELECT version()');
        
        expect(mockClient.query).toHaveBeenCalledWith('SELECT version()', []);
      });

      it('should prevent dangerous queries', async () => {
        const dangerousQueries = [
          'DROP TABLE users',
          'TRUNCATE test_table',
          'DELETE FROM users WHERE 1=1',
          'ALTER TABLE users ADD COLUMN'
        ];
        
        for (const query of dangerousQueries) {
          await expect(dataService.query(query))
            .rejects.toThrow(ValidationError);
        }
      });

      it('should handle query timeout', async () => {
        const timeoutError = new Error('Query timeout');
        (timeoutError as any).code = 'QUERY_TIMEOUT';
        mockClient.query.mockRejectedValue(timeoutError);
        
        await expect(dataService.query('SELECT * FROM large_table'))
          .rejects.toThrow(DatabaseError);
      });
    });

    describe('count', () => {
      it('should count all records', async () => {
        const mockResult = { rows: [{ count: '10' }], rowCount: 1 };
        mockClient.query.mockResolvedValue(mockResult);
        
        const result = await dataService.count('test_table');
        
        expect(result).toBe(10);
        expect(mockClient.query).toHaveBeenCalledWith(
          'SELECT COUNT(*) as count FROM test_table',
          []
        );
      });

      it('should count with filters', async () => {
        const mockResult = { rows: [{ count: '5' }], rowCount: 1 };
        mockClient.query.mockResolvedValue(mockResult);
        
        const result = await dataService.count('test_table', { active: true });
        
        expect(result).toBe(5);
        expect(mockClient.query).toHaveBeenCalledWith(
          'SELECT COUNT(*) as count FROM test_table WHERE active = $1',
          [true]
        );
      });
    });

    describe('exists', () => {
      it('should return true if record exists', async () => {
        const mockResult = { rows: [{ exists: true }], rowCount: 1 };
        mockClient.query.mockResolvedValue(mockResult);
        
        const result = await dataService.exists('test_table', '123');
        
        expect(result).toBe(true);
        expect(mockClient.query).toHaveBeenCalledWith(
          'SELECT EXISTS(SELECT 1 FROM test_table WHERE id = $1) as exists',
          ['123']
        );
      });

      it('should return false if record does not exist', async () => {
        const mockResult = { rows: [{ exists: false }], rowCount: 1 };
        mockClient.query.mockResolvedValue(mockResult);
        
        const result = await dataService.exists('test_table', 'non-existent');
        
        expect(result).toBe(false);
      });
    });
  });

  describe('Transaction Management', () => {
    beforeEach(async () => {
      await dataService.initialize();
      mockPool.connect.mockResolvedValue(mockClient);
    });

    describe('transaction', () => {
      it('should execute transaction successfully', async () => {
        const mockResult1 = { rows: [{ id: '1' }], rowCount: 1 };
        const mockResult2 = { rows: [{ id: '2' }], rowCount: 1 };
        
        mockClient.query
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
          .mockResolvedValueOnce(mockResult1) // First operation
          .mockResolvedValueOnce(mockResult2) // Second operation
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // COMMIT
        
        const result = await dataService.transaction(async (client) => {
          const result1 = await client.query('INSERT INTO table1 VALUES ($1)', ['value1']);
          const result2 = await client.query('INSERT INTO table2 VALUES ($1)', ['value2']);
          return { result1, result2 };
        });
        
        expect(result).toEqual({ result1: mockResult1, result2: mockResult2 });
        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
        expect(mockClient.release).toHaveBeenCalled();
      });

      it('should rollback on error', async () => {
        const transactionError = new Error('Transaction failed');
        
        mockClient.query
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
          .mockRejectedValueOnce(transactionError) // Failed operation
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // ROLLBACK
        
        await expect(dataService.transaction(async (client) => {
          await client.query('INSERT INTO table1 VALUES ($1)', ['value1']);
          throw transactionError;
        })).rejects.toThrow(transactionError);
        
        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
        expect(mockClient.release).toHaveBeenCalled();
      });

      it('should handle nested transactions', async () => {
        mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });
        
        await dataService.transaction(async (client) => {
          await client.query('INSERT INTO table1 VALUES ($1)', ['value1']);
          
          // Nested transaction should use savepoints
          await dataService.transaction(async (nestedClient) => {
            await nestedClient.query('INSERT INTO table2 VALUES ($1)', ['value2']);
          });
        });
        
        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith('SAVEPOINT sp_1');
        expect(mockClient.query).toHaveBeenCalledWith('RELEASE SAVEPOINT sp_1');
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      });

      it('should rollback to savepoint on nested error', async () => {
        const nestedError = new Error('Nested operation failed');
        
        mockClient.query
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // First insert
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // SAVEPOINT
          .mockRejectedValueOnce(nestedError) // Failed nested operation
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // ROLLBACK TO SAVEPOINT
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // COMMIT
        
        await dataService.transaction(async (client) => {
          await client.query('INSERT INTO table1 VALUES ($1)', ['value1']);
          
          try {
            await dataService.transaction(async (nestedClient) => {
              await nestedClient.query('INSERT INTO table2 VALUES ($1)', ['value2']);
              throw nestedError;
            });
          } catch (error) {
            // Handle nested error but continue main transaction
          }
        });
        
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT sp_1');
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      });
    });
  });

  describe('Security and Validation', () => {
    beforeEach(async () => {
      await dataService.initialize();
    });

    describe('safeColumnName', () => {
      it('should validate safe column names', () => {
        const safeNames = ['id', 'user_name', 'createdAt', 'table123', 'column_with_underscore'];
        
        safeNames.forEach(name => {
          expect(() => (dataService as any).safeColumnName(name)).not.toThrow();
        });
      });

      it('should reject unsafe column names', () => {
        const unsafeNames = [
          'user; DROP TABLE',
          'column--comment',
          'col"quote',
          "col'quote",
          'col\\slash',
          'col name', // space
          '1column', // starts with number
          '', // empty
          'col*wildcard'
        ];
        
        unsafeNames.forEach(name => {
          expect(() => (dataService as any).safeColumnName(name))
            .toThrow(ValidationError);
        });
      });
    });

    describe('safeTableName', () => {
      it('should validate safe table names', () => {
        const safeNames = ['users', 'user_profiles', 'table123', 'CamelCase'];
        
        safeNames.forEach(name => {
          expect(() => (dataService as any).safeTableName(name)).not.toThrow();
        });
      });

      it('should reject unsafe table names', () => {
        const unsafeNames = [
          'users; DROP DATABASE',
          'table--comment',
          'tab"le',
          "tab'le",
          'table name', // space
          '', // empty
          '123table' // starts with number
        ];
        
        unsafeNames.forEach(name => {
          expect(() => (dataService as any).safeTableName(name))
            .toThrow(ValidationError);
        });
      });
    });

    describe('SQL Injection Prevention', () => {
      it('should use parameterized queries for all operations', async () => {
        mockPool.connect.mockResolvedValue(mockClient);
        mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });
        
        // Test various operations
        await dataService.create('users', { name: "O'Connor; DROP TABLE users;" });
        await dataService.findAll('users', { role: "admin'; DELETE FROM users; --" });
        await dataService.update('users', '123', { bio: "<script>alert('xss')</script>" });
        
        // Verify all queries use parameters
        mockClient.query.mock.calls.forEach(([query, params]) => {
          expect(query).not.toContain("O'Connor");
          expect(query).not.toContain('DROP TABLE');
          expect(query).not.toContain('DELETE FROM');
          expect(query).not.toContain('<script>');
          expect(params).toBeInstanceOf(Array);
        });
      });
    });
  });

  describe('Performance and Monitoring', () => {
    beforeEach(async () => {
      await dataService.initialize();
    });

    describe('getHealth', () => {
      it('should return healthy status when pool is working', async () => {
        mockPool.connect.mockResolvedValue(mockClient);
        mockClient.query.mockResolvedValue({ rows: [{ version: 'PostgreSQL 13.4' }] });
        
        const health = await dataService.getHealth();
        
        expect(health).toEqual({
          status: 'healthy',
          database: 'test_db',
          connections: {
            total: 10,
            idle: 5,
            waiting: 0
          },
          version: 'PostgreSQL 13.4',
          timestamp: expect.any(Date)
        });
      });

      it('should return unhealthy status on connection failure', async () => {
        mockPool.connect.mockRejectedValue(new Error('Connection failed'));
        
        const health = await dataService.getHealth();
        
        expect(health.status).toBe('unhealthy');
        expect(health.error).toContain('Connection failed');
      });
    });

    describe('getStats', () => {
      it('should return connection pool statistics', () => {
        const stats = dataService.getStats();
        
        expect(stats).toEqual({
          totalConnections: 10,
          idleConnections: 5,
          waitingClients: 0,
          initialized: true
        });
      });
    });

    describe('Query Performance', () => {
      it('should log slow queries', async () => {
        mockPool.connect.mockResolvedValue(mockClient);
        
        // Mock a slow query (> 1000ms)
        mockClient.query.mockImplementation(() => 
          new Promise(resolve => 
            setTimeout(() => resolve({ rows: [], rowCount: 0 }), 1100)
          )
        );
        
        await dataService.query('SELECT * FROM large_table');
        
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Slow query detected',
          expect.objectContaining({
            duration: expect.any(Number),
            query: 'SELECT * FROM large_table'
          })
        );
      });

      it('should handle concurrent operations efficiently', async () => {
        mockPool.connect.mockResolvedValue(mockClient);
        mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });
        
        const operations = Array(10).fill(null).map((_, i) =>
          dataService.findById('test_table', `id-${i}`)
        );
        
        const results = await Promise.all(operations);
        
        expect(results).toHaveLength(10);
        expect(mockPool.connect).toHaveBeenCalledTimes(10);
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await dataService.initialize();
    });

    it('should handle connection errors gracefully', async () => {
      mockPool.connect.mockRejectedValue(new Error('ECONNREFUSED'));
      
      await expect(dataService.findById('test_table', '123'))
        .rejects.toThrow(DatabaseError);
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get database client',
        expect.any(Object)
      );
    });

    it('should handle constraint violations', async () => {
      mockPool.connect.mockResolvedValue(mockClient);
      
      const constraintError = new Error('duplicate key value violates unique constraint "users_email_key"');
      (constraintError as any).code = '23505';
      (constraintError as any).constraint = 'users_email_key';
      
      mockClient.query.mockRejectedValue(constraintError);
      
      await expect(dataService.create('users', { email: 'test@test.com' }))
        .rejects.toThrow(DatabaseError);
    });

    it('should handle foreign key violations', async () => {
      mockPool.connect.mockResolvedValue(mockClient);
      
      const fkError = new Error('insert or update on table "posts" violates foreign key constraint');
      (fkError as any).code = '23503';
      
      mockClient.query.mockRejectedValue(fkError);
      
      await expect(dataService.create('posts', { user_id: 'invalid' }))
        .rejects.toThrow(DatabaseError);
    });

    it('should handle serialization failures in transactions', async () => {
      mockPool.connect.mockResolvedValue(mockClient);
      
      const serializationError = new Error('could not serialize access due to concurrent update');
      (serializationError as any).code = '40001';
      
      mockClient.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
        .mockRejectedValueOnce(serializationError); // Operation fails
      
      await expect(dataService.transaction(async (client) => {
        await client.query('UPDATE accounts SET balance = balance - 100 WHERE id = $1', ['1']);
      })).rejects.toThrow(DatabaseError);
    });
  });

  describe('Cleanup and Shutdown', () => {
    it('should shutdown pool cleanly', async () => {
      await dataService.initialize();
      
      await dataService.shutdown();
      
      expect(mockPool.end).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Database connection pool closed');
    });

    it('should handle shutdown errors', async () => {
      await dataService.initialize();
      
      mockPool.end.mockRejectedValue(new Error('Pool shutdown failed'));
      
      await dataService.shutdown();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error closing database pool',
        expect.any(Object)
      );
    });

    it('should handle shutdown when not initialized', async () => {
      await dataService.shutdown();
      
      expect(mockPool.end).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Database connection pool closed');
    });
  });
});