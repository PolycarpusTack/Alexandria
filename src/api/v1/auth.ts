/**
 * Authentication API v1
 * Handles user authentication and authorization
 */

import { Router, Response, RequestHandler } from 'express';
import { APIVersionRequest, createVersionedResponse } from '../versioning';
import { validateRequest, validationSchemas } from '../../core/middleware/validation-middleware';
import { createLogger } from '../../utils/logger';

const router = Router();
const logger = createLogger({ serviceName: 'auth-api-v1' });

// Define request/response interfaces
interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface LoginResponse {
  success: boolean;
  token?: string;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    permissions: string[];
  };
  expires?: string;
  error?: string;
  message?: string;
}

interface ValidateResponse {
  valid: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  error?: string;
  message?: string;
}

interface LogoutResponse {
  success: boolean;
  message: string;
}

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: User login
 *     description: Authenticate a user with email and password
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@alexandria.local
 *               password:
 *                 type: string
 *                 format: password
 *                 example: admin123
 *               rememberMe:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 token:
 *                   type: string
 *                   example: demo-jwt-token
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "1"
 *                     email:
 *                       type: string
 *                       example: admin@alexandria.local
 *                     name:
 *                       type: string
 *                       example: Administrator
 *                     role:
 *                       type: string
 *                       example: admin
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["read", "write", "admin"]
 *                 expires:
 *                   type: string
 *                   example: "1d"
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: INVALID_CREDENTIALS
 *                 message:
 *                   type: string
 *                   example: Invalid email or password
 */
const loginHandler: RequestHandler = async (
  req: APIVersionRequest, 
  res: Response<LoginResponse>
): Promise<void> => {
  try {
    const { email, password, rememberMe = false }: LoginRequest = req.body;

    // Basic demo user authentication
    if (email === 'admin@alexandria.local' && password === 'admin123') {
      const tokenData = {
        token: 'demo-jwt-token',
        user: {
          id: '1',
          email: email,
          name: 'Administrator',
          role: 'admin',
          permissions: ['read', 'write', 'admin']
        },
        expiresIn: rememberMe ? '30d' : '1d'
      };

      // Transform response based on API version
      const response: LoginResponse = createVersionedResponse(req.apiVersion, tokenData, {
        v1: (data) => ({
          success: true,
          token: data.token,
          user: data.user,
          expires: data.expiresIn
        })
      });

      logger.info('User login successful (demo)', {
        userId: tokenData.user.id,
        apiVersion: req.apiVersion,
        ip: req.ip
      });

      res.json(response);
    } else {
      const errorResponse: LoginResponse = {
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      };
      
      res.status(401).json(errorResponse);
    }
  } catch (error) {
    logger.error('Login error', {
      error: error instanceof Error ? error.message : String(error),
      ip: req.ip
    });
    
    const errorResponse: LoginResponse = {
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'An internal error occurred'
    };
    
    res.status(500).json(errorResponse);
  }
};

router.post('/login', validateRequest(validationSchemas.login), loginHandler);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: User logout
 *     description: Logout the current user and invalidate the JWT token
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Logged out successfully
 */
const logoutHandler: RequestHandler = (
  req: APIVersionRequest, 
  res: Response<LogoutResponse>
): void => {
  // In a real implementation, this would invalidate the token
  logger.info('User logout', { 
    apiVersion: req.apiVersion,
    ip: req.ip
  });

  const response: LogoutResponse = {
    success: true,
    message: 'Logged out successfully'
  };

  res.json(response);
};

router.post('/logout', logoutHandler);

/**
 * @swagger
 * /api/v1/auth/validate:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Validate JWT token
 *     description: Check if the provided JWT token is valid and return user information
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Token is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "1"
 *                     email:
 *                       type: string
 *                       example: admin@alexandria.local
 *                     name:
 *                       type: string
 *                       example: Administrator
 *                     role:
 *                       type: string
 *                       example: admin
 *       401:
 *         description: Invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: INVALID_TOKEN
 *                 message:
 *                   type: string
 *                   example: Token is invalid or expired
 */
const validateHandler: RequestHandler = (
  req: APIVersionRequest, 
  res: Response<ValidateResponse>
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const errorResponse: ValidateResponse = {
      valid: false,
      error: 'NO_TOKEN',
      message: 'No valid token provided'
    };
    
    res.status(401).json(errorResponse);
    return;
  }

  const token = authHeader.substring(7);

  // Basic token validation (in real implementation, verify JWT)
  if (token === 'demo-jwt-token') {
    const successResponse: ValidateResponse = {
      valid: true,
      user: {
        id: '1',
        email: 'admin@alexandria.local',
        name: 'Administrator',
        role: 'admin'
      }
    };
    
    res.json(successResponse);
  } else {
    const errorResponse: ValidateResponse = {
      valid: false,
      error: 'INVALID_TOKEN',
      message: 'Token is invalid or expired'
    };
    
    res.status(401).json(errorResponse);
  }
};

router.get('/validate', validateHandler);

export default router;
