/**
 * Python-TypeScript Bridge for Alfred Plugin
 * 
 * This module provides a bridge to run the existing Python Alfred code
 * within the Alexandria platform, allowing seamless integration while
 * maintaining the original functionality.
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';
import { Logger } from '../../../../utils/logger';
import { PluginError, ServiceUnavailableError, TimeoutError, ErrorHandler } from '../../../../core/errors';

export interface PythonMessage {
  type: 'chat' | 'project' | 'structure' | 'error' | 'status';
  data: any;
  id?: string;
}

export interface BridgeOptions {
  pythonPath?: string;
  alfredPath: string;
  logger: Logger;
}

export class PythonBridge extends EventEmitter {
  private process?: ChildProcess;
  private logger: Logger;
  private pythonPath: string;
  private alfredPath: string;
  private messageBuffer = '';
  private isRunning = false;

  constructor(options: BridgeOptions) {
    super();
    this.logger = options.logger;
    this.pythonPath = options.pythonPath || 'python3';
    this.alfredPath = options.alfredPath;
  }

  /**
   * Start the Python Alfred process
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Python bridge already running');
      return;
    }

    try {
      // Create bridge script that runs Alfred in API mode
      const bridgeScriptPath = path.join(this.alfredPath, 'alfred_bridge.py');
      
      this.process = spawn(this.pythonPath, [bridgeScriptPath], {
        cwd: this.alfredPath,
        env: {
          ...process.env,
          ALFRED_MODE: 'bridge',
          ALFRED_NO_GUI: 'true'
        }
      });

      this.setupProcessHandlers();
      this.isRunning = true;
      
      this.logger.info('Python bridge started successfully');
    } catch (error) {
      const standardError = ErrorHandler.toStandardError(error);
      this.logger.error('Failed to start Python bridge', {
        error: standardError.message,
        code: standardError.code,
        context: standardError.context,
        pythonPath: this.pythonPath,
        alfredPath: this.alfredPath
      });
      
      throw new PluginError(
        'alfred',
        'start-python-bridge',
        `Failed to initialize Python bridge: ${standardError.message}`,
        {
          pythonPath: this.pythonPath,
          alfredPath: this.alfredPath,
          originalError: standardError.message
        }
      );
    }
  }

  /**
   * Stop the Python process
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.process) {
      return;
    }

    return new Promise((resolve) => {
      this.process!.once('exit', () => {
        this.isRunning = false;
        resolve();
      });

      this.process!.kill('SIGTERM');
      
      // Force kill after 5 seconds if graceful shutdown fails
      setTimeout(() => {
        if (this.isRunning && this.process) {
          this.process.kill('SIGKILL');
        }
      }, 5000);
    });
  }

  /**
   * Send a message to the Python process
   */
  async sendMessage(message: PythonMessage): Promise<void> {
    if (!this.isRunning || !this.process?.stdin) {
      throw new ServiceUnavailableError(
        'alfred-python-bridge',
        'Bridge is not running or stdin is unavailable',
        {
          isRunning: this.isRunning,
          hasStdin: !!this.process?.stdin,
          messageType: message.type
        }
      );
    }

    try {
      const messageStr = JSON.stringify(message) + '\n';
      this.process.stdin.write(messageStr);
      
      this.logger.debug('Message sent to Python bridge', {
        messageType: message.type,
        messageId: message.id
      });
    } catch (error) {
      const standardError = ErrorHandler.toStandardError(error);
      this.logger.error('Failed to send message to Python bridge', {
        error: standardError.message,
        messageType: message.type,
        messageId: message.id
      });
      
      throw new PluginError(
        'alfred',
        'send-python-message',
        `Failed to send message to Python bridge: ${standardError.message}`,
        {
          messageType: message.type,
          messageId: message.id,
          originalError: standardError.message
        }
      );
    }
  }

  /**
   * Call a Python function and wait for response
   */
  async call<T = any>(method: string, params: any = {}): Promise<T> {
    const id = this.generateId();
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.removeAllListeners(`response:${id}`);
        
        const timeoutError = new TimeoutError(
          `python-bridge-call-${method}`,
          30000,
          {
            method,
            params,
            callId: id
          }
        );
        
        this.logger.error('Python bridge call timeout', {
          error: timeoutError.message,
          method,
          callId: id,
          timeoutMs: 30000
        });
        
        reject(timeoutError);
      }, 30000);

      this.once(`response:${id}`, (response: any) => {
        clearTimeout(timeout);
        
        if (response.error) {
          const error = new PluginError(
            'alfred',
            'python-bridge-call',
            `Python bridge method '${method}' failed: ${response.error}`,
            {
              method,
              params,
              callId: id,
              pythonError: response.error
            }
          );
          
          this.logger.error('Python bridge method failed', {
            error: error.message,
            method,
            callId: id,
            pythonError: response.error
          });
          
          reject(error);
        } else {
          this.logger.debug('Python bridge call successful', {
            method,
            callId: id
          });
          
          resolve(response.result);
        }
      });

      this.sendMessage({
        type: 'call',
        id,
        data: { method, params }
      }).catch(reject);
    });
  }

  /**
   * Setup handlers for the Python process
   */
  private setupProcessHandlers(): void {
    if (!this.process) return;

    // Handle stdout (normal messages)
    this.process.stdout?.on('data', (data: Buffer) => {
      this.messageBuffer += data.toString();
      this.processMessages();
    });

    // Handle stderr (errors and logs)
    this.process.stderr?.on('data', (data: Buffer) => {
      const message = data.toString().trim();
      if (message) {
        this.logger.debug(`Python stderr: ${message}`);
      }
    });

    // Handle process exit
    this.process.on('exit', (code, signal) => {
      this.isRunning = false;
      this.logger.info(`Python process exited with code ${code}, signal ${signal}`);
      this.emit('exit', { code, signal });
    });

    // Handle process errors
    this.process.on('error', (error) => {
      this.logger.error('Python process error', { error });
      this.emit('error', error);
    });
  }

  /**
   * Process messages from the message buffer
   */
  private processMessages(): void {
    const lines = this.messageBuffer.split('\n');
    this.messageBuffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const message = JSON.parse(line) as PythonMessage;
        this.handleMessage(message);
      } catch (error) {
        const standardError = ErrorHandler.toStandardError(error);
        this.logger.error('Failed to parse Python message', {
          error: standardError.message,
          code: standardError.code,
          rawLine: line,
          lineLength: line.length
        });
        
        // Emit error event for monitoring
        this.emit('parse-error', {
          error: standardError,
          rawLine: line
        });
      }
    }
  }

  /**
   * Handle a message from Python
   */
  private handleMessage(message: PythonMessage): void {
    // Handle response messages
    if (message.id && message.type === 'response') {
      this.emit(`response:${message.id}`, message.data);
      return;
    }

    // Emit typed events
    this.emit(message.type, message.data);
    
    // Also emit a generic message event
    this.emit('message', message);
  }

  /**
   * Generate a unique message ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if the bridge is running
   */
  get running(): boolean {
    return this.isRunning;
  }
}

