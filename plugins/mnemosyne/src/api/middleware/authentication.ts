import { Request, Response, NextFunction } from 'express';
import { MnemosyneContext } from '../../types/MnemosyneContext';

/**
 * Extended request interface with user information
 * Uses Alexandria's AlexandriaUser type which has optional email and username
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        email?: string;
        role?: string;
        permissions?: string[];
      };
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    email?: string;
    role?: string;
    permissions?: string[];
  };
  permissions?: string[];
}

/**
 * Authentication middleware for Mnemosyne API
 */
export function authMiddleware(context: MnemosyneContext) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Extract authorization header
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          error: 'Authentication required',
          message: 'Please provide a valid authorization token'
        });
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Validate token using Alexandria's security service
      if (!context.security) {
        context.logger.error('Security service not available in context');
        res.status(503).json({
          error: 'Authentication service unavailable'
        });
        return;
      }

      // Verify the token with Alexandria's authentication system
      const user = await verifyToken(token, context);
      
      if (!user) {
        res.status(401).json({
          error: 'Invalid token',
          message: 'The provided token is invalid or expired'
        });
        return;
      }

      // Check basic Mnemosyne permissions
      const requiredPermissions = ['data:read'];
      const hasPermission = await checkPermissions(user, requiredPermissions, context);
      
      if (!hasPermission) {
        res.status(403).json({
          error: 'Insufficient permissions',
          message: 'You do not have permission to access Mnemosyne resources'
        });
        return;
      }

      // Attach user information to request
      req.user = user;
      req.permissions = user.permissions;

      next();

    } catch (error) {
      context.logger.error('Authentication middleware error', { error });
      res.status(500).json({
        error: 'Authentication error',
        message: 'An error occurred during authentication'
      });
    }
  };
}

/**
 * Verify token with Alexandria's authentication system
 */
async function verifyToken(token: string, context: MnemosyneContext): Promise<any> {
  try {
    // This would integrate with Alexandria's actual authentication system
    // For now, this is a placeholder implementation
    
    // In a real implementation, this would:
    // 1. Validate the JWT token
    // 2. Check token expiration
    // 3. Retrieve user information from the database
    // 4. Return user object with permissions
    
    // Placeholder: assume token is valid and return mock user
    if (token === 'invalid') {
      return null;
    }

    return {
      id: 'user-123',
      username: 'testuser',
      permissions: [
        'data:read',
        'data:write',
        'data:search',
        'api:access',
        'ui:render'
      ]
    };

  } catch (error) {
    context.logger.error('Token verification failed', { error });
    return null;
  }
}

/**
 * Check if user has required permissions
 */
async function checkPermissions(
  user: any, 
  requiredPermissions: string[], 
  context: MnemosyneContext
): Promise<boolean> {
  try {
    // Use Alexandria's permission system
    if (context.permissions?.checkPermissions) {
      return context.permissions.checkPermissions(requiredPermissions, {
        userId: user.id,
        userPermissions: user.permissions
      });
    }

    // Fallback: simple permission check
    return requiredPermissions.every(permission => 
      user.permissions.includes(permission)
    );

  } catch (error) {
    context.logger.error('Permission check failed', { error });
    return false;
  }
}

/**
 * Permission-based middleware for specific operations
 */
export function requirePermissions(permissions: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required'
      });
      return;
    }

    const hasPermissions = permissions.every(permission => 
      req.user?.permissions.includes(permission)
    );

    if (!hasPermissions) {
      res.status(403).json({
        error: 'Insufficient permissions',
        required: permissions,
        available: req.user.permissions
      });
      return;
    }

    next();
  };
}

/**
 * Middleware for write operations (create, update, delete)
 */
export function requireWritePermissions() {
  return requirePermissions(['data:write']);
}

/**
 * Middleware for admin operations
 */
export function requireAdminPermissions() {
  return requirePermissions(['admin:access']);
}

/**
 * Middleware for bulk operations
 */
export function requireBulkPermissions() {
  return requirePermissions(['data:write', 'data:bulk']);
}