import { Request, Response, NextFunction } from 'express';
import { ConnectionService } from '../../services/ConnectionService';
import { ApiError } from '../../utils/errors';

export class ConnectionController {
  private connectionService: ConnectionService;

  constructor() {
    this.connectionService = new ConnectionService();
  }

  private asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => 
    (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };

  getNodeConnections = this.asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const connections = await this.connectionService.getNodeConnections(id);
    res.json(connections);
  });

  createConnection = this.asyncHandler(async (req: Request, res: Response) => {
    const { sourceId, targetId, type, metadata } = req.body;
    
    if (!sourceId || !targetId) {
      throw new ApiError('Both sourceId and targetId are required', 400);
    }
    
    const connection = await this.connectionService.createConnection({
      sourceId,
      targetId,
      type,
      metadata
    });
    
    res.status(201).json(connection);
  });

  deleteConnection = this.asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    await this.connectionService.deleteConnection(id);
    res.status(204).send();
  });
}