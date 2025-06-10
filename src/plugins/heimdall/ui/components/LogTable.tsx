/**
 * Enhanced Log Table Component
 * Advanced log display with inline actions, filtering, and ML insights
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/client/components/ui/card';
import { Button } from '@/client/components/ui/button';
import { Input } from '@/client/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/client/components/ui/select';
import { Badge } from '@/client/components/ui/badge';
import { useToast } from '@/client/components/ui/use-toast';
import {           
  ChevronDown,
  ChevronRight,
  Eye,
  Download,
  Filter,
  Search,
  ExternalLink,
  Copy,
  Share,
  Flag,
  AlertTriangle,
  Clock,
  Database,
  Code,
  FileText,
  Bookmark,
  MessageSquare,
  TrendingUp,
  Target,
  Link,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
  Settings,
  Sparkles,
  Brain,
  Activity,
  Shield
          } from 'lucide-react';
import { HeimdallLogEntry, TableColumn, FilterState, SortState } from '../../src/interfaces';

interface LogTableProps {
  logs: HeimdallLogEntry[];
  compact?: boolean;
  showActions?: boolean;
  showInsights?: boolean;
  title?: string;
  className?: string;
  pageSize?: number;
  onLogSelect?: (log: HeimdallLogEntry) => void;
  onCorrelationAnalysis?: (log: HeimdallLogEntry) => void;
  onCreateAlert?: (log: HeimdallLogEntry) => void;
}

export const LogTable: React.FC<LogTableProps> = ({
  logs,
  compact = false,
  showActions = false,
  showInsights = false,
  title,
  className = '',
  pageSize = 50,
  onLogSelect,
  onCorrelationAnalysis,
  onCreateAlert
}) => {
  const { toast } = useToast();

  // State
  const [currentPage, setCurrentPage] = useState(0);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    level: 'all',
    source: 'all',
    timeRange: 'all'
  });
  const [sort, setSort] = useState<SortState>({
    field: 'timestamp',
    direction: 'desc'
  });

  // Define columns based on compact mode
  const columns: TableColumn[] = useMemo(() => {
    const baseColumns: TableColumn[] = [
      { key: 'timestamp', label: 'Time', type: 'datetime', width: '140px', sortable: true },
      { key: 'level', label: 'Level', type: 'level', width: '80px', sortable: true, filterable: true },
      { key: 'source', label: 'Source', type: 'source', width: '120px', sortable: true, filterable: true },
      { key: 'message', label: 'Message', type: 'text', sortable: false }
    ];

    if (!compact) {
      baseColumns.splice(3, 0, 
        { key: 'service', label: 'Service', type: 'badge', width: '100px', sortable: true, filterable: true }
      );
    }

    return baseColumns;
  }, [compact]);

  // Filter and sort logs
  const filteredAndSortedLogs = useMemo(() => {
    if (!logs || logs.length === 0) return [];

    let processed = [...logs];

    // Apply filters
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      processed = processed.filter(log => 
        log.message?.toLowerCase().includes(searchLower) ||
        log.source?.service?.toLowerCase().includes(searchLower) ||
        log.source?.host?.toLowerCase().includes(searchLower)
      );
    }

    if (filters.level !== 'all') {
      processed = processed.filter(log => log.level === filters.level);
    }

    if (filters.source !== 'all') {
      processed = processed.filter(log => 
        log.source?.service === filters.source || 
        log.source?.host === filters.source
      );
    }

    // Apply sorting
    processed.sort((a, b) => {
      const aValue = a[sort.field] || '';
      const bValue = b[sort.field] || '';
      
      let comparison = 0;
      if (sort.field === 'timestamp') {
        comparison = new Date(aValue).getTime() - new Date(bValue).getTime();
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }

      return sort.direction === 'desc' ? -comparison : comparison;
    });

    return processed;
  }, [logs, filters, sort]);

  const totalPages = Math.ceil(filteredAndSortedLogs.length / pageSize);
  
  const paginatedLogs = useMemo(() => {
    const start = currentPage * pageSize;
    const end = start + pageSize;
    return filteredAndSortedLogs.slice(start, end);
  }, [filteredAndSortedLogs, currentPage, pageSize]);

  // Get unique values for filters
  const uniqueSources = useMemo(() => {
    const sources = new Set<string>();
    logs.forEach(log => {
      if (log.source?.service) sources.add(log.source.service);
      if (log.source?.host) sources.add(log.source.host);
    });
    return Array.from(sources);
  }, [logs]);

  const uniqueLevels = useMemo(() => {
    const levels = new Set<string>();
    logs.forEach(log => {
      if (log.level) levels.add(log.level);
    });
    return Array.from(levels);
  }, [logs]);

  // Event handlers
  const toggleRowExpansion = useCallback((logId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedRows(newExpanded);
  }, [expandedRows]);

  const toggleRowSelection = useCallback((logId: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(logId)) {
      newSelected.delete(logId);
    } else {
      newSelected.add(logId);
    }
    setSelectedRows(newSelected);
  }, [selectedRows]);

  const selectAllRows = useCallback(() => {
    const allIds = paginatedLogs.map(log => log.id || log._id || Math.random().toString());
    setSelectedRows(new Set(allIds));
  }, [paginatedLogs]);

  const clearSelection = useCallback(() => {
    setSelectedRows(new Set());
  }, []);

  const handleSort = useCallback((field: string) => {
    setSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  // Action handlers
  const copyLogToClipboard = useCallback(async (log: any) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(log, null, 2));
      toast({
        title: 'Copied to Clipboard',
        description: 'Log entry copied to clipboard'
      });
    } catch (error) {
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy log to clipboard',
        variant: 'destructive'
      });
    }
  }, [toast]);

  const exportSelectedLogs = useCallback(async () => {
    const selectedLogs = paginatedLogs.filter(log => 
      selectedRows.has(log.id || log._id || Math.random().toString())
    );

    if (selectedLogs.length === 0) {
      toast({
        title: 'No Selection',
        description: 'Please select logs to export',
        variant: 'destructive'
      });
      return;
    }

    try {
      const dataStr = JSON.stringify(selectedLogs, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `logs-export-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Export Successful',
        description: `Exported ${selectedLogs.length} logs`
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Failed to export logs',
        variant: 'destructive'
      });
    }
  }, [paginatedLogs, selectedRows, toast]);

  const createAlertFromLog = useCallback(async (log: any) => {
    if (onCreateAlert) {
      onCreateAlert(log);
    } else {
      // Default alert creation
      try {
        const response = await fetch('/api/heimdall/alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Alert for ${log.level} from ${log.source?.service || 'unknown'}`,
            condition: {
              level: log.level,
              service: log.source?.service,
              message_pattern: log.message?.substring(0, 50)
            },
            severity: log.level === 'ERROR' || log.level === 'FATAL' ? 'high' : 'medium'
          })
        });

        if (response.ok) {
          toast({
            title: 'Alert Created',
            description: 'Alert rule created successfully'
          });
        }
      } catch (error) {
        toast({
          title: 'Alert Creation Failed',
          description: 'Failed to create alert rule',
          variant: 'destructive'
        });
      }
    }
  }, [onCreateAlert, toast]);

  const analyzeCorrelations = useCallback(async (log: any) => {
    if (onCorrelationAnalysis) {
      onCorrelationAnalysis(log);
    } else {
      // Default correlation analysis
      try {
        const response = await fetch('/api/heimdall/correlations/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reference_log: log,
            time_window: '1h',
            correlation_fields: ['source.service', 'level', 'message']
          })
        });

        if (response.ok) {
          const result = await response.json();
          toast({
            title: 'Correlation Analysis',
            description: `Found ${result.correlations?.length || 0} related logs`
          });
        }
      } catch (error) {
        toast({
          title: 'Analysis Failed',
          description: 'Failed to analyze correlations',
          variant: 'destructive'
        });
      }
    }
  }, [onCorrelationAnalysis, toast]);

  // Cell formatting with enhanced features
  const formatCellValue = useCallback((log: HeimdallLogEntry, column: TableColumn) => {
    const value = log[column.key as keyof HeimdallLogEntry];

    switch (column.type) {
      case 'datetime':
        const date = new Date(value);
        return (
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs">
              {date.toLocaleDateString()} {date.toLocaleTimeString()}
            </span>
          </div>
        );

      case 'level':
        const getLevelColor = (level: string) => {
          switch (level?.toUpperCase()) {
            case 'ERROR': case 'FATAL': return 'destructive';
            case 'WARN': return 'warning';
            case 'INFO': return 'default';
            case 'DEBUG': return 'secondary';
            case 'TRACE': return 'outline';
            default: return 'secondary';
          }
        };
        
        return (
          <Badge variant={getLevelColor(value)} className="text-xs">
            {String(value).toUpperCase()}
          </Badge>
        );

      case 'source':
        return (
          <div className="flex flex-col gap-1">
            {log.source?.service && (
              <Badge variant="outline" className="text-xs">
                <Database className="w-2 h-2 mr-1" />
                {log.source.service}
              </Badge>
            )}
            {log.source?.host && (
              <span className="text-xs text-muted-foreground">{log.source.host}</span>
            )}
          </div>
        );

      case 'badge':
        return (
          <Badge variant="outline" className="text-xs">
            {String(value)}
          </Badge>
        );

      case 'json':
        if (typeof value === 'object') {
          return (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleRowExpansion(log.id || log._id || Math.random().toString())}
              className="h-6 px-2 text-xs"
            >
              <Code className="w-3 h-3 mr-1" />
              View JSON
            </Button>
          );
        }
        return String(value);

      case 'text':
      default:
        const stringValue = String(value || '');
        const logId = log.id || log._id || Math.random().toString();
        
        if (stringValue.length > (compact ? 50 : 100)) {
          const limit = compact ? 50 : 100;
          return (
            <div className="space-y-1">
              <span className="text-sm">
                {expandedRows.has(logId) ? stringValue : `${stringValue.substring(0, limit)}...`}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleRowExpansion(logId)}
                className="h-5 px-2 text-xs"
              >
                {expandedRows.has(logId) ? (
                  <>
                    <ChevronDown className="w-3 h-3 mr-1" />
                    Less
                  </>
                ) : (
                  <>
                    <ChevronRight className="w-3 h-3 mr-1" />
                    More
                  </>
                )}
              </Button>
            </div>
          );
        }
        return <span className="text-sm">{stringValue}</span>;
    }
  }, [compact, expandedRows, toggleRowExpansion]);

  // Render insights for a log entry
  const renderInsights = useCallback((log: any) => {
    if (!showInsights || !log.insights) return null;

    return (
      <div className="mt-2 space-y-2">
        {log.insights.map((insight: any, index: number) => (
          <div key={index} className="flex items-start gap-2 p-2 bg-blue-50 rounded-lg">
            <Brain className="w-4 h-4 text-blue-500 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium text-blue-900">{insight.type}</div>
              <div className="text-xs text-blue-700">{insight.description}</div>
              {insight.confidence && (
                <div className="text-xs text-blue-600 mt-1">
                  Confidence: {Math.round(insight.confidence * 100)}%
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }, [showInsights]);

  if (!logs || logs.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-32">
          <div className="text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No log entries found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      {/* Header */}
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            {title && <CardTitle>{title}</CardTitle>}
            <div className="flex gap-4 text-sm text-muted-foreground mt-1">
              <span>{filteredAndSortedLogs.length} entries</span>
              {selectedRows.size > 0 && (
                <span>{selectedRows.size} selected</span>
              )}
            </div>
          </div>
          
          <div className="flex gap-2">
            {/* Filter toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
            
            {/* Bulk actions */}
            {selectedRows.size > 0 && (
              <>
                <Button variant="outline" size="sm" onClick={exportSelectedLogs}>
                  <Download className="w-4 h-4 mr-2" />
                  Export ({selectedRows.size})
                </Button>
                <Button variant="outline" size="sm" onClick={clearSelection}>
                  Clear Selection
                </Button>
              </>
            )}
            
            {/* Refresh */}
            <Button variant="outline" size="sm">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* Filters */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 p-4 bg-muted/50 rounded-lg">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search logs..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="pl-10"
              />
            </div>
            
            <Select value={filters.level} onValueChange={(value) => setFilters(prev => ({ ...prev, level: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="All Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                {uniqueLevels.map(level => (
                  <SelectItem key={level} value={level}>{level}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={filters.source} onValueChange={(value) => setFilters(prev => ({ ...prev, source: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="All Sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {uniqueSources.map(source => (
                  <SelectItem key={source} value={source}>{source}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={filters.timeRange} onValueChange={(value) => setFilters(prev => ({ ...prev, timeRange: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="All Time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="6h">Last 6 Hours</SelectItem>
                <SelectItem value="1d">Last Day</SelectItem>
                <SelectItem value="7d">Last Week</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="p-0">
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/50">
              <tr>
                {/* Select all checkbox */}
                {showActions && (
                  <th className="px-4 py-3 text-left w-12">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === paginatedLogs.length && paginatedLogs.length > 0}
                      onChange={() => selectedRows.size === paginatedLogs.length ? clearSelection() : selectAllRows()}
                      className="rounded"
                    />
                  </th>
                )}
                
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted"
                    style={{ width: column.width }}
                    onClick={() => column.sortable && handleSort(column.key)}
                  >
                    <div className="flex items-center gap-1">
                      {column.label}
                      {column.sortable && sort.field === column.key && (
                        sort.direction === 'asc' ? 
                          <ChevronDown className="w-3 h-3" /> : 
                          <ChevronRightIcon className="w-3 h-3 rotate-90" />
                      )}
                    </div>
                  </th>
                ))}
                
                {showActions && (
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-32">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-background divide-y divide-border">
              {paginatedLogs.map((log, index) => {
                const logId = log.id || log._id || `log-${index}`;
                const isSelected = selectedRows.has(logId);
                const isExpanded = expandedRows.has(logId);
                
                return (
                  <React.Fragment key={logId}>
                    <tr 
                      className={`hover:bg-muted/50 cursor-pointer ${isSelected ? 'bg-blue-50' : ''}`}
                      onClick={() => onLogSelect && onLogSelect(log)}
                    >
                      {/* Selection checkbox */}
                      {showActions && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRowSelection(logId)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded"
                          />
                        </td>
                      )}
                      
                      {columns.map((column) => (
                        <td key={column.key} className="px-4 py-3 text-sm">
                          {formatCellValue(log, column)}
                        </td>
                      ))}
                      
                      {/* Actions */}
                      {showActions && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRowExpansion(logId);
                              }}
                              className="h-6 w-6 p-0"
                            >
                              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            </Button>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyLogToClipboard(log);
                              }}
                              className="h-6 w-6 p-0"
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                analyzeCorrelations(log);
                              }}
                              className="h-6 w-6 p-0"
                            >
                              <TrendingUp className="w-3 h-3" />
                            </Button>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                createAlertFromLog(log);
                              }}
                              className="h-6 w-6 p-0"
                            >
                              <Flag className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                    
                    {/* Expanded row details */}
                    {isExpanded && (
                      <tr className="bg-muted/30">
                        <td colSpan={columns.length + (showActions ? 2 : 0)} className="px-4 py-4">
                          <div className="space-y-4">
                            {/* Full message */}
                            <div>
                              <h5 className="text-sm font-semibold mb-2">Full Message</h5>
                              <div className="bg-background p-3 rounded-lg border text-sm">
                                {log.message}
                              </div>
                            </div>
                            
                            {/* Metadata grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Context data */}
                              {log.context && (
                                <div>
                                  <h5 className="text-sm font-semibold mb-2">Context</h5>
                                  <pre className="bg-background p-3 rounded-lg border text-xs overflow-x-auto">
                                    {JSON.stringify(log.context, null, 2)}
                                  </pre>
                                </div>
                              )}
                              
                              {/* Metadata */}
                              {log.metadata && (
                                <div>
                                  <h5 className="text-sm font-semibold mb-2">Metadata</h5>
                                  <pre className="bg-background p-3 rounded-lg border text-xs overflow-x-auto">
                                    {JSON.stringify(log.metadata, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                            
                            {/* ML Insights */}
                            {renderInsights(log)}
                            
                            {/* Extended actions */}
                            <div className="flex gap-2 pt-2 border-t">
                              <Button variant="outline" size="sm" onClick={() => copyLogToClipboard(log)}>
                                <Copy className="w-4 h-4 mr-2" />
                                Copy Full Log
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => analyzeCorrelations(log)}>
                                <Activity className="w-4 h-4 mr-2" />
                                Find Related
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => createAlertFromLog(log)}>
                                <Shield className="w-4 h-4 mr-2" />
                                Create Alert
                              </Button>
                              <Button variant="outline" size="sm">
                                <ExternalLink className="w-4 h-4 mr-2" />
                                View in Context
                              </Button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <div className="text-sm text-muted-foreground">
              Showing {currentPage * pageSize + 1} to{' '}
              {Math.min((currentPage + 1) * pageSize, filteredAndSortedLogs.length)} of{' '}
              {filteredAndSortedLogs.length} entries
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(0)}
                disabled={currentPage === 0}
              >
                <ChevronsLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 0}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = Math.max(0, Math.min(currentPage - 2, totalPages - 5)) + i;
                  if (pageNum >= totalPages) return null;
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={pageNum === currentPage ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className="w-8 h-8 p-0"
                    >
                      {pageNum + 1}
                    </Button>
                  );
                })}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage >= totalPages - 1}
              >
                <ChevronRightIcon className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages - 1)}
                disabled={currentPage >= totalPages - 1}
              >
                <ChevronsRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LogTable;