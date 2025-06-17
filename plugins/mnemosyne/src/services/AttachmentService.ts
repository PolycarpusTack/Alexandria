import { Repository } from 'typeorm';
import { AppDataSource } from '../database/data-source';
import { Node } from '../database/entities/Node.entity';
import { ApiError } from '../utils/errors';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';

export interface Attachment {
  id: string;
  nodeId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  hash: string;
  path: string;
  uploadedBy: string;
  uploadedAt: Date;
}

export interface AttachmentMetadata {
  attachments: Attachment[];
}

export class AttachmentService extends EventEmitter {
  private nodeRepo: Repository<Node>;
  private storagePath: string;
  private maxFileSize: number;
  private allowedMimeTypes: Set<string>;

  constructor() {
    super();
    this.nodeRepo = AppDataSource.getRepository(Node);
    this.storagePath = process.env.MNEMOSYNE_ATTACHMENTS_PATH || './storage/mnemosyne/attachments';
    this.maxFileSize = parseInt(process.env.MNEMOSYNE_MAX_FILE_SIZE || '10485760'); // 10MB default
    
    // Allowed MIME types for security
    this.allowedMimeTypes = new Set([
      // Images
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      // Text
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/json',
      // Archives
      'application/zip',
      'application/x-tar',
      'application/gzip'
    ]);
    
    this.initializeStorage();
  }

  private async initializeStorage(): Promise<void> {
    try {
      await fs.mkdir(this.storagePath, { recursive: true });
    } catch (error) {
      console.error('Failed to create storage directory:', error);
    }
  }

  async uploadAttachment(
    nodeId: string,
    file: Express.Multer.File,
    userId: string
  ): Promise<Attachment> {
    // Validate node exists
    const node = await this.nodeRepo.findOne({ 
      where: { id: nodeId, deletedAt: null } 
    });
    
    if (!node) {
      throw new ApiError('Node not found', 404);
    }

    // Validate file
    this.validateFile(file);

    // Generate unique filename
    const fileId = crypto.randomBytes(16).toString('hex');
    const fileExt = path.extname(file.originalname);
    const filename = `${nodeId}/${fileId}${fileExt}`;
    const filePath = path.join(this.storagePath, filename);

    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // Calculate file hash
    const hash = await this.calculateFileHash(file.buffer);

    // Check for duplicate files
    const existingAttachment = await this.findAttachmentByHash(nodeId, hash);
    if (existingAttachment) {
      return existingAttachment;
    }

    // Save file to disk
    await fs.writeFile(filePath, file.buffer);

    // Create attachment record
    const attachment: Attachment = {
      id: fileId,
      nodeId,
      filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      hash,
      path: filePath,
      uploadedBy: userId,
      uploadedAt: new Date()
    };

    // Update node metadata
    await this.addAttachmentToNode(node, attachment);

    // Emit event
    this.emit('attachment:uploaded', { nodeId, attachment });

    return attachment;
  }

  async getAttachment(nodeId: string, attachmentId: string): Promise<Attachment | null> {
    const node = await this.nodeRepo.findOne({ 
      where: { id: nodeId, deletedAt: null } 
    });
    
    if (!node) {
      throw new ApiError('Node not found', 404);
    }

    const metadata = node.metadata as any;
    const attachments = metadata.attachments || [];
    
    return attachments.find((att: Attachment) => att.id === attachmentId) || null;
  }

  async getNodeAttachments(nodeId: string): Promise<Attachment[]> {
    const node = await this.nodeRepo.findOne({ 
      where: { id: nodeId, deletedAt: null } 
    });
    
    if (!node) {
      throw new ApiError('Node not found', 404);
    }

    const metadata = node.metadata as any;
    return metadata.attachments || [];
  }

  async deleteAttachment(
    nodeId: string, 
    attachmentId: string
  ): Promise<void> {
    const node = await this.nodeRepo.findOne({ 
      where: { id: nodeId, deletedAt: null } 
    });
    
    if (!node) {
      throw new ApiError('Node not found', 404);
    }

    const metadata = node.metadata as any;
    const attachments = metadata.attachments || [];
    const attachmentIndex = attachments.findIndex((att: Attachment) => att.id === attachmentId);
    
    if (attachmentIndex === -1) {
      throw new ApiError('Attachment not found', 404);
    }

    const attachment = attachments[attachmentIndex];

    // Delete file from disk
    try {
      await fs.unlink(attachment.path);
    } catch (error) {
      console.error('Failed to delete file:', error);
    }

    // Remove from node metadata
    attachments.splice(attachmentIndex, 1);
    node.metadata = { ...metadata, attachments };
    await this.nodeRepo.save(node);

    // Emit event
    this.emit('attachment:deleted', { nodeId, attachmentId });
  }

  async downloadAttachment(
    nodeId: string,
    attachmentId: string
  ): Promise<{ stream: NodeJS.ReadableStream; attachment: Attachment }> {
    const attachment = await this.getAttachment(nodeId, attachmentId);
    
    if (!attachment) {
      throw new ApiError('Attachment not found', 404);
    }

    // Check if file exists
    try {
      await fs.access(attachment.path);
    } catch {
      throw new ApiError('Attachment file not found on disk', 404);
    }

    const stream = createReadStream(attachment.path);
    return { stream, attachment };
  }

