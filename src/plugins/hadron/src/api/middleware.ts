/**
 * Authentication middleware for the Crash Analyzer Plugin
 *
 * This file provides a function to apply authentication middleware to the plugin's routes.
 */

import { Router } from 'express';
import { Logger } from '../../../../utils/logger';
import { SecurityService } from '../../../../core/security/interfaces';

/**
 * Apply authentication middleware to the plugin's routes
 *
 * @param router The Express router to protect with authentication
 * @param securityService The security service providing authentication
 * @param logger The logger instance
 * @param requireAuth Whether to require authentication for all routes (defaults to true)
 * @returns The protected router
 */
export function applyAuthMiddleware(
  router: Router,
  securityService: SecurityService,
  logger: Logger,
  requireAuth = true
): Router {
  const wrappedRouter = Router();

  // Apply authentication middleware to all routes
  wrappedRouter.use(async (req, res, next) => {
    try {
      // Extract token from request
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        if (requireAuth) {
          logger.debug('Authentication required but no token provided', {
            component: 'CrashAnalyzerAuth',
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

      // Extract token from Bearer format
      const parts = authHeader.split(' ');

      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        if (requireAuth) {
          return res.status(401).json({
            error: 'Invalid authorization header format'
          });
        }

        return next();
      }

      const token = parts[1];

      // Validate token
      try {
        const payload = await securityService.authentication.validateToken(token);

        // Get user from data service
        const user = await securityService.authentication
          .refreshToken(token)
          .then((result) => result.user)
          .catch(() => null);

        if (!user) {
          if (requireAuth) {
            return res.status(401).json({
              error: 'Invalid or expired authentication token'
            });
          }

          return next();
        }

        // Attach user to request
        req.user = user;

        logger.debug('User authenticated successfully', {
          component: 'CrashAnalyzerAuth',
          userId: user.id,
          username: user.username
        });

        next();
      } catch (error) {
        // Token validation failed
        logger.debug('Token validation failed', {
          component: 'CrashAnalyzerAuth',
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
        component: 'CrashAnalyzerAuth',
        error: error instanceof Error ? error.message : String(error)
      });

      // For unexpected errors, continue to error handling middleware
      next(error);
    }
  });

  // Mount the original router
  wrappedRouter.use(router);

  return wrappedRouter;
}

/**
 * Example usage in plugin activation:
 *
 * import { applyAuthMiddleware } from './api/middleware';
 *
 * // In plugin activate method:
 * const fileSecurityRouter = createFileSecurityRouter(fileSecurityApi, logger);
 * const fileUploadRouter = createFileUploadRouter(fileSecurityApi, logger);
 *
 * // Apply authentication middleware
 * const protectedFileSecurityRouter = applyAuthMiddleware(
 *   fileSecurityRouter,
 *   context.services.security,
 *   context.services.logger
 * );
 *
 * const protectedFileUploadRouter = applyAuthMiddleware(
 *   fileUploadRouter,
 *   context.services.security,
 *   context.services.logger
 * );
 *
 * // Register protected routes
 * context.services.api.registerRoutes('/api/security', protectedFileSecurityRouter);
 * context.services.api.registerRoutes('/api/files', protectedFileUploadRouter);
 */
