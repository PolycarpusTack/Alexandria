import { MnemosyneContext } from '../../types/MnemosyneContext';
import { customScalars } from '../scalars';
import { nodeResolvers } from './nodeResolvers';
import { relationshipResolvers } from './relationshipResolvers';
import { searchResolvers } from './searchResolvers';
import { analyticsResolvers } from './analyticsResolvers';
import { mutationResolvers } from './mutationResolvers';
import { subscriptionResolvers } from './subscriptionResolvers';

/**
 * Create GraphQL resolvers with Mnemosyne context
 */
export function createResolvers(context: MnemosyneContext) {
  return {
    // Custom scalars
    ...customScalars,

    // Query resolvers
    Query: {
      // Node queries
      ...nodeResolvers.Query,
      
      // Relationship queries
      ...relationshipResolvers.Query,
      
      // Search queries
      ...searchResolvers.Query,
      
      // Analytics queries
      ...analyticsResolvers.Query,

      // Utility queries
      nodeTypes: () => [
        'DOCUMENT',
        'CONCEPT', 
        'PERSON',
        'PROJECT',
        'TASK',
        'NOTE',
        'REFERENCE',
        'CATEGORY',
        'TAG'
      ],
      
      relationshipTypes: () => [
        'REFERENCES',
        'RELATES_TO',
        'PART_OF',
        'DEPENDS_ON',
        'SIMILAR_TO',
        'CONTRADICTS',
        'SUPPORTS',
        'CREATED_BY',
        'MODIFIED_BY',
        'TAGGED_WITH',
        'CATEGORIZED_AS'
      ],
      
      tags: async (parent: any, args: any, contextWithServices: any) => {
        try {
          const nodeService = context.services.node;
          return await nodeService.getAllTags();
        } catch (error) {
          context.logger.error('Failed to fetch tags', { error });
          return [];
        }
      },
      
      recentNodes: async (parent: any, args: { limit?: number }, contextWithServices: any) => {
        try {
          const nodeService = context.services.node;
          const limit = args.limit || 10;
          return await nodeService.getRecentNodes(limit);
        } catch (error) {
          context.logger.error('Failed to fetch recent nodes', { error });
          return [];
        }
      },
      
      popularNodes: async (parent: any, args: { limit?: number }, contextWithServices: any) => {
        try {
          const nodeService = context.services.node;
          const limit = args.limit || 10;
          return await nodeService.getPopularNodes(limit);
        } catch (error) {
          context.logger.error('Failed to fetch popular nodes', { error });
          return [];
        }
      }
    },

    // Mutation resolvers
    Mutation: mutationResolvers,

    // Subscription resolvers
    Subscription: subscriptionResolvers,

    // Type resolvers
    Node: nodeResolvers.Node,
    Relationship: relationshipResolvers.Relationship,
    
    // Union and interface resolvers would go here if needed
  };
}

export default createResolvers;