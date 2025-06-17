import { Repository } from 'typeorm';
import { AppDataSource } from '../database/data-source';
import { Template } from '../database/entities/Template.entity';
import { NodeService } from './NodeService';
import { ApiError } from '../utils/errors';
import { EventEmitter } from 'events';

export class TemplateService extends EventEmitter {
  private templateRepo: Repository<Template>;
  private nodeService: NodeService;

  constructor() {
    super();
    this.templateRepo = AppDataSource.getRepository(Template);
    this.nodeService = new NodeService();
  }

  async getTemplates(): Promise<Template[]> {
    return this.templateRepo.find({
      order: {
        category: 'ASC',
        usageCount: 'DESC',
        name: 'ASC'
      }
    });
  }

  async getTemplateById(id: string): Promise<Template | null> {
    return this.templateRepo.findOne({ where: { id } });
  }

  async createTemplate(data: Partial<Template>): Promise<Template> {
    // Validate required fields
    if (!data.name || data.name.trim().length === 0) {
      throw new ApiError('Template name is required', 400);
    }

    if (!data.content || data.content.trim().length === 0) {
      throw new ApiError('Template content is required', 400);
    }

    // Extract fields from content
    const fields = this.extractFieldsFromContent(data.content);

    // Create template
    const template = await this.templateRepo.save({
      name: data.name.trim(),
      description: data.description,
      content: data.content,
      fields,
      category: data.category || 'General',
      icon: data.icon,
      createdBy: data.createdBy,
      usageCount: 0
    });

    // Emit event
    this.emit('template:created', template);

    return template;
  }

  async updateTemplate(id: string, updates: Partial<Template>): Promise<Template | null> {
    const template = await this.templateRepo.findOne({ where: { id } });
    
    if (!template) {
      return null;
    }

    // If content is updated, re-extract fields
    if (updates.content) {
      updates.fields = this.extractFieldsFromContent(updates.content);
    }

    // Update template
    const updatedTemplate = await this.templateRepo.save({
      ...template,
      ...updates,
      id // Ensure ID doesn't change
    });

    // Emit event
    this.emit('template:updated', updatedTemplate);

    return updatedTemplate;
  }

  async deleteTemplate(id: string): Promise<void> {
    const template = await this.templateRepo.findOne({ where: { id } });
    
    if (!template) {
      throw new ApiError('Template not found', 404);
    }

    await this.templateRepo.delete(id);

    // Emit event
    this.emit('template:deleted', { id });
  }

  async useTemplate(templateId: string, userId: string): Promise<any> {
    const template = await this.templateRepo.findOne({ where: { id: templateId } });
    
    if (!template) {
      throw new ApiError('Template not found', 404);
    }

    // Increment usage count
    await this.templateRepo.update(templateId, {
      usageCount: template.usageCount + 1
    });

    // Process template content
    let content = template.content;
    const metadata: any = {
      tags: [],
      author: userId,
      version: 1,
      templateId,
      templateName: template.name
    };

    // Replace template variables with defaults
    template.fields.forEach(field => {
      const placeholder = `{{${field}}}`;
      let defaultValue = '';
      
      // Set smart defaults based on field name
      switch (field.toLowerCase()) {
        case 'date':
        case 'today':
          defaultValue = new Date().toLocaleDateString();
          break;
        case 'time':
          defaultValue = new Date().toLocaleTimeString();
          break;
        case 'title':
          defaultValue = `New ${template.name}`;
          break;
        case 'author':
        case 'user':
          defaultValue = userId;
          break;
        default:
          defaultValue = `[${field}]`;
      }
      
      content = content.replace(new RegExp(placeholder, 'g'), defaultValue);
    });

    // Extract title from content
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : `New ${template.name}`;

    // Create node from template
    const node = await this.nodeService.createNode({
      title,
      content,
      type: template.category === 'Meeting Notes' ? 'note' : 'document',
      metadata
    });

    // Emit event
    this.emit('template:used', { template, node });

    return node;
  }

  private extractFieldsFromContent(content: string): string[] {
    const fieldPattern = /\{\{(\w+)\}\}/g;
    const fields = new Set<string>();
    
    let match;
    while ((match = fieldPattern.exec(content)) !== null) {
      fields.add(match[1]);
    }
    
    return Array.from(fields);
  }
}