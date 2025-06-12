import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CodeSnippetUpload } from '../../ui/components/CodeSnippetUpload';
import { renderWithProviders, createMockCrashAnalyzerService } from '../test-utils';

describe('CodeSnippetUpload Component', () => {
  let mockCrashAnalyzerService: ReturnType<typeof createMockCrashAnalyzerService>;
  let mockOnUploadComplete: jest.Mock;

  beforeEach(() => {
    mockCrashAnalyzerService = createMockCrashAnalyzerService();
    mockOnUploadComplete = jest.fn();

    // Mock the toast function
    global.toast = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render the form correctly', () => {
    renderWithProviders(
      <CodeSnippetUpload
        crashAnalyzerService={mockCrashAnalyzerService}
        sessionId='test-session'
        onUploadComplete={mockOnUploadComplete}
      />
    );

    // Form title and description
    expect(screen.getByText('Code Snippet Analysis')).toBeInTheDocument();
    expect(screen.getByText(/Submit a code snippet for AI analysis/)).toBeInTheDocument();

    // Form inputs
    expect(screen.getByLabelText(/Programming Language/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Code Snippet/i)).toBeInTheDocument();

    // Submit button
    expect(screen.getByRole('button', { name: /Analyze Code/i })).toBeInTheDocument();
  });

  it('should allow selecting programming language', async () => {
    renderWithProviders(
      <CodeSnippetUpload
        crashAnalyzerService={mockCrashAnalyzerService}
        sessionId='test-session'
        onUploadComplete={mockOnUploadComplete}
      />
    );

    const user = userEvent.setup();
    const languageSelect = screen.getByLabelText(/Programming Language/i);

    // Default value should be Python
    expect(languageSelect).toHaveValue('python');

    // Change to JavaScript
    await user.selectOptions(languageSelect, 'javascript');
    expect(languageSelect).toHaveValue('javascript');
  });

  it('should show an error when submitting without code', async () => {
    renderWithProviders(
      <CodeSnippetUpload
        crashAnalyzerService={mockCrashAnalyzerService}
        sessionId='test-session'
        onUploadComplete={mockOnUploadComplete}
      />
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Analyze Code/i }));

    expect(screen.getByText(/Please enter some code/i)).toBeInTheDocument();
    expect(mockCrashAnalyzerService.saveCodeSnippet).not.toHaveBeenCalled();
  });

  it('should submit code for analysis when form is valid', async () => {
    mockCrashAnalyzerService.saveCodeSnippet.mockResolvedValue({ id: 'snippet-123' });

    renderWithProviders(
      <CodeSnippetUpload
        crashAnalyzerService={mockCrashAnalyzerService}
        sessionId='test-session'
        onUploadComplete={mockOnUploadComplete}
      />
    );

    const user = userEvent.setup();

    // Fill in the form
    await user.selectOptions(screen.getByLabelText(/Programming Language/i), 'javascript');
    await user.type(screen.getByLabelText(/Description/i), 'Test function');
    await user.type(screen.getByLabelText(/Code Snippet/i), 'function test() { return true; }');

    // Submit the form
    await user.click(screen.getByRole('button', { name: /Analyze Code/i }));

    // Check loading state
    expect(screen.getByText(/Analyzing/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(mockCrashAnalyzerService.saveCodeSnippet).toHaveBeenCalledWith(
        'function test() { return true; }',
        'javascript',
        'test-session',
        'Test function'
      );
    });

    expect(mockCrashAnalyzerService.analyzeCodeSnippet).toHaveBeenCalledWith(
      'snippet-123',
      'test-session'
    );

    // Should show success message
    expect(
      screen.getByText(/Code snippet uploaded and analyzed successfully/i)
    ).toBeInTheDocument();

    // Should call the callback
    expect(mockOnUploadComplete).toHaveBeenCalledWith('snippet-123');
  });

  it('should handle errors during code analysis', async () => {
    mockCrashAnalyzerService.saveCodeSnippet.mockRejectedValue(new Error('API Error'));

    renderWithProviders(
      <CodeSnippetUpload
        crashAnalyzerService={mockCrashAnalyzerService}
        sessionId='test-session'
        onUploadComplete={mockOnUploadComplete}
      />
    );

    const user = userEvent.setup();

    // Fill in the form
    await user.type(screen.getByLabelText(/Code Snippet/i), 'function test() { return true; }');

    // Submit the form
    await user.click(screen.getByRole('button', { name: /Analyze Code/i }));

    await waitFor(() => {
      expect(screen.getByText(/Failed to analyze code snippet/i)).toBeInTheDocument();
    });

    // Should not call the callback
    expect(mockOnUploadComplete).not.toHaveBeenCalled();
  });

  it('should display syntax highlighting in preview when code is entered', async () => {
    renderWithProviders(
      <CodeSnippetUpload
        crashAnalyzerService={mockCrashAnalyzerService}
        sessionId='test-session'
        onUploadComplete={mockOnUploadComplete}
      />
    );

    const user = userEvent.setup();

    // Enter code to trigger preview
    await user.type(screen.getByLabelText(/Code Snippet/i), 'function test() { return true; }');

    // Preview should appear
    await waitFor(() => {
      expect(screen.getByText(/Preview/i)).toBeInTheDocument();
    });

    // Preview should contain the code
    const previewElement = screen.getByText(/function test/i, { selector: 'pre' });
    expect(previewElement).toBeInTheDocument();
  });

  it('should show cursor position and code length as user types', async () => {
    renderWithProviders(
      <CodeSnippetUpload
        crashAnalyzerService={mockCrashAnalyzerService}
        sessionId='test-session'
        onUploadComplete={mockOnUploadComplete}
      />
    );

    const user = userEvent.setup();

    // Type code
    const codeInput = screen.getByLabelText(/Code Snippet/i);
    await user.type(codeInput, 'function test() {\n  return true;\n}');

    // Position info should be visible
    const positionInfo = screen.getByText(/Line:.*Column:.*Length:/i);
    expect(positionInfo).toBeInTheDocument();

    // Should show correct length
    expect(positionInfo.textContent).toContain(`Length: ${codeInput.value.length} chars`);
  });

  it('should allow clearing the code input', async () => {
    renderWithProviders(
      <CodeSnippetUpload
        crashAnalyzerService={mockCrashAnalyzerService}
        sessionId='test-session'
        onUploadComplete={mockOnUploadComplete}
      />
    );

    const user = userEvent.setup();

    // Type code
    await user.type(screen.getByLabelText(/Code Snippet/i), 'function test() { return true; }');

    // Click clear button
    await user.click(screen.getByRole('button', { name: /Clear/i }));

    // Input should be empty
    expect(screen.getByLabelText(/Code Snippet/i)).toHaveValue('');
  });

  it('should submit form with Ctrl+Enter shortcut', async () => {
    mockCrashAnalyzerService.saveCodeSnippet.mockResolvedValue({ id: 'snippet-123' });

    renderWithProviders(
      <CodeSnippetUpload
        crashAnalyzerService={mockCrashAnalyzerService}
        sessionId='test-session'
        onUploadComplete={mockOnUploadComplete}
      />
    );

    const user = userEvent.setup();

    // Type code
    const codeInput = screen.getByLabelText(/Code Snippet/i);
    await user.type(codeInput, 'function test() { return true; }');

    // Use Ctrl+Enter shortcut
    await user.keyboard('{Control>}Enter{/Control}');

    await waitFor(() => {
      expect(mockCrashAnalyzerService.saveCodeSnippet).toHaveBeenCalled();
    });
  });

  it('should show performance warning for large code snippets', async () => {
    renderWithProviders(
      <CodeSnippetUpload
        crashAnalyzerService={mockCrashAnalyzerService}
        sessionId='test-session'
        onUploadComplete={mockOnUploadComplete}
      />
    );

    // Set a very large snippet
    const largeSnippet = 'a'.repeat(15000);

    // Directly set the value to avoid typing 15000 characters
    const codeInput = screen.getByLabelText(/Code Snippet/i) as HTMLTextAreaElement;
    await userEvent.clear(codeInput);
    await userEvent.type(codeInput, largeSnippet);

    // Fire change event manually
    fireEvent.change(codeInput, { target: { value: largeSnippet } });

    // Warning should appear
    await waitFor(() => {
      expect(screen.getByText(/Large file may affect performance/i)).toBeInTheDocument();
    });
  });
});
