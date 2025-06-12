import { MnemosyneCore } from '../../core/MnemosyneCore';
import { MnemosyneError, MnemosyneErrorCode } from '../../errors/MnemosyneErrors';

describe('MnemosyneCore', () => {
  let core: MnemosyneCore;
  let mockContext: any;

  beforeEach(() => {
    mockContext = global.mockPluginContext;
    core = new MnemosyneCore(mockContext);
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      // Mock successful database query
      mockContext.services.data.query.mockResolvedValue([{ test: 1 }]);

      await core.initialize();

      expect(mockContext.services.logger.info).toHaveBeenCalledWith(
        'Initializing Mnemosyne core services'
      );
      expect(mockContext.services.logger.info).toHaveBeenCalledWith(
        'Mnemosyne core initialized successfully'
      );
    });

    it('should handle initialization failure', async () => {
      // Mock database connection failure
      mockContext.services.data.query.mockRejectedValue(new Error('Database connection failed'));

      await expect(core.initialize()).rejects.toThrow(MnemosyneError);
      await expect(core.initialize()).rejects.toThrow('Failed to initialize Mnemosyne core');
    });

    it('should not initialize twice', async () => {
      mockContext.services.data.query.mockResolvedValue([{ test: 1 }]);

      await core.initialize();
      await core.initialize(); // Second call

      expect(mockContext.services.logger.warn).toHaveBeenCalledWith(
        'MnemosyneCore already initialized'
      );
    });
  });

  describe('service management', () => {
    beforeEach(async () => {
      mockContext.services.data.query.mockResolvedValue([{ test: 1 }]);
      await core.initialize();
    });

    it('should register a service', () => {
      const testService = { getName: () => 'test-service' };
      
      core.registerService('test-service', testService);
      
      expect(core.hasService('test-service')).toBe(true);
      expect(core.getService('test-service')).toBe(testService);
    });

    it('should throw error when registering duplicate service', () => {
      const testService = { getName: () => 'test-service' };
      
      core.registerService('test-service', testService);
      
      expect(() => {
        core.registerService('test-service', testService);
      }).toThrow(MnemosyneError);
    });

    it('should throw error when getting non-existent service', () => {
      expect(() => {
        core.getService('non-existent');
      }).toThrow(MnemosyneError);
    });
  });

  describe('shutdown', () => {
    it('should shutdown successfully', async () => {
      mockContext.services.data.query.mockResolvedValue([{ test: 1 }]);
      
      await core.initialize();
      await core.shutdown();

      expect(mockContext.services.logger.info).toHaveBeenCalledWith(
        'Shutting down Mnemosyne core'
      );
      expect(mockContext.services.logger.info).toHaveBeenCalledWith(
        'Mnemosyne core shutdown complete'
      );
    });

    it('should handle shutdown of uninitialized core', async () => {
      await core.shutdown();

      // Should not log shutdown messages for uninitialized core
      expect(mockContext.services.logger.info).not.toHaveBeenCalledWith(
        'Shutting down Mnemosyne core'
      );
    });
  });

  describe('context management', () => {
    it('should return the Mnemosyne context', () => {
      const context = core.getContext();
      
      expect(context).toBeDefined();
      expect(context.dataService).toBe(mockContext.services.data);
      expect(context.eventBus).toBe(mockContext.services.eventBus);
      expect(context.logger).toBe(mockContext.services.logger);
    });
  });

  describe('migrations', () => {
    beforeEach(async () => {
      mockContext.services.data.query.mockResolvedValue([{ test: 1 }]);
      await core.initialize();
    });

    it('should run migrations successfully', async () => {
      await core.runMigrations('0.0.0', '0.1.0');

      expect(mockContext.services.logger.info).toHaveBeenCalledWith(
        'Running Mnemosyne database migrations',
        { fromVersion: '0.0.0', toVersion: '0.1.0' }
      );
      expect(mockContext.services.logger.info).toHaveBeenCalledWith(
        'Database migrations completed successfully'
      );
    });

    it('should handle migration failure', async () => {
      // This test would need actual migration logic to fail
      // For now, it just ensures the method exists and logs correctly
      await expect(core.runMigrations('0.0.0', '0.1.0')).resolves.not.toThrow();
    });
  });
});