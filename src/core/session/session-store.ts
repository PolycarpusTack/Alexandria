/**
 * Session Store for Alexandria Platform
 * 
 * Provides secure session management with support for multiple storage backends.
 */

import { randomBytes } from 'crypto';
import { createLogger } from '../../utils/logger';
import { DataService } from '../data/interfaces';
import { CacheService } from '../cache/cache-service';

export interface SessionData {
  id: string;
  userId: string;
  username: string;
  roles: string[];
  permissions: string[];
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export interface SessionStoreOptions {
  ttl?: number; // Time to live in milliseconds
  slidingExpiration?: boolean; // Extend expiry on activity
  maxSessions?: number; // Max sessions per user
  secureCookie?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  domain?: string;
  path?: string;
}

export abstract class SessionStore {
  // Abstract methods that implementations must provide
  protected abstract saveSession(session: SessionData): Promise<void>;
  protected abstract loadSession(sessionId: string): Promise<SessionData | null>;
  protected abstract updateSession(sessionId: string, updates: Partial<SessionData>): Promise<void>;
  protected abstract deleteSession(sessionId: string): Promise<void>;
  protected abstract loadUserSessions(userId: string): Promise<SessionData[]>;
  protected abstract cleanupExpiredSessions(): Promise<number>;
  protected abstract deleteUserSessions(userId: string): Promise<number>;
  protected logger = createLogger({ serviceName: 'SessionStore' });
  protected options: Required<SessionStoreOptions>;

  constructor(options: SessionStoreOptions = {}) {
    this.options = {
      ttl: options.ttl || 24 * 60 * 60 * 1000, // 24 hours
      slidingExpiration: options.slidingExpiration ?? true,
      maxSessions: options.maxSessions || 5,
      secureCookie: options.secureCookie ?? true,
      sameSite: options.sameSite || 'lax',
      domain: options.domain || '',
      path: options.path || '/'
    };
  }

  /**
   * Generate a secure session ID
   */
  protected generateSessionId(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Create a new session
   */
  abstract create(data: Omit<SessionData, 'id' | 'createdAt' | 'lastActivity' | 'expiresAt'>): Promise<SessionData>;

  /**
   * Get a session by ID
   */
  abstract get(sessionId: string): Promise<SessionData | null>;

  /**
   * Update session activity
   */
  abstract touch(sessionId: string): Promise<void>;

  /**
   * Delete a session
   */
  abstract destroy(sessionId: string): Promise<void>;

  /**
   * Delete all sessions for a user
   */
  abstract destroyAll(userId: string): Promise<number>;

  /**
   * Get all active sessions for a user
   */
  abstract getUserSessions(userId: string): Promise<SessionData[]>;

  /**
   * Clean up expired sessions
   */
  abstract cleanup(): Promise<number>;

  /**
   * Get cookie options
   */
  getCookieOptions(): {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
    maxAge: number;
    domain?: string;
    path: string;
  } {
    return {
      httpOnly: true,
      secure: this.options.secureCookie,
      sameSite: this.options.sameSite,
      maxAge: this.options.ttl,
      domain: this.options.domain || undefined,
      path: this.options.path
    };
  }
}

/**
 * In-memory session store (for development/testing)
 */
export class MemorySessionStore extends SessionStore {
  private sessions = new Map<string, SessionData>();
  private userSessions = new Map<string, Set<string>>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(options?: SessionStoreOptions) {
    super(options);
    
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch(err => 
        this.logger.error('Session cleanup failed', { error: err })
      );
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  async create(data: Omit<SessionData, 'id' | 'createdAt' | 'lastActivity' | 'expiresAt'>): Promise<SessionData> {
    const now = new Date();
    const session: SessionData = {
      ...data,
      id: this.generateSessionId(),
      createdAt: now,
      lastActivity: now,
      expiresAt: new Date(now.getTime() + this.options.ttl)
    };

    // Check max sessions per user
    const userSessionIds = this.userSessions.get(data.userId) || new Set();
    if (userSessionIds.size >= this.options.maxSessions) {
      // Remove oldest session
      const oldestSession = Array.from(userSessionIds)
        .map(id => this.sessions.get(id))
        .filter(s => s)
        .sort((a, b) => a!.lastActivity.getTime() - b!.lastActivity.getTime())[0];
      
      if (oldestSession) {
        await this.destroy(oldestSession.id);
      }
    }

    // Store session
    this.sessions.set(session.id, session);
    
    // Update user sessions index
    if (!this.userSessions.has(data.userId)) {
      this.userSessions.set(data.userId, new Set());
    }
    this.userSessions.get(data.userId)!.add(session.id);

    this.logger.debug('Session created', { 
      sessionId: session.id, 
      userId: data.userId 
    });

    return session;
  }

  async get(sessionId: string): Promise<SessionData | null> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    // Check if expired
    if (new Date() > session.expiresAt) {
      await this.destroy(sessionId);
      return null;
    }

    return session;
  }

