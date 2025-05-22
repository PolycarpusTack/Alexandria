import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  Card, 
  Button, 
  Spinner, 
  Tabs,
  Tab,
  Badge,
  toast
} from '../../../../ui/components';

interface CodeSnippetDetailProps {
  crashAnalyzerService: any;
}

export const CodeSnippetDetail: React.FC<CodeSnippetDetailProps> = ({ crashAnalyzerService }) => {
  const { snippetId } = useParams<{ snippetId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snippet, setSnippet] = useState<any | null>(null);
  const [analysis, setAnalysis] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState('analysis');
  const [progress, setProgress] = useState(0);
  const codeViewerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (snippetId) {
      loadSnippet(snippetId);
    }
  }, [snippetId]);
  
  const loadSnippet = async (id: string) => {
    try {
      setLoading(true);
      
      // Get the snippet
      const snippetData = await crashAnalyzerService.getSnippetById(id);
      setSnippet(snippetData);
      
      // Get the analysis results
      const analysisResults = await crashAnalyzerService.getAnalysesBySnippet(id);
      
      if (analysisResults && analysisResults.length > 0) {
        // Get the most recent analysis
        setAnalysis(analysisResults[0]);
      }
      
      setError(null);
    } catch (err) {
      console.error('Error loading snippet:', err);
      setError('Failed to load code snippet. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleBackClick = () => {
    navigate('/crash-analyzer');
  };
  
  const handleReanalyzeClick = async () => {
    if (!snippet) return;
    
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
      
      // Perform a new analysis
      await crashAnalyzerService.analyzeCodeSnippet(
        snippet.id,
        snippet.sessionId
      );
      
      // Set to 100% when done
      clearInterval(interval);
      setProgress(100);
      
      // Show success toast
      toast?.({ 
        title: 'Analysis Complete', 
        description: 'Code snippet has been successfully analyzed'
      });
      
      // Reload the snippet and analysis
      await loadSnippet(snippet.id);
    } catch (err) {
      console.error('Error reanalyzing snippet:', err);
      const errorMsg = 'Failed to reanalyze code snippet. Please try again.';
      setError(errorMsg);
      toast?.({ 
        title: 'Analysis Failed', 
        description: errorMsg,
        variant: 'destructive'
      });
    } finally {
      setAnalyzing(false);
      setProgress(0);
    }
  };
  
  const renderAnalysisStatus = () => {
    if (!analysis) {
      return <Badge color="blue">Pending Analysis</Badge>;
    }
    
    return <Badge color="green">Analyzed</Badge>;
  };
  
  const renderConfidence = () => {
    if (!analysis) return null;
    
    const confidence = analysis.confidence;
    
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
        <Spinner size="large" />
      </div>
    );
  }
  
  if (error || !snippet) {
    return (
      <div className="p-4">
        <Card className="bg-red-50 border-red-200">
          <h2 className="text-lg font-medium text-red-800">Error</h2>
          <p className="text-red-600">{error || 'Failed to load code snippet.'}</p>
          <Button variant="secondary" onClick={handleBackClick} className="mt-4">
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }
  
  const formatDate = (date: string | Date) => {
    return format(new Date(date), 'MMM d, yyyy HH:mm');
  };
  
  return (
    <div className="p-4">
      <div className="flex items-center mb-6">
        <Button variant="secondary" onClick={handleBackClick} className="mr-4">
          ← Back
        </Button>
        <h1 className="text-2xl font-bold flex-grow">
          Code Analysis: {snippet.language} {snippet.description ? `- ${snippet.description}` : ''}
        </h1>
        <div className="ml-4 flex items-center gap-2">
          {renderAnalysisStatus()}
          {renderConfidence()}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <h2 className="text-lg font-medium mb-2">Snippet Information</h2>
          <p className="text-sm">
            <span className="font-medium">Uploaded:</span>{' '}
            {formatDate(snippet.createdAt)}
          </p>
          <p className="text-sm">
            <span className="font-medium">Language:</span> {snippet.language}
          </p>
          {snippet.description && (
            <p className="text-sm">
              <span className="font-medium">Description:</span> {snippet.description}
            </p>
          )}
        </Card>
        
        <Card>
          <h2 className="text-lg font-medium mb-2">Session Information</h2>
          <p className="text-sm">
            <span className="font-medium">Session ID:</span>{' '}
            {snippet.sessionId}
          </p>
          <p className="text-sm">
            <span className="font-medium">User:</span> {snippet.userId}
          </p>
        </Card>
        
        <Card>
          <h2 className="text-lg font-medium mb-2">Analysis Information</h2>
          {analysis ? (
            <>
              <p className="text-sm">
                <span className="font-medium">Model:</span> {analysis.llmModel}
              </p>
              <p className="text-sm">
                <span className="font-medium">Analysis Time:</span>{' '}
                {(analysis.inferenceTime / 1000).toFixed(2)}s
              </p>
              <p className="text-sm">
                <span className="font-medium">Confidence:</span>{' '}
                {(analysis.confidence * 100).toFixed(0)}%
              </p>
            </>
          ) : (
            <p className="text-sm italic">No analysis available</p>
          )}
          
          <div className="mt-2">
            <Button
              variant="primary"
              size="small"
              onClick={handleReanalyzeClick}
              disabled={loading}
            >
              Reanalyze
            </Button>
          </div>
        </Card>
      </div>
      
      <Tabs activeTab={activeTab} onChange={setActiveTab}>
        <Tab id="analysis" label="Analysis">
          {analysis ? (
            <div className="mt-4">
              <Card className="mb-4">
                <h2 className="text-lg font-medium mb-2">Analysis Summary</h2>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-blue-800">{analysis.summary}</p>
                </div>
                
                <div className="mt-4">
                  <h3 className="text-md font-medium mb-2">Primary Issue</h3>
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-red-800 font-mono">{analysis.primaryError}</p>
                  </div>
                </div>
                
                {analysis.failingComponent && (
                  <div className="mt-4">
                    <h3 className="text-md font-medium mb-2">Problematic Component</h3>
                    <p className="p-2 bg-gray-100 rounded inline-block">
                      {analysis.failingComponent}
                    </p>
                  </div>
                )}
              </Card>
              
              {analysis.potentialRootCauses && analysis.potentialRootCauses.length > 0 && (
                <Card className="mb-4">
                  <h2 className="text-lg font-medium mb-2">Potential Issues</h2>
                  
                  <div className="space-y-4">
                    {analysis.potentialRootCauses.map((issue: any, index: number) => (
                      <div 
                        key={index} 
                        className="p-4 rounded-lg border border-yellow-200 bg-yellow-50"
                      >
                        <div className="flex justify-between items-start">
                          <h3 className="text-md font-medium mb-1">{issue.cause}</h3>
                          <Badge color={
                            issue.confidence >= 0.7 ? 'green' :
                            issue.confidence >= 0.4 ? 'yellow' : 'red'
                          }>
                            {Math.round(issue.confidence * 100)}% Confidence
                          </Badge>
                        </div>
                        
                        <p className="text-gray-700 mb-2">{issue.explanation}</p>
                        
                        {issue.supportingEvidence && issue.supportingEvidence.length > 0 && (
                          <div className="mt-2">
                            <h4 className="text-sm font-medium mb-1">Supporting Evidence:</h4>
                            <div className="bg-white rounded border p-2 space-y-2">
                              {issue.supportingEvidence.map((evidence: any, i: number) => (
                                <div key={i} className="text-sm">
                                  <div className="text-gray-600 mb-1 text-xs font-medium">
                                    {evidence.location}
                                  </div>
                                  <div className="bg-gray-50 p-2 rounded font-mono text-xs overflow-x-auto">
                                    {evidence.snippet}
                                  </div>
                                  <div className="text-gray-600 mt-1">
                                    {evidence.description}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}
              
              {analysis.troubleshootingSteps && analysis.troubleshootingSteps.length > 0 && (
                <Card className="mt-4">
                  <h2 className="text-lg font-medium mb-2">Improvement Suggestions</h2>
                  <ol className="list-decimal pl-5 space-y-2">
                    {analysis.troubleshootingSteps.map((step: string, index: number) => (
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
                  This code snippet has not been analyzed yet.
                </p>
                <Button variant="primary" onClick={handleReanalyzeClick} disabled={loading}>
                  Analyze Now
                </Button>
              </div>
            </Card>
          )}
        </Tab>
        
        <Tab id="code" label="Code">
          <Card className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-medium">Code Snippet</h2>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => {
                    navigator.clipboard.writeText(snippet.content);
                    toast?.({ title: 'Copied', description: 'Code copied to clipboard' });
                  }}
                >
                  Copy Code
                </Button>
                {analysis?.potentialRootCauses?.length > 0 && (
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => {
                      setActiveTab('analysis');
                    }}
                  >
                    View Issues ({analysis.potentialRootCauses.length})
                  </Button>
                )}
              </div>
            </div>
            <div 
              ref={codeViewerRef} 
              className="bg-gray-50 p-4 rounded overflow-auto font-mono whitespace-pre"
              style={{ maxHeight: '70vh' }}
            >
              {/* Add syntax highlighting based on language */}
              <pre 
                className={`language-${snippet.language}`}
                dangerouslySetInnerHTML={{ 
                  __html: snippet.content
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;")
                }} 
              />
            </div>
          </Card>
        </Tab>
      </Tabs>
    </div>
  );
};