/**
 * Create the Python bridge script that will be executed
 */
export async function createBridgeScript(alfredPath: string): Promise<void> {
  const bridgeScript = `#!/usr/bin/env python3
"""
Alfred Bridge Script - Provides JSON-RPC interface to Alfred
"""

import sys
import json
import os
import threading
from queue import Queue
import traceback

# Add Alfred to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import Alfred components
from alfred import OllamaClient, Project, ChatSession, ChatMessage
from project_manager import ProjectManager
from code_extractor import CodeExtractor
from alfred_logger import get_logger

logger = get_logger(__name__)

class AlfredBridge:
    def __init__(self):
        self.ollama_client = OllamaClient()
        self.project_manager = ProjectManager()
        self.code_extractor = CodeExtractor()
        self.input_queue = Queue()
        self.running = True
        
    def handle_message(self, message):
        """Handle incoming message from TypeScript"""
        try:
            msg_type = message.get('type')
            msg_id = message.get('id')
            data = message.get('data', {})
            
            if msg_type == 'call':
                method = data.get('method')
                params = data.get('params', {})
                
                # Call the requested method
                if hasattr(self, f'rpc_{method}'):
                    result = getattr(self, f'rpc_{method}')(**params)
                    self.send_response(msg_id, result=result)
                else:
                    self.send_response(msg_id, error=f'Unknown method: {method}')
            else:
                # Handle other message types
                self.send_message(msg_type, data)
                
        except Exception as e:
            logger.error(f"Error handling message: {e}")
            if msg_id:
                self.send_response(msg_id, error=str(e))
    
    def send_message(self, msg_type, data):
        """Send a message to TypeScript"""
        message = {
            'type': msg_type,
            'data': data
        }
        print(json.dumps(message))
        sys.stdout.flush()
    
    def send_response(self, msg_id, result=None, error=None):
        """Send a response to a call"""
        message = {
            'type': 'response',
            'id': msg_id,
            'data': {
                'result': result,
                'error': error
            }
        }
        print(json.dumps(message))
        sys.stdout.flush()
    
    # RPC Methods
    def rpc_create_project(self, name, path, project_type=None):
        """Create a new project"""
        project = self.project_manager.create_project(name, path, project_type)
        return project.to_dict()
    
    def rpc_load_project(self, path):
        """Load an existing project"""
        project = self.project_manager.load_project(path)
        return project.to_dict() if project else None
    
    def rpc_create_chat_session(self, project_path, name):
        """Create a new chat session"""
        project = self.project_manager.get_project(project_path)
        if project:
            session = self.project_manager.create_chat_session(project, name)
            return session.to_dict()
        return None
    
    def rpc_send_chat(self, project_path, session_id, message, context_files=None):
        """Send a chat message and get response"""
        # This will be handled asynchronously
        threading.Thread(
            target=self._handle_chat,
            args=(project_path, session_id, message, context_files)
        ).start()
        return {'status': 'processing'}
    
    def _handle_chat(self, project_path, session_id, message, context_files):
        """Handle chat in a separate thread"""
        try:
            # Get project and session
            project = self.project_manager.get_project(project_path)
            if not project or session_id not in project.chat_sessions:
                self.send_message('error', {'message': 'Invalid project or session'})
                return
            
            session = project.chat_sessions[session_id]
            
            # Add context from files if provided
            context = ""
            if context_files:
                for file_path in context_files:
                    try:
                        with open(file_path, 'r') as f:
                            context += f"\\n\\n--- {file_path} ---\\n{f.read()}"
                    except Exception as e:
                        logger.error(f"Error reading context file {file_path}: {e}")
            
            # Build full message with context
            full_message = message
            if context:
                full_message = f"Context files:{context}\\n\\nUser question: {message}"
            
            # Get response from Ollama
            response = self.ollama_client.chat(full_message, session.messages)
            
            # Update session
            session.messages.append(ChatMessage('user', message))
            session.messages.append(ChatMessage('assistant', response))
            
            # Send response
            self.send_message('chat', {
                'session_id': session_id,
                'message': response,
                'role': 'assistant'
            })
            
        except Exception as e:
            logger.error(f"Error in chat handler: {e}")
            self.send_message('error', {'message': str(e)})
    
    def rpc_extract_code(self, text):
        """Extract code blocks from text"""
        blocks = self.code_extractor.extract_code_blocks(text)
        return [{'language': b.language, 'content': b.content} for b in blocks]
    
    def rpc_get_project_structure(self, path):
        """Get project file structure"""
        structure = self.project_manager.get_project_structure(path)
        return structure
    
    def run(self):
        """Main loop to process messages"""
        logger.info("Alfred Bridge started")
        
        # Send ready status
        self.send_message('status', {'ready': True})
        
        # Read messages from stdin
        while self.running:
            try:
                line = sys.stdin.readline()
                if not line:
                    break
                    
                message = json.loads(line.strip())
                self.handle_message(message)
                
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON: {e}")
            except KeyboardInterrupt:
                break
            except Exception as e:
                logger.error(f"Unexpected error: {e}")
                
        logger.info("Alfred Bridge stopped")

if __name__ == '__main__':
    bridge = AlfredBridge()
    bridge.run()
`;

  const fs = await import('fs/promises');
  const bridgeScriptPath = path.join(alfredPath, 'alfred_bridge.py');
  await fs.writeFile(bridgeScriptPath, bridgeScript, 'utf8');
}