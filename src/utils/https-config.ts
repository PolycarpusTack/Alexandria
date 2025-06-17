/**
 * HTTPS Configuration for secure connections
 * 
 * This module provides centralized HTTPS configuration to ensure
 * proper SSL/TLS certificate validation across the application.
 */

import * as https from 'https';
import * as fs from 'fs';
import { Logger } from './logger';

const logger = createLogger({ serviceName: 'https-config' });

export interface HttpsConfig {
  rejectUnauthorized: boolean;
  ca?: string | Buffer;
  cert?: string | Buffer;
  key?: string | Buffer;
  minVersion?: 'TLSv1.2' | 'TLSv1.3';
}

/**
 * Get HTTPS agent configuration based on environment
 */
export function getHttpsConfig(): HttpsConfig {
  const config: HttpsConfig = {
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2' // Enforce minimum TLS version
  };

  // In production, always validate certificates
  if (process.env.NODE_ENV === 'production') {
    // Check if someone is trying to disable certificate validation
    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
      logger.error('SECURITY ERROR: Attempted to disable certificate validation in production!');
      throw new Error('Certificate validation cannot be disabled in production');
    }

    // Allow custom CA certificate for internal services
    if (process.env.HTTPS_CA_FILE) {
      try {
        config.ca = fs.readFileSync(process.env.HTTPS_CA_FILE);
        logger.info('Loaded custom CA certificate', { file: process.env.HTTPS_CA_FILE });
      } catch (error) {
        logger.error('Failed to load CA certificate', { 
          file: process.env.HTTPS_CA_FILE,
          error: error instanceof Error ? error.message : String(error)
        });
        throw new Error('Failed to load CA certificate');
      }
    }

    // Client certificates for mutual TLS
    if (process.env.HTTPS_CERT_FILE && process.env.HTTPS_KEY_FILE) {
      try {
        config.cert = fs.readFileSync(process.env.HTTPS_CERT_FILE);
        config.key = fs.readFileSync(process.env.HTTPS_KEY_FILE);
        logger.info('Loaded client certificates for mutual TLS');
      } catch (error) {
        logger.error('Failed to load client certificates', {
          error: error instanceof Error ? error.message : String(error)
        });
        throw new Error('Failed to load client certificates');
      }
    }
  } else {
    // Development environment
    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
      logger.warn('WARNING: Certificate validation is disabled - only use in development!');
      config.rejectUnauthorized = false;
    }

    // Still allow custom CA in development
    if (process.env.HTTPS_CA_FILE) {
      try {
        config.ca = fs.readFileSync(process.env.HTTPS_CA_FILE);
        logger.info('Loaded custom CA certificate for development');
      } catch (error) {
        logger.warn('Failed to load CA certificate in development', {
          file: process.env.HTTPS_CA_FILE,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  return config;
}

/**
 * Create an HTTPS agent with proper security configuration
 */
export function createHttpsAgent(): https.Agent {
  const config = getHttpsConfig();
  
  return new https.Agent({
    rejectUnauthorized: config.rejectUnauthorized,
    ca: config.ca,
    cert: config.cert,
    key: config.key,
    minVersion: config.minVersion,
    // Additional security settings
    maxCachedSessions: 100,
    sessionTimeout: 300 // 5 minutes
  });
}

/**
 * Configure axios defaults for HTTPS
 */
export function configureAxiosHttps(axios: any): void {
  const httpsAgent = createHttpsAgent();
  
  // Set default HTTPS agent
  axios.defaults.httpsAgent = httpsAgent;
  
  // Log configuration
  logger.info('Configured axios with secure HTTPS settings', {
    environment: process.env.NODE_ENV,
    rejectUnauthorized: getHttpsConfig().rejectUnauthorized
  });
}

/**
 * Validate URL is using HTTPS in production
 */
export function validateHttpsUrl(url: string): void {
  if (process.env.NODE_ENV === 'production') {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'https:') {
      throw new Error(`Insecure protocol ${parsedUrl.protocol} not allowed in production. Use HTTPS.`);
    }
  }
}

// Re-export logger for convenience
export { createLogger } from './logger';