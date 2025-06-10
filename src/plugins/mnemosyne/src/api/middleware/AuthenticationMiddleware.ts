/**
 * Mnemosyne Authentication Middleware
 * 
 * Handles authentication, authorization, and permission validation
 * for all API endpoints with integration to Alexandria security system
 */

import { Request, Response, NextFunction } from 'express';
import { Logger } from '@alexandria/plugin-interface';
import { MnemosyneCore } from '../../core/MnemosyneCore';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
    roles: string[];
    permissions: string[];
    metadata?: Record<string, any>;
  };
  requestId?: string;
}

export interface AuthenticationOptions {
  required?: boolean;
  allowApiKey?: boolean;
  allowServiceToken?: boolean;
  skipForHealthChecks?: boolean;
}

export interface PermissionOptions {
  permissions: string[];
  requireAll?: boolean;
  allowSuperuser?: boolean;
}

/**
 * Authentication and Authorization Middleware
 * 
 * Provides comprehensive authentication and permission checking
 * for the Mnemosyne API with Alexandria platform integration
 */
export class AuthenticationMiddleware {
  private readonly core: MnemosyneCore;
  private readonly logger: Logger;

  constructor(core: MnemosyneCore, logger: Logger) {
    this.core = core;
    this.logger = logger.child({ component: 'AuthenticationMiddleware' });
  }

  /**
   * Main authentication middleware
   */
  public authenticate = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authHeader = req.get('Authorization');
      const apiKey = req.get('X-API-Key');
      const serviceToken = req.get('X-Service-Token');

      let user = null;

