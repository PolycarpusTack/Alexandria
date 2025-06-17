import { Express } from 'express';
import { Plugin, PluginContext } from './types/alexandria';
import { createMnemosyneRouter } from './api/router';
import { initializeDatabase, closeDatabase } from './database/data-source';
import { WebSocketService } from './services/WebSocketService';
import path from 'path';

export class MnemosynePlugin implements Plugin {
  public readonly id = 'mnemosyne';
  public readonly name = 'Mnemosyne Knowledge Management';
  public readonly version = '1.0.0';
  public readonly description = 'A powerful knowledge management system for Alexandria';
  
  private wsService?: WebSocketService;
  private context?: PluginContext;
  private initialized = false;

  async install(context: PluginContext): Promise<void> {
    this.context = context;
    console.log('Installing Mnemosyne plugin...');
    
    // Initialize database connection
    try {
      await initializeDatabase();
      this.initialized = true;
      console.log('Mnemosyne database initialized');
    } catch (error) {
      console.error('Failed to initialize Mnemosyne database:', error);
      throw new Error('Failed to initialize Mnemosyne database');
    }
  }

  async activate(context: PluginContext): Promise<void> {
    console.log('Activating Mnemosyne plugin...');
    
    // Ensure database is initialized
    if (!this.initialized) {
      await initializeDatabase();
      this.initialized = true;
    }
    
    // Mount API routes
    const app = context.app as Express;
    const router = createMnemosyneRouter();
    app.use('/api/mnemosyne', router);
    
    // Initialize WebSocket service if available
    if (context.io) {
      this.wsService = new WebSocketService(context.io);
      await this.wsService.initialize();
    }
    
    // Register with Alexandria's event bus
    context.eventBus.on('user:login', this.handleUserLogin.bind(this));
    context.eventBus.on('user:logout', this.handleUserLogout.bind(this));
    
    // Serve static assets for UI
    app.use('/plugins/mnemosyne', context.express.static(path.join(__dirname, '../ui/dist')));
    
    console.log('Mnemosyne plugin activated');
  }

  async deactivate(): Promise<void> {
    console.log('Deactivating Mnemosyne plugin...');
    
    // Clean up WebSocket service
    if (this.wsService) {
      await this.wsService.shutdown();
      this.wsService = undefined;
    }
    
    // Remove event listeners
    if (this.context) {
      this.context.eventBus.removeAllListeners('user:login');
      this.context.eventBus.removeAllListeners('user:logout');
    }
    
    console.log('Mnemosyne plugin deactivated');
  }

  async uninstall(): Promise<void> {
    console.log('Uninstalling Mnemosyne plugin...');
    
    // Close database connection
    try {
      await closeDatabase();
      this.initialized = false;
      console.log('Mnemosyne database connection closed');
    } catch (error) {
      console.error('Error closing Mnemosyne database:', error);
    }
    
    console.log('Mnemosyne plugin uninstalled');
  }

  getCapabilities() {
    return {
      hasUI: true,
      hasAPI: true,
      hasWebSocket: true,
      permissions: [
        'database:read',
        'database:write',
        'websocket:connect',
        'file:upload'
      ]
    };
  }

  getConfiguration() {
    return {
      database: {
        host: process.env.MNEMOSYNE_DB_HOST || 'localhost',
        port: process.env.MNEMOSYNE_DB_PORT || '5432',
        name: process.env.MNEMOSYNE_DB_NAME || 'alexandria'
      },
      search: {
        engine: process.env.MNEMOSYNE_SEARCH_ENGINE || 'postgres',
        indexingEnabled: process.env.MNEMOSYNE_INDEXING_ENABLED !== 'false'
      },
      storage: {
        attachmentsPath: process.env.MNEMOSYNE_ATTACHMENTS_PATH || './storage/mnemosyne/attachments',
        maxFileSize: parseInt(process.env.MNEMOSYNE_MAX_FILE_SIZE || '10485760') // 10MB default
      }
    };
  }

  private handleUserLogin(data: { userId: string; timestamp: Date }) {
    console.log(`Mnemosyne: User ${data.userId} logged in`);
    // Could initialize user-specific resources here
  }

  private handleUserLogout(data: { userId: string; timestamp: Date }) {
    console.log(`Mnemosyne: User ${data.userId} logged out`);
    // Could clean up user-specific resources here
  }
}

// Export the plugin instance
export default new MnemosynePlugin();

// Re-export core services
export { NodeService } from './services/NodeService';
export { ConnectionService } from './services/ConnectionService';
export { TemplateService } from './services/TemplateService';
export { SearchService } from './services/SearchService';
export { AttachmentService } from './services/AttachmentService';
export { AuthService } from './services/AuthService';