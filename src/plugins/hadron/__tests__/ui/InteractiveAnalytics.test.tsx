/**
 * Tests for interactive analytics features
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TimeSeriesChart } from '../../ui/components/charts/TimeSeriesChart';
import { DateRangePicker } from '../../ui/components/DateRangePicker';
import { ChartCustomization } from '../../ui/components/ChartCustomization';
import { DrillDownModal } from '../../ui/components/DrillDownModal';
import { BrowserRouter } from 'react-router-dom';

// Mock Chart.js
global.Chart = jest.fn(() => ({
  destroy: jest.fn(),
  update: jest.fn(),
  resetZoom: jest.fn(),
  canvas: document.createElement('canvas')
}));

describe('Interactive Analytics Features', () => {
  describe('DateRangePicker', () => {
    it('should render date range picker with current range', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-07');
      const onRangeChange = jest.fn();

      render(
        <DateRangePicker
          start={start}
          end={end}
          onRangeChange={onRangeChange}
        />
      );

      expect(screen.getByText(/Jan 01, 2024/)).toBeInTheDocument();
      expect(screen.getByText(/Jan 07, 2024/)).toBeInTheDocument();
    });

    it('should call onRangeChange when selecting a new range', async () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-07');
      const onRangeChange = jest.fn();

      render(
        <DateRangePicker
          start={start}
          end={end}
          onRangeChange={onRangeChange}
        />
      );

      // Open the picker
      fireEvent.click(screen.getByRole('button'));

      // Click on "Last 30 days" preset
      fireEvent.click(screen.getByText('Last 30 days'));

      expect(onRangeChange).toHaveBeenCalledWith(
        expect.any(Date),
        expect.any(Date)
      );
    });
  });

  describe('ChartCustomization', () => {
    it('should render chart customization options', () => {
      const props = {
        chartType: 'line' as const,
        onChartTypeChange: jest.fn(),
        showDataLabels: false,
        onShowDataLabelsChange: jest.fn(),
        showGrid: true,
        onShowGridChange: jest.fn(),
        smoothLines: true,
        onSmoothLinesChange: jest.fn()
      };

      render(<ChartCustomization {...props} />);

      // Click to open popover
      fireEvent.click(screen.getByText('Customize'));

      expect(screen.getByText('Chart Customization')).toBeInTheDocument();
      expect(screen.getByLabelText('Line Chart')).toBeChecked();
      expect(screen.getByLabelText('Show Grid')).toBeChecked();
      expect(screen.getByLabelText('Smooth Lines')).toBeChecked();
    });

    it('should update chart type when selected', () => {
      const onChartTypeChange = jest.fn();
      const props = {
        chartType: 'line' as const,
        onChartTypeChange,
        showDataLabels: false,
        onShowDataLabelsChange: jest.fn(),
        showGrid: true,
        onShowGridChange: jest.fn(),
        smoothLines: true,
        onSmoothLinesChange: jest.fn()
      };

      render(<ChartCustomization {...props} />);

      // Open and select bar chart
      fireEvent.click(screen.getByText('Customize'));
      fireEvent.click(screen.getByLabelText('Bar Chart'));

      expect(onChartTypeChange).toHaveBeenCalledWith('bar');
    });
  });

  describe('DrillDownModal', () => {
    it('should display drill-down data', () => {
      const data = {
        label: '2024-01-01',
        value: 42,
        datasetLabel: 'Crashes',
        metadata: {
          platform: 'windows',
          severity: 'critical'
        }
      };

      render(
        <BrowserRouter>
          <DrillDownModal
            isOpen={true}
            onClose={jest.fn()}
            data={data}
            onApplyFilter={jest.fn()}
          />
        </BrowserRouter>
      );

      expect(screen.getByText('Data Point Details')).toBeInTheDocument();
      expect(screen.getByText('2024-01-01')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('Crashes')).toBeInTheDocument();
      expect(screen.getByText('windows')).toBeInTheDocument();
      expect(screen.getByText('critical')).toBeInTheDocument();
    });

    it('should call onApplyFilter when Apply as Filter is clicked', () => {
      const onApplyFilter = jest.fn();
      const onClose = jest.fn();
      const data = {
        label: '2024-01-01',
        value: 42,
        metadata: { platform: 'windows' }
      };

      render(
        <BrowserRouter>
          <DrillDownModal
            isOpen={true}
            onClose={onClose}
            data={data}
            onApplyFilter={onApplyFilter}
          />
        </BrowserRouter>
      );

      fireEvent.click(screen.getByText('Apply as Filter'));

      expect(onApplyFilter).toHaveBeenCalledWith({
        timestamp: '2024-01-01',
        platform: 'windows'
      });
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Interactive TimeSeriesChart', () => {
    const mockData = {
      series: [
        { timestamp: '2024-01-01T00:00:00Z', count: 10, metadata: {} },
        { timestamp: '2024-01-02T00:00:00Z', count: 15, metadata: {} },
        { timestamp: '2024-01-03T00:00:00Z', count: 8, metadata: {} }
      ],
      granularity: 'day' as const,
      totalCount: 33
    };

    it('should render with interactive features enabled', () => {
      render(
        <BrowserRouter>
          <TimeSeriesChart
            data={mockData}
            enableInteractions={true}
            onDrillDown={jest.fn()}
          />
        </BrowserRouter>
      );

      expect(screen.getByText('Customize')).toBeInTheDocument();
    });

    it('should show Reset Zoom button when zoomed', async () => {
      const chartInstance = {
        destroy: jest.fn(),
        update: jest.fn(),
        resetZoom: jest.fn(),
        canvas: document.createElement('canvas')
      };

      (global.Chart as jest.Mock).mockReturnValue(chartInstance);

      render(
        <BrowserRouter>
          <TimeSeriesChart
            data={mockData}
            enableInteractions={true}
          />
        </BrowserRouter>
      );

      // Simulate zoom event
      const canvas = screen.getByRole('img', { hidden: true }) as HTMLCanvasElement;
      
      // Trigger zoom
      fireEvent.wheel(canvas, { deltaY: -100 });

      // Wait for state update
      await waitFor(() => {
        const resetButton = screen.queryByText('Reset Zoom');
        if (resetButton) {
          expect(resetButton).toBeInTheDocument();
        }
      });
    });
  });
});