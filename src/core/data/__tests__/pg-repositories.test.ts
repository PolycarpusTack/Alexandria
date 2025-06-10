/**
 * Comprehensive Test Suite for PostgreSQL Repository Implementations
 * 
 * This test suite provides complete coverage for all PostgreSQL repository classes:
 * - BaseRepository
 * - PgUserRepository
 * - PgCaseRepository  
 * - PgLogEntryRepository
 * - PgPluginStorageRepository
 * 
 * Tests include CRUD operations, data mapping, query handling, error scenarios,
 * and performance characteristics.
 */

import { 
  BaseRepository,
  PgUserRepository,
  PgCaseRepository,
  PgLogEntryRepository,
  PgPluginStorageRepository
} from '../pg-repositories';
import { PostgresDataService } from '../pg-data-service';
import { Logger } from '../../../utils/logger';
import { User, Case, LogEntry } from '../../system/interfaces';
import { UserSchema, CaseSchema, LogEntrySchema } from '../interfaces';
import { DatabaseError, ValidationError } from '../../errors';

// Mock PostgresDataService
jest.mock('../pg-data-service');

describe('PostgreSQL Repository Implementations', () => {
  let mockDataService: jest.Mocked<PostgresDataService>;
  let mockLogger: jest.Mocked<Logger>;

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
    
    // Setup data service mock
    mockDataService = {
      initialize: jest.fn(),
      query: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      transaction: jest.fn(),
      getHealth: jest.fn(),
      getStats: jest.fn(),
      shutdown: jest.fn()
    } as any;
  });

  describe('BaseRepository', () => {
    let baseRepo: BaseRepository<any>;

    beforeEach(() => {
      class TestRepository extends BaseRepository<any> {
        constructor() {
          super('test_table', mockDataService);
        }
      }
      baseRepo = new TestRepository();
    });

    describe('find', () => {
      it('should call dataService.find with correct parameters', async () => {
        const mockResult = [{ id: '1', name: 'Test' }];
        mockDataService.find.mockResolvedValue(mockResult);

        const criteria = { status: 'active' };
        const options = { limit: 10, offset: 0, orderBy: 'name', orderDirection: 'ASC' as const };

        const result = await baseRepo.find(criteria, options);

        expect(mockDataService.find).toHaveBeenCalledWith('test_table', criteria, options);
        expect(result).toEqual(mockResult);
      });

      it('should handle find without criteria or options', async () => {
        const mockResult = [];
        mockDataService.find.mockResolvedValue(mockResult);

        const result = await baseRepo.find();

        expect(mockDataService.find).toHaveBeenCalledWith('test_table', undefined, undefined);
        expect(result).toEqual(mockResult);
      });

      it('should handle database errors', async () => {
        const dbError = new DatabaseError('Find failed', 'DB_ERROR');
        mockDataService.find.mockRejectedValue(dbError);

        await expect(baseRepo.find({ status: 'active' })).rejects.toThrow(dbError);
      });
    });

    describe('findById', () => {
      it('should find entity by ID', async () => {
        const mockEntity = { id: '123', name: 'Test Entity' };
        mockDataService.findById.mockResolvedValue(mockEntity);

        const result = await baseRepo.findById('123');

        expect(mockDataService.findById).toHaveBeenCalledWith('test_table', '123', undefined);
        expect(result).toEqual(mockEntity);
      });

      it('should return null for non-existent entity', async () => {
        mockDataService.findById.mockResolvedValue(null);

        const result = await baseRepo.findById('non-existent');

        expect(result).toBeNull();
      });

      it('should pass select options', async () => {
        const options = { select: ['id', 'name'] };
        mockDataService.findById.mockResolvedValue({ id: '123', name: 'Test' });

        await baseRepo.findById('123', options);

        expect(mockDataService.findById).toHaveBeenCalledWith('test_table', '123', options);
      });
    });

    describe('findOne', () => {
      it('should find single entity by criteria', async () => {
        const mockEntity = { id: '123', email: 'test@test.com' };
        mockDataService.findOne.mockResolvedValue(mockEntity);

        const criteria = { email: 'test@test.com' };
        const result = await baseRepo.findOne(criteria);

        expect(mockDataService.findOne).toHaveBeenCalledWith('test_table', criteria, undefined);
        expect(result).toEqual(mockEntity);
      });

      it('should return null when no entity matches', async () => {
        mockDataService.findOne.mockResolvedValue(null);

        const result = await baseRepo.findOne({ email: 'nonexistent@test.com' });

        expect(result).toBeNull();
      });
    });

    describe('count', () => {
      it('should count entities with criteria', async () => {
        mockDataService.count.mockResolvedValue(5);

        const result = await baseRepo.count({ status: 'active' });

        expect(mockDataService.count).toHaveBeenCalledWith('test_table', { status: 'active' });
        expect(result).toBe(5);
      });

      it('should count all entities when no criteria provided', async () => {
        mockDataService.count.mockResolvedValue(10);

        const result = await baseRepo.count();

        expect(mockDataService.count).toHaveBeenCalledWith('test_table', undefined);
        expect(result).toBe(10);
      });
    });

    describe('create', () => {
      it('should create entity with generated ID', async () => {
        const inputData = { name: 'New Entity' };
        const createdEntity = { id: 'uuid-123', name: 'New Entity' };
        mockDataService.create.mockResolvedValue(createdEntity);

        const result = await baseRepo.create(inputData);

        expect(mockDataService.create).toHaveBeenCalledWith('test_table', 
          expect.objectContaining({
            name: 'New Entity',
            id: expect.any(String)
          })
        );
        expect(result).toEqual(createdEntity);
      });

      it('should create entity with provided ID', async () => {
        const inputData = { id: 'custom-id', name: 'New Entity' };
        const createdEntity = { id: 'custom-id', name: 'New Entity' };
        mockDataService.create.mockResolvedValue(createdEntity);

        const result = await baseRepo.create(inputData);

        expect(mockDataService.create).toHaveBeenCalledWith('test_table', inputData);
        expect(result).toEqual(createdEntity);
      });

      it('should handle creation constraints', async () => {
        const constraintError = new DatabaseError('Constraint violation', 'CONSTRAINT_ERROR');
        mockDataService.create.mockRejectedValue(constraintError);

        await expect(baseRepo.create({ name: 'Duplicate' })).rejects.toThrow(constraintError);
      });
    });

    describe('update', () => {
      it('should update entity successfully', async () => {
        const updateData = { name: 'Updated Entity' };
        const updatedEntity = { id: '123', name: 'Updated Entity' };
        mockDataService.update.mockResolvedValue(updatedEntity);

        const result = await baseRepo.update('123', updateData);

        expect(mockDataService.update).toHaveBeenCalledWith('test_table', '123', updateData);
        expect(result).toEqual(updatedEntity);
      });

      it('should handle update of non-existent entity', async () => {
        mockDataService.update.mockResolvedValue(null);

        const result = await baseRepo.update('non-existent', { name: 'Updated' });

        expect(result).toBeNull();
      });
    });

    describe('delete', () => {
      it('should delete entity successfully', async () => {
        mockDataService.delete.mockResolvedValue(true);

        const result = await baseRepo.delete('123');

        expect(mockDataService.delete).toHaveBeenCalledWith('test_table', '123');
        expect(result).toBe(true);
      });

      it('should return false for non-existent entity', async () => {
        mockDataService.delete.mockResolvedValue(false);

        const result = await baseRepo.delete('non-existent');

        expect(result).toBe(false);
      });
    });
  });

  describe('PgUserRepository', () => {
    let userRepo: PgUserRepository;

    beforeEach(() => {
      userRepo = new PgUserRepository(mockDataService);
    });

    describe('findById', () => {
      it('should find user by ID and map to User model', async () => {
        const userSchema: UserSchema = {
          id: '123',
          username: 'testuser',
          email: 'test@test.com',
          hashed_password: 'hashedpwd',
          roles: ['user'],
          permissions: ['read'],
          is_active: true,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-02'),
          failed_login_attempts: 0,
          locked_until: null,
          last_login_at: new Date('2024-01-02')
        };

        // Mock the base repository's findById method
        mockDataService.findById.mockResolvedValue(userSchema);

        const result = await userRepo.findById('123');

        expect(result).toEqual({
          id: '123',
          username: 'testuser',
          email: 'test@test.com',
          hashedPassword: 'hashedpwd',
          roles: ['user'],
          permissions: ['read'],
          metadata: {},
          isActive: true,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: new Date('2024-01-02')
        });
      });

      it('should return null for non-existent user', async () => {
        mockDataService.findById.mockResolvedValue(null);

        const result = await userRepo.findById('non-existent');

        expect(result).toBeNull();
      });
    });

    describe('findByUsername', () => {
      it('should find user by username', async () => {
        const userSchema: UserSchema = {
          id: '123',
          username: 'testuser',
          email: 'test@test.com',
          hashed_password: 'hashedpwd',
          roles: ['user'],
          permissions: ['read'],
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
          failed_login_attempts: 0,
          locked_until: null,
          last_login_at: null
        };

        mockDataService.findOne.mockResolvedValue(userSchema);

        const result = await userRepo.findByUsername('testuser');

        expect(mockDataService.findOne).toHaveBeenCalledWith('users', { username: 'testuser' });
        expect(result?.username).toBe('testuser');
      });
    });

    describe('findByEmail', () => {
      it('should find user by email', async () => {
        const userSchema: UserSchema = {
          id: '123',
          username: 'testuser',
          email: 'test@test.com',
          hashed_password: 'hashedpwd',
          roles: ['user'],
          permissions: ['read'],
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
          failed_login_attempts: 0,
          locked_until: null,
          last_login_at: null
        };

        mockDataService.findOne.mockResolvedValue(userSchema);

        const result = await userRepo.findByEmail('test@test.com');

        expect(mockDataService.findOne).toHaveBeenCalledWith('users', { email: 'test@test.com' });
        expect(result?.email).toBe('test@test.com');
      });
    });

    describe('findByRole', () => {
      it('should find users by role using array contains query', async () => {
        const userSchemas: UserSchema[] = [
          {
            id: '123',
            username: 'admin1',
            email: 'admin1@test.com',
            hashed_password: 'pwd',
            roles: ['admin', 'user'],
            permissions: ['read', 'write'],
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
            failed_login_attempts: 0,
            locked_until: null,
            last_login_at: null
          }
        ];

        mockDataService.query.mockResolvedValue({ rows: userSchemas, rowCount: 1 });

        const result = await userRepo.findByRole('admin');

        expect(mockDataService.query).toHaveBeenCalledWith(
          'SELECT * FROM "users" WHERE $1 = ANY(roles)',
          ['admin']
        );
        expect(result).toHaveLength(1);
        expect(result[0].roles).toContain('admin');
      });
    });

    describe('findAll', () => {
      it('should find all users with pagination and ordering', async () => {
        const userSchemas: UserSchema[] = [
          {
            id: '1',
            username: 'user1',
            email: 'user1@test.com',
            hashed_password: 'pwd',
            roles: ['user'],
            permissions: ['read'],
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
            failed_login_attempts: 0,
            locked_until: null,
            last_login_at: null
          }
        ];

        mockDataService.find.mockResolvedValue(userSchemas);

        const result = await userRepo.findAll({
          limit: 10,
          offset: 0,
          orderBy: 'username',
          orderDirection: 'asc'
        });

        expect(mockDataService.find).toHaveBeenCalledWith('users', {}, {
          limit: 10,
          offset: 0,
          orderBy: 'username',
          orderDirection: 'ASC'
        });
        expect(result).toHaveLength(1);
      });
    });

    describe('create', () => {
      it('should create user with proper schema mapping', async () => {
        const userData: Omit<User, 'id'> = {
          username: 'newuser',
          email: 'new@test.com',
          hashedPassword: 'hashedpwd',
          roles: ['user'],
          permissions: ['read'],
          metadata: {},
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: null
        };

        const createdSchema: UserSchema = {
          id: 'uuid-123',
          username: 'newuser',
          email: 'new@test.com',
          hashed_password: 'hashedpwd',
          roles: ['user'],
          permissions: ['read'],
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
          failed_login_attempts: 0,
          locked_until: null,
          last_login_at: null
        };

        mockDataService.create.mockResolvedValue(createdSchema);

        const result = await userRepo.create(userData);

        expect(mockDataService.create).toHaveBeenCalledWith('users', expect.objectContaining({
          username: 'newuser',
          email: 'new@test.com',
          hashed_password: 'hashedpwd',
          roles: ['user'],
          permissions: ['read'],
          is_active: true,
          failed_login_attempts: 0
        }));
        expect(result.username).toBe('newuser');
      });

      it('should set default values for optional fields', async () => {
        const userData: Omit<User, 'id'> = {
          username: 'newuser',
          email: 'new@test.com',
          metadata: {}
        } as any;

        const createdSchema: UserSchema = {
          id: 'uuid-123',
          username: 'newuser',
          email: 'new@test.com',
          hashed_password: '',
          roles: [],
          permissions: [],
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
          failed_login_attempts: 0,
          locked_until: null,
          last_login_at: null
        };

        mockDataService.create.mockResolvedValue(createdSchema);

        await userRepo.create(userData);

        expect(mockDataService.create).toHaveBeenCalledWith('users', expect.objectContaining({
          hashed_password: '',
          roles: [],
          permissions: [],
          is_active: true,
          failed_login_attempts: 0
        }));
      });
    });

    describe('update', () => {
      it('should update user with schema mapping', async () => {
        const updateData: Partial<User> = {
          email: 'updated@test.com',
          isActive: false,
          failedLoginAttempts: 3
        };

        const updatedSchema: UserSchema = {
          id: '123',
          username: 'testuser',
          email: 'updated@test.com',
          hashed_password: 'pwd',
          roles: ['user'],
          permissions: ['read'],
          is_active: false,
          created_at: new Date(),
          updated_at: new Date(),
          failed_login_attempts: 3,
          locked_until: null,
          last_login_at: null
        };

        mockDataService.update.mockResolvedValue(updatedSchema);

        const result = await userRepo.update('123', updateData);

        expect(mockDataService.update).toHaveBeenCalledWith('users', '123', expect.objectContaining({
          email: 'updated@test.com',
          is_active: false,
          failed_login_attempts: 3,
          updated_at: expect.any(Date)
        }));
        expect(result.email).toBe('updated@test.com');
        expect(result.isActive).toBe(false);
      });
    });

    describe('count', () => {
      it('should count users with criteria mapping', async () => {
        mockDataService.count.mockResolvedValue(5);

        const criteria: Partial<User> = {
          isActive: true,
          roles: ['admin']
        };

        const result = await userRepo.count(criteria);

        expect(mockDataService.count).toHaveBeenCalledWith('users', {
          is_active: true,
          roles: ['admin']
        });
        expect(result).toBe(5);
      });
    });

    describe('delete', () => {
      it('should delete user', async () => {
        mockDataService.delete.mockResolvedValue(true);

        const result = await userRepo.delete('123');

        expect(mockDataService.delete).toHaveBeenCalledWith('users', '123');
        expect(result).toBe(true);
      });
    });
  });

  describe('PgCaseRepository', () => {
    let caseRepo: PgCaseRepository;

    beforeEach(() => {
      caseRepo = new PgCaseRepository(mockDataService);
    });

    describe('findById', () => {
      it('should find case by ID and map to Case model', async () => {
        const caseSchema: CaseSchema = {
          id: '123',
          title: 'Test Case',
          description: 'Test Description',
          status: 'open',
          priority: 'medium',
          assigned_to: 'user123',
          created_by: 'creator123',
          tags: ['bug', 'urgent'],
          metadata: { source: 'web' },
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-02')
        };

        mockDataService.findById.mockResolvedValue(caseSchema);

        const result = await caseRepo.findById('123');

        expect(result).toEqual({
          id: '123',
          title: 'Test Case',
          description: 'Test Description',
          status: 'open',
          priority: 'medium',
          assignedTo: 'user123',
          createdBy: 'creator123',
          tags: ['bug', 'urgent'],
          metadata: { source: 'web' },
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02')
        });
      });
    });

    describe('findByStatus', () => {
      it('should find cases by status', async () => {
        const caseSchemas: CaseSchema[] = [
          {
            id: '1',
            title: 'Open Case 1',
            description: 'Description 1',
            status: 'open',
            priority: 'high',
            assigned_to: null,
            created_by: 'user1',
            tags: [],
            metadata: {},
            created_at: new Date(),
            updated_at: new Date()
          }
        ];

        mockDataService.find.mockResolvedValue(caseSchemas);

        const result = await caseRepo.findByStatus('open');

        expect(mockDataService.find).toHaveBeenCalledWith('cases', { status: 'open' });
        expect(result).toHaveLength(1);
        expect(result[0].status).toBe('open');
      });
    });

    describe('findByAssignedTo', () => {
      it('should find cases assigned to user', async () => {
        const caseSchemas: CaseSchema[] = [
          {
            id: '1',
            title: 'Assigned Case',
            description: 'Description',
            status: 'in_progress',
            priority: 'medium',
            assigned_to: 'user123',
            created_by: 'creator',
            tags: [],
            metadata: {},
            created_at: new Date(),
            updated_at: new Date()
          }
        ];

        mockDataService.find.mockResolvedValue(caseSchemas);

        const result = await caseRepo.findByAssignedTo('user123');

        expect(mockDataService.find).toHaveBeenCalledWith('cases', { assigned_to: 'user123' });
        expect(result[0].assignedTo).toBe('user123');
      });
    });

    describe('findByTag', () => {
      it('should find cases by tag using array contains query', async () => {
        const caseSchemas: CaseSchema[] = [
          {
            id: '1',
            title: 'Tagged Case',
            description: 'Description',
            status: 'open',
            priority: 'high',
            assigned_to: null,
            created_by: 'user1',
            tags: ['urgent', 'bug'],
            metadata: {},
            created_at: new Date(),
            updated_at: new Date()
          }
        ];

        mockDataService.query.mockResolvedValue({ rows: caseSchemas, rowCount: 1 });

        const result = await caseRepo.findByTag('urgent');

        expect(mockDataService.query).toHaveBeenCalledWith(
          'SELECT * FROM "cases" WHERE $1 = ANY(tags)',
          ['urgent']
        );
        expect(result[0].tags).toContain('urgent');
      });
    });

    describe('create', () => {
      it('should create case with proper schema mapping', async () => {
        const caseData: Omit<Case, 'id' | 'createdAt' | 'updatedAt'> = {
          title: 'New Case',
          description: 'New Description',
          status: 'open',
          priority: 'high',
          assignedTo: 'user123',
          createdBy: 'creator123',
          tags: ['feature'],
          metadata: { channel: 'email' }
        };

        const createdSchema: CaseSchema = {
          id: 'uuid-123',
          title: 'New Case',
          description: 'New Description',
          status: 'open',
          priority: 'high',
          assigned_to: 'user123',
          created_by: 'creator123',
          tags: ['feature'],
          metadata: { channel: 'email' },
          created_at: new Date(),
          updated_at: new Date()
        };

        mockDataService.create.mockResolvedValue(createdSchema);

        const result = await caseRepo.create(caseData);

        expect(mockDataService.create).toHaveBeenCalledWith('cases', expect.objectContaining({
          title: 'New Case',
          description: 'New Description',
          status: 'open',
          priority: 'high',
          assigned_to: 'user123',
          created_by: 'creator123',
          tags: ['feature'],
          metadata: { channel: 'email' }
        }));
        expect(result.title).toBe('New Case');
      });

      it('should handle optional fields', async () => {
        const caseData: Omit<Case, 'id' | 'createdAt' | 'updatedAt'> = {
          title: 'Minimal Case',
          description: 'Minimal Description',
          status: 'open',
          priority: 'low',
          createdBy: 'creator123'
        } as any;

        const createdSchema: CaseSchema = {
          id: 'uuid-123',
          title: 'Minimal Case',
          description: 'Minimal Description',
          status: 'open',
          priority: 'low',
          assigned_to: null,
          created_by: 'creator123',
          tags: [],
          metadata: {},
          created_at: new Date(),
          updated_at: new Date()
        };

        mockDataService.create.mockResolvedValue(createdSchema);

        await caseRepo.create(caseData);

        expect(mockDataService.create).toHaveBeenCalledWith('cases', expect.objectContaining({
          assigned_to: null,
          tags: [],
          metadata: {}
        }));
      });
    });

    describe('update', () => {
      it('should update case with schema mapping', async () => {
        const updateData: Partial<Case> = {
          status: 'closed',
          assignedTo: 'newuser123',
          tags: ['resolved', 'feature']
        };

        const updatedSchema: CaseSchema = {
          id: '123',
          title: 'Test Case',
          description: 'Description',
          status: 'closed',
          priority: 'medium',
          assigned_to: 'newuser123',
          created_by: 'creator',
          tags: ['resolved', 'feature'],
          metadata: {},
          created_at: new Date(),
          updated_at: new Date()
        };

        mockDataService.update.mockResolvedValue(updatedSchema);

        const result = await caseRepo.update('123', updateData);

        expect(mockDataService.update).toHaveBeenCalledWith('cases', '123', expect.objectContaining({
          status: 'closed',
          assigned_to: 'newuser123',
          tags: ['resolved', 'feature'],
          updated_at: expect.any(Date)
        }));
        expect(result.status).toBe('closed');
      });
    });

    describe('findAll with filters', () => {
      it('should find cases with filters and pagination', async () => {
        const caseSchemas: CaseSchema[] = [];
        mockDataService.find.mockResolvedValue(caseSchemas);

        const options = {
          limit: 10,
          offset: 0,
          orderBy: 'created_at',
          orderDirection: 'desc' as const,
          filters: {
            status: 'open' as Case['status'],
            priority: 'high' as Case['priority']
          }
        };

        await caseRepo.findAll(options);

        expect(mockDataService.find).toHaveBeenCalledWith('cases', {
          status: 'open',
          priority: 'high'
        }, {
          limit: 10,
          offset: 0,
          orderBy: 'created_at',
          orderDirection: 'DESC'
        });
      });
    });
  });

  describe('PgLogEntryRepository', () => {
    let logRepo: PgLogEntryRepository;

    beforeEach(() => {
      logRepo = new PgLogEntryRepository(mockDataService);
    });

    describe('findByLevel', () => {
      it('should find log entries by level', async () => {
        const logSchemas: LogEntrySchema[] = [
          {
            id: '1',
            timestamp: new Date(),
            level: 'error',
            message: 'Error message',
            context: { errorCode: 500 },
            source: 'api'
          }
        ];

        mockDataService.find.mockResolvedValue(logSchemas);

        const result = await logRepo.findByLevel('error');

        expect(mockDataService.find).toHaveBeenCalledWith('logs', { level: 'error' });
        expect(result[0].level).toBe('error');
      });
    });

    describe('findBySource', () => {
      it('should find log entries by source', async () => {
        const logSchemas: LogEntrySchema[] = [
          {
            id: '1',
            timestamp: new Date(),
            level: 'info',
            message: 'Info message',
            context: {},
            source: 'plugin:alfred'
          }
        ];

        mockDataService.find.mockResolvedValue(logSchemas);

        const result = await logRepo.findBySource('plugin:alfred');

        expect(mockDataService.find).toHaveBeenCalledWith('logs', { source: 'plugin:alfred' });
        expect(result[0].source).toBe('plugin:alfred');
      });
    });

    describe('findByTimeRange', () => {
      it('should find log entries within time range', async () => {
        const fromDate = new Date('2024-01-01');
        const toDate = new Date('2024-01-02');
        const logSchemas: LogEntrySchema[] = [
          {
            id: '1',
            timestamp: new Date('2024-01-01T12:00:00Z'),
            level: 'info',
            message: 'Message in range',
            context: {},
            source: 'api'
          }
        ];

        mockDataService.query.mockResolvedValue({ rows: logSchemas, rowCount: 1 });

        const result = await logRepo.findByTimeRange(fromDate, toDate);

        expect(mockDataService.query).toHaveBeenCalledWith(
          'SELECT * FROM "logs" WHERE "timestamp" BETWEEN $1 AND $2',
          [fromDate, toDate]
        );
        expect(result).toHaveLength(1);
      });
    });

    describe('create', () => {
      it('should create log entry with proper mapping', async () => {
        const logData: Omit<LogEntry, 'id'> = {
          timestamp: new Date('2024-01-01'),
          level: 'warn',
          message: 'Warning message',
          context: { userId: '123' },
          source: 'auth'
        };

        const createdSchema: LogEntrySchema = {
          id: 'uuid-123',
          timestamp: new Date('2024-01-01'),
          level: 'warn',
          message: 'Warning message',
          context: { userId: '123' },
          source: 'auth'
        };

        mockDataService.create.mockResolvedValue(createdSchema);

        const result = await logRepo.create(logData);

        expect(mockDataService.create).toHaveBeenCalledWith('logs', expect.objectContaining({
          timestamp: new Date('2024-01-01'),
          level: 'warn',
          message: 'Warning message',
          context: { userId: '123' },
          source: 'auth'
        }));
        expect(result.level).toBe('warn');
      });

      it('should set default timestamp and context', async () => {
        const logData: Omit<LogEntry, 'id'> = {
          level: 'info',
          message: 'Info message',
          source: 'test'
        } as any;

        const createdSchema: LogEntrySchema = {
          id: 'uuid-123',
          timestamp: new Date(),
          level: 'info',
          message: 'Info message',
          context: {},
          source: 'test'
        };

        mockDataService.create.mockResolvedValue(createdSchema);

        await logRepo.create(logData);

        expect(mockDataService.create).toHaveBeenCalledWith('logs', expect.objectContaining({
          timestamp: expect.any(Date),
          context: {}
        }));
      });
    });

    describe('deleteOlderThan', () => {
      it('should delete old log entries', async () => {
        const cutoffDate = new Date('2024-01-01');
        mockDataService.query.mockResolvedValue({ rowCount: 10 });

        const result = await logRepo.deleteOlderThan(cutoffDate);

        expect(mockDataService.query).toHaveBeenCalledWith(
          'DELETE FROM "logs" WHERE "timestamp" < $1',
          [cutoffDate]
        );
        expect(result).toBe(10);
      });
    });

    describe('findAll with filters', () => {
      it('should find log entries with filters and default ordering', async () => {
        const logSchemas: LogEntrySchema[] = [];
        mockDataService.find.mockResolvedValue(logSchemas);

        const options = {
          limit: 50,
          offset: 0,
          filters: {
            level: 'error' as LogEntry['level'],
            source: 'api'
          }
        };

        await logRepo.findAll(options);

        expect(mockDataService.find).toHaveBeenCalledWith('logs', {
          level: 'error',
          source: 'api'
        }, {
          limit: 50,
          offset: 0,
          orderBy: 'timestamp',
          orderDirection: 'DESC'
        });
      });
    });
  });

  describe('PgPluginStorageRepository', () => {
    let storageRepo: PgPluginStorageRepository;

    beforeEach(() => {
      storageRepo = new PgPluginStorageRepository(mockDataService);
    });

    describe('get', () => {
      it('should get value from plugin storage', async () => {
        const mockValue = { config: 'test-value' };
        mockDataService.query.mockResolvedValue({
          rows: [{ value: mockValue }],
          rowCount: 1
        });

        const result = await storageRepo.get('plugin1', 'config');

        expect(mockDataService.query).toHaveBeenCalledWith(
          'SELECT value FROM "plugin_storage" WHERE plugin_id = $1 AND key = $2',
          ['plugin1', 'config']
        );
        expect(result).toEqual(mockValue);
      });

      it('should return null for non-existent key', async () => {
        mockDataService.query.mockResolvedValue({
          rows: [],
          rowCount: 0
        });

        const result = await storageRepo.get('plugin1', 'nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('set', () => {
      it('should set value in plugin storage', async () => {
        const value = { setting: 'enabled' };
        mockDataService.query.mockResolvedValue({ rowCount: 1 });

        await storageRepo.set('plugin1', 'settings', value);

        expect(mockDataService.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO "plugin_storage"'),
          ['plugin1', 'settings', value]
        );
      });

      it('should use upsert query with conflict resolution', async () => {
        mockDataService.query.mockResolvedValue({ rowCount: 1 });

        await storageRepo.set('plugin1', 'config', 'new-value');

        const queryCall = mockDataService.query.mock.calls[0];
        expect(queryCall[0]).toContain('ON CONFLICT (plugin_id, key) DO UPDATE');
      });
    });

    describe('remove', () => {
      it('should remove value from plugin storage', async () => {
        mockDataService.query.mockResolvedValue({ rowCount: 1 });

        const result = await storageRepo.remove('plugin1', 'config');

        expect(mockDataService.query).toHaveBeenCalledWith(
          'DELETE FROM "plugin_storage" WHERE plugin_id = $1 AND key = $2',
          ['plugin1', 'config']
        );
        expect(result).toBe(true);
      });

      it('should return false if no rows affected', async () => {
        mockDataService.query.mockResolvedValue({ rowCount: 0 });

        const result = await storageRepo.remove('plugin1', 'nonexistent');

        expect(result).toBe(false);
      });
    });

    describe('keys', () => {
      it('should get all keys for a plugin', async () => {
        mockDataService.query.mockResolvedValue({
          rows: [
            { key: 'config' },
            { key: 'settings' },
            { key: 'cache' }
          ],
          rowCount: 3
        });

        const result = await storageRepo.keys('plugin1');

        expect(mockDataService.query).toHaveBeenCalledWith(
          'SELECT key FROM "plugin_storage" WHERE plugin_id = $1',
          ['plugin1']
        );
        expect(result).toEqual(['config', 'settings', 'cache']);
      });

      it('should return empty array for plugin with no keys', async () => {
        mockDataService.query.mockResolvedValue({
          rows: [],
          rowCount: 0
        });

        const result = await storageRepo.keys('empty-plugin');

        expect(result).toEqual([]);
      });
    });

    describe('clear', () => {
      it('should clear all storage for a plugin', async () => {
        mockDataService.query.mockResolvedValue({ rowCount: 5 });

        await storageRepo.clear('plugin1');

        expect(mockDataService.query).toHaveBeenCalledWith(
          'DELETE FROM "plugin_storage" WHERE plugin_id = $1',
          ['plugin1']
        );
      });

      it('should handle clearing empty plugin storage', async () => {
        mockDataService.query.mockResolvedValue({ rowCount: 0 });

        await expect(storageRepo.clear('empty-plugin')).resolves.not.toThrow();
      });
    });
  });

  describe('Error Handling', () => {
    let userRepo: PgUserRepository;

    beforeEach(() => {
      userRepo = new PgUserRepository(mockDataService);
    });

    it('should handle database connection errors', async () => {
      const connectionError = new DatabaseError('Connection failed', 'CONNECTION_ERROR');
      mockDataService.findById.mockRejectedValue(connectionError);

      await expect(userRepo.findById('123')).rejects.toThrow(connectionError);
    });

    it('should handle constraint violations in create operations', async () => {
      const constraintError = new DatabaseError('Unique constraint violation', 'CONSTRAINT_ERROR');
      mockDataService.create.mockRejectedValue(constraintError);

      const userData: Omit<User, 'id'> = {
        username: 'duplicate',
        email: 'duplicate@test.com',
        metadata: {}
      } as any;

      await expect(userRepo.create(userData)).rejects.toThrow(constraintError);
    });

    it('should handle foreign key violations', async () => {
      const fkError = new DatabaseError('Foreign key constraint violation', 'FK_ERROR');
      mockDataService.create.mockRejectedValue(fkError);

      const caseRepo = new PgCaseRepository(mockDataService);
      const caseData: Omit<Case, 'id' | 'createdAt' | 'updatedAt'> = {
        title: 'Test',
        description: 'Test',
        status: 'open',
        priority: 'low',
        createdBy: 'invalid-user-id'
      } as any;

      await expect(caseRepo.create(caseData)).rejects.toThrow(fkError);
    });

    it('should handle query timeout errors', async () => {
      const timeoutError = new DatabaseError('Query timeout', 'TIMEOUT_ERROR');
      mockDataService.find.mockRejectedValue(timeoutError);

      await expect(userRepo.findAll()).rejects.toThrow(timeoutError);
    });
  });

  describe('Performance and Concurrency', () => {
    let userRepo: PgUserRepository;

    beforeEach(() => {
      userRepo = new PgUserRepository(mockDataService);
    });

    it('should handle concurrent read operations', async () => {
      const userSchema: UserSchema = {
        id: '123',
        username: 'testuser',
        email: 'test@test.com',
        hashed_password: 'pwd',
        roles: ['user'],
        permissions: ['read'],
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
        failed_login_attempts: 0,
        locked_until: null,
        last_login_at: null
      };

      mockDataService.findById.mockResolvedValue(userSchema);

      const operations = Array(10).fill(null).map(() => userRepo.findById('123'));
      const results = await Promise.all(operations);

      expect(results).toHaveLength(10);
      expect(mockDataService.findById).toHaveBeenCalledTimes(10);
    });

    it('should handle batch operations efficiently', async () => {
      const userSchemas: UserSchema[] = Array(100).fill(null).map((_, i) => ({
        id: `user-${i}`,
        username: `user${i}`,
        email: `user${i}@test.com`,
        hashed_password: 'pwd',
        roles: ['user'],
        permissions: ['read'],
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
        failed_login_attempts: 0,
        locked_until: null,
        last_login_at: null
      }));

      mockDataService.find.mockResolvedValue(userSchemas);

      const result = await userRepo.findAll({ limit: 100 });

      expect(result).toHaveLength(100);
      expect(mockDataService.find).toHaveBeenCalledTimes(1);
    });

    it('should handle large dataset pagination', async () => {
      const userSchemas: UserSchema[] = Array(50).fill(null).map((_, i) => ({
        id: `user-${i + 50}`,
        username: `user${i + 50}`,
        email: `user${i + 50}@test.com`,
        hashed_password: 'pwd',
        roles: ['user'],
        permissions: ['read'],
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
        failed_login_attempts: 0,
        locked_until: null,
        last_login_at: null
      }));

      mockDataService.find.mockResolvedValue(userSchemas);

      const result = await userRepo.findAll({
        limit: 50,
        offset: 50,
        orderBy: 'created_at',
        orderDirection: 'desc'
      });

      expect(mockDataService.find).toHaveBeenCalledWith('users', {}, {
        limit: 50,
        offset: 50,
        orderBy: 'created_at',
        orderDirection: 'DESC'
      });
      expect(result).toHaveLength(50);
    });
  });
});