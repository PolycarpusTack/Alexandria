/**
 * Encryption Service implementation for the Alexandria Platform
 * 
 * This implementation provides data encryption, hashing, and secure token generation.
 */

import { 
  EncryptionService, 
  EncryptionOptions, 
  EncryptedData 
} from './interfaces';
import { Logger } from '../../utils/logger';
import * as crypto from 'crypto';
import { CipherGCM, DecipherGCM } from 'crypto';

/**
 * Crypto-based Encryption Service implementation
 */
export class CryptoEncryptionService implements EncryptionService {
  private logger: Logger;
  private encryptionKey: Buffer;
  private defaultAlgorithm: string = 'aes-256-gcm';
  private isInitialized: boolean = false;

  constructor(
    logger: Logger,
    options?: {
      key?: string;
      algorithm?: string;
    }
  ) {
    this.logger = logger;
    
    // In production environment, require a proper encryption key
    if (process.env.NODE_ENV === 'production' && !options?.key && !process.env.ENCRYPTION_KEY) {
      const errorMsg = 'No encryption key provided in production environment';
      this.logger.error(errorMsg, {
        component: 'CryptoEncryptionService'
      });
      
      throw new Error(errorMsg + '. A secure encryption key must be provided in production.');
    }
    
    // Use provided key or generate one from environment variable
    const keyString = options?.key || process.env.ENCRYPTION_KEY || (() => {
      if (process.env.NODE_ENV === 'development') {
        this.logger.warn('ENCRYPTION_KEY not set, using development default');
        return 'alexandria-dev-encryption-key-DO-NOT-USE-IN-PRODUCTION';
      }
      throw new Error('ENCRYPTION_KEY environment variable is required in production');
    })();
    
    // Derive a 32-byte key from the key string using SHA-256
    this.encryptionKey = crypto.createHash('sha256').update(keyString).digest();
    
    // Set default algorithm
    this.defaultAlgorithm = options?.algorithm || this.defaultAlgorithm;
    
    // Warn if using default key in non-production environment
    if (keyString === 'alexandria-dev-encryption-key') {
      const message = process.env.NODE_ENV === 'production'
        ? 'CRITICAL SECURITY ISSUE: Using default encryption key in production environment'
        : 'Using default encryption key in development environment';
        
      this.logger.warn(message, {
        component: 'CryptoEncryptionService',
        severity: process.env.NODE_ENV === 'production' ? 'CRITICAL' : 'WARNING',
      });
    }
  }

