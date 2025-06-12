import { MnemosyneContext } from '../../types/MnemosyneContext';
import { NodeService } from '../../services/implementations/NodeService';
import { RelationshipService } from '../../services/implementations/RelationshipService';

export const mutationResolvers = {
  // Node mutations
  createNode: async (parent: any, args: { input: any }, context: { mnemosyne: MnemosyneContext }) => {
    try {
      const nodeService = new NodeService(context.mnemosyne);
      const nodeData = {
        title: args.input.title,
        content: args.input.content,
        type: args.input.type,
        tags: args.input.tags || [],
        metadata: args.input.metadata || {},
        parentId: args.input.parentId
      };

      const node = await nodeService.createNode(nodeData);
      
      return {
        success: true,
        node,
        errors: []
      };
    } catch (error) {
      context.mnemosyne.logger.error('Failed to create node', { error });
      return {
        success: false,
        node: null,
        errors: [{
          field: 'general',
          message: error.message || 'Failed to create node',
          code: 'CREATE_FAILED'
        }]
      };
    }
  },

  updateNode: async (parent: any, args: { id: string; input: any }, context: { mnemosyne: MnemosyneContext }) => {
    try {
      const nodeService = new NodeService(context.mnemosyne);
      const updateData = {
        title: args.input.title,
        content: args.input.content,
        type: args.input.type,
        tags: args.input.tags,
        metadata: args.input.metadata,
        parentId: args.input.parentId
      };

      const node = await nodeService.updateNode(args.id, updateData);
      
      return {
        success: true,
        node,
        errors: []
      };
    } catch (error) {
      context.mnemosyne.logger.error('Failed to update node', { error });
      return {
        success: false,
        node: null,
        errors: [{
          field: 'general',
          message: error.message || 'Failed to update node',
          code: 'UPDATE_FAILED'
        }]
      };
    }
  },

  deleteNode: async (parent: any, args: { id: string }, context: { mnemosyne: MnemosyneContext }) => {
    try {
      const nodeService = new NodeService(context.mnemosyne);
      await nodeService.deleteNode(args.id);
      
      return {
        success: true,
        node: null,
        errors: []
      };
    } catch (error) {
      context.mnemosyne.logger.error('Failed to delete node', { error });
      return {
        success: false,
        node: null,
        errors: [{
          field: 'general',
          message: error.message || 'Failed to delete node',
          code: 'DELETE_FAILED'
        }]
      };
    }
  },

  restoreNode: async (parent: any, args: { id: string }, context: { mnemosyne: MnemosyneContext }) => {
    try {
      const nodeService = new NodeService(context.mnemosyne);
      const node = await nodeService.restoreNode(args.id);
      
      return {
        success: true,
        node,
        errors: []
      };
    } catch (error) {
      context.mnemosyne.logger.error('Failed to restore node', { error });
      return {
        success: false,
        node: null,
        errors: [{
          field: 'general',
          message: error.message || 'Failed to restore node',
          code: 'RESTORE_FAILED'
        }]
      };
    }
  },

  duplicateNode: async (parent: any, args: { id: string; title?: string }, context: { mnemosyne: MnemosyneContext }) => {
    try {
      const nodeService = new NodeService(context.mnemosyne);
      const node = await nodeService.duplicateNode(args.id, args.title);
      
      return {
        success: true,
        node,
        errors: []
      };
    } catch (error) {
      context.mnemosyne.logger.error('Failed to duplicate node', { error });
      return {
        success: false,
        node: null,
        errors: [{
          field: 'general',
          message: error.message || 'Failed to duplicate node',
          code: 'DUPLICATE_FAILED'
        }]
      };
    }
  },

  // Relationship mutations
  createRelationship: async (parent: any, args: { input: any }, context: { mnemosyne: MnemosyneContext }) => {
    try {
      const relationshipService = new RelationshipService(context.mnemosyne);
      const relationshipData = {
        sourceId: args.input.sourceId,
        targetId: args.input.targetId,
        type: args.input.type,
        weight: args.input.weight || 1.0,
        bidirectional: args.input.bidirectional || false,
        metadata: args.input.metadata || {}
      };

      const relationship = await relationshipService.createRelationship(relationshipData);
      
      return {
        success: true,
        relationship,
        errors: []
      };
    } catch (error) {
      context.mnemosyne.logger.error('Failed to create relationship', { error });
      return {
        success: false,
        relationship: null,
        errors: [{
          field: 'general',
          message: error.message || 'Failed to create relationship',
          code: 'CREATE_FAILED'
        }]
      };
    }
  },

  updateRelationship: async (parent: any, args: { id: string; input: any }, context: { mnemosyne: MnemosyneContext }) => {
    try {
      const relationshipService = new RelationshipService(context.mnemosyne);
      const updateData = {
        type: args.input.type,
        weight: args.input.weight,
        bidirectional: args.input.bidirectional,
        metadata: args.input.metadata
      };

      const relationship = await relationshipService.updateRelationship(args.id, updateData);
      
      return {
        success: true,
        relationship,
        errors: []
      };
    } catch (error) {
      context.mnemosyne.logger.error('Failed to update relationship', { error });
      return {
        success: false,
        relationship: null,
        errors: [{
          field: 'general',
          message: error.message || 'Failed to update relationship',
          code: 'UPDATE_FAILED'
        }]
      };
    }
  },

  deleteRelationship: async (parent: any, args: { id: string }, context: { mnemosyne: MnemosyneContext }) => {
    try {
      const relationshipService = new RelationshipService(context.mnemosyne);
      await relationshipService.deleteRelationship(args.id);
      
      return {
        success: true,
        relationship: null,
        errors: []
      };
    } catch (error) {
      context.mnemosyne.logger.error('Failed to delete relationship', { error });
      return {
        success: false,
        relationship: null,
        errors: [{
          field: 'general',
          message: error.message || 'Failed to delete relationship',
          code: 'DELETE_FAILED'
        }]
      };
    }
  },

  // Bulk operations (simplified implementations)
  bulkCreateNodes: async (parent: any, args: { input: any }, context: { mnemosyne: MnemosyneContext }) => {
    try {
      const nodeService = new NodeService(context.mnemosyne);
      const nodes = await nodeService.bulkCreateNodes(args.input.nodes);
      
      return {
        success: true,
        nodes,
        successCount: nodes.length,
        errors: []
      };
    } catch (error) {
      context.mnemosyne.logger.error('Failed to bulk create nodes', { error });
      return {
        success: false,
        nodes: [],
        successCount: 0,
        errors: [{
          field: 'general',
          message: error.message || 'Failed to bulk create nodes',
          code: 'BULK_CREATE_FAILED'
        }]
      };
    }
  },

  bulkUpdateNodes: async (parent: any, args: { input: any }, context: { mnemosyne: MnemosyneContext }) => {
    try {
      const nodeService = new NodeService(context.mnemosyne);
      const nodes = await nodeService.bulkUpdateNodes(args.input.updates);
      
      return {
        success: true,
        nodes,
        successCount: nodes.length,
        errors: []
      };
    } catch (error) {
      context.mnemosyne.logger.error('Failed to bulk update nodes', { error });
      return {
        success: false,
        nodes: [],
        successCount: 0,
        errors: [{
          field: 'general',
          message: error.message || 'Failed to bulk update nodes',
          code: 'BULK_UPDATE_FAILED'
        }]
      };
    }
  },

  bulkDeleteNodes: async (parent: any, args: { ids: string[] }, context: { mnemosyne: MnemosyneContext }) => {
    try {
      const nodeService = new NodeService(context.mnemosyne);
      await nodeService.bulkDeleteNodes(args.ids);
      
      return {
        success: true,
        nodes: [],
        successCount: args.ids.length,
        errors: []
      };
    } catch (error) {
      context.mnemosyne.logger.error('Failed to bulk delete nodes', { error });
      return {
        success: false,
        nodes: [],
        successCount: 0,
        errors: [{
          field: 'general',
          message: error.message || 'Failed to bulk delete nodes',
          code: 'BULK_DELETE_FAILED'
        }]
      };
    }
  }
};