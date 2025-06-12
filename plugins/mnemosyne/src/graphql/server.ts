import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { json } from 'body-parser';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { makeExecutableSchema } from '@graphql-tools/schema';

import { typeDefs } from './schema';
import { createResolvers } from './resolvers';
import { MnemosyneContext } from '../types/MnemosyneContext';

/**
 * GraphQL server configuration
 */
interface GraphQLServerConfig {
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

/**
 * Create and configure Apollo GraphQL server
 */
export async function createGraphQLServer(
  context: MnemosyneContext,
  config: GraphQLServerConfig = {}
): Promise<{
  server: ApolloServer;
  app: express.Application;
  httpServer: any;
  wsServer?: WebSocketServer;
}> {
  const {
    port = 4000,
    path = '/graphql',
    subscriptions = true,
    playground = process.env.NODE_ENV !== 'production',
    introspection = process.env.NODE_ENV !== 'production',
    cors: corsConfig = { origin: '*', credentials: true }
  } = config;

  // Create Express app
  const app = express();
  const httpServer = createServer(app);

  // Create executable schema
  const schema = makeExecutableSchema({
    typeDefs,
    resolvers: createResolvers(context)
  });

  // WebSocket server for subscriptions
  let wsServer: WebSocketServer | undefined;
  let serverCleanup: (() => Promise<void>) | undefined;

  if (subscriptions) {
    wsServer = new WebSocketServer({
      server: httpServer,
      path: path
    });

    serverCleanup = useServer(
      {
        schema,
        context: async (ctx) => {
          // WebSocket context
          return {
            mnemosyne: context,
            connectionParams: ctx.connectionParams,
            user: null // Would be populated from authentication
          };
        },
        onConnect: async (ctx) => {
          context.logger.info('GraphQL WebSocket connection established');
        },
        onDisconnect: async (ctx) => {
          context.logger.info('GraphQL WebSocket connection closed');
        }
      },
      wsServer
    );
  }

  // Create Apollo Server
  const server = new ApolloServer({
    schema,
    introspection,
    plugins: [
      // Proper shutdown for the HTTP server
      ApolloServerPluginDrainHttpServer({ httpServer }),
      
      // Proper shutdown for the WebSocket server
      ...(serverCleanup ? [{
        async serverWillStart() {
          return {
            async drainServer() {
              if (serverCleanup) {
                await serverCleanup();
              }
            }
          };
        }
      }] : []),
      
      // Custom logging plugin
      {
        async requestDidStart() {
          return {
            async didResolveOperation(requestContext) {
              context.logger.debug('GraphQL operation', {
                operation: requestContext.request.operationName,
                query: requestContext.request.query
              });
            },
            async didEncounterErrors(requestContext) {
              context.logger.error('GraphQL errors', {
                operation: requestContext.request.operationName,
                errors: requestContext.errors
              });
            }
          };
        }
      }
    ],
    // Enable GraphQL Playground in development
    ...(playground && {
      plugins: [...(server as any).plugins || [], {
        async serverWillStart() {
          console.log(`🚀 GraphQL Playground ready at http://localhost:${port}${path}`);
        }
      }]
    })
  });

  // Start Apollo Server
  await server.start();

  // Apply middleware
  app.use(
    path,
    cors(corsConfig),
    json({ limit: '10mb' }),
    expressMiddleware(server, {
      context: async ({ req, res }) => {
        // HTTP context for queries and mutations
        return {
          mnemosyne: context,
          req,
          res,
          user: null // Would be populated from authentication middleware
        };
      }
    })
  );

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'mnemosyne-graphql',
      timestamp: new Date().toISOString()
    });
  });

  // GraphQL schema endpoint (for tooling)
  app.get('/schema', (req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send(typeDefs.loc?.source.body || '');
  });

  return {
    server,
    app,
    httpServer,
    wsServer
  };
}

/**
 * Start GraphQL server
 */
export async function startGraphQLServer(
  context: MnemosyneContext,
  config: GraphQLServerConfig = {}
): Promise<{
  server: ApolloServer;
  url: string;
  subscriptionsUrl?: string;
  shutdown: () => Promise<void>;
}> {
  const port = config.port || 4000;
  const path = config.path || '/graphql';
  
  const { server, app, httpServer, wsServer } = await createGraphQLServer(context, config);

  // Start HTTP server
  await new Promise<void>((resolve) => {
    httpServer.listen(port, resolve);
  });

  const url = `http://localhost:${port}${path}`;
  const subscriptionsUrl = config.subscriptions ? `ws://localhost:${port}${path}` : undefined;

  context.logger.info('GraphQL server started', { 
    url, 
    subscriptionsUrl,
    playground: config.playground
  });

  // Shutdown function
  const shutdown = async () => {
    context.logger.info('Shutting down GraphQL server...');
    await server.stop();
    httpServer.close();
    if (wsServer) {
      wsServer.close();
    }
  };

  return {
    server,
    url,
    subscriptionsUrl,
    shutdown
  };
}

/**
 * Integration with Alexandria's Express app
 */
export function registerGraphQLWithAlexandria(
  alexandriaApp: express.Application,
  context: MnemosyneContext,
  config: {
    path?: string;
    enableSubscriptions?: boolean;
    enablePlayground?: boolean;
  } = {}
): Promise<ApolloServer> {
  return new Promise(async (resolve, reject) => {
    try {
      const {
        path = '/graphql/mnemosyne',
        enableSubscriptions = false, // Disable WebSocket subscriptions when integrating with existing Express app
        enablePlayground = process.env.NODE_ENV !== 'production'
      } = config;

      // Create schema
      const schema = makeExecutableSchema({
        typeDefs,
        resolvers: createResolvers(context)
      });

      // Create Apollo Server (without HTTP server integration)
      const server = new ApolloServer({
        schema,
        introspection: enablePlayground,
        plugins: [
          {
            async requestDidStart() {
              return {
                async didResolveOperation(requestContext) {
                  context.logger.debug('GraphQL operation via Alexandria', {
                    operation: requestContext.request.operationName,
                    query: requestContext.request.query
                  });
                },
                async didEncounterErrors(requestContext) {
                  context.logger.error('GraphQL errors via Alexandria', {
                    operation: requestContext.request.operationName,
                    errors: requestContext.errors
                  });
                }
              };
            }
          }
        ]
      });

      await server.start();

      // Apply GraphQL middleware to Alexandria's Express app
      alexandriaApp.use(
        path,
        cors({ origin: '*', credentials: true }),
        json({ limit: '10mb' }),
        expressMiddleware(server, {
          context: async ({ req, res }) => ({
            mnemosyne: context,
            req,
            res,
            user: (req as any).user // Assuming Alexandria sets req.user
          })
        })
      );

      context.logger.info(`GraphQL endpoint registered with Alexandria at ${path}`);
      
      resolve(server);
    } catch (error) {
      context.logger.error('Failed to register GraphQL with Alexandria', { error });
      reject(error);
    }
  });
}

export default {
  createGraphQLServer,
  startGraphQLServer,
  registerGraphQLWithAlexandria
};