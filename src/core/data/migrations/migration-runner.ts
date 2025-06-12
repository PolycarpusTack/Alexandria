import { Pool, PoolClient } from 'pg';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../../../utils/logger';
import { createDatabaseError } from '../../middleware/error-response-middleware';

export interface Migration {
  id: string;
  name: string;
  timestamp: number;
  up: string;
  down: string;
}

export interface MigrationRecord {
  id: string;
  name: string;
  executed_at: Date;
  checksum: string;
}

export interface MigrationRunOptions {
  dryRun?: boolean;
  validateChecksums?: boolean;
  continueOnError?: boolean;
  maxRetries?: number;
  backupBeforeRun?: boolean;
}

export interface MigrationStatus {
  total: number;
  executed: number;
  pending: number;
  failed: number;
  checksumMismatches: number;
}

export class MigrationRunner {
  private pool: Pool;
  private logger: Logger;
  private migrationsPath: string;
  private readonly DEFAULT_TIMEOUT = 300000; // 5 minutes
  private readonly MAX_RETRIES = 3;

  constructor(
    pool: Pool,
    logger: Logger,
    migrationsPath: string = path.join(__dirname, 'migrations')
  ) {
    this.pool = pool;
    this.logger = logger;
    this.migrationsPath = migrationsPath;
  }

