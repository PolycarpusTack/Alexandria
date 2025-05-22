import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { EnterpriseChunker } from '../utils/enterprise-chunker';
import { UploadedFile } from '../models/UploadedFile';
import { Logger } from '../../../../utils/logger';
import { FileValidator, FileValidationResult } from './file-validator';

/**
 * Options for file storage
 */
export interface FileStorageOptions {
  baseStoragePath: string;
  maxSizeBytes?: number;
  allowedExtensions?: string[];
  allowedMimeTypes?: string[];
}

/**
 * Service for secure file storage and validation
 */
export class FileStorageService {
  private readonly DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly DEFAULT_ALLOWED_EXTENSIONS = ['.txt', '.log', '.json', '.xml', '.html', '.md', '.stacktrace', '.csv'];
  private readonly DEFAULT_ALLOWED_MIME_TYPES = [
    'text/plain', 'text/html', 'text/csv', 'text/markdown',
    'application/json', 'application/xml', 'application/octet-stream'
  ];
  
  private options: FileStorageOptions;
  private chunker: EnterpriseChunker;
  private fileValidator: FileValidator;
  
  constructor(options: FileStorageOptions, private logger: Logger) {
    this.options = {
      ...options,
      maxSizeBytes: options.maxSizeBytes || this.DEFAULT_MAX_SIZE,
      allowedExtensions: options.allowedExtensions || this.DEFAULT_ALLOWED_EXTENSIONS,
      allowedMimeTypes: options.allowedMimeTypes || this.DEFAULT_ALLOWED_MIME_TYPES
    };
    
    // Ensure storage directory exists
    if (!fs.existsSync(this.options.baseStoragePath)) {
      fs.mkdirSync(this.options.baseStoragePath, { recursive: true });
    }
    
    // Initialize the chunker
    this.chunker = new EnterpriseChunker();
    
    // Initialize the file validator
    this.fileValidator = new FileValidator(
      this.logger,
      {
        maxSizeBytes: this.options.maxSizeBytes,
        allowedExtensions: this.options.allowedExtensions,
        allowedMimeTypes: this.options.allowedMimeTypes,
        enableDeepContentValidation: true
      }
    );
  }
  
  /**
   * Store a file in the file system
   * 
   * @param buffer File buffer
   * @param originalFilename Original filename
   * @param mimeType MIME type
   * @param userId User ID
   * @param sessionId Session ID
   * @returns UploadedFile object
   */
  async storeFile(
    buffer: Buffer,
    originalFilename: string,
    mimeType: string,
    userId: string,
    sessionId: string
  ): Promise<UploadedFile> {
    // Validate file before storing
    const validationResult = this.fileValidator.validateFile(buffer, originalFilename, mimeType);
    if (!validationResult.isValid) {
      throw new Error(`File validation failed: ${validationResult.error}`);
    }
    
    // Perform deeper security scan
    const securityScanResult = await this.fileValidator.deepSecurityScan(buffer, originalFilename, mimeType);
    if (securityScanResult.isMalicious) {
      throw new Error(`Security scan failed: ${securityScanResult.detectedThreats.join(', ')}`);
    }
    
    // Apply warnings to metadata
    const validationWarnings = validationResult.warnings || [];
    const metadataWarnings = validationWarnings.length > 0 ? { validationWarnings } : {};
    
    // Use sanitized filename if generated
    let finalOriginalFilename = originalFilename;
    if (validationResult.sanitizedFileName) {
      this.logger.info(`Sanitized filename from ${originalFilename} to ${validationResult.sanitizedFileName}`);
      finalOriginalFilename = validationResult.sanitizedFileName;
    }
    
    // Create a safe filename - use UUID and keep original extension
    const fileExtension = path.extname(originalFilename).toLowerCase();
    // Always sanitize to be extra safe
    const sanitizedOriginalFilename = this.fileValidator.sanitizeFileName(finalOriginalFilename);
    const safeFilename = `${crypto.randomUUID()}${fileExtension}`;
    
    // Construct storage path
    const userDir = path.join(this.options.baseStoragePath, userId);
    const sessionDir = path.join(userDir, sessionId);
    
    // Create directories if they don't exist
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    
    // Full file path
    const filePath = path.join(sessionDir, safeFilename);
    
    // Write file to disk
    fs.writeFileSync(filePath, buffer, { flag: 'wx' }); // wx = write, fail if exists
    
    // Calculate checksum
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    
    // Create uploaded file record
    const uploadedFile = new UploadedFile({
      userId,
      sessionId,
      filename: sanitizedOriginalFilename,
      path: filePath,
      mimeType,
      size: buffer.length,
      checksum,
      uploadedAt: new Date(),
      metadata: {
        originalFilename: originalFilename,
        detectedFileType: validationResult.detectedType,
        ...metadataWarnings
      }
    });
    
    // If it's a text file and not too large, store the content
    if (this.isTextFile(mimeType, fileExtension) && buffer.length <= 5 * 1024 * 1024) { // 5MB max for in-memory
      uploadedFile.content = buffer.toString('utf8');
    }
    
    return uploadedFile;
  }
  