  async touch(sessionId: string): Promise<void> {
    const session = await this.get(sessionId);
    
    if (!session) {
      return;
    }

    const now = new Date();
    session.lastActivity = now;

    // Extend expiry if sliding expiration is enabled
    if (this.options.slidingExpiration) {
      session.expiresAt = new Date(now.getTime() + this.options.ttl);
    }

    this.sessions.set(sessionId, session);
  }

  async destroy(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return;
    }

    // Remove from sessions
    this.sessions.delete(sessionId);

    // Remove from user sessions index
    const userSessionIds = this.userSessions.get(session.userId);
    if (userSessionIds) {
      userSessionIds.delete(sessionId);
      
      if (userSessionIds.size === 0) {
        this.userSessions.delete(session.userId);
      }
    }

    this.logger.debug('Session destroyed', { sessionId });
  }

  async destroyAll(userId: string): Promise<number> {
    const userSessionIds = this.userSessions.get(userId);
    
    if (!userSessionIds) {
      return 0;
    }

    const count = userSessionIds.size;
    
    for (const sessionId of userSessionIds) {
      this.sessions.delete(sessionId);
    }

    this.userSessions.delete(userId);

    this.logger.debug('All user sessions destroyed', { userId, count });

    return count;
  }

  async getUserSessions(userId: string): Promise<SessionData[]> {
    const userSessionIds = this.userSessions.get(userId);
    
    if (!userSessionIds) {
      return [];
    }

    const sessions: SessionData[] = [];
    const now = new Date();

    for (const sessionId of userSessionIds) {
      const session = this.sessions.get(sessionId);
      
      if (session && session.expiresAt > now) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  async cleanup(): Promise<number> {
    const now = new Date();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions) {
      if (session.expiresAt <= now) {
        await this.destroy(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug('Sessions cleaned up', { count: cleaned });
    }

    return cleaned;
  }

  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.sessions.clear();
    this.userSessions.clear();
  }

  // Implementation of abstract methods
  protected async saveSession(session: SessionData): Promise<void> {
    this.sessions.set(session.id, session);
  }

  protected async loadSession(sessionId: string): Promise<SessionData | null> {
    return this.sessions.get(sessionId) || null;
  }

  protected async updateSession(sessionId: string, updates: Partial<SessionData>): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      Object.assign(session, updates);
      this.sessions.set(sessionId, session);
    }
  }

  protected async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  protected async loadUserSessions(userId: string): Promise<SessionData[]> {
    const userSessionIds = this.userSessions.get(userId);
    if (!userSessionIds) {
      return [];
    }

    const sessions: SessionData[] = [];
    for (const sessionId of userSessionIds) {
      const session = this.sessions.get(sessionId);
      if (session) {
        sessions.push(session);
      }
    }
    return sessions;
  }

  protected async cleanupExpiredSessions(): Promise<number> {
    const now = new Date();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions) {
      if (session.expiresAt <= now) {
        await this.deleteSession(sessionId);
        cleaned++;
      }
    }
    return cleaned;
  }

  protected async deleteUserSessions(userId: string): Promise<number> {
    const userSessionIds = this.userSessions.get(userId);
    if (!userSessionIds) {
      return 0;
    }

    const count = userSessionIds.size;
    for (const sessionId of userSessionIds) {
      this.sessions.delete(sessionId);
    }
    this.userSessions.delete(userId);
    
    return count;
  }
}

/**
 * Database-backed session store
 */
