import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { EnterpriseChunker, ChunkingStrategy } from '../utils/enterprise-chunker';
import { UploadedFile } from '../models/UploadedFile';
import { Logger } from '../../../../utils/logger';
import { FileValidator, FileValidationResult } from './file-validator';
import { FileSecurityService } from './file-security-service';
import { FileRepository } from '../data/repositories/fileRepository';
import { AnalysisSessionRepository } from '../data/repositories/analysisSessionRepository';
import { UserRepository } from '../data/repositories/userRepository';
import { HadronRepository } from '../repositories/hadron-repository';
import { PostgresCollectionService, DatabaseService } from '../data/database';

/**
 * Enhanced file storage service configuration
 */
export interface EnhancedFileStorageConfig {
  baseStoragePath: string;
  maxSizeBytes?: number;
  allowedExtensions?: string[];
  allowedMimeTypes?: string[];
  quarantineDir?: string;
  enableAutoScan?: boolean;
  enableBackup?: boolean;
  backupRetentionDays?: number;
  storageQuotaPerUser?: number;
  enableDeduplication?: boolean;
  enableEncryptionAtRest?: boolean;
  enableVersioning?: boolean;
}

/**
 * File operation result with detailed metadata
 */
export interface FileOperationResult {
  success: boolean;
  file?: UploadedFile;
  error?: string;
  warnings?: string[];
  validationResults?: FileValidationResult;
  quarantined?: boolean;
  duplicateFound?: boolean;
  existingFileId?: string;
}

/**
 * File storage statistics
 */
export interface StorageStatistics {
  totalFiles: number;
  totalSize: number;
  filesByType: Record<string, number>;
  averageFileSize: number;
  quarantinedFiles: number;
  userQuotaUsage: Record<string, number>;
  oldestFile: Date;
  newestFile: Date;
}

/**
 * Enhanced file storage service with enterprise features
 * Integrates security scanning, deduplication, quotas, and database persistence
 */
export class EnhancedFileStorageService {
  private readonly DEFAULT_MAX_SIZE = 50 * 1024 * 1024; // 50MB
  private readonly DEFAULT_ALLOWED_EXTENSIONS = [
    '.txt',
    '.log',
    '.json',
    '.xml',
    '.html',
    '.md',
    '.stacktrace',
    '.crash',
    '.py',
    '.js',
    '.ts',
    '.jsx',
    '.tsx',
    '.java',
    '.cpp',
    '.h',
    '.cs',
    '.php',
    '.rb',
    '.go',
    '.rs',
    '.kt',
    '.swift',
    '.dart',
    '.scala',
    '.clj',
    '.vue',
    '.csv',
    '.yaml',
    '.yml',
    '.toml',
    '.ini',
    '.conf',
    '.config',
    '.properties',
    '.dmp',
    '.minidump',
    '.core',
    '.backtrace',
    '.gdb',
    '.strace',
    '.ltrace'
  ];
  private readonly DEFAULT_ALLOWED_MIME_TYPES = [
    'text/plain',
    'text/html',
    'text/csv',
    'text/markdown',
    'application/json',
    'application/xml',
    'application/octet-stream',
    'text/javascript',
    'application/javascript',
    'text/x-python',
    'text/x-java',
    'text/x-c',
    'text/x-csharp',
    'text/x-php',
    'text/x-ruby',
    'text/x-go',
    'text/x-rust',
    'text/x-kotlin',
    'text/x-swift',
    'text/x-dart',
    'text/x-scala',
    'text/x-clojure',
    'application/yaml',
    'text/yaml',
    'application/toml'
  ];
  private readonly DEFAULT_USER_QUOTA = 500 * 1024 * 1024; // 500MB per user

  private config: Required<EnhancedFileStorageConfig>;
  private chunker!: EnterpriseChunker;
  private fileValidator!: FileValidator;
  private securityService!: FileSecurityService;

