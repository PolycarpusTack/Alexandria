import {
  ILogParser,
  ParsedCrashData,
  ErrorMessage,
  StackTrace,
  StackFrame,
  SystemInfo,
  LogTimestamp
} from '../interfaces';
import { Logger } from '../../../../utils/logger';
import * as path from 'path';
import { EnterpriseChunker, ChunkingStrategy } from '../utils/enterprise-chunker';

/**
 * Enhanced service for parsing raw crash logs into structured data
 * Supports more file types and integrates with Enterprise Chunker
 */
export class EnhancedLogParser implements ILogParser {
  private logger?: Logger;

  /**
   * Create a new EnhancedLogParser
   *
   * @param logger Optional logger
   */
  constructor(logger?: Logger) {
    this.logger = logger;
  }
  // Regular expressions for parsing common elements
  private timestampRegex =
    /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[+-]\d{2}:?\d{2}|Z)?)[\s\[\]]+((?:ERROR|INFO|WARN|DEBUG|TRACE|FATAL)?)[\s\]\[:]+(.*?)$/gm;
  private errorMessageRegex =
    /((?:ERROR|FATAL|EXCEPTION|FAILURE|CRASH|ASSERTION|PANIC)(?:\s+|:))(.*?)($|\n)/gm;
  private stackTraceStartRegex = /((?:Exception|Error)(?:\s+in\s+|\s*:\s*|\s+at\s+))(.*?)$/m;
  private stackFrameRegex = /\s+at\s+(?:(.+?)\s+\()?(?:(.+?):(\d+)(?::(\d+))?|(native))\)?/gm;

  // Android-specific regex patterns
  private androidExceptionRegex = /([a-zA-Z]+(\.[a-zA-Z]+)+Exception):\s*(.*?)(\n|$)/gm;
  private androidStackFrameRegex = /\s+at\s+([a-zA-Z0-9_$.]+)\(([a-zA-Z0-9_$.]+\.java):(\d+)\)/gm;

  // iOS-specific regex patterns
  private iosExceptionRegex = /^(EXC_BAD_[A-Z_]+)|(FATAL ERROR:)/gm;
  private iosStackFrameRegex =
    /\d+\s+([a-zA-Z0-9_]+)\s+(0x[0-9a-f]+)\s+([a-zA-Z0-9_]+)\s+\+\s+(\d+)/gm;

  // JavaScript-specific patterns
  private jsErrorRegex = /(?:Uncaught\s+)?([a-zA-Z]+Error):\s+(.*?)(\n|$)/gm;
  private jsStackFrameRegex = /at\s+(?:([^(]+)\s+\()?(?:(.+?):(\d+):(\d+))?\)?/gm;

  // Python-specific patterns
  private pythonTracebackRegex = /Traceback \(most recent call last\):/g;
  private pythonFrameRegex = /\s*File\s+"([^"]+)",\s*line\s*(\d+),\s*in\s*(\w+)/gm;
  private pythonExceptionRegex = /([a-zA-Z]+(?:\.[a-zA-Z]+)*(?:Error|Exception)):\s*(.*?)(\n|$)/gm;

  // System information patterns
  private systemInfoRegex = {
    osType: /(?:OS|Operating System)(?:\s+Type)?[\s:]+\s*([^\n\r,;]+)/i,
    osVersion:
      /(?:OS|Operating System)(?:\s+Version)?[\s:]+\s*([^\n\r,;]+)|(?:Android|iOS|Windows|macOS|Linux)\s+([\d\.]+)/i,
    deviceModel: /(?:Device|Model|Hardware)[\s:]+\s*([^\n\r,;]+)/i,
    appVersion: /(?:App|Application|Version|v)[\s:]+\s*([0-9\.]+[^\n\r,;]*)/i,
    memory: /(?:Memory|RAM)(?:\s+usage)?[\s:]+\s*([^\n\r,;]+)/i,
    cpu: /(?:CPU|Processor)(?:\s+usage)?[\s:]+\s*([^\n\r,;]+)/i,
    // Additional system info patterns
    framework: /(?:Framework|Runtime)[\s:]+\s*([^\n\r,;]+)/i,
    screen: /(?:Screen|Display)(?:\s+resolution)?[\s:]+\s*([^\n\r,;]+)/i,
    network: /(?:Network|Connectivity)[\s:]+\s*([^\n\r,;]+)/i,
    battery: /(?:Battery)(?:\s+level)?[\s:]+\s*([^\n\r,;]+)/i
  };

  /**
   * Parse a raw crash log into a structured format
   *
   * @param content Raw log content
   * @param metadata Optional metadata
   * @returns Parsed crash data
   */
  async parse(content: string, metadata?: any): Promise<ParsedCrashData> {
    // Initialize the parsed data
    const parsedData: ParsedCrashData = {
      timestamps: [],
      errorMessages: [],
      stackTraces: [],
      systemInfo: {},
      logLevel: {},
      metadata: metadata || {}
    };

    // Detect log file type
    const logType = this.detectLogType(content, metadata);

    // Store log type in metadata
    parsedData.metadata.detectedLogType = logType;

    // Use appropriate parsing strategy based on log type
    switch (logType) {
      case 'android':
        this.parseAndroidLog(content, parsedData);
        break;
      case 'ios':
        this.parseIOSLog(content, parsedData);
        break;
      case 'javascript':
        this.parseJavaScriptLog(content, parsedData);
        break;
      case 'python':
        this.parsePythonLog(content, parsedData);
        break;
      case 'json':
        this.parseJSONLog(content, parsedData);
        break;
      case 'xml':
        this.parseXMLLog(content, parsedData);
        break;
      default:
        // Default parsing for generic logs
        this.parseGenericLog(content, parsedData);
    }

    // Add standard extracted data (works for most log types)
    parsedData.timestamps = this.extractTimestamps(content);
    parsedData.systemInfo = this.extractSystemInfo(content);
    parsedData.logLevel = this.countLogLevels(content);

    // Enhance with Enterprise Chunker for large logs
    await this.enhanceWithChunker(content, parsedData);

    return parsedData;
  }

  /**
   * Check if this parser supports the given log format
   *
   * @param content Text content
   * @param metadata Optional metadata
   * @returns true if supported
   */
  supportsFormat(content: string, metadata?: any): boolean {
    // Check if content looks like a crash log or if extension indicates a supported type
    if (metadata?.filename) {
      const extension = path.extname(metadata.filename).toLowerCase();
      const supportedExtensions = [
        '.log',
        '.stacktrace',
        '.crash',
        '.txt',
        '.json',
        '.xml',
        '.html'
      ];

      if (supportedExtensions.includes(extension)) {
        return true;
      }
    }

    // Look for crash indicators in the content
    return (
      content.includes('Exception') ||
      content.includes('Error') ||
      content.includes('FATAL') ||
      content.includes('CRASH') ||
      content.match(/\s+at\s+.+\(.+:\d+\)/) !== null || // Stack trace format
      content.includes('Traceback (most recent call last)') || // Python traceback
      content.includes('EXC_BAD_ACCESS') || // iOS crash
      content.match(/Application Terminated/) !== null // Generic app crash
    );
  }

  /**
   * Detect the type of log file
   *
   * @param content Log content
   * @param metadata Optional metadata
   * @returns Log type identifier
   */
  private detectLogType(content: string, metadata?: any): string {
    // First check metadata for hints
    if (metadata?.logType) {
      return metadata.logType;
    }

    if (metadata?.filename) {
      const extension = path.extname(metadata.filename).toLowerCase();
      if (extension === '.json') return 'json';
      if (extension === '.xml') return 'xml';
    }

    // Try to auto-detect from content
    if (
      content.startsWith('{') &&
      content.includes('"') &&
      (content.includes('":"') || content.includes('": "')) &&
      content.includes('}')
    ) {
      return 'json';
    }

    if (
      content.startsWith('<') &&
      (content.includes('<?xml') || content.match(/<.*>[\s\S]*<\/.*>/) !== null)
    ) {
      return 'xml';
    }

    if (
      content.match(this.androidExceptionRegex) !== null &&
      content.match(/(?:android|com\.android|java\.lang)/) !== null
    ) {
      return 'android';
    }

    if (
      content.match(this.iosExceptionRegex) !== null &&
      (content.includes('iOS') ||
        content.includes('iPhone') ||
        content.includes('iPad') ||
        content.includes('SIGABRT') ||
        content.includes('libc++'))
    ) {
      return 'ios';
    }

    if (
      content.match(this.jsErrorRegex) !== null &&
      (content.includes('Chrome') ||
        content.includes('Firefox') ||
        content.includes('Safari') ||
        content.includes('ReferenceError') ||
        content.includes('node:') ||
        content.includes('webpack'))
    ) {
      return 'javascript';
    }

    if (
      content.match(this.pythonTracebackRegex) !== null ||
      (content.match(this.pythonExceptionRegex) !== null && content.includes('File "'))
    ) {
      return 'python';
    }

    // Default to generic log for other types
    return 'generic';
  }

  /**
   * Extract timestamped log entries
   *
   * @param content Log content
   * @returns Array of timestamp objects
   */
  private extractTimestamps(content: string): LogTimestamp[] {
    // Reset regex state
    this.timestampRegex.lastIndex = 0;

    const timestamps: LogTimestamp[] = [];
    let match;

    while ((match = this.timestampRegex.exec(content)) !== null) {
      const timestamp = new Date(match[1]);
      const level = match[2];
      const logContent = match[3];

      if (!isNaN(timestamp.getTime())) {
        timestamps.push({
          timestamp,
          level: level || 'UNKNOWN',
          content: logContent
        });
      }
    }

    // Try to find additional timestamp patterns if none were found
    if (timestamps.length === 0) {
      // Try common log date formats
      const datePatterns = [
        // YYYY-MM-DD HH:MM:SS.mmm
        /(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+(\w+)?\s*(.*)/gm,
        // MM/DD/YYYY HH:MM:SS
        /(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})\s+(\w+)?\s*(.*)/gm,
        // HH:MM:SS
        /(\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+(\w+)?\s*(.*)/gm
      ];

      for (const pattern of datePatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const dateStr = match[1];
          const level = match[2] || 'UNKNOWN';
          const logContent = match[3] || '';

          try {
            const timestamp = new Date(dateStr);
            if (!isNaN(timestamp.getTime())) {
              timestamps.push({
                timestamp,
                level,
                content: logContent
              });
            }
          } catch (e) {
            // Skip invalid dates
          }
        }
      }
    }

    return timestamps;
  }

  /**
   * Extract error messages from the log
   *
   * @param content Log content
   * @returns Array of error message objects
   */
  private extractErrorMessages(content: string): ErrorMessage[] {
    // Reset regex state
    this.errorMessageRegex.lastIndex = 0;

    const errorMessages: ErrorMessage[] = [];
    let match;

    while ((match = this.errorMessageRegex.exec(content)) !== null) {
      const level = match[1].trim().replace(/[:\s]+$/, '');
      const message = match[2].trim();

      errorMessages.push({
        message,
        level,
        // Try to find a timestamp near this error
        timestamp: this.findNearestTimestamp(content, match.index)?.timestamp
      });
    }

    return errorMessages;
  }

  /**
   * Extract stack traces from the log
   *
   * @param content Log content
   * @returns Array of stack trace objects
   */
  private extractStackTraces(content: string): StackTrace[] {
    const stackTraces: StackTrace[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = this.stackTraceStartRegex.exec(line);

      if (match) {
        const message = match[2];
        const frames: StackFrame[] = [];

        // Look ahead for stack frames
        let j = i + 1;
        while (j < lines.length) {
          const frameLine = lines[j];
          const frameMatch = this.stackFrameRegex.exec(frameLine);

          if (!frameMatch) break;

          const frame: StackFrame = {
            functionName: frameMatch[1] || undefined,
            fileName: frameMatch[2] || undefined,
            lineNumber: frameMatch[3] ? parseInt(frameMatch[3], 10) : undefined,
            columnNumber: frameMatch[4] ? parseInt(frameMatch[4], 10) : undefined,
            isNative: !!frameMatch[5]
          };

          frames.push(frame);
          j++;
        }

        if (frames.length > 0) {
          stackTraces.push({
            message,
            frames,
            timestamp: this.findNearestTimestamp(content, match.index)?.timestamp
          });

          // Skip ahead past the stack trace
          i = j - 1;
        }
      }
    }

    return stackTraces;
  }

  /**
   * Extract system information from the log
   *
   * @param content Log content
   * @returns System information object
   */
  private extractSystemInfo(content: string): SystemInfo {
    const systemInfo: SystemInfo = {};

    for (const [key, regex] of Object.entries(this.systemInfoRegex)) {
      const match = regex.exec(content);
      if (match) {
        // Handle groups
        for (let i = 1; i < match.length; i++) {
          if (match[i]) {
            (systemInfo as any)[key] = match[i].trim();
            break;
          }
        }
      }
    }

    // Look for JSON-formatted system info blocks
    const jsonInfoMatch = content.match(/\{[^{]*"(?:system|device|hardware|os)"[^}]*\}/i);
    if (jsonInfoMatch) {
      try {
        const jsonInfo = JSON.parse(jsonInfoMatch[0]);

        // Extract common system properties from JSON
        for (const [key, value] of Object.entries(jsonInfo)) {
          const normalizedKey = key.toLowerCase();

          if (normalizedKey.includes('os') || normalizedKey.includes('system')) {
            systemInfo.osType = String(value);
          } else if (normalizedKey.includes('version') && !normalizedKey.includes('app')) {
            systemInfo.osVersion = String(value);
          } else if (normalizedKey.includes('model') || normalizedKey.includes('device')) {
            systemInfo.deviceModel = String(value);
          } else if (normalizedKey.includes('app') && normalizedKey.includes('version')) {
            systemInfo.appVersion = String(value);
          } else if (normalizedKey.includes('memory') || normalizedKey.includes('ram')) {
            systemInfo.memoryUsage = String(value);
          } else if (normalizedKey.includes('cpu')) {
            systemInfo.cpuUsage = String(value);
          }
        }
      } catch (e) {
        // Ignore JSON parsing errors
      }
    }

    return systemInfo;
  }

  /**
   * Count occurrences of each log level
   *
   * @param content Log content
   * @returns Record with counts for each log level
   */
  private countLogLevels(content: string): Record<string, number> {
    const logLevels = {
      ERROR: 0,
      WARN: 0,
      INFO: 0,
      DEBUG: 0,
      TRACE: 0,
      FATAL: 0
    };

    const logLevelRegex = /\b(ERROR|WARN|INFO|DEBUG|TRACE|FATAL)\b/g;
    let match;

    while ((match = logLevelRegex.exec(content)) !== null) {
      const level = match[1];
      if (level in logLevels) {
        logLevels[level as keyof typeof logLevels]++;
      }
    }

    return logLevels;
  }

  /**
   * Find the nearest timestamp to a given position in the log
   *
   * @param content Log content
   * @param position Character position in log
   * @returns Nearest timestamp object or undefined
   */
  private findNearestTimestamp(content: string, position: number): LogTimestamp | undefined {
    // Save the current regex index
    const lastIndex = this.timestampRegex.lastIndex;
    this.timestampRegex.lastIndex = 0;

    let nearestTimestamp: LogTimestamp | undefined;
    let nearestDistance = Infinity;
    let match;

    while ((match = this.timestampRegex.exec(content)) !== null) {
      const distance = Math.abs(match.index - position);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestTimestamp = {
          timestamp: new Date(match[1]),
          level: match[2] || 'UNKNOWN',
          content: match[3]
        };
      }
    }

    // Restore the regex index
    this.timestampRegex.lastIndex = lastIndex;

    return nearestTimestamp;
  }

  /**
   * Parse Android-specific logs
   *
   * @param content Log content
   * @param parsedData Parsed data to update
   */
  private parseAndroidLog(content: string, parsedData: ParsedCrashData): void {
    // Extract Android-specific exceptions
    this.androidExceptionRegex.lastIndex = 0;
    let match;

    while ((match = this.androidExceptionRegex.exec(content)) !== null) {
      const exceptionType = match[1];
      const message = match[3];

      parsedData.errorMessages.push({
        message: `${exceptionType}: ${message}`,
        level: 'ERROR',
        timestamp: this.findNearestTimestamp(content, match.index)?.timestamp
      });

      // Look for associated stack trace
      const stackTraceStart = match.index + match[0].length;
      const stackTraceSection = content.substring(stackTraceStart, stackTraceStart + 1500); // Look ahead max 1500 chars

      const frames: StackFrame[] = [];
      this.androidStackFrameRegex.lastIndex = 0;
      let frameMatch;

      while ((frameMatch = this.androidStackFrameRegex.exec(stackTraceSection)) !== null) {
        frames.push({
          functionName: frameMatch[1],
          fileName: frameMatch[2],
          lineNumber: parseInt(frameMatch[3], 10)
        });
      }

      if (frames.length > 0) {
        parsedData.stackTraces.push({
          message: `${exceptionType}: ${message}`,
          frames,
          timestamp: this.findNearestTimestamp(content, match.index)?.timestamp
        });
      }
    }

    // Extract Thread information
    const threadRegex = /Thread.*[\[|\(](\d+)[\]|\)].*(CRASHED)/i;
    const threadMatches = content.match(threadRegex);

    if (threadMatches) {
      const threadId = threadMatches[1];
      const threadStatus = threadMatches[2];

      if (!parsedData.metadata.threads) {
        parsedData.metadata.threads = [];
      }

      parsedData.metadata.threads.push({
        id: threadId,
        status: threadStatus
      });
    }

    // Extract Android-specific system info
    const buildVersionRegex = /(?:Build|Android)\s+version[:\s]+\s*([^\n\r,;]+)/i;
    const buildMatch = content.match(buildVersionRegex);

    if (buildMatch && buildMatch[1]) {
      parsedData.systemInfo.osVersion = buildMatch[1].trim();
    }

    const manufacturerRegex = /Manufacturer[:\s]+\s*([^\n\r,;]+)/i;
    const manufacturerMatch = content.match(manufacturerRegex);

    if (manufacturerMatch && manufacturerMatch[1]) {
      if (!parsedData.systemInfo.deviceModel) {
        parsedData.systemInfo.deviceModel = '';
      }

      parsedData.systemInfo.deviceModel =
        manufacturerMatch[1].trim() + ' ' + parsedData.systemInfo.deviceModel;
    }
  }

  /**
   * Parse iOS-specific logs
   *
   * @param content Log content
   * @param parsedData Parsed data to update
   */
  private parseIOSLog(content: string, parsedData: ParsedCrashData): void {
    // Extract iOS exception types
    this.iosExceptionRegex.lastIndex = 0;
    let match;

    while ((match = this.iosExceptionRegex.exec(content)) !== null) {
      const exceptionType = match[1] || match[2];

      // Find the closest line with more details
      const lines = content.split('\n');
      const matchLineIndex = content.substring(0, match.index).split('\n').length - 1;
      let message = exceptionType;

      // Look for more details in nearby lines
      for (let i = matchLineIndex; i < Math.min(matchLineIndex + 5, lines.length); i++) {
        if (lines[i].includes('reason:') || lines[i].includes('Description:')) {
          const reasonMatch = lines[i].match(/(?:reason:|Description:)\s*(.*)/i);
          if (reasonMatch && reasonMatch[1]) {
            message += `: ${reasonMatch[1].trim()}`;
            break;
          }
        }
      }

      parsedData.errorMessages.push({
        message,
        level: 'FATAL',
        timestamp: this.findNearestTimestamp(content, match.index)?.timestamp
      });
    }

    // Extract iOS stack frames
    this.iosStackFrameRegex.lastIndex = 0;
    const frames: StackFrame[] = [];
    let frameMatch;

    while ((frameMatch = this.iosStackFrameRegex.exec(content)) !== null) {
      frames.push({
        functionName: frameMatch[3],
        fileName: frameMatch[1],
        lineNumber: parseInt(frameMatch[4], 10),
        moduleId: frameMatch[2]
      });
    }

    if (frames.length > 0) {
      // Find a message for this stack trace
      let message = 'iOS Crash';

      // Check for common iOS crash messages
      const crashReasonRegex =
        /Exception (?:Type|Subtype|Codes|Message|Reason):[^\n]+(\w+\s+[^\n]+)/i;
      const crashReason = content.match(crashReasonRegex);

      if (crashReason && crashReason[1]) {
        message = crashReason[1].trim();
      }

      parsedData.stackTraces.push({
        message,
        frames,
        timestamp: parsedData.timestamps.length > 0 ? parsedData.timestamps[0].timestamp : undefined
      });
    }

    // Extract iOS-specific system info
    const bundleIdRegex = /Bundle Identifier[:\s]+\s*([^\n\r,;]+)/i;
    const bundleMatch = content.match(bundleIdRegex);

    if (bundleMatch && bundleMatch[1]) {
      if (!parsedData.metadata.bundleIdentifier) {
        parsedData.metadata.bundleIdentifier = bundleMatch[1].trim();
      }
    }

    const deviceTypeRegex = /(?:iPhone|iPad|iPod)[^\n\r,;]*/i;
    const deviceMatch = content.match(deviceTypeRegex);

    if (deviceMatch && deviceMatch[0]) {
      parsedData.systemInfo.deviceModel = deviceMatch[0].trim();
    }
  }

  /**
   * Parse JavaScript-specific logs
   *
   * @param content Log content
   * @param parsedData Parsed data to update
   */
  private parseJavaScriptLog(content: string, parsedData: ParsedCrashData): void {
    // Extract JavaScript errors
    this.jsErrorRegex.lastIndex = 0;
    let match;

    while ((match = this.jsErrorRegex.exec(content)) !== null) {
      const errorType = match[1];
      const message = match[2];

      parsedData.errorMessages.push({
        message: `${errorType}: ${message}`,
        level: 'ERROR',
        timestamp: this.findNearestTimestamp(content, match.index)?.timestamp
      });

      // Look for associated stack trace
      const stackTraceStart = match.index + match[0].length;
      const stackTraceSection = content.substring(stackTraceStart, stackTraceStart + 1500); // Look ahead max 1500 chars

      const frames: StackFrame[] = [];
      this.jsStackFrameRegex.lastIndex = 0;
      let frameMatch;

      while ((frameMatch = this.jsStackFrameRegex.exec(stackTraceSection)) !== null) {
        frames.push({
          functionName: frameMatch[1],
          fileName: frameMatch[2],
          lineNumber: frameMatch[3] ? parseInt(frameMatch[3], 10) : undefined,
          columnNumber: frameMatch[4] ? parseInt(frameMatch[4], 10) : undefined
        });
      }

      if (frames.length > 0) {
        parsedData.stackTraces.push({
          message: `${errorType}: ${message}`,
          frames,
          timestamp: this.findNearestTimestamp(content, match.index)?.timestamp
        });
      }
    }

    // Extract browser/environment info
    const browserRegex = /(Chrome|Firefox|Safari|Edge|Node.js|Electron)\/([0-9.]+)/i;
    const browserMatch = content.match(browserRegex);

    if (browserMatch) {
      const browser = browserMatch[1];
      const version = browserMatch[2];

      if (!parsedData.systemInfo.otherSoftwareInfo) {
        parsedData.systemInfo.otherSoftwareInfo = {};
      }

      parsedData.systemInfo.otherSoftwareInfo.environment = `${browser}/${version}`;
    }
  }

  /**
   * Parse Python-specific logs
   *
   * @param content Log content
   * @param parsedData Parsed data to update
   */
  private parsePythonLog(content: string, parsedData: ParsedCrashData): void {
    // Find Python tracebacks
    const tracebackStarts = [...content.matchAll(this.pythonTracebackRegex)];

    for (const tbStart of tracebackStarts) {
      const startIndex = tbStart.index!;

      // Find the exception after the traceback
      this.pythonExceptionRegex.lastIndex = startIndex;
      const exceptionMatch = this.pythonExceptionRegex.exec(content);

      if (exceptionMatch) {
        const exceptionType = exceptionMatch[1];
        const message = exceptionMatch[2];

        // Extract frames between traceback start and exception
        const tracebackSection = content.substring(startIndex, exceptionMatch.index);

        const frames: StackFrame[] = [];
        this.pythonFrameRegex.lastIndex = 0;
        let frameMatch;

        while ((frameMatch = this.pythonFrameRegex.exec(tracebackSection)) !== null) {
          frames.push({
            fileName: frameMatch[1],
            lineNumber: parseInt(frameMatch[2], 10),
            functionName: frameMatch[3]
          });
        }

        // Add the error message
        parsedData.errorMessages.push({
          message: `${exceptionType}: ${message}`,
          level: 'ERROR',
          timestamp: this.findNearestTimestamp(content, exceptionMatch.index)?.timestamp
        });

        // Add the stack trace if frames were found
        if (frames.length > 0) {
          parsedData.stackTraces.push({
            message: `${exceptionType}: ${message}`,
            frames,
            timestamp: this.findNearestTimestamp(content, startIndex)?.timestamp
          });
        }
      }
    }

    // Extract Python version
    const pythonVersionRegex = /Python\s+(\d+\.\d+\.\d+)/i;
    const versionMatch = content.match(pythonVersionRegex);

    if (versionMatch) {
      if (!parsedData.systemInfo.otherSoftwareInfo) {
        parsedData.systemInfo.otherSoftwareInfo = {};
      }

      parsedData.systemInfo.otherSoftwareInfo.pythonVersion = versionMatch[1];
    }
  }

  /**
   * Parse JSON-formatted logs
   *
   * @param content Log content
   * @param parsedData Parsed data to update
   */
  private parseJSONLog(content: string, parsedData: ParsedCrashData): void {
    try {
      const jsonData = JSON.parse(content);

      // Handle common JSON log formats
      if (jsonData.error || jsonData.exception || jsonData.stacktrace || jsonData.message) {
        // Extract error message
        const errorMessage =
          jsonData.error?.message ||
          jsonData.exception?.message ||
          jsonData.message ||
          jsonData.error ||
          jsonData.exception;

        if (errorMessage) {
          parsedData.errorMessages.push({
            message: String(errorMessage),
            level: jsonData.level || 'ERROR',
            timestamp: jsonData.timestamp ? new Date(jsonData.timestamp) : undefined
          });
        }

        // Extract stack trace
        const stacktrace =
          jsonData.stacktrace ||
          jsonData.stack ||
          jsonData.error?.stacktrace ||
          jsonData.exception?.stacktrace;

        if (stacktrace) {
          // Stack might be an array of frames or a string
          const frames: StackFrame[] = [];

          if (Array.isArray(stacktrace)) {
            // Handle array of frames
            for (const frame of stacktrace) {
              if (typeof frame === 'string') {
                // Parse string frame
                const frameMatch = this.stackFrameRegex.exec(frame);
                if (frameMatch) {
                  frames.push({
                    functionName: frameMatch[1],
                    fileName: frameMatch[2],
                    lineNumber: frameMatch[3] ? parseInt(frameMatch[3], 10) : undefined,
                    columnNumber: frameMatch[4] ? parseInt(frameMatch[4], 10) : undefined,
                    isNative: !!frameMatch[5]
                  });
                }
              } else if (typeof frame === 'object') {
                // Handle object frame
                frames.push({
                  functionName: frame.function || frame.functionName || frame.method,
                  fileName: frame.file || frame.fileName || frame.source,
                  lineNumber: frame.line || frame.lineNumber,
                  columnNumber: frame.column || frame.columnNumber,
                  moduleId: frame.module || frame.moduleId
                });
              }
            }
          } else if (typeof stacktrace === 'string') {
            // Parse string stacktrace
            const stackLines = stacktrace.split('\n');
            for (const line of stackLines) {
              const frameMatch = this.stackFrameRegex.exec(line);
              if (frameMatch) {
                frames.push({
                  functionName: frameMatch[1],
                  fileName: frameMatch[2],
                  lineNumber: frameMatch[3] ? parseInt(frameMatch[3], 10) : undefined,
                  columnNumber: frameMatch[4] ? parseInt(frameMatch[4], 10) : undefined,
                  isNative: !!frameMatch[5]
                });
              }
            }
          }

          if (frames.length > 0) {
            parsedData.stackTraces.push({
              message: String(errorMessage),
              frames,
              timestamp: jsonData.timestamp ? new Date(jsonData.timestamp) : undefined
            });
          }
        }
      }

      // Extract system info
      if (jsonData.system || jsonData.device || jsonData.context || jsonData.systemInfo) {
        const sysInfo =
          jsonData.system || jsonData.device || jsonData.context || jsonData.systemInfo;

        if (typeof sysInfo === 'object') {
          // Map common fields
          const mapping: Record<string, keyof SystemInfo> = {
            os: 'osType',
            osType: 'osType',
            osVersion: 'osVersion',
            os_version: 'osVersion',
            deviceModel: 'deviceModel',
            device_model: 'deviceModel',
            model: 'deviceModel',
            appVersion: 'appVersion',
            app_version: 'appVersion',
            version: 'appVersion',
            memory: 'memoryUsage',
            memoryUsage: 'memoryUsage',
            memory_usage: 'memoryUsage',
            cpu: 'cpuUsage',
            cpuUsage: 'cpuUsage',
            cpu_usage: 'cpuUsage'
          };

          for (const [srcKey, destKey] of Object.entries(mapping)) {
            if (srcKey in sysInfo && sysInfo[srcKey] !== undefined && sysInfo[srcKey] !== null) {
              // Use the appropriate type based on the property name
              // SystemInfo only accepts strings for the direct properties
              if (destKey === 'otherHardwareInfo' || destKey === 'otherSoftwareInfo') {
                // Initialize objects if they don't exist
                if (!parsedData.systemInfo.otherHardwareInfo && destKey === 'otherHardwareInfo') {
                  parsedData.systemInfo.otherHardwareInfo = {};
                }
                if (!parsedData.systemInfo.otherSoftwareInfo && destKey === 'otherSoftwareInfo') {
                  parsedData.systemInfo.otherSoftwareInfo = {};
                }

                // Safely access the property
                if (destKey === 'otherHardwareInfo' && parsedData.systemInfo.otherHardwareInfo) {
                  parsedData.systemInfo.otherHardwareInfo[srcKey] = sysInfo[srcKey];
                } else if (
                  destKey === 'otherSoftwareInfo' &&
                  parsedData.systemInfo.otherSoftwareInfo
                ) {
                  parsedData.systemInfo.otherSoftwareInfo[srcKey] = sysInfo[srcKey];
                }
              } else {
                // For specified string properties
                parsedData.systemInfo[
                  destKey as keyof Omit<SystemInfo, 'otherHardwareInfo' | 'otherSoftwareInfo'>
                ] = String(sysInfo[srcKey]);
              }
            }
          }
        }
      }

      // Extract custom metadata
      if (jsonData.metadata || jsonData.extra || jsonData.context) {
        const metaData = jsonData.metadata || jsonData.extra || jsonData.context;

        if (typeof metaData === 'object') {
          parsedData.metadata = {
            ...parsedData.metadata,
            jsonExtracted: metaData
          };
        }
      }
    } catch (error) {
      // Fall back to generic parsing if JSON parsing fails
      this.parseGenericLog(content, parsedData);
    }
  }

  /**
   * Parse XML-formatted logs
   *
   * @param content Log content
   * @param parsedData Parsed data to update
   */
  private parseXMLLog(content: string, parsedData: ParsedCrashData): void {
    // Simple XML parsing by regex - for more complex needs we would use a full XML parser
    const errorTagRegex = /<error(?:\s+[^>]*)?>([^<]*)<\/error>/gi;
    const exceptionTagRegex =
      /<exception(?:\s+[^>]*)?>[\s\S]*?<message(?:\s+[^>]*)?>([^<]*)<\/message>[\s\S]*?<\/exception>/gi;
    const stackTraceRegex = /<stacktrace(?:\s+[^>]*)?>[\s\S]*?<\/stacktrace>/gi;
    const stackFrameTagRegex = /<frame(?:\s+[^>]*)?>([\s\S]*?)<\/frame>/gi;

    // Extract error messages
    let match;
    while ((match = errorTagRegex.exec(content)) !== null) {
      if (match[1].trim()) {
        parsedData.errorMessages.push({
          message: match[1].trim(),
          level: 'ERROR'
        });
      }
    }

    // Extract exceptions
    while ((match = exceptionTagRegex.exec(content)) !== null) {
      if (match[1].trim()) {
        parsedData.errorMessages.push({
          message: match[1].trim(),
          level: 'ERROR'
        });
      }
    }

    // Extract stack traces
    while ((match = stackTraceRegex.exec(content)) !== null) {
      const stackTraceContent = match[0];
      const frames: StackFrame[] = [];

      // Extract frames from this stack trace
      let frameMatch;
      while ((frameMatch = stackFrameTagRegex.exec(stackTraceContent)) !== null) {
        const frameContent = frameMatch[1];

        // Extract frame attributes
        const functionMatch = /<function>(.*?)<\/function>/.exec(frameContent);
        const fileMatch = /<file>(.*?)<\/file>/.exec(frameContent);
        const lineMatch = /<line>(.*?)<\/line>/.exec(frameContent);
        const columnMatch = /<column>(.*?)<\/column>/.exec(frameContent);

        if (fileMatch || functionMatch) {
          frames.push({
            functionName: functionMatch ? functionMatch[1] : undefined,
            fileName: fileMatch ? fileMatch[1] : undefined,
            lineNumber: lineMatch ? parseInt(lineMatch[1], 10) : undefined,
            columnNumber: columnMatch ? parseInt(columnMatch[1], 10) : undefined
          });
        }
      }

      if (frames.length > 0) {
        // Try to find a message for this stack trace
        let message = 'XML Stack Trace';
        const messageMatch = /<message>(.*?)<\/message>/.exec(stackTraceContent);
        if (messageMatch) {
          message = messageMatch[1];
        }

        parsedData.stackTraces.push({
          message,
          frames
        });
      }
    }

    // Extract system info from XML
    const systemTagRegex = /<system(?:\s+[^>]*)?>[\s\S]*?<\/system>/i;
    const systemMatch = content.match(systemTagRegex);

    if (systemMatch) {
      const systemContent = systemMatch[0];

      // Extract common system properties
      const osMatch = /<os(?:\s+[^>]*)?>([^<]*)<\/os>/i.exec(systemContent);
      const osVersionMatch = /<os_version(?:\s+[^>]*)?>([^<]*)<\/os_version>/i.exec(systemContent);
      const deviceMatch = /<device(?:\s+[^>]*)?>([^<]*)<\/device>/i.exec(systemContent);
      const appVersionMatch = /<app_version(?:\s+[^>]*)?>([^<]*)<\/app_version>/i.exec(
        systemContent
      );

      if (osMatch) parsedData.systemInfo.osType = osMatch[1].trim();
      if (osVersionMatch) parsedData.systemInfo.osVersion = osVersionMatch[1].trim();
      if (deviceMatch) parsedData.systemInfo.deviceModel = deviceMatch[1].trim();
      if (appVersionMatch) parsedData.systemInfo.appVersion = appVersionMatch[1].trim();
    }
  }

  /**
   * Parse generic log format
   *
   * @param content Log content
   * @param parsedData Parsed data to update
   */
  private parseGenericLog(content: string, parsedData: ParsedCrashData): void {
    // Generic parsing - works for most log formats
    parsedData.errorMessages = this.extractErrorMessages(content);
    parsedData.stackTraces = this.extractStackTraces(content);
  }

  /**
   * Enhance parsed data using Enterprise Chunker for large logs
   *
   * @param content Log content
   * @param parsedData Parsed data to update
   */
  private async enhanceWithChunker(content: string, parsedData: ParsedCrashData): Promise<void> {
    // Skip for small logs
    if (content.length < 50000) {
      // 50KB
      return;
    }

    try {
      // Initialize chunker with logger
      const chunker = new EnterpriseChunker(this.logger);

      // Choose strategy based on log type
      let strategy = ChunkingStrategy.ADAPTIVE;
      if (parsedData.metadata.detectedLogType === 'json') {
        strategy = ChunkingStrategy.STRUCTURAL;
      } else if (parsedData.metadata.detectedLogType === 'xml') {
        strategy = ChunkingStrategy.STRUCTURAL;
      } else {
        strategy = ChunkingStrategy.SEMANTIC; // For logs, semantic works better
      }

      // Chunk the content
      const chunks = chunker.adaptive_chunk_text(content, {
        strategy,
        max_tokens_per_chunk: 2000,
        overlap_tokens: 100
      });

      // Keep track of chunks for future reference
      parsedData.metadata.chunks = {
        count: chunks.length,
        strategy,
        maxTokensPerChunk: 2000
      };

      // If no error messages were found with standard parsing, try to extract from chunks
      if (parsedData.errorMessages.length === 0) {
        // Look for error patterns in each chunk
        for (const chunk of chunks) {
          const chunkErrorMessages = this.extractErrorMessages(chunk);
          if (chunkErrorMessages.length > 0) {
            parsedData.errorMessages.push(...chunkErrorMessages);
          }
        }
      }

      // If no stack traces were found, try to extract from chunks
      if (parsedData.stackTraces.length === 0) {
        for (const chunk of chunks) {
          const chunkStackTraces = this.extractStackTraces(chunk);
          if (chunkStackTraces.length > 0) {
            parsedData.stackTraces.push(...chunkStackTraces);
          }
        }
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error('Error enhancing with chunker:', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
      // Continue without chunker enhancement
    }
  }
}
