import { CollectionDataService } from '../interfaces';
import {
  User,
  AnalysisSession,
  UploadedFile,
  CodeSnippet,
  AnalysisResult,
  AnalysisSessionStatus,
  IUser,
  IAnalysisSession,
  IUploadedFile,
  ICodeSnippet,
  IAnalysisResult
} from '../models';
import { createLogger } from '../../../../utils/logger';

const logger = createLogger({ serviceName: 'hadron-repository' });

/**
 * Repository for managing Hadron Crash Analyzer data
 */
export class HadronRepository {
  private userCollection = 'hadron_users';
  private sessionCollection = 'hadron_sessions';
  private fileCollection = 'hadron_files';
  private snippetCollection = 'hadron_snippets';
  private analysisCollection = 'hadron_analyses';

  constructor(private dataService: CollectionDataService) {}

  /**
   * Initialize the repository, creating necessary collections and indexes
   */
  async initialize(): Promise<void> {
    // Create collections if they don't exist
    await this.dataService.createCollectionIfNotExists(this.userCollection);
    await this.dataService.createCollectionIfNotExists(this.sessionCollection);
    await this.dataService.createCollectionIfNotExists(this.fileCollection);
    await this.dataService.createCollectionIfNotExists(this.snippetCollection);
    await this.dataService.createCollectionIfNotExists(this.analysisCollection);

    // Create indexes for efficient queries
    await this.dataService.createIndex(this.userCollection, 'email');
    await this.dataService.createIndex(this.userCollection, 'username');

    await this.dataService.createIndex(this.sessionCollection, 'userId');
    await this.dataService.createIndex(this.sessionCollection, 'status');

    await this.dataService.createIndex(this.fileCollection, 'sessionId');
    await this.dataService.createIndex(this.fileCollection, 'userId');

    await this.dataService.createIndex(this.snippetCollection, 'sessionId');
    await this.dataService.createIndex(this.snippetCollection, 'userId');

    await this.dataService.createIndex(this.analysisCollection, 'sessionId');
    await this.dataService.createIndex(this.analysisCollection, 'fileId');
    await this.dataService.createIndex(this.analysisCollection, 'snippetId');
    await this.dataService.createIndex(this.analysisCollection, 'userId');
  }

  // User methods

