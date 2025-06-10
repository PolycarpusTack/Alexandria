import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../client/components/ui/card';
import { Button } from '../../../../client/components/ui/button';
import { Badge } from '../../../../client/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../client/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from '../../../../client/components/ui/dialog';
import { useToast } from '../../../../client/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { CrashLog, CrashAnalysisResult } from '../../src/interfaces';
import { RootCauseList } from './RootCauseList';
import { LogViewer } from './LogViewer';
import { SystemInfo } from './SystemInfo';

interface CrashLogDetailProps {
  crashAnalyzerService: any;
}

export const CrashLogDetail: React.FC<CrashLogDetailProps> = ({ crashAnalyzerService }) => {
  const { logId } = useParams<{ logId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [crashLog, setCrashLog] = useState<CrashLog | null>(null);
  const [activeTab, setActiveTab] = useState('analysis');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState<CrashAnalysisResult[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'json' | 'txt'>('pdf');
  
  useEffect(() => {
    if (logId) {
      loadCrashLog(logId);
    }
  }, [logId]);
  
  const loadCrashLog = async (id: string) => {
    try {
      setLoading(true);
      const log = await crashAnalyzerService.getCrashLogById(id);
      
      if (!log) {
        setError('Crash log not found.');
        setCrashLog(null);
      } else {
        setCrashLog(log);
        setError(null);
      }
    } catch (err) {
      setError('Failed to load crash log. Please try again.');
      console.error('Error loading crash log:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleBackClick = () => {
    navigate('/crash-analyzer');
  };
  
  // Load analysis history when crash log changes
  useEffect(() => {
    if (crashLog?.id) {
      loadAnalysisHistory(crashLog.id);
    }
  }, [crashLog]);
  
  // Load analysis history
  const loadAnalysisHistory = async (id: string) => {
    try {
      // Assuming the service has a method to get analysis history
      // If not available, this would be mocked for demonstration
      if ('getAnalysisHistory' in crashAnalyzerService) {
        const history = await crashAnalyzerService.getAnalysisHistory(id);
        setAnalysisHistory(history);
        
        // Set selected analysis to the most recent one (index 0)
        if (history.length > 0) {
          setSelectedAnalysis(0);
        }
      } else {
        // If the service doesn't have the method, just use the current analysis
        if (crashLog?.analysis) {
          setAnalysisHistory([crashLog.analysis]);
          setSelectedAnalysis(0);
        }
      }
    } catch (err) {
      console.error('Error loading analysis history:', err);
      // Don't show an error message since this is not critical functionality
    }
  };
  
  // Handle reanalysis with progress simulation
  const handleReanalyzeClick = async () => {
    if (!crashLog) return;
    
    try {
      setAnalyzing(true);
      setProgress(0);
      
      // Start progress simulation
      const interval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev + (Math.random() * 10);
          return newProgress > 90 ? 90 : newProgress; // Cap at 90% for actual completion
        });
      }, 500);
      
      // Trigger a new analysis
      await crashAnalyzerService.analyzeLog(
        crashLog.id,
        crashLog.content,
        crashLog.metadata
      );
      
      // Set to 100% when done
      clearInterval(interval);
      setProgress(100);
      
      // Show success message
      toast?.({ 
        title: 'Analysis Complete', 
        description: 'Crash log has been successfully analyzed',
        variant: 'default' 
      });
      
      // Reload the crash log to get the updated analysis
      await loadCrashLog(crashLog.id);
    } catch (err) {
      const errorMsg = 'Failed to reanalyze crash log. Please try again.';
      setError(errorMsg);
      toast?.({ title: 'Error', description: errorMsg, variant: 'destructive' });
      console.error('Error reanalyzing crash log:', err);
    } finally {
      setAnalyzing(false);
      setProgress(0);
    }
  };
  
  // Handle delete with confirmation
  const handleDeleteClick = () => {
    setShowDeleteDialog(true);
  };
  
  // Handle confirmed delete
  const handleConfirmDelete = async () => {
    if (!crashLog) return;
    
    try {
      setLoading(true);
      await crashAnalyzerService.deleteCrashLog(crashLog.id);
      toast?.({ 
        title: 'Deleted', 
        description: 'Crash log has been deleted successfully',
        variant: 'default' 
      });
      navigate('/crash-analyzer');
    } catch (err) {
      const errorMsg = 'Failed to delete crash log. Please try again.';
      setError(errorMsg);
      toast?.({ title: 'Error', description: errorMsg, variant: 'destructive' });
      console.error('Error deleting crash log:', err);
    } finally {
      setLoading(false);
      setShowDeleteDialog(false);
    }
  };
  
  // Handle export
  const handleExport = useCallback(() => {
    if (!crashLog) return;
    
    try {
      // Create export content based on format
      let content = '';
      let filename = '';
      let type = '';
      
      if (exportFormat === 'json') {
        content = JSON.stringify(crashLog, null, 2);
        filename = `crash-log-${crashLog.id}.json`;
        type = 'application/json';
      } else if (exportFormat === 'txt') {
        content = crashLog.content;
        filename = `crash-log-${crashLog.id}.txt`;
        type = 'text/plain';
      } else {
        // For PDF, we would normally use a PDF generation library
        // For this example, we'll just create a simple text file
        content = `Crash Log Analysis Report\n\n` +
                 `Title: ${crashLog.title}\n` +
                 `Date: ${new Date(crashLog.uploadedAt).toLocaleString()}\n` +
                 `Platform: ${crashLog.metadata.platform || 'Unknown'}\n\n` +
                 `Summary: ${crashLog.analysis?.summary || 'No analysis available'}\n\n` +
                 `Primary Error: ${crashLog.analysis?.primaryError || 'Unknown'}\n\n` +
                 `Failing Component: ${crashLog.analysis?.failingComponent || 'Unknown'}\n\n` +
                 `Potential Root Causes:\n` +
                 (crashLog.analysis?.potentialRootCauses?.map((cause, i) => 
                   `${i+1}. ${cause.cause} (${Math.round(cause.confidence * 100)}% confidence)\n   ${cause.explanation}\n`
                 ).join('\n') || 'None identified');
                 
        filename = `crash-log-${crashLog.id}.txt`; // In reality would be .pdf
        type = 'text/plain'; // In reality would be application/pdf
      }
      
      // Create download link
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast?.({ 
        title: 'Export Complete', 
        description: `Exported as ${filename}`,
        variant: 'default' 
      });
    } catch (err) {
      console.error('Error exporting crash log:', err);
      toast?.({ 
        title: 'Export Failed', 
        description: 'Failed to export crash log. Please try again.',
        variant: 'destructive' 
      });
    }
  }, [crashLog, exportFormat]);
  
  const renderAnalysisStatus = () => {
    if (!crashLog) return null;
    
    if (!crashLog.parsedData) {
      return <Badge color="gray">Not Parsed</Badge>;
    }
    
    if (!crashLog.analysis) {
      return <Badge color="blue">Pending Analysis</Badge>;
    }
    
    return <Badge color="green">Analyzed</Badge>;
  };
  
  const renderAnalysisConfidence = () => {
    if (!crashLog?.analysis) return null;
    
    const confidence = crashLog.analysis.confidence;
    
    if (confidence >= 0.7) {
      return <Badge color="green">High Confidence</Badge>;
    } else if (confidence >= 0.4) {
      return <Badge color="yellow">Medium Confidence</Badge>;
    } else {
      return <Badge color="red">Low Confidence</Badge>;
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin" size="large" />
      </div>
    );
  }
  
  if (error || !crashLog) {
    return (
      <div className="p-4">
        <Card className="bg-red-50 border-red-200">
          <h2 className="text-lg font-medium text-red-800">Error</h2>
          <p className="text-red-600">{error || 'Failed to load crash log.'}</p>
          <Button variant="secondary" onClick={handleBackClick} className="mt-4">
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="p-4">
      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this crash log? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteDialog(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmDelete}
              disabled={loading}
            >
              {loading ? <Loader2 className="animate-spin" size="small" className="mr-2" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <div className="flex items-center mb-6">
        <Button variant="secondary" onClick={handleBackClick} className="mr-4">
          ← Back
        </Button>
        <h1 className="text-2xl font-bold flex-grow">{crashLog.title}</h1>
        <div className="flex items-center gap-2">
          <div className="ml-4 flex items-center gap-2">
            {renderAnalysisStatus()}
            {renderAnalysisConfidence()}
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="small" 
              onClick={handleDeleteClick}
              className="text-red-500 border-red-200 hover:bg-red-50"
              disabled={loading}
            >
              Delete
            </Button>
            <select 
              className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as any)}
            >
              <option value="pdf">Export as PDF</option>
              <option value="json">Export as JSON</option>
              <option value="txt">Export as Text</option>
            </select>
            <Button 
              variant="outline" 
              size="small" 
              onClick={handleExport}
              disabled={loading}
            >
              Export
            </Button>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <h2 className="text-lg font-medium mb-2">Upload Information</h2>
          <p className="text-sm">
            <span className="font-medium">Date:</span>{' '}
            {format(new Date(crashLog.uploadedAt), 'MMM d, yyyy HH:mm')}
          </p>
          <p className="text-sm">
            <span className="font-medium">Source:</span> {crashLog.metadata.source}
          </p>
          <p className="text-sm">
            <span className="font-medium">User:</span> {crashLog.userId}
          </p>
        </Card>
        
        <Card>
          <h2 className="text-lg font-medium mb-2">Platform Information</h2>
          <p className="text-sm">
            <span className="font-medium">Platform:</span>{' '}
            {crashLog.metadata.platform || 'Unknown'}
          </p>
          <p className="text-sm">
            <span className="font-medium">App Version:</span>{' '}
            {crashLog.metadata.appVersion || 'Unknown'}
          </p>
          <p className="text-sm">
            <span className="font-medium">Device:</span>{' '}
            {crashLog.metadata.device || 'Unknown'}
          </p>
        </Card>
        
        <Card>
          <h2 className="text-lg font-medium mb-2">Analysis Information</h2>
          {crashLog.analysis ? (
            <>
              <p className="text-sm">
                <span className="font-medium">Model:</span> {crashLog.analysis.llmModel}
              </p>
              <p className="text-sm">
                <span className="font-medium">Inference Time:</span>{' '}
                {(crashLog.analysis.inferenceTime / 1000).toFixed(2)}s
              </p>
              <p className="text-sm">
                <span className="font-medium">Confidence:</span>{' '}
                {(crashLog.analysis.confidence * 100).toFixed(0)}%
              </p>
            </>
          ) : (
            <p className="text-sm italic">No analysis available</p>
          )}
          
          <div className="mt-2">
            <div className="mt-2">
              {analyzing ? (
                <div className="space-y-2">
                  <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-300 ease-in-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="text-xs text-center text-gray-600">
                    Analyzing... {Math.round(progress)}%
                  </div>
                </div>
              ) : (
                <Button
                  variant="primary"
                  size="small"
                  onClick={handleReanalyzeClick}
                  disabled={loading}
                >
                  Reanalyze
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
      
      <Tabs activeTab={activeTab} onChange={setActiveTab}>
        <Tab id="analysis" label="Analysis">
          {crashLog.analysis ? (
            <div className="mt-4">
              <Card className="mb-4">
                <h2 className="text-lg font-medium mb-2">Analysis Summary</h2>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-blue-800">{crashLog.analysis.summary}</p>
                </div>
                
                <div className="mt-4">
                  <h3 className="text-md font-medium mb-2">Primary Error</h3>
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-red-800 font-mono">{crashLog.analysis.primaryError}</p>
                  </div>
                </div>
                
                {crashLog.analysis.failingComponent && (
                  <div className="mt-4">
                    <h3 className="text-md font-medium mb-2">Failing Component</h3>
                    <p className="p-2 bg-gray-100 rounded inline-block">
                      {crashLog.analysis.failingComponent}
                    </p>
                  </div>
                )}
              </Card>
              
              <RootCauseList rootCauses={crashLog.analysis.potentialRootCauses} />
              
              {crashLog.analysis.troubleshootingSteps && 
               crashLog.analysis.troubleshootingSteps.length > 0 && (
                <Card className="mt-4">
                  <h2 className="text-lg font-medium mb-2">Suggested Troubleshooting Steps</h2>
                  <ol className="list-decimal pl-5 space-y-2">
                    {crashLog.analysis.troubleshootingSteps.map((step, index) => (
                      <li key={index} className="text-gray-800">
                        {step}
                      </li>
                    ))}
                  </ol>
                </Card>
              )}
            </div>
          ) : (
            <Card className="mt-4 bg-gray-50">
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">
                  This crash log has not been analyzed yet.
                </p>
                <Button variant="primary" onClick={handleReanalyzeClick} disabled={loading}>
                  Analyze Now
                </Button>
              </div>
            </Card>
          )}
        </Tab>
        
        <Tab id="log" label="Raw Log">
          <LogViewer content={crashLog.content} parsedData={crashLog.parsedData} />
        </Tab>
        
        <Tab id="system" label="System Info">
          <SystemInfo
            systemInfo={crashLog.parsedData?.systemInfo || {}}
            metadata={crashLog.metadata}
          />
        </Tab>
      </Tabs>
    </div>
  );
};