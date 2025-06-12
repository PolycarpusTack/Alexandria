/**
 * CQRS Implementation - Command Bus
 * Handles command dispatching and processing
 */

import { EventEmitter } from 'events';
import { Command, CommandHandler, CommandBus } from '../hexagonal/ports';
import { Logger } from '../../../utils/logger';
import { BaseError, createErrorContext } from '@alexandria/shared';

export class CommandExecutionError extends BaseError {
  constructor(commandType: string, originalError: Error) {
    super(
      `Failed to execute command: ${commandType}`,
      'COMMAND_EXECUTION_ERROR',
      500,
      createErrorContext('command_execution', undefined, {
        commandType,
        originalError: originalError.message
      })
    );
  }
}

export class CommandHandlerNotFoundError extends BaseError {
  constructor(commandType: string) {
    super(
      `No handler registered for command: ${commandType}`,
      'COMMAND_HANDLER_NOT_FOUND',
      400,
      createErrorContext('command_dispatch', undefined, { commandType })
    );
  }
}

export class AlexandriaCommandBus extends EventEmitter implements CommandBus {
  private handlers: Map<string, CommandHandler<any>> = new Map();
  private logger: Logger;
  private metrics: {
    commandsProcessed: number;
    commandsSucceeded: number;
    commandsFailed: number;
    averageExecutionTime: number;
  };

  constructor(logger: Logger) {
    super();
    this.logger = logger;
    this.metrics = {
      commandsProcessed: 0,
      commandsSucceeded: 0,
      commandsFailed: 0,
      averageExecutionTime: 0
    };
  }

  /**
   * Register a command handler for a specific command type
   */
  register<T extends Command>(commandType: string, handler: CommandHandler<T>): void {
    if (this.handlers.has(commandType)) {
      this.logger.warn(`Overriding existing handler for command type: ${commandType}`);
    }

    this.handlers.set(commandType, handler);
    this.logger.info(`Registered command handler for: ${commandType}`);
  }

  /**
   * Dispatch a command to its registered handler
   */
  async dispatch<T extends Command>(command: T): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.debug(`Dispatching command: ${command.type}`, {
        commandId: command.id,
        commandType: command.type,
        userId: command.userId
      });

      // Emit pre-execution event
      this.emit('command:before', command);

      // Find and execute handler
      const handler = this.handlers.get(command.type);
      if (!handler) {
        throw new CommandHandlerNotFoundError(command.type);
      }

      await handler.handle(command);

      // Update metrics
      const executionTime = Date.now() - startTime;
      this.updateMetrics(true, executionTime);

      // Emit post-execution event
      this.emit('command:after', command, executionTime);

      this.logger.info(`Command executed successfully: ${command.type}`, {
        commandId: command.id,
        executionTime
      });
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.updateMetrics(false, executionTime);

      this.logger.error(`Command execution failed: ${command.type}`, {
        commandId: command.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime
      });

      // Emit error event
      this.emit('command:error', command, error, executionTime);

      // Re-throw as CommandExecutionError if not already a BaseError
      if (error instanceof BaseError) {
        throw error;
      } else {
        throw new CommandExecutionError(command.type, error as Error);
      }
    }
  }

  /**
   * Get registered command types
   */
  getRegisteredCommands(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Get command bus metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      registeredHandlers: this.handlers.size
    };
  }

  /**
   * Clear all registered handlers (useful for testing)
   */
  clearHandlers(): void {
    this.handlers.clear();
    this.logger.info('All command handlers cleared');
  }

  private updateMetrics(success: boolean, executionTime: number): void {
    this.metrics.commandsProcessed++;

    if (success) {
      this.metrics.commandsSucceeded++;
    } else {
      this.metrics.commandsFailed++;
    }

    // Update running average
    const totalTime =
      this.metrics.averageExecutionTime * (this.metrics.commandsProcessed - 1) + executionTime;
    this.metrics.averageExecutionTime = totalTime / this.metrics.commandsProcessed;
  }
}

// ==================== COMMAND MIDDLEWARE ====================

export interface CommandMiddleware {
  execute<T extends Command>(command: T, next: () => Promise<void>): Promise<void>;
}

export class LoggingCommandMiddleware implements CommandMiddleware {
  constructor(private logger: Logger) {}

  async execute<T extends Command>(command: T, next: () => Promise<void>): Promise<void> {
    this.logger.debug(`[Command Middleware] Processing: ${command.type}`, {
      commandId: command.id,
      timestamp: command.timestamp
    });

    await next();

    this.logger.debug(`[Command Middleware] Completed: ${command.type}`, {
      commandId: command.id
    });
  }
}

export class ValidationCommandMiddleware implements CommandMiddleware {
  async execute<T extends Command>(command: T, next: () => Promise<void>): Promise<void> {
    // Validate command structure
    if (!command.id || !command.type || !command.timestamp) {
      throw new BaseError(
        'Invalid command structure',
        'INVALID_COMMAND',
        400,
        createErrorContext('command_validation')
      );
    }

    // Validate command timestamp (not too old)
    const maxAge = 5 * 60 * 1000; // 5 minutes
    if (Date.now() - command.timestamp.getTime() > maxAge) {
      throw new BaseError(
        'Command is too old',
        'COMMAND_EXPIRED',
        400,
        createErrorContext('command_validation', undefined, {
          commandAge: Date.now() - command.timestamp.getTime()
        })
      );
    }

    await next();
  }
}

export class CommandBusWithMiddleware extends AlexandriaCommandBus {
  private middleware: CommandMiddleware[] = [];

  addMiddleware(middleware: CommandMiddleware): void {
    this.middleware.push(middleware);
  }

  async dispatch<T extends Command>(command: T): Promise<void> {
    if (this.middleware.length === 0) {
      return super.dispatch(command);
    }

    let index = 0;
    const executeMiddleware = async (): Promise<void> => {
      if (index >= this.middleware.length) {
        return super.dispatch(command);
      }

      const middleware = this.middleware[index++];
      return middleware.execute(command, executeMiddleware);
    };

    return executeMiddleware();
  }
}
