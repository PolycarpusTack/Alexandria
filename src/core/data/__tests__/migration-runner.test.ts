/**
 * Database Migration Runner Test Suite
 *
 * This test suite provides comprehensive testing for database migrations,
 * rollbacks, and migration management functionality.
 */

import { Pool, PoolClient } from 'pg';
import { MigrationRunner, Migration, MigrationRecord } from '../migrations/migration-runner';
import { Logger } from '../../../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('pg');

describe('MigrationRunner', () => {
  let migrationRunner: MigrationRunner;
  let mockPool: jest.Mocked<Pool>;
  let mockClient: jest.Mocked<PoolClient>;
  let mockLogger: jest.Mocked<Logger>;
  let mockFs: jest.Mocked<typeof fs>;
  let testMigrationsPath: string;

  const sampleMigrations: Migration[] = [
    {
      id: '1735561200000_initial_schema',
      name: 'initial_schema',
      timestamp: 1735561200000,
      up: `
        CREATE TABLE users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          username VARCHAR(255) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `,
      down: 'DROP TABLE users;'
    },
    {
      id: '1735561300000_add_user_roles',
      name: 'add_user_roles',
      timestamp: 1735561300000,
      up: `
        ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user';
        CREATE INDEX idx_users_role ON users(role);
      `,
      down: `
        DROP INDEX idx_users_role;
        ALTER TABLE users DROP COLUMN role;
      `
    },
    {
      id: '1735561400000_create_logs_table',
      name: 'create_logs_table',
      timestamp: 1735561400000,
      up: `
        CREATE TABLE logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          level VARCHAR(20) NOT NULL,
          message TEXT NOT NULL,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          context JSONB
        );
        CREATE INDEX idx_logs_level ON logs(level);
        CREATE INDEX idx_logs_timestamp ON logs(timestamp);
      `,
      down: 'DROP TABLE logs;'
    }
  ];

  beforeEach(() => {
    // Setup mocks
    mockFs = fs as jest.Mocked<typeof fs>;

    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    } as any;

    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
      query: jest.fn(),
      end: jest.fn()
    } as any;

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      child: jest.fn(() => mockLogger)
    } as any;

    testMigrationsPath = '/test/migrations';
    migrationRunner = new MigrationRunner(mockPool, mockLogger, testMigrationsPath);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with required dependencies', () => {
      expect(migrationRunner).toBeInstanceOf(MigrationRunner);
    });

    it('should use default migrations path if not provided', () => {
      const defaultRunner = new MigrationRunner(mockPool, mockLogger);
      expect(defaultRunner).toBeInstanceOf(MigrationRunner);
    });
  });

  describe('initialize', () => {
    it('should create migrations table successfully', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      await migrationRunner.initialize();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS migrations')
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Migration table initialized', {
        component: 'MigrationRunner'
      });
    });

    it('should handle database errors during initialization', async () => {
      const dbError = new Error('Database connection failed');
      mockPool.query.mockRejectedValueOnce(dbError);

      await expect(migrationRunner.initialize()).rejects.toThrow(dbError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize migration table',
        expect.objectContaining({
          component: 'MigrationRunner',
          error: 'Database connection failed'
        })
      );
    });
  });

  describe('loadMigrations', () => {
    beforeEach(() => {
      // Mock file system operations
      mockFs.readdir.mockResolvedValue([
        '1735561200000_initial_schema.sql',
        '1735561300000_add_user_roles.sql',
        '1735561400000_create_logs_table.sql',
        'invalid_file.txt' // Should be filtered out
      ] as any);

      mockFs.readFile
        .mockResolvedValueOnce(
          '-- UP\nCREATE TABLE users (id UUID PRIMARY KEY);\n-- DOWN\nDROP TABLE users;'
        )
        .mockResolvedValueOnce(
          '-- UP\nALTER TABLE users ADD COLUMN role VARCHAR(50);\n-- DOWN\nALTER TABLE users DROP COLUMN role;'
        )
        .mockResolvedValueOnce(
          '-- UP\nCREATE TABLE logs (id UUID PRIMARY KEY);\n-- DOWN\nDROP TABLE logs;'
        );
    });

    it('should load and parse migration files correctly', async () => {
      const migrations = await (migrationRunner as any).loadMigrations();

      expect(migrations).toHaveLength(3);
      expect(migrations[0]).toEqual({
        id: '1735561200000_initial_schema',
        name: 'initial_schema',
        timestamp: 1735561200000,
        up: 'CREATE TABLE users (id UUID PRIMARY KEY);',
        down: 'DROP TABLE users;'
      });

      expect(mockFs.readdir).toHaveBeenCalledWith(testMigrationsPath);
      expect(mockFs.readFile).toHaveBeenCalledTimes(3);
    });

    it('should filter out non-SQL files', async () => {
      await (migrationRunner as any).loadMigrations();

      // Should only read .sql files
      expect(mockFs.readFile).toHaveBeenCalledTimes(3);
      expect(mockFs.readFile).not.toHaveBeenCalledWith(
        expect.stringContaining('invalid_file.txt'),
        'utf-8'
      );
    });

    it('should handle missing DOWN section', async () => {
      mockFs.readdir.mockResolvedValue(['1735561200000_test.sql'] as any);
      mockFs.readFile.mockResolvedValueOnce('-- UP\nCREATE TABLE test (id UUID);');

      const migrations = await (migrationRunner as any).loadMigrations();

      expect(migrations[0].down).toBe('');
    });

    it('should throw error for migration without UP section', async () => {
      mockFs.readdir.mockResolvedValue(['1735561200000_invalid.sql'] as any);
      mockFs.readFile.mockResolvedValueOnce('-- DOWN\nDROP TABLE test;');

      await expect((migrationRunner as any).loadMigrations()).rejects.toThrow(
        'Migration 1735561200000_invalid.sql is missing UP section'
      );
    });

    it('should handle file system errors', async () => {
      const fsError = new Error('File not found');
      mockFs.readdir.mockRejectedValueOnce(fsError);

      await expect((migrationRunner as any).loadMigrations()).rejects.toThrow(fsError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to load migrations',
        expect.objectContaining({
          component: 'MigrationRunner',
          error: 'File not found'
        })
      );
    });
  });

  describe('getExecutedMigrations', () => {
    it('should retrieve executed migrations from database', async () => {
      const mockExecuted: MigrationRecord[] = [
        {
          id: '1735561200000_initial_schema',
          name: 'initial_schema',
          executed_at: new Date('2024-01-01'),
          checksum: 'abc123'
        }
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockExecuted } as any);

      const executed = await (migrationRunner as any).getExecutedMigrations();

      expect(executed).toEqual(mockExecuted);
      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM migrations ORDER BY executed_at');
    });
  });

  describe('getPendingMigrations', () => {
    it('should identify pending migrations correctly', async () => {
      const executed: MigrationRecord[] = [
        {
          id: '1735561200000_initial_schema',
          name: 'initial_schema',
          executed_at: new Date(),
          checksum: 'abc123'
        }
      ];

      const pending = (migrationRunner as any).getPendingMigrations(sampleMigrations, executed);

      expect(pending).toHaveLength(2);
      expect(pending[0].id).toBe('1735561300000_add_user_roles');
      expect(pending[1].id).toBe('1735561400000_create_logs_table');
    });

    it('should return empty array when all migrations are executed', async () => {
      const executed: MigrationRecord[] = sampleMigrations.map((m) => ({
        id: m.id,
        name: m.name,
        executed_at: new Date(),
        checksum: 'checksum'
      }));

      const pending = (migrationRunner as any).getPendingMigrations(sampleMigrations, executed);

      expect(pending).toHaveLength(0);
    });
  });

  describe('runMigration', () => {
    it('should execute migration and record it successfully', async () => {
      const migration = sampleMigrations[0];
      mockClient.query.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await (migrationRunner as any).runMigration(migration);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(migration.up);
      expect(mockClient.query).toHaveBeenCalledWith(
        'INSERT INTO migrations (id, name, checksum) VALUES ($1, $2, $3)',
        [migration.id, migration.name, expect.any(String)]
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');

      expect(mockLogger.info).toHaveBeenCalledWith(
        `Running migration: ${migration.id} - ${migration.name}`,
        { component: 'MigrationRunner' }
      );
      expect(mockLogger.info).toHaveBeenCalledWith(`Migration completed: ${migration.id}`, {
        component: 'MigrationRunner'
      });
    });

    it('should rollback transaction on migration failure', async () => {
      const migration = sampleMigrations[0];
      const dbError = new Error('SQL syntax error');

      mockClient.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // BEGIN
        .mockRejectedValueOnce(dbError); // Migration SQL fails

      await expect((migrationRunner as any).runMigration(migration)).rejects.toThrow(dbError);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();

      expect(mockLogger.error).toHaveBeenCalledWith(
        `Migration failed: ${migration.id}`,
        expect.objectContaining({
          component: 'MigrationRunner',
          error: 'SQL syntax error'
        })
      );
    });

    it('should release client connection even on error', async () => {
      const migration = sampleMigrations[0];
      mockClient.query.mockRejectedValue(new Error('Connection lost'));

      await expect((migrationRunner as any).runMigration(migration)).rejects.toThrow();

      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('rollbackMigration', () => {
    it('should execute rollback and remove migration record', async () => {
      const migration = sampleMigrations[0];
      mockClient.query.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await (migrationRunner as any).rollbackMigration(migration);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(migration.down);
      expect(mockClient.query).toHaveBeenCalledWith('DELETE FROM migrations WHERE id = $1', [
        migration.id
      ]);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');

      expect(mockLogger.info).toHaveBeenCalledWith(
        `Rolling back migration: ${migration.id} - ${migration.name}`,
        { component: 'MigrationRunner' }
      );
      expect(mockLogger.info).toHaveBeenCalledWith(`Rollback completed: ${migration.id}`, {
        component: 'MigrationRunner'
      });
    });

    it('should rollback transaction on rollback failure', async () => {
      const migration = sampleMigrations[0];
      const dbError = new Error('Rollback SQL error');

      mockClient.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // BEGIN
        .mockRejectedValueOnce(dbError); // Rollback SQL fails

      await expect((migrationRunner as any).rollbackMigration(migration)).rejects.toThrow(dbError);

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();

      expect(mockLogger.error).toHaveBeenCalledWith(
        `Rollback failed: ${migration.id}`,
        expect.objectContaining({
          component: 'MigrationRunner',
          error: 'Rollback SQL error'
        })
      );
    });
  });

  describe('runMigrations', () => {
    beforeEach(() => {
      // Mock loadMigrations method
      jest.spyOn(migrationRunner as any, 'loadMigrations').mockResolvedValue(sampleMigrations);
      jest.spyOn(migrationRunner as any, 'getExecutedMigrations').mockResolvedValue([]);
      jest.spyOn(migrationRunner as any, 'runMigration').mockResolvedValue(undefined);

      // Mock initialize
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    });

    it('should run all pending migrations in order', async () => {
      await migrationRunner.runMigrations();

      expect(migrationRunner['runMigration']).toHaveBeenCalledTimes(3);
      expect(migrationRunner['runMigration']).toHaveBeenNthCalledWith(1, sampleMigrations[0]);
      expect(migrationRunner['runMigration']).toHaveBeenNthCalledWith(2, sampleMigrations[1]);
      expect(migrationRunner['runMigration']).toHaveBeenNthCalledWith(3, sampleMigrations[2]);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Running 3 pending migrations',
        expect.objectContaining({
          component: 'MigrationRunner',
          migrations: expect.arrayContaining([
            '1735561200000_initial_schema',
            '1735561300000_add_user_roles',
            '1735561400000_create_logs_table'
          ])
        })
      );
    });

    it('should skip when no pending migrations', async () => {
      const executed = sampleMigrations.map((m) => ({
        id: m.id,
        name: m.name,
        executed_at: new Date(),
        checksum: 'checksum'
      }));

      jest.spyOn(migrationRunner as any, 'getExecutedMigrations').mockResolvedValue(executed);

      await migrationRunner.runMigrations();

      expect(migrationRunner['runMigration']).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('No pending migrations', {
        component: 'MigrationRunner'
      });
    });

    it('should stop on migration failure', async () => {
      const migrationError = new Error('Migration 2 failed');
      jest
        .spyOn(migrationRunner as any, 'runMigration')
        .mockResolvedValueOnce(undefined) // First migration succeeds
        .mockRejectedValueOnce(migrationError); // Second migration fails

      await expect(migrationRunner.runMigrations()).rejects.toThrow(migrationError);

      expect(migrationRunner['runMigration']).toHaveBeenCalledTimes(2);
    });
  });

  describe('rollbackLast', () => {
    beforeEach(() => {
      jest.spyOn(migrationRunner as any, 'loadMigrations').mockResolvedValue(sampleMigrations);
      jest.spyOn(migrationRunner as any, 'rollbackMigration').mockResolvedValue(undefined);
    });

    it('should rollback the last executed migration', async () => {
      const executed: MigrationRecord[] = [
        {
          id: '1735561200000_initial_schema',
          name: 'initial_schema',
          executed_at: new Date('2024-01-01'),
          checksum: 'abc123'
        },
        {
          id: '1735561300000_add_user_roles',
          name: 'add_user_roles',
          executed_at: new Date('2024-01-02'),
          checksum: 'def456'
        }
      ];

      jest.spyOn(migrationRunner as any, 'getExecutedMigrations').mockResolvedValue(executed);

      await migrationRunner.rollbackLast();

      expect(migrationRunner['rollbackMigration']).toHaveBeenCalledWith(sampleMigrations[1]);
    });

    it('should warn when no migrations to rollback', async () => {
      jest.spyOn(migrationRunner as any, 'getExecutedMigrations').mockResolvedValue([]);

      await migrationRunner.rollbackLast();

      expect(migrationRunner['rollbackMigration']).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('No migrations to rollback', {
        component: 'MigrationRunner'
      });
    });

    it('should throw error when migration file not found', async () => {
      const executed: MigrationRecord[] = [
        {
          id: 'missing_migration',
          name: 'missing',
          executed_at: new Date(),
          checksum: 'xyz789'
        }
      ];

      jest.spyOn(migrationRunner as any, 'getExecutedMigrations').mockResolvedValue(executed);

      await expect(migrationRunner.rollbackLast()).rejects.toThrow(
        'Migration missing_migration not found in files'
      );
    });
  });

  describe('calculateChecksum', () => {
    it('should generate consistent checksums for same content', () => {
      const content = 'CREATE TABLE test (id UUID);';

      const checksum1 = (migrationRunner as any).calculateChecksum(content);
      const checksum2 = (migrationRunner as any).calculateChecksum(content);

      expect(checksum1).toBe(checksum2);
      expect(typeof checksum1).toBe('string');
      expect(checksum1.length).toBe(64); // SHA256 hex string length
    });

    it('should generate different checksums for different content', () => {
      const content1 = 'CREATE TABLE test1 (id UUID);';
      const content2 = 'CREATE TABLE test2 (id UUID);';

      const checksum1 = (migrationRunner as any).calculateChecksum(content1);
      const checksum2 = (migrationRunner as any).calculateChecksum(content2);

      expect(checksum1).not.toBe(checksum2);
    });
  });

  describe('createMigration', () => {
    it('should create migration file with correct template', async () => {
      const migrationName = 'Add User Permissions';
      const migrationsPath = '/test/migrations';

      mockFs.writeFile.mockResolvedValueOnce(undefined);

      // Mock Date.now to get predictable filename
      const mockTimestamp = 1735561500000;
      jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

      const filePath = await MigrationRunner.createMigration(migrationName, migrationsPath);

      expect(filePath).toBe('/test/migrations/1735561500000_add_user_permissions.sql');
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        filePath,
        expect.stringContaining(
          '-- UP\n-- Write your migration here\n\n-- DOWN\n-- Write your rollback here'
        ),
        'utf-8'
      );

      Date.now = jest.fn().mockRestore();
    });

    it('should sanitize migration name for filename', async () => {
      const migrationName = 'Add Complex User Permissions & Roles';
      const migrationsPath = '/test/migrations';

      mockFs.writeFile.mockResolvedValueOnce(undefined);
      jest.spyOn(Date, 'now').mockReturnValue(1735561500000);

      const filePath = await MigrationRunner.createMigration(migrationName, migrationsPath);

      expect(filePath).toContain('add_complex_user_permissions_&_roles.sql');

      Date.now = jest.fn().mockRestore();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty migrations directory', async () => {
      mockFs.readdir.mockResolvedValue([] as any);

      const migrations = await (migrationRunner as any).loadMigrations();

      expect(migrations).toHaveLength(0);
    });

    it('should handle concurrent migration attempts', async () => {
      // Mock a unique constraint violation
      const constraintError = new Error(
        'duplicate key value violates unique constraint "migrations_pkey"'
      );
      mockClient.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // BEGIN
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // Migration SQL
        .mockRejectedValueOnce(constraintError); // INSERT fails due to duplicate

      await expect((migrationRunner as any).runMigration(sampleMigrations[0])).rejects.toThrow(
        constraintError
      );

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should validate migration file format', async () => {
      mockFs.readdir.mockResolvedValue(['invalid_timestamp_migration.sql'] as any);
      mockFs.readFile.mockResolvedValueOnce('-- UP\nCREATE TABLE test;');

      const migrations = await (migrationRunner as any).loadMigrations();

      // Should handle invalid timestamp gracefully
      expect(migrations[0].timestamp).toBeNaN();
      expect(migrations[0].name).toBe('invalid_timestamp_migration');
    });

    it('should handle database connection pool exhaustion', async () => {
      const poolError = new Error('Pool connection limit exceeded');
      mockPool.connect.mockRejectedValueOnce(poolError);

      await expect((migrationRunner as any).runMigration(sampleMigrations[0])).rejects.toThrow(
        poolError
      );
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete migration lifecycle', async () => {
      // Setup mocks for full lifecycle
      jest.spyOn(migrationRunner as any, 'loadMigrations').mockResolvedValue([sampleMigrations[0]]);
      jest
        .spyOn(migrationRunner as any, 'getExecutedMigrations')
        .mockResolvedValueOnce([]) // No executed migrations initially
        .mockResolvedValueOnce([
          {
            // Migration executed
            id: '1735561200000_initial_schema',
            name: 'initial_schema',
            executed_at: new Date(),
            checksum: 'abc123'
          }
        ]);

      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 } as any);
      mockClient.query.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      // Run migration
      await migrationRunner.runMigrations();

      // Rollback migration
      await migrationRunner.rollbackLast();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Running 1 pending migrations',
        expect.any(Object)
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'All migrations completed successfully',
        expect.any(Object)
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Rolling back migration'),
        expect.any(Object)
      );
    });
  });
});
