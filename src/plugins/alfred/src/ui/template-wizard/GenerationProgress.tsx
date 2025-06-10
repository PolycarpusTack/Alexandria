/**
 * Generation Progress Component
 * 
 * Real-time progress tracking for template generation with
 * file-by-file updates and cancellation support
 */

import React, { useState, useEffect } from 'react';
import { GenerationProgress as ProgressType } from '../../services/template-wizard-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../../client/components/ui/card';
import { Progress } from '../../../../../client/components/ui/progress';
import { Button } from '../../../../../client/components/ui/button';
import { Badge } from '../../../../../client/components/ui/badge';
import { Alert, AlertDescription } from '../../../../../client/components/ui/alert';
import { ScrollArea } from '../../../../../client/components/ui/scroll-area';
import {
  FileText,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  X,
  FolderOpen,
  FileCode
} from 'lucide-react';

export interface GenerationProgressProps {
  progress: ProgressType | null;
  onCancel?: () => void;
  className?: string;
}

interface FileProgress {
  path: string;
  status: 'pending' | 'writing' | 'complete' | 'error';
  error?: string;
}

export const GenerationProgress: React.FC<GenerationProgressProps> = ({
  progress,
  onCancel,
  className = ''
}) => {
  const [fileProgress, setFileProgress] = useState<Map<string, FileProgress>>(new Map());
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Track start time
  useEffect(() => {
    if (progress && progress.phase !== 'complete' && progress.phase !== 'error' && !startTime) {
      setStartTime(Date.now());
    } else if ((progress?.phase === 'complete' || progress?.phase === 'error') && startTime) {
      setElapsedTime(Date.now() - startTime);
      setStartTime(null);
    }
  }, [progress, startTime]);

  // Update elapsed time
  useEffect(() => {
    if (startTime) {
      const interval = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [startTime]);

  // Update file progress
  useEffect(() => {
    if (progress?.currentFile && progress.phase === 'writing') {
      setFileProgress(prev => {
        const updated = new Map(prev);
        updated.set(progress.currentFile!, {
          path: progress.currentFile!,
          status: 'writing'
        });
        return updated;
      });
    }
  }, [progress?.currentFile, progress?.phase]);

  if (!progress) {
    return null;
  }

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  const getPhaseIcon = () => {
    switch (progress.phase) {
      case 'initializing':
      case 'resolving':
      case 'generating':
      case 'writing':
        return <Loader2 className="w-5 h-5 animate-spin" />;
      case 'complete':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  const getPhaseColor = () => {
    switch (progress.phase) {
      case 'complete':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-blue-600';
    }
  };

  const renderFileList = () => {
    const files = Array.from(fileProgress.values());
    if (files.length === 0) return null;

    return (
      <Card className="mt-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Files Generated</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-48">
            <div className="space-y-2">
              {files.map(file => (
                <div
                  key={file.path}
                  className="flex items-center justify-between p-2 rounded bg-gray-50"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <FileCode className="w-4 h-4 text-gray-500" />
                    <span className="text-sm truncate">{file.path}</span>
                  </div>
                  <div>
                    {file.status === 'complete' && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                    {file.status === 'writing' && (
                      <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    )}
                    {file.status === 'error' && (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  };

  const renderError = () => {
    if (progress.phase !== 'error' || !progress.error) return null;

    return (
      <Alert variant="destructive" className="mt-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {progress.error.message || 'An unexpected error occurred'}
        </AlertDescription>
      </Alert>
    );
  };

  const canCancel = progress.phase !== 'complete' && progress.phase !== 'error';

  return (
    <div className={`space-y-4 ${className}`}>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {getPhaseIcon()}
              <div>
                <CardTitle className={`text-lg ${getPhaseColor()}`}>
                  {progress.message}
                </CardTitle>
                <CardDescription>
                  {progress.phase === 'complete' 
                    ? `Completed in ${formatTime(elapsedTime)}`
                    : progress.phase === 'error'
                    ? 'Generation failed'
                    : `Elapsed: ${formatTime(elapsedTime)}`
                  }
                </CardDescription>
              </div>
            </div>
            
            {canCancel && onCancel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Cancel
              </Button>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            {/* Progress Bar */}
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>
                  {progress.completedFiles} of {progress.totalFiles} files
                </span>
                <span>{Math.round(progress.percentage)}%</span>
              </div>
              <Progress value={progress.percentage} className="h-2" />
            </div>

            {/* Current File */}
            {progress.currentFile && progress.phase === 'writing' && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span className="text-sm text-blue-800">
                  Writing: {progress.currentFile}
                </span>
              </div>
            )}

            {/* Phase Badge */}
            <div className="flex items-center gap-2">
              <Badge 
                variant={progress.phase === 'complete' ? 'default' : 'secondary'}
                className="capitalize"
              >
                {progress.phase}
              </Badge>
              
              {progress.totalFiles > 0 && (
                <Badge variant="outline">
                  {progress.totalFiles} {progress.totalFiles === 1 ? 'file' : 'files'}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File List */}
      {renderFileList()}

      {/* Error Display */}
      {renderError()}

      {/* Success Actions */}
      {progress.phase === 'complete' && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-800">
                  Template generated successfully!
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
                onClick={() => {
                  // Open in file explorer (would need to be implemented)
                  console.log('Open folder');
                }}
              >
                <FolderOpen className="w-4 h-4" />
                Open Folder
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};