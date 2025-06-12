/**
 * Authentication API v2
 * Enhanced authentication with better security and response structures
 */

import { Router, Request, Response } from 'express';
import { APIVersionRequest } from '../versioning';
import { validateRequest, validationSchemas } from '../../core/middleware/validation-middleware';
import { createLogger } from '../../utils/logger';

const router = Router();
const logger = createLogger({ serviceName: 'auth-api-v2' });

interface AuthResponse {
  data: {
    accessToken: string;
    refreshToken?: string;
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      permissions: string[];
      profile?: {
        avatar?: string;
        preferences?: any;
      };
    };
    session: {
      expiresAt: string;
      refreshExpiresAt?: string;
      type: 'temporary' | 'persistent';
    };
  };
  meta: {
    apiVersion: string;
    timestamp: string;
    requestId: string;
  };
}

// Enhanced login endpoint (v2 format)
router.post(
  '/login',
  validateRequest(validationSchemas.login),
  async (req: APIVersionRequest, res: Response): Promise<void> => {
    try {
      const { email, password, rememberMe } = req.body;
      const requestId = (req.headers['x-request-id'] as string) || 'unknown';

      // Basic demo user authentication
      if (email === 'admin@alexandria.local' && password === 'admin123') {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + (rememberMe ? 24 * 30 : 24)); // 30 days or 1 day

        const refreshExpiresAt = new Date();
        refreshExpiresAt.setHours(refreshExpiresAt.getHours() + (rememberMe ? 24 * 90 : 24 * 7)); // 90 days or 7 days

        const response: AuthResponse = {
          data: {
            accessToken: 'demo-jwt-token-v2',
            refreshToken: rememberMe ? 'demo-refresh-token-v2' : undefined,
            user: {
              id: '1',
              email: email,
              name: 'Administrator',
              role: 'admin',
              permissions: ['read', 'write', 'admin', 'plugin:manage'],
              profile: {
                avatar: null,
                preferences: {
                  theme: 'system',
                  language: 'en',
                  notifications: true
                }
              }
            },
            session: {
              expiresAt: expiresAt.toISOString(),
              refreshExpiresAt: rememberMe ? refreshExpiresAt.toISOString() : undefined,
              type: rememberMe ? 'persistent' : 'temporary'
            }
          },
          meta: {
            apiVersion: req.apiVersion,
            timestamp: new Date().toISOString(),
            requestId
          }
        };

        logger.info('User login successful (demo)', {
          userId: response.data.user.id,
          apiVersion: req.apiVersion,
          sessionType: response.data.session.type,
          requestId
        });

        res.json(response);
      } else {
        res.status(401).json({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
            details: 'The provided credentials do not match any user account'
          },
          meta: {
            apiVersion: req.apiVersion,
            timestamp: new Date().toISOString(),
            requestId
          }
        });
      }
    } catch (error) {
      logger.error('Login error', {
        error: error instanceof Error ? error.message : String(error),
        apiVersion: req.apiVersion
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An internal error occurred during authentication',
          timestamp: new Date().toISOString()
        },
        meta: {
          apiVersion: req.apiVersion,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }
);

// Enhanced logout endpoint
router.post('/logout', (req: APIVersionRequest, res: Response) => {
  const requestId = (req.headers['x-request-id'] as string) || 'unknown';

  logger.info('User logout', {
    apiVersion: req.apiVersion,
    requestId
  });

  res.json({
    data: {
      message: 'Successfully logged out',
      loggedOutAt: new Date().toISOString()
    },
    meta: {
      apiVersion: req.apiVersion,
      timestamp: new Date().toISOString(),
      requestId
    }
  });
});

// Enhanced token validation endpoint
router.get('/validate', (req: APIVersionRequest, res: Response) => {
  const authHeader = req.headers.authorization;
  const requestId = (req.headers['x-request-id'] as string) || 'unknown';

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: {
        code: 'NO_TOKEN',
        message: 'No valid authorization token provided',
        details: 'Authorization header must contain a Bearer token'
      },
      meta: {
        apiVersion: req.apiVersion,
        timestamp: new Date().toISOString(),
        requestId
      }
    });
  }

  const token = authHeader.substring(7);

  // Enhanced token validation (in real implementation, verify JWT)
  if (token === 'demo-jwt-token-v2') {
    res.json({
      data: {
        valid: true,
        user: {
          id: '1',
          email: 'admin@alexandria.local',
          name: 'Administrator',
          role: 'admin',
          permissions: ['read', 'write', 'admin', 'plugin:manage']
        },
        session: {
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          type: 'temporary'
        }
      },
      meta: {
        apiVersion: req.apiVersion,
        timestamp: new Date().toISOString(),
        requestId
      }
    });
  } else {
    res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Token is invalid or expired',
        details: 'The provided token could not be verified'
      },
      meta: {
        apiVersion: req.apiVersion,
        timestamp: new Date().toISOString(),
        requestId
      }
    });
  }
});

// New refresh token endpoint (v2 only)
router.post('/refresh', (req: APIVersionRequest, res: Response) => {
  const { refreshToken } = req.body;
  const requestId = (req.headers['x-request-id'] as string) || 'unknown';

  if (!refreshToken) {
    return res.status(400).json({
      error: {
        code: 'MISSING_REFRESH_TOKEN',
        message: 'Refresh token is required',
        details: 'Request body must contain a valid refresh token'
      },
      meta: {
        apiVersion: req.apiVersion,
        timestamp: new Date().toISOString(),
        requestId
      }
    });
  }

  // Mock refresh token validation
  if (refreshToken === 'demo-refresh-token-v2') {
    const newExpiresAt = new Date();
    newExpiresAt.setHours(newExpiresAt.getHours() + 24);

    res.json({
      data: {
        accessToken: 'demo-jwt-token-v2-refreshed',
        session: {
          expiresAt: newExpiresAt.toISOString(),
          type: 'persistent'
        }
      },
      meta: {
        apiVersion: req.apiVersion,
        timestamp: new Date().toISOString(),
        requestId
      }
    });
  } else {
    res.status(401).json({
      error: {
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is invalid or expired'
      },
      meta: {
        apiVersion: req.apiVersion,
        timestamp: new Date().toISOString(),
        requestId
      }
    });
  }
});

export default router;
