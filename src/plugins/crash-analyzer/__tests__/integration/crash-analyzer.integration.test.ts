import { 
  CrashAnalyzerService 
} from '../../src/services/crash-analyzer-service';
import { 
  LogParser 
} from '../../src/services/log-parser';
import { 
  LlmService 
} from '../../src/services/llm-service';
import { 
  ICrashRepository, 
  CrashLog, 
  CrashAnalysisResult, 
  ParsedCrashData 
} from '../../src/interfaces';

// Mock dependencies
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

const mockFeatureFlagService = {
  getValue: jest.fn()
};

// Mock the fetch API
global.fetch = jest.fn();

// Sample crash log
const sampleCrashLog = `
2023-05-10T14:23:18.123Z [ERROR] Application encountered a fatal error
2023-05-10T14:23:18.124Z [INFO] System info: OS: Windows 10, Memory: 16GB, CPU: Intel Core i7
2023-05-10T14:23:18.125Z [ERROR] Exception in thread "main" java.lang.NullPointerException
    at com.example.app.MainService.processItem(MainService.java:45)
    at com.example.app.Controller.handleRequest(Controller.java:23)
    at com.example.app.Server.processRequest(Server.java:156)
    at com.example.app.Main.main(Main.java:32)
2023-05-10T14:23:18.130Z [WARN] Connection pool utilization at 95%
2023-05-10T14:23:18.135Z [INFO] Attempting to recover from error
`;

// Sample parsed data
const sampleParsedData: ParsedCrashData = {
  timestamps: [
    {
      timestamp: new Date('2023-05-10T14:23:18.123Z'),
      level: 'ERROR',
      content: 'Application encountered a fatal error'
    },
    {
      timestamp: new Date('2023-05-10T14:23:18.124Z'),
      level: 'INFO',
      content: 'System info: OS: Windows 10, Memory: 16GB, CPU: Intel Core i7'
    }
  ],
  errorMessages: [
    {
      message: 'Application encountered a fatal error',
      level: 'ERROR',
      timestamp: new Date('2023-05-10T14:23:18.123Z')
    },
    {
      message: 'Exception in thread "main" java.lang.NullPointerException',
      level: 'ERROR',
      timestamp: new Date('2023-05-10T14:23:18.125Z')
    }
  ],
  stackTraces: [
    {
      message: 'java.lang.NullPointerException',
      frames: [
        {
          functionName: 'com.example.app.MainService.processItem',
          fileName: 'MainService.java',
          lineNumber: 45
        },
        {
          functionName: 'com.example.app.Controller.handleRequest',
          fileName: 'Controller.java',
          lineNumber: 23
        },
        {
          functionName: 'com.example.app.Server.processRequest',
          fileName: 'Server.java',
          lineNumber: 156
        },
        {
          functionName: 'com.example.app.Main.main',
          fileName: 'Main.java',
          lineNumber: 32
        }
      ],
      timestamp: new Date('2023-05-10T14:23:18.125Z')
    }
  ],
  systemInfo: {
    osType: 'Windows 10',
    memory: '16GB',
    cpu: 'Intel Core i7'
  },
  logLevel: {
    ERROR: 2,
    INFO: 2,
    WARN: 1,
    DEBUG: 0,
    TRACE: 0,
    FATAL: 0
  },
  metadata: {}
};

// Sample LLM response
const sampleLlmResponse = {
  response: `
{
  "primaryError": "java.lang.NullPointerException",
  "failingComponent": "com.example.app.MainService",
  "potentialRootCauses": [
    {
      "cause": "Null value passed to processItem method",
      "confidence": 85,
      "explanation": "The error occurs in MainService.processItem, indicating a null value was dereferenced within this method.",
      "category": "code-error",
      "supportingEvidence": [
        {
          "description": "NullPointerException at MainService.java:45",
          "location": "MainService.java:45",
          "snippet": "processItem method threw NullPointerException"
        }
      ]
    },
    {
      "cause": "Missing validation check",
      "confidence": 70,
      "explanation": "The method appears to be missing input validation before attempting to use an object.",
      "category": "missing-validation",
      "supportingEvidence": [
        {
          "description": "Call chain suggests direct usage without validation",
          "location": "Controller.java to MainService.java",
          "snippet": "Error propagation shows no catch handlers"
        }
      ]
    }
  ],
  "troubleshootingSteps": [
    "Add null checks in MainService.processItem method",
    "Review input validation in Controller.handleRequest",
    "Check data flow from Controller to MainService",
    "Add exception handling for NullPointerException",
    "Review logs to identify source of null value"
  ],
  "summary": "NullPointerException caused by missing null check in MainService.processItem method."
}`
};