  /**
   * Save a user to the repository
   */
  async saveUser(user: User): Promise<User> {
    try {
      user.validate();

      // Check if user with email or username already exists
      const existingByEmail = await this.getUserByEmail(user.email);
      if (existingByEmail && existingByEmail.id !== user.id) {
        throw new Error(`User with email ${user.email} already exists`);
      }

      const existingByUsername = await this.getUserByUsername(user.username);
      if (existingByUsername && existingByUsername.id !== user.id) {
        throw new Error(`User with username ${user.username} already exists`);
      }

      await this.dataService.upsert(this.userCollection, user.id, this.toDbRecord(user));
      return user;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get a user by ID
   */
  async getUserById(id: string): Promise<User | null> {
    const record = await this.dataService.findById(this.userCollection, id);
    return record ? User.fromRecord(record) : null;
  }

  /**
   * Get a user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const records = await this.dataService.find(this.userCollection, { email });
    return records.length > 0 ? User.fromRecord(records[0]) : null;
  }

  /**
   * Get a user by username
   */
  async getUserByUsername(username: string): Promise<User | null> {
    const records = await this.dataService.find(this.userCollection, { username });
    return records.length > 0 ? User.fromRecord(records[0]) : null;
  }

  /**
   * Delete a user by ID
   */
  async deleteUser(id: string): Promise<boolean> {
    // Note: In a real implementation, you might want to handle cascading deletes
    // or archive user data instead of permanent deletion
    await this.dataService.delete(this.userCollection, id);
    return true;
  }

  // Analysis Session methods

  /**
   * Save an analysis session to the repository
   */
  async saveSession(session: AnalysisSession): Promise<AnalysisSession> {
    try {
      session.validate();
      await this.dataService.upsert(this.sessionCollection, session.id, this.toDbRecord(session));
      return session;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get an analysis session by ID
   */
  async getSessionById(id: string): Promise<AnalysisSession | null> {
    const record = await this.dataService.findById(this.sessionCollection, id);
    return record ? AnalysisSession.fromRecord(record) : null;
  }

  /**
   * Get all analysis sessions for a user
   */
  async getSessionsByUser(userId: string): Promise<AnalysisSession[]> {
    const records = await this.dataService.find(this.sessionCollection, { user_id: userId });
    return records.map((r) => AnalysisSession.fromRecord(r));
  }

  /**
   * Get analysis sessions by status
   */
  async getSessionsByStatus(status: AnalysisSessionStatus): Promise<AnalysisSession[]> {
    const records = await this.dataService.find(this.sessionCollection, { status });
    return records.map((r) => AnalysisSession.fromRecord(r));
  }

  /**
   * Update session status
   *
   * @param id Session ID
   * @param status New session status
   * @param metadata Optional metadata to add to the session
   * @returns Updated session or null if not found
   */
  async updateSessionStatus(
    id: string,
    status: AnalysisSessionStatus,
    metadata?: Record<string, string | number | boolean | null>
  ): Promise<AnalysisSession | null> {
    const session = await this.getSessionById(id);
    if (!session) return null;

    // Update status
    session.updateStatus(status);

    // Add metadata if provided
    if (metadata) {
      session.metadata = {
        ...session.metadata,
        statusUpdates: [
          ...(session.metadata?.statusUpdates || []),
          {
            status,
            timestamp: new Date().toISOString(),
            ...metadata
          }
        ]
      };
    }

    return this.saveSession(session);
  }

  /**
   * Delete an analysis session and all related data
   */
  async deleteSession(id: string): Promise<boolean> {
    // Delete all files associated with this session
    const files = await this.getFilesBySession(id);
    for (const file of files) {
      await this.deleteFile(file.id);
    }

    // Delete all snippets associated with this session
    const snippets = await this.getSnippetsBySession(id);
    for (const snippet of snippets) {
      await this.deleteSnippet(snippet.id);
    }

    // Delete all analyses associated with this session
    const analyses = await this.getAnalysesBySession(id);
    for (const analysis of analyses) {
      await this.deleteAnalysisResult(analysis.id);
    }

    // Finally, delete the session itself
    await this.dataService.delete(this.sessionCollection, id);
    return true;
  }

  // UploadedFile methods

  /**
   * Save an uploaded file to the repository
   */
  async saveFile(file: UploadedFile): Promise<UploadedFile> {
    try {
      file.validate();
      await this.dataService.upsert(this.fileCollection, file.id, this.toDbRecord(file));
      return file;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update an existing file in the repository
   */
  async updateFile(file: UploadedFile): Promise<UploadedFile> {
    // This is essentially the same as saveFile, but we'll keep it separate for clarity
    try {
      // Ensure the file exists before updating
      const existingFile = await this.getFileById(file.id);
      if (!existingFile) {
        throw new Error(`File with ID ${file.id} not found`);
      }

      file.validate();
      await this.dataService.upsert(this.fileCollection, file.id, this.toDbRecord(file));
      return file;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get an uploaded file by ID
   */
  async getFileById(id: string): Promise<UploadedFile | null> {
    const record = await this.dataService.findById(this.fileCollection, id);
    return record ? UploadedFile.fromRecord(record) : null;
  }

  /**
   * Get all files for a session
   */
  async getFilesBySession(sessionId: string): Promise<UploadedFile[]> {
    const records = await this.dataService.find(this.fileCollection, { session_id: sessionId });
    return records.map((r) => UploadedFile.fromRecord(r));
  }

  /**
   * Get files by session ID - alias for getFilesBySession for backward compatibility
   */
  async getFilesBySessionId(sessionId: string): Promise<UploadedFile[]> {
    return this.getFilesBySession(sessionId);
  }

  /**
   * Get all files uploaded by a user
   */
  async getFilesByUser(userId: string): Promise<UploadedFile[]> {
    const records = await this.dataService.find(this.fileCollection, { user_id: userId });
    return records.map((r) => UploadedFile.fromRecord(r));
  }

  /**
   * Find files by a specific value in their metadata
   *
   * @param field The metadata field to search for
   * @param value The value to match
   * @returns Array of files that match the criteria
   */
  async findFilesByMetadataField(
    field: string,
    value: string | number | boolean | null
  ): Promise<UploadedFile[]> {
    try {
      // Search for files where metadata.field = value
      // This is a custom query that isn't directly supported by the CollectionDataService
      // So we'll get all files and filter them here
      const allFiles = await this.dataService.find(this.fileCollection, {});

      // Filter the files based on their metadata
      const matchingFiles = allFiles.filter((record) => {
        try {
          // Check if the record has metadata
          if (!record.metadata) return false;

          // Check if the field exists and matches the value
          return record.metadata[field] === value;
        } catch {
          return false;
        }
      });

      // Convert the records to UploadedFile objects
      return matchingFiles.map((r) => UploadedFile.fromRecord(r));
    } catch (error) {
      // Propagate the error
      throw error;
    }
  }

  /**
   * Delete an uploaded file
   */
  async deleteFile(id: string): Promise<boolean> {
    // Delete any analyses that reference this file
    const analyses = await this.getAnalysesByFile(id);
    for (const analysis of analyses) {
      await this.deleteAnalysisResult(analysis.id);
    }

    // Then delete the file itself
    await this.dataService.delete(this.fileCollection, id);
    return true;
  }

  // CodeSnippet methods

  /**
   * Save a code snippet to the repository
   */
  async saveSnippet(snippet: CodeSnippet): Promise<CodeSnippet> {
    try {
      snippet.validate();
      await this.dataService.upsert(this.snippetCollection, snippet.id, this.toDbRecord(snippet));
      return snippet;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get a code snippet by ID
   */
  async getSnippetById(id: string): Promise<CodeSnippet | null> {
    const record = await this.dataService.findById(this.snippetCollection, id);
    return record ? CodeSnippet.fromRecord(record) : null;
  }

  /**
   * Get all snippets for a session
   */
  async getSnippetsBySession(sessionId: string): Promise<CodeSnippet[]> {
    const records = await this.dataService.find(this.snippetCollection, { session_id: sessionId });
    return records.map((r) => CodeSnippet.fromRecord(r));
  }

  /**
   * Get all snippets created by a user
   */
  async getSnippetsByUser(userId: string): Promise<CodeSnippet[]> {
    const records = await this.dataService.find(this.snippetCollection, { user_id: userId });
    return records.map((r) => CodeSnippet.fromRecord(r));
  }

  /**
   * Delete a code snippet
   */
  async deleteSnippet(id: string): Promise<boolean> {
    // Delete any analyses that reference this snippet
    const analyses = await this.getAnalysesBySnippet(id);
    for (const analysis of analyses) {
      await this.deleteAnalysisResult(analysis.id);
    }

    // Then delete the snippet itself
    await this.dataService.delete(this.snippetCollection, id);
    return true;
  }

  // AnalysisResult methods

  /**
   * Save an analysis result to the repository
   */
  async saveAnalysisResult(result: AnalysisResult): Promise<AnalysisResult> {
    try {
      result.validate();
      await this.dataService.upsert(this.analysisCollection, result.id, this.toDbRecord(result));
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get an analysis result by ID
   */
  async getAnalysisById(id: string): Promise<AnalysisResult | null> {
    const record = await this.dataService.findById(this.analysisCollection, id);
    return record ? AnalysisResult.fromRecord(record) : null;
  }

  /**
   * Get all analyses for a session
   */
  async getAnalysesBySession(sessionId: string): Promise<AnalysisResult[]> {
    const records = await this.dataService.find(this.analysisCollection, { session_id: sessionId });
    return records.map((r) => AnalysisResult.fromRecord(r));
  }

  /**
   * Get all analyses for a file
   */
  async getAnalysesByFile(fileId: string): Promise<AnalysisResult[]> {
    const records = await this.dataService.find(this.analysisCollection, { file_id: fileId });
    return records.map((r) => AnalysisResult.fromRecord(r));
  }

  /**
   * Get all analyses for a snippet
   */
  async getAnalysesBySnippet(snippetId: string): Promise<AnalysisResult[]> {
    const records = await this.dataService.find(this.analysisCollection, { snippet_id: snippetId });
    return records.map((r) => AnalysisResult.fromRecord(r));
  }

  /**
   * Get all analyses by a user
   */
  async getAnalysesByUser(userId: string): Promise<AnalysisResult[]> {
    const records = await this.dataService.find(this.analysisCollection, { user_id: userId });
    return records.map((r) => AnalysisResult.fromRecord(r));
  }

  /**
   * Delete an analysis result
   */
  async deleteAnalysisResult(id: string): Promise<boolean> {
    await this.dataService.delete(this.analysisCollection, id);
    return true;
  }

  // Utility methods

  /**
   * Convert an object to a database record with snake_case keys
   *
   * @param obj Object to convert
   * @returns Database record
   */
  private toDbRecord(obj: Record<string, unknown>): Record<string, unknown> {
    // Input validation
    if (!obj || typeof obj !== 'object') {
      throw new Error('Cannot convert null or non-object to database record');
    }

    const record: Record<string, unknown> = {};

    try {
      // Convert camelCase keys to snake_case
      for (const [key, value] of Object.entries(obj)) {
        // Skip functions and undefined values
        if (typeof value === 'function' || value === undefined) continue;

        // Convert key from camelCase to snake_case
        const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

        // Handle special fields that need JSON serialization
        if (
          key === 'metadata' ||
          key === 'preferences' ||
          key === 'tags' ||
          key === 'potentialRootCauses' ||
          key === 'troubleshootingSteps'
        ) {
          // Only attempt to stringify objects, arrays, or non-null values
          if (
            value !== null &&
            (Array.isArray(value) ||
              typeof value === 'object' ||
              typeof value === 'string' ||
              typeof value === 'number' ||
              typeof value === 'boolean')
          ) {
            try {
              // For strings that are already JSON, avoid double serialization
              if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
                try {
                  // Test if it's valid JSON already
                  JSON.parse(value);
                  // If no error thrown, it's already valid JSON
                  record[snakeKey] = value;
                } catch {
                  // Not valid JSON, stringify it
                  record[snakeKey] = JSON.stringify(value);
                }
              } else {
                record[snakeKey] = JSON.stringify(value);
              }
            } catch (jsonError) {
              // If JSON serialization fails, log and store as string representation
              logger.error('Error serializing field to JSON', { field: key, error: jsonError });
              record[snakeKey] = String(value);
            }
          } else {
            // Handle null values
            record[snakeKey] = null;
          }
        } else {
          // Regular fields
          record[snakeKey] = value;
        }
      }

      return record;
    } catch (error) {
      logger.error('Error converting object to database record', { error });
      throw new Error(
        `Failed to convert object to database record: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
