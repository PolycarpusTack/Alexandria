/**
 * Permission-based middleware for the Crash Analyzer Plugin
 *
 * This file provides a function to apply permission checks to specific routes
 */

import { RequestHandler } from 'express';
import { Logger } from '../../../../utils/logger';
import { SecurityService } from '../../../../core/security/interfaces';

/**
 * Create middleware that checks if a user has a specific permission
 *
 * @param securityService The security service providing authorization checks
 * @param permission The permission required for the route
 * @param logger The logger instance
 * @returns Express middleware function that checks permissions
 */
export function requirePermission(
  securityService: SecurityService,
  permission: string,
  logger: Logger
): RequestHandler {
  return (req, res, next) => {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        logger.debug('Permission check failed: No authenticated user', {
          component: 'PermissionMiddleware',
          permission,
          path: req.path
        });

        return res.status(401).json({
          error: 'Authentication required'
        });
      }

      // Check if user has required permission
      const result = securityService.authorization.hasPermission(req.user, permission);

      if (!result.granted) {
        logger.debug('Permission check failed: Insufficient permissions', {
          component: 'PermissionMiddleware',
          permission,
          userId: req.user.id,
          username: req.user.username,
          reason: result.reason
        });

        return res.status(403).json({
          error: 'Insufficient permissions',
          message: result.reason || `User lacks required permission: ${permission}`
        });
      }

      logger.debug('Permission check passed', {
        component: 'PermissionMiddleware',
        permission,
        userId: req.user.id,
        username: req.user.username
      });

      // User has permission, proceed
      next();
    } catch (error) {
      logger.error('Error in permission middleware', {
        component: 'PermissionMiddleware',
        permission,
        error: error instanceof Error ? error.message : String(error)
      });

      next(error);
    }
  };
}

/**
 * Create middleware that checks if a user has any of the specified permissions
 *
 * @param securityService The security service providing authorization checks
 * @param permissions Array of permissions (any one is sufficient)
 * @param logger The logger instance
 * @returns Express middleware function that checks permissions
 */
export function requireAnyPermission(
  securityService: SecurityService,
  permissions: string[],
  logger: Logger
): RequestHandler {
  return (req, res, next) => {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        logger.debug('Permission check failed: No authenticated user', {
          component: 'PermissionMiddleware',
          permissions,
          path: req.path
        });

        return res.status(401).json({
          error: 'Authentication required'
        });
      }

      // Check if user has any of the required permissions
      const result = securityService.authorization.hasAnyPermission(req.user, permissions);

      if (!result.granted) {
        logger.debug('Permission check failed: Insufficient permissions', {
          component: 'PermissionMiddleware',
          permissions,
          userId: req.user.id,
          username: req.user.username,
          reason: result.reason
        });

        return res.status(403).json({
          error: 'Insufficient permissions',
          message: result.reason || `User lacks any required permissions: ${permissions.join(', ')}`
        });
      }

      logger.debug('Permission check passed', {
        component: 'PermissionMiddleware',
        permissions,
        userId: req.user.id,
        username: req.user.username
      });

      // User has at least one permission, proceed
      next();
    } catch (error) {
      logger.error('Error in permission middleware', {
        component: 'PermissionMiddleware',
        permissions,
        error: error instanceof Error ? error.message : String(error)
      });

      next(error);
    }
  };
}

/**
 * Example usage:
 *
 * import { requirePermission, requireAnyPermission } from './permission-middleware';
 *
 * // In API route setup:
 * router.post('/upload/:sessionId',
 *   requirePermission(securityService, 'crash-analyzer:upload', logger),
 *   upload.single('file'),
 *   async (req, res) => {
 *     // Route handler logic
 *   }
 * );
 *
 * router.get('/files',
 *   requireAnyPermission(securityService, ['crash-analyzer:read', 'admin'], logger),
 *   async (req, res) => {
 *     // Route handler logic
 *   }
 * );
 */
