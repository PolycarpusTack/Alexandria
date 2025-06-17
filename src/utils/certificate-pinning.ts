/**
 * Certificate Pinning for enhanced security
 * 
 * This module implements certificate pinning to prevent MITM attacks
 * on critical endpoints like authentication and payment processing.
 */

import * as crypto from 'crypto';
import * as tls from 'tls';
import { Logger } from './logger';

const logger = createLogger({ serviceName: 'certificate-pinning' });

// Store pinned certificates (SHA256 fingerprints)
interface PinnedCertificate {
  hostname: string;
  fingerprints: string[];
  enforced: boolean;
}

// Default pinned certificates for critical services
const pinnedCertificates: PinnedCertificate[] = [
  // Add your critical service certificates here
  // Example:
  // {
  //   hostname: 'api.alexandria.com',
  //   fingerprints: [
  //     'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  //     'sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=' // Backup pin
  //   ],
  //   enforced: true
  // }
];

// Load additional pins from environment
if (process.env.PINNED_CERTIFICATES) {
  try {
    const envPins = JSON.parse(process.env.PINNED_CERTIFICATES);
    pinnedCertificates.push(...envPins);
  } catch (error) {
    logger.error('Failed to parse PINNED_CERTIFICATES environment variable', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Calculate SHA256 fingerprint of a certificate
 */
export function calculateFingerprint(cert: string | Buffer): string {
  const der = typeof cert === 'string' 
    ? Buffer.from(cert.replace(/-----BEGIN CERTIFICATE-----/g, '')
                      .replace(/-----END CERTIFICATE-----/g, '')
                      .replace(/\s/g, ''), 'base64')
    : cert;
  
  const hash = crypto.createHash('sha256').update(der).digest('base64');
  return `sha256/${hash}`;
}

/**
 * Verify certificate against pinned certificates
 */
export function verifyCertificatePin(
  hostname: string, 
  cert: tls.PeerCertificate
): { valid: boolean; reason?: string } {
  // Find pinned certificates for this hostname
  const pins = pinnedCertificates.find(p => p.hostname === hostname);
  
  if (!pins) {
    // No pins for this hostname, allow connection
    return { valid: true };
  }

  // Calculate fingerprint of presented certificate
  const presentedFingerprint = calculateFingerprint(cert.raw);
  
  // Check if fingerprint matches any pinned certificate
  const isValid = pins.fingerprints.includes(presentedFingerprint);
  
  if (!isValid) {
    logger.error('Certificate pin verification failed', {
      hostname,
      presentedFingerprint,
      expectedFingerprints: pins.fingerprints
    });
    
    if (pins.enforced && process.env.NODE_ENV === 'production') {
      return {
        valid: false,
        reason: `Certificate fingerprint ${presentedFingerprint} does not match pinned certificates`
      };
    } else {
      logger.warn('Certificate pin mismatch detected but not enforced', {
        hostname,
        environment: process.env.NODE_ENV
      });
    }
  } else {
    logger.debug('Certificate pin verification successful', {
      hostname,
      fingerprint: presentedFingerprint
    });
  }
  
  return { valid: true };
}

/**
 * Create TLS socket options with certificate pinning
 */
export function createPinnedTlsOptions(hostname: string): tls.ConnectionOptions {
  return {
    rejectUnauthorized: true,
    servername: hostname,
    checkServerIdentity: (host: string, cert: tls.PeerCertificate) => {
      // First, do standard hostname verification
      const error = tls.checkServerIdentity(host, cert);
      if (error) {
        return error;
      }
      
      // Then verify certificate pin
      const pinResult = verifyCertificatePin(hostname, cert);
      if (!pinResult.valid) {
        return new Error(pinResult.reason || 'Certificate pin verification failed');
      }
      
      return undefined;
    }
  };
}

/**
 * Middleware for Express to verify certificate pins on incoming requests
 */
export function certificatePinningMiddleware(req: any, res: any, next: any): void {
  // This is for client certificate pinning (mutual TLS)
  const cert = req.socket.getPeerCertificate();
  
  if (cert && Object.keys(cert).length > 0) {
    const hostname = req.hostname;
    const pinResult = verifyCertificatePin(hostname, cert);
    
    if (!pinResult.valid) {
      logger.error('Client certificate pin verification failed', {
        hostname,
        reason: pinResult.reason
      });
      
      res.status(403).json({
        error: 'CERTIFICATE_PIN_FAILED',
        message: 'Certificate verification failed'
      });
      return;
    }
  }
  
  next();
}

/**
 * Add certificate pins at runtime
 */
export function addCertificatePin(
  hostname: string, 
  fingerprints: string[], 
  enforced: boolean = true
): void {
  const existing = pinnedCertificates.findIndex(p => p.hostname === hostname);
  
  if (existing >= 0) {
    // Update existing pins
    pinnedCertificates[existing].fingerprints = fingerprints;
    pinnedCertificates[existing].enforced = enforced;
  } else {
    // Add new pins
    pinnedCertificates.push({ hostname, fingerprints, enforced });
  }
  
  logger.info('Certificate pins updated', {
    hostname,
    fingerprints: fingerprints.length,
    enforced
  });
}

/**
 * Get current certificate pins for a hostname
 */
export function getCertificatePins(hostname: string): PinnedCertificate | undefined {
  return pinnedCertificates.find(p => p.hostname === hostname);
}

// Re-export logger for convenience
export { createLogger } from './logger';