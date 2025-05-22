import { Logger } from '../../../../utils/logger';
import { EnhancedFileStorageService } from '../services/enhanced-file-storage-service';
import { FileSecurityService } from '../services/file-security-service';
import { FileRepository } from '../data/repositories/fileRepository';
import { AnalysisSessionRepository } from '../data/repositories/analysisSessionRepository';
import { UserRepository } from '../data/repositories/userRepository';
import { HadronRepository } from '../repositories/hadron-repository';
import { SecurityService } from '../../../../core/security/interfaces';

import { FileSecurityApi } from './file-security-service-api';
import { createFileSecurityRouter } from './file-security-api';
import { createFileUploadRouter } from './file-upload-api';
import { applyAuthMiddleware } from './middleware';
import { requirePermission, requireAnyPermission } from './permission-middleware';

/**
 * Initialize the API layer for the Hadron Crash Analyzer
 * 
 * This function creates and configures all the necessary components for the API layer
 */
export function initializeApi(
  fileRepository: FileRepository,
  userRepository: UserRepository,
  sessionRepository: AnalysisSessionRepository,
  hadronRepository: HadronRepository,
  logger: Logger,
  securityService: SecurityService,
  config: {
    baseStoragePath: string;
    maxFileSize?: number;
    enableDeduplication?: boolean;
    enableAutoScan?: boolean;
    requireAuth?: boolean;
  }
) {
  // Initialize the file storage service
  const fileStorageService = new EnhancedFileStorageService(
    {
      baseStoragePath: config.baseStoragePath,
      maxSizeBytes: config.maxFileSize || 50 * 1024 * 1024, // 50MB default
      enableDeduplication: config.enableDeduplication ?? true,
      enableAutoScan: config.enableAutoScan ?? true
    },
    fileRepository,
    sessionRepository,
    userRepository,
    logger
  );
  
  // Initialize the file security service
  const fileSecurityService = new FileSecurityService(
    hadronRepository,
    logger,
    {
      baseStoragePath: config.baseStoragePath,
      maxSizeBytes: config.maxFileSize || 50 * 1024 * 1024,
      quarantineDir: `${config.baseStoragePath}/quarantine`
    }
  );
  
  // Initialize the file security API
  const fileSecurityApi = new FileSecurityApi(
    fileStorageService,
    fileSecurityService,
    fileRepository,
    userRepository,
    sessionRepository,
    logger
  );
  
  // Create the routers
  const fileSecurityRouter = createFileSecurityRouter(fileSecurityApi, logger);
  const fileUploadRouter = createFileUploadRouter(
    fileSecurityApi, 
    logger, 
    config.maxFileSize || 50 * 1024 * 1024
  );
  
  // Apply authentication middleware to protect routes if requested
  const requireAuth = config.requireAuth ?? true; // Default to requiring auth
  
  // Apply auth middleware to routers
  const protectedFileSecurityRouter = applyAuthMiddleware(
    fileSecurityRouter,
    securityService,
    logger,
    requireAuth
  );
  
  const protectedFileUploadRouter = applyAuthMiddleware(
    fileUploadRouter,
    securityService,
    logger,
    requireAuth
  );
  
  return {
    fileStorageService,
    fileSecurityService,
    fileSecurityApi,
    routers: {
      fileSecurityRouter: protectedFileSecurityRouter,
      fileUploadRouter: protectedFileUploadRouter
    }
  };
}

export * from './file-security-service-api';
export { createFileSecurityRouter } from './file-security-api';
export { createFileUploadRouter } from './file-upload-api';
export { applyAuthMiddleware } from './middleware';
export { requirePermission, requireAnyPermission } from './permission-middleware';