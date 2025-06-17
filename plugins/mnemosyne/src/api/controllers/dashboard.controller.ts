import { Request, Response } from 'express';
import { NodeService } from '../../services/NodeService';

export class DashboardController {
  private nodeService: NodeService;

  constructor() {
    this.nodeService = new NodeService();
  }

  getStats = async (req: Request, res: Response, next: Function) => {
    try {
      const stats = await this.nodeService.getDashboardStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  };
}