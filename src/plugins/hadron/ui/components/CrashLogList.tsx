import React from 'react';
import { format } from 'date-fns';
import { CrashLog } from '../../src/interfaces';

import { Badge } from '../../../../client/components/ui/badge';
import { Button } from '../../../../client/components/ui/button';
interface CrashLogListProps {
  crashLogs: CrashLog[];
  onLogClick: (logId: string) => void;
  onDeleteLog: (logId: string) => void;
}

export const CrashLogList: React.FC<CrashLogListProps> = ({
  crashLogs,
  onLogClick,
  onDeleteLog
}) => {
  // Sort logs by upload date (newest first)
  const sortedLogs = [...crashLogs].sort((a, b) => {
    return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
  });

  const getConfidenceBadge = (confidence?: number) => {
    if (confidence === undefined) return null;

    if (confidence >= 0.7) {
      return <Badge color='green'>High Confidence</Badge>;
    } else if (confidence >= 0.4) {
      return <Badge color='yellow'>Medium Confidence</Badge>;
    } else {
      return <Badge color='red'>Low Confidence</Badge>;
    }
  };

  const getStatusBadge = (log: CrashLog) => {
    if (!log.parsedData) {
      return <Badge color='gray'>Not Parsed</Badge>;
    }

    if (!log.analysis) {
      return <Badge color='blue'>Pending Analysis</Badge>;
    }

    return <Badge color='green'>Analyzed</Badge>;
  };

  return (
    <div className='overflow-x-auto'>
      <table className='min-w-full divide-y divide-gray-200'>
        <thead className='bg-gray-50'>
          <tr>
            <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
              Title
            </th>
            <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
              Upload Date
            </th>
            <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
              Status
            </th>
            <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
              Primary Error
            </th>
            <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
              Confidence
            </th>
            <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
              Actions
            </th>
          </tr>
        </thead>
        <tbody className='bg-white divide-y divide-gray-200'>
          {sortedLogs.map((log) => (
            <tr key={log.id} className='hover:bg-gray-50 cursor-pointer'>
              <td
                className='px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900'
                onClick={() => onLogClick(log.id)}
              >
                {log.title}
              </td>
              <td
                className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'
                onClick={() => onLogClick(log.id)}
              >
                {format(new Date(log.uploadedAt), 'MMM d, yyyy HH:mm')}
              </td>
              <td
                className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'
                onClick={() => onLogClick(log.id)}
              >
                {getStatusBadge(log)}
              </td>
              <td
                className='px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate max-w-xs'
                onClick={() => onLogClick(log.id)}
              >
                {log.analysis?.primaryError || 'N/A'}
              </td>
              <td
                className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'
                onClick={() => onLogClick(log.id)}
              >
                {getConfidenceBadge(log.analysis?.confidence)}
              </td>
              <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium'>
                <Button
                  variant='secondary'
                  size='small'
                  onClick={() => onLogClick(log.id)}
                  className='mr-2'
                >
                  View
                </Button>
                <Button
                  variant='danger'
                  size='small'
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteLog(log.id);
                  }}
                >
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
