// Export GraphQL schema and type definitions
export { typeDefs } from './schema';
export { customScalars, DateScalar, JSONScalar } from './scalars';

// Export resolvers
export { createResolvers } from './resolvers';
export { nodeResolvers } from './resolvers/nodeResolvers';
export { relationshipResolvers } from './resolvers/relationshipResolvers';
export { searchResolvers } from './resolvers/searchResolvers';
export { analyticsResolvers } from './resolvers/analyticsResolvers';
export { mutationResolvers } from './resolvers/mutationResolvers';
export { subscriptionResolvers } from './resolvers/subscriptionResolvers';

// Export server utilities
export {
  createGraphQLServer,
  startGraphQLServer,
  registerGraphQLWithAlexandria
} from './server';

// Export types
export interface GraphQLServerConfig {
  port?: number;
  path?: string;
  subscriptions?: boolean;
  playground?: boolean;
  introspection?: boolean;
  cors?: {
    origin?: string | string[];
    credentials?: boolean;
  };
}

// Default GraphQL configuration
export const defaultGraphQLConfig: GraphQLServerConfig = {
  port: 4000,
  path: '/graphql',
  subscriptions: true,
  playground: process.env.NODE_ENV !== 'production',
  introspection: process.env.NODE_ENV !== 'production',
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:4000'],
    credentials: true
  }
};