      // Try Bearer token authentication
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        user = await this.authenticateWithBearerToken(token);
      }
      // Try API key authentication
      else if (apiKey) {
        user = await this.authenticateWithApiKey(apiKey);
      }
      // Try service token authentication
      else if (serviceToken) {
        user = await this.authenticateWithServiceToken(serviceToken);
      }

      if (!user) {
        this.logger.warn('Authentication failed', {
          requestId: req.requestId,
          path: req.path,
          method: req.method,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        return this.sendUnauthorizedResponse(res, 'Authentication required');
      }

      // Store user in request
      req.user = user;

      this.logger.debug('User authenticated', {
        requestId: req.requestId,
        userId: user.id,
        username: user.username,
        roles: user.roles
      });

      next();

    } catch (error) {
      this.logger.error('Authentication error', {
        requestId: req.requestId,
        error: error.message,
        path: req.path
      });

      this.sendUnauthorizedResponse(res, 'Authentication failed');
    }
  };

  /**
   * Optional authentication middleware
   */
  public optionalAuthenticate = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authHeader = req.get('Authorization');
      const apiKey = req.get('X-API-Key');

      if (authHeader || apiKey) {
        // If auth headers are present, validate them
        await this.authenticate(req, res, next);
      } else {
        // No auth headers, continue without user
        next();
      }
    } catch (error) {
      // For optional auth, continue even if auth fails
      next();
    }
  };

  /**
   * Permission checking middleware factory
   */
  public requirePermission = (
    permission: string | string[],
    options: Partial<PermissionOptions> = {}
  ) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        return this.sendUnauthorizedResponse(res, 'Authentication required');
      }

      const permissions = Array.isArray(permission) ? permission : [permission];
      const requireAll = options.requireAll !== false; // Default to true
      const allowSuperuser = options.allowSuperuser !== false; // Default to true

      // Check for superuser role
      if (allowSuperuser && req.user.roles.includes('superuser')) {
        this.logger.debug('Superuser access granted', {
          requestId: req.requestId,
          userId: req.user.id,
          permissions
        });
        return next();
      }

      // Check permissions
      const hasPermissions = requireAll
        ? permissions.every(perm => req.user!.permissions.includes(perm))
        : permissions.some(perm => req.user!.permissions.includes(perm));

      if (!hasPermissions) {
        this.logger.warn('Permission denied', {
          requestId: req.requestId,
          userId: req.user.id,
          requiredPermissions: permissions,
          userPermissions: req.user.permissions,
          requireAll
        });

        return this.sendForbiddenResponse(res, 'Insufficient permissions');
      }

      this.logger.debug('Permission granted', {
        requestId: req.requestId,
        userId: req.user.id,
        permissions
      });

      next();
    };
  };

  /**
   * Role checking middleware factory
   */
  public requireRole = (
    role: string | string[],
    requireAll = false
  ) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        return this.sendUnauthorizedResponse(res, 'Authentication required');
      }

      const roles = Array.isArray(role) ? role : [role];
      
      const hasRoles = requireAll
        ? roles.every(r => req.user!.roles.includes(r))
        : roles.some(r => req.user!.roles.includes(r));

      if (!hasRoles) {
        this.logger.warn('Role access denied', {
          requestId: req.requestId,
          userId: req.user.id,
          requiredRoles: roles,
          userRoles: req.user.roles,
          requireAll
        });

        return this.sendForbiddenResponse(res, 'Insufficient role privileges');
      }

      next();
    };
  };

  /**
   * Resource ownership middleware
   */
  public requireOwnership = (
    resourceIdParam: string,
    ownershipField = 'author'
  ) => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      if (!req.user) {
        return this.sendUnauthorizedResponse(res, 'Authentication required');
      }

      try {
        const resourceId = req.params[resourceIdParam];
        if (!resourceId) {
          return this.sendBadRequestResponse(res, `Missing resource ID: ${resourceIdParam}`);
        }

        // Check if user owns the resource or has admin privileges
        const isOwner = await this.checkResourceOwnership(
          resourceId,
          req.user.id,
          ownershipField
        );

        const hasAdminRole = req.user.roles.includes('admin') || req.user.roles.includes('superuser');

        if (!isOwner && !hasAdminRole) {
          this.logger.warn('Resource ownership denied', {
            requestId: req.requestId,
            userId: req.user.id,
            resourceId,
            ownershipField
          });

          return this.sendForbiddenResponse(res, 'Access denied: resource ownership required');
        }

        next();

      } catch (error) {
        this.logger.error('Ownership check error', {
          requestId: req.requestId,
          error: error.message
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'OWNERSHIP_CHECK_ERROR',
            message: 'Failed to verify resource ownership'
          }
        });
      }
    };
  };

  /**
   * API key validation middleware
   */
  public requireValidApiKey = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const apiKey = req.get('X-API-Key');

    if (!apiKey) {
      return this.sendUnauthorizedResponse(res, 'API key required');
    }

    try {
      const isValid = await this.validateApiKey(apiKey);
      
      if (!isValid) {
        this.logger.warn('Invalid API key', {
          requestId: req.requestId,
          apiKey: apiKey.substring(0, 8) + '***',
          ip: req.ip
        });

        return this.sendUnauthorizedResponse(res, 'Invalid API key');
      }

      next();

    } catch (error) {
      this.logger.error('API key validation error', {
        requestId: req.requestId,
        error: error.message
      });

      this.sendUnauthorizedResponse(res, 'API key validation failed');
    }
  };

  // Private helper methods

  /**
   * Authenticate user with Bearer token
   */
  private async authenticateWithBearerToken(token: string): Promise<any> {
    try {
      // Integration with Alexandria's authentication service
      const securityService = this.core.getSecurityService();
      return await securityService.validateJwtToken(token);
    } catch (error) {
      this.logger.debug('Bearer token authentication failed', { error: error.message });
      return null;
    }
  }

  /**
   * Authenticate user with API key
   */
  private async authenticateWithApiKey(apiKey: string): Promise<any> {
    try {
      // Integration with Alexandria's API key service
      const securityService = this.core.getSecurityService();
      return await securityService.validateApiKey(apiKey);
    } catch (error) {
      this.logger.debug('API key authentication failed', { error: error.message });
      return null;
    }
  }

  /**
   * Authenticate with service token
   */
  private async authenticateWithServiceToken(serviceToken: string): Promise<any> {
    try {
      // Service-to-service authentication
      const securityService = this.core.getSecurityService();
      return await securityService.validateServiceToken(serviceToken);
    } catch (error) {
      this.logger.debug('Service token authentication failed', { error: error.message });
      return null;
    }
  }

  /**
   * Check if user owns a resource
   */
  private async checkResourceOwnership(
    resourceId: string,
    userId: string,
    ownershipField: string
  ): Promise<boolean> {
    try {
      // Check document ownership
      const document = await this.core.getDocumentService().getDocument(resourceId);
      if (document) {
        return document[ownershipField as keyof typeof document] === userId;
      }

      // Check node ownership (if applicable)
      const node = await this.core.getKnowledgeGraphService().getNode(resourceId);
      if (node && node.metadata?.owner) {
        return node.metadata.owner === userId;
      }

      return false;
    } catch (error) {
      this.logger.warn('Resource ownership check failed', {
        resourceId,
        userId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Validate API key
   */
  private async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      // Simple API key validation - in production, this would check against a database
      const validApiKeys = process.env.MNEMOSYNE_API_KEYS?.split(',') || [];
      return validApiKeys.includes(apiKey);
    } catch (error) {
      return false;
    }
  }

  // Response helper methods

  private sendUnauthorizedResponse(res: Response, message: string): void {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }

  private sendForbiddenResponse(res: Response, message: string): void {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }

  private sendBadRequestResponse(res: Response, message: string): void {
    res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
}