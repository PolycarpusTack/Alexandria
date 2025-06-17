import { DataSource } from 'typeorm';
import { Node } from './entities/Node.entity';
import { Connection } from './entities/Connection.entity';
import { Template } from './entities/Template.entity';
import path from 'path';

// Get database configuration from environment or Alexandria's config
const dbConfig = {
  host: process.env.MNEMOSYNE_DB_HOST || process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.MNEMOSYNE_DB_PORT || process.env.DB_PORT || '5432'),
  username: process.env.MNEMOSYNE_DB_USER || process.env.DB_USER || 'alexandria',
  password: process.env.MNEMOSYNE_DB_PASSWORD || process.env.DB_PASSWORD || 'alexandria',
  database: process.env.MNEMOSYNE_DB_NAME || process.env.DB_NAME || 'alexandria'
};

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: dbConfig.host,
  port: dbConfig.port,
  username: dbConfig.username,
  password: dbConfig.password,
  database: dbConfig.database,
  schema: 'mnemosyne',
  synchronize: false, // Always use migrations
  logging: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  logger: 'advanced-console',
  entities: [Node, Connection, Template],
  migrations: [path.join(__dirname, 'migrations', '*.{ts,js}')],
  subscribers: [path.join(__dirname, 'subscribers', '*.{ts,js}')],
  migrationsTableName: 'mnemosyne_migrations',
  migrationsRun: process.env.RUN_MIGRATIONS === 'true',
  poolSize: 10,
  extra: {
    max: 20,
    connectionTimeoutMillis: 2000,
    idleTimeoutMillis: 30000,
    statement_timeout: 30000
  },
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false
});

// Initialize connection with retry logic
export async function initializeDatabase(retries: number = 3): Promise<void> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < retries; i++) {
    try {
      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
        console.log('Mnemosyne database connection established');
        
        // Ensure schema exists
        await ensureSchemaExists();
        
        // Run pending migrations
        const pendingMigrations = await AppDataSource.showMigrations();
        if (pendingMigrations) {
          console.log('Running Mnemosyne migrations...');
          await AppDataSource.runMigrations();
          console.log('Mnemosyne migrations completed');
        }
      }
      return;
    } catch (error) {
      lastError = error as Error;
      console.error(`Failed to initialize database (attempt ${i + 1}/${retries}):`, error);
      
      if (i < retries - 1) {
        const delay = Math.pow(2, i) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('Failed to initialize database after multiple attempts');
}

// Ensure schema exists
async function ensureSchemaExists(): Promise<void> {
  try {
    await AppDataSource.query(`CREATE SCHEMA IF NOT EXISTS mnemosyne`);
  } catch (error) {
    console.error('Error creating schema:', error);
    throw error;
  }
}

// Close database connection gracefully
export async function closeDatabase(): Promise<void> {
  if (AppDataSource && AppDataSource.isInitialized) {
    await AppDataSource.destroy();
    console.log('Mnemosyne database connection closed');
  }
}

// Health check for database connection
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    if (!AppDataSource.isInitialized) {
      return false;
    }
    
    await AppDataSource.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Helper to get repository with type safety
export function getRepository<T>(entity: any) {
  return AppDataSource.getRepository<T>(entity);
}