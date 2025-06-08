/**
 * Session Middleware for Alexandria Platform
 * 
 * Handles session management for Express applications.
 */

import { Request, Response, NextFunction } from 'express';
import { SessionStore, SessionData } from './session-store';
import { createLogger } from '../../utils/logger';

const logger = createLogger({ serviceName: 'SessionMiddleware' });

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      session?: SessionData;
      sessionId?: string;
    }
  }
}

export interface SessionMiddlewareOptions {
  sessionStore: SessionStore;
  cookieName?: string;
  trustProxy?: boolean;
  checkInterval?: number;
}

/**
 * Create session middleware
 */
export function createSessionMiddleware(options: SessionMiddlewareOptions) {
  const {
    sessionStore,
    cookieName = 'alexandria_session',
    trustProxy = false,
    checkInterval = 60000 // 1 minute
  } = options;

  // Periodically touch active sessions
  const activeSessions = new Set<string>();
  
  setInterval(() => {
    activeSessions.forEach(async (sessionId) => {
      try {
        await sessionStore.touch(sessionId);
      } catch (error) {
        logger.error('Failed to touch session', { sessionId, error });
      }
    });
    activeSessions.clear();
  }, checkInterval);

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get session ID from cookie
      const sessionId = req.cookies?.[cookieName];

      if (!sessionId) {
        // No session
        return next();
      }

      // Get session from store
      const session = await sessionStore.get(sessionId);

      if (!session) {
        // Invalid or expired session - clear cookie
        res.clearCookie(cookieName, sessionStore.getCookieOptions());
        return next();
      }

      // Attach session to request
      req.session = session;
      req.sessionId = sessionId;

      // Track active session for touch
      activeSessions.add(sessionId);

      // Update session activity on response finish
      res.on('finish', () => {
        if (req.sessionId && res.statusCode < 400) {
          sessionStore.touch(req.sessionId).catch(err => {
            logger.error('Failed to update session activity', { 
              sessionId: req.sessionId, 
              error: err 
            });
          });
        }
      });

      next();
    } catch (error) {
      logger.error('Session middleware error', { error });
      next(error);
    }
  };
}

/**
 * Session management utilities
 */
export const sessionUtils = {
  /**
   * Create a new session
   */
  async createSession(
    req: Request,
    res: Response,
    sessionStore: SessionStore,
    data: Omit<SessionData, 'id' | 'createdAt' | 'lastActivity' | 'expiresAt'>,
    cookieName = 'alexandria_session'
  ): Promise<SessionData> {
    // Get client info
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // Create session with client info
    const session = await sessionStore.create({
      ...data,
      ipAddress,
      userAgent
    });

    // Set cookie
    res.cookie(cookieName, session.id, sessionStore.getCookieOptions());

    // Attach to request
    req.session = session;
    req.sessionId = session.id;

    logger.debug('Session created', { 
      sessionId: session.id, 
      userId: data.userId 
    });

    return session;
  },

  /**
   * Destroy current session
   */
  async destroySession(
    req: Request,
    res: Response,
    sessionStore: SessionStore,
    cookieName = 'alexandria_session'
  ): Promise<void> {
    if (!req.sessionId) {
      return;
    }

    // Destroy session
    await sessionStore.destroy(req.sessionId);

    // Clear cookie
    res.clearCookie(cookieName, sessionStore.getCookieOptions());

    // Clear from request
    delete req.session;
    delete req.sessionId;

    logger.debug('Session destroyed', { sessionId: req.sessionId });
  },

  /**
   * Regenerate session ID (for security)
   */
  async regenerateSession(
    req: Request,
    res: Response,
    sessionStore: SessionStore,
    cookieName = 'alexandria_session'
  ): Promise<SessionData | null> {
    if (!req.session) {
      return null;
    }

    const oldSessionId = req.sessionId!;
    
    // Create new session with same data
    const newSession = await sessionStore.create({
      userId: req.session.userId,
      username: req.session.username,
      roles: req.session.roles,
      permissions: req.session.permissions,
      metadata: req.session.metadata
    });

    // Destroy old session
    await sessionStore.destroy(oldSessionId);

    // Set new cookie
    res.cookie(cookieName, newSession.id, sessionStore.getCookieOptions());

    // Update request
    req.session = newSession;
    req.sessionId = newSession.id;

    logger.debug('Session regenerated', { 
      oldSessionId, 
      newSessionId: newSession.id 
    });

    return newSession;
  },

  /**
   * Get all sessions for current user
   */
  async getUserSessions(
    req: Request,
    sessionStore: SessionStore
  ): Promise<SessionData[]> {
    if (!req.session) {
      return [];
    }

    return sessionStore.getUserSessions(req.session.userId);
  },

  /**
   * Destroy all sessions for current user
   */
  async destroyAllUserSessions(
    req: Request,
    res: Response,
    sessionStore: SessionStore,
    cookieName = 'alexandria_session'
  ): Promise<number> {
    if (!req.session) {
      return 0;
    }

    const userId = req.session.userId;
    
    // Destroy all sessions
    const count = await sessionStore.destroyAll(userId);

    // Clear current cookie
    res.clearCookie(cookieName, sessionStore.getCookieOptions());

    // Clear from request
    delete req.session;
    delete req.sessionId;

    logger.debug('All user sessions destroyed', { userId, count });

    return count;
  }
};

/**
 * Session-based authentication check middleware
 */
export function requireSession(
  options: {
    redirectTo?: string;
    sendError?: boolean;
  } = {}
) {
  const { redirectTo, sendError = true } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session) {
      logger.debug('Access denied - no session', {
        path: req.path,
        method: req.method,
        ip: req.ip
      });

      if (redirectTo) {
        return res.redirect(redirectTo);
      }

      if (sendError) {
        return res.status(401).json({
          error: 'Authentication required'
        });
      }

      return next(new Error('Authentication required'));
    }

    // Check if session is still valid
    const now = new Date();
    if (now > new Date(req.session.expiresAt)) {
      logger.debug('Access denied - session expired', {
        sessionId: req.sessionId,
        userId: req.session.userId
      });

      if (redirectTo) {
        return res.redirect(redirectTo);
      }

      if (sendError) {
        return res.status(401).json({
          error: 'Session expired'
        });
      }

      return next(new Error('Session expired'));
    }

    next();
  };
}