import { Router } from 'express';
import { DatabaseRelationshipService } from '../../services/DatabaseRelationshipService';
import { DatabaseAdapterFactory } from '../../services/DatabaseAdapter';
import { validateRequest, relationshipValidationSchemas } from '../../middleware/validation';

const router = Router();

// Get database connection from request context (will be set by middleware)
let relationshipService: DatabaseRelationshipService | null = null;

// Middleware to initialize service with database connection
router.use(async (req, res, next) => {
  try {
    if (!relationshipService) {
      // Try to get database connection from various sources
      let dbConnection = null;
      
      if (req.app.locals.mnemosyneDbConnection) {
        dbConnection = req.app.locals.mnemosyneDbConnection;
      } else if (req.app.locals.dataService) {
        dbConnection = DatabaseAdapterFactory.createFromDataService(req.app.locals.dataService);
      } else if (req.app.locals.alexandriaContext) {
        dbConnection = DatabaseAdapterFactory.createFromAlexandriaContext(req.app.locals.alexandriaContext);
      } else {
        // Fallback to direct connection
        dbConnection = await DatabaseAdapterFactory.createDirectConnection();
      }
      
      relationshipService = new DatabaseRelationshipService(dbConnection);
    }
    next();
  } catch (error) {
    console.error('Failed to initialize database connection:', error);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// GET /api/mnemosyne/relationships - List all relationships with optional filtering
router.get('/', async (req, res) => {
  try {
    const {
      source,
      target,
      type,
      minWeight,
      maxWeight,
      bidirectional,
      limit = '50',
      offset = '0'
    } = req.query;

    const filters = {
      source: source as string,
      target: target as string,
      type: type as any,
      minWeight: minWeight ? parseFloat(minWeight as string) : undefined,
      maxWeight: maxWeight ? parseFloat(maxWeight as string) : undefined,
      bidirectional: bidirectional === 'true' ? true : bidirectional === 'false' ? false : undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    };

    const relationships = await relationshipService.searchRelationships(filters);
    res.json(relationships);
  } catch (error) {
    console.error('Error fetching relationships:', error);
    res.status(500).json({ error: 'Failed to fetch relationships' });
  }
});

// GET /api/mnemosyne/relationships/:id - Get single relationship by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const relationship = await relationshipService.getRelationshipById(id);
    
    if (!relationship) {
      return res.status(404).json({ error: 'Relationship not found' });
    }
    
    res.json(relationship);
  } catch (error) {
    console.error('Error fetching relationship:', error);
    res.status(500).json({ error: 'Failed to fetch relationship' });
  }
});

// GET /api/mnemosyne/relationships/node/:nodeId - Get all relationships for a node
router.get('/node/:nodeId', async (req, res) => {
  try {
    const { nodeId } = req.params;
    const relationships = await relationshipService.getRelationshipsByNode(nodeId);
    res.json(relationships);
  } catch (error) {
    console.error('Error fetching node relationships:', error);
    res.status(500).json({ error: 'Failed to fetch node relationships' });
  }
});

// GET /api/mnemosyne/relationships/node/:nodeId/subgraph - Get subgraph for a node
router.get('/node/:nodeId/subgraph', async (req, res) => {
  try {
    const { nodeId } = req.params;
    const {
      depth = '2',
      maxNodes = '50',
      includeTypes,
      excludeTypes,
      minWeight = '0'
    } = req.query;

    const options = {
      depth: parseInt(depth as string),
      maxNodes: parseInt(maxNodes as string),
      includeTypes: includeTypes ? (Array.isArray(includeTypes) ? includeTypes as string[] : [includeTypes as string]) : undefined,
      excludeTypes: excludeTypes ? (Array.isArray(excludeTypes) ? excludeTypes as string[] : [excludeTypes as string]) : undefined,
      minWeight: parseFloat(minWeight as string)
    };

    const subgraph = await relationshipService.getSubgraph(nodeId, options);
    res.json(subgraph);
  } catch (error) {
    console.error('Error fetching subgraph:', error);
    res.status(500).json({ error: 'Failed to fetch subgraph' });
  }
});

