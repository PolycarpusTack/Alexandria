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
  ValidationService 
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
    options?: {
      jwtSecret?: string;
      tokenExpiration?: number; // in seconds
      encryptionKey?: string;
    }
  ) {
    this.logger = logger;
    
    // Create individual services
    this.authentication = new JwtAuthenticationService(logger, dataService, {
      jwtSecret: options?.jwtSecret,
      tokenExpiration: options?.tokenExpiration
    });
    
    this.authorization = new RbacAuthorizationService(logger, dataService);
    
    this.encryption = new CryptoEncryptionService(logger, {
      key: options?.encryptionKey
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
}