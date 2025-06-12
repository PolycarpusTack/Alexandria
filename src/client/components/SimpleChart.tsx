/**
 * Simple Chart Component
 * A lightweight chart component that doesn't require external dependencies
 */

import React from 'react';

interface DataPoint {
  time: string;
  value: number;
}

interface SimpleChartProps {
  data: DataPoint[];
  height?: number;
  color?: string;
  showGrid?: boolean;
  label?: string;
}

export const SimpleChart: React.FC<SimpleChartProps> = ({
  data,
  height = 300,
  color = '#8884d8',
  showGrid = true,
  label = 'Value'
}) => {
  if (!data || data.length === 0) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--muted-foreground)',
          backgroundColor: 'var(--card)',
          borderRadius: '8px',
          border: '1px solid var(--border)'
        }}
      >
        No data available
      </div>
    );
  }

  // Calculate min and max values
  const values = data.map((d) => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;

  // Calculate dimensions
  const padding = 40;
  const chartWidth = 800;
  const chartHeight = height;
  const innerWidth = chartWidth - padding * 2;
  const innerHeight = chartHeight - padding * 2;

  // Create SVG path
  const points = data
    .map((point, index) => {
      const x = (index / (data.length - 1)) * innerWidth + padding;
      const y = innerHeight - ((point.value - minValue) / range) * innerHeight + padding;
      return `${x},${y}`;
    })
    .join(' ');

  // Create grid lines
  const gridLines = [];
  if (showGrid) {
    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = padding + (innerHeight / 5) * i;
      gridLines.push(
        <line
          key={`h-${i}`}
          x1={padding}
          y1={y}
          x2={chartWidth - padding}
          y2={y}
          stroke='var(--border)'
          strokeOpacity='0.3'
        />
      );
    }

    // Vertical grid lines
    for (let i = 0; i <= 10; i++) {
      const x = padding + (innerWidth / 10) * i;
      gridLines.push(
        <line
          key={`v-${i}`}
          x1={x}
          y1={padding}
          x2={x}
          y2={chartHeight - padding}
          stroke='var(--border)'
          strokeOpacity='0.3'
        />
      );
    }
  }

  // Y-axis labels
  const yLabels = [];
  for (let i = 0; i <= 5; i++) {
    const value = minValue + (range / 5) * (5 - i);
    const y = padding + (innerHeight / 5) * i;
    yLabels.push(
      <text
        key={`y-label-${i}`}
        x={padding - 5}
        y={y + 5}
        textAnchor='end'
        fill='var(--muted-foreground)'
        fontSize='12'
      >
        {value.toFixed(0)}
      </text>
    );
  }

  // X-axis labels (show only a few)
  const xLabels = [];
  const step = Math.floor(data.length / 5) || 1;
  for (let i = 0; i < data.length; i += step) {
    const x = (i / (data.length - 1)) * innerWidth + padding;
    const time = data[i].time;
    xLabels.push(
      <text
        key={`x-label-${i}`}
        x={x}
        y={chartHeight - padding + 20}
        textAnchor='middle'
        fill='var(--muted-foreground)'
        fontSize='10'
      >
        {new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </text>
    );
  }

  return (
    <div className='relative w-full' style={{ height }}>
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight + 30}`}
        className='w-full h-full'
        preserveAspectRatio='xMidYMid meet'
      >
        {/* Grid */}
        {gridLines}

        {/* Axes */}
        <line
          x1={padding}
          y1={chartHeight - padding}
          x2={chartWidth - padding}
          y2={chartHeight - padding}
          stroke='var(--border)'
        />
        <line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={chartHeight - padding}
          stroke='var(--border)'
        />

        {/* Labels */}
        {yLabels}
        {xLabels}

        {/* Area fill */}
        <polygon
          points={`${padding},${chartHeight - padding} ${points} ${chartWidth - padding},${chartHeight - padding}`}
          fill={color}
          fillOpacity='0.1'
        />

        {/* Line */}
        <polyline points={points} fill='none' stroke={color} strokeWidth='2' />

        {/* Data points */}
        {data.map((point, index) => {
          const x = (index / (data.length - 1)) * innerWidth + padding;
          const y = innerHeight - ((point.value - minValue) / range) * innerHeight + padding;
          return <circle key={`point-${index}`} cx={x} cy={y} r='3' fill={color} />;
        })}

        {/* Y-axis label */}
        <text
          x={15}
          y={height / 2}
          transform={`rotate(-90, 15, ${height / 2})`}
          textAnchor='middle'
          fill='var(--muted-foreground)'
          fontSize='12'
        >
          {label}
        </text>
      </svg>
    </div>
  );
};

// Simple bar chart component
interface BarData {
  label: string;
  value: number;
  color?: string;
}

interface SimpleBarChartProps {
  data: BarData[];
  height?: number;
  showValues?: boolean;
}

export const SimpleBarChart: React.FC<SimpleBarChartProps> = ({
  data,
  height = 200,
  showValues = true
}) => {
  if (!data || data.length === 0) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--muted-foreground)'
        }}
      >
        No data available
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value));
  const barWidth = 100 / data.length - 2;

  return (
    <div className='relative w-full' style={{ height }}>
      <div className='flex items-end justify-around h-full'>
        {data.map((item, index) => {
          const barHeight = (item.value / maxValue) * 100;
          return (
            <div
              key={index}
              className='flex flex-col items-center'
              style={{ width: `${barWidth}%` }}
            >
              {showValues && (
                <span className='text-xs text-muted-foreground mb-1'>{item.value}</span>
              )}
              <div
                className='w-full transition-all duration-300 rounded-t'
                style={{
                  height: `${barHeight}%`,
                  backgroundColor: item.color || 'var(--primary)',
                  minHeight: '4px'
                }}
              />
              <span className='text-xs text-muted-foreground mt-1 text-center'>{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
