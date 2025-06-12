import { EnterpriseChunker } from '../../src/utils/enterprise-chunker';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Mock the modules
jest.mock('child_process', () => ({
  spawnSync: jest.fn()
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  unlinkSync: jest.fn()
}));

jest.mock('os', () => ({
  tmpdir: jest.fn()
}));

jest.mock('path', () => ({
  join: jest.fn(),
  resolve: jest.fn()
}));

describe('EnterpriseChunker', () => {
  let chunker: EnterpriseChunker;
  let mockLogger: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    // Mock OS temp directory
    (os.tmpdir as jest.Mock).mockReturnValue('/tmp');

    // Mock path.join and path.resolve
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
    (path.resolve as jest.Mock).mockImplementation((...args) => args.join('/'));

    // Setup chunker
    process.env.PYTHON_PATH = '/usr/bin/python3';
    process.env.ENTERPRISE_CHUNKER_PATH = '/tools/enterprise_chunker/chunker.py';
    chunker = new EnterpriseChunker(mockLogger);
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.PYTHON_PATH;
    delete process.env.ENTERPRISE_CHUNKER_PATH;
  });

  describe('adaptive_chunk_text', () => {
    it('should use Python chunker when script exists', () => {
      // Mock script exists
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      // Mock successful spawn execution
      const mockSpawnResult = {
        status: 0,
        stderr: Buffer.from(''),
        stdout: Buffer.from('Output from Python')
      };
      (child_process.spawnSync as jest.Mock).mockReturnValue(mockSpawnResult);

      // Mock JSON output file
      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({
          chunks: ['chunk1', 'chunk2', 'chunk3']
        })
      );

      // Execute the chunker
      const result = chunker.adaptive_chunk_text('Sample text', {
        strategy: 'semantic',
        max_tokens_per_chunk: 1000
      });

      // Verify spawnSync was called correctly
      expect(child_process.spawnSync).toHaveBeenCalledWith(
        '/usr/bin/python3',
        expect.arrayContaining([
          '/tools/enterprise_chunker/chunker.py',
          '--input',
          expect.any(String),
          '--output',
          expect.any(String),
          '--format',
          'json',
          '--strategy',
          'semantic',
          '--max-tokens',
          '1000'
        ]),
        expect.any(Object)
      );

      // Verify writeFileSync was called to create input file
      expect(fs.writeFileSync).toHaveBeenCalledWith(expect.any(String), 'Sample text');

      // Verify readFileSync was called to read output
      expect(fs.readFileSync).toHaveBeenCalledWith(expect.any(String), 'utf8');

      // Verify temporary files were cleaned up
      expect(fs.unlinkSync).toHaveBeenCalledTimes(2);

      // Verify result
      expect(result).toEqual(['chunk1', 'chunk2', 'chunk3']);
    });

    it('should use fallback chunking when script does not exist', () => {
      // Mock script doesn't exist
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      // Execute the chunker with a multi-paragraph text
      const multiParagraphText = 'Paragraph 1.\n\nParagraph 2.\n\nParagraph 3.';
      const result = chunker.adaptive_chunk_text(multiParagraphText);

      // spawnSync should not be called
      expect(child_process.spawnSync).not.toHaveBeenCalled();

      // Verify fallback chunking was used
      expect(result.length).toBeGreaterThan(0);

      // Logger should warn about fallback
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('EnterpriseChunker script not found'),
        expect.anything()
      );
    });

    it('should use fallback chunking when Python execution fails', () => {
      // Mock script exists
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      // Mock failed spawn execution
      const mockFailedSpawn = {
        status: 1,
        stderr: Buffer.from('Python error'),
        stdout: Buffer.from('')
      };
      (child_process.spawnSync as jest.Mock).mockReturnValue(mockFailedSpawn);

      // Execute the chunker
      const result = chunker.adaptive_chunk_text('Sample text');

      // spawnSync should be called
      expect(child_process.spawnSync).toHaveBeenCalled();

      // Verify fallback chunking was used
      expect(result.length).toBeGreaterThan(0);

      // Logger should log the error
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error executing EnterpriseChunker'),
        expect.anything()
      );
    });

    it('should use fallback chunking when JSON parsing fails', () => {
      // Mock script exists
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      // Mock successful spawn execution
      const mockSpawnResult = {
        status: 0,
        stderr: Buffer.from(''),
        stdout: Buffer.from('Output from Python')
      };
      (child_process.spawnSync as jest.Mock).mockReturnValue(mockSpawnResult);

      // Mock invalid JSON output
      (fs.readFileSync as jest.Mock).mockReturnValue('Invalid JSON');

      // Execute the chunker
      const result = chunker.adaptive_chunk_text('Sample text');

      // Logger should log the error
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error parsing EnterpriseChunker output'),
        expect.anything()
      );

      // Verify fallback chunking was used
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('fallbackChunking', () => {
    it('should split text by paragraphs when possible', () => {
      // Access private method using type assertion
      const fallbackMethod = (chunker as any).fallbackChunking;

      // Text with multiple paragraphs
      const text = 'Paragraph 1.\n\nParagraph 2.\n\nParagraph 3.';

      // Execute fallback chunking
      const result = fallbackMethod(text, 1000);

      // Should preserve paragraphs when they fit in chunk size
      expect(result).toContain(text);
    });

    it('should split text by size when no paragraphs exist', () => {
      // Access private method using type assertion
      const fallbackMethod = (chunker as any).fallbackChunking;

      // Text without paragraph breaks, 1000 characters
      const text = 'A'.repeat(1000);

      // Split into small chunks (100 tokens)
      const result = fallbackMethod(text, 100);

      // Should create multiple chunks
      expect(result.length).toBeGreaterThan(1);
    });
  });
});
