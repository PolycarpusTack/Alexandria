import * as crypto from 'crypto';
import * as path from 'path';
import { Logger } from '../../../../utils/logger';

/**
 * File validation result interface
 */
export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
  checksum?: string;
  sanitizedFileName?: string;
  detectedType?: string;
  securityRisks?: string[];
}

/**
 * Validation options interface
 */
export interface FileValidationOptions {
  maxSizeBytes: number;
  allowedExtensions: string[];
  allowedMimeTypes: string[];
  enableMalwareScan?: boolean;
  enableDeepContentValidation?: boolean;
  allowedCharactersInFileName?: RegExp;
}

/**
 * Service for comprehensive file validation and security
 */
export class FileValidator {
  private readonly DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly DEFAULT_ALLOWED_EXTENSIONS = [
    '.txt',
    '.log',
    '.json',
    '.xml',
    '.html',
    '.md',
    '.stacktrace',
    '.crash',
    '.py',
    '.js',
    '.ts',
    '.jsx',
    '.tsx',
    '.java',
    '.cpp',
    '.h',
    '.cs'
  ];
  private readonly DEFAULT_ALLOWED_MIME_TYPES = [
    'text/plain',
    'text/html',
    'text/csv',
    'text/markdown',
    'application/json',
    'application/xml',
    'application/octet-stream',
    'text/javascript',
    'application/javascript',
    'text/x-python',
    'text/x-java'
  ];
  private readonly DEFAULT_ALLOWED_CHARS = /^[a-zA-Z0-9_\-. ]+$/;

