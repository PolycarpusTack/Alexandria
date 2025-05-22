import React, { useMemo } from 'react';
import { Card } from '../../../../ui/components';
import { CrashLog } from '../../src/interfaces';

interface StatsSummaryProps {
  crashLogs: CrashLog[];
}

export const StatsSummary: React.FC<StatsSummaryProps> = ({ crashLogs }) => {
  const stats = useMemo(() => {
    const totalLogs = crashLogs.length;
    const analyzed = crashLogs.filter((log) => log.analysis).length;
    const highConfidence = crashLogs.filter(
      (log) => log.analysis && log.analysis.confidence >= 0.7
    ).length;
    
    // Count logs by platform
    const platformCounts: Record<string, number> = {};
    crashLogs.forEach((log) => {
      const platform = log.metadata.platform || 'Unknown';
      platformCounts[platform] = (platformCounts[platform] || 0) + 1;
    });
    
    // Get top 3 platforms
    const topPlatforms = Object.entries(platformCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    
    // Get common error patterns
    const errorTypes: Record<string, number> = {};
    crashLogs.forEach((log) => {
      if (log.analysis?.primaryError) {
        // Simplify error message to count similar errors
        const simplifiedError = log.analysis.primaryError
          .replace(/[\d.]+/g, 'X') // Replace numbers with X
          .replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, "'STRING'") // Replace string literals
          .trim()
          .substring(0, 50); // Truncate long errors
        
        errorTypes[simplifiedError] = (errorTypes[simplifiedError] || 0) + 1;
      }
    });
    
    // Get top 3 error types
    const topErrors = Object.entries(errorTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    
    return {
      totalLogs,
      analyzed,
      highConfidence,
      topPlatforms,
      topErrors,
      analysisRate: totalLogs > 0 ? Math.round((analyzed / totalLogs) * 100) : 0,
      confidenceRate: analyzed > 0 ? Math.round((highConfidence / analyzed) * 100) : 0
    };
  }, [crashLogs]);
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="bg-blue-50 border-blue-200">
        <div className="flex flex-col items-center">
          <h3 className="text-lg font-medium text-blue-800">Log Statistics</h3>
          <div className="mt-2 grid grid-cols-2 gap-x-4 w-full">
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">{stats.totalLogs}</p>
              <p className="text-sm text-blue-600">Total Logs</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">{stats.analyzed}</p>
              <p className="text-sm text-blue-600">Analyzed</p>
            </div>
          </div>
          <div className="mt-2 w-full">
            <p className="text-xs text-blue-700 mb-1">Analysis Rate</p>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: `${stats.analysisRate}%` }}
              ></div>
            </div>
            <p className="text-xs text-right text-blue-700 mt-1">{stats.analysisRate}%</p>
          </div>
        </div>
      </Card>
      
      <Card className="bg-green-50 border-green-200">
        <div className="flex flex-col items-center">
          <h3 className="text-lg font-medium text-green-800">Analysis Confidence</h3>
          <div className="mt-2 grid grid-cols-2 gap-x-4 w-full">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">{stats.highConfidence}</p>
              <p className="text-sm text-green-600">High Confidence</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">{stats.confidenceRate}%</p>
              <p className="text-sm text-green-600">Confidence Rate</p>
            </div>
          </div>
          <div className="mt-2 w-full">
            <p className="text-xs text-green-700 mb-1">High Confidence Rate</p>
            <div className="w-full bg-green-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full"
                style={{ width: `${stats.confidenceRate}%` }}
              ></div>
            </div>
            <p className="text-xs text-right text-green-700 mt-1">{stats.confidenceRate}%</p>
          </div>
        </div>
      </Card>
      
      <Card className="bg-purple-50 border-purple-200">
        <div className="flex flex-col">
          <h3 className="text-lg font-medium text-purple-800 text-center mb-2">Top Error Patterns</h3>
          {stats.topErrors.length > 0 ? (
            <ul className="text-sm">
              {stats.topErrors.map(([error, count], index) => (
                <li key={index} className="mb-2">
                  <div className="flex justify-between">
                    <span className="text-purple-700 truncate max-w-xs" title={error}>
                      {error}
                    </span>
                    <span className="text-purple-900 font-semibold">{count}</span>
                  </div>
                  <div className="w-full bg-purple-200 rounded-full h-1.5 mt-1">
                    <div
                      className="bg-purple-600 h-1.5 rounded-full"
                      style={{
                        width: `${(count / stats.totalLogs) * 100}%`
                      }}
                    ></div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-purple-700 italic">No errors analyzed yet</p>
          )}
        </div>
      </Card>
    </div>
  );
};