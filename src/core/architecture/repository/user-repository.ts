/**
 * User Repository Implementation
 * Demonstrates repository pattern with specifications
 */

import { User } from '../hexagonal/ports';
import { BaseSpecification, InMemoryRepository, QueryCriteria } from './base-repository';
import { Logger } from '../../../utils/logger';

// ==================== USER ENTITY ====================

export interface UserEntity extends User {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== USER SPECIFICATIONS ====================

export class UserByEmailSpecification extends BaseSpecification<UserEntity> {
  constructor(private email: string) {
    super();
  }

  isSatisfiedBy(user: UserEntity): boolean {
    return user.email.toLowerCase() === this.email.toLowerCase();
  }

  toQuery(): QueryCriteria {
    return {
      field: 'email',
      operator: 'eq',
      value: this.email.toLowerCase()
    };
  }
}

export class UserByRoleSpecification extends BaseSpecification<UserEntity> {
  constructor(private role: string) {
    super();
  }

  isSatisfiedBy(user: UserEntity): boolean {
    return user.role === this.role;
  }

  toQuery(): QueryCriteria {
    return {
      field: 'role',
      operator: 'eq',
      value: this.role
    };
  }
}

export class ActiveUserSpecification extends BaseSpecification<UserEntity> {
  isSatisfiedBy(user: UserEntity): boolean {
    return user.isActive;
  }

  toQuery(): QueryCriteria {
    return {
      field: 'isActive',
      operator: 'eq',
      value: true
    };
  }
}

export class RecentlyLoggedInSpecification extends BaseSpecification<UserEntity> {
  constructor(private withinDays: number = 30) {
    super();
  }

  isSatisfiedBy(user: UserEntity): boolean {
    if (!user.lastLoginAt) return false;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.withinDays);

    return user.lastLoginAt >= cutoffDate;
  }

  toQuery(): QueryCriteria {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.withinDays);

    return {
      field: 'lastLoginAt',
      operator: 'gte',
      value: cutoffDate
    };
  }
}

export class UserCreatedAfterSpecification extends BaseSpecification<UserEntity> {
  constructor(private date: Date) {
    super();
  }

  isSatisfiedBy(user: UserEntity): boolean {
    return user.createdAt >= this.date;
  }

  toQuery(): QueryCriteria {
    return {
      field: 'createdAt',
      operator: 'gte',
      value: this.date
    };
  }
}

// ==================== USER REPOSITORY ====================

export class UserRepository extends InMemoryRepository<UserEntity> {
  constructor(logger: Logger) {
    super('User', logger);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const spec = new UserByEmailSpecification(email);
    return this.findOneBySpecification(spec);
  }

  async findActiveUsers(options?: { limit?: number; offset?: number }): Promise<UserEntity[]> {
    const spec = new ActiveUserSpecification();
    const result = await this.findBySpecification(spec, options);
    return result.data;
  }

  async findUsersByRole(
    role: string,
    options?: { limit?: number; offset?: number }
  ): Promise<UserEntity[]> {
    const spec = new UserByRoleSpecification(role);
    const result = await this.findBySpecification(spec, options);
    return result.data;
  }

  async findActiveAdmins(): Promise<UserEntity[]> {
    const activeSpec = new ActiveUserSpecification();
    const adminSpec = new UserByRoleSpecification('admin');
    const combinedSpec = activeSpec.and(adminSpec);

    const result = await this.findBySpecification(combinedSpec);
    return result.data;
  }

  async findRecentlyActiveUsers(withinDays: number = 30): Promise<UserEntity[]> {
    const activeSpec = new ActiveUserSpecification();
    const recentSpec = new RecentlyLoggedInSpecification(withinDays);
    const combinedSpec = activeSpec.and(recentSpec);

    const result = await this.findBySpecification(combinedSpec);
    return result.data;
  }

  async findNewUsers(sinceDate: Date): Promise<UserEntity[]> {
    const spec = new UserCreatedAfterSpecification(sinceDate);
    const result = await this.findBySpecification(spec);
    return result.data;
  }

  async deactivateUser(id: string): Promise<UserEntity> {
    return this.update(id, { isActive: false });
  }

  async activateUser(id: string): Promise<UserEntity> {
    return this.update(id, { isActive: true });
  }

  async updateLastLogin(id: string): Promise<UserEntity> {
    return this.update(id, { lastLoginAt: new Date() });
  }

  async getUserStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byRole: Record<string, number>;
    recentlyCreated: number;
  }> {
    const allUsers = await this.findAll();
    const users = allUsers.data;

    const active = users.filter((u) => u.isActive).length;
    const inactive = users.filter((u) => !u.isActive).length;

    // Count by role
    const byRole: Record<string, number> = {};
    users.forEach((user) => {
      byRole[user.role] = (byRole[user.role] || 0) + 1;
    });

    // Recently created (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentlyCreated = users.filter((u) => u.createdAt >= weekAgo).length;

    return {
      total: users.length,
      active,
      inactive,
      byRole,
      recentlyCreated
    };
  }
}

// ==================== EXAMPLE USAGE ====================

/**
 * Example usage of the User Repository with specifications
 */
export class UserService {
  constructor(private userRepository: UserRepository) {}

  async createUser(
    userData: Omit<UserEntity, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>
  ): Promise<UserEntity> {
    // Check if user already exists
    const existing = await this.userRepository.findByEmail(userData.email);
    if (existing) {
      throw new Error('User with this email already exists');
    }

    // Create new user
    return this.userRepository.create({
      ...userData,
      isActive: true
    });
  }

  async authenticateUser(email: string, password: string): Promise<UserEntity | null> {
    const user = await this.userRepository.findByEmail(email);

    if (!user || !user.isActive) {
      return null;
    }

    // In a real implementation, you would verify the password hash here
    // For demo purposes, we'll assume authentication succeeds

    // Update last login
    await this.userRepository.updateLastLogin(user.id);

    return user;
  }

  async getActiveAdministrators(): Promise<UserEntity[]> {
    return this.userRepository.findActiveAdmins();
  }

  async getRecentlyActiveUsers(days: number = 30): Promise<UserEntity[]> {
    return this.userRepository.findRecentlyActiveUsers(days);
  }

  async getUserDashboardStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    newUsersThisWeek: number;
    adminCount: number;
    usersByRole: Record<string, number>;
  }> {
    const stats = await this.userRepository.getUserStatistics();

    return {
      totalUsers: stats.total,
      activeUsers: stats.active,
      newUsersThisWeek: stats.recentlyCreated,
      adminCount: stats.byRole['admin'] || 0,
      usersByRole: stats.byRole
    };
  }
}
