import React, { useCallback, useState } from 'react';
import { ChartOptions, InteractionMode, TooltipItem } from 'chart.js';
import { toast } from '../../../../ui/components/use-toast';

interface ChartInteractionsProps {
  chartRef: React.RefObject<any>;
  onDrillDown?: (dataPoint: any) => void;
  enableZoom?: boolean;
  enablePan?: boolean;
}

export const useChartInteractions = ({
  chartRef,
  onDrillDown,
  enableZoom = false,
  enablePan = false
}: ChartInteractionsProps) => {
  const [isZoomed, setIsZoomed] = useState(false);

  // Create interactive chart options
  const interactiveOptions: Partial<ChartOptions<any>> = {
    interaction: {
      mode: 'index' as InteractionMode,
      intersect: false
    },
    plugins: {
      tooltip: {
        callbacks: {
          afterLabel: (context: TooltipItem<any>) => {
            return 'Click to drill down';
          }
        }
      },
      zoom: enableZoom ? {
        zoom: {
          wheel: {
            enabled: true,
          },
          pinch: {
            enabled: true
          },
          mode: 'x',
          onZoomComplete: () => setIsZoomed(true)
        },
        pan: {
          enabled: enablePan,
          mode: 'x',
        }
      } : undefined
    },
    onClick: (event: any, elements: any[]) => {
      if (elements.length > 0 && onDrillDown) {
        const element = elements[0];
        const datasetIndex = element.datasetIndex;
        const index = element.index;
        const chart = chartRef.current;
        
        if (chart) {
          const dataset = chart.data.datasets[datasetIndex];
          const label = chart.data.labels[index];
          const value = dataset.data[index];
          
          onDrillDown({
            label,
            value,
            datasetLabel: dataset.label,
            metadata: dataset.metadata?.[index]
          });
        }
      }
    },
    onHover: (event: any, elements: any[]) => {
      const chart = chartRef.current;
      if (chart && chart.canvas) {
        chart.canvas.style.cursor = elements.length > 0 ? 'pointer' : 'default';
      }
    }
  };

  // Reset zoom function
  const resetZoom = useCallback(() => {
    const chart = chartRef.current;
    if (chart && chart.resetZoom) {
      chart.resetZoom();
      setIsZoomed(false);
      toast({
        title: 'Zoom Reset',
        description: 'Chart view has been reset to original state'
      });
    }
  }, [chartRef]);

  return {
    interactiveOptions,
    isZoomed,
    resetZoom
  };
};

// Chart customization hook
export const useChartCustomization = () => {
  const [chartType, setChartType] = useState<'line' | 'bar' | 'area'>('line');
  const [showDataLabels, setShowDataLabels] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [smoothLines, setSmoothLines] = useState(true);

  const customizationOptions: Partial<ChartOptions<any>> = {
    plugins: {
      datalabels: showDataLabels ? {
        display: true,
        color: '#666',
        font: {
          size: 10
        },
        formatter: (value: number) => value.toLocaleString()
      } : {
        display: false
      }
    },
    scales: {
      x: {
        grid: {
          display: showGrid
        }
      },
      y: {
        grid: {
          display: showGrid
        }
      }
    },
    elements: {
      line: {
        tension: smoothLines ? 0.4 : 0
      }
    }
  };

  return {
    chartType,
    setChartType,
    showDataLabels,
    setShowDataLabels,
    showGrid,
    setShowGrid,
    smoothLines,
    setSmoothLines,
    customizationOptions
  };
};