  async copyAttachments(
    sourceNodeId: string,
    targetNodeId: string,
    userId: string
  ): Promise<Attachment[]> {
    const sourceAttachments = await this.getNodeAttachments(sourceNodeId);
    const copiedAttachments: Attachment[] = [];

    for (const sourceAtt of sourceAttachments) {
      try {
        // Read source file
        const sourceData = await fs.readFile(sourceAtt.path);
        
        // Create new attachment
        const fileId = crypto.randomBytes(16).toString('hex');
        const fileExt = path.extname(sourceAtt.originalName);
        const filename = `${targetNodeId}/${fileId}${fileExt}`;
        const filePath = path.join(this.storagePath, filename);

        // Ensure directory exists
        await fs.mkdir(path.dirname(filePath), { recursive: true });

        // Write to new location
        await fs.writeFile(filePath, sourceData);

        // Create attachment record
        const attachment: Attachment = {
          id: fileId,
          nodeId: targetNodeId,
          filename,
          originalName: sourceAtt.originalName,
          mimeType: sourceAtt.mimeType,
          size: sourceAtt.size,
          hash: sourceAtt.hash,
          path: filePath,
          uploadedBy: userId,
          uploadedAt: new Date()
        };

        copiedAttachments.push(attachment);
      } catch (error) {
        console.error(`Failed to copy attachment ${sourceAtt.id}:`, error);
      }
    }

    // Update target node with attachments
    if (copiedAttachments.length > 0) {
      const targetNode = await this.nodeRepo.findOne({ 
        where: { id: targetNodeId, deletedAt: null } 
      });
      
      if (targetNode) {
        const metadata = targetNode.metadata as any;
        metadata.attachments = [...(metadata.attachments || []), ...copiedAttachments];
        targetNode.metadata = metadata;
        await this.nodeRepo.save(targetNode);
      }
    }

    return copiedAttachments;
  }

  async cleanupOrphanedFiles(): Promise<number> {
    let cleaned = 0;
    
    try {
      // Get all nodes with attachments
      const nodes = await this.nodeRepo
        .createQueryBuilder('node')
        .where('node.deletedAt IS NULL')
        .andWhere("node.metadata->>'attachments' IS NOT NULL")
        .getMany();

      // Collect all valid attachment paths
      const validPaths = new Set<string>();
      for (const node of nodes) {
        const metadata = node.metadata as any;
        const attachments = metadata.attachments || [];
        attachments.forEach((att: Attachment) => {
          validPaths.add(att.path);
        });
      }

      // Walk through storage directory
      await this.walkDirectory(this.storagePath, async (filePath) => {
        if (!validPaths.has(filePath)) {
          try {
            await fs.unlink(filePath);
            cleaned++;
          } catch (error) {
            console.error(`Failed to delete orphaned file ${filePath}:`, error);
          }
        }
      });
    } catch (error) {
      console.error('Failed to cleanup orphaned files:', error);
    }

    return cleaned;
  }

  private validateFile(file: Express.Multer.File): void {
    // Check file size
    if (file.size > this.maxFileSize) {
      throw new ApiError(
        `File size exceeds maximum allowed size of ${this.maxFileSize} bytes`,
        413
      );
    }

    // Check MIME type
    if (!this.allowedMimeTypes.has(file.mimetype)) {
      throw new ApiError(
        `File type ${file.mimetype} is not allowed`,
        415
      );
    }

    // Additional validation for file extension
    const ext = path.extname(file.originalname).toLowerCase();
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.js'];
    
    if (dangerousExtensions.includes(ext)) {
      throw new ApiError('Potentially dangerous file type not allowed', 415);
    }
  }

  private async calculateFileHash(buffer: Buffer): Promise<string> {
    const hash = crypto.createHash('sha256');
    hash.update(buffer);
    return hash.digest('hex');
  }

  private async findAttachmentByHash(
    nodeId: string,
    hash: string
  ): Promise<Attachment | null> {
    const attachments = await this.getNodeAttachments(nodeId);
    return attachments.find(att => att.hash === hash) || null;
  }

  private async addAttachmentToNode(
    node: Node,
    attachment: Attachment
  ): Promise<void> {
    const metadata = node.metadata as any;
    const attachments = metadata.attachments || [];
    
    attachments.push(attachment);
    node.metadata = { ...metadata, attachments };
    
    await this.nodeRepo.save(node);
  }

  private async walkDirectory(
    dir: string,
    callback: (filePath: string) => Promise<void>
  ): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        await this.walkDirectory(fullPath, callback);
      } else if (entry.isFile()) {
        await callback(fullPath);
      }
    }
  }

  async getStorageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    byType: Record<string, { count: number; size: number }>;
  }> {
    const stats = {
      totalFiles: 0,
      totalSize: 0,
      byType: {} as Record<string, { count: number; size: number }>
    };

    // Get all nodes with attachments
    const nodes = await this.nodeRepo
      .createQueryBuilder('node')
      .where('node.deletedAt IS NULL')
      .andWhere("node.metadata->>'attachments' IS NOT NULL")
      .getMany();

    for (const node of nodes) {
      const metadata = node.metadata as any;
      const attachments = metadata.attachments || [];
      
      for (const att of attachments) {
        stats.totalFiles++;
        stats.totalSize += att.size;
        
        const ext = path.extname(att.originalName).toLowerCase() || 'unknown';
        if (!stats.byType[ext]) {
          stats.byType[ext] = { count: 0, size: 0 };
        }
        stats.byType[ext].count++;
        stats.byType[ext].size += att.size;
      }
    }

    return stats;
  }
}