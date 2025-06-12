/**
 * Health Check API v1
 * Provides system health and status information
 */

import { Router, Response } from 'express';
import { APIVersionRequest } from '../versioning';

const router = Router();

/**
 * @swagger
 * /api/v1/health:
 *   get:
 *     tags:
 *       - Health
 *     summary: Basic health check
 *     description: Get basic system health status
 *     security: []
 *     responses:
 *       200:
 *         description: System is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 apiVersion:
 *                   type: string
 *                   example: v1
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: System uptime in seconds
 *                   example: 86400
 *                 environment:
 *                   type: string
 *                   example: development
 */
router.get('/', (req: APIVersionRequest, res: Response) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    apiVersion: req.apiVersion,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * @swagger
 * /api/v1/health/detailed:
 *   get:
 *     tags:
 *       - Health
 *     summary: Detailed health check
 *     description: Get comprehensive system health information including memory, CPU, and service status
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Detailed system health information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 apiVersion:
 *                   type: string
 *                   example: v1
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   example: 86400
 *                 environment:
 *                   type: string
 *                   example: development
 *                 system:
 *                   type: object
 *                   properties:
 *                     nodejs:
 *                       type: string
 *                       example: v18.17.0
 *                     platform:
 *                       type: string
 *                       example: linux
 *                     arch:
 *                       type: string
 *                       example: x64
 *                     memory:
 *                       type: object
 *                       properties:
 *                         used:
 *                           type: number
 *                           description: Used memory in MB
 *                         total:
 *                           type: number
 *                           description: Total memory in MB
 *                         external:
 *                           type: number
 *                           description: External memory in MB
 *                     cpu:
 *                       type: object
 *                       description: CPU usage statistics
 *                 services:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: string
 *                       example: connected
 *                     eventBus:
 *                       type: string
 *                       example: active
 *                     plugins:
 *                       type: string
 *                       example: loaded
 */
router.get('/detailed', (req: APIVersionRequest, res: Response) => {
  const healthData = {
    status: 'ok',
    version: '1.0.0',
    apiVersion: req.apiVersion,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    system: {
      nodejs: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024)
      },
      cpu: process.cpuUsage()
    },
    services: {
      database: 'connected', // This would be dynamic in real implementation
      eventBus: 'active',
      plugins: 'loaded'
    }
  };

  res.json(healthData);
});

export default router;
