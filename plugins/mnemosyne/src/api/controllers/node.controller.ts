import { Request, Response, NextFunction } from 'express';
import { NodeService } from '../../services/NodeService';
import { ApiError } from '../../utils/errors';
import { NodeType } from '../../database/entities/Node.entity';

export class NodeController {
  private nodeService: NodeService;

  constructor() {
    this.nodeService = new NodeService();
  }

  // Helper for async route handling
  private asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => 
    (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };

  getNodes = this.asyncHandler(async (req: Request, res: Response) => {
    const { parentId, type } = req.query;
    
    const nodes = await this.nodeService.getNodes({
      parentId: parentId as string,
      type: type as NodeType
    });
    
    res.json(nodes);
  });

  getRecentNodes = this.asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 10;
    
    const nodes = await this.nodeService.getRecentNodes(limit);
    
    res.json(nodes);
  });

  getNode = this.asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    const node = await this.nodeService.getNodeById(id);
    
    if (!node) {
      throw new ApiError('Node not found', 404);
    }
    
    res.json(node);
  });

  createNode = this.asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id || 'anonymous';
    const nodeData = req.body;
    
    const node = await this.nodeService.createNode({
      ...nodeData,
      metadata: {
        tags: nodeData.tags || [],
        author: userId,
        version: 1
      }
    });
    
    res.status(201).json(node);
  });

  updateNode = this.asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates = req.body;
    
    const node = await this.nodeService.updateNode(id, updates);
    
    if (!node) {
      throw new ApiError('Node not found', 404);
    }
    
    res.json(node);
  });

  deleteNode = this.asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    await this.nodeService.deleteNode(id);
    
    res.status(204).send();
  });

  moveNode = this.asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { parentId } = req.body;
    
    const node = await this.nodeService.moveNode(id, parentId);
    
    if (!node) {
      throw new ApiError('Node not found', 404);
    }
    
    res.json(node);
  });

  getNodePath = this.asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    const path = await this.nodeService.getNodePath(id);
    
    res.json(path);
  });

  getNodeTree = this.asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const maxDepth = parseInt(req.query.depth as string) || 3;
    
    const tree = await this.nodeService.getNodeTree(id, maxDepth);
    
    res.json(tree);
  });

  getTags = this.asyncHandler(async (req: Request, res: Response) => {
    const tags = await this.nodeService.getTags();
    
    res.json(tags);
  });

  renameTag = this.asyncHandler(async (req: Request, res: Response) => {
    const { oldName, newName } = req.body;
    
    if (!oldName || !newName) {
      throw new ApiError('Both oldName and newName are required', 400);
    }
    
    await this.nodeService.renameTag(oldName, newName);
    
    res.json({ message: 'Tag renamed successfully' });
  });

  getGraphData = this.asyncHandler(async (req: Request, res: Response) => {
    const { nodeId } = req.query;
    const depth = parseInt(req.query.depth as string) || 2;
    
    const graphData = await this.nodeService.getGraphData(
      nodeId as string,
      depth
    );
    
    res.json(graphData);
  });

  importData = this.asyncHandler(async (req: Request, res: Response) => {
    const { format } = req.body;
    const file = (req as any).file;
    
    if (!file) {
      throw new ApiError('No file uploaded', 400);
    }
    
    const userId = (req as any).user?.id || 'anonymous';
    const result = await this.nodeService.importData(
      file.buffer,
      format,
      userId
    );
    
    res.json(result);
  });

  exportData = this.asyncHandler(async (req: Request, res: Response) => {
    const { format, nodeIds, includeAttachments, includeHistory } = req.body;
    
    const data = await this.nodeService.exportData({
      format,
      nodeIds,
      includeAttachments,
      includeHistory
    });
    
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=mnemosyne-export-${Date.now()}.${format}`
    );
    
    res.send(data);
  });
}