import { Request, Response, NextFunction } from 'express';
import { TemplateService } from '../../services/TemplateService';
import { ApiError } from '../../utils/errors';

export class TemplateController {
  private templateService: TemplateService;

  constructor() {
    this.templateService = new TemplateService();
  }

  private asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => 
    (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };

  getTemplates = this.asyncHandler(async (req: Request, res: Response) => {
    const templates = await this.templateService.getTemplates();
    res.json(templates);
  });

  getTemplate = this.asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const template = await this.templateService.getTemplateById(id);
    
    if (!template) {
      throw new ApiError('Template not found', 404);
    }
    
    res.json(template);
  });

  createTemplate = this.asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const templateData = req.body;
    
    const template = await this.templateService.createTemplate({
      ...templateData,
      createdBy: userId
    });
    
    res.status(201).json(template);
  });

  updateTemplate = this.asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates = req.body;
    
    const template = await this.templateService.updateTemplate(id, updates);
    
    if (!template) {
      throw new ApiError('Template not found', 404);
    }
    
    res.json(template);
  });

  deleteTemplate = this.asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    await this.templateService.deleteTemplate(id);
    res.status(204).send();
  });

  useTemplate = this.asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req as any).user?.id || 'anonymous';
    
    const node = await this.templateService.useTemplate(id, userId);
    res.json(node);
  });
}