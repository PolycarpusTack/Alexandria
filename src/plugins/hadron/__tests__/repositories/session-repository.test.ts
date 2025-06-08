import { SessionRepository } from '../../src/repositories/session-repository';
import { AnalysisSession, AnalysisSessionStatus, SessionArtifact } from '../../src/interfaces';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn(),
    writeFile: jest.fn().mockResolvedValue(undefined),
    readdir: jest.fn(),
    stat: jest.fn(),
    unlink: jest.fn().mockResolvedValue(undefined)
  },
  existsSync: jest.fn().mockReturnValue(true)
}));

describe('SessionRepository', () => {
  let repository: SessionRepository;
  let mockLogger: any;
  let mockConfig: any;
  
  // Test data
  const sampleSession: AnalysisSession = {
    id: 'session-1',
    type: 'crash_log',
    status: AnalysisSessionStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: { logId: 'log-1' }
  };
  
  const sampleArtifact: SessionArtifact = {
    id: 'artifact-1',
    sessionId: 'session-1',
    type: 'code_snippet',
    content: 'function test() { return true; }',
    createdAt: new Date(),
    metadata: { language: 'javascript' }
  };
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
    
    // Setup mock config
    mockConfig = {
      dataPath: '/tmp/crash-analyzer-data'
    };
    
    // Mock file system methods
    mockFileSystem();
    
    // Create repository instance
    repository = new SessionRepository(mockConfig, mockLogger);
  });
  
  // Helper to setup file system mocks
  function mockFileSystem() {
    // Mock exists check
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    
    // Mock readFile for different paths
    (fs.promises.readFile as jest.Mock).mockImplementation((filePath) => {
      if (filePath.includes('sessions.json')) {
        return Promise.resolve(JSON.stringify([sampleSession]));
      }
      if (filePath.includes('artifacts.json')) {
        return Promise.resolve(JSON.stringify([sampleArtifact]));
      }
      if (filePath.includes('session-1')) {
        return Promise.resolve(JSON.stringify(sampleSession));
      }
      if (filePath.includes('artifact-1')) {
        return Promise.resolve(JSON.stringify(sampleArtifact));
      }
      return Promise.reject(new Error('File not found'));
    });
    
    // Mock readdir to return session and artifact files
    (fs.promises.readdir as jest.Mock).mockResolvedValue([
      'session-1.json',
      'artifact-1.json'
    ]);
    
    // Mock stat to identify directories vs files
    (fs.promises.stat as jest.Mock).mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true
    });
  }
  
  describe('initialization', () => {
    it('should create data directories if they do not exist', async () => {
      // Mock directories don't exist
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      // Create new instance to trigger directory creation
      const newRepo = new SessionRepository(mockConfig, mockLogger);
      await (newRepo as any).init();
      
      // Verify directories were created
      expect(fs.promises.mkdir).toHaveBeenCalledWith(
        path.join(mockConfig.dataPath, 'sessions'),
        { recursive: true }
      );
      expect(fs.promises.mkdir).toHaveBeenCalledWith(
        path.join(mockConfig.dataPath, 'artifacts'),
        { recursive: true }
      );
    });
  });
  
  describe('createSession', () => {
    it('should create a new session with generated ID', async () => {
      const sessionData = {
        type: 'crash_log',
        status: AnalysisSessionStatus.PENDING,
        metadata: { test: 'data' }
      };
      
      const createdSession = await repository.createSession(sessionData);
      
      // Verify ID was generated
      expect(createdSession.id).toBeDefined();
      
      // Verify session data was saved
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(createdSession.id),
        expect.any(String),
        'utf8'
      );
      
      // Verify timestamps were added
      expect(createdSession.createdAt).toBeInstanceOf(Date);
      expect(createdSession.updatedAt).toBeInstanceOf(Date);
      
      // Verify provided data was kept
      expect(createdSession.type).toBe(sessionData.type);
      expect(createdSession.status).toBe(sessionData.status);
      expect(createdSession.metadata).toEqual(sessionData.metadata);
    });
    
    it('should handle errors during session creation', async () => {
      // Mock writeFile to fail
      (fs.promises.writeFile as jest.Mock).mockRejectedValue(
        new Error('Write error')
      );
      
      await expect(repository.createSession({
        type: 'crash_log',
        status: AnalysisSessionStatus.PENDING
      })).rejects.toThrow('Failed to create session');
      
      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
  
  describe('getSessionById', () => {
    it('should retrieve a session by ID', async () => {
      const session = await repository.getSessionById('session-1');
      
      expect(session).toEqual(expect.objectContaining({
        id: 'session-1',
        type: 'crash_log'
      }));
      
      // Verify file was read
      expect(fs.promises.readFile).toHaveBeenCalledWith(
        expect.stringContaining('session-1'),
        'utf8'
      );
    });
    
    it('should return null for non-existent session', async () => {
      // Mock readFile to fail for this specific ID
      (fs.promises.readFile as jest.Mock).mockImplementation((path) => {
        if (path.includes('non-existent')) {
          return Promise.reject(new Error('ENOENT'));
        }
        return Promise.resolve('{}');
      });
      
      const session = await repository.getSessionById('non-existent');
      
      expect(session).toBeNull();
    });
  });
  
  describe('updateSessionStatus', () => {
    it('should update session status and metadata', async () => {
      // Mock getSessionById and update implementation
      (repository.getSessionById as jest.Mock) = jest.fn().mockResolvedValue({
        ...sampleSession,
        status: AnalysisSessionStatus.PENDING
      });
      
      const updatedSession = await repository.updateSessionStatus(
        'session-1',
        AnalysisSessionStatus.COMPLETED,
        { result: 'success' }
      );
      
      // Verify status was updated
      expect(updatedSession.status).toBe(AnalysisSessionStatus.COMPLETED);
      
      // Verify metadata was merged
      expect(updatedSession.metadata).toEqual(
        expect.objectContaining({
          logId: 'log-1',
          result: 'success'
        })
      );
      
      // Verify updatedAt was modified
      expect(updatedSession.updatedAt).not.toEqual(sampleSession.updatedAt);
      
      // Verify file was written
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('session-1'),
        expect.any(String),
        'utf8'
      );
    });
    
    it('should return null for non-existent session', async () => {
      // Mock getSessionById to return null
      (repository as any).getSessionById = jest.fn().mockResolvedValue(null);
      
      const result = await repository.updateSessionStatus(
        'non-existent',
        AnalysisSessionStatus.COMPLETED
      );
      
      expect(result).toBeNull();
    });
  });
  
  describe('addSessionArtifact', () => {
    it('should add an artifact to a session', async () => {
      const artifactData = {
        type: 'code_snippet',
        content: 'function test() {}',
        metadata: { language: 'javascript' }
      };
      
      const artifact = await repository.addSessionArtifact(
        'session-1',
        artifactData
      );
      
      // Verify ID was generated
      expect(artifact.id).toBeDefined();
      
      // Verify sessionId was assigned
      expect(artifact.sessionId).toBe('session-1');
      
      // Verify createdAt was added
      expect(artifact.createdAt).toBeInstanceOf(Date);
      
      // Verify artifact was saved
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(artifact.id),
        expect.any(String),
        'utf8'
      );
    });
    
    it('should handle errors during artifact creation', async () => {
      // Mock writeFile to fail
      (fs.promises.writeFile as jest.Mock).mockRejectedValue(
        new Error('Write error')
      );
      
      await expect(repository.addSessionArtifact(
        'session-1',
        { type: 'code_snippet', content: 'test' }
      )).rejects.toThrow('Failed to add artifact');
      
      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
  
  describe('getSessionArtifactById', () => {
    it('should retrieve an artifact by ID', async () => {
      const artifact = await repository.getSessionArtifactById('artifact-1');
      
      expect(artifact).toEqual(expect.objectContaining({
        id: 'artifact-1',
        sessionId: 'session-1',
        type: 'code_snippet'
      }));
      
      // Verify file was read
      expect(fs.promises.readFile).toHaveBeenCalledWith(
        expect.stringContaining('artifact-1'),
        'utf8'
      );
    });
    
    it('should return null for non-existent artifact', async () => {
      // Mock readFile to fail for this specific ID
      (fs.promises.readFile as jest.Mock).mockImplementation((path) => {
        if (path.includes('non-existent')) {
          return Promise.reject(new Error('ENOENT'));
        }
        return Promise.resolve('{}');
      });
      
      const artifact = await repository.getSessionArtifactById('non-existent');
      
      expect(artifact).toBeNull();
    });
  });
  
  describe('getSessionArtifacts', () => {
    it('should retrieve all artifacts for a session', async () => {
      // Mock readdir to return multiple artifacts
      (fs.promises.readdir as jest.Mock).mockResolvedValue([
        'artifact-1.json',
        'artifact-2.json'
      ]);
      
      // Mock readFile for artifact-2
      (fs.promises.readFile as jest.Mock).mockImplementation((path) => {
        if (path.includes('artifact-2')) {
          return Promise.resolve(JSON.stringify({
            id: 'artifact-2',
            sessionId: 'session-1',
            type: 'code_analysis'
          }));
        }
        return Promise.resolve(JSON.stringify(sampleArtifact));
      });
      
      const artifacts = await repository.getSessionArtifacts({
        sessionId: 'session-1'
      });
      
      // Should return both artifacts
      expect(artifacts.length).toBe(2);
      expect(artifacts[0].id).toBe('artifact-1');
      expect(artifacts[1].id).toBe('artifact-2');
    });
    
    it('should filter artifacts by type', async () => {
      // Mock readdir to return multiple artifacts of different types
      (fs.promises.readdir as jest.Mock).mockResolvedValue([
        'artifact-1.json', // code_snippet
        'artifact-2.json'  // code_analysis
      ]);
      
      // Mock readFile for artifact-2
      (fs.promises.readFile as jest.Mock).mockImplementation((path) => {
        if (path.includes('artifact-2')) {
          return Promise.resolve(JSON.stringify({
            id: 'artifact-2',
            sessionId: 'session-1',
            type: 'code_analysis'
          }));
        }
        return Promise.resolve(JSON.stringify(sampleArtifact));
      });
      
      const artifacts = await repository.getSessionArtifacts({
        filterBy: { type: 'code_snippet' }
      });
      
      // Should return only code_snippet artifacts
      expect(artifacts.length).toBe(1);
      expect(artifacts[0].id).toBe('artifact-1');
      expect(artifacts[0].type).toBe('code_snippet');
    });
    
    it('should filter artifacts by metadata', async () => {
      // Mock readdir to return multiple artifacts
      (fs.promises.readdir as jest.Mock).mockResolvedValue([
        'artifact-1.json', // language: javascript
        'artifact-3.json'  // language: python
      ]);
      
      // Mock readFile for artifact-3
      (fs.promises.readFile as jest.Mock).mockImplementation((path) => {
        if (path.includes('artifact-3')) {
          return Promise.resolve(JSON.stringify({
            id: 'artifact-3',
            sessionId: 'session-1',
            type: 'code_snippet',
            metadata: { language: 'python' }
          }));
        }
        return Promise.resolve(JSON.stringify(sampleArtifact));
      });
      
      const artifacts = await repository.getSessionArtifacts({
        filterBy: { 'metadata.language': 'python' }
      });
      
      // Should return only python artifacts
      expect(artifacts.length).toBe(1);
      expect(artifacts[0].id).toBe('artifact-3');
      expect(artifacts[0].metadata.language).toBe('python');
    });
  });
  
  describe('getAllSessions', () => {
    it('should retrieve all sessions', async () => {
      // Mock readdir to return multiple sessions
      (fs.promises.readdir as jest.Mock).mockResolvedValue([
        'session-1.json',
        'session-2.json'
      ]);
      
      // Mock readFile for session-2
      (fs.promises.readFile as jest.Mock).mockImplementation((path) => {
        if (path.includes('session-2')) {
          return Promise.resolve(JSON.stringify({
            id: 'session-2',
            type: 'code_analysis',
            status: AnalysisSessionStatus.COMPLETED
          }));
        }
        return Promise.resolve(JSON.stringify(sampleSession));
      });
      
      const sessions = await repository.getAllSessions();
      
      // Should return both sessions
      expect(sessions.length).toBe(2);
      expect(sessions[0].id).toBe('session-1');
      expect(sessions[1].id).toBe('session-2');
    });
    
    it('should filter sessions by type and status', async () => {
      // Mock readdir to return multiple sessions
      (fs.promises.readdir as jest.Mock).mockResolvedValue([
        'session-1.json', // crash_log, PENDING
        'session-2.json', // code_analysis, COMPLETED
        'session-3.json'  // crash_log, COMPLETED
      ]);
      
      // Mock readFile for different sessions
      (fs.promises.readFile as jest.Mock).mockImplementation((path) => {
        if (path.includes('session-2')) {
          return Promise.resolve(JSON.stringify({
            id: 'session-2',
            type: 'code_analysis',
            status: AnalysisSessionStatus.COMPLETED
          }));
        }
        if (path.includes('session-3')) {
          return Promise.resolve(JSON.stringify({
            id: 'session-3',
            type: 'crash_log',
            status: AnalysisSessionStatus.COMPLETED
          }));
        }
        return Promise.resolve(JSON.stringify(sampleSession));
      });
      
      const sessions = await repository.getAllSessions({
        type: 'crash_log',
        status: AnalysisSessionStatus.COMPLETED
      });
      
      // Should return only the matching session
      expect(sessions.length).toBe(1);
      expect(sessions[0].id).toBe('session-3');
      expect(sessions[0].type).toBe('crash_log');
      expect(sessions[0].status).toBe(AnalysisSessionStatus.COMPLETED);
    });
  });
  
  describe('deleteSession', () => {
    it('should delete a session and its artifacts', async () => {
      // Mock getSessionArtifacts to return artifacts
      (repository as any).getSessionArtifacts = jest.fn().mockResolvedValue([
        { id: 'artifact-1' },
        { id: 'artifact-2' }
      ]);
      
      const result = await repository.deleteSession('session-1');
      
      // Should return true on success
      expect(result).toBe(true);
      
      // Should delete session file
      expect(fs.promises.unlink).toHaveBeenCalledWith(
        expect.stringContaining('session-1')
      );
      
      // Should delete artifact files
      expect(fs.promises.unlink).toHaveBeenCalledWith(
        expect.stringContaining('artifact-1')
      );
      expect(fs.promises.unlink).toHaveBeenCalledWith(
        expect.stringContaining('artifact-2')
      );
    });
    
    it('should return false when session not found', async () => {
      // Mock readFile to fail for non-existent session
      (fs.promises.readFile as jest.Mock).mockImplementation((path) => {
        if (path.includes('non-existent')) {
          return Promise.reject(new Error('ENOENT'));
        }
        return Promise.resolve('{}');
      });
      
      const result = await repository.deleteSession('non-existent');
      
      // Should return false
      expect(result).toBe(false);
    });
    
    it('should handle errors during deletion', async () => {
      // Mock getSessionById to succeed but unlink to fail
      (repository as any).getSessionById = jest.fn().mockResolvedValue(sampleSession);
      (fs.promises.unlink as jest.Mock).mockRejectedValue(new Error('Unlink error'));
      
      await expect(repository.deleteSession('session-1'))
        .rejects.toThrow('Failed to delete session');
      
      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});