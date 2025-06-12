import { MnemosyneContext } from '../../types/MnemosyneContext';
import { SearchService } from '../../services/implementations/SearchService';

export const searchResolvers = {
  Query: {
    search: async (
      parent: any, 
      args: { 
        query: string; 
        filters?: any; 
        pagination?: { offset?: number; limit?: number } 
      }, 
      context: { mnemosyne: MnemosyneContext }
    ) => {
      try {
        const searchService = new SearchService(context.mnemosyne);
        const startTime = Date.now();
        
        const searchOptions = {
          query: args.query,
          filters: {
            types: args.filters?.types,
            tags: args.filters?.tags,
            createdAfter: args.filters?.createdDate?.from,
            createdBefore: args.filters?.createdDate?.to,
            updatedAfter: args.filters?.updatedDate?.from,
            updatedBefore: args.filters?.updatedDate?.to
          },
          pagination: {
            offset: args.pagination?.offset || 0,
            limit: args.pagination?.limit || 20
          }
        };

        const searchResults = await searchService.search(searchOptions);
        const executionTime = (Date.now() - startTime) / 1000;

        // Transform results to GraphQL format
        const results = searchResults.nodes.map((node, index) => ({
          node,
          score: searchResults.scores?.[index] || 1.0,
          highlights: [{
            field: 'title',
            value: node.title
          }]
        }));

        return {
          results,
          totalCount: searchResults.totalCount,
          facets: {
            types: [],
            tags: [],
            dateRanges: []
          },
          query: args.query,
          executionTime
        };
      } catch (error) {
        context.mnemosyne.logger.error('Search failed', { query: args.query, error });
        return {
          results: [],
          totalCount: 0,
          facets: { types: [], tags: [], dateRanges: [] },
          query: args.query,
          executionTime: 0
        };
      }
    }
  }
};