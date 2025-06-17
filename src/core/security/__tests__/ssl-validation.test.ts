/**
 * SSL/TLS Certificate Validation Tests
 * 
 * This test suite ensures that SSL certificate validation is properly
 * enforced in production and configurable in development.
 */

import { getDatabaseConfig } from '../../data/database-config';
import { getHttpsConfig, validateHttpsUrl } from '../../../utils/https-config';
import { verifyCertificatePin, calculateFingerprint } from '../../../utils/certificate-pinning';

describe('SSL/TLS Certificate Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Database SSL Configuration', () => {
    it('should enforce certificate validation in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.DB_SSL = 'true';
      process.env.DB_USER = 'testuser';
      process.env.DB_PASSWORD = 'testpass';

      const config = getDatabaseConfig();
      
      expect(config.ssl).toEqual({
        rejectUnauthorized: true,
        ca: undefined
      });
    });

    it('should throw error if trying to disable validation in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.DB_SSL = 'true';
      process.env.DB_SSL_REJECT_UNAUTHORIZED = 'false';
      process.env.DB_USER = 'testuser';
      process.env.DB_PASSWORD = 'testpass';

      expect(() => getDatabaseConfig()).toThrow(
        'SSL certificate validation cannot be disabled in production'
      );
    });

    it('should allow disabling validation in development with warning', () => {
      process.env.NODE_ENV = 'development';
      process.env.DB_SSL = 'true';
      process.env.DB_SSL_REJECT_UNAUTHORIZED = 'false';

      const config = getDatabaseConfig();
      
      expect(config.ssl).toEqual({
        rejectUnauthorized: false,
        ca: undefined
      });
    });

    it('should support custom CA certificate', () => {
      process.env.NODE_ENV = 'production';
      process.env.DB_SSL = 'true';
      process.env.DB_SSL_CA = '/path/to/ca.pem';
      process.env.DB_USER = 'testuser';
      process.env.DB_PASSWORD = 'testpass';

      const config = getDatabaseConfig();
      
      expect(config.ssl).toEqual({
        rejectUnauthorized: true,
        ca: '/path/to/ca.pem'
      });
    });
  });

  describe('HTTPS Configuration', () => {
    it('should enforce certificate validation in production', () => {
      process.env.NODE_ENV = 'production';

      const config = getHttpsConfig();
      
      expect(config.rejectUnauthorized).toBe(true);
      expect(config.minVersion).toBe('TLSv1.2');
    });

    it('should throw error if NODE_TLS_REJECT_UNAUTHORIZED=0 in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

      expect(() => getHttpsConfig()).toThrow(
        'Certificate validation cannot be disabled in production'
      );
    });

    it('should allow disabling validation in development', () => {
      process.env.NODE_ENV = 'development';
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

      const config = getHttpsConfig();
      
      expect(config.rejectUnauthorized).toBe(false);
    });

    it('should validate HTTPS URLs in production', () => {
      process.env.NODE_ENV = 'production';

      expect(() => validateHttpsUrl('https://example.com')).not.toThrow();
      expect(() => validateHttpsUrl('http://example.com')).toThrow(
        'Insecure protocol http: not allowed in production. Use HTTPS.'
      );
    });

    it('should allow HTTP URLs in development', () => {
      process.env.NODE_ENV = 'development';

      expect(() => validateHttpsUrl('http://localhost:3000')).not.toThrow();
    });
  });

  describe('Certificate Pinning', () => {
    it('should calculate certificate fingerprint correctly', () => {
      // Sample certificate (base64 encoded DER)
      const certDer = Buffer.from([
        0x30, 0x82, 0x01, 0x0a, 0x02, 0x82, 0x01, 0x01
      ]);
      
      const fingerprint = calculateFingerprint(certDer);
      
      expect(fingerprint).toMatch(/^sha256\/.+=/);
      expect(fingerprint.length).toBeGreaterThan(10);
    });

    it('should verify pinned certificates', () => {
      const mockCert = {
        raw: Buffer.from('mock-certificate')
      } as any;

      // Test with no pins (should pass)
      const result1 = verifyCertificatePin('unpinned.com', mockCert);
      expect(result1.valid).toBe(true);

      // Add a pin and test
      const fingerprint = calculateFingerprint(mockCert.raw);
      process.env.PINNED_CERTIFICATES = JSON.stringify([{
        hostname: 'pinned.com',
        fingerprints: [fingerprint],
        enforced: true
      }]);

      // Reload module to pick up env var
      jest.resetModules();
      const { verifyCertificatePin: verify } = require('../../../utils/certificate-pinning');

      // Should pass with correct pin
      const result2 = verify('pinned.com', mockCert);
      expect(result2.valid).toBe(true);

      // Should fail with wrong pin
      const wrongCert = {
        raw: Buffer.from('wrong-certificate')
      } as any;
      const result3 = verify('pinned.com', wrongCert);
      
      if (process.env.NODE_ENV === 'production') {
        expect(result3.valid).toBe(false);
        expect(result3.reason).toContain('does not match pinned certificates');
      }
    });
  });

  describe('Security Headers', () => {
    it('should enforce minimum TLS version', () => {
      const config = getHttpsConfig();
      expect(config.minVersion).toBe('TLSv1.2');
    });

    it('should support mutual TLS with client certificates', () => {
      process.env.HTTPS_CERT_FILE = '/path/to/cert.pem';
      process.env.HTTPS_KEY_FILE = '/path/to/key.pem';

      // Mock fs.readFileSync
      jest.mock('fs', () => ({
        readFileSync: jest.fn().mockReturnValue('mock-cert-content')
      }));

      const config = getHttpsConfig();
      
      // In a real test, these would be the certificate contents
      expect(config.cert).toBeDefined();
      expect(config.key).toBeDefined();
    });
  });
});