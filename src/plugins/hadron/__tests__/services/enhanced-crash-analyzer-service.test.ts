import { EnhancedCrashAnalyzerService } from '../../src/services/enhanced-crash-analyzer-service';
import { LogParser } from '../../src/services/log-parser';
import { LlmService } from '../../src/services/llm-service';
import { ICrashRepository, AnalysisSession, AnalysisSessionStatus } from '../../src/interfaces';
import { sampleCrashLog, sampleCodeSnippet, sampleSnippetAnalysis } from '../test-utils';
import { EnterpriseChunker } from '../../src/utils/enterprise-chunker';

// Mock dependencies
jest.mock('../../src/utils/enterprise-chunker');

describe('EnhancedCrashAnalyzerService', () => {
  let service: EnhancedCrashAnalyzerService;
  let mockLogParser: jest.Mocked<LogParser>;
  let mockLlmService: jest.Mocked<LlmService>;
  let mockRepository: jest.Mocked<ICrashRepository>;
  let mockSessionRepository: jest.Mocked<any>;
  let mockLogger: jest.Mocked<any>;

  beforeEach(() => {
    // Create mock implementations
    mockLogParser = {
      parse: jest.fn()
    } as unknown as jest.Mocked<LogParser>;

    mockLlmService = {
      analyzeLog: jest.fn(),
      getAvailableModels: jest.fn(),
      checkAvailability: jest.fn(),
      analyzeCodeSnippet: jest.fn()
    } as unknown as jest.Mocked<LlmService>;

    mockRepository = {
      saveCrashLog: jest.fn(),
      getCrashLogById: jest.fn(),
      getAllCrashLogs: jest.fn(),
      getCrashLogsByUser: jest.fn(),
      deleteCrashLog: jest.fn(),
      saveAnalysisResult: jest.fn(),
      getAnalysisById: jest.fn()
    } as unknown as jest.Mocked<ICrashRepository>;

    mockSessionRepository = {
      createSession: jest.fn(),
      getSessionById: jest.fn(),
      updateSessionStatus: jest.fn(),
      getAllSessions: jest.fn(),
      deleteSession: jest.fn(),
      addSessionArtifact: jest.fn(),
      getSessionArtifacts: jest.fn(),
      getSessionArtifactById: jest.fn()
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    // Mock the EnterpriseChunker constructor and methods
    (EnterpriseChunker as jest.Mock).mockImplementation(() => ({
      chunkText: jest.fn().mockResolvedValue(['chunk1', 'chunk2']),
      getChunkerInfo: jest.fn().mockReturnValue({
        version: '1.0.0',
        language: 'en',
        maxChunkSize: 4000
      })
    }));

    // Initialize the service
    service = new EnhancedCrashAnalyzerService(
      mockLogParser,
      mockLlmService,
      mockRepository,
      mockSessionRepository,
      mockLogger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeLog method', () => {
    it('should create a session, analyze log, and return result', async () => {
      // Setup mock responses
      mockLogParser.parse.mockResolvedValue(sampleCrashLog.parsedData);
      mockLlmService.analyzeLog.mockResolvedValue(sampleCrashLog.analysis!);
      mockSessionRepository.createSession.mockResolvedValue({ id: 'session-1', status: AnalysisSessionStatus.PENDING });
      mockSessionRepository.updateSessionStatus.mockImplementation((id, status) => Promise.resolve({ id, status }));
      mockRepository.saveCrashLog.mockResolvedValue();
      mockRepository.saveAnalysisResult.mockResolvedValue();

      // Execute the method
      const result = await service.analyzeLog('log-1', 'error content', { source: 'test' });

      // Verify session creation
      expect(mockSessionRepository.createSession).toHaveBeenCalledWith({
        type: 'crash_log',
        status: AnalysisSessionStatus.PENDING,
        metadata: { logId: 'log-1' }
      });

      // Verify log parsing
      expect(mockLogParser.parse).toHaveBeenCalledWith('error content', expect.anything());

      // Verify LLM analysis
      expect(mockLlmService.analyzeLog).toHaveBeenCalledWith(
        expect.anything(),
        'error content',
        undefined
      );

      // Verify session status updates
      expect(mockSessionRepository.updateSessionStatus).toHaveBeenCalledWith(
        'session-1',
        AnalysisSessionStatus.PROCESSING
      );
      expect(mockSessionRepository.updateSessionStatus).toHaveBeenCalledWith(
        'session-1',
        AnalysisSessionStatus.COMPLETED
      );

      // Verify log and analysis saving
      expect(mockRepository.saveCrashLog).toHaveBeenCalled();
      expect(mockRepository.saveAnalysisResult).toHaveBeenCalled();

      // Verify result
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });

    it('should handle errors and update session status accordingly', async () => {
      // Setup mock to throw an error
      mockLogParser.parse.mockRejectedValue(new Error('Parsing failed'));
      mockSessionRepository.createSession.mockResolvedValue({ id: 'session-1', status: AnalysisSessionStatus.PENDING });

      // Execute and catch the error
      await expect(service.analyzeLog('log-1', 'error content', {}))
        .rejects.toThrow('Parsing failed');

      // Verify session status was updated to error
      expect(mockSessionRepository.updateSessionStatus).toHaveBeenCalledWith(
        'session-1',
        AnalysisSessionStatus.ERROR,
        expect.objectContaining({
          error: expect.stringContaining('Parsing failed')
        })
      );

      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should chunk large crash logs using EnterpriseChunker', async () => {
      // Create a large log (over the threshold)
      const largeLog = 'a'.repeat(100000);
      
      // Setup mocks
      mockSessionRepository.createSession.mockResolvedValue({ id: 'session-1', status: AnalysisSessionStatus.PENDING });
      mockLogParser.parse.mockResolvedValue(sampleCrashLog.parsedData);
      mockLlmService.analyzeLog.mockResolvedValue(sampleCrashLog.analysis!);
      
      // Execute the method
      await service.analyzeLog('log-1', largeLog, {});
      
      // Verify EnterpriseChunker was instantiated and used
      expect(EnterpriseChunker).toHaveBeenCalledTimes(1);
      
      // Verify the chunker's chunkText method was called
      const chunkerInstance = (EnterpriseChunker as jest.Mock).mock.instances[0];
      expect(chunkerInstance.chunkText).toHaveBeenCalledWith(largeLog);
    });
  });

  describe('analyzeCodeSnippet method', () => {
    it('should analyze a code snippet and return result', async () => {
      // Setup mocks
      mockSessionRepository.getSessionById.mockResolvedValue({ 
        id: 'session-1', 
        status: AnalysisSessionStatus.PENDING 
      });
      mockSessionRepository.getSessionArtifactById.mockResolvedValue(sampleCodeSnippet);
      mockLlmService.analyzeCodeSnippet.mockResolvedValue(sampleSnippetAnalysis);
      mockSessionRepository.addSessionArtifact.mockResolvedValue({ 
        id: 'analysis-1', 
        sessionId: 'session-1',
        type: 'code_analysis'
      });

      // Execute the method
      const result = await service.analyzeCodeSnippet('snippet-1', 'session-1');

      // Verify session and artifact retrieval
      expect(mockSessionRepository.getSessionById).toHaveBeenCalledWith('session-1');
      expect(mockSessionRepository.getSessionArtifactById).toHaveBeenCalledWith('snippet-1');

      // Verify LLM analysis
      expect(mockLlmService.analyzeCodeSnippet).toHaveBeenCalledWith(
        sampleCodeSnippet.content,
        sampleCodeSnippet.language
      );

      // Verify result saving
      expect(mockSessionRepository.addSessionArtifact).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          type: 'code_analysis',
          metadata: expect.objectContaining({
            snippetId: 'snippet-1'
          })
        })
      );

      // Verify session status update
      expect(mockSessionRepository.updateSessionStatus).toHaveBeenCalledWith(
        'session-1',
        AnalysisSessionStatus.COMPLETED
      );

      // Verify result
      expect(result).toBeDefined();
      expect(result.id).toBe('analysis-1');
    });

    it('should handle errors during code snippet analysis', async () => {
      // Setup mocks to simulate an error
      mockSessionRepository.getSessionById.mockResolvedValue({ 
        id: 'session-1', 
        status: AnalysisSessionStatus.PENDING 
      });
      mockSessionRepository.getSessionArtifactById.mockResolvedValue(sampleCodeSnippet);
      mockLlmService.analyzeCodeSnippet.mockRejectedValue(new Error('Analysis failed'));

      // Execute and catch the error
      await expect(service.analyzeCodeSnippet('snippet-1', 'session-1'))
        .rejects.toThrow('Analysis failed');

      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalled();

      // Verify session status was updated
      expect(mockSessionRepository.updateSessionStatus).toHaveBeenCalledWith(
        'session-1',
        AnalysisSessionStatus.ERROR,
        expect.objectContaining({
          error: expect.stringContaining('Analysis failed')
        })
      );
    });

    it('should throw error when session or snippet not found', async () => {
      // Setup mocks to return null (not found)
      mockSessionRepository.getSessionById.mockResolvedValue(null);

      // Test session not found
      await expect(service.analyzeCodeSnippet('snippet-1', 'non-existent-session'))
        .rejects.toThrow('Session not found');

      // Setup for snippet not found
      mockSessionRepository.getSessionById.mockResolvedValue({ 
        id: 'session-1', 
        status: AnalysisSessionStatus.PENDING 
      });
      mockSessionRepository.getSessionArtifactById.mockResolvedValue(null);

      // Test snippet not found
      await expect(service.analyzeCodeSnippet('non-existent-snippet', 'session-1'))
        .rejects.toThrow('Snippet not found');
    });
  });

  describe('saveCodeSnippet method', () => {
    it('should save a code snippet and return the artifact', async () => {
      // Setup mocks
      mockSessionRepository.getSessionById.mockResolvedValue({ 
        id: 'session-1', 
        status: AnalysisSessionStatus.PENDING 
      });
      mockSessionRepository.addSessionArtifact.mockResolvedValue({
        id: 'snippet-1',
        sessionId: 'session-1',
        type: 'code_snippet'
      });

      // Execute the method
      const result = await service.saveCodeSnippet(
        'function test() { return true; }',
        'javascript',
        'session-1',
        'Test function'
      );

      // Verify session retrieval
      expect(mockSessionRepository.getSessionById).toHaveBeenCalledWith('session-1');

      // Verify snippet saving
      expect(mockSessionRepository.addSessionArtifact).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          type: 'code_snippet',
          content: 'function test() { return true; }',
          metadata: expect.objectContaining({
            language: 'javascript',
            description: 'Test function'
          })
        })
      );

      // Verify result
      expect(result).toBeDefined();
      expect(result.id).toBe('snippet-1');
    });

    it('should create a new session if sessionId is not provided', async () => {
      // Setup mocks
      mockSessionRepository.createSession.mockResolvedValue({ 
        id: 'new-session-1', 
        status: AnalysisSessionStatus.PENDING 
      });
      mockSessionRepository.addSessionArtifact.mockResolvedValue({
        id: 'snippet-1',
        sessionId: 'new-session-1',
        type: 'code_snippet'
      });

      // Execute without sessionId
      const result = await service.saveCodeSnippet(
        'function test() { return true; }',
        'javascript'
      );

      // Verify new session creation
      expect(mockSessionRepository.createSession).toHaveBeenCalledWith({
        type: 'code_analysis',
        status: AnalysisSessionStatus.PENDING
      });

      // Verify snippet saving to the new session
      expect(mockSessionRepository.addSessionArtifact).toHaveBeenCalledWith(
        'new-session-1',
        expect.any(Object)
      );

      // Verify result
      expect(result).toBeDefined();
      expect(result.id).toBe('snippet-1');
    });

    it('should handle errors during code snippet saving', async () => {
      // Setup mocks to simulate an error
      mockSessionRepository.getSessionById.mockResolvedValue({ 
        id: 'session-1', 
        status: AnalysisSessionStatus.PENDING 
      });
      mockSessionRepository.addSessionArtifact.mockRejectedValue(new Error('Save failed'));

      // Execute and catch the error
      await expect(service.saveCodeSnippet(
        'function test() { return true; }',
        'javascript',
        'session-1'
      )).rejects.toThrow('Save failed');

      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getSnippetById method', () => {
    it('should return the snippet by ID', async () => {
      // Setup mock
      mockSessionRepository.getSessionArtifactById.mockResolvedValue(sampleCodeSnippet);

      // Execute
      const result = await service.getSnippetById('snippet-1');

      // Verify
      expect(mockSessionRepository.getSessionArtifactById).toHaveBeenCalledWith('snippet-1');
      expect(result).toEqual(sampleCodeSnippet);
    });

    it('should return null when snippet not found', async () => {
      // Setup mock to return null
      mockSessionRepository.getSessionArtifactById.mockResolvedValue(null);

      // Execute
      const result = await service.getSnippetById('non-existent');

      // Verify
      expect(result).toBeNull();
    });
  });

  describe('getAnalysesBySnippet method', () => {
    it('should return analyses for a snippet', async () => {
      // Setup mock
      mockSessionRepository.getSessionArtifacts.mockResolvedValue([sampleSnippetAnalysis]);

      // Execute
      const result = await service.getAnalysesBySnippet('snippet-1');

      // Verify
      expect(mockSessionRepository.getSessionArtifacts).toHaveBeenCalledWith({
        filterBy: {
          type: 'code_analysis',
          'metadata.snippetId': 'snippet-1'
        }
      });
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(sampleSnippetAnalysis);
    });

    it('should return empty array when no analyses found', async () => {
      // Setup mock to return empty array
      mockSessionRepository.getSessionArtifacts.mockResolvedValue([]);

      // Execute
      const result = await service.getAnalysesBySnippet('snippet-1');

      // Verify
      expect(result).toEqual([]);
    });
  });

  describe('getLlmService method', () => {
    it('should return the LLM service instance', () => {
      // Execute
      const result = service.getLlmService();

      // Verify
      expect(result).toBe(mockLlmService);
    });
  });
});