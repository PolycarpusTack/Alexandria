import { Request, Response, NextFunction } from 'express';
import { AttachmentService } from '../../services/AttachmentService';
import { ApiError } from '../../utils/errors';
import multer from 'multer';

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MNEMOSYNE_MAX_FILE_SIZE || '10485760'), // 10MB default
    files: 5 // Max 5 files per request
  }
});

export class AttachmentController {
  private attachmentService: AttachmentService;
  public uploadMiddleware: multer.Multer;

  constructor() {
    this.attachmentService = new AttachmentService();
    this.uploadMiddleware = upload;
  }

  private asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => 
    (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };

  uploadAttachment = this.asyncHandler(async (req: Request, res: Response) => {
    const { nodeId } = req.params;
    const userId = (req as any).user?.id || 'anonymous';
    const file = req.file;

    if (!file) {
      throw new ApiError('No file provided', 400);
    }

    const attachment = await this.attachmentService.uploadAttachment(
      nodeId,
      file,
      userId
    );

    res.status(201).json(attachment);
  });

  uploadMultipleAttachments = this.asyncHandler(async (req: Request, res: Response) => {
    const { nodeId } = req.params;
    const userId = (req as any).user?.id || 'anonymous';
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      throw new ApiError('No files provided', 400);
    }

    const attachments = await Promise.all(
      files.map(file => 
        this.attachmentService.uploadAttachment(nodeId, file, userId)
      )
    );

    res.status(201).json(attachments);
  });

  getNodeAttachments = this.asyncHandler(async (req: Request, res: Response) => {
    const { nodeId } = req.params;
    
    const attachments = await this.attachmentService.getNodeAttachments(nodeId);
    res.json(attachments);
  });

  getAttachment = this.asyncHandler(async (req: Request, res: Response) => {
    const { nodeId, attachmentId } = req.params;
    
    const attachment = await this.attachmentService.getAttachment(nodeId, attachmentId);
    
    if (!attachment) {
      throw new ApiError('Attachment not found', 404);
    }
    
    res.json(attachment);
  });

  downloadAttachment = this.asyncHandler(async (req: Request, res: Response) => {
    const { nodeId, attachmentId } = req.params;
    
    const { stream, attachment } = await this.attachmentService.downloadAttachment(
      nodeId,
      attachmentId
    );

    // Set appropriate headers
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Length', attachment.size);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(attachment.originalName)}"`
    );

    // Stream the file
    stream.pipe(res);
  });

  viewAttachment = this.asyncHandler(async (req: Request, res: Response) => {
    const { nodeId, attachmentId } = req.params;
    
    const { stream, attachment } = await this.attachmentService.downloadAttachment(
      nodeId,
      attachmentId
    );

    // Set appropriate headers for inline viewing
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Length', attachment.size);
    
    // Use inline disposition for viewable types
    const viewableTypes = ['image/', 'text/', 'application/pdf'];
    const isViewable = viewableTypes.some(type => attachment.mimeType.startsWith(type));
    
    if (isViewable) {
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(attachment.originalName)}"`
      );
    } else {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(attachment.originalName)}"`
      );
    }

    // Stream the file
    stream.pipe(res);
  });

  deleteAttachment = this.asyncHandler(async (req: Request, res: Response) => {
    const { nodeId, attachmentId } = req.params;
    
    await this.attachmentService.deleteAttachment(nodeId, attachmentId);
    res.status(204).send();
  });

  copyAttachments = this.asyncHandler(async (req: Request, res: Response) => {
    const { sourceNodeId, targetNodeId } = req.body;
    const userId = (req as any).user?.id || 'anonymous';

    if (!sourceNodeId || !targetNodeId) {
      throw new ApiError('Both sourceNodeId and targetNodeId are required', 400);
    }

    const attachments = await this.attachmentService.copyAttachments(
      sourceNodeId,
      targetNodeId,
      userId
    );

    res.json(attachments);
  });

  getStorageStats = this.asyncHandler(async (req: Request, res: Response) => {
    const stats = await this.attachmentService.getStorageStats();
    res.json(stats);
  });

  cleanupOrphaned = this.asyncHandler(async (req: Request, res: Response) => {
    const cleaned = await this.attachmentService.cleanupOrphanedFiles();
    res.json({ 
      message: `Cleaned up ${cleaned} orphaned files`,
      count: cleaned 
    });
  });
}