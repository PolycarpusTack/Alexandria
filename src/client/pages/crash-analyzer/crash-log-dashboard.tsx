import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useCrashAnalyzerContext } from './crash-analyzer-context';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { UploadIcon, Search, Plus, Filter, RefreshCw, ExternalLink, Trash2 } from 'lucide-react';

export const CrashLogDashboard: React.FC = () => {
  const { service } = useCrashAnalyzerContext();
  const navigate = useNavigate();
  const [crashLogs, setCrashLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('all');

  useEffect(() => {
    loadCrashLogs();
  }, []);

  const loadCrashLogs = async () => {
    try {
      setLoading(true);
      const logs = await service.getAllCrashLogs();
      setCrashLogs(logs);
      setError(null);
    } catch (err) {
      console.error('Error loading crash logs:', err);
      setError('Failed to load crash logs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogClick = (logId: string) => {
    navigate(`/crash-analyzer/logs/${logId}`);
  };

  const handleUploadClick = () => {
    navigate('/crash-analyzer/upload');
  };

  const handleDeleteLog = async (e: React.MouseEvent, logId: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this crash log?')) {
      try {
        await service.deleteCrashLog(logId);
        loadCrashLogs();
      } catch (err) {
        console.error('Error deleting crash log:', err);
        setError('Failed to delete crash log. Please try again.');
      }
    }
  };

  const filteredLogs = crashLogs.filter((log) => {
    const matchesSearch = searchTerm === '' || 
      (log.title && log.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.analysis?.primaryError && log.analysis.primaryError.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesPlatform = filterPlatform === 'all' || 
      (log.metadata?.platform && log.metadata.platform.toLowerCase() === filterPlatform.toLowerCase());
    
    return matchesSearch && matchesPlatform;
  });

  // Get unique platforms for filter
  const platforms = ['all', ...new Set(crashLogs.map(log => 
    (log.metadata?.platform || 'unknown').toLowerCase()
  ))];

  // Calculate statistics
  const stats = {
    total: crashLogs.length,
    high: crashLogs.filter(log => log.analysis?.confidence >= 0.7).length,
    medium: crashLogs.filter(log => log.analysis?.confidence >= 0.4 && log.analysis?.confidence < 0.7).length,
    low: crashLogs.filter(log => log.analysis?.confidence < 0.4).length,
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Crash Analyzer</h1>
          <p className="text-muted-foreground">Analyze crash logs using AI to identify root causes</p>
        </div>
        <Button onClick={handleUploadClick}>
          <UploadIcon className="mr-2 h-4 w-4" />
          Upload Crash Log
        </Button>
      </div>

      {error && (
        <div className="mb-6 p-4 border border-red-200 bg-red-50 text-red-700 rounded-md">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">Total Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">High Confidence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-600">{stats.high}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">Medium Confidence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-amber-500">{stats.medium}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">Low Confidence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-red-500">{stats.low}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Crash Logs</CardTitle>
          <CardDescription>Browse and analyze crash logs from your applications</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search crash logs..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div className="w-full md:w-[180px]">
              <Select value={filterPlatform} onValueChange={setFilterPlatform}>
                <SelectTrigger>
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Platform" />
                </SelectTrigger>
                <SelectContent>
                  {platforms.map((platform) => (
                    <SelectItem key={platform} value={platform}>
                      {platform.charAt(0).toUpperCase() + platform.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button variant="outline" size="icon" onClick={loadCrashLogs}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solid border-current border-r-transparent" />
              <p className="mt-2 text-muted-foreground">Loading crash logs...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No crash logs found.</p>
              <Button variant="outline" onClick={handleUploadClick}>
                <Plus className="mr-2 h-4 w-4" />
                Upload Your First Crash Log
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Primary Error</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow 
                      key={log.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleLogClick(log.id)}
                    >
                      <TableCell className="font-medium">{log.title}</TableCell>
                      <TableCell>
                        {log.metadata?.platform ? (
                          <Badge variant="outline">{log.metadata.platform}</Badge>
                        ) : (
                          <span className="text-muted-foreground">Unknown</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {log.analysis?.primaryError || 'Not analyzed'}
                      </TableCell>
                      <TableCell>
                        {log.analysis ? (
                          log.analysis.confidence >= 0.7 ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-200">High</Badge>
                          ) : log.analysis.confidence >= 0.4 ? (
                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200">Medium</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800 hover:bg-red-200">Low</Badge>
                          )
                        ) : (
                          <Badge variant="outline">N/A</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {format(new Date(log.uploadedAt), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLogClick(log.id);
                            }}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-red-500 hover:text-red-700 hover:bg-red-100"
                            onClick={(e) => handleDeleteLog(e, log.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {filteredLogs.length} of {crashLogs.length} crash logs
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};