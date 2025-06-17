import { EventEmitter } from 'events';
import { ApiError } from '../utils/errors';
import jwt from 'jsonwebtoken';

export interface AlexandriaUser {
  id: string;
  username: string;
  email?: string;
  role?: string;
  permissions?: string[];
  metadata?: Record<string, any>;
}

export interface AuthToken {
  token: string;
  expiresAt: Date;
  refreshToken?: string;
}

export class AuthService extends EventEmitter {
  private jwtSecret: string;
  private jwtExpiry: string;
  private alexandriaAuthEndpoint?: string;
  private userCache: Map<string, { user: AlexandriaUser; expiresAt: Date }>;

  constructor() {
    super();
    this.jwtSecret = process.env.JWT_SECRET || 'mnemosyne-dev-secret';
    this.jwtExpiry = process.env.JWT_EXPIRY || '24h';
    this.alexandriaAuthEndpoint = process.env.ALEXANDRIA_AUTH_ENDPOINT;
    this.userCache = new Map();
    
    // Clear expired cache entries periodically
    setInterval(() => this.clearExpiredCache(), 60000); // Every minute
  }

  /**
   * Validate token and return user information
   */
  async validateToken(token: string): Promise<AlexandriaUser | null> {
    try {
      // Check cache first
      const cached = this.getCachedUser(token);
      if (cached) {
        return cached;
      }

      // If Alexandria auth endpoint is configured, validate with Alexandria
      if (this.alexandriaAuthEndpoint) {
        return await this.validateWithAlexandria(token);
      }

      // Otherwise, validate JWT locally
      return await this.validateJWT(token);
    } catch (error) {
      console.error('Token validation error:', error);
      return null;
    }
  }

  /**
   * Validate token with Alexandria's auth service
   */
  private async validateWithAlexandria(token: string): Promise<AlexandriaUser | null> {
    try {
      const response = await fetch(`${this.alexandriaAuthEndpoint}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const user: AlexandriaUser = {
        id: data.id,
        username: data.username,
        email: data.email,
        role: data.role,
        permissions: data.permissions || [],
        metadata: data.metadata || {}
      };

      // Cache the user
      this.cacheUser(token, user);

      return user;
    } catch (error) {
      console.error('Alexandria auth validation failed:', error);
      return null;
    }
  }

  /**
   * Validate JWT token locally
   */
  private async validateJWT(token: string): Promise<AlexandriaUser | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      const user: AlexandriaUser = {
        id: decoded.sub || decoded.id,
        username: decoded.username || decoded.name,
        email: decoded.email,
        role: decoded.role || 'user',
        permissions: decoded.permissions || ['read', 'write'],
        metadata: decoded.metadata || {}
      };

      // Cache the user
      this.cacheUser(token, user);

      return user;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        console.log('Token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        console.log('Invalid token');
      }
      return null;
    }
  }

  /**
   * Create a JWT token for a user (for development/testing)
   */
  async createToken(user: AlexandriaUser): Promise<AuthToken> {
    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      metadata: user.metadata
    };

    const token = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiry
    });

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours from now

    return {
      token,
      expiresAt
    };
  }

  /**
   * Check if user has required permission
   */
  hasPermission(user: AlexandriaUser, permission: string): boolean {
    if (!user.permissions) return false;
    
    // Admin has all permissions
    if (user.role === 'admin') return true;
    
    return user.permissions.includes(permission);
  }

  /**
   * Check if user has any of the required permissions
   */
  hasAnyPermission(user: AlexandriaUser, permissions: string[]): boolean {
    return permissions.some(permission => this.hasPermission(user, permission));
  }

  /**
   * Check if user has all required permissions
   */
  hasAllPermissions(user: AlexandriaUser, permissions: string[]): boolean {
    return permissions.every(permission => this.hasPermission(user, permission));
  }

  /**
   * Get user permissions for Mnemosyne
   */
  getMnemosynePermissions(user: AlexandriaUser): {
    canRead: boolean;
    canWrite: boolean;
    canDelete: boolean;
    canShare: boolean;
    canAdmin: boolean;
  } {
    return {
      canRead: this.hasPermission(user, 'mnemosyne:read'),
      canWrite: this.hasPermission(user, 'mnemosyne:write'),
      canDelete: this.hasPermission(user, 'mnemosyne:delete'),
      canShare: this.hasPermission(user, 'mnemosyne:share'),
      canAdmin: this.hasPermission(user, 'mnemosyne:admin') || user.role === 'admin'
    };
  }

  /**
   * Cache user information
   */
  private cacheUser(token: string, user: AlexandriaUser): void {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5); // Cache for 5 minutes
    
    this.userCache.set(token, { user, expiresAt });
  }

  /**
   * Get cached user information
   */
  private getCachedUser(token: string): AlexandriaUser | null {
    const cached = this.userCache.get(token);
    
    if (!cached) return null;
    
    if (cached.expiresAt < new Date()) {
      this.userCache.delete(token);
      return null;
    }
    
    return cached.user;
  }

  /**
   * Clear expired cache entries
   */
  private clearExpiredCache(): void {
    const now = new Date();
    
    for (const [token, cached] of this.userCache.entries()) {
      if (cached.expiresAt < now) {
        this.userCache.delete(token);
      }
    }
  }

  /**
   * Emit authentication events
   */
  emitAuthEvent(event: string, data: any): void {
    this.emit(event, data);
  }
}