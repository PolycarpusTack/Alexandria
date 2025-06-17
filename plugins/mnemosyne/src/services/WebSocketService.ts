import { Server as SocketIOServer, Socket } from 'socket.io';
import { NodeService } from './NodeService';
import { ConnectionService } from './ConnectionService';
import { ApiError } from '../utils/errors';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
}

interface CollaborationRoom {
  nodeId: string;
  users: Set<string>;
  lastActivity: Date;
}

export class WebSocketService {
  private io: SocketIOServer;
  private nodeService: NodeService;
  private connectionService: ConnectionService;
  private collaborationRooms: Map<string, CollaborationRoom>;
  private userSockets: Map<string, Set<string>>; // userId -> Set of socketIds

  constructor(io: SocketIOServer) {
    this.io = io;
    this.nodeService = new NodeService();
    this.connectionService = new ConnectionService();
    this.collaborationRooms = new Map();
    this.userSockets = new Map();
  }

  async initialize(): Promise<void> {
    // Configure Socket.IO namespace for Mnemosyne
    const mnemosyneNamespace = this.io.of('/mnemosyne');

    // Authentication middleware
    mnemosyneNamespace.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        
        if (!token) {
          return next(new Error('Authentication required'));
        }

        // Validate token (integrate with Alexandria's auth)
        const user = await this.validateToken(token as string);
        
        if (!user) {
          return next(new Error('Invalid authentication token'));
        }

        socket.userId = user.id;
        socket.username = user.username;
        next();
      } catch (error) {
        next(error as Error);
      }
    });

    // Connection handler
    mnemosyneNamespace.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`Mnemosyne WebSocket: User ${socket.userId} connected`);
      
      // Track user socket
      this.addUserSocket(socket.userId!, socket.id);

      // Join user-specific room for notifications
      socket.join(`user:${socket.userId}`);

      // Handle events
      this.setupSocketHandlers(socket);

      // Cleanup on disconnect
      socket.on('disconnect', () => {
        console.log(`Mnemosyne WebSocket: User ${socket.userId} disconnected`);
        this.removeUserSocket(socket.userId!, socket.id);
        this.leaveAllRooms(socket);
      });
    });

    // Subscribe to service events for real-time updates
    this.subscribeToServiceEvents();

    console.log('Mnemosyne WebSocket service initialized');
  }

  private setupSocketHandlers(socket: AuthenticatedSocket): void {
    // Join collaboration room
    socket.on('join:node', async (nodeId: string) => {
      try {
        // Verify node exists and user has access
        const node = await this.nodeService.getNodeById(nodeId);
        if (!node) {
          socket.emit('error', { message: 'Node not found' });
          return;
        }

        // Join the room
        socket.join(`node:${nodeId}`);
        this.joinCollaborationRoom(nodeId, socket.userId!);

        // Notify others in the room
        socket.to(`node:${nodeId}`).emit('user:joined', {
          userId: socket.userId,
          username: socket.username,
          nodeId
        });

        // Send current users in room
        const users = this.getCollaborationUsers(nodeId);
        socket.emit('room:users', { nodeId, users });
      } catch (error) {
        socket.emit('error', { message: 'Failed to join node room' });
      }
    });

    // Leave collaboration room
    socket.on('leave:node', (nodeId: string) => {
      socket.leave(`node:${nodeId}`);
      this.leaveCollaborationRoom(nodeId, socket.userId!);

      // Notify others
      socket.to(`node:${nodeId}`).emit('user:left', {
        userId: socket.userId,
        username: socket.username,
        nodeId
      });
    });

    // Handle real-time editing
    socket.on('node:edit', async (data: {
      nodeId: string;
      changes: any;
      cursor?: { line: number; column: number };
    }) => {
      try {
        // Broadcast changes to others in the room
        socket.to(`node:${data.nodeId}`).emit('node:changes', {
          userId: socket.userId,
          username: socket.username,
          changes: data.changes,
          cursor: data.cursor,
          timestamp: new Date()
        });

        // Update last activity
        const room = this.collaborationRooms.get(data.nodeId);
        if (room) {
          room.lastActivity = new Date();
        }
      } catch (error) {
        socket.emit('error', { message: 'Failed to broadcast changes' });
      }
    });

    // Handle cursor position updates
    socket.on('cursor:move', (data: {
      nodeId: string;
      position: { line: number; column: number };
    }) => {
      socket.to(`node:${data.nodeId}`).emit('cursor:update', {
        userId: socket.userId,
        username: socket.username,
        position: data.position
      });
    });

    // Handle search suggestions
    socket.on('search:suggest', async (query: string) => {
      try {
        const suggestions = await this.nodeService.searchNodes(query, { limit: 5 });
        socket.emit('search:suggestions', suggestions);
      } catch (error) {
        socket.emit('error', { message: 'Failed to get search suggestions' });
      }
    });

    // Handle notifications settings
    socket.on('notifications:subscribe', (types: string[]) => {
      // Subscribe to specific notification types
      types.forEach(type => {
        socket.join(`notifications:${type}`);
      });
    });

    socket.on('notifications:unsubscribe', (types: string[]) => {
      types.forEach(type => {
        socket.leave(`notifications:${type}`);
      });
    });
  }

  private subscribeToServiceEvents(): void {
    // Subscribe to node events
    this.nodeService.on('node:created', (node) => {
      // Notify all connected users
      this.io.of('/mnemosyne').emit('node:created', {
        node,
        timestamp: new Date()
      });
    });

    this.nodeService.on('node:updated', (node) => {
      // Notify users in the node room
      this.io.of('/mnemosyne').to(`node:${node.id}`).emit('node:updated', {
        node,
        timestamp: new Date()
      });
    });

    this.nodeService.on('node:deleted', ({ id }) => {
      // Notify users in the node room
      this.io.of('/mnemosyne').to(`node:${id}`).emit('node:deleted', {
        nodeId: id,
        timestamp: new Date()
      });
    });

    // Subscribe to connection events
    this.connectionService.on('connection:created', (connection) => {
      // Notify users watching either node
      this.io.of('/mnemosyne').to(`node:${connection.sourceId}`).emit('connection:created', connection);
      this.io.of('/mnemosyne').to(`node:${connection.targetId}`).emit('connection:created', connection);
    });

    this.connectionService.on('connection:deleted', ({ id }) => {
      // Notify all users (since we don't track which nodes were connected)
      this.io.of('/mnemosyne').emit('connection:deleted', {
        connectionId: id,
        timestamp: new Date()
      });
    });
  }

  private addUserSocket(userId: string, socketId: string): void {
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socketId);
  }

  private removeUserSocket(userId: string, socketId: string): void {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
      }
    }
  }

  private joinCollaborationRoom(nodeId: string, userId: string): void {
    if (!this.collaborationRooms.has(nodeId)) {
      this.collaborationRooms.set(nodeId, {
        nodeId,
        users: new Set(),
        lastActivity: new Date()
      });
    }
    
    const room = this.collaborationRooms.get(nodeId)!;
    room.users.add(userId);
    room.lastActivity = new Date();
  }

  private leaveCollaborationRoom(nodeId: string, userId: string): void {
    const room = this.collaborationRooms.get(nodeId);
    if (room) {
      room.users.delete(userId);
      if (room.users.size === 0) {
        this.collaborationRooms.delete(nodeId);
      }
    }
  }

  private leaveAllRooms(socket: AuthenticatedSocket): void {
    this.collaborationRooms.forEach((room, nodeId) => {
      if (room.users.has(socket.userId!)) {
        this.leaveCollaborationRoom(nodeId, socket.userId!);
        
        // Notify others
        socket.to(`node:${nodeId}`).emit('user:left', {
          userId: socket.userId,
          username: socket.username,
          nodeId
        });
      }
    });
  }

  private getCollaborationUsers(nodeId: string): Array<{ userId: string; isOnline: boolean }> {
    const room = this.collaborationRooms.get(nodeId);
    if (!room) return [];

    return Array.from(room.users).map(userId => ({
      userId,
      isOnline: this.userSockets.has(userId)
    }));
  }

  // Placeholder for token validation - integrate with Alexandria
  private async validateToken(token: string): Promise<{ id: string; username: string } | null> {
    // TODO: Integrate with Alexandria's auth service
    if (token === 'invalid') return null;
    
    return {
      id: 'user-' + Date.now(),
      username: 'mnemosyne_user'
    };
  }

  public async shutdown(): Promise<void> {
    // Clean up all connections
    this.io.of('/mnemosyne').disconnectSockets();
    
    // Clear internal state
    this.collaborationRooms.clear();
    this.userSockets.clear();
    
    // Remove event listeners
    this.nodeService.removeAllListeners();
    this.connectionService.removeAllListeners();
    
    console.log('Mnemosyne WebSocket service shut down');
  }

  // Public methods for sending notifications
  public notifyUser(userId: string, notification: any): void {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.forEach(socketId => {
        this.io.of('/mnemosyne').to(socketId).emit('notification', notification);
      });
    }
  }

  public broadcastToRoom(nodeId: string, event: string, data: any): void {
    this.io.of('/mnemosyne').to(`node:${nodeId}`).emit(event, data);
  }
}