  /**
   * Read a file from storage
   * 
   * @param filePath Path to file
   * @returns File content as string
   */
  async readFile(filePath: string): Promise<string> {
    // Validate that the file exists and is within the base storage path
    this.validateFilePath(filePath);
    
    // Read the file
    return fs.readFileSync(filePath, 'utf8');
  }
  
  /**
   * Read a file and chunk it for LLM processing
   * 
   * @param filePath Path to file
   * @param maxTokensPerChunk Maximum tokens per chunk
   * @returns Array of text chunks
   */
  async readAndChunkFile(filePath: string, maxTokensPerChunk = 4000): Promise<string[]> {
    // Validate that the file exists and is within the base storage path
    this.validateFilePath(filePath);
    
    try {
      // Use enterprise chunker to handle large files efficiently
      return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
          if (err) {
            this.logger.error(`Error reading file for chunking: ${err.message}`);
            reject(err);
            return;
          }
          
          try {
            // Detect file type and choose appropriate chunking strategy
            const fileExtension = path.extname(filePath).toLowerCase();
            let strategy = this.getChunkingStrategy(fileExtension);
            
            // Use enterprise chunker with appropriate strategy
            const chunks = this.chunker.adaptive_chunk_text(data, {
              max_tokens_per_chunk: maxTokensPerChunk,
              strategy
            });
            
            resolve(chunks);
          } catch (chunkError) {
            this.logger.error(`Error chunking file: ${chunkError}`);
            reject(chunkError);
          }
        });
      });
    } catch (error) {
      this.logger.error(`Error in readAndChunkFile: ${error}`);
      throw error;
    }
  }
  
  /**
   * Stream a large file in chunks
   * 
   * @param filePath Path to file
   * @param maxTokensPerChunk Maximum tokens per chunk
   * @returns Async generator of text chunks
   */
  async *streamFileChunks(filePath: string, maxTokensPerChunk = 4000): AsyncGenerator<string, void, unknown> {
    // Validate that the file exists and is within the base storage path
    this.validateFilePath(filePath);
    
    try {
      // Open a read stream for the file
      const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
      
      // Use enterprise chunker to stream the file
      for await (const chunk of this.chunker.chunk_stream(fileStream, { max_tokens_per_chunk: maxTokensPerChunk })) {
        yield chunk;
      }
    } catch (error) {
      this.logger.error(`Error streaming file chunks: ${error}`);
      throw error;
    }
  }
  
  /**
   * Delete a file
   * 
   * @param filePath Path to file
   * @returns true if deleted
   */
  async deleteFile(filePath: string): Promise<boolean> {
    // Validate that the file exists and is within the base storage path
    this.validateFilePath(filePath);
    
    // Delete the file
    fs.unlinkSync(filePath);
    return true;
  }
  
  // Removed validateFile method as it's now handled by FileValidator
  
  /**
   * Validate that a file path is secure and within the base storage path
   * 
   * @param filePath Path to validate
   * @throws Error if path is invalid
   */
  private validateFilePath(filePath: string): void {
    // Check that file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    
    // Prevent directory traversal attacks by verifying path is within base storage
    const resolvedPath = path.resolve(filePath);
    const resolvedBasePath = path.resolve(this.options.baseStoragePath);
    
    if (!resolvedPath.startsWith(resolvedBasePath)) {
      throw new Error('Invalid file path: Attempting to access file outside storage directory');
    }
  }
  
  /**
   * Check if a file is a text file
   * 
   * @param mimeType MIME type
   * @param extension File extension
   * @returns true if text file
   */
  private isTextFile(mimeType: string, extension: string): boolean {
    const textMimeTypes = [
      'text/plain', 
      'text/html', 
      'text/csv', 
      'text/markdown',
      'application/json', 
      'application/xml'
    ];
    
    const textExtensions = [
      '.txt', '.log', '.json', '.xml', '.html', '.md', '.stacktrace', '.csv'
    ];
    
    return textMimeTypes.includes(mimeType) || textExtensions.includes(extension);
  }
  
  // Removed containsMaliciousContent method as it's now handled by FileValidator
  
  /**
   * Get appropriate chunking strategy based on file extension
   * 
   * @param extension File extension
   * @returns Chunking strategy
   */
  private getChunkingStrategy(extension: string): string {
    switch (extension) {
      case '.json':
        return 'structural';
      case '.xml':
      case '.html':
        return 'structural';
      case '.md':
        return 'structural';
      case '.log':
      case '.stacktrace':
        return 'semantic'; // Special handling for logs
      case '.csv':
        return 'structural';
      default:
        return 'adaptive';
    }
  }
}