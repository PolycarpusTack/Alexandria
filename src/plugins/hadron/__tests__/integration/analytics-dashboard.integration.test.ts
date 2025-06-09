/**
 * Integration tests for Analytics Dashboard
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AnalyticsDashboard } from '../../ui/components/AnalyticsDashboard';
import { analyticsAPIClient } from '../../ui/services/analytics-api-client';
import { UIProvider } from '../../../../ui/ui-context';
import { ThemeProvider } from '../../../../client/components/theme-provider';

// Mock the API client
jest.mock('../../ui/services/analytics-api-client');

// Mock chart.js
global.Chart = jest.fn(() => ({
  destroy: jest.fn(),
  update: jest.fn()
}));

describe('AnalyticsDashboard Integration', () => {
  const mockTimeSeriesData = {
    series: [
      { timestamp: '2024-01-01T00:00:00Z', count: 10, metadata: {} },
      { timestamp: '2024-01-02T00:00:00Z', count: 15, metadata: {} },
      { timestamp: '2024-01-03T00:00:00Z', count: 8, metadata: {} }
    ],
    granularity: 'day',
    totalCount: 33
  };

  const mockRootCauseData = {
    categories: [
      { category: 'Memory Access Violation', count: 15, percentage: 45.5, trend: 2.3 },
      { category: 'Null Pointer Exception', count: 10, percentage: 30.3, trend: -1.5 },
      { category: 'Stack Overflow', count: 8, percentage: 24.2, trend: 0.5 }
    ],
    totalCount: 33,
    insights: [
      {
        title: 'Memory issues trending up',
        description: 'Memory access violations have increased by 2.3% this period',
        recommendation: 'Review recent memory management changes'
      }
    ]
  };

  const mockModelPerformance = [
    {
      modelName: 'GPT-4',
      requestCount: 150,
      successRate: 0.95,
      accuracy: 0.92,
      averageLatency: 250,
      latencyPercentiles: { p50: 200, p90: 400, p95: 500, p99: 800 }
    },
    {
      modelName: 'Claude-3',
      requestCount: 120,
      successRate: 0.97,
      accuracy: 0.94,
      averageLatency: 180,
      latencyPercentiles: { p50: 150, p90: 300, p95: 400, p99: 600 }
    }
  ];

  const mockSeverityTrends = {
    trends: [
      {
        timestamp: '2024-01-01T00:00:00Z',
        distribution: { critical: 2, high: 5, medium: 3, low: 0 }
      },
      {
        timestamp: '2024-01-02T00:00:00Z',
        distribution: { critical: 3, high: 6, medium: 4, low: 2 }
      }
    ],
    predictions: [
      {
        timestamp: '2024-01-04T00:00:00Z',
        distribution: { critical: 4, high: 7, medium: 5, low: 3 },
        confidence: 0.85
      }
    ],
    insights: ['Critical issues are predicted to increase']
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup API mocks
    (analyticsAPIClient.getTimeSeriesData as jest.Mock).mockResolvedValue(mockTimeSeriesData);
    (analyticsAPIClient.getRootCauseDistribution as jest.Mock).mockResolvedValue(mockRootCauseData);
    (analyticsAPIClient.getModelPerformance as jest.Mock).mockResolvedValue(mockModelPerformance);
    (analyticsAPIClient.getSeverityTrends as jest.Mock).mockResolvedValue(mockSeverityTrends);
  });

  const renderDashboard = () => {
    return render(
      <BrowserRouter>
        <ThemeProvider>
          <UIProvider>
            <AnalyticsDashboard />
          </UIProvider>
        </ThemeProvider>
      </BrowserRouter>
    );
  };

  it('should load and display analytics data', async () => {
    renderDashboard();

    // Should show loading state initially
    expect(screen.getByRole('status')).toBeInTheDocument();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    });

    // Check that API calls were made
    expect(analyticsAPIClient.getTimeSeriesData).toHaveBeenCalled();
    expect(analyticsAPIClient.getRootCauseDistribution).toHaveBeenCalled();
    expect(analyticsAPIClient.getModelPerformance).toHaveBeenCalled();
    expect(analyticsAPIClient.getSeverityTrends).toHaveBeenCalled();

    // Check key metrics are displayed
    expect(screen.getByText('33')).toBeInTheDocument(); // Total crashes
    expect(screen.getByText('Memory Access Violation')).toBeInTheDocument(); // Top root cause
  });

  it('should handle time range changes', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    });

    // Click on 24h time range
    const timeRangeButton = screen.getByText('24h');
    fireEvent.click(timeRangeButton);

    // Check that API was called with new time range
    await waitFor(() => {
      expect(analyticsAPIClient.getTimeSeriesData).toHaveBeenCalledWith(
        expect.objectContaining({
          granularity: 'hour'
        })
      );
    });
  });

  it('should handle filter changes', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    });

    // Change platform filter
    const platformSelect = screen.getByLabelText('Platform:');
    fireEvent.change(platformSelect, { target: { value: 'windows' } });

    // Data should be refreshed
    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    });
  });

  it('should export data to CSV', async () => {
    // Mock download functionality
    const mockLink = {
      click: jest.fn(),
      setAttribute: jest.fn(),
      style: {}
    };
    jest.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
    jest.spyOn(document.body, 'appendChild').mockImplementation();
    jest.spyOn(document.body, 'removeChild').mockImplementation();
    global.URL.createObjectURL = jest.fn();
    global.URL.revokeObjectURL = jest.fn();

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    });

    // Click export CSV button
    const exportButton = screen.getByText('Export CSV');
    fireEvent.click(exportButton);

    // Check that download was triggered
    expect(mockLink.click).toHaveBeenCalled();
    expect(mockLink.setAttribute).toHaveBeenCalledWith('download', expect.stringContaining('.csv'));
  });

  it('should refresh data', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    });

    // Clear previous calls
    jest.clearAllMocks();

    // Click refresh button
    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);

    // Check that APIs were called again
    await waitFor(() => {
      expect(analyticsAPIClient.getTimeSeriesData).toHaveBeenCalled();
      expect(analyticsAPIClient.getRootCauseDistribution).toHaveBeenCalled();
    });
  });

  it('should handle API errors gracefully', async () => {
    // Mock API to return error
    (analyticsAPIClient.getTimeSeriesData as jest.Mock).mockRejectedValue(
      new Error('Failed to fetch data')
    );

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Failed to load analytics data')).toBeInTheDocument();
    });

    // Should show retry button
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('should display real-time connection status', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    });

    // Check for last updated timestamp
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
  });

  it('should apply multiple filters simultaneously', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    });

    // Apply multiple filters
    const platformSelect = screen.getByLabelText('Platform:');
    const severitySelect = screen.getByLabelText('Severity:');

    fireEvent.change(platformSelect, { target: { value: 'windows' } });
    fireEvent.change(severitySelect, { target: { value: 'critical' } });

    // Clear filters button should appear
    await waitFor(() => {
      expect(screen.getByText('Clear Filters')).toBeInTheDocument();
    });

    // Click clear filters
    fireEvent.click(screen.getByText('Clear Filters'));

    // Filters should reset
    expect(platformSelect).toHaveValue('all');
    expect(severitySelect).toHaveValue('all');
  });
});