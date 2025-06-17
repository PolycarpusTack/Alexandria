import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/errors';
import { AuthService, AlexandriaUser } from '../services/AuthService';

// Create singleton auth service
const authService = new AuthService();

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: AlexandriaUser;
    }
  }
}

/**
 * Authentication middleware that integrates with Alexandria's auth system
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check if user is already authenticated by Alexandria
    if (req.user) {
      return next();
    }

    // Get auth token from various sources
    const token = extractToken(req);
    
    if (!token) {
      throw new ApiError('Authentication required', 401);
    }

    // Validate token with auth service
    const user = await authService.validateToken(token);
    
    if (!user) {
      throw new ApiError('Invalid authentication token', 401);
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Authorization middleware for role-based access
 */
export const authorize = (...requiredRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError('Authentication required', 401));
    }

    if (requiredRoles.length === 0) {
      return next();
    }

    const userRole = req.user.role || 'user';
    const hasRequiredRole = requiredRoles.includes(userRole);

    if (!hasRequiredRole) {
      return next(new ApiError('Insufficient permissions', 403));
    }

    next();
  };
};

/**
 * Permission-based authorization middleware
 */
export const requirePermission = (...permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError('Authentication required', 401));
    }

    const hasPermission = authService.hasAnyPermission(req.user, permissions);

    if (!hasPermission) {
      return next(new ApiError('Insufficient permissions', 403));
    }

    next();
  };
};

/**
 * Require all specified permissions
 */
export const requireAllPermissions = (...permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError('Authentication required', 401));
    }

    const hasAllPermissions = authService.hasAllPermissions(req.user, permissions);

    if (!hasAllPermissions) {
      return next(new ApiError('Insufficient permissions', 403));
    }

    next();
  };
};

/**
 * Extract authentication token from request
 */
function extractToken(req: Request): string | null {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check cookie
  if (req.cookies && req.cookies.auth_token) {
    return req.cookies.auth_token;
  }

  // Check query parameter (for WebSocket connections)
  if (req.query.token && typeof req.query.token === 'string') {
    return req.query.token;
  }

  return null;
}


/**
 * Optional authentication - doesn't fail if no auth provided
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);
    
    if (token) {
      const user = await authService.validateToken(token);
      if (user) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Don't fail on auth errors for optional auth
    next();
  }
};