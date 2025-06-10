import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCrashAnalyzer } from '../crash-analyzer-context';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import {  ArrowLeft, RefreshCw, Trash2, MessageSquare  } from 'lucide-react';
import { FeedbackDialog } from '../../../../plugins/hadron/ui/components/FeedbackDialog';
import { apiClient } from '../../../../utils/api-client';
import { createClientLogger } from '../../../utils/client-logger';

const logger = createClientLogger({ serviceName: 'crash-log-detail' });

export const CrashLogDetail: React.FC = () => {
  const { logId } = useParams<{ logId: string }>();
  const navigate = useNavigate();
  const { service } = useCrashAnalyzer();
  const [crashLog, setCrashLog] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  useEffect(() => {
    if (logId) {
      loadCrashLog();
    }
  }, [logId]);

  const loadCrashLog = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await service.getCrashLogById(logId!);
      setCrashLog(data);
    } catch (err) {
      setError('Failed to load crash log');
      logger.error('Failed to load crash log', { error: err, logId });
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!crashLog) return;
    
    try {
      setAnalyzing(true);
      const result = await service.analyzeLog(
        logId!,
        crashLog.content || crashLog.stackTrace,
        crashLog.metadata
      );
      // Reload to show updated analysis
      await loadCrashLog();
    } catch (err) {
      setError('Failed to analyze crash log');
      logger.error('Failed to analyze crash log', { error: err, logId });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this crash log?')) return;
    
    try {
      await service.deleteCrashLog(logId!);
      navigate('/crash-analyzer');
    } catch (err) {
      setError('Failed to delete crash log');
      logger.error('Failed to delete crash log', { error: err, logId });
    }
  };

  const handleFeedbackSubmit = async (feedback: any) => {
    try {
      await apiClient.post('/api/crash-analyzer/feedback', {
        analysisId: crashLog.analysis?.id,
        crashLogId: logId,
        ...feedback
      });
      // Show success message or update UI
      setFeedbackOpen(false);
    } catch (err) {
      logger.error('Failed to submit feedback', { error: err, logId, analysisId: crashLog.analysis?.id });
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-md">
          {error}
        </div>
      </div>
    );
  }

  if (!crashLog) {
    return (
      <div className="p-4">
        <div className="text-gray-500">Crash log not found</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => navigate('/crash-analyzer')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
        
        <div className="flex gap-2">
          <Button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${analyzing ? 'animate-spin' : ''}`} />
            {analyzing ? 'Analyzing...' : 'Analyze'}
          </Button>
          
          <Button
            variant="destructive"
            onClick={handleDelete}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{crashLog.fileName || `Crash Log ${logId}`}</CardTitle>
          <div className="text-sm text-gray-500">
            {new Date(crashLog.uploadedAt || crashLog.createdAt).toLocaleString()}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Status</h3>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              crashLog.status === 'analyzed' 
                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
            }`}>
              {crashLog.status || 'pending'}
            </span>
          </div>

          {crashLog.metadata && (
            <div>
              <h3 className="font-semibold mb-2">Metadata</h3>
              <pre className="bg-gray-50 dark:bg-gray-900 p-3 rounded-md text-sm overflow-x-auto">
                {JSON.stringify(crashLog.metadata, null, 2)}
              </pre>
            </div>
          )}

          <div>
            <h3 className="font-semibold mb-2">Stack Trace</h3>
            <pre className="bg-gray-50 dark:bg-gray-900 p-3 rounded-md text-sm overflow-x-auto whitespace-pre-wrap">
              {crashLog.content || crashLog.stackTrace || 'No stack trace available'}
            </pre>
          </div>

          {crashLog.analysis && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Analysis Results</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFeedbackOpen(true)}
                  className="gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  Provide Feedback
                </Button>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md">
                <pre className="whitespace-pre-wrap text-sm">
                  {typeof crashLog.analysis === 'string' 
                    ? crashLog.analysis 
                    : JSON.stringify(crashLog.analysis, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {crashLog.analysis && (
        <FeedbackDialog
          isOpen={feedbackOpen}
          onClose={() => setFeedbackOpen(false)}
          analysis={crashLog.analysis}
          crashLogId={logId!}
          onSubmit={handleFeedbackSubmit}
        />
      )}
    </div>
  );
};

export default CrashLogDetail;