  constructor(
    config: EnhancedFileStorageConfig,
    private fileRepository: FileRepository,
    private sessionRepository: AnalysisSessionRepository,
    private userRepository: UserRepository,
    private logger: Logger
  ) {
    this.config = {
      baseStoragePath: config.baseStoragePath,
      maxSizeBytes: config.maxSizeBytes || this.DEFAULT_MAX_SIZE,
      allowedExtensions: config.allowedExtensions || this.DEFAULT_ALLOWED_EXTENSIONS,
      allowedMimeTypes: config.allowedMimeTypes || this.DEFAULT_ALLOWED_MIME_TYPES,
      quarantineDir: config.quarantineDir || path.join(config.baseStoragePath, 'quarantine'),
      enableAutoScan: config.enableAutoScan ?? true,
      enableBackup: config.enableBackup ?? false,
      backupRetentionDays: config.backupRetentionDays || 30,
      storageQuotaPerUser: config.storageQuotaPerUser || this.DEFAULT_USER_QUOTA,
      enableDeduplication: config.enableDeduplication ?? true,
      enableEncryptionAtRest: config.enableEncryptionAtRest ?? false,
      enableVersioning: config.enableVersioning ?? false
    };

    this.initializeDirectories();
    this.initializeServices();
  }

  /**
   * Initialize storage directories
   */
  private initializeDirectories(): void {
    const directories = [this.config.baseStoragePath, this.config.quarantineDir];

    if (this.config.enableBackup) {
      directories.push(path.join(this.config.baseStoragePath, 'backups'));
    }

    if (this.config.enableVersioning) {
      directories.push(path.join(this.config.baseStoragePath, 'versions'));
    }

    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o750 });
        this.logger.info(`Created storage directory: ${dir}`);
      }
    }
  }

  /**
   * Initialize services
   */
  private initializeServices(): void {
    this.chunker = new EnterpriseChunker();

    this.fileValidator = new FileValidator(this.logger, {
      maxSizeBytes: this.config.maxSizeBytes,
      allowedExtensions: this.config.allowedExtensions,
      allowedMimeTypes: this.config.allowedMimeTypes,
      enableDeepContentValidation: true,
      enableMalwareScan: this.config.enableAutoScan
    });

    // Initialize security service with enhanced repository
    // Create a proper HadronRepository instance
    const fileCollection = 'files';

    // Create database service and collection service
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'alexandria',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres'
    };

    const dbService = new DatabaseService(dbConfig, this.logger);
    const dataService = new PostgresCollectionService(dbService, this.logger);

    // Create HadronRepository with proper constructor signature
    const hadronRepository = new HadronRepository(dataService);

    this.securityService = new FileSecurityService(hadronRepository, this.logger, {
      baseStoragePath: this.config.baseStoragePath,
      quarantineDir: this.config.quarantineDir,
      maxSizeBytes: this.config.maxSizeBytes,
      allowedExtensions: this.config.allowedExtensions,
      allowedMimeTypes: this.config.allowedMimeTypes
    });
  }

  /**
   * Store a file with comprehensive validation, security scanning, and deduplication
   */
  async storeFile(
    buffer: Buffer,
    originalFilename: string,
    mimeType: string,
    userId: string,
    sessionId: string
  ): Promise<FileOperationResult> {
    const result: FileOperationResult = {
      success: false,
      warnings: []
    };

    try {
      this.logger.info(
        `Processing file upload: ${originalFilename} for user ${userId} session ${sessionId}`
      );

      // 1. Validate user and session exist
      const user = await this.userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: `User not found: ${userId}`
        };
      }

      const session = await this.sessionRepository.findById(sessionId);
      if (!session) {
        return {
          success: false,
          error: `Session not found: ${sessionId}`
        };
      }

      if (session.userId !== userId) {
        return {
          success: false,
          error: 'Session does not belong to user'
        };
      }

      // 2. Check user storage quota
      const quotaCheck = await this.checkUserQuota(userId, buffer.length);
      if (!quotaCheck.allowed) {
        return {
          success: false,
          error: `Storage quota exceeded. Available: ${quotaCheck.available} bytes, Required: ${buffer.length} bytes`
        };
      }

      // 3. File validation
      const validationResult = this.fileValidator.validateFile(buffer, originalFilename, mimeType);
      result.validationResults = validationResult;

      if (!validationResult.isValid) {
        return {
          success: false,
          error: validationResult.error,
          validationResults: validationResult
        };
      }

      if (validationResult.warnings && validationResult.warnings.length > 0) {
        result.warnings!.push(...validationResult.warnings);
      }

      // 4. Deduplication check
      if (this.config.enableDeduplication) {
        const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
        const existingFiles = await this.fileRepository.findByChecksum(checksum);

        if (existingFiles && existingFiles.length > 0) {
          const existingFile = existingFiles[0]; // Take the first matching file
          this.logger.info(`Duplicate file detected: ${checksum}`);
          return {
            success: true,
            file: existingFile,
            duplicateFound: true,
            existingFileId: existingFile.id,
            warnings: ['File already exists with same content - returning existing file']
          };
        }
      }

      // 5. Security scanning
      let quarantined = false;
      if (this.config.enableAutoScan) {
        const securityScanResult = await this.fileValidator.deepSecurityScan(
          buffer,
          originalFilename,
          mimeType
        );

        if (securityScanResult.isMalicious) {
          if (
            securityScanResult.riskLevel === 'critical' ||
            securityScanResult.riskLevel === 'high'
          ) {
            return {
              success: false,
              error: `Security scan failed - file rejected due to ${securityScanResult.riskLevel} risk: ${securityScanResult.detectedThreats.join(', ')}`
            };
          } else {
            quarantined = true;
            result.warnings!.push(
              `File flagged for security review: ${securityScanResult.detectedThreats.join(', ')}`
            );
          }
        }
      }

      // 6. Generate storage paths
      const storageInfo = this.generateStoragePaths(
        userId,
        sessionId,
        originalFilename,
        quarantined
      );

      // 7. Store file to disk
      await this.writeFileToStorage(
        buffer,
        storageInfo.filePath,
        quarantined ? storageInfo.quarantinePath : undefined
      );

      // 8. Create file record
      const uploadedFile = new UploadedFile({
        userId,
        sessionId,
        filename: validationResult.sanitizedFileName || originalFilename,
        path: quarantined ? storageInfo.quarantinePath! : storageInfo.filePath,
        mimeType,
        size: buffer.length,
        checksum: validationResult.checksum!,
        uploadedAt: new Date(),
        content: this.shouldStoreContent(mimeType, path.extname(originalFilename), buffer.length)
          ? buffer.toString('utf8')
          : undefined,
        metadata: {
          originalFilename,
          detectedFileType: validationResult.detectedType,
          validationWarnings: validationResult.warnings,
          securityRisks: validationResult.securityRisks,
          quarantined,
          storageInfo: {
            relativePath: path.relative(
              this.config.baseStoragePath,
              quarantined ? storageInfo.quarantinePath! : storageInfo.filePath
            ),
            actualPath: quarantined ? storageInfo.quarantinePath! : storageInfo.filePath
          }
        }
      });

      // 9. Save to database
      const savedFile = await this.fileRepository.save(uploadedFile);

      // 10. Create backup if enabled
      if (this.config.enableBackup && !quarantined) {
        await this.createBackup(savedFile, buffer);
      }

      this.logger.info(`File stored successfully: ${savedFile.id}`);

      result.success = true;
      result.file = savedFile;
      result.quarantined = quarantined;

      return result;
    } catch (error) {
      this.logger.error('Error storing file:', {
        error: error instanceof Error ? error.message : String(error),
        filename: originalFilename,
        userId,
        sessionId
      });

      return {
        success: false,
        error: `File storage failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Read file content with security validation
   */
  async readFile(
    fileId: string,
    userId: string
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      const file = await this.fileRepository.findById(fileId);

      if (!file) {
        return { success: false, error: 'File not found' };
      }

      // Verify access permissions
      if (file.userId !== userId) {
        const user = await this.userRepository.findById(userId);
        if (!user || (user.role !== 'admin' && user.role !== 'system_admin')) {
          return { success: false, error: 'Access denied' };
        }
      }

      // Check if file is quarantined
      if (file.metadata?.quarantined) {
        return { success: false, error: 'File is quarantined and cannot be accessed' };
      }

      // Validate file path security
      this.validateFilePath(file.path);

      // If content is stored in database, return it
      if (file.content) {
        return { success: true, content: file.content };
      }

      // Read from disk
      const content = fs.readFileSync(file.path, 'utf8');
      return { success: true, content };
    } catch (error) {
      this.logger.error(`Error reading file ${fileId}:`, {
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Read and chunk a file for LLM processing with optimized strategy selection
   */
  async readAndChunkFile(
    fileId: string,
    userId: string,
    maxTokensPerChunk = 4000
  ): Promise<{ success: boolean; chunks?: string[]; error?: string }> {
    try {
      const readResult = await this.readFile(fileId, userId);
      if (!readResult.success) {
        return { success: false, error: readResult.error };
      }

      const file = await this.fileRepository.findById(fileId);
      if (!file) {
        return { success: false, error: 'File metadata not found' };
      }

      // Select chunking strategy based on file type
      const strategy = this.selectChunkingStrategy(file);

      // Use enterprise chunker
      const chunks = this.chunker.adaptive_chunk_text(readResult.content!, {
        max_tokens_per_chunk: maxTokensPerChunk,
        strategy,
        preserve_structure: true,
        overlap_tokens: Math.floor(maxTokensPerChunk * 0.1) // 10% overlap
      });

      this.logger.info(`File chunked: ${fileId}, strategy: ${strategy}, chunks: ${chunks.length}`);

      return { success: true, chunks };
    } catch (error) {
      this.logger.error(`Error chunking file ${fileId}:`, {
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Stream large file chunks with memory optimization
   */
  async *streamFileChunks(
    fileId: string,
    userId: string,
    maxTokensPerChunk = 4000
  ): AsyncGenerator<string, void, unknown> {
    const file = await this.fileRepository.findById(fileId);

    if (!file) {
      throw new Error('File not found');
    }

    // Verify access permissions
    if (file.userId !== userId) {
      const user = await this.userRepository.findById(userId);
      if (!user || (user.role !== 'admin' && user.role !== 'system_admin')) {
        throw new Error('Access denied');
      }
    }

    // Check if file is quarantined
    if (file.metadata?.quarantined) {
      throw new Error('File is quarantined and cannot be accessed');
    }

    // Validate file path security
    this.validateFilePath(file.path);

    try {
      const fileStream = fs.createReadStream(file.path, { encoding: 'utf8' });
      const strategy = this.selectChunkingStrategy(file);

      // Stream chunks using enterprise chunker
      for await (const chunk of this.chunker.chunk_stream(fileStream, {
        max_tokens_per_chunk: maxTokensPerChunk,
        strategy
      })) {
        yield chunk;
      }
    } catch (error) {
      this.logger.error(`Error streaming file chunks ${fileId}:`, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Delete a file with cleanup
   */
  async deleteFile(fileId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const file = await this.fileRepository.findById(fileId);

      if (!file) {
        return { success: false, error: 'File not found' };
      }

      // Verify access permissions
      if (file.userId !== userId) {
        const user = await this.userRepository.findById(userId);
        if (!user || (user.role !== 'admin' && user.role !== 'system_admin')) {
          return { success: false, error: 'Access denied' };
        }
      }

      // Delete from disk
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      // Delete backup if exists
      if (this.config.enableBackup) {
        const backupPath = this.getBackupPath(file);
        if (fs.existsSync(backupPath)) {
          fs.unlinkSync(backupPath);
        }
      }

      // Delete from database
      await this.fileRepository.delete(fileId);

      this.logger.info(`File deleted successfully: ${fileId}`);

      return { success: true };
    } catch (error) {
      this.logger.error(`Error deleting file ${fileId}:`, {
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStatistics(): Promise<StorageStatistics> {
    try {
      // Initialize stats with default values
      const stats: StorageStatistics = {
        totalFiles: 0,
        totalSize: 0,
        filesByType: {},
        averageFileSize: 0,
        quarantinedFiles: 0,
        userQuotaUsage: {},
        oldestFile: new Date(),
        newestFile: new Date()
      };

      // Get all files from the repository
      const files = await this.fileRepository.findAll();

      // Return default stats if no files
      if (!files || files.length === 0) {
        return stats;
      }

      // Calculate statistics from files
      stats.totalFiles = files.length;

      // Process each file to aggregate statistics
      let totalSize = 0;
      const fileTypes: Record<string, number> = {};
      const userQuotas: Record<string, number> = {};
      let quarantinedCount = 0;
      let oldestDate = new Date();
      let newestDate = new Date(0); // Initialize to epoch

      for (const file of files) {
        // Accumulate size
        totalSize += file.size;

        // Count by file type
        const ext = path.extname(file.filename).toLowerCase();
        fileTypes[ext] = (fileTypes[ext] || 0) + 1;

        // Track user quota usage
        userQuotas[file.userId] = (userQuotas[file.userId] || 0) + file.size;

        // Count quarantined files
        if (file.metadata?.quarantined) {
          quarantinedCount++;
        }

        // Track oldest and newest files
        const fileDate = new Date(file.uploadedAt);
        if (fileDate < oldestDate) {
          oldestDate = fileDate;
        }
        if (fileDate > newestDate) {
          newestDate = fileDate;
        }
      }

      // Update stats with calculated values
      stats.totalSize = totalSize;
      stats.filesByType = fileTypes;
      stats.averageFileSize = totalSize / files.length;
      stats.quarantinedFiles = quarantinedCount;
      stats.userQuotaUsage = userQuotas;
      stats.oldestFile = oldestDate;
      stats.newestFile = newestDate;

      return stats;
    } catch (error) {
      this.logger.error('Error getting storage statistics:', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Check user storage quota
   */
  private async checkUserQuota(
    userId: string,
    additionalBytes: number
  ): Promise<{
    allowed: boolean;
    used: number;
    available: number;
    quota: number;
  }> {
    try {
      const userFiles = await this.fileRepository.findByUser(userId);
      const used = userFiles.reduce((total, file) => total + file.size, 0);
      const quota = this.config.storageQuotaPerUser;
      const available = quota - used;

      return {
        allowed: available >= additionalBytes,
        used,
        available,
        quota
      };
    } catch (error) {
      this.logger.error(`Error checking quota for user ${userId}:`, {
        error: error instanceof Error ? error.message : String(error)
      });

      // Fail securely - deny if we can't check quota
      return {
        allowed: false,
        used: 0,
        available: 0,
        quota: this.config.storageQuotaPerUser
      };
    }
  }

  /**
   * Generate storage paths
   */
  private generateStoragePaths(
    userId: string,
    sessionId: string,
    filename: string,
    quarantined: boolean
  ) {
    const safeFilename = `${crypto.randomUUID()}${path.extname(filename)}`;
    const userDir = path.join(this.config.baseStoragePath, userId);
    const sessionDir = path.join(userDir, sessionId);
    const filePath = path.join(sessionDir, safeFilename);

    let quarantinePath: string | undefined;
    if (quarantined) {
      quarantinePath = path.join(
        this.config.quarantineDir,
        `${crypto.randomUUID()}_${this.fileValidator.sanitizeFileName(filename)}`
      );
    }

    return {
      userDir,
      sessionDir,
      filePath,
      safeFilename,
      quarantinePath
    };
  }

  /**
   * Write file to storage with atomic operation
   */
  private async writeFileToStorage(
    buffer: Buffer,
    filePath: string,
    quarantinePath?: string
  ): Promise<void> {
    // Create directories
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o750 });
    }

    if (quarantinePath) {
      const quarantineDir = path.dirname(quarantinePath);
      if (!fs.existsSync(quarantineDir)) {
        fs.mkdirSync(quarantineDir, { recursive: true, mode: 0o750 });
      }
    }

    // Write to quarantine if needed, otherwise to normal path
    const targetPath = quarantinePath || filePath;

    // Atomic write using temporary file
    const tempPath = `${targetPath}.tmp`;

    try {
      fs.writeFileSync(tempPath, buffer, { flag: 'wx', mode: 0o640 });
      fs.renameSync(tempPath, targetPath);
    } catch (error) {
      // Cleanup temp file if it exists
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      throw error;
    }
  }

  /**
   * Create backup of file if enabled
   */
  private async createBackup(file: UploadedFile, buffer: Buffer): Promise<void> {
    if (!this.config.enableBackup) return;

    try {
      const backupPath = this.getBackupPath(file);
      const backupDir = path.dirname(backupPath);

      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true, mode: 0o750 });
      }

      fs.writeFileSync(backupPath, buffer, { mode: 0o640 });

      this.logger.debug(`Backup created: ${backupPath}`);
    } catch (error) {
      this.logger.warn(`Failed to create backup for file ${file.id}:`, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get backup path for a file
   */
  private getBackupPath(file: UploadedFile): string {
    const backupDir = path.join(this.config.baseStoragePath, 'backups');
    const datePath = file.uploadedAt.toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(backupDir, datePath, `${file.id}_${file.filename}`);
  }

  /**
   * Select optimal chunking strategy based on file type
   */
  private selectChunkingStrategy(file: UploadedFile): string {
    const extension = path.extname(file.filename).toLowerCase();
    const detectedType = file.metadata?.detectedFileType;

    // Strategy based on file type
    switch (detectedType) {
      case 'json':
        return 'structural';
      case 'xml':
      case 'html':
        return 'structural';
      case 'python':
      case 'javascript':
      case 'java':
      case 'csharp':
        return 'semantic';
      case 'log':
        return 'semantic'; // Good for preserving log entry boundaries
      default:
        // Fallback based on extension
        switch (extension) {
          case '.json':
          case '.xml':
          case '.html':
          case '.yaml':
          case '.yml':
            return 'structural';
          case '.log':
          case '.stacktrace':
          case '.crash':
          case '.backtrace':
            return 'semantic';
          case '.py':
          case '.js':
          case '.ts':
          case '.java':
          case '.cs':
          case '.cpp':
          case '.h':
            return 'semantic';
          default:
            return 'adaptive';
        }
    }
  }

  /**
   * Determine if file content should be stored in database
   */
  private shouldStoreContent(mimeType: string, extension: string, size: number): boolean {
    const maxInlineSize = 1024 * 1024; // 1MB

    if (size > maxInlineSize) {
      return false;
    }

    // Store small text files inline for performance
    const textMimeTypes = [
      'text/plain',
      'application/json',
      'text/javascript',
      'application/javascript',
      'text/x-python'
    ];

    const textExtensions = ['.txt', '.json', '.js', '.py', '.md', '.log'];

    return textMimeTypes.includes(mimeType) || textExtensions.includes(extension);
  }

  /**
   * Validate file path for security
   */
  private validateFilePath(filePath: string): void {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    const resolvedPath = path.resolve(filePath);
    const resolvedBasePath = path.resolve(this.config.baseStoragePath);
    const resolvedQuarantinePath = path.resolve(this.config.quarantineDir);

    if (
      !resolvedPath.startsWith(resolvedBasePath) &&
      !resolvedPath.startsWith(resolvedQuarantinePath)
    ) {
      throw new Error('Invalid file path: File not in allowed storage locations');
    }
  }
}
