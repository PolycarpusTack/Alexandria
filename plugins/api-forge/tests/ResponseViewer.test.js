import { ResponseViewer } from '../src/components/ResponseViewer';
import { TestHelpers } from './utils/testHelpers';

describe('ResponseViewer', () => {
  let viewer;
  let mockPlugin;

  beforeEach(() => {
    mockPlugin = TestHelpers.createMockPlugin();
    viewer = new ResponseViewer(mockPlugin);
    TestHelpers.mockDOM();
  });

  describe('display()', () => {
    test('should render JSON response', () => {
      const response = {
        status: 200,
        headers: { 'content-type': 'application/json' },
        data: { message: 'Success' },
        size: 1024
      };
      
      viewer.display(response, 150);
      const element = document.getElementById('apicarus-responseContent');
      
      expect(element.innerHTML).toContain('200');
      expect(element.innerHTML).toContain('Success');
      expect(element.innerHTML).toContain('150ms');
    });

    test('should render HTML response safely', () => {
      const response = {
        status: 200,
        headers: { 'content-type': 'text/html' },
        data: '<script>alert("XSS")</script><p>Safe content</p>'
      };
      
      viewer.display(response, 100);
      const element = document.getElementById('apicarus-responseContent');
      
      expect(element.innerHTML).not.toContain('<script>');
      expect(element.innerHTML).toContain('Safe content');
    });

    test('should handle error responses', () => {
      const response = {
        status: 404,
        statusText: 'Not Found',
        data: { error: 'Resource not found' }
      };
      
      viewer.display(response, 50);
      const element = document.getElementById('apicarus-responseContent');
      
      expect(element.innerHTML).toContain('404');
      expect(element.innerHTML).toContain('Not Found');
      expect(element.innerHTML).toContain('error');
    });

    test('should format large responses', () => {
      const largeData = Array(1000).fill({ id: 1, name: 'Test' });
      const response = {
        status: 200,
        data: largeData,
        size: 50000
      };
      
      viewer.display(response, 200);
      const element = document.getElementById('apicarus-responseContent');
      
      expect(element.innerHTML).toContain('48.8 KB'); // Size formatting
    });
  });

  describe('Tab Switching', () => {
    test('should switch between response tabs', () => {
      viewer.switchResponseTab('headers');
      expect(viewer.activeTab).toBe('headers');
      
      viewer.switchResponseTab('raw');
      expect(viewer.activeTab).toBe('raw');
    });

    test('should render headers tab correctly', () => {
      const response = {
        headers: {
          'content-type': 'application/json',
          'x-rate-limit': '100'
        }
      };
      
      const html = viewer.renderHeaders(response.headers);
      expect(html).toContain('content-type');
      expect(html).toContain('application/json');
      expect(html).toContain('x-rate-limit');
    });
  });

  describe('Download functionality', () => {
    test('should trigger download', () => {
      const response = {
        data: { test: 'data' }
      };
      
      // Mock createElement and click
      const mockAnchor = {
        click: jest.fn(),
        setAttribute: jest.fn()
      };
      jest.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
      
      viewer.downloadResponse(response);
      
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(mockAnchor.download).toMatch(/response.*\.json/);
    });
  });

  describe('Security', () => {
    test('should escape HTML in JSON values', () => {
      const response = {
        status: 200,
        data: {
          userInput: '<script>alert("xss")</script>',
          safeData: 'normal text'
        }
      };
      
      viewer.display(response, 100);
      const element = document.getElementById('apicarus-responseContent');
      
      // Should not contain raw script tags
      expect(element.innerHTML).not.toContain('<script>alert("xss")</script>');
      // Should contain escaped version
      expect(element.innerHTML).toContain('&lt;script&gt;');
    });

    test('should sanitize response headers', () => {
      const response = {
        status: 200,
        headers: {
          'x-malicious': '<script>evil()</script>',
          'content-type': 'application/json'
        },
        data: { success: true }
      };
      
      viewer.display(response, 100);
      const element = document.getElementById('apicarus-responseContent');
      
      expect(element.innerHTML).not.toContain('<script>evil()</script>');
    });
  });

  describe('Performance', () => {
    test('should handle very large responses efficiently', () => {
      const largeData = Array(10000).fill().map((_, i) => ({
        id: i,
        data: 'test'.repeat(100)
      }));
      
      const response = {
        status: 200,
        data: largeData,
        size: JSON.stringify(largeData).length
      };
      
      const startTime = performance.now();
      viewer.display(response, 100);
      const endTime = performance.now();
      
      // Should render in reasonable time (< 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
    });

    test('should truncate extremely large responses', () => {
      const hugeString = 'a'.repeat(1000000); // 1MB string
      const response = {
        status: 200,
        data: { hugeField: hugeString },
        size: hugeString.length
      };
      
      viewer.display(response, 100);
      const element = document.getElementById('apicarus-responseContent');
      
      // Should contain truncation indicator
      expect(element.innerHTML).toContain('...truncated');
    });
  });
});