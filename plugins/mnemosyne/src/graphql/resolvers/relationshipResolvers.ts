import { MnemosyneContext } from '../../types/MnemosyneContext';
import { RelationshipService } from '../../services/implementations/RelationshipService';
import { NodeService } from '../../services/implementations/NodeService';

export const relationshipResolvers = {
  Query: {
    relationship: async (parent: any, args: { id: string }, context: { mnemosyne: MnemosyneContext }) => {
      try {
        const relationshipService = new RelationshipService(context.mnemosyne);
        return await relationshipService.getRelationship(args.id);
      } catch (error) {
        context.mnemosyne.logger.error('Failed to fetch relationship', { relationshipId: args.id, error });
        return null;
      }
    },

    relationships: async (parent: any, args: any, context: { mnemosyne: MnemosyneContext }) => {
      try {
        const relationshipService = new RelationshipService(context.mnemosyne);
        const relationships = await relationshipService.getAllRelationships();
        
        return {
          relationships,
          totalCount: relationships.length,
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: null,
            endCursor: null
          }
        };
      } catch (error) {
        context.mnemosyne.logger.error('Failed to fetch relationships', { error });
        return {
          relationships: [],
          totalCount: 0,
          pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null }
        };
      }
    },

    shortestPath: async (parent: any, args: { sourceId: string; targetId: string }, context: { mnemosyne: MnemosyneContext }) => {
      try {
        const relationshipService = new RelationshipService(context.mnemosyne);
        return await relationshipService.findShortestPath(args.sourceId, args.targetId);
      } catch (error) {
        context.mnemosyne.logger.error('Failed to find shortest path', { error });
        return null;
      }
    },

    allPaths: async (parent: any, args: { sourceId: string; targetId: string; maxDepth?: number }, context: { mnemosyne: MnemosyneContext }) => {
      try {
        const relationshipService = new RelationshipService(context.mnemosyne);
        const maxDepth = args.maxDepth || 6;
        return await relationshipService.findAllPaths(args.sourceId, args.targetId, maxDepth);
      } catch (error) {
        context.mnemosyne.logger.error('Failed to find all paths', { error });
        return [];
      }
    },

    nodeNeighbors: async (parent: any, args: { nodeId: string; depth?: number }, context: { mnemosyne: MnemosyneContext }) => {
      try {
        const relationshipService = new RelationshipService(context.mnemosyne);
        const depth = args.depth || 2;
        const neighborGraph = await relationshipService.getNodeNeighbors(args.nodeId, depth);
        return neighborGraph.nodes.filter(node => node.id !== args.nodeId);
      } catch (error) {
        context.mnemosyne.logger.error('Failed to fetch node neighbors', { error });
        return [];
      }
    },

    nodeSubgraph: async (parent: any, args: { nodeId: string; radius?: number }, context: { mnemosyne: MnemosyneContext }) => {
      try {
        const relationshipService = new RelationshipService(context.mnemosyne);
        const nodeService = new NodeService(context.mnemosyne);
        const radius = args.radius || 2;
        
        const subgraph = await relationshipService.getSubgraph(args.nodeId, radius);
        const centerNode = await nodeService.getNode(args.nodeId);
        
        return {
          centerNode,
          nodes: subgraph.nodes,
          relationships: subgraph.relationships,
          radius
        };
      } catch (error) {
        context.mnemosyne.logger.error('Failed to fetch node subgraph', { error });
        return null;
      }
    },

    areNodesConnected: async (parent: any, args: { sourceId: string; targetId: string; maxDepth?: number }, context: { mnemosyne: MnemosyneContext }) => {
      try {
        const relationshipService = new RelationshipService(context.mnemosyne);
        const maxDepth = args.maxDepth || 6;
        return await relationshipService.areNodesConnected(args.sourceId, args.targetId, maxDepth);
      } catch (error) {
        context.mnemosyne.logger.error('Failed to check node connectivity', { error });
        return false;
      }
    }
  },

  Relationship: {
    source: async (parent: any, args: any, context: { mnemosyne: MnemosyneContext }) => {
      try {
        const nodeService = new NodeService(context.mnemosyne);
        return await nodeService.getNode(parent.sourceId);
      } catch (error) {
        context.mnemosyne.logger.error('Failed to fetch relationship source', { error });
        return null;
      }
    },

    target: async (parent: any, args: any, context: { mnemosyne: MnemosyneContext }) => {
      try {
        const nodeService = new NodeService(context.mnemosyne);
        return await nodeService.getNode(parent.targetId);
      } catch (error) {
        context.mnemosyne.logger.error('Failed to fetch relationship target', { error });
        return null;
      }
    },

    traversalCount: async (parent: any, args: any, context: { mnemosyne: MnemosyneContext }) => {
      // Placeholder for analytics data
      return parent.metadata?.traversalCount || 0;
    }
  }
};