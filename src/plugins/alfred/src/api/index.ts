/**
 * Alfred Plugin API Routes
 */

import { Router } from 'express';
import { PluginContext } from '@alexandria/plugin-api';
import { 
  SendMessageRequest, 
  CreateSessionRequest, 
  GenerateCodeRequest 
} from '../interfaces';
import { AlfredService } from '../services/alfred-service';
import { ProjectAnalyzerService } from '../services/project-analyzer';
import { CodeGeneratorService } from '../services/code-generator';
import { TemplateManagerService } from '../services/template-manager';

export function setupRoutes(context: PluginContext): void {
  const router = Router();
  
  // Get services
  const alfredService = context.getService<AlfredService>('alfred');
  const projectAnalyzer = context.getService<ProjectAnalyzerService>('alfred-project-analyzer');
  const codeGenerator = context.getService<CodeGeneratorService>('alfred-code-generator');
  const templateManager = context.getService<TemplateManagerService>('alfred-template-manager');

  // Session endpoints
  router.post('/sessions', async (req, res, next) => {
    try {
      const { name, projectPath }: CreateSessionRequest = req.body;
      
      let projectContext;
      if (projectPath) {
        projectContext = await projectAnalyzer.analyzeProject(projectPath);
      }
      
      const session = await alfredService.createNewSession(projectContext);
      res.json(session);
    } catch (error) {
      next(error);
    }
  });

  router.get('/sessions', async (req, res, next) => {
    try {
      const sessions = await alfredService.getSessions();
      res.json(sessions);
    } catch (error) {
      next(error);
    }
  });

  router.get('/sessions/:id', async (req, res, next) => {
    try {
      const session = await alfredService.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      res.json(session);
    } catch (error) {
      next(error);
    }
  });

  router.post('/sessions/:id/messages', async (req, res, next) => {
    try {
      const { message }: SendMessageRequest = req.body;
      const response = await alfredService.sendMessage(req.params.id, message);
      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/sessions/:id', async (req, res, next) => {
    try {
      await alfredService.deleteSession(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  // Code generation endpoints
  router.post('/generate', async (req, res, next) => {
    try {
      const request: GenerateCodeRequest = req.body;
      const response = await codeGenerator.generateCode({
        templateId: request.templateId,
        prompt: request.prompt,
        context: {
          language: request.language,
          projectContext: await projectAnalyzer.analyzeCurrentProject()
        },
        variables: request.variables
      });
      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  router.post('/generate/preview', async (req, res, next) => {
    try {
      const request: GenerateCodeRequest = req.body;
      const preview = await codeGenerator.previewGeneration({
        templateId: request.templateId,
        prompt: request.prompt,
        context: {
          language: request.language
        },
        variables: request.variables
      });
      res.json({ code: preview });
    } catch (error) {
      next(error);
    }
  });

  // Template endpoints
  router.get('/templates', async (req, res, next) => {
    try {
      const templates = await templateManager.getTemplates();
      res.json(templates);
    } catch (error) {
      next(error);
    }
  });

  router.get('/templates/:id', async (req, res, next) => {
    try {
      const template = await templateManager.getTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      res.json(template);
    } catch (error) {
      next(error);
    }
  });

  router.post('/templates', async (req, res, next) => {
    try {
      const template = await templateManager.createTemplate(req.body);
      res.status(201).json(template);
    } catch (error) {
      next(error);
    }
  });

  router.put('/templates/:id', async (req, res, next) => {
    try {
      const template = await templateManager.updateTemplate(req.params.id, req.body);
      res.json(template);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/templates/:id', async (req, res, next) => {
    try {
      await templateManager.deleteTemplate(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.post('/templates/import', async (req, res, next) => {
    try {
      const { data } = req.body;
      const template = await templateManager.importTemplate(data);
      res.json(template);
    } catch (error) {
      next(error);
    }
  });

  router.get('/templates/:id/export', async (req, res, next) => {
    try {
      const data = await templateManager.exportTemplate(req.params.id);
      res.json({ data });
    } catch (error) {
      next(error);
    }
  });

  // Project analysis endpoints
  router.post('/analyze', async (req, res, next) => {
    try {
      const { projectPath } = req.body;
      const analysis = await projectAnalyzer.analyzeProject(projectPath);
      res.json(analysis);
    } catch (error) {
      next(error);
    }
  });

  router.get('/analyze/current', async (req, res, next) => {
    try {
      const analysis = await projectAnalyzer.analyzeCurrentProject();
      res.json(analysis);
    } catch (error) {
      next(error);
    }
  });

  // Register routes with the plugin context
  context.registerRoutes('/api/plugins/alfred', router);
}