// GET /api/mnemosyne/relationships/path - Find path between two nodes
router.get('/path', async (req, res) => {
  try {
    const {
      source,
      target,
      maxDepth = '5',
      algorithm = 'shortest',
      includeTypes,
      excludeTypes
    } = req.query;

    if (!source || !target) {
      return res.status(400).json({ error: 'Source and target parameters are required' });
    }

    const options = {
      maxDepth: parseInt(maxDepth as string),
      algorithm: algorithm as 'shortest' | 'weighted',
      includeTypes: includeTypes ? (Array.isArray(includeTypes) ? includeTypes as string[] : [includeTypes as string]) : undefined,
      excludeTypes: excludeTypes ? (Array.isArray(excludeTypes) ? excludeTypes as string[] : [excludeTypes as string]) : undefined
    };

    const path = await relationshipService.findPath(source as string, target as string, options);
    res.json({ path });
  } catch (error) {
    console.error('Error finding path:', error);
    res.status(500).json({ error: 'Failed to find path' });
  }
});

// GET /api/mnemosyne/relationships/connected - Check if two nodes are connected
router.get('/connected', async (req, res) => {
  try {
    const { source, target, maxDepth = '3' } = req.query;

    if (!source || !target) {
      return res.status(400).json({ error: 'Source and target parameters are required' });
    }

    const connected = await relationshipService.areNodesConnected(
      source as string, 
      target as string, 
      parseInt(maxDepth as string)
    );
    
    res.json({ connected });
  } catch (error) {
    console.error('Error checking connection:', error);
    res.status(500).json({ error: 'Failed to check connection' });
  }
});

// GET /api/mnemosyne/relationships/suggestions/:nodeId - Get relationship suggestions for a node
router.get('/suggestions/:nodeId', async (req, res) => {
  try {
    const { nodeId } = req.params;
    const { limit = '5' } = req.query;

    const suggestions = await relationshipService.suggestRelationships(
      nodeId, 
      parseInt(limit as string)
    );
    
    res.json(suggestions);
  } catch (error) {
    console.error('Error getting relationship suggestions:', error);
    res.status(500).json({ error: 'Failed to get relationship suggestions' });
  }
});

// GET /api/mnemosyne/relationships/network/metrics - Get network metrics
router.get('/network/metrics', async (req, res) => {
  try {
    const metrics = await relationshipService.getNetworkMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching network metrics:', error);
    res.status(500).json({ error: 'Failed to fetch network metrics' });
  }
});

// POST /api/mnemosyne/relationships - Create new relationship
router.post('/', validateRequest(relationshipValidationSchemas.create), async (req, res) => {
  try {
    const relationshipData = {
      source: req.body.source,
      target: req.body.target,
      type: req.body.type,
      weight: req.body.weight || 1.0,
      bidirectional: req.body.bidirectional || false,
      strength: req.body.strength || 1.0,
      description: req.body.description,
      created_by: req.user?.id,
      properties: req.body.properties || {}
    };

    const relationship = await relationshipService!.createRelationship(relationshipData);
    res.status(201).json(relationship);
  } catch (error) {
    console.error('Error creating relationship:', error);
    if (error.message.includes('Cannot create relationship to self')) {
      res.status(400).json({ error: 'Cannot create relationship to self' });
    } else if (error.message.includes('already exists')) {
      res.status(409).json({ error: 'Relationship already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create relationship' });
    }
  }
});

