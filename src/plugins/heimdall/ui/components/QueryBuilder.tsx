/**
 * Query Builder Component
 *
 * Interactive UI for building and executing log queries
 */

import React, { useState } from 'react';
import { LogQuery, LogQueryResult, LogLevel } from '../../src/interfaces';
import { Button, Card, Input, Select } from '../../../../ui/components';
import { LoadingSpinner } from '../../../../ui/components/LoadingSpinner';
import { LogTable } from './LogTable';

interface QueryBuilderProps {
  sourceId: string;
  service: any;
}

export const QueryBuilder: React.FC<QueryBuilderProps> = ({ sourceId, service }) => {
  const [query, setQuery] = useState<Partial<LogQuery>>({
    timeRange: {
      start: new Date(Date.now() - 3600000), // 1 hour ago
      end: new Date()
    },
    levels: [],
    search: '',
    limit: 100
  });

  const [result, setResult] = useState<LogQueryResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [executionTime, setExecutionTime] = useState<number>(0);

  // Time range presets
  const timeRangePresets = [
    { label: 'Last 15 minutes', minutes: 15 },
    { label: 'Last hour', minutes: 60 },
    { label: 'Last 4 hours', minutes: 240 },
    { label: 'Last 24 hours', minutes: 1440 },
    { label: 'Last 7 days', minutes: 10080 }
  ];

  // Log levels
  const logLevels = Object.values(LogLevel);

  // Execute the query
  const executeQuery = async () => {
    if (!query.timeRange?.start || !query.timeRange?.end) {
      setError('Time range is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const startTime = Date.now();

      const fullQuery: LogQuery = {
        timeRange: query.timeRange,
        levels: query.levels || [],
        search: query.search || '',
        sources: [sourceId],
        limit: query.limit || 100
      };

      const queryResult = await service.query(fullQuery);
      const endTime = Date.now();

      setResult(queryResult);
      setExecutionTime(endTime - startTime);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query execution failed');
      console.error('Query execution error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Apply time range preset
  const applyTimeRangePreset = (minutes: number) => {
    const end = new Date();
    const start = new Date(end.getTime() - minutes * 60 * 1000);

    setQuery((prev) => ({
      ...prev,
      timeRange: { start, end }
    }));
  };

  // Format date for input
  const formatDateForInput = (date: Date) => {
    return date.toISOString().slice(0, 16);
  };

  // Parse date from input
  const parseDateFromInput = (dateString: string) => {
    return new Date(dateString);
  };

  return (
    <div className='space-y-6'>
      {/* Query Builder Form */}
      <Card className='p-6'>
        <h3 className='text-lg font-semibold mb-4'>Build Query</h3>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          {/* Time Range */}
          <div className='space-y-2'>
            <label className='text-sm font-medium text-gray-700'>Time Range</label>

            <div className='flex flex-wrap gap-2 mb-2'>
              {timeRangePresets.map((preset) => (
                <Button
                  key={preset.minutes}
                  variant='outline'
                  size='small'
                  onClick={() => applyTimeRangePreset(preset.minutes)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            <div className='grid grid-cols-2 gap-2'>
              <div>
                <label className='text-xs text-gray-500'>Start</label>
                <Input
                  type='datetime-local'
                  value={query.timeRange?.start ? formatDateForInput(query.timeRange.start) : ''}
                  onChange={(e) =>
                    setQuery((prev) => ({
                      ...prev,
                      timeRange: {
                        ...prev.timeRange!,
                        start: parseDateFromInput(e.target.value)
                      }
                    }))
                  }
                />
              </div>
              <div>
                <label className='text-xs text-gray-500'>End</label>
                <Input
                  type='datetime-local'
                  value={query.timeRange?.end ? formatDateForInput(query.timeRange.end) : ''}
                  onChange={(e) =>
                    setQuery((prev) => ({
                      ...prev,
                      timeRange: {
                        ...prev.timeRange!,
                        end: parseDateFromInput(e.target.value)
                      }
                    }))
                  }
                />
              </div>
            </div>
          </div>

          {/* Search Text */}
          <div className='space-y-2'>
            <label className='text-sm font-medium text-gray-700'>Search Text</label>
            <Input
              placeholder='Enter search terms...'
              value={query.search || ''}
              onChange={(e) =>
                setQuery((prev) => ({
                  ...prev,
                  search: e.target.value
                }))
              }
            />
          </div>

          {/* Log Levels */}
          <div className='space-y-2'>
            <label className='text-sm font-medium text-gray-700'>Log Levels</label>
            <div className='flex flex-wrap gap-2'>
              {logLevels.map((level) => (
                <label key={level} className='flex items-center space-x-2'>
                  <input
                    type='checkbox'
                    checked={query.levels?.includes(level) || false}
                    onChange={(e) => {
                      const levels = query.levels || [];
                      if (e.target.checked) {
                        setQuery((prev) => ({
                          ...prev,
                          levels: [...levels, level]
                        }));
                      } else {
                        setQuery((prev) => ({
                          ...prev,
                          levels: levels.filter((l) => l !== level)
                        }));
                      }
                    }}
                    className='rounded border-gray-300'
                  />
                  <span
                    className={`text-sm px-2 py-1 rounded ${
                      level === LogLevel.ERROR
                        ? 'bg-red-100 text-red-800'
                        : level === LogLevel.WARN
                          ? 'bg-yellow-100 text-yellow-800'
                          : level === LogLevel.INFO
                            ? 'bg-blue-100 text-blue-800'
                            : level === LogLevel.DEBUG
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    {level.toUpperCase()}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Limit */}
          <div className='space-y-2'>
            <label className='text-sm font-medium text-gray-700'>Result Limit</label>
            <Select
              value={String(query.limit || 100)}
              onValueChange={(value) =>
                setQuery((prev) => ({
                  ...prev,
                  limit: parseInt(value)
                }))
              }
            >
              <Select.Item value='50'>50 results</Select.Item>
              <Select.Item value='100'>100 results</Select.Item>
              <Select.Item value='500'>500 results</Select.Item>
              <Select.Item value='1000'>1000 results</Select.Item>
            </Select>
          </div>
        </div>

        <div className='mt-6 flex justify-between items-center'>
          <div className='text-sm text-gray-600'>
            {result && (
              <span>
                Found {result.total} results in {executionTime}ms
              </span>
            )}
          </div>

          <Button onClick={executeQuery} disabled={loading} className='flex items-center space-x-2'>
            {loading && <LoadingSpinner size='small' />}
            <span>{loading ? 'Executing...' : 'Execute Query'}</span>
          </Button>
        </div>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className='p-4 bg-red-50 border-red-300'>
          <h4 className='text-red-800 font-semibold'>Query Error</h4>
          <p className='text-red-700'>{error}</p>
        </Card>
      )}

      {/* Results Display */}
      {result && (
        <Card className='p-6'>
          <div className='flex justify-between items-center mb-4'>
            <h3 className='text-lg font-semibold'>Query Results</h3>
            <div className='text-sm text-gray-600'>
              {result.logs.length} of {result.total} results
            </div>
          </div>

          <LogTable
            data={result}
            columns={[
              { key: 'timestamp', label: 'Timestamp', type: 'datetime' },
              { key: 'level', label: 'Level', type: 'badge' },
              { key: 'source', label: 'Source', type: 'text' },
              { key: 'message', label: 'Message', type: 'text' }
            ]}
            pageSize={25}
          />
        </Card>
      )}
    </div>
  );
};
