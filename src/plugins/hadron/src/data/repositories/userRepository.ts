import { User, UserRole } from '../../models';
import { PostgresCollectionService } from '../database';
import { Logger } from '../../../../../utils/logger';

/**
 * Repository for managing user data
 */
export class UserRepository {
  private readonly collectionName = 'hadron_users';

  /**
   * Create a new user repository
   *
   * @param dataService Data service
   * @param logger Logger instance
   */
  constructor(
    private dataService: PostgresCollectionService,
    private logger: Logger
  ) {}

  /**
   * Initialize the repository
   */
  async initialize(): Promise<void> {
    await this.dataService.createCollectionIfNotExists(this.collectionName);
    await this.dataService.createIndex(this.collectionName, 'email');
    await this.dataService.createIndex(this.collectionName, 'username');
    await this.dataService.createIndex(this.collectionName, 'role');

    this.logger.info('User repository initialized');
  }

  /**
   * Save a user
   *
   * @param user User to save
   * @returns Saved user
   */
  async save(user: User): Promise<User> {
    try {
      user.validate();

      // Check if a user with this email or username already exists
      const existingEmail = await this.findByEmail(user.email);
      if (existingEmail && existingEmail.id !== user.id) {
        throw new Error(`User with email ${user.email} already exists`);
      }

      const existingUsername = await this.findByUsername(user.username);
      if (existingUsername && existingUsername.id !== user.id) {
        throw new Error(`User with username ${user.username} already exists`);
      }

      await this.dataService.upsert(this.collectionName, user.id, user.toJSON());
      return user;
    } catch (error) {
      this.logger.error('Error saving user', {
        userId: user.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Find a user by ID
   *
   * @param id User ID
   * @returns User or null if not found
   */
  async findById(id: string): Promise<User | null> {
    try {
      const record = await this.dataService.findById(this.collectionName, id);
      return record ? User.fromRecord(record) : null;
    } catch (error) {
      this.logger.error('Error finding user by ID', {
        userId: id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Find a user by email
   *
   * @param email User email
   * @returns User or null if not found
   */
  async findByEmail(email: string): Promise<User | null> {
    try {
      const records = await this.dataService.find(this.collectionName, { email });
      return records.length > 0 ? User.fromRecord(records[0]) : null;
    } catch (error) {
      this.logger.error('Error finding user by email', {
        email,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Find a user by username
   *
   * @param username Username
   * @returns User or null if not found
   */
  async findByUsername(username: string): Promise<User | null> {
    try {
      const records = await this.dataService.find(this.collectionName, { username });
      return records.length > 0 ? User.fromRecord(records[0]) : null;
    } catch (error) {
      this.logger.error('Error finding user by username', {
        username,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Find users by role
   *
   * @param role User role
   * @returns Array of users
   */
  async findByRole(role: UserRole): Promise<User[]> {
    try {
      const records = await this.dataService.find(this.collectionName, { role });
      return records.map((record) => User.fromRecord(record));
    } catch (error) {
      this.logger.error('Error finding users by role', {
        role,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Find all users
   *
   * @returns Array of all users
   */
  async findAll(): Promise<User[]> {
    try {
      const records = await this.dataService.find(this.collectionName, {});
      return records.map((record) => User.fromRecord(record));
    } catch (error) {
      this.logger.error('Error finding all users', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Delete a user
   *
   * @param id User ID
   * @returns True if the user was deleted
   */
  async delete(id: string): Promise<boolean> {
    try {
      return await this.dataService.delete(this.collectionName, id);
    } catch (error) {
      this.logger.error('Error deleting user', {
        userId: id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Update a user's last login time
   *
   * @param id User ID
   * @returns Updated user or null if not found
   */
  async updateLastLogin(id: string): Promise<User | null> {
    try {
      const user = await this.findById(id);
      if (!user) {
        return null;
      }

      user.lastLoginAt = new Date();
      return this.save(user);
    } catch (error) {
      this.logger.error('Error updating user last login', {
        userId: id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}