  // Suspicious patterns to detect potential security threats
  private readonly SUSPICIOUS_PATTERNS = [
    // Script injection patterns
    /<script\b[^>]*>([\s\S]*?)<\/script>/gi,
    /<\?php/gi,

    // Command execution in various languages
    /\beval\s*\(/gi,
    /\bexec\s*\(/gi,
    /\bsystem\s*\(/gi,
    /\bshell_exec\s*\(/gi,
    /\bproc_open\s*\(/gi,
    /\bos\.system\s*\(/gi,
    /\bsubprocess\s*\.\s*call\s*\(/gi,
    /\bRuntime\s*\.\s*getRuntime\s*\(\s*\)\s*\.\s*exec\s*\(/gi,

    // SQL injection patterns
    /'\s*OR\s*'1'\s*=\s*'1/gi,
    /'\s*OR\s*1\s*=\s*1/gi,
    /\bUNION\s+SELECT\b/gi,
    /\bDROP\s+TABLE\b/gi,

    // Path traversal attempts
    /\.\.\//gi,
    /\.\.\\+/gi,

    // Obfuscation techniques
    /\bunescape\s*\(/gi,
    /\batob\s*\(/gi,
    /\bdocument\s*\.\s*write\s*\(/gi,
    /\bString\.fromCharCode\s*\(/gi,

    // Potentially malicious file headers
    /\bMZ[\x90]\x00\x03\x00/gi, // Executable file header
    /\bPK\x03\x04/gi, // ZIP archive header

    // Suspicious base64 content
    /data:text\/html;base64,/gi
  ];

  // Patterns to identify potential PII and sensitive data
  private readonly SENSITIVE_DATA_PATTERNS = [
    // Emails
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,

    // Credit cards
    /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b/g,

    // Social Security Numbers
    /\b(?!000|666|9\d{2})([0-8]\d{2}|7([0-6]\d|7[012]))([ -]?)(?!00)\d\d\3(?!0000)\d{4}\b/g,

    // API Keys (simplified pattern)
    /\b(?:api[_-]?key|apikey|access[_-]?key|auth[_-]?token)[\s:=]+["']?([a-zA-Z0-9]{20,})/gi,

    // IP addresses
    /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,

    // AWS keys
    /\b(?:AKIA[0-9A-Z]{16})\b/g,

    // Passwords in config/code
    /\b(?:password|passwd|pwd)[\s:=]+["']?([^"'\s]+)/gi,

    // Auth tokens
    /\b(?:auth[_-]?token|bearer|jwt)[\s:=]+["']?([a-zA-Z0-9._-]{20,})/gi
  ];

  private options: FileValidationOptions;

  constructor(
    private logger: Logger,
    options?: Partial<FileValidationOptions>
  ) {
    this.options = {
      maxSizeBytes: options?.maxSizeBytes || this.DEFAULT_MAX_SIZE,
      allowedExtensions: options?.allowedExtensions || this.DEFAULT_ALLOWED_EXTENSIONS,
      allowedMimeTypes: options?.allowedMimeTypes || this.DEFAULT_ALLOWED_MIME_TYPES,
      enableMalwareScan: options?.enableMalwareScan ?? false,
      enableDeepContentValidation: options?.enableDeepContentValidation ?? true,
      allowedCharactersInFileName:
        options?.allowedCharactersInFileName || this.DEFAULT_ALLOWED_CHARS
    };
  }

  /**
   * Comprehensively validate a file for security and data compliance
   *
   * @param buffer File buffer
   * @param filename Original filename
   * @param mimeType MIME type
   * @returns Validation result
   */
  validateFile(buffer: Buffer, filename: string, mimeType: string): FileValidationResult {
    try {
      const result: FileValidationResult = {
        isValid: true,
        warnings: [],
        securityRisks: []
      };

      // 1. Basic validation

      // Check file size
      if (buffer.length > this.options.maxSizeBytes) {
        return {
          isValid: false,
          error: `File too large (${buffer.length} bytes). Maximum size is ${this.options.maxSizeBytes} bytes.`
        };
      }

      // Check file extension
      const extension = path.extname(filename).toLowerCase();
      if (!this.options.allowedExtensions.includes(extension)) {
        return {
          isValid: false,
          error: `File extension ${extension} not allowed. Allowed extensions: ${this.options.allowedExtensions.join(', ')}`
        };
      }

      // Check MIME type
      if (!this.options.allowedMimeTypes.includes(mimeType)) {
        result.warnings!.push(`MIME type ${mimeType} is unusual for the expected content.`);
      }

      // 2. Filename validation

      // Check for directory traversal attempts in filename
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return {
          isValid: false,
          error: 'Invalid characters in filename (potential path traversal attempt).'
        };
      }

      // Check filename character restrictions
      if (!this.options.allowedCharactersInFileName!.test(filename)) {
        result.isValid = false;
        result.error = 'Filename contains invalid characters.';
        return result;
      }

      // 3. Content validation for text files

      if (this.isTextFile(mimeType, extension)) {
        const content = buffer.toString('utf8');

        // Detect file type based on content
        result.detectedType = this.detectFileTypeFromContent(content, extension);

        // Check for suspicious patterns
        const securityIssues = this.checkForSecurityIssues(content);
        if (securityIssues.length > 0) {
          result.securityRisks = securityIssues;

          // Determine if issues are severe enough to reject the file
          const severeIssues = securityIssues.filter(
            (issue) => issue.startsWith('CRITICAL:') || issue.startsWith('HIGH:')
          );

          if (severeIssues.length > 0) {
            result.isValid = false;
            result.error = 'File contains potentially malicious content: ' + severeIssues[0];
            return result;
          } else {
            // Add as warnings
            result.warnings!.push(...securityIssues);
          }
        }

        // Deep content validation (optional)
        if (this.options.enableDeepContentValidation) {
          // Check for sensitive data
          const sensitiveData = this.checkForSensitiveData(content);
          if (sensitiveData.length > 0) {
            result.warnings!.push(
              ...sensitiveData.map((data) => `Possible sensitive data detected: ${data}`)
            );
          }

          // Validate file's internal structure based on detected type
          if (result.detectedType === 'json') {
            try {
              JSON.parse(content);
            } catch (e) {
              result.warnings!.push('File appears to be JSON but could not be parsed correctly.');
            }
          } else if (result.detectedType === 'xml' || result.detectedType === 'html') {
            if (!this.isBalancedXml(content)) {
              result.warnings!.push('File appears to be XML/HTML but has unbalanced tags.');
            }
          }
        }
      } else {
        // Non-text file - limited validation options
        result.warnings!.push('Non-text file type. Limited validation performed.');
      }

      // 4. Calculate checksum for integrity verification
      result.checksum = crypto.createHash('sha256').update(buffer).digest('hex');

      // 5. Generate a sanitized filename if needed
      if (result.warnings!.length > 0) {
        // Create safe filename by replacing non-alphanumeric chars except allowed ones
        result.sanitizedFileName = filename.replace(/[^a-zA-Z0-9_\-.]/g, '_');
      }

      return result;
    } catch (error) {
      this.logger.error('Error during file validation:', {
        error: error instanceof Error ? error.message : String(error),
        filename
      });

      return {
        isValid: false,
        error: `File validation error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Check if the file is a text file
   *
   * @param mimeType MIME type
   * @param extension File extension
   * @returns true if text file
   */
  isTextFile(mimeType: string, extension: string): boolean {
    const textMimeTypes = [
      'text/plain',
      'text/html',
      'text/csv',
      'text/markdown',
      'application/json',
      'application/xml',
      'text/javascript',
      'application/javascript'
    ];

    const textExtensions = [
      '.txt',
      '.log',
      '.json',
      '.xml',
      '.html',
      '.md',
      '.stacktrace',
      '.csv',
      '.js',
      '.py',
      '.ts',
      '.jsx',
      '.tsx',
      '.java',
      '.c',
      '.cpp',
      '.h',
      '.cs'
    ];

    return (
      textMimeTypes.some((type) => mimeType.includes(type)) || textExtensions.includes(extension)
    );
  }

  /**
   * Detect file type based on content
   *
   * @param content File content
   * @param extension File extension
   * @returns Detected type
   */
  detectFileTypeFromContent(content: string, extension: string): string {
    // First check by extension for efficient detection
    if (['.json'].includes(extension)) return 'json';
    if (['.xml', '.html', '.htm'].includes(extension)) return 'xml';
    if (['.py'].includes(extension)) return 'python';
    if (['.js', '.ts', '.jsx', '.tsx'].includes(extension)) return 'javascript';
    if (['.java'].includes(extension)) return 'java';
    if (['.cs'].includes(extension)) return 'csharp';
    if (['.log', '.stacktrace', '.crash'].includes(extension)) return 'log';

    // Fall back to content-based detection

    // JSON detection
    if (
      (content.trim().startsWith('{') && content.trim().endsWith('}')) ||
      (content.trim().startsWith('[') && content.trim().endsWith(']'))
    ) {
      try {
        JSON.parse(content);
        return 'json';
      } catch (e) {
        // Not valid JSON
      }
    }

    // XML/HTML detection
    if (content.trim().startsWith('<') && content.includes('</') && content.includes('>')) {
      if (content.includes('<!DOCTYPE html') || content.includes('<html')) {
        return 'html';
      }
      return 'xml';
    }

    // Python detection
    if (
      content.includes('def ') &&
      content.includes(':') &&
      (content.includes('import ') || content.includes('class '))
    ) {
      return 'python';
    }

    // JavaScript detection
    if (
      (content.includes('function ') || content.includes('=>')) &&
      (content.includes('var ') || content.includes('let ') || content.includes('const '))
    ) {
      return 'javascript';
    }

    // Java detection
    if (
      content.includes('public class ') ||
      content.includes('private class ') ||
      (content.includes('package ') && content.includes('import java.'))
    ) {
      return 'java';
    }

    // C# detection
    if (content.includes('namespace ') && content.includes('using System;')) {
      return 'csharp';
    }

    // Log file detection
    if (
      content.includes('ERROR') ||
      content.includes('WARN') ||
      content.includes('Exception') ||
      content.includes('Stack trace')
    ) {
      return 'log';
    }

    // Default to text
    return 'text';
  }

  /**
   * Check for security issues in the file content
   *
   * @param content File content
   * @returns Array of detected security issues
   */
  checkForSecurityIssues(content: string): string[] {
    // Validate input
    if (!content || typeof content !== 'string') {
      return ['MEDIUM: Empty or invalid content provided for security check'];
    }

    const issues: string[] = [];

    // Set a safety limit for content length to prevent DoS
    const MAX_CONTENT_LENGTH = 10 * 1024 * 1024; // 10MB
    if (content.length > MAX_CONTENT_LENGTH) {
      issues.push('HIGH: Content exceeds maximum allowed size for security scanning');
      // Process only the first portion to avoid excessive CPU usage
      content = content.substring(0, MAX_CONTENT_LENGTH);
    }

    // Check each suspicious pattern with timeout protection
    for (const pattern of this.SUSPICIOUS_PATTERNS) {
      try {
        // Use a non-capturing match to improve performance
        // This will just check if the pattern exists rather than capturing all matches
        const hasMatch = pattern.test(content);

        if (hasMatch) {
          // Different severity based on pattern
          let severity = 'MEDIUM';

          // Critical severity patterns
          if (
            pattern.source.includes('exec') ||
            pattern.source.includes('system') ||
            pattern.source.includes('Runtime') ||
            pattern.source.includes('DROP\\s+TABLE')
          ) {
            severity = 'CRITICAL';
          }
          // High severity patterns
          else if (
            pattern.source.includes('script') ||
            pattern.source.includes('eval') ||
            pattern.source.includes('UNION\\s+SELECT') ||
            pattern.source.includes('\\.\\.\\/')
          ) {
            severity = 'HIGH';
          }

          issues.push(`${severity}: Suspicious pattern detected: ${pattern.source}`);
        }
      } catch (e) {
        // Log regex evaluation errors but continue with other patterns
        this.logger.warn(`Error evaluating security pattern: ${pattern.source}`, {
          error: e instanceof Error ? e.message : String(e)
        });

        // Add a generic warning
        issues.push('MEDIUM: Error during security pattern matching');
      }
    }

    // Additional security checks

    // Check for large blocks of base64-encoded data
    const base64Blocks = content.match(/[A-Za-z0-9+/]{100,}={0,2}/g);
    if (base64Blocks && base64Blocks.length > 0) {
      issues.push('MEDIUM: Large blocks of base64-encoded data detected');

      // Try to decode and check if it's binary data
      try {
        for (const block of base64Blocks) {
          // Validate the base64 string before attempting to decode
          if (!this.isValidBase64(block)) {
            this.logger.warn('Invalid base64 data detected', { blockLength: block.length });
            issues.push('MEDIUM: Invalid base64 data detected');
            continue;
          }

          // Safely decode using buffer with proper error handling
          let decoded;
          try {
            // Use a try-catch within the loop to handle individual decoding errors
            decoded = Buffer.from(block, 'base64').toString('utf8');
          } catch (decodeError) {
            this.logger.warn('Error decoding specific base64 block', {
              error: decodeError instanceof Error ? decodeError.message : String(decodeError),
              blockLength: block.length
            });
            issues.push('MEDIUM: Error decoding base64 data');
            continue;
          }

          // Check if decoded content has high entropy (likely binary)
          if (this.calculateEntropy(decoded) > 5.0) {
            issues.push('HIGH: Base64-encoded binary data detected');
            break;
          }

          // Check if decoded content has suspicious patterns
          let suspiciousContentFound = false;
          for (const pattern of this.SUSPICIOUS_PATTERNS) {
            if (pattern.test(decoded)) {
              issues.push('HIGH: Suspicious content detected in base64-encoded data');
              suspiciousContentFound = true;
              break;
            }
          }

          if (suspiciousContentFound) {
            break;
          }
        }
      } catch (e) {
        // Log the general error for debugging purposes
        this.logger.error('Error processing base64 content', {
          error: e instanceof Error ? e.message : String(e)
        });
        issues.push('MEDIUM: Error processing base64 content');
      }
    }

    // Check for unusual character distributions
    const entropy = this.calculateEntropy(content);
    if (entropy > 6.0) {
      // English text typically has entropy around 4.5-5.5
      issues.push('MEDIUM: Unusually high entropy detected, possibly obfuscated content');
    }

    return issues;
  }

  /**
   * Check for sensitive data in the file content
   *
   * @param content File content
   * @returns Array of detected sensitive data types
   */
  checkForSensitiveData(content: string): string[] {
    const sensitiveData: string[] = [];

    for (const [index, pattern] of this.SENSITIVE_DATA_PATTERNS.entries()) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        let dataType = 'Unknown sensitive data';

        // Map index to data type
        switch (index) {
          case 0:
            dataType = 'Email address';
            break;
          case 1:
            dataType = 'Credit card number';
            break;
          case 2:
            dataType = 'Social Security Number';
            break;
          case 3:
            dataType = 'API key';
            break;
          case 4:
            dataType = 'IP address';
            break;
          case 5:
            dataType = 'AWS key';
            break;
          case 6:
            dataType = 'Password';
            break;
          case 7:
            dataType = 'Authentication token';
            break;
        }

        sensitiveData.push(dataType);
      }
    }

    return sensitiveData;
  }

  /**
   * Check if XML/HTML content has balanced tags
   *
   * @param content XML/HTML content
   * @returns true if balanced
   */
  isBalancedXml(content: string): boolean {
    // Simple tag balance checker
    const tagStack: string[] = [];
    const tagPattern = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;

    let match;
    while ((match = tagPattern.exec(content)) !== null) {
      const tagText = match[0];
      const tagName = match[1].toLowerCase();

      // Skip self-closing tags and comments
      if (tagText.endsWith('/>') || tagName.startsWith('!--')) {
        continue;
      }

      // Check if it's a closing tag
      if (tagText.startsWith('</')) {
        // Stack should not be empty and top should match current closing tag
        if (tagStack.length === 0 || tagStack.pop() !== tagName) {
          return false;
        }
      } else {
        // Opening tag - push to stack
        tagStack.push(tagName);
      }
    }

    // All tags should be matched
    return tagStack.length === 0;
  }

  /**
   * Calculate Shannon entropy of text (measure of randomness)
   *
   * @param text Input text
   * @returns Entropy value
   */
  calculateEntropy(text: string): number {
    const len = text.length;

    // Count character frequencies with a single pass through the text
    // Using a Map instead of a plain object for better performance with large datasets
    const frequencies = new Map<string, number>();

    for (let i = 0; i < len; i++) {
      const char = text[i];
      frequencies.set(char, (frequencies.get(char) || 0) + 1);
    }

    // Calculate entropy in a single pass through the frequency counts
    let entropy = 0;

    // Iterate through the Map entries which is more efficient than Object.values()
    for (const count of frequencies.values()) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  /**
   * Deep scan a file for advanced security issues
   *
   * @param buffer File buffer
   * @param filename Original filename
   * @param mimeType MIME type
   * @returns Security scan results
   */
  async deepSecurityScan(
    buffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<{
    isMalicious: boolean;
    detectedThreats: string[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  }> {
    const detectedThreats: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

    try {
      // Check file signature/magic bytes for common executable or archive formats
      const magicBytes = buffer.slice(0, Math.min(8, buffer.length));
      const magicHex = magicBytes.toString('hex');

      // Define known suspicious file signatures
      const suspiciousSignatures: Record<string, string> = {
        '4d5a': 'Windows executable (MZ)',
        '504b0304': 'ZIP archive',
        '7f454c46': 'ELF executable',
        cafebabe: 'Java class file',
        '425a68': 'BZip2 archive',
        '1f8b08': 'GZip archive'
      };

      // Check if the file starts with any known suspicious signatures
      for (const [signature, description] of Object.entries(suspiciousSignatures)) {
        if (magicHex.startsWith(signature)) {
          detectedThreats.push(`Detected ${description} file format - potential security risk`);
          riskLevel = 'high';
        }
      }

      // For text files, perform additional checks
      if (this.isTextFile(mimeType, path.extname(filename).toLowerCase())) {
        const content = buffer.toString('utf8');

        // Check for known obfuscation techniques
        const obfuscationPatterns = [
          /eval\(atob\(['"`](.*?)['"`]\)\)/gi,
          /eval\(function\(p,a,c,k,e,(?:d|r)\)/gi,
          /\\x([0-9a-f]{2})/gi,
          /String\.fromCharCode\([0-9,\s]+\)/gi
        ];

        for (const pattern of obfuscationPatterns) {
          if (content.match(pattern)) {
            detectedThreats.push('Detected code obfuscation techniques');
            riskLevel = Math.max(
              riskLevel === 'low' ? 0 : riskLevel === 'medium' ? 1 : 2,
              1
            ) as any;
          }
        }

        // Check for encoded shell commands
        const encodedCommandPatterns = [
          /base64 -d/gi,
          /\<\?php.*?system\(/gi,
          /powershell\.exe.*?-enc/gi,
          /cmd.exe\/c/gi
        ];

        for (const pattern of encodedCommandPatterns) {
          if (content.match(pattern)) {
            detectedThreats.push('Detected encoded command execution attempt');
            riskLevel = 'critical';
          }
        }

        // Calculate entropy to detect encrypted or compressed content
        const entropy = this.calculateEntropy(content);
        if (entropy > 7.0) {
          // Higher threshold than general check
          detectedThreats.push(
            `Extremely high entropy (${entropy.toFixed(2)}), possibly encrypted malicious content`
          );
          riskLevel = Math.max(
            riskLevel === 'low' ? 0 : riskLevel === 'medium' ? 1 : riskLevel === 'high' ? 2 : 3,
            2
          ) as any;
        }
      }

      return {
        isMalicious: detectedThreats.length > 0,
        detectedThreats,
        riskLevel
      };
    } catch (error) {
      this.logger.error('Error during deep security scan:', {
        error: error instanceof Error ? error.message : String(error),
        filename
      });

      // Fail closed - if we can't scan it properly, consider it suspicious
      return {
        isMalicious: true,
        detectedThreats: [
          'Error during security scan - file considered suspicious as a precaution'
        ],
        riskLevel: 'medium'
      };
    }
  }

  /**
   * Sanitize a file name to make it safe
   *
   * @param filename Original filename
   * @returns Sanitized filename
   */
  sanitizeFileName(filename: string): string {
    if (!filename || typeof filename !== 'string') {
      return 'unnamed_file.txt';
    }

    // Keep only alphanumeric characters, underscores, hyphens, periods, and spaces
    let sanitized = filename.replace(/[^a-zA-Z0-9_\-.\s]/g, '_');

    // Remove consecutive dots (which could be used to try path traversal)
    sanitized = sanitized.replace(/\.{2,}/g, '.');

    // Ensure it doesn't start with a dot (hidden files)
    if (sanitized.startsWith('.')) {
      sanitized = '_' + sanitized;
    }

    // Remove file extensions that could be executed
    const dangerousExtensions = [
      '.exe',
      '.bat',
      '.cmd',
      '.ps1',
      '.sh',
      '.php',
      '.js',
      '.vbs',
      '.py'
    ];

    // Check if the filename ends with a dangerous extension
    const lowerFileName = sanitized.toLowerCase();
    for (const ext of dangerousExtensions) {
      if (lowerFileName.endsWith(ext)) {
        sanitized = sanitized.slice(0, -ext.length) + '.txt';
        break;
      }
    }

    // Ensure the filename isn't empty after sanitization
    if (!sanitized || sanitized.length === 0) {
      return 'unnamed_file.txt';
    }

    return sanitized;
  }

  /**
   * Validate if a string is valid base64
   *
   * @param str String to check
   * @returns true if valid base64 format
   */
  private isValidBase64(str: string): boolean {
    if (!str || typeof str !== 'string') {
      return false;
    }

    // Check general base64 format (must be at least one character long)
    if (str.length === 0) {
      return false;
    }

    // Check for valid base64 pattern (A-Z, a-z, 0-9, +, /)
    const invalidCharMatch = str.match(/[^A-Za-z0-9+\/=]/g);
    if (invalidCharMatch) {
      return false;
    }

    // Check for valid padding
    const paddingMatch = str.match(/=+$/);
    if (paddingMatch) {
      const paddingLength = paddingMatch[0].length;
      if (paddingLength > 2) {
        return false; // Base64 padding shouldn't be more than 2 characters
      }

      // Check if the length minus padding is divisible by 4
      if ((str.length - paddingLength) % 4 !== 0) {
        return false;
      }
    } else {
      // If no padding, length should be divisible by 4
      if (str.length % 4 !== 0) {
        return false;
      }
    }

    // For extra validation, verify with Buffer
    try {
      // Just try to decode a few bytes as a test
      // This is a lightweight test - don't decode the whole string
      const testStr = str.substring(0, Math.min(str.length, 100));
      Buffer.from(testStr, 'base64');
      return true;
    } catch (e) {
      return false;
    }
  }
}
