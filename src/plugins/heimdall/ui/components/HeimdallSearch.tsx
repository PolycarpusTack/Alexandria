/**
 * Heimdall Search Component
 * Advanced search interface for log intelligence platform
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/client/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/client/components/ui/tabs';
import { Button } from '@/client/components/ui/button';
import { Input } from '@/client/components/ui/input';
import { Textarea } from '@/client/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/client/components/ui/select';
import { Badge } from '@/client/components/ui/badge';
import { useToast } from '@/client/components/ui/use-toast';
import {        
  Search, 
  Filter, 
  Download,
  Save,
  History,
  Brain,
  Sparkles,
  Play,
  Pause,
  X,
  Plus,
  Minus,
  Clock,
  Database,
  Zap,
  Target,
  AlertTriangle,
  CheckCircle,
  FileText,
  Code,
  Settings
       } from 'lucide-react';
import { 
  HeimdallQuery,
  HeimdallQueryResult,
  LogLevel,
  TimeRange
} from '../../src/interfaces';
import { LogTable } from './LogTable';
import { LogChart } from './LogChart';
import { QueryBuilder } from './QueryBuilder';

interface HeimdallSearchProps {
  initialQuery?: string;
  timeRange: TimeRange;
  onQueryChange?: (query: string) => void;
}

interface SavedQuery {
  id: string;
  name: string;
  query: HeimdallQuery;
  created: Date;
  lastUsed: Date;
  usageCount: number;
}

interface QueryHistory {
  id: string;
  query: HeimdallQuery;
  timestamp: Date;
  resultCount: number;
}

const HeimdallSearch: React.FC<HeimdallSearchProps> = ({
  initialQuery = '',
  timeRange,
  onQueryChange
}) => {
  const { toast } = useToast();

  // Core state
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<HeimdallQueryResult | null>(null);
  const [activeSearchTab, setActiveSearchTab] = useState('simple');

  // Advanced search state
  const [advancedQuery, setAdvancedQuery] = useState<HeimdallQuery>({
    timeRange,
    structured: {
      search: initialQuery || undefined,
      limit: 1000
    }
  });

  // Query management state
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [queryHistory, setQueryHistory] = useState<QueryHistory[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveQueryName, setSaveQueryName] = useState('');

  // AI state
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [naturalLanguageQuery, setNaturalLanguageQuery] = useState('');
  const [translatedQuery, setTranslatedQuery] = useState('');

  // Filters state
  const [selectedLevels, setSelectedLevels] = useState<LogLevel[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<string>('1h');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Result state
  const [resultView, setResultView] = useState<'table' | 'chart' | 'raw'>('table');
  const [sortField, setSortField] = useState<string>('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadSavedQueries();
    loadQueryHistory();
    generateAISuggestions();
  }, []);

  useEffect(() => {
    if (onQueryChange) {
      onQueryChange(query);
    }
  }, [query, onQueryChange]);

  const loadSavedQueries = async () => {
    try {
      const response = await fetch('/api/heimdall/queries/saved');
      if (response.ok) {
        const queries = await response.json();
        setSavedQueries(queries);
      }
    } catch (error) {
      console.error('Failed to load saved queries:', error);
    }
  };

  const loadQueryHistory = async () => {
    try {
      const response = await fetch('/api/heimdall/queries/history');
      if (response.ok) {
        const history = await response.json();
        setQueryHistory(history);
      }
    } catch (error) {
      console.error('Failed to load query history:', error);
    }
  };

  const generateAISuggestions = async () => {
    try {
      const response = await fetch('/api/heimdall/ai/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: query || 'recent errors' })
      });
      
      if (response.ok) {
        const suggestions = await response.json();
        setAiSuggestions(suggestions);
      }
    } catch (error) {
      console.error('Failed to get AI suggestions:', error);
    }
  };

  const executeSearch = useCallback(async () => {
    if (!query.trim() && activeSearchTab === 'simple') {
      toast({
        title: 'Search Required',
        description: 'Please enter a search query',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    
    try {
      const searchQuery: HeimdallQuery = activeSearchTab === 'simple' ? {
        timeRange,
        structured: {
          search: query || undefined,
          levels: selectedLevels.length > 0 ? selectedLevels : undefined,
          sources: selectedSources.length > 0 ? selectedSources : undefined,
          limit: 1000,
          sort: [{ field: sortField, order: sortOrder }]
        },
        mlFeatures: {
          similaritySearch: query ? {
            referenceText: query,
            threshold: 0.6
          } : undefined,
          anomalyDetection: {
            enabled: true,
            sensitivity: 0.7
          }
        }
      } : advancedQuery;

      const response = await fetch('/api/heimdall/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchQuery)
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const result = await response.json();
      setResults(result);

      // Add to history
      const historyEntry: QueryHistory = {
        id: Date.now().toString(),
        query: searchQuery,
        timestamp: new Date(),
        resultCount: result.total || 0
      };
      setQueryHistory(prev => [historyEntry, ...prev.slice(0, 49)]); // Keep last 50

      toast({
        title: 'Search Complete',
        description: `Found ${result.total?.toLocaleString()} logs`
      });
    } catch (error) {
      console.error('Search failed:', error);
      toast({
        title: 'Search Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [query, activeSearchTab, timeRange, selectedLevels, selectedSources, sortField, sortOrder, advancedQuery, toast]);

  const translateNaturalLanguage = async () => {
    if (!naturalLanguageQuery.trim()) return;

    try {
      const response = await fetch('/api/heimdall/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ naturalQuery: naturalLanguageQuery })
      });

      if (response.ok) {
        const translation = await response.json();
        setTranslatedQuery(translation.query);
        setQuery(translation.query);
      }
    } catch (error) {
      toast({
        title: 'Translation Failed',
        description: 'Failed to translate natural language query',
        variant: 'destructive'
      });
    }
  };

  const saveQuery = async () => {
    if (!saveQueryName.trim()) {
      toast({
        title: 'Name Required',
        description: 'Please enter a name for the saved query',
        variant: 'destructive'
      });
      return;
    }

    try {
      const savedQuery: SavedQuery = {
        id: Date.now().toString(),
        name: saveQueryName,
        query: activeSearchTab === 'simple' ? {
          timeRange,
          structured: {
            search: query || undefined,
            levels: selectedLevels.length > 0 ? selectedLevels : undefined,
            sources: selectedSources.length > 0 ? selectedSources : undefined
          }
        } : advancedQuery,
        created: new Date(),
        lastUsed: new Date(),
        usageCount: 0
      };

      const response = await fetch('/api/heimdall/queries/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savedQuery)
      });

      if (response.ok) {
        setSavedQueries(prev => [savedQuery, ...prev]);
        setShowSaveDialog(false);
        setSaveQueryName('');
        toast({
          title: 'Query Saved',
          description: `Saved as "${saveQueryName}"`
        });
      }
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: 'Failed to save query',
        variant: 'destructive'
      });
    }
  };

  const loadSavedQuery = (savedQuery: SavedQuery) => {
    setAdvancedQuery(savedQuery.query);
    if (savedQuery.query.structured?.search) {
      setQuery(savedQuery.query.structured.search);
    }
    if (savedQuery.query.structured?.levels) {
      setSelectedLevels(savedQuery.query.structured.levels);
    }
    if (savedQuery.query.structured?.sources) {
      setSelectedSources(savedQuery.query.structured.sources);
    }
    
    toast({
      title: 'Query Loaded',
      description: `Loaded "${savedQuery.name}"`
    });
  };

  const exportResults = async (format: 'csv' | 'json') => {
    if (!results) return;

    try {
      const response = await fetch('/api/heimdall/query/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...results, format })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `heimdall-search-${Date.now()}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({
          title: 'Export Successful',
          description: `Results exported as ${format.toUpperCase()}`
        });
      }
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Failed to export results',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Interface */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Advanced Log Search
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSaveDialog(true)}
                disabled={!query.trim()}
              >
                <Save className="w-4 h-4 mr-2" />
                Save Query
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={generateAISuggestions}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                AI Suggestions
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeSearchTab} onValueChange={setActiveSearchTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="simple">
                <Search className="w-4 h-4 mr-2" />
                Simple Search
              </TabsTrigger>
              <TabsTrigger value="advanced">
                <Settings className="w-4 h-4 mr-2" />
                Advanced Query
              </TabsTrigger>
              <TabsTrigger value="natural">
                <Brain className="w-4 h-4 mr-2" />
                Natural Language
              </TabsTrigger>
              <TabsTrigger value="saved">
                <History className="w-4 h-4 mr-2" />
                Saved & History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="simple" className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search logs, error messages, or use natural language..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && executeSearch()}
                    className="pl-10"
                  />
                </div>
                <Button onClick={executeSearch} disabled={loading}>
                  {loading ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                  Search
                </Button>
              </div>

              {/* Quick Filters */}
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Filters:</span>
                </div>
                
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5m">Last 5 minutes</SelectItem>
                    <SelectItem value="15m">Last 15 minutes</SelectItem>
                    <SelectItem value="1h">Last hour</SelectItem>
                    <SelectItem value="6h">Last 6 hours</SelectItem>
                    <SelectItem value="1d">Last 24 hours</SelectItem>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex gap-1">
                  {Object.values(LogLevel).map(level => (
                    <Button
                      key={level}
                      variant={selectedLevels.includes(level) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setSelectedLevels(prev => 
                          prev.includes(level) 
                            ? prev.filter(l => l !== level)
                            : [...prev, level]
                        );
                      }}
                    >
                      {level}
                    </Button>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                >
                  {showAdvancedFilters ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  More Filters
                </Button>
              </div>

              {/* Advanced Filters */}
              {showAdvancedFilters && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Sort By</label>
                    <Select value={sortField} onValueChange={setSortField}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="timestamp">Timestamp</SelectItem>
                        <SelectItem value="level">Level</SelectItem>
                        <SelectItem value="source.service">Service</SelectItem>
                        <SelectItem value="message">Message</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Order</label>
                    <Select value={sortOrder} onValueChange={(value: 'asc' | 'desc') => setSortOrder(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="desc">Newest First</SelectItem>
                        <SelectItem value="asc">Oldest First</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Services</label>
                    <Input
                      placeholder="Filter by services..."
                      value={selectedSources.join(', ')}
                      onChange={(e) => setSelectedSources(e.target.value.split(', ').filter(Boolean))}
                    />
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4">
              <QueryBuilder
                query={advancedQuery}
                onChange={setAdvancedQuery}
                onExecute={executeSearch}
                loading={loading}
              />
            </TabsContent>

            <TabsContent value="natural" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Natural Language Query
                  </label>
                  <Textarea
                    placeholder="Describe what you're looking for in plain English... e.g., 'Show me all error logs from the payment service in the last hour'"
                    value={naturalLanguageQuery}
                    onChange={(e) => setNaturalLanguageQuery(e.target.value)}
                    rows={3}
                  />
                  <div className="flex gap-2 mt-2">
                    <Button onClick={translateNaturalLanguage} disabled={!naturalLanguageQuery.trim()}>
                      <Brain className="w-4 h-4 mr-2" />
                      Translate to Query
                    </Button>
                    <Button onClick={executeSearch} disabled={!translatedQuery || loading}>
                      <Play className="w-4 h-4 mr-2" />
                      Execute
                    </Button>
                  </div>
                </div>

                {translatedQuery && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Translated Query
                    </label>
                    <div className="p-3 bg-muted rounded-lg font-mono text-sm">
                      {translatedQuery}
                    </div>
                  </div>
                )}

                {aiSuggestions.length > 0 && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      AI Suggestions
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {aiSuggestions.map((suggestion, index) => (
                        <Badge
                          key={index}
                          variant="outline"
                          className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                          onClick={() => setNaturalLanguageQuery(suggestion)}
                        >
                          {suggestion}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="saved" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Saved Queries */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Saved Queries</h3>
                  <div className="space-y-3">
                    {savedQueries.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        No saved queries yet
                      </p>
                    ) : (
                      savedQueries.map((savedQuery) => (
                        <Card key={savedQuery.id} className="cursor-pointer hover:bg-muted/50">
                          <CardContent className="p-4" onClick={() => loadSavedQuery(savedQuery)}>
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-medium">{savedQuery.name}</h4>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {savedQuery.query.structured?.search || 'Advanced query'}
                                </p>
                                <div className="flex gap-4 text-xs text-muted-foreground mt-2">
                                  <span>Created: {savedQuery.created.toLocaleDateString()}</span>
                                  <span>Used: {savedQuery.usageCount} times</span>
                                </div>
                              </div>
                              <Button variant="ghost" size="sm">
                                <Play className="w-4 h-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </div>

                {/* Query History */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Recent Queries</h3>
                  <div className="space-y-3">
                    {queryHistory.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        No query history yet
                      </p>
                    ) : (
                      queryHistory.slice(0, 10).map((historyItem) => (
                        <Card key={historyItem.id} className="cursor-pointer hover:bg-muted/50">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="text-sm">
                                  {historyItem.query.structured?.search || 'Advanced query'}
                                </p>
                                <div className="flex gap-4 text-xs text-muted-foreground mt-2">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {historyItem.timestamp.toLocaleTimeString()}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Database className="w-3 h-3" />
                                    {historyItem.resultCount.toLocaleString()} results
                                  </span>
                                </div>
                              </div>
                              <Button variant="ghost" size="sm">
                                <Play className="w-4 h-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Results */}
      {results && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Search Results
                <Badge variant="outline">
                  {results.total?.toLocaleString()} logs
                </Badge>
              </CardTitle>
              <div className="flex gap-2">
                <div className="flex gap-1">
                  <Button
                    variant={resultView === 'table' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setResultView('table')}
                  >
                    <FileText className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={resultView === 'chart' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setResultView('chart')}
                  >
                    <Zap className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={resultView === 'raw' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setResultView('raw')}
                  >
                    <Code className="w-4 h-4" />
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportResults('csv')}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {resultView === 'table' && (
              <LogTable 
                logs={results.logs || []} 
                showActions
                showInsights
              />
            )}
            {resultView === 'chart' && (
              <LogChart 
                data={results.aggregations?.logs_over_time || []}
                height={400}
                showTrend
                showAnomaly
              />
            )}
            {resultView === 'raw' && (
              <div className="bg-muted p-4 rounded-lg font-mono text-sm max-h-96 overflow-auto">
                <pre>{JSON.stringify(results, null, 2)}</pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Save Query Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-96">
            <CardHeader>
              <CardTitle>Save Query</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Query Name</label>
                <Input
                  placeholder="Enter a name for this query..."
                  value={saveQueryName}
                  onChange={(e) => setSaveQueryName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && saveQuery()}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowSaveDialog(false);
                    setSaveQueryName('');
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={saveQuery}>
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export { HeimdallSearch };
export default HeimdallSearch;