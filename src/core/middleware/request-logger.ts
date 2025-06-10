import { Request, Response, NextFunction } from 'express';
import { Logger } from '../../utils/logger';

/**
 * Request logging middleware
 * Logs all incoming API requests with timing information for metrics collection
 */
export function createRequestLogger(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip logging for static assets and health checks
    if (
      req.path.includes('/static') || 
      req.path.includes('/assets') ||
      req.path === '/health' ||
      req.path === '/favicon'
    ) {
      return next();
    }

    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(7);

    // Log the incoming request
    logger.info('API request received', {
      source: 'api',
      context: {
        type: 'request',
        requestId,
        method: req.method,
        path: req.path,
        query: req.query,
        ip: req.ip,
        userAgent: req.get('user-agent')
      }
    });

    // Capture the original end method
    const originalEnd = res.end;
    
    // Override the end method to log response details
    res.end = function(...args: any[]) {
      const responseTime = Date.now() - startTime;
      
      // Log the response
      logger.info('API request completed', {
        source: 'api',
        context: {
          type: 'request',
          requestId,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          responseTime,
          contentLength: res.get('content-length')
        }
      });

      // Log errors separately for better tracking
      if (res.statusCode >= 400) {
        logger.error('API request error', {
          source: 'api',
          context: {
            type: 'request',
            requestId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            responseTime,
            error: res.statusCode >= 500 ? 'Server Error' : 'Client Error'
          }
        });
      }
      
      // Call the original end method
      originalEnd.apply(res, args);
    };

    next();
  };
}