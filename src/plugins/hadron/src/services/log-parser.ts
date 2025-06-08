import { 
  ILogParser, 
  ParsedCrashData, 
  ErrorMessage, 
  StackTrace, 
  StackFrame, 
  SystemInfo,
  LogTimestamp
} from '../interfaces';

/**
 * Service for parsing raw crash logs into structured data
 */
export class LogParser implements ILogParser {
  // Regular expressions for parsing different log elements
  private timestampRegex = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[+-]\d{2}:?\d{2}|Z)?)[\s\[\]]+((?:ERROR|INFO|WARN|DEBUG|TRACE|FATAL)?)[\s\]\[:]+(.*?)$/gm;
  private errorMessageRegex = /\[?(ERROR|FATAL|EXCEPTION|FAILURE)\]?\s+(.*?)($|\n)/gm;
  private stackTraceStartRegex = /((?:Exception|Error)(?:\s+in\s+|\s*:\s*|\s+at\s+))(.*?)$/m;
  private stackFrameRegex = /\s+at\s+(.+?)\((.+?):(\d+)\)/g;
  private systemInfoRegex = {
    osType: /OS(?:\s+Type)?[\s:]+\s*([^,\n\r]+)/i,
    osVersion: /OS(?:\s+Version)?[\s:]+\s*([^\n\r]+)/i,
    deviceModel: /(?:Device|Model|Hardware)[\s:]+\s*([^\n\r]+)/i,
    appVersion: /(?:App|Application|Version)[\s:]+\s*([^\n\r]+)/i,
    memory: /(?:Memory|RAM)(?:\s+usage)?[\s:]+\s*([^\n\r]+)/i,
    cpu: /CPU(?:\s+usage)?[\s:]+\s*([^\n\r]+)/i
  };
  
  /**
   * Parse a raw crash log into a structured format
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
    
    // Extract timestamps
    parsedData.timestamps = this.extractTimestamps(content);
    
    // Extract error messages
    parsedData.errorMessages = this.extractErrorMessages(content);
    
    // Extract stack traces
    parsedData.stackTraces = this.extractStackTraces(content);
    
    // Extract system information
    parsedData.systemInfo = this.extractSystemInfo(content);
    
    // Count log levels
    parsedData.logLevel = this.countLogLevels(content);
    
    return parsedData;
  }
  
  /**
   * Check if this parser supports the given log format
   */
  supportsFormat(content: string, metadata?: any): boolean {
    // Check if the content looks like a crash log
    // This is a simple check; for a real implementation, we would have more sophisticated format detection
    return (
      content.includes('Exception') || 
      content.includes('Error') || 
      content.includes('FATAL') || 
      content.includes('CRASH') ||
      content.match(/\s+at\s+.+\(.+:\d+\)/) !== null // Stack trace format
    );
  }
  
  /**
   * Extract timestamped log entries
   */
  private extractTimestamps(content: string): LogTimestamp[] {
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
    
    return timestamps;
  }
  
  /**
   * Extract error messages from the log
   */
  private extractErrorMessages(content: string): ErrorMessage[] {
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
            lineNumber: frameMatch[3] ? parseInt(frameMatch[3], 10) : undefined
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
   */
  private extractSystemInfo(content: string): SystemInfo {
    const systemInfo: SystemInfo = {};
    
    for (const [key, regex] of Object.entries(this.systemInfoRegex)) {
      const match = regex.exec(content);
      if (match) {
        (systemInfo as any)[key] = match[1].trim();
      }
    }
    
    return systemInfo;
  }
  
  /**
   * Count occurrences of each log level
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
}