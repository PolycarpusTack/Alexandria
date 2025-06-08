/**
 * Template Repository - Handles persistence of code templates
 */

import { DataService } from '../../../../core/data/interfaces';
import { Logger } from '../../../../utils/logger';
import { CodeTemplate } from '../interfaces';

export class TemplateRepository {
  private readonly COLLECTION_NAME = 'alfred_templates';

  constructor(
    private dataService: DataService,
    private logger: Logger
  ) {}

  async saveTemplate(template: CodeTemplate): Promise<void> {
    try {
      await this.dataService.upsert(this.COLLECTION_NAME, {
        id: template.id,
        ...this.serializeTemplate(template)
      });
    } catch (error) {
      this.logger.error('Failed to save template', { error, templateId: template.id });
      throw error;
    }
  }

  async getTemplate(templateId: string): Promise<CodeTemplate | null> {
    try {
      const data = await this.dataService.findOne(this.COLLECTION_NAME, {
        id: templateId
      });

      if (!data) {
        return null;
      }

      return this.deserializeTemplate(data);
    } catch (error) {
      this.logger.error('Failed to get template', { error, templateId });
      throw error;
    }
  }

  async getAllTemplates(): Promise<CodeTemplate[]> {
    try {
      const data = await this.dataService.find(this.COLLECTION_NAME, {});
      return data.map(item => this.deserializeTemplate(item));
    } catch (error) {
      this.logger.error('Failed to get all templates', { error });
      throw error;
    }
  }

  async getTemplatesByCategory(category: string): Promise<CodeTemplate[]> {
    try {
      const data = await this.dataService.find(this.COLLECTION_NAME, {
        category
      });
      return data.map(item => this.deserializeTemplate(item));
    } catch (error) {
      this.logger.error('Failed to get templates by category', { error, category });
      throw error;
    }
  }

  async getTemplatesByLanguage(language: string): Promise<CodeTemplate[]> {
    try {
      const data = await this.dataService.find(this.COLLECTION_NAME, {
        language
      });
      return data.map(item => this.deserializeTemplate(item));
    } catch (error) {
      this.logger.error('Failed to get templates by language', { error, language });
      throw error;
    }
  }

  async searchTemplates(query: string): Promise<CodeTemplate[]> {
    try {
      // Search in name, description, and tags
      const data = await this.dataService.find(this.COLLECTION_NAME, {
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { tags: { $in: [query.toLowerCase()] } }
        ]
      });
      
      return data.map(item => this.deserializeTemplate(item));
    } catch (error) {
      this.logger.error('Failed to search templates', { error, query });
      throw error;
    }
  }

  async deleteTemplate(templateId: string): Promise<void> {
    try {
      await this.dataService.delete(this.COLLECTION_NAME, {
        id: templateId
      });
    } catch (error) {
      this.logger.error('Failed to delete template', { error, templateId });
      throw error;
    }
  }

  async exportTemplates(templateIds?: string[]): Promise<string> {
    try {
      let templates: CodeTemplate[];
      
      if (templateIds && templateIds.length > 0) {
        const data = await this.dataService.find(this.COLLECTION_NAME, {
          id: { $in: templateIds }
        });
        templates = data.map(item => this.deserializeTemplate(item));
      } else {
        templates = await this.getAllTemplates();
      }

      return JSON.stringify({
        version: '1.0',
        exportDate: new Date().toISOString(),
        templates
      }, null, 2);
    } catch (error) {
      this.logger.error('Failed to export templates', { error });
      throw error;
    }
  }

  async importTemplates(jsonData: string): Promise<number> {
    try {
      const parsed = JSON.parse(jsonData);
      
      if (!parsed.templates || !Array.isArray(parsed.templates)) {
        throw new Error('Invalid import format');
      }

      let importedCount = 0;
      
      for (const templateData of parsed.templates) {
        // Remove id to create new one
        const { id, ...templateWithoutId } = templateData;
        
        // Create new template with new ID
        const newTemplate: CodeTemplate = {
          ...templateWithoutId,
          id: this.generateId(),
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await this.saveTemplate(newTemplate);
        importedCount++;
      }

      this.logger.info('Templates imported', { count: importedCount });
      return importedCount;
    } catch (error) {
      this.logger.error('Failed to import templates', { error });
      throw error;
    }
  }

  // Private helper methods

  private serializeTemplate(template: CodeTemplate): any {
    return {
      ...template,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString()
    };
  }

  private deserializeTemplate(data: any): CodeTemplate {
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt)
    };
  }

  private generateId(): string {
    return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}