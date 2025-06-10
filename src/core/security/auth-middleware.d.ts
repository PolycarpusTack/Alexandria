/**
 * Authentication Middleware for the Alexandria Platform
 *
 * This middleware handles extracting and validating JWT tokens from requests,
 * retrieving user information, and attaching the user object to the request.
 */
import { Request, Response, NextFunction } from 'express';
import { AuthenticationService } from './interfaces';
import { Logger } from '../../utils/logger';
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                username: string;
                email?: string;
                roles: string[];
                permissions: string[];
            };
        }
    }
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
export declare function createAuthMiddleware(authService: AuthenticationService, logger: Logger, options?: AuthMiddlewareOptions): (req: Request, res: Response, next: NextFunction) => Promise<any>;
export { createAuthMiddleware as authMiddleware };
