/**
 * Crash Log Upload Page
 *
 * Provides interface for uploading and analyzing crash logs
 */

import React, { useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '../../components/ui';
import { Button } from '../../components/ui/button';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Progress } from '../../components/ui/progress';
import { useTheme } from '../../components/theme-provider';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import {
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  Loader2,
  Download,
  X,
  FileCode,
  FileJson,
  FileType,
  Clock,
  Info,
  ArrowLeft
} from 'lucide-react';
import { createClientLogger } from '../../utils/client-logger';

const logger = createClientLogger({ serviceName: 'crash-log-upload' });

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'uploading' | 'analyzing' | 'completed' | 'error';
  progress: number;
  result?: {
    severity: 'critical' | 'high' | 'medium' | 'low';
    patterns: number;
    recommendations: number;
  };
}

export const CrashLogUpload: React.FC = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    processFiles(droppedFiles);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      processFiles(selectedFiles);
    }
  };

  const processFiles = (fileList: File[]) => {
    const newFiles: UploadedFile[] = fileList.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      type: file.type || 'text/plain',
      status: 'uploading' as const,
      progress: 0
    }));

    setFiles((prev) => [...prev, ...newFiles]);

    // Simulate upload and analysis
    newFiles.forEach((file, index) => {
      simulateFileProcessing(file.id, index);
    });
  };

  const simulateFileProcessing = (fileId: string, delay: number) => {
    // Simulate upload progress
    let progress = 0;
    const uploadInterval = setInterval(() => {
      progress += 10;
      setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, progress } : f)));

      if (progress >= 100) {
        clearInterval(uploadInterval);
        // Start analysis
        setFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, status: 'analyzing' as const } : f))
        );

        // Simulate analysis completion
        setTimeout(
          () => {
            const results = {
              severity: ['critical', 'high', 'medium', 'low'][Math.floor(Math.random() * 4)] as any,
              patterns: Math.floor(Math.random() * 20) + 5,
              recommendations: Math.floor(Math.random() * 10) + 3
            };

            setFiles((prev) =>
              prev.map((f) =>
                f.id === fileId ? { ...f, status: 'completed' as const, result: results } : f
              )
            );
          },
          2000 + delay * 500
        );
      }
    }, 200);
  };

  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (type: string) => {
    if (type.includes('json')) return <FileJson className='h-5 w-5' />;
    if (type.includes('text')) return <FileText className='h-5 w-5' />;
    if (type.includes('code')) return <FileCode className='h-5 w-5' />;
    return <FileType className='h-5 w-5' />;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-100 border-red-200';
      case 'high':
        return 'text-orange-600 bg-orange-100 border-orange-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'low':
        return 'text-green-600 bg-green-100 border-green-200';
      default:
        return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const completedFiles = files.filter((f) => f.status === 'completed');
  const processingFiles = files.filter((f) => f.status === 'uploading' || f.status === 'analyzing');

  return (
    <div className='p-6 max-w-4xl mx-auto'>
      {/* Back Button */}
      <div className='mb-6'>
        <Button variant='ghost' onClick={() => navigate('/crash-analyzer')} className='gap-2'>
          <ArrowLeft className='h-4 w-4' />
          Back to Dashboard
        </Button>
      </div>

      {/* Header */}
      <div className='mb-6'>
        <h1 className={cn('text-2xl font-bold mb-2', isDark ? 'text-white' : 'text-gray-900')}>
          Upload Crash Logs
        </h1>
        <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>
          Upload your crash logs for AI-powered analysis and recommendations
        </p>
      </div>

      {/* Upload Area */}
      <Card
        className={cn(
          'border-2 border-dashed transition-all mb-6',
          isDark ? 'bg-[#2d2d2d]' : '',
          isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-gray-300 dark:border-gray-600'
        )}
      >
        <CardContent
          className='p-12 text-center'
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className='flex flex-col items-center'>
            <div className={cn('p-4 rounded-full mb-4', isDark ? 'bg-[#3e3e3e]' : 'bg-gray-100')}>
              <Upload className='h-8 w-8 text-blue-500' />
            </div>
            <h3 className='text-lg font-semibold mb-2'>Drag and drop your crash logs here</h3>
            <p className='text-sm text-muted-foreground mb-4'>or click to browse files</p>
            <input
              type='file'
              id='file-upload'
              className='hidden'
              multiple
              accept='.txt,.log,.json,.dmp'
              onChange={handleFileSelect}
            />
            <label htmlFor='file-upload'>
              <Button asChild>
                <span>Browse Files</span>
              </Button>
            </label>
            <p className='text-xs text-muted-foreground mt-4'>
              Supported formats: .txt, .log, .json, .dmp (Max 50MB)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* File List */}
      {files.length > 0 && (
        <div className='space-y-4'>
          <h2 className='text-lg font-semibold'>Uploaded Files</h2>

          {files.map((file) => (
            <Card
              key={file.id}
              className={cn('border transition-all', isDark ? 'bg-[#2d2d2d] border-[#3e3e3e]' : '')}
            >
              <CardContent className='p-4'>
                <div className='flex items-start justify-between'>
                  <div className='flex items-start gap-3 flex-1'>
                    <div className={cn('p-2 rounded-lg', isDark ? 'bg-[#3e3e3e]' : 'bg-gray-100')}>
                      {getFileIcon(file.type)}
                    </div>
                    <div className='flex-1'>
                      <h3 className='font-medium'>{file.name}</h3>
                      <p className='text-sm text-muted-foreground'>{formatFileSize(file.size)}</p>

                      {file.status === 'uploading' && (
                        <div className='mt-2'>
                          <div className='flex items-center justify-between text-sm mb-1'>
                            <span>Uploading...</span>
                            <span>{file.progress}%</span>
                          </div>
                          <Progress value={file.progress} className='h-2' />
                        </div>
                      )}

                      {file.status === 'analyzing' && (
                        <div className='flex items-center gap-2 mt-2'>
                          <Loader2 className='h-4 w-4 animate-spin text-blue-500' />
                          <span className='text-sm text-blue-600'>Analyzing crash patterns...</span>
                        </div>
                      )}

                      {file.status === 'completed' && file.result && (
                        <div className='mt-3 space-y-2'>
                          <div className='flex items-center gap-2'>
                            <Badge
                              className={cn('text-xs', getSeverityColor(file.result.severity))}
                            >
                              {file.result.severity.toUpperCase()} SEVERITY
                            </Badge>
                            <Badge variant='outline' className='text-xs'>
                              {file.result.patterns} patterns found
                            </Badge>
                            <Badge variant='outline' className='text-xs'>
                              {file.result.recommendations} recommendations
                            </Badge>
                          </div>
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={() => navigate(`/crash-analyzer/report/${file.id}`)}
                          >
                            View Analysis Report
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  <Button
                    variant='ghost'
                    size='icon'
                    className='ml-2'
                    onClick={() => removeFile(file.id)}
                  >
                    <X className='h-4 w-4' />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Analysis Summary */}
      {completedFiles.length > 0 && (
        <Card className={cn('border mt-6', isDark ? 'bg-[#2d2d2d] border-[#3e3e3e]' : '')}>
          <CardHeader>
            <CardTitle className='text-lg flex items-center gap-2'>
              <CheckCircle2 className='h-5 w-5 text-green-500' />
              Analysis Complete
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-3 gap-4 mb-4'>
              <div className='text-center'>
                <p className='text-2xl font-bold'>{completedFiles.length}</p>
                <p className='text-sm text-muted-foreground'>Files Analyzed</p>
              </div>
              <div className='text-center'>
                <p className='text-2xl font-bold'>
                  {completedFiles.reduce((acc, f) => acc + (f.result?.patterns || 0), 0)}
                </p>
                <p className='text-sm text-muted-foreground'>Total Patterns</p>
              </div>
              <div className='text-center'>
                <p className='text-2xl font-bold'>
                  {
                    completedFiles.filter(
                      (f) => f.result?.severity === 'critical' || f.result?.severity === 'high'
                    ).length
                  }
                </p>
                <p className='text-sm text-muted-foreground'>High Priority Issues</p>
              </div>
            </div>
            <div className='flex gap-2'>
              <Button className='flex-1' onClick={() => navigate('/crash-analyzer')}>
                View All Reports
              </Button>
              <Button variant='outline' className='flex-1'>
                <Download className='h-4 w-4 mr-2' />
                Export Summary
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tips */}
      <Alert className='mt-6'>
        <Info className='h-4 w-4' />
        <AlertDescription>
          <strong>Pro tip:</strong> You can upload multiple crash logs at once for batch analysis.
          Our AI will identify common patterns and provide comprehensive recommendations.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default CrashLogUpload;
