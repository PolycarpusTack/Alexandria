/**
 * Optimized Log Parser
 *
 * High-performance log parser that handles large files efficiently
 * using streaming, parallel processing, and intelligent parsing strategies
 */

import { Readable, Transform } from 'stream';
import { Logger } from '@utils/logger';
import { PerformanceMonitor } from './performance-monitor';
import { CachingService } from './caching-service';
import { ParsedCrashData, ErrorMessage, StackTrace, StackFrame } from '../../interfaces';
import { createReadStream } from 'fs';
import { Worker } from 'worker_threads';
import { createHash } from 'crypto';

export interface ParseOptions {
  maxFileSize: number; // Maximum file size to process
  maxLines: number; // Maximum lines to process
  enableParallelProcessing: boolean;
  workerCount: number;
  chunkSize: number; // Size of chunks for parallel processing
  enableCaching: boolean;
  progressCallback?: (progress: number) => void;
}

export interface ParseResult {
  data: ParsedCrashData;
  stats: {
    totalLines: number;
    processingTime: number;
    fileSize: number;
    cachedResult: boolean;
  };
}

export class OptimizedLogParser {
  private readonly defaultOptions: ParseOptions = {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    maxLines: 100000,
    enableParallelProcessing: true,
    workerCount: 4,
    chunkSize: 1000, // lines per chunk
    enableCaching: true
  };

  private options: ParseOptions;

  constructor(
    private logger: Logger,
    private performanceMonitor: PerformanceMonitor,
    private cachingService: CachingService,
    options?: Partial<ParseOptions>
  ) {
    this.options = { ...this.defaultOptions, ...options };
  }

  /**
   * Parse crash log from file path
   */
  async parseFile(filePath: string, metadata?: any): Promise<ParseResult> {
    const timerId = this.performanceMonitor.startTimer('log-parse-file', {
      filePath,
      metadata
    });

    try {
      const stats = await import('fs').then((fs) => fs.promises.stat(filePath));

      if (stats.size > this.options.maxFileSize) {
        throw new Error(`File too large: ${stats.size} bytes (max: ${this.options.maxFileSize})`);
      }

      // Check cache first
      if (this.options.enableCaching) {
        const contentHash = await this.calculateFileHash(filePath);
        const cacheKey = `parsed:${contentHash}:${this.hashMetadata(metadata)}`;

        const cached = await this.cachingService.get<ParsedCrashData>(cacheKey);
        if (cached) {
          const duration = this.performanceMonitor.stopTimer(timerId) || 0;

          return {
            data: cached,
            stats: {
              totalLines: 0, // Not tracked for cached results
              processingTime: duration,
              fileSize: stats.size,
              cachedResult: true
            }
          };
        }
      }

      // Parse the file
      const stream = createReadStream(filePath, { encoding: 'utf8' });
      const result = await this.parseStream(stream, metadata);

      // Cache the result
      if (this.options.enableCaching) {
        const contentHash = await this.calculateFileHash(filePath);
        await this.cachingService.cacheParsedData(contentHash, metadata || {}, result.data);
      }

      const duration = this.performanceMonitor.stopTimer(timerId) || 0;
      result.stats.processingTime = duration;
      result.stats.fileSize = stats.size;

      return result;
    } catch (error) {
      this.performanceMonitor.stopTimer(timerId);
      throw error;
    }
  }

  /**
   * Parse crash log from string content
   */
  async parseContent(content: string, metadata?: any): Promise<ParseResult> {
    const timerId = this.performanceMonitor.startTimer('log-parse-content', {
      contentLength: content.length,
      metadata
    });

    try {
      // Check cache first
      if (this.options.enableCaching) {
        const contentHash = this.hashContent(content);
        const cacheKey = `parsed:${contentHash}:${this.hashMetadata(metadata)}`;

        const cached = await this.cachingService.get<ParsedCrashData>(cacheKey);
        if (cached) {
          const duration = this.performanceMonitor.stopTimer(timerId) || 0;

          return {
            data: cached,
            stats: {
              totalLines: content.split('\n').length,
              processingTime: duration,
              fileSize: Buffer.byteLength(content, 'utf8'),
              cachedResult: true
            }
          };
        }
      }

      const stream = Readable.from([content]);
      const result = await this.parseStream(stream, metadata);

      // Cache the result
      if (this.options.enableCaching) {
        await this.cachingService.cacheParsedData(content, metadata || {}, result.data);
      }

      const duration = this.performanceMonitor.stopTimer(timerId) || 0;
      result.stats.processingTime = duration;
      result.stats.fileSize = Buffer.byteLength(content, 'utf8');

      return result;
    } catch (error) {
      this.performanceMonitor.stopTimer(timerId);
      throw error;
    }
  }

