import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Card, 
  Button, 
  Spinner, 
  EmptyState,
  toast,
  Pagination,
  Input,
  Select 
} from '../../../../ui/components';
import { useUIContext } from '../../../../ui/ui-context';
import { CrashLog } from '../../src/interfaces';
import { CrashLogList } from './CrashLogList';
import { StatsSummary } from './StatsSummary';
import { hadronTheme } from '../utils/theme';

interface DashboardProps {
  crashAnalyzerService: any;
}

export const Dashboard: React.FC<DashboardProps> = ({ crashAnalyzerService }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [crashLogs, setCrashLogs] = useState<CrashLog[]>([]);
  const [allCrashLogs, setAllCrashLogs] = useState<CrashLog[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'platform' | 'status'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();
  const { showModal } = useUIContext();
  
  useEffect(() => {
    loadCrashLogs();
  }, []);
  
  // Filter and sort logs whenever search term, sort criteria, or all logs change
  useEffect(() => {
    filterAndSortLogs();
  }, [searchTerm, sortBy, sortDirection, allCrashLogs, currentPage, itemsPerPage]);
  
  // Apply filtering and sorting to the logs
  const filterAndSortLogs = useCallback(() => {
    let filtered = [...allCrashLogs];
    
    // Apply search filter if there is a search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(log => {
        return (
          log.title.toLowerCase().includes(term) ||
          (log.metadata.platform && log.metadata.platform.toLowerCase().includes(term)) ||
          (log.metadata.appVersion && log.metadata.appVersion.toLowerCase().includes(term))
        );
      });
    }
    
    // Apply sorting
    filtered = filtered.sort((a, b) => {
      if (sortBy === 'date') {
        return sortDirection === 'desc'
          ? new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
          : new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
      } else if (sortBy === 'platform') {
        const platformA = (a.metadata.platform || '').toLowerCase();
        const platformB = (b.metadata.platform || '').toLowerCase();
        return sortDirection === 'desc'
          ? platformB.localeCompare(platformA)
          : platformA.localeCompare(platformB);
      } else if (sortBy === 'status') {
        const statusA = a.analysis ? 'analyzed' : 'pending';
        const statusB = b.analysis ? 'analyzed' : 'pending';
        return sortDirection === 'desc'
          ? statusB.localeCompare(statusA)
          : statusA.localeCompare(statusB);
      }
      return 0;
    });
    
    // Apply pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedLogs = filtered.slice(startIndex, startIndex + itemsPerPage);
    
    setCrashLogs(paginatedLogs);
  }, [allCrashLogs, searchTerm, sortBy, sortDirection, currentPage, itemsPerPage]);
  
  const loadCrashLogs = async () => {
    try {
      setLoading(true);
      setRefreshing(true);
      const logs = await crashAnalyzerService.getAllCrashLogs();
      setAllCrashLogs(logs);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      const errorMsg = 'Failed to load crash logs. Please try again.';
      setError(errorMsg);
      toast?.({ title: 'Error', description: errorMsg, variant: 'destructive' });
      console.error('Error loading crash logs:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  // Handle refresh button click
  const handleRefresh = () => {
    loadCrashLogs();
  };
  
  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };
  
  // Handle items per page change
  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(1); // Reset to first page when changing items per page
  };
  
  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page when searching
  };
  
  // Handle sort change
  const handleSortChange = (newSortBy: 'date' | 'platform' | 'status') => {
    if (sortBy === newSortBy) {
      // Toggle direction if clicking the same sort column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new sort column and default to descending
      setSortBy(newSortBy);
      setSortDirection('desc');
    }
  };
  
  const handleUploadClick = () => {
    showModal('crash-analyzer-upload', {
      onLogUploaded: (logId: string) => {
        loadCrashLogs();
        // Navigate to the log detail page when upload is complete
        if (logId) {
          navigate(`/crash-analyzer/logs/${logId}`);
        }
      }
    });
  };
  
  const handleLogClick = (logId: string) => {
    navigate(`/crash-analyzer/logs/${logId}`);
  };
  
  const handleDeleteLog = async (logId: string) => {
    if (window.confirm('Are you sure you want to delete this crash log?')) {
      try {
        await crashAnalyzerService.deleteCrashLog(logId);
        loadCrashLogs();
      } catch (err) {
        console.error('Error deleting crash log:', err);
        setError('Failed to delete crash log.');
      }
    }
  };
  
  if (loading && !refreshing) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="large" />
      </div>
    );
  }
  
  return (
    <div className="p-4">
      <div className="flex flex-col space-y-4 mb-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <span className={hadronTheme.classes.accent}>⚡</span>
              Crash Analyzer
            </h1>
            {lastUpdated && (
              <div className="ml-4 text-sm text-gray-500">
                Last updated: {lastUpdated.toLocaleTimeString()}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="ml-1" 
                  onClick={handleRefresh}
                  disabled={refreshing}
                >
                  {refreshing ? <Spinner size="small" /> : '↻'}
                </Button>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {/* Show code snippet button only if the service has that capability */}
            {'analyzeCodeSnippet' in crashAnalyzerService && (
              <Button
                variant="secondary"
                onClick={() => showModal('crash-analyzer-code-snippet-upload', {
                  sessionId: 'current-session', // This would be dynamic in a real implementation
                  onUploadComplete: (snippetId: string) => {
                    navigate(`/crash-analyzer/snippets/${snippetId}`);
                  }
                })}
              >
                Analyze Code Snippet
              </Button>
            )}
            <Button variant="primary" onClick={handleUploadClick}>
              Upload Crash Log
            </Button>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex-grow">
            <Input
              placeholder="Search by title, platform, or version..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Button 
              variant="secondary" 
              size="small" 
              onClick={() => handleSortChange('date')}
              className={sortBy === 'date' ? 'bg-blue-100' : ''}
            >
              Date {sortBy === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
            </Button>
            
            <Button 
              variant="secondary" 
              size="small" 
              onClick={() => handleSortChange('platform')}
              className={sortBy === 'platform' ? 'bg-blue-100' : ''}
            >
              Platform {sortBy === 'platform' && (sortDirection === 'asc' ? '↑' : '↓')}
            </Button>
            
            <Button 
              variant="secondary" 
              size="small" 
              onClick={() => handleSortChange('status')}
              className={sortBy === 'status' ? 'bg-blue-100' : ''}
            >
              Status {sortBy === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
            </Button>
          </div>
        </div>
      </div>
      
      {error && (
        <Card className="mb-4 bg-red-50 border-red-200">
          <p className="text-red-600">{error}</p>
        </Card>
      )}
      
      <StatsSummary crashLogs={crashLogs} />
      
      <Card className="mt-6">
        <h2 className="text-xl font-semibold mb-4">Recent Crash Logs</h2>
        
        {allCrashLogs.length === 0 ? (
          <EmptyState
            title="No crash logs found"
            description="Upload your first crash log to get started with AI-powered analysis."
            actions={<Button onClick={handleUploadClick}>Upload Crash Log</Button>}
          />
        ) : crashLogs.length === 0 && searchTerm ? (
          <EmptyState
            title="No matching crash logs"
            description={`No crash logs match the search term "${searchTerm}".`}
            actions={<Button onClick={() => setSearchTerm('')}>Clear Search</Button>}
          />
        ) : (
          <>
            <CrashLogList
              crashLogs={crashLogs}
              onLogClick={handleLogClick}
              onDeleteLog={handleDeleteLog}
            />
            
            <div className="mt-4 flex justify-between items-center">
              <div className="text-sm text-gray-500">
                Showing {crashLogs.length} of {allCrashLogs.length} crash logs
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm">Items per page:</span>
                  <Select 
                    value={itemsPerPage.toString()} 
                    onChange={handleItemsPerPageChange}
                    className="w-16"
                  >
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                  </Select>
                </div>
                
                <Pagination
                  page={currentPage}
                  total={allCrashLogs.length}
                  pageSize={itemsPerPage}
                  onChange={handlePageChange}
                />
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};