// Mock repository implementation
class MockCrashRepository implements ICrashRepository {
  private crashLogs: Map<string, CrashLog> = new Map();
  private analysisResults: Map<string, CrashAnalysisResult> = new Map();

  async saveCrashLog(crashLog: CrashLog): Promise<void> {
    this.crashLogs.set(crashLog.id, crashLog);
  }

  async getCrashLogById(id: string): Promise<CrashLog | null> {
    return this.crashLogs.get(id) || null;
  }

  async getAllCrashLogs(): Promise<CrashLog[]> {
    return Array.from(this.crashLogs.values());
  }

  async getCrashLogsByUser(userId: string): Promise<CrashLog[]> {
    return Array.from(this.crashLogs.values()).filter(log => log.userId === userId);
  }

  async deleteCrashLog(id: string): Promise<boolean> {
    return this.crashLogs.delete(id);
  }

  async saveAnalysisResult(result: CrashAnalysisResult): Promise<void> {
    this.analysisResults.set(result.id, result);
  }

  async getAnalysisById(id: string): Promise<CrashAnalysisResult | null> {
    return this.analysisResults.get(id) || null;
  }
}

describe('Crash Analyzer Integration Tests', () => {
  let crashAnalyzerService: CrashAnalyzerService;
  let logParser: LogParser;
  let llmService: LlmService;
  let crashRepository: ICrashRepository;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup fetch mock
    (global.fetch as jest.Mock).mockImplementation((url, options) => {
      // Mock Ollama API responses
      if (url.includes('/api/tags')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama2:8b-chat-q4' }] })
        });
      } else if (url.includes('/api/show')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ size: 4000000000, parameter_size: '8B' })
        });
      } else if (url.includes('/api/generate')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(sampleLlmResponse)
        });
      }
      
      // Default response
      return Promise.resolve({
        ok: false,
        statusText: 'Not Found'
      });
    });
    
    // Setup feature flag mock
    mockFeatureFlagService.getValue.mockResolvedValue(null);

    // Initialize components
    crashRepository = new MockCrashRepository();
    logParser = new LogParser();
    llmService = new LlmService(mockFeatureFlagService as any);
    crashAnalyzerService = new CrashAnalyzerService(
      logParser,
      llmService as any,
      crashRepository,
      mockLogger as any
    );
  });

  describe('End-to-end analysis workflow', () => {
    it('should analyze a crash log and store the results', async () => {
      // Spy on the internal methods
      const parseSpy = jest.spyOn(logParser, 'parse');
      const analyzeSpy = jest.spyOn(llmService, 'analyzeLog');
      
      // Test data
      const logId = 'test-log-id';
      const metadata = { userId: 'test-user' };
      
      // Execute the analysis
      const result = await crashAnalyzerService.analyzeLog(logId, sampleCrashLog, metadata);
      
      // Verify the components were called correctly
      expect(parseSpy).toHaveBeenCalledWith(sampleCrashLog, expect.anything());
      expect(analyzeSpy).toHaveBeenCalled();
      
      // Verify repository calls
      const savedLog = await crashRepository.getCrashLogById(logId);
      expect(savedLog).not.toBeNull();
      expect(savedLog?.content).toBe(sampleCrashLog);
      expect(savedLog?.userId).toBe('test-user');
      
      // Verify analysis result
      expect(result).toBeDefined();
      expect(result.crashLogId).toBe(logId);
      expect(result.primaryError).toBe('java.lang.NullPointerException');
      expect(result.potentialRootCauses.length).toBeGreaterThan(0);
      expect(result.troubleshootingSteps.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
      
      // Verify the saved analysis
      const savedAnalysis = await crashRepository.getAnalysisById(result.id);
      expect(savedAnalysis).not.toBeNull();
      expect(savedAnalysis?.id).toBe(result.id);
    });

    it('should handle errors during log analysis', async () => {
      // Make the LLM service throw an error
      (llmService as any).analyzeLog = jest.fn().mockRejectedValue(new Error('LLM Error'));
      
      // Test data
      const logId = 'error-log-id';
      const metadata = { userId: 'test-user' };
      
      // Execute the analysis and expect it to throw
      await expect(crashAnalyzerService.analyzeLog(logId, sampleCrashLog, metadata))
        .rejects.toThrow();
      
      // Verify error logging
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Log parser functionality', () => {
    it('should extract error messages and stack traces from crash logs', async () => {
      const parsedData = await logParser.parse(sampleCrashLog);
      
      // Verify error messages
      expect(parsedData.errorMessages.length).toBeGreaterThan(0);
      expect(parsedData.errorMessages[0].message).toContain('fatal error');
      
      // Verify stack traces
      expect(parsedData.stackTraces.length).toBeGreaterThan(0);
      expect(parsedData.stackTraces[0].message).toContain('NullPointerException');
      expect(parsedData.stackTraces[0].frames.length).toBeGreaterThan(0);
      
      // Verify system info
      expect(parsedData.systemInfo.osType).toBe('Windows 10');
      
      // Verify log levels
      expect(parsedData.logLevel.ERROR).toBeGreaterThan(0);
    });
  });

  describe('LLM service functionality', () => {
    it('should generate analysis using Ollama API', async () => {
      // Bypass the model check
      (llmService as any).getModelToUse = jest.fn().mockResolvedValue('llama2:8b-chat-q4');
      
      const result = await llmService.analyzeLog(sampleParsedData, sampleCrashLog);
      
      // Verify API was called correctly
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/generate'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: expect.stringContaining('analyze')
        })
      );
      
      // Verify result
      expect(result.primaryError).toBe('java.lang.NullPointerException');
      expect(result.failingComponent).toBe('com.example.app.MainService');
      expect(result.potentialRootCauses.length).toBe(2);
      expect(result.troubleshootingSteps.length).toBe(5);
    });

    it('should handle API errors gracefully', async () => {
      // Make fetch fail
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      // Bypass the model check
      (llmService as any).getModelToUse = jest.fn().mockResolvedValue('llama2:8b-chat-q4');
      
      const result = await llmService.analyzeLog(sampleParsedData, sampleCrashLog);
      
      // Should return a fallback analysis
      expect(result.primaryError).toBe('java.lang.NullPointerException');
      expect(result.potentialRootCauses[0].cause).toContain('failed');
      expect(result.confidence).toBe(0);
    });
  });

  describe('Repository operations', () => {
    it('should save and retrieve crash logs by ID', async () => {
      // Create a test crash log
      const crashLog: CrashLog = {
        id: 'test-id',
        title: 'Test Crash',
        content: sampleCrashLog,
        uploadedAt: new Date(),
        userId: 'test-user',
        metadata: { source: 'test' }
      };
      
      // Save it
      await crashRepository.saveCrashLog(crashLog);
      
      // Retrieve it
      const retrieved = await crashRepository.getCrashLogById('test-id');
      
      expect(retrieved).not.toBeNull();
      expect(retrieved?.title).toBe('Test Crash');
      expect(retrieved?.content).toBe(sampleCrashLog);
    });

    it('should retrieve crash logs by user ID', async () => {
      // Create test crash logs for different users
      const crashLog1: CrashLog = {
        id: 'log1',
        title: 'User A Crash',
        content: 'error',
        uploadedAt: new Date(),
        userId: 'user-a',
        metadata: {}
      };
      
      const crashLog2: CrashLog = {
        id: 'log2',
        title: 'User B Crash',
        content: 'error',
        uploadedAt: new Date(),
        userId: 'user-b',
        metadata: {}
      };
      
      await crashRepository.saveCrashLog(crashLog1);
      await crashRepository.saveCrashLog(crashLog2);
      
      // Retrieve logs for User A
      const userALogs = await crashRepository.getCrashLogsByUser('user-a');
      
      expect(userALogs.length).toBe(1);
      expect(userALogs[0].id).toBe('log1');
      expect(userALogs[0].title).toBe('User A Crash');
    });
  });
});