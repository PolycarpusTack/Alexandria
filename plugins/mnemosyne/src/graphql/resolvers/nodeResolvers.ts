import { MnemosyneContext } from '../../types/MnemosyneContext';
import { NodeService } from '../../services/implementations/NodeService';
import { RelationshipService } from '../../services/implementations/RelationshipService';
import { 
  KnowledgeNode, 
  PaginationOptions, 
  NodeFilters, 
  NodeSortOptions 
} from '../../services/interfaces/NodeService';

/**
 * GraphQL resolvers for Node type and node-related queries
 */
export const nodeResolvers = {
  Query: {
    node: async (parent: any, args: { id: string }, context: { mnemosyne: MnemosyneContext }) => {
      try {
        const nodeService = new NodeService(context.mnemosyne);
        return await nodeService.getNode(args.id);
      } catch (error) {
        context.mnemosyne.logger.error('Failed to fetch node', { nodeId: args.id, error });
        return null;
      }
    },

    nodeBySlug: async (parent: any, args: { slug: string }, context: { mnemosyne: MnemosyneContext }) => {
      try {
        const nodeService = new NodeService(context.mnemosyne);
        return await nodeService.getNodeBySlug(args.slug);
      } catch (error) {
        context.mnemosyne.logger.error('Failed to fetch node by slug', { slug: args.slug, error });
        return null;
      }
    },

    nodes: async (
      parent: any, 
      args: {
        filters?: any;
        sort?: any;
        pagination?: PaginationOptions;
      }, 
      context: { mnemosyne: MnemosyneContext }
    ) => {
      try {
        const nodeService = new NodeService(context.mnemosyne);
        
        // Convert GraphQL input to service types
        const filters: NodeFilters = {
          types: args.filters?.types,
          tags: args.filters?.tags,
          createdAfter: args.filters?.createdDate?.from,
          createdBefore: args.filters?.createdDate?.to,
          updatedAfter: args.filters?.updatedDate?.from,
          updatedBefore: args.filters?.updatedDate?.to,
          searchQuery: args.filters?.searchQuery
        };

        const sortOptions: NodeSortOptions = args.sort ? {
          field: mapSortField(args.sort.field),
          order: args.sort.order?.toLowerCase() as 'asc' | 'desc'
        } : { field: 'updated_at', order: 'desc' };

        const pagination = args.pagination || { offset: 0, limit: 20 };

        const { nodes, totalCount } = await nodeService.listNodes(filters, sortOptions, pagination);

        return {
          nodes,
          totalCount,
          pageInfo: {
            hasNextPage: pagination.offset + pagination.limit < totalCount,
            hasPreviousPage: pagination.offset > 0,
            startCursor: pagination.offset.toString(),
            endCursor: (pagination.offset + nodes.length - 1).toString()
          }
        };
      } catch (error) {
        context.mnemosyne.logger.error('Failed to fetch nodes', { error });
        return {
          nodes: [],
          totalCount: 0,
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: null,
            endCursor: null
          }
        };
      }
    }
  },

  Node: {
    outgoingRelationships: async (
      parent: KnowledgeNode,
      args: {
        filters?: any;
        sort?: any;
        pagination?: PaginationOptions;
      },
      context: { mnemosyne: MnemosyneContext }
    ) => {
      try {
        const relationshipService = new RelationshipService(context.mnemosyne);
        const relationshipType = args.filters?.types?.[0];
        const relationships = await relationshipService.getOutgoingRelationships(parent.id, relationshipType);
        
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
        context.mnemosyne.logger.error('Failed to fetch outgoing relationships', { nodeId: parent.id, error });
        return {
          relationships: [],
          totalCount: 0,
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: null,
            endCursor: null
          }
        };
      }
    },

    incomingRelationships: async (
      parent: KnowledgeNode,
      args: {
        filters?: any;
        sort?: any;
        pagination?: PaginationOptions;
      },
      context: { mnemosyne: MnemosyneContext }
    ) => {
      try {
        const relationshipService = new RelationshipService(context.mnemosyne);
        const relationshipType = args.filters?.types?.[0];
        const relationships = await relationshipService.getIncomingRelationships(parent.id, relationshipType);
        
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
        context.mnemosyne.logger.error('Failed to fetch incoming relationships', { nodeId: parent.id, error });
        return {
          relationships: [],
          totalCount: 0,
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: null,
            endCursor: null
          }
        };
      }
    },

    allRelationships: async (
      parent: KnowledgeNode,
      args: {
        filters?: any;
        sort?: any;
        pagination?: PaginationOptions;
      },
      context: { mnemosyne: MnemosyneContext }
    ) => {
      try {
        const relationshipService = new RelationshipService(context.mnemosyne);
        const relationshipType = args.filters?.types?.[0];
        const relationships = await relationshipService.getNodeRelationships(parent.id, relationshipType);
        
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
        context.mnemosyne.logger.error('Failed to fetch all relationships', { nodeId: parent.id, error });
        return {
          relationships: [],
          totalCount: 0,
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: null,
            endCursor: null
          }
        };
      }
    },

    neighbors: async (
      parent: KnowledgeNode,
      args: { depth?: number },
      context: { mnemosyne: MnemosyneContext }
    ) => {
      try {
        const relationshipService = new RelationshipService(context.mnemosyne);
        const depth = args.depth || 1;
        const neighborGraph = await relationshipService.getNodeNeighbors(parent.id, depth);
        return neighborGraph.nodes.filter(node => node.id !== parent.id);
      } catch (error) {
        context.mnemosyne.logger.error('Failed to fetch node neighbors', { nodeId: parent.id, error });
        return [];
      }
    },

    shortestPathTo: async (
      parent: KnowledgeNode,
      args: { targetId: string },
      context: { mnemosyne: MnemosyneContext }
    ) => {
      try {
        const relationshipService = new RelationshipService(context.mnemosyne);
        return await relationshipService.findShortestPath(parent.id, args.targetId);
      } catch (error) {
        context.mnemosyne.logger.error('Failed to find shortest path', { 
          sourceId: parent.id, 
          targetId: args.targetId, 
          error 
        });
        return null;
      }
    },

    subgraph: async (
      parent: KnowledgeNode,
      args: { radius?: number },
      context: { mnemosyne: MnemosyneContext }
    ) => {
      try {
        const relationshipService = new RelationshipService(context.mnemosyne);
        const radius = args.radius || 2;
        const subgraph = await relationshipService.getSubgraph(parent.id, radius);
        
        return {
          centerNode: parent,
          nodes: subgraph.nodes,
          relationships: subgraph.relationships,
          radius
        };
      } catch (error) {
        context.mnemosyne.logger.error('Failed to fetch subgraph', { nodeId: parent.id, error });
        return {
          centerNode: parent,
          nodes: [parent],
          relationships: [],
          radius: args.radius || 2
        };
      }
    },

    suggestions: async (
      parent: KnowledgeNode,
      args: { limit?: number },
      context: { mnemosyne: MnemosyneContext }
    ) => {
      try {
        const relationshipService = new RelationshipService(context.mnemosyne);
        const limit = args.limit || 5;
        const suggestions = await relationshipService.suggestRelationships(parent.id, limit);
        
        // Extract suggested nodes (this is a simplified implementation)
        return suggestions.map(suggestion => suggestion.targetNode);
      } catch (error) {
        context.mnemosyne.logger.error('Failed to fetch node suggestions', { nodeId: parent.id, error });
        return [];
      }
    },

    parent: async (
      parent: KnowledgeNode,
      args: any,
      context: { mnemosyne: MnemosyneContext }
    ) => {
      try {
        const nodeService = new NodeService(context.mnemosyne);
        return await nodeService.getNodeParent(parent.id);
      } catch (error) {
        context.mnemosyne.logger.error('Failed to fetch node parent', { nodeId: parent.id, error });
        return null;
      }
    },

    children: async (
      parent: KnowledgeNode,
      args: any,
      context: { mnemosyne: MnemosyneContext }
    ) => {
      try {
        const nodeService = new NodeService(context.mnemosyne);
        return await nodeService.getNodeChildren(parent.id);
      } catch (error) {
        context.mnemosyne.logger.error('Failed to fetch node children', { nodeId: parent.id, error });
        return [];
      }
    },

    ancestors: async (
      parent: KnowledgeNode,
      args: any,
      context: { mnemosyne: MnemosyneContext }
    ) => {
      try {
        const nodeService = new NodeService(context.mnemosyne);
        return await nodeService.getNodeAncestors(parent.id);
      } catch (error) {
        context.mnemosyne.logger.error('Failed to fetch node ancestors', { nodeId: parent.id, error });
        return [];
      }
    },

    versions: async (
      parent: KnowledgeNode,
      args: any,
      context: { mnemosyne: MnemosyneContext }
    ) => {
      try {
        const nodeService = new NodeService(context.mnemosyne);
        return await nodeService.getNodeVersions(parent.id);
      } catch (error) {
        context.mnemosyne.logger.error('Failed to fetch node versions', { nodeId: parent.id, error });
        return [];
      }
    },

    currentVersion: async (
      parent: KnowledgeNode,
      args: any,
      context: { mnemosyne: MnemosyneContext }
    ) => {
      try {
        const nodeService = new NodeService(context.mnemosyne);
        const versions = await nodeService.getNodeVersions(parent.id);
        return versions.find(v => v.version === parent.version) || versions[0];
      } catch (error) {
        context.mnemosyne.logger.error('Failed to fetch current node version', { nodeId: parent.id, error });
        return null;
      }
    },

    connectionCount: async (
      parent: KnowledgeNode,
      args: any,
      context: { mnemosyne: MnemosyneContext }
    ) => {
      try {
        const relationshipService = new RelationshipService(context.mnemosyne);
        const relationships = await relationshipService.getNodeRelationships(parent.id);
        return relationships.length;
      } catch (error) {
        context.mnemosyne.logger.error('Failed to fetch connection count', { nodeId: parent.id, error });
        return 0;
      }
    },

    viewCount: async (
      parent: KnowledgeNode,
      args: any,
      context: { mnemosyne: MnemosyneContext }
    ) => {
      // This would come from analytics/metrics service
      // Placeholder implementation
      return parent.metadata?.viewCount || 0;
    },

    editCount: async (
      parent: KnowledgeNode,
      args: any,
      context: { mnemosyne: MnemosyneContext }
    ) => {
      // This would come from analytics/metrics service
      // Placeholder implementation
      return parent.version || 1;
    }
  }
};

/**
 * Map GraphQL sort field to service sort field
 */
function mapSortField(graphqlField: string): string {
  const fieldMap: { [key: string]: string } = {
    'TITLE': 'title',
    'CREATED_AT': 'created_at',
    'UPDATED_AT': 'updated_at',
    'TYPE': 'type',
    'RELEVANCE': 'relevance'
  };
  
  return fieldMap[graphqlField] || 'updated_at';
}