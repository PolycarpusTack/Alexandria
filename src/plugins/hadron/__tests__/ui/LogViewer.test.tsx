import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LogViewer } from '../../ui/components/LogViewer';
import { renderWithProviders, sampleCrashLog } from '../test-utils';

describe('LogViewer Component', () => {
  const mockContent = `
Line 1: INFO - Application starting
Line 2: DEBUG - Loading configuration
Line 3: ERROR - Failed to connect to database
Line 4: WARN - Connection pool utilization at 95%
Line 5: ERROR - Database operation timed out
`;

  it('should render log content correctly', () => {
    renderWithProviders(
      <LogViewer content={mockContent} />
    );

    expect(screen.getByText(/Line 1: INFO - Application starting/)).toBeInTheDocument();
    expect(screen.getByText(/Line 3: ERROR - Failed to connect to database/)).toBeInTheDocument();
    expect(screen.getByText(/Line 5: ERROR - Database operation timed out/)).toBeInTheDocument();
  });

  it('should display line numbers by default', () => {
    renderWithProviders(
      <LogViewer content={mockContent} />
    );

    // Check that line numbers are displayed
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should allow toggling line numbers', async () => {
    renderWithProviders(
      <LogViewer content={mockContent} />
    );

    const user = userEvent.setup();
    await user.click(screen.getByLabelText(/Line Numbers/i));

    // After toggling, line numbers should not be visible
    await waitFor(() => {
      expect(screen.queryByText('1')).not.toBeInTheDocument();
    });

    // Toggle back on
    await user.click(screen.getByLabelText(/Line Numbers/i));
    
    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  it('should filter content based on search input', async () => {
    renderWithProviders(
      <LogViewer content={mockContent} />
    );

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/Filter log/i), 'ERROR');

    // Should show the match count
    expect(screen.getByText(/2 matches/i)).toBeInTheDocument();

    // The matching lines should be highlighted
    const highlightedElements = document.querySelectorAll('.bg-yellow-50');
    expect(highlightedElements.length).toBeGreaterThan(0);
  });

  it('should handle regex search input', async () => {
    renderWithProviders(
      <LogViewer content={mockContent} />
    );

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/Filter log/i), 'ERROR|WARN');

    // Should show the match count for the regex pattern
    expect(screen.getByText(/3 matches/i)).toBeInTheDocument();
  });

  it('should allow navigating between matches', async () => {
    renderWithProviders(
      <LogViewer content={mockContent} />
    );

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/Filter log/i), 'ERROR');

    // Should display navigation buttons
    const prevButton = screen.getByRole('button', { name: /↑ Prev/i });
    const nextButton = screen.getByRole('button', { name: /↓ Next/i });
    
    expect(prevButton).toBeInTheDocument();
    expect(nextButton).toBeInTheDocument();

    // Initial match position
    expect(screen.getByText(/1\/2 matches/i)).toBeInTheDocument();

    // Navigate to next match
    await user.click(nextButton);
    
    // Should update match position
    expect(screen.getByText(/2\/2 matches/i)).toBeInTheDocument();

    // Navigate to previous match
    await user.click(prevButton);
    
    // Should update match position back
    expect(screen.getByText(/1\/2 matches/i)).toBeInTheDocument();
  });

  it('should wrap around when navigating past the last match', async () => {
    renderWithProviders(
      <LogViewer content={mockContent} />
    );

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/Filter log/i), 'ERROR');

    // Navigate to next match twice to go beyond the last match
    await user.click(screen.getByRole('button', { name: /↓ Next/i }));
    await user.click(screen.getByRole('button', { name: /↓ Next/i }));
    
    // Should wrap around to the first match
    expect(screen.getByText(/1\/2 matches/i)).toBeInTheDocument();
  });

  it('should display an error for invalid regex patterns', async () => {
    renderWithProviders(
      <LogViewer content={mockContent} />
    );

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/Filter log/i), '(unclosed');

    // Should show an error message for invalid regex
    expect(screen.getByText(/Invalid regex pattern/i)).toBeInTheDocument();
  });

  it('should allow clearing the filter', async () => {
    renderWithProviders(
      <LogViewer content={mockContent} />
    );

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/Filter log/i), 'ERROR');

    // Clear button should appear
    const clearButton = screen.getByRole('button', { name: /✕/i });
    expect(clearButton).toBeInTheDocument();
    
    // Click to clear
    await user.click(clearButton);
    
    // Filter should be cleared
    expect(screen.getByPlaceholderText(/Filter log/i)).toHaveValue('');
    expect(screen.queryByText(/matches/i)).not.toBeInTheDocument();
  });

  it('should allow copying log content to clipboard', async () => {
    // Mock clipboard API
    const originalClipboard = { ...global.navigator.clipboard };
    global.navigator.clipboard = {
      writeText: jest.fn().mockResolvedValue(undefined)
    };

    renderWithProviders(
      <LogViewer content={mockContent} />
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Copy to Clipboard/i }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockContent);

    // Restore original clipboard
    global.navigator.clipboard = originalClipboard;
  });

  it('should allow downloading log content', async () => {
    // Mock URL and document APIs
    global.URL.createObjectURL = jest.fn().mockReturnValue('blob:url');
    global.URL.revokeObjectURL = jest.fn();
    
    const appendChildMock = jest.fn();
    const removeChildMock = jest.fn();
    const clickMock = jest.fn();
    
    document.createElement = jest.fn().mockImplementation(() => ({
      href: '',
      download: '',
      click: clickMock
    }));
    
    document.body.appendChild = appendChildMock;
    document.body.removeChild = removeChildMock;

    renderWithProviders(
      <LogViewer content={mockContent} />
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Download/i }));

    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(clickMock).toHaveBeenCalled();
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('should render parsedData when provided', () => {
    renderWithProviders(
      <LogViewer
        content={mockContent}
        parsedData={sampleCrashLog.parsedData}
      />
    );

    // Should render the content
    expect(screen.getByText(/Line 1: INFO - Application starting/)).toBeInTheDocument();
    
    // And should use ParsedData for any advanced rendering if implemented
    // This is a placeholder test as the current implementation doesn't do special 
    // rendering based on parsedData
  });
});