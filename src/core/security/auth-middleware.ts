/// <reference path="../../types/express-custom.d.ts" />
/**
 * Authentication Middleware for the Alexandria Platform
 * 
 * This middleware handles extracting and validating JWT tokens from requests,
 * retrieving user information, and attaching the user object to the request.
 */

import { Request, Response, NextFunction, Application } from 'express';
import { AuthenticationService } from './interfaces';
import { createLogger, Logger } from '../../utils/logger';
import { DataService } from '../data/interfaces';

// User interface is already declared in express-custom.d.ts
interface AlexandriaUser {
  id: string;
  username: string;
  email?: string;
  roles: string[];
  permissions: string[];
}

// Extend Express types
interface AlexandriaApp extends Application {
  locals: {
    dataService?: DataService;
    [key: string]: any;
  };
}

interface AlexandriaRequest extends Request {
  app: AlexandriaApp;
}

/**
 * Options for the authentication middleware
 */
export interface AuthMiddlewareOptions {
  /**
   * Whether to require authentication for all routes.
   * If true, all routes will return 401 if not authenticated.
   * If false, routes will continue without user object if not authenticated.
   */
  requireAuth?: boolean;

  /**
   * Custom function to extract token from request.
   * By default, tokens are extracted from the Authorization header.
   */
  tokenExtractor?: (req: Request) => string | null;
}

/**
 * Create an Express middleware that handles authentication
 * 
 * @param authService Authentication service instance
 * @param logger Logger instance
 * @param options Authentication middleware options
 * @returns Express middleware function
 */
export function createAuthMiddleware(
  authService: AuthenticationService,
  logger: Logger,
  options: AuthMiddlewareOptions = {}
) {
  // Default options
  const {
    requireAuth = false,
    tokenExtractor = defaultTokenExtractor
  } = options;

  // The middleware function
  return async function authMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
      // Extract token from request
      const token = tokenExtractor(req);

      // If no token and auth is required, return 401
      if (!token) {
        if (requireAuth) {
          logger.debug('Authentication required but no token provided', {
            component: 'AuthMiddleware',
            path: req.path,
            method: req.method
          });
          
          return res.status(401).json({
            error: 'Authentication required'
          });
        }
        
        // If no token and auth is not required, continue without user
        return next();
      }

      // Validate token
      try {
        const payload = await authService.validateToken(token);
        
        // Get user details
        const dataService = (req as AlexandriaRequest).app.locals.dataService;
        const user = await retrieveUserDetails(payload.userId, dataService);
        
        // Check if user was found
        if (!user) {
          if (requireAuth) {
            return res.status(401).json({
              error: 'User not found or inactive'
            });
          }
          // Continue without user for optional auth routes
          return next();
        }
        
        // Attach user to request
        req.user = user as any;
        
        logger.debug('User authenticated successfully', {
          component: 'AuthMiddleware',
          userId: user.id,
          username: user.username
        });
        
        next();
      } catch (error) {
        // Token validation failed
        logger.debug('Token validation failed', {
          component: 'AuthMiddleware',
          error: error instanceof Error ? error.message : String(error)
        });
        
        if (requireAuth) {
          return res.status(401).json({
            error: 'Invalid authentication token'
          });
        }
        
        // If auth is not required, continue without user
        next();
      }
    } catch (error) {
      logger.error('Error in authentication middleware', {
        component: 'AuthMiddleware',
        error: error instanceof Error ? error.message : String(error)
      });
      
      // For unexpected errors, continue to error handling middleware
      next(error);
    }
  };
}

/**
 * Default function to extract token from request
 */
function defaultTokenExtractor(req: Request): string | null {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return null;
  }
  
  // Extract token from Bearer format
  const parts = authHeader.split(' ');
  
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
}

/**
 * Retrieve user details from data source
 * @param userId - The user ID to retrieve
 * @param dataService - The data service instance
 * @returns User details or null if not found
 */
async function retrieveUserDetails(userId: string, dataService?: DataService) {
  try {
    // If no data service is provided, return null
    if (!dataService) {
      createLogger({ serviceName: 'auth-middleware' }).warn('No data service available for user retrieval');
      return null;
    }
    
    // Fetch user from database
    const user = await dataService.users.findById(userId);
    
    if (!user || !user.isActive) {
      return null;
    }
    
    // Return user with proper role and permission structure
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      roles: user.roles || ['user'],
      permissions: user.permissions || ['read:own', 'write:own'],
      isActive: user.isActive
    };
  } catch (error) {
    createLogger({ serviceName: 'auth-middleware' }).error('Failed to retrieve user details', { error, userId });
    return null;
  }
}

// Export the middleware for compatibility
export { createAuthMiddleware as authMiddleware };