/**
 * Comprehensive test suite for CrashAnalyzerOrchestrator
 *
 * Tests cover orchestration of crash analysis operations,
 * delegation to services, and error handling
 */

import { CrashAnalyzerOrchestrator } from '../crash-analyzer-orchestrator';
import { Logger } from '../../../../../utils/logger';
import {
  ILogParser,
  ICrashRepository,
  ParsedCrashData,
  CrashLog,
  CrashAnalysisResult
} from '../../interfaces';
import { FileUploadService } from '../file-upload-service';
import { LLMAnalysisService } from '../llm-analysis-service';
import { SessionManagementService } from '../session-management-service';
import { FileSecurityService, FileScanResult } from '../file-security-service';
import { AnalysisSession, AnalysisSessionStatus, UploadedFile } from '../../models';
import { v4 as uuidv4 } from 'uuid';

// Mock uuid
jest.mock('uuid');

describe('CrashAnalyzerOrchestrator', () => {
  let orchestrator: CrashAnalyzerOrchestrator;
  let mockLogParser: jest.Mocked<ILogParser>;
  let mockCrashRepository: jest.Mocked<ICrashRepository>;
  let mockFileUploadService: jest.Mocked<FileUploadService>;
  let mockLLMAnalysisService: jest.Mocked<LLMAnalysisService>;
  let mockSessionManager: jest.Mocked<SessionManagementService>;
  let mockFileSecurityService: jest.Mocked<FileSecurityService>;
  let mockLogger: jest.Mocked<Logger>;

  const mockSession: AnalysisSession = {
    id: 'session-123',
    userId: 'user-123',
    type: 'crash',
    status: AnalysisSessionStatus.CREATED,
    title: 'Test Session',
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {}
  };

  const mockUploadedFile: UploadedFile = {
    id: 'file-123',
    fileName: 'test.log',
    filePath: '/uploads/test.log',
    mimeType: 'text/plain',
    size: 1024,
    userId: 'user-123',
    sessionId: 'session-123',
    uploadedAt: new Date(),
    metadata: {}
  };

  const mockParsedData: ParsedCrashData = {
    timestamps: [new Date()],
    errorMessages: ['Test error'],
    stackTraces: [{ frames: [] }],
    systemInfo: { os: 'Windows' },
    logLevel: { error: 1 },
    metadata: {}
  };

  const mockAnalysisResult: CrashAnalysisResult = {
    id: 'analysis-123',
    crashLogId: 'log-123',
    timestamp: new Date(),
    summary: 'Test crash summary',
    rootCauses: [{ cause: 'Test cause', confidence: 0.9, explanation: 'Test explanation' }],
    suggestedFixes: [{ fix: 'Test fix', confidence: 0.8, explanation: 'Test fix explanation' }],
    affectedComponents: ['Component A'],
    severity: 'high',
    pattern: 'common-error',
    metadata: {}
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (uuidv4 as jest.Mock).mockReturnValue('mock-uuid');

    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any;

    // Mock dependencies
    mockLogParser = {
      parse: jest.fn().mockResolvedValue(mockParsedData),
      isValidLogContent: jest.fn()
    };

    mockCrashRepository = {
      saveCrashLog: jest.fn().mockResolvedValue(true),
      saveAnalysisResult: jest.fn().mockResolvedValue(true),
      getCrashLogById: jest.fn(),
      getAnalysisById: jest.fn(),
      getAllCrashLogs: jest.fn().mockResolvedValue([]),
      getCrashLogsByUser: jest.fn().mockResolvedValue([]),
      getFilteredCrashLogs: jest.fn().mockResolvedValue([]),
      deleteCrashLog: jest.fn().mockResolvedValue(true)
    };

    mockFileUploadService = {
      processFileUpload: jest.fn().mockResolvedValue(mockUploadedFile),
      getFileMetadata: jest.fn(),
      getSessionFiles: jest.fn(),
      deleteFile: jest.fn()
    } as any;

    mockLLMAnalysisService = {
      analyzeCrashLog: jest.fn().mockResolvedValue(mockAnalysisResult),
      getAvailableModels: jest.fn(),
      testConnection: jest.fn()
    } as any;

    mockSessionManager = {
      createSession: jest.fn().mockResolvedValue(mockSession),
      getSession: jest.fn().mockResolvedValue(mockSession),
      updateSessionStatus: jest.fn(),
      completeSession: jest.fn(),
      failSession: jest.fn(),
      validateSessionOwnership: jest.fn()
    } as any;

    mockFileSecurityService = {
      scanFile: jest.fn().mockResolvedValue({
        fileId: 'file-123',
        riskLevel: 'low',
        detectedThreats: []
      }),
      batchScanSessionFiles: jest.fn(),
      getQuarantinedFiles: jest.fn(),
      releaseFromQuarantine: jest.fn()
    } as any;

    orchestrator = new CrashAnalyzerOrchestrator(
      mockLogParser,
      mockCrashRepository,
      mockFileUploadService,
      mockLLMAnalysisService,
      mockSessionManager,
      mockFileSecurityService,
      mockLogger
    );
  });

  describe('createSession', () => {
    it('should delegate session creation to session manager', async () => {
      const result = await orchestrator.createSession('user-123', 'Test Session', 'Description');

      expect(result).toEqual(mockSession);
      expect(mockSessionManager.createSession).toHaveBeenCalledWith(
        'user-123',
        'Test Session',
        'Description'
      );
    });
  });

  describe('processFileUpload', () => {
    const buffer = Buffer.from('test content');
    const fileName = 'test.log';
    const mimeType = 'text/plain';
    const userId = 'user-123';
    const sessionId = 'session-123';

    it('should process file upload and scan for security', async () => {
      const result = await orchestrator.processFileUpload(
        buffer,
        fileName,
        mimeType,
        userId,
        sessionId
      );

      expect(result).toEqual(mockUploadedFile);
      expect(mockFileUploadService.processFileUpload).toHaveBeenCalledWith(
        buffer,
        fileName,
        mimeType,
        userId,
        sessionId
      );
      expect(mockFileSecurityService.scanFile).toHaveBeenCalledWith('file-123', false);
    });

    it('should warn on high risk security scan', async () => {
      mockFileSecurityService.scanFile.mockResolvedValueOnce({
        fileId: 'file-123',
        riskLevel: 'high',
        detectedThreats: ['malware', 'suspicious-pattern']
      } as FileScanResult);

      await orchestrator.processFileUpload(buffer, fileName, mimeType, userId, sessionId);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Security scan detected high risk file:',
        expect.objectContaining({
          fileId: 'file-123',
          riskLevel: 'high',
          threats: ['malware', 'suspicious-pattern']
        })
      );
    });

    it('should handle security scan errors gracefully', async () => {
      mockFileSecurityService.scanFile.mockRejectedValueOnce(new Error('Scan failed'));

      const result = await orchestrator.processFileUpload(
        buffer,
        fileName,
        mimeType,
        userId,
        sessionId
      );

      expect(result).toEqual(mockUploadedFile);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error during security scan:',
        expect.objectContaining({
          error: 'Scan failed',
          fileId: 'file-123'
        })
      );
    });

    it('should work without security service', async () => {
      const orchestratorNoSecurity = new CrashAnalyzerOrchestrator(
        mockLogParser,
        mockCrashRepository,
        mockFileUploadService,
        mockLLMAnalysisService,
        mockSessionManager,
        null,
        mockLogger
      );

      const result = await orchestratorNoSecurity.processFileUpload(
        buffer,
        fileName,
        mimeType,
        userId,
        sessionId
      );

      expect(result).toEqual(mockUploadedFile);
      expect(mockFileSecurityService.scanFile).not.toHaveBeenCalled();
    });
  });

  describe('analyzeLog', () => {
    const logId = 'log-123';
    const content = 'Error: Test error\nat testFunction';
    const metadata = {
      sessionId: 'session-123',
      userId: 'user-123',
      source: 'test'
    };

    it('should successfully analyze log', async () => {
      const result = await orchestrator.analyzeLog(logId, content, metadata);

      expect(result).toMatchObject({
        id: 'mock-uuid',
        crashLogId: logId,
        summary: 'Test crash summary'
      });

      // Verify workflow
      expect(mockSessionManager.getSession).toHaveBeenCalledWith('session-123');
      expect(mockCrashRepository.saveCrashLog).toHaveBeenCalledTimes(2);
      expect(mockLogParser.parse).toHaveBeenCalledWith(content, metadata);
      expect(mockLLMAnalysisService.analyzeCrashLog).toHaveBeenCalledWith(
        mockParsedData,
        content,
        undefined
      );
      expect(mockCrashRepository.saveAnalysisResult).toHaveBeenCalled();
      expect(mockSessionManager.completeSession).toHaveBeenCalledWith(
        'session-123',
        'Test crash summary'
      );
    });

    it('should throw error for missing inputs', async () => {
      await expect(orchestrator.analyzeLog('', content, metadata)).rejects.toThrow(
        'Log ID, content, and metadata are required'
      );

      await expect(orchestrator.analyzeLog(logId, '', metadata)).rejects.toThrow(
        'Log ID, content, and metadata are required'
      );

      await expect(orchestrator.analyzeLog(logId, content, null)).rejects.toThrow(
        'Log ID, content, and metadata are required'
      );
    });

    it('should throw error for missing sessionId', async () => {
      await expect(orchestrator.analyzeLog(logId, content, { userId: 'user-123' })).rejects.toThrow(
        'Session ID is required in metadata'
      );
    });

    it('should throw error when session not found', async () => {
      mockSessionManager.getSession.mockResolvedValueOnce(null);

      await expect(orchestrator.analyzeLog(logId, content, metadata)).rejects.toThrow(
        'Session not found: session-123'
      );
    });

    it('should handle parsing errors gracefully', async () => {
      const parseError = new Error('Parse failed');
      mockLogParser.parse.mockRejectedValueOnce(parseError);

      const result = await orchestrator.analyzeLog(logId, content, metadata);

      expect(result).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error parsing log:',
        expect.objectContaining({
          error: 'Parse failed'
        })
      );
      // Should continue with minimal parsed data
      expect(mockLLMAnalysisService.analyzeCrashLog).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            parsingError: true,
            errorMessage: 'Parse failed'
          })
        }),
        content,
        undefined
      );
    });

    it('should update session to failed on error', async () => {
      const analysisError = new Error('Analysis failed');
      mockLLMAnalysisService.analyzeCrashLog.mockRejectedValueOnce(analysisError);

      await expect(orchestrator.analyzeLog(logId, content, metadata)).rejects.toThrow(
        analysisError
      );

      expect(mockSessionManager.failSession).toHaveBeenCalledWith('session-123', 'Analysis failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error analyzing log: ${logId}`,
        expect.objectContaining({
          error: 'Analysis failed',
          sessionId: 'session-123'
        })
      );
    });

    it('should update crash log with error info on failure', async () => {
      const analysisError = new Error('Analysis failed');
      mockLLMAnalysisService.analyzeCrashLog.mockRejectedValueOnce(analysisError);

      await expect(orchestrator.analyzeLog(logId, content, metadata)).rejects.toThrow(
        analysisError
      );

      // Should save crash log with error metadata
      const savedCrashLog = mockCrashRepository.saveCrashLog.mock.calls[1][0];
      expect(savedCrashLog.metadata).toMatchObject({
        error: 'Analysis failed',
        analysisError: true,
        errorTimestamp: expect.any(String)
      });
    });

    it('should generate title from error pattern', async () => {
      const errorContent = 'FATAL Error in module.function: Out of memory exception';

      await orchestrator.analyzeLog(logId, errorContent, metadata);

      const savedCrashLog = mockCrashRepository.saveCrashLog.mock.calls[0][0];
      expect(savedCrashLog.title).toBe('module.function: Out of memory exception');
    });

    it('should generate fallback title when no error pattern', async () => {
      const simpleContent = 'Just some log content without errors';

      await orchestrator.analyzeLog(logId, simpleContent, metadata);

      const savedCrashLog = mockCrashRepository.saveCrashLog.mock.calls[0][0];
      expect(savedCrashLog.title).toMatch(/^Log from test \(\d{4}-\d{2}-\d{2}\)$/);
    });

    it('should use provided title from metadata', async () => {
      const metadataWithTitle = { ...metadata, title: 'Custom Title' };

      await orchestrator.analyzeLog(logId, content, metadataWithTitle);

      const savedCrashLog = mockCrashRepository.saveCrashLog.mock.calls[0][0];
      expect(savedCrashLog.title).toBe('Custom Title');
    });
  });

  describe('Repository delegation methods', () => {
    it('should get filtered crash logs', async () => {
      const options = { userId: 'user-123', limit: 10 };
      const mockLogs = [{ id: 'log-1' }, { id: 'log-2' }];
      mockCrashRepository.getFilteredCrashLogs.mockResolvedValueOnce(mockLogs as CrashLog[]);

      const result = await orchestrator.getFilteredCrashLogs(options);

      expect(result).toEqual(mockLogs);
      expect(mockCrashRepository.getFilteredCrashLogs).toHaveBeenCalledWith(options);
    });

    it('should get crash log by ID', async () => {
      const mockLog = { id: 'log-123' } as CrashLog;
      mockCrashRepository.getCrashLogById.mockResolvedValueOnce(mockLog);

      const result = await orchestrator.getCrashLogById('log-123');

      expect(result).toEqual(mockLog);
      expect(mockCrashRepository.getCrashLogById).toHaveBeenCalledWith('log-123');
    });

    it('should delete crash log', async () => {
      const result = await orchestrator.deleteCrashLog('log-123');

      expect(result).toBe(true);
      expect(mockCrashRepository.deleteCrashLog).toHaveBeenCalledWith('log-123');
    });
  });

  describe('Security service delegation', () => {
    it('should scan file for security issues', async () => {
      const scanResult = { fileId: 'file-123', riskLevel: 'low' } as FileScanResult;
      mockFileSecurityService.scanFile.mockResolvedValueOnce(scanResult);

      const result = await orchestrator.scanFileForSecurityIssues('file-123', true);

      expect(result).toEqual(scanResult);
      expect(mockFileSecurityService.scanFile).toHaveBeenCalledWith('file-123', true);
    });

    it('should throw error when security service not available', async () => {
      const orchestratorNoSecurity = new CrashAnalyzerOrchestrator(
        mockLogParser,
        mockCrashRepository,
        mockFileUploadService,
        mockLLMAnalysisService,
        mockSessionManager,
        null,
        mockLogger
      );

      await expect(orchestratorNoSecurity.scanFileForSecurityIssues('file-123')).rejects.toThrow(
        'File security service not initialized'
      );
    });
  });

  describe('Other methods', () => {
    it('should return LLM service instance', () => {
      const llmService = orchestrator.getLlmService();
      expect(llmService).toBe(mockLLMAnalysisService);
    });

    it('should throw error for unimplemented methods', async () => {
      await expect(
        orchestrator.saveCodeSnippet('code', 'javascript', 'user-123', 'session-123')
      ).rejects.toThrow('Code snippet saving should be implemented through a dedicated service');

      await expect(
        orchestrator.analyzeCodeSnippet('snippet-123', 'user-123', 'session-123')
      ).rejects.toThrow('Code snippet analysis should be implemented through the orchestrator');
    });
  });
});
