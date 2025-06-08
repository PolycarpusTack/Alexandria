import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dashboard } from '../../ui/components/Dashboard';
import { 
  renderWithProviders, 
  createMockCrashAnalyzerService, 
  sampleCrashLog 
} from '../test-utils';

describe('Dashboard Component', () => {
  let mockCrashAnalyzerService: ReturnType<typeof createMockCrashAnalyzerService>;
  let mockNavigate: jest.Mock;
  let mockShowModal: jest.Mock;

  beforeEach(() => {
    mockCrashAnalyzerService = createMockCrashAnalyzerService();
    mockShowModal = jest.fn();
    mockNavigate = jest.fn();

    // Mock react-router-dom's useNavigate
    jest.mock('react-router-dom', () => ({
      ...jest.requireActual('react-router-dom'),
      useNavigate: () => mockNavigate
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('should display loading state initially', async () => {
    // Don't resolve getAllCrashLogs yet to keep it in loading state
    mockCrashAnalyzerService.getAllCrashLogs = jest.fn().mockImplementation(() => {
      return new Promise(() => {}); // Never resolves
    });

    renderWithProviders(
      <Dashboard crashAnalyzerService={mockCrashAnalyzerService} />,
      { uiContext: { showModal: mockShowModal } as any }
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should display empty state when no crash logs exist', async () => {
    mockCrashAnalyzerService.getAllCrashLogs.mockResolvedValue([]);

    renderWithProviders(
      <Dashboard crashAnalyzerService={mockCrashAnalyzerService} />,
      { uiContext: { showModal: mockShowModal } as any }
    );

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    expect(screen.getByText(/no crash logs found/i)).toBeInTheDocument();
    expect(screen.getByText(/upload your first crash log/i)).toBeInTheDocument();
  });

  it('should display crash logs when they exist', async () => {
    mockCrashAnalyzerService.getAllCrashLogs.mockResolvedValue([sampleCrashLog]);

    renderWithProviders(
      <Dashboard crashAnalyzerService={mockCrashAnalyzerService} />,
      { uiContext: { showModal: mockShowModal } as any }
    );

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Test Crash Log')).toBeInTheDocument();
    expect(screen.getByText(/Windows/)).toBeInTheDocument();
  });

  it('should open upload modal when upload button is clicked', async () => {
    mockCrashAnalyzerService.getAllCrashLogs.mockResolvedValue([]);
    
    renderWithProviders(
      <Dashboard crashAnalyzerService={mockCrashAnalyzerService} />,
      { uiContext: { showModal: mockShowModal } as any }
    );

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /upload crash log/i }));

    expect(mockShowModal).toHaveBeenCalledWith(
      'crash-analyzer-upload',
      expect.objectContaining({
        onLogUploaded: expect.any(Function)
      })
    );
  });

  it('should open code snippet modal when analyze code snippet button is clicked', async () => {
    // Add analyzeCodeSnippet capability to the service
    mockCrashAnalyzerService.analyzeCodeSnippet = jest.fn();
    
    renderWithProviders(
      <Dashboard crashAnalyzerService={mockCrashAnalyzerService} />,
      { uiContext: { showModal: mockShowModal } as any }
    );

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /analyze code snippet/i }));

    expect(mockShowModal).toHaveBeenCalledWith(
      'crash-analyzer-code-snippet-upload',
      expect.objectContaining({
        sessionId: expect.any(String),
        onUploadComplete: expect.any(Function)
      })
    );
  });

  it('should navigate to log details when a log is clicked', async () => {
    mockCrashAnalyzerService.getAllCrashLogs.mockResolvedValue([sampleCrashLog]);
    
    renderWithProviders(
      <Dashboard crashAnalyzerService={mockCrashAnalyzerService} />,
      { uiContext: { showModal: mockShowModal } as any }
    );

    await waitFor(() => {
      expect(screen.getByText('Test Crash Log')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('Test Crash Log'));

    expect(mockNavigate).toHaveBeenCalledWith('/crash-analyzer/logs/test-log-1');
  });

  it('should filter crash logs based on search input', async () => {
    const crashLogs = [
      { ...sampleCrashLog, id: '1', title: 'Windows Error' },
      { ...sampleCrashLog, id: '2', title: 'Linux Error' },
      { ...sampleCrashLog, id: '3', title: 'Mac Error' }
    ];
    
    mockCrashAnalyzerService.getAllCrashLogs.mockResolvedValue(crashLogs);
    
    renderWithProviders(
      <Dashboard crashAnalyzerService={mockCrashAnalyzerService} />,
      { uiContext: { showModal: mockShowModal } as any }
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Error/).length).toBe(3);
    });

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/search/i), 'Windows');

    expect(screen.getByText('Windows Error')).toBeInTheDocument();
    expect(screen.queryByText('Linux Error')).not.toBeInTheDocument();
    expect(screen.queryByText('Mac Error')).not.toBeInTheDocument();
  });

  it('should handle errors when loading crash logs', async () => {
    mockCrashAnalyzerService.getAllCrashLogs.mockRejectedValue(new Error('Failed to load logs'));
    
    renderWithProviders(
      <Dashboard crashAnalyzerService={mockCrashAnalyzerService} />,
      { uiContext: { showModal: mockShowModal } as any }
    );

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    expect(screen.getByText(/failed to load crash logs/i)).toBeInTheDocument();
  });

  it('should allow deleting a crash log', async () => {
    mockCrashAnalyzerService.getAllCrashLogs.mockResolvedValue([sampleCrashLog]);
    mockCrashAnalyzerService.deleteCrashLog.mockResolvedValue(true);
    
    // Mock window.confirm
    const originalConfirm = window.confirm;
    window.confirm = jest.fn().mockReturnValue(true);
    
    renderWithProviders(
      <Dashboard crashAnalyzerService={mockCrashAnalyzerService} />,
      { uiContext: { showModal: mockShowModal } as any }
    );

    await waitFor(() => {
      expect(screen.getByText('Test Crash Log')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /delete/i }));

    expect(window.confirm).toHaveBeenCalled();
    expect(mockCrashAnalyzerService.deleteCrashLog).toHaveBeenCalledWith('test-log-1');
    expect(mockCrashAnalyzerService.getAllCrashLogs).toHaveBeenCalledTimes(2); // Initial load + after delete
    
    // Restore original window.confirm
    window.confirm = originalConfirm;
  });

  it('should refresh the crash log list when refresh button is clicked', async () => {
    mockCrashAnalyzerService.getAllCrashLogs.mockResolvedValue([sampleCrashLog]);
    
    renderWithProviders(
      <Dashboard crashAnalyzerService={mockCrashAnalyzerService} />,
      { uiContext: { showModal: mockShowModal } as any }
    );

    await waitFor(() => {
      expect(screen.getByText('Test Crash Log')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /⟳/i }));

    expect(mockCrashAnalyzerService.getAllCrashLogs).toHaveBeenCalledTimes(2); // Initial load + refresh
  });
});