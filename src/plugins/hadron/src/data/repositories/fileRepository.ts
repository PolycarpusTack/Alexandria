import { UploadedFile } from '../../models';
import { PostgresCollectionService } from '../database';
import { Logger } from '../../../../../utils/logger';

/**
 * Repository for managing uploaded files
 */
export class FileRepository {
  private readonly collectionName = 'hadron_files';

  /**
   * Create a new file repository
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
    await this.dataService.createIndex(this.collectionName, 'sessionId');
    await this.dataService.createIndex(this.collectionName, 'userId');
    await this.dataService.createIndex(this.collectionName, 'uploadedAt');
    await this.dataService.createIndex(this.collectionName, 'mimeType');
    await this.dataService.createIndex(this.collectionName, 'checksum');

    this.logger.info('File repository initialized');
  }

  /**
   * Save an uploaded file
   *
   * @param file Uploaded file to save
   * @returns Saved uploaded file
   */
  async save(file: UploadedFile): Promise<UploadedFile> {
    try {
      file.validate();
      await this.dataService.upsert(this.collectionName, file.id, file.toJSON());
      return file;
    } catch (error) {
      this.logger.error('Error saving uploaded file', {
        fileId: file.id,
        filename: file.filename,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Find an uploaded file by ID
   *
   * @param id Uploaded file ID
   * @returns Uploaded file or null if not found
   */
  async findById(id: string): Promise<UploadedFile | null> {
    try {
      const record = await this.dataService.findById(this.collectionName, id);
      return record ? UploadedFile.fromRecord(record) : null;
    } catch (error) {
      this.logger.error('Error finding uploaded file by ID', {
        fileId: id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Find uploaded files by session
   *
   * @param sessionId Analysis session ID
   * @returns Array of uploaded files
   */
  async findBySession(sessionId: string): Promise<UploadedFile[]> {
    try {
      const records = await this.dataService.find(this.collectionName, { sessionId });
      return records.map((record) => UploadedFile.fromRecord(record));
    } catch (error) {
      this.logger.error('Error finding uploaded files by session', {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Find uploaded files by user
   *
   * @param userId User ID
   * @returns Array of uploaded files
   */
  async findByUser(userId: string): Promise<UploadedFile[]> {
    try {
      const records = await this.dataService.find(this.collectionName, { userId });
      return records.map((record) => UploadedFile.fromRecord(record));
    } catch (error) {
      this.logger.error('Error finding uploaded files by user', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Find uploaded files by checksum
   *
   * @param checksum File checksum
   * @returns Array of uploaded files with matching checksum
   */
  async findByChecksum(checksum: string): Promise<UploadedFile[]> {
    try {
      const records = await this.dataService.find(this.collectionName, { checksum });
      return records.map((record) => UploadedFile.fromRecord(record));
    } catch (error) {
      this.logger.error('Error finding uploaded files by checksum', {
        checksum,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Find uploaded files by metadata field
   *
   * @param field Metadata field name
   * @param value Field value
   * @returns Array of uploaded files
   */
  async findByMetadataField(field: string, value: any): Promise<UploadedFile[]> {
    try {
      // This would need a more sophisticated implementation with JSONB querying
      // For now, we'll get all files and filter in memory
      const allFiles = await this.dataService.find(this.collectionName, {});
      const filteredFiles = allFiles
        .map((record) => UploadedFile.fromRecord(record))
        .filter((file) => file.metadata && file.metadata[field] === value);

      return filteredFiles;
    } catch (error) {
      this.logger.error('Error finding uploaded files by metadata field', {
        field,
        value,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Find all uploaded files
   *
   * @returns Array of all uploaded files
   */
  async findAll(): Promise<UploadedFile[]> {
    try {
      const records = await this.dataService.find(this.collectionName, {});
      return records.map((record) => UploadedFile.fromRecord(record));
    } catch (error) {
      this.logger.error('Error finding all uploaded files', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Update an uploaded file's metadata
   *
   * @param id File ID
   * @param metadata New metadata
   * @returns Updated file or null if not found
   */
  async updateMetadata(id: string, metadata: Record<string, any>): Promise<UploadedFile | null> {
    try {
      const file = await this.findById(id);
      if (!file) {
        return null;
      }

      file.metadata = { ...file.metadata, ...metadata };
      return this.save(file);
    } catch (error) {
      this.logger.error('Error updating uploaded file metadata', {
        fileId: id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Update an uploaded file
   *
   * @param file Updated file
   * @returns Updated uploaded file
   */
  async update(file: UploadedFile): Promise<UploadedFile> {
    return this.save(file);
  }

  /**
   * Delete an uploaded file
   *
   * @param id File ID
   * @returns True if the file was deleted
   */
  async delete(id: string): Promise<boolean> {
    try {
      return await this.dataService.delete(this.collectionName, id);
    } catch (error) {
      this.logger.error('Error deleting uploaded file', {
        fileId: id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Find files with duplicate checksums
   *
   * @returns Array of arrays, each containing files with the same checksum
   */
  async findDuplicatesByChecksum(): Promise<UploadedFile[][]> {
    try {
      const allFiles = await this.findAll();

      // Group files by checksum
      const checksumGroups = new Map<string, UploadedFile[]>();

      for (const file of allFiles) {
        if (!checksumGroups.has(file.checksum)) {
          checksumGroups.set(file.checksum, []);
        }
        checksumGroups.get(file.checksum)!.push(file);
      }

      // Return only groups with more than one file
      return Array.from(checksumGroups.values()).filter((group) => group.length > 1);
    } catch (error) {
      this.logger.error('Error finding duplicate files by checksum', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}
