import { IUser, UserRole } from './interfaces';
import { v4 as uuidv4 } from 'uuid';

/**
 * User model implementation
 */
export class User implements IUser {
  id: string;
  username: string;
  email: string;
  fullName?: string;
  role: UserRole;
  createdAt: Date;
  lastLoginAt?: Date;
  preferences?: Record<string, any>;

  /**
   * Create a new User instance
   * 
   * @param data User data, partial or complete
   */
  constructor(data: Partial<IUser>) {
    this.id = data.id || uuidv4();
    this.username = data.username || '';
    this.email = data.email || '';
    this.fullName = data.fullName;
    this.role = data.role || UserRole.USER;
    this.createdAt = data.createdAt || new Date();
    this.lastLoginAt = data.lastLoginAt;
    this.preferences = data.preferences || {};
  }

  /**
   * Validate user data
   * 
   * @returns true if valid, throws error if invalid
   */
  validate(): boolean {
    if (!this.username || this.username.trim() === '') {
      throw new Error('Username is required');
    }

    if (!this.email || this.email.trim() === '') {
      throw new Error('Email is required');
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      throw new Error('Invalid email format');
    }

    return true;
  }

  /**
   * Convert to JSON object
   * 
   * @returns User data as plain object
   */
  toJSON(): Record<string, any> {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      fullName: this.fullName,
      role: this.role,
      createdAt: this.createdAt,
      lastLoginAt: this.lastLoginAt,
      preferences: this.preferences
    };
  }

  /**
   * Create a User instance from database record
   * 
   * @param record Database record
   * @returns User instance
   */
  static fromRecord(record: Record<string, any>): User {
    return new User({
      id: record.id,
      username: record.username,
      email: record.email,
      fullName: record.full_name,
      role: record.role as UserRole,
      createdAt: new Date(record.created_at),
      lastLoginAt: record.last_login_at ? new Date(record.last_login_at) : undefined,
      preferences: record.preferences ? JSON.parse(record.preferences) : {}
    });
  }
}