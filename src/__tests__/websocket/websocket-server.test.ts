/**
 * WebSocket Server Test Suite
 * 
 * Comprehensive tests for WebSocket server including:
 * - Connection establishment and lifecycle
 * - Message broadcasting and routing
 * - Authentication and authorization
 * - Room management and namespaces
 * - Error handling and recovery
 * - Performance and scalability
 * - Security and validation
 * - Integration with plugin system
 * Target Coverage: 100%
 */

import { WebSocketServer } from 'ws';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { 
  WebSocketManager,
  createWebSocketServer,
  WebSocketMessage,
  WebSocketRoom,
  WebSocketClient,
} from '../../api/websocket/websocket-server';
import { Logger } from '../../utils/logger';
import { AuthenticationService } from '../../core/security/authentication-service';

// Mock dependencies
jest.mock('../../utils/logger');
jest.mock('../../core/security/authentication-service');

describe('WebSocket Server', () => {
  let server: Server;
  let wsServer: WebSocketServer;
  let wsManager: WebSocketManager;
  let mockLogger: jest.Mocked<Logger>;
  let mockAuthService: jest.Mocked<AuthenticationService>;
  let port: number;

  const mockUser = {
    id: 'user-123',
    username: 'testuser',
    roles: ['user'],
    permissions: ['read', 'write'],
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Setup mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      child: jest.fn().mockReturnThis(),
    } as any;

    // Setup mock auth service
    mockAuthService = {
      validateToken: jest.fn(),
      getUserFromToken: jest.fn(),
    } as any;

    // Create HTTP server
    server = createServer();
    
    // Start server and get random port
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as AddressInfo).port;
        resolve();
      });
    });

    // Create WebSocket server
    wsServer = new WebSocketServer({ 
      server,
      path: '/ws',
    });

    // Create WebSocket manager
    wsManager = new WebSocketManager({
      server: wsServer,
      logger: mockLogger,
      authService: mockAuthService,
      enableAuthentication: true,
      enableRooms: true,
    });

    await wsManager.initialize();
  });

  afterEach(async () => {
    await wsManager.shutdown();
    wsServer.close();
    server.close();
  });

  describe('Connection Management', () => {
    it('should accept WebSocket connections', async () => {
      const client = new WebSocket(`ws://localhost:${port}/ws`);
      
      await new Promise((resolve) => {
        client.on('open', resolve);
      });

      expect(client.readyState).toBe(WebSocket.OPEN);
      client.close();
    });

    it('should track connected clients', async () => {
      const client1 = new WebSocket(`ws://localhost:${port}/ws`);
      const client2 = new WebSocket(`ws://localhost:${port}/ws`);

      await Promise.all([
        new Promise((resolve) => client1.on('open', resolve)),
        new Promise((resolve) => client2.on('open', resolve)),
      ]);

      expect(wsManager.getConnectedClientsCount()).toBe(2);

      client1.close();
      client2.close();
    });

    it('should handle client disconnections', async () => {
      const client = new WebSocket(`ws://localhost:${port}/ws`);
      
      await new Promise((resolve) => {
        client.on('open', resolve);
      });

      expect(wsManager.getConnectedClientsCount()).toBe(1);

      client.close();

      await new Promise((resolve) => {
        client.on('close', resolve);
      });

      // Give time for server to process disconnect
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(wsManager.getConnectedClientsCount()).toBe(0);
    });

    it('should assign unique client IDs', async () => {
      const client1 = new WebSocket(`ws://localhost:${port}/ws`);
      const client2 = new WebSocket(`ws://localhost:${port}/ws`);

      await Promise.all([
        new Promise((resolve) => client1.on('open', resolve)),
        new Promise((resolve) => client2.on('open', resolve)),
      ]);

      const clients = wsManager.getAllClients();
      const clientIds = clients.map(c => c.id);

      expect(clientIds).toHaveLength(2);
      expect(clientIds[0]).not.toBe(clientIds[1]);
      expect(clientIds[0]).toMatch(/^client_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);

      client1.close();
      client2.close();
    });
  });

  describe('Authentication', () => {
    it('should authenticate clients with valid tokens', async () => {
      mockAuthService.validateToken.mockResolvedValue({
        valid: true,
        payload: { sub: 'user-123' },
      });
      mockAuthService.getUserFromToken.mockResolvedValue(mockUser);

      const client = new WebSocket(`ws://localhost:${port}/ws`);
      
      await new Promise((resolve) => {
        client.on('open', resolve);
      });

      // Send authentication message
      const authMessage = {
        type: 'auth',
        token: 'valid-token',
      };
      
      client.send(JSON.stringify(authMessage));

      // Wait for authentication response
      const response = await new Promise((resolve) => {
        client.on('message', (data) => {
          resolve(JSON.parse(data.toString()));
        });
      });

      expect(response).toEqual({
        type: 'auth_success',
        user: mockUser,
      });

      client.close();
    });

    it('should reject clients with invalid tokens', async () => {
      mockAuthService.validateToken.mockResolvedValue({
        valid: false,
        error: 'Invalid token',
      });

      const client = new WebSocket(`ws://localhost:${port}/ws`);
      
      await new Promise((resolve) => {
        client.on('open', resolve);
      });

      const authMessage = {
        type: 'auth',
        token: 'invalid-token',
      };
      
      client.send(JSON.stringify(authMessage));

      const response = await new Promise((resolve) => {
        client.on('message', (data) => {
          resolve(JSON.parse(data.toString()));
        });
      });

      expect(response).toEqual({
        type: 'auth_error',
        error: 'Authentication failed',
        message: 'Invalid token',
      });

      client.close();
    });

    it('should require authentication for protected operations', async () => {
      const client = new WebSocket(`ws://localhost:${port}/ws`);
      
      await new Promise((resolve) => {
        client.on('open', resolve);
      });

      // Try to send a message without authentication
      const message = {
        type: 'chat',
        content: 'Hello world',
      };
      
      client.send(JSON.stringify(message));

      const response = await new Promise((resolve) => {
        client.on('message', (data) => {
          resolve(JSON.parse(data.toString()));
        });
      });

      expect(response).toEqual({
        type: 'error',
        error: 'Authentication required',
        message: 'You must authenticate before sending messages',
      });

      client.close();
    });
  });

  describe('Message Broadcasting', () => {
    let authenticatedClient1: WebSocket;
    let authenticatedClient2: WebSocket;

    beforeEach(async () => {
      mockAuthService.validateToken.mockResolvedValue({
        valid: true,
        payload: { sub: 'user-123' },
      });
      mockAuthService.getUserFromToken.mockResolvedValue(mockUser);

      // Create and authenticate clients
      authenticatedClient1 = new WebSocket(`ws://localhost:${port}/ws`);
      authenticatedClient2 = new WebSocket(`ws://localhost:${port}/ws`);

      await Promise.all([
        new Promise((resolve) => authenticatedClient1.on('open', resolve)),
        new Promise((resolve) => authenticatedClient2.on('open', resolve)),
      ]);

      // Authenticate both clients
      const authMessage = {
        type: 'auth',
        token: 'valid-token',
      };

      authenticatedClient1.send(JSON.stringify(authMessage));
      authenticatedClient2.send(JSON.stringify(authMessage));

      // Wait for authentication responses
      await Promise.all([
        new Promise((resolve) => {
          authenticatedClient1.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'auth_success') resolve(msg);
          });
        }),
        new Promise((resolve) => {
          authenticatedClient2.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'auth_success') resolve(msg);
          });
        }),
      ]);
    });

    afterEach(() => {
      authenticatedClient1.close();
      authenticatedClient2.close();
    });

    it('should broadcast messages to all clients', async () => {
      const broadcastMessage = {
        type: 'broadcast',
        data: {
          message: 'Hello everyone!',
          timestamp: new Date().toISOString(),
        },
      };

      // Use manager to broadcast
      wsManager.broadcast(broadcastMessage);

      // Both clients should receive the message
      const responses = await Promise.all([
        new Promise((resolve) => {
          authenticatedClient1.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'broadcast') resolve(msg);
          });
        }),
        new Promise((resolve) => {
          authenticatedClient2.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'broadcast') resolve(msg);
          });
        }),
      ]);

      responses.forEach((response: any) => {
        expect(response).toEqual(broadcastMessage);
      });
    });

    it('should support targeted messaging', async () => {
      const clients = wsManager.getAllClients();
      const targetClientId = clients[0].id;

      const targetedMessage = {
        type: 'private_message',
        data: {
          message: 'Private message',
          from: 'user-123',
        },
      };

      wsManager.sendToClient(targetClientId, targetedMessage);

      // Only the targeted client should receive the message
      let receivedByTarget = false;
      let receivedByOther = false;

      authenticatedClient1.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'private_message') {
          receivedByTarget = true;
        }
      });

      authenticatedClient2.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'private_message') {
          receivedByOther = true;
        }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(receivedByTarget).toBe(true);
      expect(receivedByOther).toBe(false);
    });
  });

  describe('Room Management', () => {
    let authenticatedClient: WebSocket;

    beforeEach(async () => {
      mockAuthService.validateToken.mockResolvedValue({
        valid: true,
        payload: { sub: 'user-123' },
      });
      mockAuthService.getUserFromToken.mockResolvedValue(mockUser);

      authenticatedClient = new WebSocket(`ws://localhost:${port}/ws`);
      
      await new Promise((resolve) => {
        authenticatedClient.on('open', resolve);
      });

      // Authenticate client
      const authMessage = {
        type: 'auth',
        token: 'valid-token',
      };

      authenticatedClient.send(JSON.stringify(authMessage));

      await new Promise((resolve) => {
        authenticatedClient.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'auth_success') resolve(msg);
        });
      });
    });

    afterEach(() => {
      authenticatedClient.close();
    });

    it('should allow clients to join rooms', async () => {
      const joinMessage = {
        type: 'join_room',
        room: 'general',
      };

      authenticatedClient.send(JSON.stringify(joinMessage));

      const response = await new Promise((resolve) => {
        authenticatedClient.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'room_joined') resolve(msg);
        });
      });

      expect(response).toEqual({
        type: 'room_joined',
        room: 'general',
        success: true,
      });

      const rooms = wsManager.getClientRooms(wsManager.getAllClients()[0].id);
      expect(rooms).toContain('general');
    });

    it('should allow clients to leave rooms', async () => {
      const clientId = wsManager.getAllClients()[0].id;

      // Join room first
      wsManager.joinRoom(clientId, 'test-room');

      const leaveMessage = {
        type: 'leave_room',
        room: 'test-room',
      };

      authenticatedClient.send(JSON.stringify(leaveMessage));

      const response = await new Promise((resolve) => {
        authenticatedClient.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'room_left') resolve(msg);
        });
      });

      expect(response).toEqual({
        type: 'room_left',
        room: 'test-room',
        success: true,
      });

      const rooms = wsManager.getClientRooms(clientId);
      expect(rooms).not.toContain('test-room');
    });

    it('should broadcast messages to room members only', async () => {
      const client1 = new WebSocket(`ws://localhost:${port}/ws`);
      const client2 = new WebSocket(`ws://localhost:${port}/ws`);

      await Promise.all([
        new Promise((resolve) => client1.on('open', resolve)),
        new Promise((resolve) => client2.on('open', resolve)),
      ]);

      // Authenticate both clients
      const authMessage = { type: 'auth', token: 'valid-token' };
      client1.send(JSON.stringify(authMessage));
      client2.send(JSON.stringify(authMessage));

      await Promise.all([
        new Promise((resolve) => {
          client1.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'auth_success') resolve(msg);
          });
        }),
        new Promise((resolve) => {
          client2.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'auth_success') resolve(msg);
          });
        }),
      ]);

      const clients = wsManager.getAllClients();
      const client1Id = clients.find(c => c.socket === client1)?.id;
      const client2Id = clients.find(c => c.socket === client2)?.id;

      // Only client1 joins the room
      wsManager.joinRoom(client1Id!, 'private-room');

      // Broadcast to room
      const roomMessage = {
        type: 'room_message',
        data: { content: 'Room only message' },
      };

      wsManager.broadcastToRoom('private-room', roomMessage);

      let client1Received = false;
      let client2Received = false;

      client1.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'room_message') {
          client1Received = true;
        }
      });

      client2.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'room_message') {
          client2Received = true;
        }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(client1Received).toBe(true);
      expect(client2Received).toBe(false);

      client1.close();
      client2.close();
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON messages', async () => {
      const client = new WebSocket(`ws://localhost:${port}/ws`);
      
      await new Promise((resolve) => {
        client.on('open', resolve);
      });

      // Send invalid JSON
      client.send('invalid json {');

      const response = await new Promise((resolve) => {
        client.on('message', (data) => {
          resolve(JSON.parse(data.toString()));
        });
      });

      expect(response).toEqual({
        type: 'error',
        error: 'Invalid message format',
        message: 'Message must be valid JSON',
      });

      client.close();
    });

    it('should handle connection errors gracefully', async () => {
      const client = new WebSocket(`ws://localhost:${port}/ws`);
      
      await new Promise((resolve) => {
        client.on('open', resolve);
      });

      // Force connection error
      client.terminate();

      // Give time for server to process
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'WebSocket connection closed',
        expect.objectContaining({
          clientId: expect.any(String),
        })
      );
    });

    it('should handle message rate limiting', async () => {
      // Configure manager with rate limiting
      const rateLimitedManager = new WebSocketManager({
        server: wsServer,
        logger: mockLogger,
        authService: mockAuthService,
        rateLimiting: {
          enabled: true,
          maxMessages: 5,
          windowMs: 60000,
        },
      });

      const client = new WebSocket(`ws://localhost:${port}/ws`);
      
      await new Promise((resolve) => {
        client.on('open', resolve);
      });

      // Send messages rapidly
      for (let i = 0; i < 7; i++) {
        client.send(JSON.stringify({ type: 'ping', data: i }));
      }

      // Should receive rate limit error
      const responses: any[] = [];
      
      client.on('message', (data) => {
        responses.push(JSON.parse(data.toString()));
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const rateLimitError = responses.find(r => r.type === 'rate_limit_exceeded');
      expect(rateLimitError).toBeDefined();

      client.close();
    });
  });

  describe('Message Validation', () => {
    let authenticatedClient: WebSocket;

    beforeEach(async () => {
      mockAuthService.validateToken.mockResolvedValue({
        valid: true,
        payload: { sub: 'user-123' },
      });
      mockAuthService.getUserFromToken.mockResolvedValue(mockUser);

      authenticatedClient = new WebSocket(`ws://localhost:${port}/ws`);
      
      await new Promise((resolve) => {
        authenticatedClient.on('open', resolve);
      });

      // Authenticate
      const authMessage = { type: 'auth', token: 'valid-token' };
      authenticatedClient.send(JSON.stringify(authMessage));

      await new Promise((resolve) => {
        authenticatedClient.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'auth_success') resolve(msg);
        });
      });
    });

    afterEach(() => {
      authenticatedClient.close();
    });

    it('should validate message schema', async () => {
      const invalidMessage = {
        // Missing required 'type' field
        data: 'some data',
      };

      authenticatedClient.send(JSON.stringify(invalidMessage));

      const response = await new Promise((resolve) => {
        authenticatedClient.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'validation_error') resolve(msg);
        });
      });

      expect(response).toEqual({
        type: 'validation_error',
        error: 'Message validation failed',
        details: expect.arrayContaining([
          expect.stringContaining('type'),
        ]),
      });
    });

    it('should sanitize message content', async () => {
      const messageWithScript = {
        type: 'chat',
        content: '<script>alert("xss")</script>Hello world',
      };

      authenticatedClient.send(JSON.stringify(messageWithScript));

      // Should process without script tags
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Message sanitized',
        expect.objectContaining({
          originalContent: expect.stringContaining('<script>'),
          sanitizedContent: expect.not.stringContaining('<script>'),
        })
      );
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle many concurrent connections', async () => {
      const connectionCount = 50;
      const clients: WebSocket[] = [];

      // Create many connections
      for (let i = 0; i < connectionCount; i++) {
        const client = new WebSocket(`ws://localhost:${port}/ws`);
        clients.push(client);
      }

      // Wait for all connections to open
      await Promise.all(
        clients.map(client => 
          new Promise((resolve) => client.on('open', resolve))
        )
      );

      expect(wsManager.getConnectedClientsCount()).toBe(connectionCount);

      // Close all connections
      clients.forEach(client => client.close());

      // Wait for all to close
      await Promise.all(
        clients.map(client =>
          new Promise((resolve) => client.on('close', resolve))
        )
      );
    });

    it('should handle message broadcasting performance', async () => {
      const clientCount = 20;
      const clients: WebSocket[] = [];

      // Create authenticated clients
      mockAuthService.validateToken.mockResolvedValue({
        valid: true,
        payload: { sub: 'user-123' },
      });
      mockAuthService.getUserFromToken.mockResolvedValue(mockUser);

      for (let i = 0; i < clientCount; i++) {
        const client = new WebSocket(`ws://localhost:${port}/ws`);
        clients.push(client);
      }

      await Promise.all(
        clients.map(client => 
          new Promise((resolve) => client.on('open', resolve))
        )
      );

      // Measure broadcast performance
      const startTime = Date.now();
      
      const message = {
        type: 'performance_test',
        data: { content: 'Broadcast test message' },
      };

      wsManager.broadcast(message);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100); // Should complete quickly

      clients.forEach(client => client.close());
    });
  });

  describe('Plugin Integration', () => {
    it('should emit events for plugin system', async () => {
      const eventEmitter = new EventEmitter();
      wsManager.setEventEmitter(eventEmitter);

      let connectionEvent: any = null;
      let messageEvent: any = null;

      eventEmitter.on('websocket.connection', (event) => {
        connectionEvent = event;
      });

      eventEmitter.on('websocket.message', (event) => {
        messageEvent = event;
      });

      const client = new WebSocket(`ws://localhost:${port}/ws`);
      
      await new Promise((resolve) => {
        client.on('open', resolve);
      });

      expect(connectionEvent).toEqual({
        type: 'connection',
        clientId: expect.any(String),
        timestamp: expect.any(Date),
      });

      // Send a message
      client.send(JSON.stringify({ type: 'test', data: 'plugin test' }));

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(messageEvent).toEqual({
        type: 'message',
        clientId: expect.any(String),
        message: { type: 'test', data: 'plugin test' },
        timestamp: expect.any(Date),
      });

      client.close();
    });

    it('should allow plugins to register message handlers', async () => {
      const customHandler = jest.fn((client: WebSocketClient, message: any) => {
        client.send({
          type: 'custom_response',
          data: { received: message.data },
        });
      });

      wsManager.registerMessageHandler('custom_type', customHandler);

      mockAuthService.validateToken.mockResolvedValue({
        valid: true,
        payload: { sub: 'user-123' },
      });
      mockAuthService.getUserFromToken.mockResolvedValue(mockUser);

      const client = new WebSocket(`ws://localhost:${port}/ws`);
      
      await new Promise((resolve) => {
        client.on('open', resolve);
      });

      // Authenticate
      const authMessage = { type: 'auth', token: 'valid-token' };
      client.send(JSON.stringify(authMessage));

      await new Promise((resolve) => {
        client.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'auth_success') resolve(msg);
        });
      });

      // Send custom message
      const customMessage = {
        type: 'custom_type',
        data: { test: 'plugin message' },
      };

      client.send(JSON.stringify(customMessage));

      const response = await new Promise((resolve) => {
        client.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'custom_response') resolve(msg);
        });
      });

      expect(customHandler).toHaveBeenCalled();
      expect(response).toEqual({
        type: 'custom_response',
        data: { received: { test: 'plugin message' } },
      });

      client.close();
    });
  });
});