export class DatabaseSessionStore extends SessionStore {
  private cache: CacheService;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    private dataService: DataService,
    options?: SessionStoreOptions
  ) {
    super(options);
    
    // Use cache for performance
    this.cache = new CacheService({
      ttl: 5 * 60 * 1000, // 5 minutes
      maxSize: 1000
    });

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch(err => 
        this.logger.error('Session cleanup failed', { error: err })
      );
    }, 30 * 60 * 1000); // Every 30 minutes
  }

  async create(data: Omit<SessionData, 'id' | 'createdAt' | 'lastActivity' | 'expiresAt'>): Promise<SessionData> {
    const now = new Date();
    const session: SessionData = {
      ...data,
      id: this.generateSessionId(),
      createdAt: now,
      lastActivity: now,
      expiresAt: new Date(now.getTime() + this.options.ttl)
    };

    // Check max sessions per user
    const userSessions = await this.getUserSessions(data.userId);
    if (userSessions.length >= this.options.maxSessions) {
      // Remove oldest session
      const oldestSession = userSessions
        .sort((a, b) => a.lastActivity.getTime() - b.lastActivity.getTime())[0];
      
      if (oldestSession) {
        await this.destroy(oldestSession.id);
      }
    }

    // Store in database
    await this.saveSession(session);

    // Cache the session
    this.cache.set(session.id, session, this.options.ttl);

    this.logger.debug('Session created', { 
      sessionId: session.id, 
      userId: data.userId 
    });

    return session;
  }

  async get(sessionId: string): Promise<SessionData | null> {
    // Check cache first
    let session = this.cache.get<SessionData>(sessionId);
    
    if (!session) {
      // Load from database
      session = await this.loadSession(sessionId);
      
      if (session) {
        // Cache it
        this.cache.set(sessionId, session, 5 * 60 * 1000); // 5 minutes
      }
    }

    if (!session) {
      return null;
    }

    // Check if expired
    if (new Date() > new Date(session.expiresAt)) {
      await this.destroy(sessionId);
      return null;
    }

    return session;
  }

  async touch(sessionId: string): Promise<void> {
    const session = await this.get(sessionId);
    
    if (!session) {
      return;
    }

    const now = new Date();
    const updates: Partial<SessionData> = {
      lastActivity: now
    };

    // Extend expiry if sliding expiration is enabled
    if (this.options.slidingExpiration) {
      updates.expiresAt = new Date(now.getTime() + this.options.ttl);
    }

    // Update in database
    await this.updateSession(sessionId, updates);

    // Update cache
    Object.assign(session, updates);
    this.cache.set(sessionId, session, this.options.ttl);
  }

  async destroy(sessionId: string): Promise<void> {
    // Remove from database
    await this.deleteSession(sessionId);

    // Remove from cache
    this.cache.delete(sessionId);

    this.logger.debug('Session destroyed', { sessionId });
  }

  async destroyAll(userId: string): Promise<number> {
    // Get all user sessions
    // Delete from database
    const count = await this.deleteUserSessions(userId);

    // Clear cache for user sessions
    this.cache.invalidatePattern(new RegExp(`^session:.*:${userId}$`));

    this.logger.debug('All user sessions destroyed', { userId, count });

    return count;
  }

  async getUserSessions(userId: string): Promise<SessionData[]> {
    return await this.loadUserSessions(userId);
  }

  async cleanup(): Promise<number> {
    // Delete expired sessions
    const count = await this.cleanupExpiredSessions();

    if (count > 0) {
      this.logger.debug('Sessions cleaned up', { count });
    }

    return count;
  }

  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.cache.shutdown();
  }

  // Implementation of abstract methods for database storage
  protected async saveSession(session: SessionData): Promise<void> {
    // In a real implementation, this would use dataService to save to database
    // For now, we'll just cache it
    this.cache.set(session.id, session, this.options.ttl);
  }

  protected async loadSession(sessionId: string): Promise<SessionData | null> {
    // In a real implementation, this would use dataService to load from database
    return this.cache.get<SessionData>(sessionId);
  }

  protected async updateSession(sessionId: string, updates: Partial<SessionData>): Promise<void> {
    // In a real implementation, this would use dataService to update in database
    const session = await this.loadSession(sessionId);
    if (session) {
      const updated = { ...session, ...updates };
      this.cache.set(sessionId, updated, this.options.ttl);
    }
  }

  protected async deleteSession(sessionId: string): Promise<void> {
    // In a real implementation, this would use dataService to delete from database
    this.cache.delete(sessionId);
  }

  protected async loadUserSessions(userId: string): Promise<SessionData[]> {
    // In a real implementation, this would use dataService to query database
    // For now, return empty array
    return [];
  }

  protected async cleanupExpiredSessions(): Promise<number> {
    // In a real implementation, this would use dataService to delete expired sessions
    // For now, return 0
    return 0;
  }

  protected async deleteUserSessions(userId: string): Promise<number> {
    // In a real implementation, this would use dataService to delete user sessions
    // For now, return 0
    return 0;
  }
}