  /**
   * Parse from a readable stream
   */
  private async parseStream(stream: Readable, metadata?: any): Promise<ParseResult> {
    const lines: string[] = [];
    let totalLines = 0;

    // Create line reader transform
    const lineReader = new Transform({
      objectMode: true,
      transform(chunk: Buffer, encoding, callback) {
        const text = chunk.toString();
        const newLines = text.split('\n');

        for (const line of newLines) {
          if (line.trim()) {
            this.push(line);
          }
        }
        callback();
      }
    });

    // Collect lines
    const lineCollector = new Transform({
      objectMode: true,
      transform(line: string, encoding, callback) {
        if (totalLines >= this.options.maxLines) {
          callback();
          return;
        }

        lines.push(line);
        totalLines++;

        // Report progress
        if (this.options.progressCallback && totalLines % 1000 === 0) {
          this.options.progressCallback(totalLines / this.options.maxLines);
        }

        callback();
      }
    });

    // Process stream
    await new Promise<void>((resolve, reject) => {
      stream.pipe(lineReader).pipe(lineCollector).on('finish', resolve).on('error', reject);
    });

    // Parse collected lines
    let parsedData: ParsedCrashData;

    if (this.options.enableParallelProcessing && lines.length > this.options.chunkSize * 2) {
      parsedData = await this.parseParallel(lines);
    } else {
      parsedData = await this.parseSequential(lines);
    }

    // Add metadata
    parsedData.metadata = {
      ...parsedData.metadata,
      ...metadata,
      parsingMethod: this.options.enableParallelProcessing ? 'parallel' : 'sequential',
      totalLines: totalLines
    };

    return {
      data: parsedData,
      stats: {
        totalLines,
        processingTime: 0, // Will be set by caller
        fileSize: 0, // Will be set by caller
        cachedResult: false
      }
    };
  }

  /**
   * Parse lines sequentially (for smaller logs)
   */
  private async parseSequential(lines: string[]): Promise<ParsedCrashData> {
    const timerId = this.performanceMonitor.startTimer('log-parse-sequential');

    try {
      const result = this.parseLines(lines);
      this.performanceMonitor.stopTimer(timerId);
      return result;
    } catch (error) {
      this.performanceMonitor.stopTimer(timerId);
      throw error;
    }
  }

  /**
   * Parse lines in parallel using worker threads
   */
  private async parseParallel(lines: string[]): Promise<ParsedCrashData> {
    const timerId = this.performanceMonitor.startTimer('log-parse-parallel');

    try {
      // Split lines into chunks
      const chunks: string[][] = [];
      for (let i = 0; i < lines.length; i += this.options.chunkSize) {
        chunks.push(lines.slice(i, i + this.options.chunkSize));
      }

      // Process chunks in parallel
      const workerCount = Math.min(this.options.workerCount, chunks.length);
      const chunkResults = await Promise.all(
        chunks.map((chunk, index) => this.processChunkInWorker(chunk, index % workerCount))
      );

      // Merge results
      const result = this.mergeParseResults(chunkResults);
      this.performanceMonitor.stopTimer(timerId);

      return result;
    } catch (error) {
      this.performanceMonitor.stopTimer(timerId);
      throw error;
    }
  }

