/**
 * Streaming Service for Alfred
 *
 * Handles streaming AI responses for real-time code generation and chat
 */

import { EventEmitter } from 'events';
import { Logger } from '../../../../utils/logger';
import { AlfredAIAdapter } from './alfred-ai-adapter';

export interface StreamingOptions {
  sessionId: string;
  onChunk?: (chunk: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

export interface CodeStreamingOptions extends StreamingOptions {
  language?: string;
  context?: string;
  temperature?: number;
}

export class StreamingService extends EventEmitter {
  private logger: Logger;
  private aiAdapter: AlfredAIAdapter;
  private activeStreams: Map<string, AbortController> = new Map();

  constructor(logger: Logger, aiAdapter: AlfredAIAdapter) {
    super();
    this.logger = logger;
    this.aiAdapter = aiAdapter;
  }

  /**
   * Stream a chat response
   */
  async streamChat(
    message: string,
    history: Array<{ role: string; content: string }>,
    options: StreamingOptions
  ): Promise<void> {
    const streamId = `chat-${options.sessionId}-${Date.now()}`;
    const abortController = new AbortController();
    this.activeStreams.set(streamId, abortController);

    let fullResponse = '';

    try {
      const stream = this.aiAdapter.streamChat(message, history, {
        signal: abortController.signal
      });

      for await (const chunk of stream) {
        if (abortController.signal.aborted) {
          break;
        }

        fullResponse += chunk;

        // Emit chunk event
        this.emit('chunk', { streamId, chunk, type: 'chat' });

        // Call callback if provided
        if (options.onChunk) {
          options.onChunk(chunk);
        }
      }

      // Emit complete event
      this.emit('complete', { streamId, fullResponse, type: 'chat' });

      // Call complete callback
      if (options.onComplete) {
        options.onComplete(fullResponse);
      }
    } catch (error) {
      this.logger.error('Chat streaming failed', { error, streamId });

      // Emit error event
      this.emit('error', { streamId, error, type: 'chat' });

      // Call error callback
      if (options.onError) {
        options.onError(error as Error);
      }

      throw error;
    } finally {
      this.activeStreams.delete(streamId);
    }
  }

  /**
   * Stream code generation
   */
  async streamCode(prompt: string, options: CodeStreamingOptions): Promise<void> {
    const streamId = `code-${options.sessionId}-${Date.now()}`;
    const abortController = new AbortController();
    this.activeStreams.set(streamId, abortController);

    let fullCode = '';
    let inCodeBlock = false;
    let codeBlockBuffer = '';

    try {
      const stream = this.aiAdapter.streamCode(prompt, options.context, {
        temperature: options.temperature,
        signal: abortController.signal
      });

      for await (const chunk of stream) {
        if (abortController.signal.aborted) {
          break;
        }

        fullCode += chunk;

        // Detect code blocks for better formatting
        if (chunk.includes('```')) {
          inCodeBlock = !inCodeBlock;
          if (!inCodeBlock && codeBlockBuffer) {
            // Emit the complete code block
            this.emit('codeBlock', {
              streamId,
              code: codeBlockBuffer,
              language: options.language || 'typescript'
            });
            codeBlockBuffer = '';
          }
        }

        if (inCodeBlock) {
          codeBlockBuffer += chunk;
        }

        // Emit chunk event
        this.emit('chunk', { streamId, chunk, type: 'code' });

        // Call callback if provided
        if (options.onChunk) {
          options.onChunk(chunk);
        }
      }

      // Emit complete event
      this.emit('complete', { streamId, fullResponse: fullCode, type: 'code' });

      // Call complete callback
      if (options.onComplete) {
        options.onComplete(fullCode);
      }
    } catch (error) {
      this.logger.error('Code streaming failed', { error, streamId });

      // Emit error event
      this.emit('error', { streamId, error, type: 'code' });

      // Call error callback
      if (options.onError) {
        options.onError(error as Error);
      }

      throw error;
    } finally {
      this.activeStreams.delete(streamId);
    }
  }

  /**
   * Cancel an active stream
   */
  cancelStream(sessionId: string): void {
    // Find and abort all streams for this session
    for (const [streamId, controller] of this.activeStreams) {
      if (streamId.includes(sessionId)) {
        controller.abort();
        this.activeStreams.delete(streamId);
        this.emit('cancelled', { streamId });
      }
    }
  }

  /**
   * Cancel all active streams
   */
  cancelAllStreams(): void {
    for (const [streamId, controller] of this.activeStreams) {
      controller.abort();
      this.emit('cancelled', { streamId });
    }
    this.activeStreams.clear();
  }

  /**
   * Get active stream count
   */
  getActiveStreamCount(): number {
    return this.activeStreams.size;
  }

  /**
   * Check if a session has active streams
   */
  hasActiveStreams(sessionId: string): boolean {
    for (const streamId of this.activeStreams.keys()) {
      if (streamId.includes(sessionId)) {
        return true;
      }
    }
    return false;
  }
}
