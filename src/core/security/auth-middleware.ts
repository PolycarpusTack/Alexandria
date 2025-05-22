/**
 * Authentication Middleware for the Alexandria Platform
 * 
 * This middleware handles extracting and validating JWT tokens from requests,
 * retrieving user information, and attaching the user object to the request.
 */

import { Request, Response, NextFunction } from 'express';
import { AuthenticationService } from './interfaces';
import { Logger } from '../../utils/logger';

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
        const user = await retrieveUserDetails(payload.userId);
        
        // Attach user to request
        req.user = user;
        
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
 * This is a placeholder and would be replaced with actual implementation
 */
async function retrieveUserDetails(userId: string) {
  // In a real implementation, this would fetch user from the data service
  // For now, we're creating a simple mock
  return {
    id: userId,
    username: 'user', // This would be retrieved from database
    email: 'user@example.com',
    roles: ['user'],
    permissions: ['read:own', 'write:own'],
    isActive: true
  };
}