// POST /api/mnemosyne/connections - Alias for creating relationships (for UI compatibility)
router.post('/connections', async (req, res) => {
  try {
    const { source, target, type, strength = 1.0 } = req.body;
    
    if (!source || !target || !type) {
      return res.status(400).json({ 
        error: 'Missing required fields: source, target, type' 
      });
    }

    const relationshipData = {
      source,
      target,
      type,
      weight: strength,
      bidirectional: false
    };

    const relationship = await relationshipService.createRelationship(relationshipData);
    res.status(201).json(relationship);
  } catch (error) {
    console.error('Error creating connection:', error);
    res.status(500).json({ error: 'Failed to create connection' });
  }
});

// PUT /api/mnemosyne/relationships/:id - Update relationship
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const relationship = await relationshipService.updateRelationship(id, updates);
    
    if (!relationship) {
      return res.status(404).json({ error: 'Relationship not found' });
    }
    
    res.json(relationship);
  } catch (error) {
    console.error('Error updating relationship:', error);
    res.status(500).json({ error: 'Failed to update relationship' });
  }
});

// DELETE /api/mnemosyne/relationships/:id - Delete relationship
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await relationshipService.deleteRelationship(id);
    
    if (!success) {
      return res.status(404).json({ error: 'Relationship not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting relationship:', error);
    res.status(500).json({ error: 'Failed to delete relationship' });
  }
});

// POST /api/mnemosyne/relationships/bulk - Create multiple relationships
router.post('/bulk', async (req, res) => {
  try {
    const { relationships } = req.body;
    
    if (!Array.isArray(relationships)) {
      return res.status(400).json({ error: 'Expected array of relationships' });
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < relationships.length; i++) {
      try {
        const relationshipData = relationships[i];
        
        // Basic validation
        if (!relationshipData.source || !relationshipData.target || !relationshipData.type) {
          errors.push({ index: i, error: 'Missing required fields: source, target, type' });
          continue;
        }

        // Prevent self-relationships
        if (relationshipData.source === relationshipData.target) {
          errors.push({ index: i, error: 'Cannot create relationship to self' });
          continue;
        }

        const relationship = await relationshipService.createRelationship(relationshipData);
        results.push(relationship);
      } catch (error) {
        errors.push({ index: i, error: error.message });
      }
    }

    res.json({
      success: results.length,
      errors: errors.length,
      results,
      errors
    });
  } catch (error) {
    console.error('Error bulk creating relationships:', error);
    res.status(500).json({ error: 'Failed to bulk create relationships' });
  }
});

// PUT /api/mnemosyne/relationships/bulk - Update multiple relationships
router.put('/bulk', async (req, res) => {
  try {
    const { updates } = req.body;
    
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'Expected array of updates' });
    }

    const results = [];
    const errors = [];

    for (const update of updates) {
      try {
        if (!update.id) {
          errors.push({ update, error: 'Missing relationship ID' });
          continue;
        }

        const relationship = await relationshipService.updateRelationship(update.id, update);
        if (relationship) {
          results.push(relationship);
        } else {
          errors.push({ update, error: 'Relationship not found' });
        }
      } catch (error) {
        errors.push({ update, error: error.message });
      }
    }

    res.json({
      success: results.length,
      errors: errors.length,
      results,
      errors
    });
  } catch (error) {
    console.error('Error bulk updating relationships:', error);
    res.status(500).json({ error: 'Failed to bulk update relationships' });
  }
});

// DELETE /api/mnemosyne/relationships/bulk - Delete multiple relationships
router.delete('/bulk', async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!Array.isArray(ids)) {
      return res.status(400).json({ error: 'Expected array of relationship IDs' });
    }

    const results = [];
    const errors = [];

    for (const id of ids) {
      try {
        const success = await relationshipService.deleteRelationship(id);
        if (success) {
          results.push(id);
        } else {
          errors.push({ id, error: 'Relationship not found' });
        }
      } catch (error) {
        errors.push({ id, error: error.message });
      }
    }

    res.json({
      deleted: results.length,
      errors: errors.length,
      results,
      errors
    });
  } catch (error) {
    console.error('Error bulk deleting relationships:', error);
    res.status(500).json({ error: 'Failed to bulk delete relationships' });
  }
});

export default router;