  /**
   * Initialize encryption service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Encryption service is already initialized');
    }
    
    this.logger.info('Initializing encryption service', {
      component: 'CryptoEncryptionService',
      algorithm: this.defaultAlgorithm
    });
    
    this.isInitialized = true;
    
    this.logger.info('Encryption service initialized successfully', {
      component: 'CryptoEncryptionService'
    });
  }

  /**
   * Encrypt data
   */
  async encrypt(data: string | object, options?: EncryptionOptions): Promise<EncryptedData> {
    const algorithm = options?.algorithm || this.defaultAlgorithm;
    
    // Convert object to string if needed
    const dataString = typeof data === 'object' ? JSON.stringify(data) : data;
    
    // Generate random initialization vector
    const iv = crypto.randomBytes(16);
    
    // Create cipher
    const cipher = crypto.createCipheriv(algorithm, this.encryptionKey, iv);
    
    // Encrypt data
    let encrypted = cipher.update(dataString, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Get auth tag for GCM mode
    const authTag = algorithm.includes('gcm') ? (cipher as CipherGCM).getAuthTag().toString('base64') : undefined;
    
    return {
      data: encrypted,
      iv: iv.toString('base64'),
      authTag
    };
  }

  /**
   * Decrypt data
   */
  async decrypt(encryptedData: EncryptedData): Promise<string> {
    try {
      const { data, iv, authTag } = encryptedData;
      
      // Determine algorithm based on presence of authTag
      const algorithm = authTag ? this.defaultAlgorithm : 'aes-256-cbc';
      
      // Create decipher
      const decipher = crypto.createDecipheriv(
        algorithm,
        this.encryptionKey,
        Buffer.from(iv, 'base64')
      );
      
      // Set auth tag for GCM mode
      if (authTag && algorithm.includes('gcm')) {
        (decipher as DecipherGCM).setAuthTag(Buffer.from(authTag, 'base64'));
      }
      
      // Decrypt data
      let decrypted = decipher.update(data, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      this.logger.error('Decryption failed', {
        component: 'CryptoEncryptionService',
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Generate a secure random string
   */
  generateSecureToken(length: number): string {
    // Use crypto.randomBytes to generate secure random bytes
    const byteLength = Math.ceil(length * 6 / 8); // For base64 encoding
    const randomBytes = crypto.randomBytes(byteLength);
    
    // Convert to base64 and remove non-alphanumeric characters
    const token = randomBytes.toString('base64')
      .replace(/[+/=]/g, '')  // Remove non-URL safe characters
      .slice(0, length);       // Trim to desired length
    
    return token;
  }

  // OWASP recommended parameters for PBKDF2
  private static readonly RECOMMENDED_ITERATIONS = 310000; // Minimum recommended for PBKDF2 with SHA-512
  private static readonly KEY_LENGTH = 64; // 512 bits
  private static readonly DIGEST = 'sha512';
  private static readonly SALT_LENGTH = 32; // 256 bits
  
  /**
   * Hash data (one-way) using PBKDF2 with OWASP-recommended parameters
   */
  async hash(data: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Generate a cryptographically strong random salt
      const salt = crypto.randomBytes(CryptoEncryptionService.SALT_LENGTH);
      
      // Use PBKDF2 for secure password hashing with strong parameters
      crypto.pbkdf2(
        data,
        salt,                                          // Unique salt for each hash
        CryptoEncryptionService.RECOMMENDED_ITERATIONS, // Increased iteration count
        CryptoEncryptionService.KEY_LENGTH,            // Key length
        CryptoEncryptionService.DIGEST,                // Digest algorithm
        (err, derivedKey) => {
          if (err) {
            reject(err);
            return;
          }
          
          // Format: iterations.salt.hash
          // Store all parameters to allow algorithm adjustment in the future
          const hashString = `${CryptoEncryptionService.RECOMMENDED_ITERATIONS}.${salt.toString('hex')}.${derivedKey.toString('hex')}`;
          
          resolve(hashString);
        }
      );
    });
  }

  /**
   * Verify a hash using parameters stored with the hash
   */
  async verifyHash(data: string, hashString: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      // Parse hash string format: iterations.salt.hash
      const parts = hashString.split('.');
      
      if (parts.length !== 3) {
        this.logger.warn('Invalid hash format during verification', {
          component: 'CryptoEncryptionService'
        });
        resolve(false);
        return;
      }
      
      try {
        // Extract parameters from the stored hash string
        const iterations = parseInt(parts[0], 10);
        const salt = Buffer.from(parts[1], 'hex');
        const storedHash = parts[2];
        
        if (isNaN(iterations) || iterations <= 0) {
          this.logger.warn('Invalid iteration count in hash', {
            component: 'CryptoEncryptionService',
            iterations
          });
          resolve(false);
          return;
        }
        
        // Verify hash using the parameters stored with the hash
        crypto.pbkdf2(
          data,
          salt,
          iterations,
          Buffer.from(storedHash, 'hex').length,
          CryptoEncryptionService.DIGEST,
          (err, derivedKey) => {
            if (err) {
              reject(err);
              return;
            }
            
            const newHash = derivedKey.toString('hex');
            const result = crypto.timingSafeEqual(
              Buffer.from(newHash, 'hex'),
              Buffer.from(storedHash, 'hex')
            );
            
            resolve(result);
          }
        );
      } catch (error) {
        this.logger.error('Error during hash verification', {
          component: 'CryptoEncryptionService',
          error: error instanceof Error ? error.message : String(error)
        });
        resolve(false);
      }
    });
  }
}