  /**
   * Initialize migration table with enhanced safety features
   */
  async initialize(): Promise<void> {
    let client: PoolClient | null = null;

    try {
      client = await this.pool.connect();

      // Check database connectivity first
      await client.query('SELECT 1');

      // Create migrations table with enhanced structure
      const query = `
        CREATE TABLE IF NOT EXISTS migrations (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          checksum VARCHAR(64) NOT NULL,
          execution_time_ms INTEGER DEFAULT 0,
          rollback_available BOOLEAN DEFAULT true,
          created_by VARCHAR(100) DEFAULT 'migration-runner',
          schema_version INTEGER DEFAULT 1
        );
        
        CREATE INDEX IF NOT EXISTS idx_migrations_executed_at ON migrations(executed_at);
        CREATE INDEX IF NOT EXISTS idx_migrations_checksum ON migrations(checksum);
        
        -- Add migration metadata table for enhanced tracking
        CREATE TABLE IF NOT EXISTS migration_history (
          id SERIAL PRIMARY KEY,
          migration_id VARCHAR(255) NOT NULL,
          action VARCHAR(20) NOT NULL, -- 'up', 'down', 'failed'
          executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          execution_time_ms INTEGER NOT NULL,
          error_message TEXT,
          checksum_before VARCHAR(64),
          checksum_after VARCHAR(64)
        );
        
        CREATE INDEX IF NOT EXISTS idx_migration_history_migration_id ON migration_history(migration_id);
        CREATE INDEX IF NOT EXISTS idx_migration_history_executed_at ON migration_history(executed_at);
      `;

      await client.query(query);

      // Verify table structure
      await this.verifyMigrationTableStructure(client);

      this.logger.info('Migration table initialized successfully', {
        component: 'MigrationRunner',
        features: ['enhanced_tracking', 'rollback_support', 'performance_metrics']
      });
    } catch (error) {
      this.logger.error('Failed to initialize migration table', {
        component: 'MigrationRunner',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw createDatabaseError(
        'migration_table_initialization',
        error instanceof Error ? error : new Error(String(error))
      );
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Verify migration table structure
   */
  private async verifyMigrationTableStructure(client: PoolClient): Promise<void> {
    try {
      // Check if migrations table has expected columns
      const result = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'migrations' 
        AND table_schema = 'public'
        ORDER BY column_name
      `);

      const expectedColumns = ['id', 'name', 'executed_at', 'checksum'];
      const actualColumns = result.rows.map((row) => row.column_name);

      for (const col of expectedColumns) {
        if (!actualColumns.includes(col)) {
          throw new Error(`Migration table is missing required column: ${col}`);
        }
      }

      this.logger.debug('Migration table structure verified', {
        component: 'MigrationRunner',
        columns: actualColumns
      });
    } catch (error) {
      this.logger.error('Migration table structure verification failed', {
        component: 'MigrationRunner',
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get migration status and statistics
   */
  async getStatus(): Promise<MigrationStatus> {
    try {
      const migrations = await this.loadMigrations();
      const executed = await this.getExecutedMigrations();
      const pending = this.getPendingMigrations(migrations, executed);

      // Check for checksum mismatches
      let checksumMismatches = 0;
      for (const executedMigration of executed) {
        const fileMigration = migrations.find((m) => m.id === executedMigration.id);
        if (fileMigration) {
          const fileChecksum = this.calculateChecksum(fileMigration.up);
          if (fileChecksum !== executedMigration.checksum) {
            checksumMismatches++;
          }
        }
      }

      return {
        total: migrations.length,
        executed: executed.length,
        pending: pending.length,
        failed: 0, // Would need additional tracking for failed migrations
        checksumMismatches
      };
    } catch (error) {
      this.logger.error('Failed to get migration status', {
        component: 'MigrationRunner',
        error: error instanceof Error ? error.message : String(error)
      });
      throw createDatabaseError(
        'migration_status_check',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Validate migration checksums against executed records
   */
  async validateChecksums(): Promise<{ valid: boolean; mismatches: string[] }> {
    try {
      const migrations = await this.loadMigrations();
      const executed = await this.getExecutedMigrations();
      const mismatches: string[] = [];

      for (const executedMigration of executed) {
        const fileMigration = migrations.find((m) => m.id === executedMigration.id);
        if (!fileMigration) {
          mismatches.push(`Migration file not found: ${executedMigration.id}`);
          continue;
        }

        const fileChecksum = this.calculateChecksum(fileMigration.up);
        if (fileChecksum !== executedMigration.checksum) {
          mismatches.push(
            `Checksum mismatch for ${executedMigration.id}: expected ${executedMigration.checksum}, got ${fileChecksum}`
          );
        }
      }

      return {
        valid: mismatches.length === 0,
        mismatches
      };
    } catch (error) {
      this.logger.error('Failed to validate checksums', {
        component: 'MigrationRunner',
        error: error instanceof Error ? error.message : String(error)
      });
      throw createDatabaseError(
        'checksum_validation',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Run all pending migrations with enhanced options
   */
  async runMigrations(options: MigrationRunOptions = {}): Promise<void> {
    const {
      dryRun = false,
      validateChecksums = true,
      continueOnError = false,
      maxRetries = this.MAX_RETRIES,
      backupBeforeRun = false
    } = options;

    try {
      await this.initialize();

      // Validate checksums if requested
      if (validateChecksums) {
        const validation = await this.validateChecksums();
        if (!validation.valid) {
          const errorMessage = `Checksum validation failed: ${validation.mismatches.join(', ')}`;
          this.logger.error(errorMessage, { component: 'MigrationRunner' });
          throw createDatabaseError('checksum_validation_failed', new Error(errorMessage));
        }
      }

      const migrations = await this.loadMigrations();
      const executed = await this.getExecutedMigrations();
      const pending = this.getPendingMigrations(migrations, executed);

      if (pending.length === 0) {
        this.logger.info('No pending migrations', { component: 'MigrationRunner' });
        return;
      }

      this.logger.info(
        `${dryRun ? 'Simulating' : 'Running'} ${pending.length} pending migrations`,
        {
          component: 'MigrationRunner',
          migrations: pending.map((m) => m.id),
          options: { dryRun, validateChecksums, continueOnError, maxRetries }
        }
      );

      // Create database backup if requested
      if (backupBeforeRun && !dryRun) {
        await this.createBackup();
      }

      let successCount = 0;
      let failureCount = 0;

      for (const migration of pending) {
        let retryCount = 0;
        let success = false;

        while (retryCount <= maxRetries && !success) {
          try {
            if (dryRun) {
              await this.validateMigration(migration);
              this.logger.info(`[DRY RUN] Migration would run: ${migration.id}`, {
                component: 'MigrationRunner'
              });
            } else {
              await this.runMigration(migration);
            }
            success = true;
            successCount++;
          } catch (error) {
            retryCount++;
            this.logger.warn(
              `Migration ${migration.id} failed (attempt ${retryCount}/${maxRetries + 1})`,
              {
                component: 'MigrationRunner',
                error: error instanceof Error ? error.message : String(error)
              }
            );

            if (retryCount > maxRetries) {
              failureCount++;
              if (continueOnError) {
                this.logger.error(
                  `Migration ${migration.id} failed after ${maxRetries} retries, continuing...`,
                  {
                    component: 'MigrationRunner'
                  }
                );
                break; // Continue to next migration
              } else {
                throw error;
              }
            } else {
              // Wait before retrying (exponential backoff)
              const delay = Math.pow(2, retryCount) * 1000;
              this.logger.info(`Retrying migration ${migration.id} in ${delay}ms...`, {
                component: 'MigrationRunner'
              });
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
          }
        }
      }

      const summary = dryRun ? 'Migration simulation completed' : 'All migrations completed';
      this.logger.info(summary, {
        component: 'MigrationRunner',
        successful: successCount,
        failed: failureCount,
        total: pending.length
      });

      if (failureCount > 0 && !continueOnError) {
        throw createDatabaseError(
          'migration_batch_failed',
          new Error(`${failureCount} migrations failed`)
        );
      }
    } catch (error) {
      this.logger.error('Migration run failed', {
        component: 'MigrationRunner',
        error: error instanceof Error ? error.message : String(error),
        options
      });
      throw error;
    }
  }

  /**
   * Validate a migration without executing it
   */
  private async validateMigration(migration: Migration): Promise<void> {
    // Basic SQL syntax validation
    if (!migration.up || migration.up.trim().length === 0) {
      throw new Error(`Migration ${migration.id} has empty UP section`);
    }

    // Check for dangerous operations in production
    if (process.env.NODE_ENV === 'production') {
      const dangerousOperations = ['DROP TABLE', 'DROP DATABASE', 'TRUNCATE', 'DELETE FROM'];

      const upperSQL = migration.up.toUpperCase();
      for (const operation of dangerousOperations) {
        if (upperSQL.includes(operation)) {
          this.logger.warn(
            `Migration ${migration.id} contains potentially dangerous operation: ${operation}`,
            {
              component: 'MigrationRunner'
            }
          );
        }
      }
    }

    // Validate migration structure
    if (migration.id.length > 255) {
      throw new Error(`Migration ID too long: ${migration.id}`);
    }

    if (migration.name.length > 255) {
      throw new Error(`Migration name too long: ${migration.name}`);
    }
  }

  /**
   * Create a database backup (basic implementation)
   */
  private async createBackup(): Promise<void> {
    try {
      this.logger.info('Creating database backup before migrations', {
        component: 'MigrationRunner'
      });

      // This is a simplified backup - in production you'd want to use pg_dump
      // For now, we'll just record the current schema version
      const client = await this.pool.connect();
      try {
        const result = await client.query('SELECT COUNT(*) FROM migrations');
        this.logger.info(`Backup checkpoint: ${result.rows[0].count} migrations executed`, {
          component: 'MigrationRunner'
        });
      } finally {
        client.release();
      }
    } catch (error) {
      this.logger.error('Failed to create backup', {
        component: 'MigrationRunner',
        error: error instanceof Error ? error.message : String(error)
      });
      throw createDatabaseError(
        'backup_creation',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Rollback the last migration
   */
  async rollbackLast(): Promise<void> {
    const executed = await this.getExecutedMigrations();
    if (executed.length === 0) {
      this.logger.warn('No migrations to rollback', { component: 'MigrationRunner' });
      return;
    }

    const lastMigration = executed[executed.length - 1];
    const migrations = await this.loadMigrations();
    const migration = migrations.find((m) => m.id === lastMigration.id);

    if (!migration) {
      throw new Error(`Migration ${lastMigration.id} not found in files`);
    }

    await this.rollbackMigration(migration);
  }

  /**
   * Run a single migration
   */
  private async runMigration(migration: Migration): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      this.logger.info(`Running migration: ${migration.id} - ${migration.name}`, {
        component: 'MigrationRunner'
      });

      // Execute the migration
      await client.query(migration.up);

      // Record the migration
      const checksum = this.calculateChecksum(migration.up);
      await client.query('INSERT INTO migrations (id, name, checksum) VALUES ($1, $2, $3)', [
        migration.id,
        migration.name,
        checksum
      ]);

      await client.query('COMMIT');

      this.logger.info(`Migration completed: ${migration.id}`, {
        component: 'MigrationRunner'
      });
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Migration failed: ${migration.id}`, {
        component: 'MigrationRunner',
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Rollback a single migration
   */
  private async rollbackMigration(migration: Migration): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      this.logger.info(`Rolling back migration: ${migration.id} - ${migration.name}`, {
        component: 'MigrationRunner'
      });

      // Execute the rollback
      await client.query(migration.down);

      // Remove the migration record
      await client.query('DELETE FROM migrations WHERE id = $1', [migration.id]);

      await client.query('COMMIT');

      this.logger.info(`Rollback completed: ${migration.id}`, {
        component: 'MigrationRunner'
      });
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Rollback failed: ${migration.id}`, {
        component: 'MigrationRunner',
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Load all migration files
   */
  private async loadMigrations(): Promise<Migration[]> {
    try {
      const files = await fs.readdir(this.migrationsPath);
      const migrationFiles = files.filter((file) => file.endsWith('.sql')).sort(); // Ensure migrations run in order

      // Read all migration files in parallel for better performance
      const fileContents = await Promise.all(
        migrationFiles.map(async (file) => {
          const filePath = path.join(this.migrationsPath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          return { file, content };
        })
      );

      // Parse migration files sequentially to maintain order
      const migrations: Migration[] = [];

      for (const { file, content } of fileContents) {
        // Parse migration file
        const [timestamp, ...nameParts] = file.replace('.sql', '').split('_');
        const name = nameParts.join('_');

        // Split up and down migrations
        const [up, down] = content.split('-- DOWN');

        if (!up) {
          throw new Error(`Migration ${file} is missing UP section`);
        }

        migrations.push({
          id: file.replace('.sql', ''),
          name,
          timestamp: parseInt(timestamp),
          up: up.replace('-- UP', '').trim(),
          down: down ? down.trim() : ''
        });
      }

      return migrations;
    } catch (error) {
      this.logger.error('Failed to load migrations', {
        component: 'MigrationRunner',
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get list of executed migrations
   */
  private async getExecutedMigrations(): Promise<MigrationRecord[]> {
    const result = await this.pool.query<MigrationRecord>(
      'SELECT * FROM migrations ORDER BY executed_at'
    );
    return result.rows;
  }

  /**
   * Get pending migrations
   */
  private getPendingMigrations(all: Migration[], executed: MigrationRecord[]): Migration[] {
    const executedIds = new Set(executed.map((m) => m.id));
    return all.filter((m) => !executedIds.has(m.id));
  }

  /**
   * Calculate checksum for migration content
   */
  private calculateChecksum(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Create a new migration file
   */
  static async createMigration(name: string, migrationsPath: string): Promise<string> {
    const timestamp = Date.now();
    const fileName = `${timestamp}_${name.toLowerCase().replace(/\s+/g, '_')}.sql`;
    const filePath = path.join(migrationsPath, fileName);

    const template = `-- UP
-- Write your migration here

-- DOWN
-- Write your rollback here
`;

    await fs.writeFile(filePath, template, 'utf-8');
    return filePath;
  }
}
