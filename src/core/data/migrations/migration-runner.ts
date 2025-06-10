import { Pool } from 'pg';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../../../utils/logger';

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

export class MigrationRunner {
  private pool: Pool;
  private logger: Logger;
  private migrationsPath: string;

  constructor(pool: Pool, logger: Logger, migrationsPath: string = path.join(__dirname, 'migrations')) {
    this.pool = pool;
    this.logger = logger;
    this.migrationsPath = migrationsPath;
  }

  /**
   * Initialize migration table
   */
  async initialize(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        checksum VARCHAR(64) NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_migrations_executed_at ON migrations(executed_at);
    `;

    try {
      await this.pool.query(query);
      this.logger.info('Migration table initialized', { component: 'MigrationRunner' });
    } catch (error) {
      this.logger.error('Failed to initialize migration table', {
        component: 'MigrationRunner',
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Run all pending migrations
   */
  async runMigrations(): Promise<void> {
    await this.initialize();

    const migrations = await this.loadMigrations();
    const executed = await this.getExecutedMigrations();
    const pending = this.getPendingMigrations(migrations, executed);

    if (pending.length === 0) {
      this.logger.info('No pending migrations', { component: 'MigrationRunner' });
      return;
    }

    this.logger.info(`Running ${pending.length} pending migrations`, {
      component: 'MigrationRunner',
      migrations: pending.map(m => m.id)
    });

    for (const migration of pending) {
      await this.runMigration(migration);
    }

    this.logger.info('All migrations completed successfully', {
      component: 'MigrationRunner'
    });
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
    const migration = migrations.find(m => m.id === lastMigration.id);

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
      await client.query(
        'INSERT INTO migrations (id, name, checksum) VALUES ($1, $2, $3)',
        [migration.id, migration.name, checksum]
      );

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
      const migrationFiles = files
        .filter(file => file.endsWith('.sql'))
        .sort(); // Ensure migrations run in order

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
  private getPendingMigrations(
    all: Migration[],
    executed: MigrationRecord[]
  ): Migration[] {
    const executedIds = new Set(executed.map(m => m.id));
    return all.filter(m => !executedIds.has(m.id));
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