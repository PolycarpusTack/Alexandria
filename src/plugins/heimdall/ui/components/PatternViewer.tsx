/**
 * Pattern Viewer Component
 * AI-powered pattern detection and visualization for log analysis
 */

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/client/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/client/components/ui/tabs';
import { Button } from '@/client/components/ui/button';
import { Input } from '@/client/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/client/components/ui/select';
import { Badge } from '@/client/components/ui/badge';
import { useToast } from '@/client/components/ui/use-toast';
import { 
  Target,
  Brain,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Eye,
  Search,
  Filter,
  Download,
  RefreshCw,
  Clock,
  Activity,
  Zap,
  Database,
  Network,
  Users,
  Shield,
  Layers,
  BarChart3,
  PieChart,
  LineChart,
  GitBranch,
  Hash,
  Calendar,
  MapPin,
  Settings,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react';
import { 
  TimeRange
} from '../../src/interfaces';

interface PatternViewerProps {
  timeRange: TimeRange;
}

interface DetectedPattern {
  id: string;
  type: 'frequency' | 'sequence' | 'anomaly' | 'correlation' | 'seasonal';
  title: string;
  description: string;
  confidence: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  firstSeen: Date;
  lastSeen: Date;
  occurrences: number;
  affectedServices: string[];
  pattern: {
    template: string;
    variables: Record<string, any>;
    examples: string[];
  };
  metadata: {
    frequency: number;
    duration: number;
    peak_times: string[];
    correlations: Array<{
      metric: string;
      correlation: number;
    }>;
  };
}

interface PatternRule {
  id: string;
  name: string;
  pattern: string;
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  actions: Array<{
    type: 'alert' | 'ticket' | 'webhook';
    config: Record<string, any>;
  }>;
}

const PatternViewer: React.FC<PatternViewerProps> = ({ timeRange }) => {
  const { toast } = useToast();

  // State
  const [loading, setLoading] = useState(false);
  const [patterns, setPatterns] = useState<DetectedPattern[]>([]);
  const [rules, setRules] = useState<PatternRule[]>([]);
  const [activeTab, setActiveTab] = useState('detected');
  
  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Analysis settings
  const [minConfidence, setMinConfidence] = useState(70);
  const [analysisDepth, setAnalysisDepth] = useState<'fast' | 'thorough' | 'deep'>('thorough');
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadPatterns();
    loadRules();
  }, [timeRange]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(loadPatterns, 60000); // Refresh every minute
      return () => clearInterval(interval);
    }
  }, [autoRefresh, timeRange]);

  const loadPatterns = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/heimdall/patterns/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeRange,
          minConfidence,
          analysisDepth,
          filters: {
            type: typeFilter === 'all' ? undefined : typeFilter,
            severity: severityFilter === 'all' ? undefined : severityFilter,
            service: serviceFilter === 'all' ? undefined : serviceFilter
          }
        })
      });

      if (response.ok) {
        const patternsData = await response.json();
        setPatterns(patternsData);
      }
    } catch (error) {
      console.error('Failed to load patterns:', error);
      toast({
        title: 'Pattern Detection Error',
        description: 'Failed to load pattern analysis',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadRules = async () => {
    try {
      const response = await fetch('/api/heimdall/patterns/rules');
      if (response.ok) {
        const rulesData = await response.json();
        setRules(rulesData);
      }
    } catch (error) {
      console.error('Failed to load pattern rules:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getPatternIcon = (type: string) => {
    switch (type) {
      case 'frequency': return <BarChart3 className="w-4 h-4" />;
      case 'sequence': return <GitBranch className="w-4 h-4" />;
      case 'anomaly': return <AlertTriangle className="w-4 h-4" />;
      case 'correlation': return <Network className="w-4 h-4" />;
      case 'seasonal': return <Calendar className="w-4 h-4" />;
      default: return <Target className="w-4 h-4" />;
    }
  };

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/heimdall/patterns/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeRange,
          depth: analysisDepth,
          force: true
        })
      });

      if (response.ok) {
        await loadPatterns();
        toast({
          title: 'Analysis Complete',
          description: 'Pattern analysis has been updated'
        });
      }
    } catch (error) {
      toast({
        title: 'Analysis Failed',
        description: 'Failed to run pattern analysis',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const createRule = async (pattern: DetectedPattern) => {
    try {
      const rule: Partial<PatternRule> = {
        name: `Auto-rule: ${pattern.title}`,
        pattern: pattern.pattern.template,
        enabled: true,
        severity: pattern.severity,
        actions: [
          {
            type: 'alert',
            config: { threshold: pattern.confidence }
          }
        ]
      };

      const response = await fetch('/api/heimdall/patterns/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule)
      });

      if (response.ok) {
        await loadRules();
        toast({
          title: 'Rule Created',
          description: `Pattern rule created for "${pattern.title}"`
        });
      }
    } catch (error) {
      toast({
        title: 'Rule Creation Failed',
        description: 'Failed to create pattern rule',
        variant: 'destructive'
      });
    }
  };

  const exportPatterns = async () => {
    try {
      const response = await fetch('/api/heimdall/patterns/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patterns: filteredPatterns,
          timeRange,
          format: 'pdf'
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pattern-analysis-${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({
          title: 'Export Successful',
          description: 'Pattern analysis exported successfully'
        });
      }
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Failed to export pattern analysis',
        variant: 'destructive'
      });
    }
  };

  const filteredPatterns = patterns.filter(pattern => {
    if (typeFilter !== 'all' && pattern.type !== typeFilter) return false;
    if (severityFilter !== 'all' && pattern.severity !== severityFilter) return false;
    if (serviceFilter !== 'all' && !pattern.affectedServices.includes(serviceFilter)) return false;
    if (searchQuery && !pattern.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !pattern.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const uniqueServices = Array.from(new Set(patterns.flatMap(p => p.affectedServices)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Target className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Pattern Detection</h1>
            <p className="text-muted-foreground">AI-powered pattern recognition and analysis</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Select value={analysisDepth} onValueChange={(value: any) => setAnalysisDepth(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fast">Fast</SelectItem>
              <SelectItem value="thorough">Thorough</SelectItem>
              <SelectItem value="deep">Deep</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" onClick={() => setAutoRefresh(!autoRefresh)}>
            {autoRefresh ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            {autoRefresh ? 'Pause' : 'Resume'}
          </Button>
          
          <Button variant="outline" onClick={runAnalysis} disabled={loading}>
            <Brain className={`w-4 h-4 mr-2 ${loading ? 'animate-pulse' : ''}`} />
            Analyze
          </Button>
          
          <Button variant="outline" onClick={loadPatterns} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button variant="outline" onClick={exportPatterns}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search patterns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="frequency">Frequency</SelectItem>
                <SelectItem value="sequence">Sequence</SelectItem>
                <SelectItem value="anomaly">Anomaly</SelectItem>
                <SelectItem value="correlation">Correlation</SelectItem>
                <SelectItem value="seasonal">Seasonal</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {uniqueServices.map(service => (
                  <SelectItem key={service} value={service}>{service}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <div className="flex items-center gap-2">
              <span className="text-sm">Min Confidence:</span>
              <Input
                type="number"
                min="0"
                max="100"
                value={minConfidence}
                onChange={(e) => setMinConfidence(Number(e.target.value))}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="detected">
            <Sparkles className="w-4 h-4 mr-2" />
            Detected Patterns ({filteredPatterns.length})
          </TabsTrigger>
          <TabsTrigger value="rules">
            <Shield className="w-4 h-4 mr-2" />
            Pattern Rules ({rules.length})
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="detected" className="space-y-6">
          {filteredPatterns.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center h-32">
                <div className="text-center">
                  <Target className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">
                    {loading ? 'Detecting patterns...' : 'No patterns detected in this time range'}
                  </p>
                  {!loading && (
                    <Button variant="outline" className="mt-2" onClick={runAnalysis}>
                      <Brain className="w-4 h-4 mr-2" />
                      Run Analysis
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredPatterns.map((pattern) => (
                <Card key={pattern.id} className={`border-l-4 ${getSeverityColor(pattern.severity)}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getPatternIcon(pattern.type)}
                        <CardTitle className="text-lg">{pattern.title}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {pattern.type}
                        </Badge>
                        <Badge variant={pattern.severity === 'critical' ? 'destructive' : 'secondary'}>
                          {pattern.confidence}% confident
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {pattern.description}
                    </p>
                    
                    {/* Pattern Details */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Occurrences:</span>
                        <span className="ml-2 font-medium">{pattern.occurrences.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Frequency:</span>
                        <span className="ml-2 font-medium">{pattern.metadata.frequency}/hr</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">First Seen:</span>
                        <span className="ml-2 font-medium">{pattern.firstSeen.toLocaleDateString()}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Last Seen:</span>
                        <span className="ml-2 font-medium">{pattern.lastSeen.toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Affected Services */}
                    <div>
                      <span className="text-sm text-muted-foreground mb-2 block">Affected Services:</span>
                      <div className="flex flex-wrap gap-1">
                        {pattern.affectedServices.map((service, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {service}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Pattern Template */}
                    <div>
                      <span className="text-sm text-muted-foreground mb-2 block">Pattern Template:</span>
                      <div className="bg-muted p-3 rounded-lg font-mono text-xs">
                        {pattern.pattern.template}
                      </div>
                    </div>

                    {/* Examples */}
                    {pattern.pattern.examples.length > 0 && (
                      <div>
                        <span className="text-sm text-muted-foreground mb-2 block">Examples:</span>
                        <div className="space-y-1">
                          {pattern.pattern.examples.slice(0, 2).map((example, idx) => (
                            <div key={idx} className="bg-muted p-2 rounded text-xs font-mono truncate">
                              {example}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Correlations */}
                    {pattern.metadata.correlations.length > 0 && (
                      <div>
                        <span className="text-sm text-muted-foreground mb-2 block">Correlations:</span>
                        <div className="space-y-1">
                          {pattern.metadata.correlations.slice(0, 3).map((corr, idx) => (
                            <div key={idx} className="flex justify-between text-xs">
                              <span>{corr.metric}</span>
                              <span className="font-medium">{(corr.correlation * 100).toFixed(1)}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="outline" onClick={() => createRule(pattern)}>
                        <Shield className="w-3 h-3 mr-1" />
                        Create Rule
                      </Button>
                      <Button size="sm" variant="outline">
                        <Eye className="w-3 h-3 mr-1" />
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="rules" className="space-y-6">
          <div className="flex justify-between items-center">
            <p className="text-muted-foreground">
              Manage pattern detection rules and automated responses
            </p>
            <Button>
              <Shield className="w-4 h-4 mr-2" />
              Create Rule
            </Button>
          </div>
          
          <div className="space-y-4">
            {rules.map((rule) => (
              <Card key={rule.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${rule.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <div>
                        <h4 className="font-medium">{rule.name}</h4>
                        <p className="text-sm text-muted-foreground">{rule.pattern}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={rule.severity === 'critical' ? 'destructive' : 'secondary'}>
                        {rule.severity}
                      </Badge>
                      <Badge variant="outline">
                        {rule.actions.length} action{rule.actions.length !== 1 ? 's' : ''}
                      </Badge>
                      <Button variant="ghost" size="sm">
                        <Settings className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Pattern Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { type: 'frequency', count: 12, percentage: 40 },
                    { type: 'anomaly', count: 8, percentage: 27 },
                    { type: 'sequence', count: 6, percentage: 20 },
                    { type: 'correlation', count: 4, percentage: 13 }
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getPatternIcon(item.type)}
                        <span className="text-sm capitalize">{item.type}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-secondary rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full"
                            style={{ width: `${item.percentage}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8">{item.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detection Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { time: '12:00', patterns: 5 },
                    { time: '13:00', patterns: 8 },
                    { time: '14:00', patterns: 3 },
                    { time: '15:00', patterns: 12 },
                    { time: '16:00', patterns: 7 }
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm">{item.time}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-secondary rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${(item.patterns / 12) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-6">{item.patterns}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Services</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { service: 'api-gateway', patterns: 15 },
                    { service: 'user-service', patterns: 12 },
                    { service: 'payment-service', patterns: 8 },
                    { service: 'auth-service', patterns: 6 }
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm">{item.service}</span>
                      <Badge variant="outline">{item.patterns} patterns</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Detection Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Minimum Confidence</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={minConfidence}
                    onChange={(e) => setMinConfidence(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Analysis Depth</label>
                  <Select value={analysisDepth} onValueChange={(value: any) => setAnalysisDepth(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fast">Fast - Basic pattern detection</SelectItem>
                      <SelectItem value="thorough">Thorough - Comprehensive analysis</SelectItem>
                      <SelectItem value="deep">Deep - Advanced ML techniques</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="rounded"
                  />
                  <label className="text-sm">Auto-refresh patterns</label>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Export Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Export Format</label>
                  <Select defaultValue="pdf">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF Report</SelectItem>
                      <SelectItem value="json">JSON Data</SelectItem>
                      <SelectItem value="csv">CSV Export</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" defaultChecked />
                  <label className="text-sm">Include pattern examples</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" defaultChecked />
                  <label className="text-sm">Include correlation data</label>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export { PatternViewer };
export default PatternViewer;