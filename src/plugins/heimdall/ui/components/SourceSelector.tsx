/**
 * Source Selector Component
 *
 * Allows users to select and switch between available log sources
 */

import React from 'react';
import { LogSourceConfig } from '../../src/interfaces';
import { Select } from '../../../../ui/components';

interface SourceSelectorProps {
  sources: LogSourceConfig[];
  selectedSource: string | null;
  onSourceChange: (sourceId: string) => void;
}

export const SourceSelector: React.FC<SourceSelectorProps> = ({
  sources,
  selectedSource,
  onSourceChange
}) => {
  return (
    <div className='flex items-center space-x-2'>
      <label className='text-sm font-medium text-gray-700'>Source:</label>
      <Select
        value={selectedSource || ''}
        onValueChange={onSourceChange}
        placeholder='Select a log source'
        className='min-w-[200px]'
      >
        {sources.map((source) => (
          <Select.Item key={source.id} value={source.id!}>
            <div className='flex items-center space-x-2'>
              <div
                className={`w-2 h-2 rounded-full ${
                  source.status === 'connected' ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <span>{source.name}</span>
              <span className='text-xs text-gray-500'>({source.type})</span>
            </div>
          </Select.Item>
        ))}
      </Select>
    </div>
  );
};