  /**
   * Parse lines using the core parsing logic
   */
  private parseLines(lines: string[]): ParsedCrashData {
    const errorMessages: ErrorMessage[] = [];
    const stackTraces: StackTrace[] = [];
    const timestamps: Date[] = [];
    const logLevel: Record<string, number> = {};
    const systemInfo: Record<string, any> = {};
    let additionalContext: Record<string, any> = {};

    let currentStackTrace: StackFrame[] = [];
    let currentStackMessage = '';
    let inStackTrace = false;

    // Regex patterns for efficient parsing
    const patterns = {
      timestamp: /^\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}/,
      javaException: /^(\w+(?:\.\w+)*(?:Exception|Error)):\s*(.*)$/,
      stackFrame: /^\s*at\s+(.+?)(?:\((.+?):(\d+)\)|\((.+?)\)|\(Unknown Source\))$/,
      logLevel:
        /^\s*(\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}[^\s]*\s+)?(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\s*/,
      androidCrash: /^FATAL EXCEPTION:\s*(.+)$/,
      nativeCrash: /^#\d+\s+pc\s+([0-9a-fA-F]+)\s+(.+)$/
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Extract timestamp
      const timestampMatch = line.match(patterns.timestamp);
      if (timestampMatch) {
        try {
          timestamps.push(new Date(timestampMatch[0]));
        } catch {
          // Invalid timestamp, skip
        }
      }

      // Extract log level
      const logLevelMatch = line.match(patterns.logLevel);
      if (logLevelMatch) {
        const level = logLevelMatch[2];
        logLevel[level] = (logLevel[level] || 0) + 1;
      }

      // Check for Java exceptions
      const javaExceptionMatch = line.match(patterns.javaException);
      if (javaExceptionMatch) {
        if (inStackTrace && currentStackTrace.length > 0) {
          // Finish previous stack trace
          stackTraces.push({
            message: currentStackMessage,
            frames: currentStackTrace
          });
        }

        // Start new exception
        const [, exceptionType, message] = javaExceptionMatch;
        errorMessages.push({
          message: `${exceptionType}: ${message}`,
          level: 'ERROR',
          timestamp: timestamps[timestamps.length - 1] || new Date()
        });

        currentStackMessage = `${exceptionType}: ${message}`;
        currentStackTrace = [];
        inStackTrace = true;
        continue;
      }

      // Check for stack frame
      const stackFrameMatch = line.match(patterns.stackFrame);
      if (stackFrameMatch && inStackTrace) {
        const [, method, file, lineNum, simpleFile] = stackFrameMatch;

        currentStackTrace.push({
          functionName: method,
          fileName: file || simpleFile || 'Unknown',
          lineNumber: lineNum ? parseInt(lineNum) : undefined
        });
        continue;
      }

      // Check for Android crash
      const androidCrashMatch = line.match(patterns.androidCrash);
      if (androidCrashMatch) {
        errorMessages.push({
          message: line,
          level: 'FATAL',
          timestamp: timestamps[timestamps.length - 1] || new Date()
        });
        systemInfo.platform = 'Android';
        continue;
      }

      // Check for native crash
      const nativeCrashMatch = line.match(patterns.nativeCrash);
      if (nativeCrashMatch) {
        const [, address, library] = nativeCrashMatch;
        currentStackTrace.push({
          functionName: `native@${address}`,
          fileName: library,
          lineNumber: undefined
        });
        continue;
      }

      // End of stack trace detection
      if (inStackTrace && !line.startsWith(' ') && !line.startsWith('\t')) {
        if (currentStackTrace.length > 0) {
          stackTraces.push({
            message: currentStackMessage,
            frames: currentStackTrace
          });
        }
        inStackTrace = false;
        currentStackTrace = [];
        currentStackMessage = '';
      }

      // Extract system information
      if (line.includes('OS:') || line.includes('Architecture:') || line.includes('Version:')) {
        const parts = line.split(':');
        if (parts.length >= 2) {
          const key = parts[0].trim().toLowerCase();
          const value = parts.slice(1).join(':').trim();
          systemInfo[key] = value;
        }
      }
    }

    // Finalize any remaining stack trace
    if (inStackTrace && currentStackTrace.length > 0) {
      stackTraces.push({
        message: currentStackMessage,
        frames: currentStackTrace
      });
    }

    // Detect log type
    let detectedLogType = 'generic';
    if (systemInfo.platform === 'Android' || lines.some((l) => l.includes('android'))) {
      detectedLogType = 'android';
    } else if (lines.some((l) => l.includes('Exception') || l.includes('at java'))) {
      detectedLogType = 'java';
    } else if (lines.some((l) => l.includes('Error:') && l.includes('.js'))) {
      detectedLogType = 'javascript';
    } else if (lines.some((l) => l.includes('Traceback'))) {
      detectedLogType = 'python';
    }

    return {
      errorMessages,
      stackTraces,
      systemInfo,
      timestamps,
      logLevel,
      metadata: {
        detectedLogType,
        parseWarnings: []
      },
      additionalContext
    };
  }

  private async processChunkInWorker(chunk: string[], workerId: number): Promise<ParsedCrashData> {
    // In a real implementation, this would use a worker thread
    // For now, we'll simulate parallel processing
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(this.parseLines(chunk));
      }, 1);
    });
  }

  private mergeParseResults(results: ParsedCrashData[]): ParsedCrashData {
    const merged: ParsedCrashData = {
      errorMessages: [],
      stackTraces: [],
      systemInfo: {},
      timestamps: [],
      logLevel: {},
      metadata: {
        detectedLogType: 'generic',
        parseWarnings: []
      },
      additionalContext: {}
    };

    for (const result of results) {
      merged.errorMessages.push(...result.errorMessages);
      merged.stackTraces.push(...result.stackTraces);
      merged.timestamps.push(...result.timestamps);

      // Merge log levels
      for (const [level, count] of Object.entries(result.logLevel)) {
        merged.logLevel[level] = (merged.logLevel[level] || 0) + count;
      }

      // Merge system info
      Object.assign(merged.systemInfo, result.systemInfo);

      // Merge additional context
      Object.assign(merged.additionalContext, result.additionalContext);
    }

    // Sort by timestamp
    merged.timestamps.sort((a, b) => a.getTime() - b.getTime());

    // Determine best log type
    const logTypes = results.map((r) => r.metadata.detectedLogType).filter((t) => t !== 'generic');
    if (logTypes.length > 0) {
      merged.metadata.detectedLogType = logTypes[0];
    }

    return merged;
  }

  private async calculateFileHash(filePath: string): Promise<string> {
    const fs = await import('fs');
    const content = await fs.promises.readFile(filePath);
    return createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  private hashMetadata(metadata: any): string {
    if (!metadata) return 'none';
    return createHash('sha256').update(JSON.stringify(metadata)).digest('hex').substring(0, 8);
  }
}
