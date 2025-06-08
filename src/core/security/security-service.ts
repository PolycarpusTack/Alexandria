/**
 * Security Service implementation for the Alexandria Platform
 * 
 * This implementation combines all security services into a single service.
 */

import { 
  SecurityService, 
  AuthenticationService, 
  AuthorizationService, 
  EncryptionService, 
  AuditService, 
  ValidationService,
  AuditEventType 
} from './interfaces';
import { JwtAuthenticationService } from './authentication-service';
import { RbacAuthorizationService } from './authorization-service';
import { CryptoEncryptionService } from './encryption-service';
import { BasicAuditService } from './audit-service';
import { BasicValidationService } from './validation-service';
import { Logger } from '../../utils/logger';
import { DataService } from '../data/interfaces';

/**
 * Combined Security Service implementation
 */
export class SecurityServiceImpl implements SecurityService {
  public authentication: AuthenticationService;
  public authorization: AuthorizationService;
  public encryption: EncryptionService;
  public audit: AuditService;
  public validation: ValidationService;
  
  private logger: Logger;
  private isInitialized: boolean = false;

  constructor(
    logger: Logger,
    dataService: DataService,
    options: {
      jwtSecret: string;
      tokenExpiration?: number; // in seconds
      encryptionKey: string;
    }
  ) {
    this.logger = logger;
    
    // Validate required security parameters
    if (!options.jwtSecret) {
      throw new Error('JWT secret is required for security service initialization');
    }
    
    if (!options.encryptionKey) {
      throw new Error('Encryption key is required for security service initialization');
    }
    
    // Create individual services
    this.authentication = new JwtAuthenticationService(logger, dataService, {
      jwtSecret: options.jwtSecret,
      tokenExpiration: options.tokenExpiration
    });
    
    this.authorization = new RbacAuthorizationService(logger, dataService);
    
    this.encryption = new CryptoEncryptionService(logger, {
      key: options.encryptionKey
    });
    
    this.audit = new BasicAuditService(logger, dataService);
    
    this.validation = new BasicValidationService(logger);
  }

  /**
   * Initialize security service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Security service is already initialized');
    }
    
    this.logger.info('Initializing security service', {
      component: 'SecurityService'
    });
    
    // Initialize individual services
    await this.encryption.initialize();
    await this.authentication.initialize();
    await this.authorization.initialize();
    await this.audit.initialize();
    await this.validation.initialize();
    
    this.isInitialized = true;
    
    this.logger.info('Security service initialized successfully', {
      component: 'SecurityService'
    });
  }

  /**
   * Validate a plugin action
   */
  async validatePluginAction(pluginId: string, action: string, args: any[]): Promise<void> {
    // Log the action for auditing
    await this.audit.logEvent({
      type: AuditEventType.PLUGIN_ACTIVATED,
      user: {
        id: 'plugin:' + pluginId,
        username: pluginId
      },
      action: action,
      resource: {
        type: 'plugin-api',
        id: pluginId
      },
      details: {
        pluginId,
        args: args.length > 0 ? 'provided' : 'none'
      },
      status: 'success'
    });

    // Validate the action based on security rules
    const securityRules: Record<string, (args: any[]) => void> = {
      'readFile': (args) => {
        if (!args[0] || typeof args[0] !== 'string') {
          throw new Error('Invalid file path');
        }
        // Prevent path traversal
        if (args[0].includes('..') || args[0].includes('~')) {
          throw new Error('Path traversal detected');
        }
      },
      'writeFile': (args) => {
        if (!args[0] || typeof args[0] !== 'string') {
          throw new Error('Invalid file path');
        }
        // Prevent path traversal
        if (args[0].includes('..') || args[0].includes('~')) {
          throw new Error('Path traversal detected');
        }
        // Prevent writing to sensitive locations
        const sensitivePatterns = ['/etc', '/usr', '/bin', '/sbin', '/boot', 'C:\\Windows', 'C:\\Program'];
        if (sensitivePatterns.some(pattern => args[0].startsWith(pattern))) {
          throw new Error('Cannot write to system directories');
        }
      },
      'makeHttpRequest': (args) => {
        if (!args[0] || typeof args[0] !== 'string') {
          throw new Error('Invalid URL');
        }
        // Prevent internal network access
        const url = new URL(args[0]);
        const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
        if (blockedHosts.includes(url.hostname)) {
          throw new Error('Access to internal network is blocked');
        }
        // Prevent non-HTTP(S) protocols
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error('Only HTTP(S) protocols are allowed');
        }
      },
      'accessDatabase': (args) => {
        // Validate query parameters
        if (args[0] && typeof args[0] === 'string') {
          // Basic SQL injection prevention
          const dangerousPatterns = [';--', '/*', '*/', 'xp_', 'sp_', 'DROP', 'DELETE', 'TRUNCATE'];
          const upperQuery = args[0].toUpperCase();
          if (dangerousPatterns.some(pattern => upperQuery.includes(pattern))) {
            throw new Error('Potentially dangerous SQL detected');
          }
        }
      }
    };

    // Apply validation rule if it exists
    const validator = securityRules[action];
    if (validator) {
      try {
        validator(args);
      } catch (error) {
        await this.audit.logEvent({
          type: AuditEventType.SYSTEM_ERROR,
          user: {
            id: 'plugin:' + pluginId,
            username: pluginId
          },
          action: action,
          resource: {
            type: 'plugin-api',
            id: pluginId
          },
          details: {
            pluginId,
            error: error instanceof Error ? error.message : 'Unknown error'
          },
          status: 'failure',
          reason: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    }

    // Log successful validation
    await this.audit.logEvent({
      type: AuditEventType.PLUGIN_ACTIVATED,
      user: {
        id: 'plugin:' + pluginId,
        username: pluginId
      },
      action: action,
      resource: {
        type: 'plugin-api',
        id: pluginId
      },
      details: {
        pluginId
      },
      status: 'success'
    });
  }
}

// Export alias for backwards compatibility
export { SecurityServiceImpl as SecurityService };