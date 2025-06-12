/**
 * Conflict Resolution UI Component
 *
 * Handles file conflicts during template generation with
 * intelligent merging, backup options, and diff visualization
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '../../../../../client/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '../../../../../client/components/ui/card';
import { Badge } from '../../../../../client/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../../client/components/ui/tabs';
import { ScrollArea } from '../../../../../client/components/ui/scroll-area';
import {
  FileX,
  GitMerge,
  Copy,
  FileText,
  AlertTriangle,
  CheckCircle,
  SkipForward,
  Save,
  Eye,
  Download
} from 'lucide-react';

export interface FileConflict {
  filePath: string;
  existingContent: string;
  newContent: string;
  conflictType: 'overwrite' | 'merge' | 'append';
  fileSize: {
    existing: number;
    new: number;
  };
  lastModified?: Date;
  canAutoMerge?: boolean;
  mergePreview?: string;
}

export interface ConflictResolution {
  action: 'overwrite' | 'merge' | 'skip' | 'backup' | 'rename';
  backupPath?: string;
  newPath?: string;
  mergedContent?: string;
}

export interface ConflictResolverProps {
  conflicts: FileConflict[];
  onResolve: (resolutions: Record<string, ConflictResolution>) => void;
  onCancel: () => void;
  enableAIMerging?: boolean;
  showDiff?: boolean;
  className?: string;
}

export const ConflictResolver: React.FC<ConflictResolverProps> = ({
  conflicts,
  onResolve,
  onCancel,
  enableAIMerging = true,
  showDiff = true,
  className = ''
}) => {
  const [resolutions, setResolutions] = useState<Record<string, ConflictResolution>>({});
  const [selectedConflict, setSelectedConflict] = useState<string | null>(
    conflicts.length > 0 ? conflicts[0].filePath : null
  );
  const [previewMode, setPreviewMode] = useState<'side' | 'unified'>('side');
  const [isGeneratingMerge, setIsGeneratingMerge] = useState<Record<string, boolean>>({});

  const currentConflict = conflicts.find((c) => c.filePath === selectedConflict);

  // Initialize resolutions
  useEffect(() => {
    const initialResolutions: Record<string, ConflictResolution> = {};

    conflicts.forEach((conflict) => {
      // Default to merge if possible, otherwise overwrite
      initialResolutions[conflict.filePath] = {
        action: conflict.canAutoMerge ? 'merge' : 'overwrite'
      };
    });

    setResolutions(initialResolutions);
  }, [conflicts]);

  const conflictStats = useMemo(() => {
    const stats = {
      total: conflicts.length,
      overwrite: 0,
      merge: 0,
      skip: 0,
      backup: 0,
      rename: 0,
      resolved: 0
    };

    Object.values(resolutions).forEach((resolution) => {
      stats[resolution.action]++;
      stats.resolved++;
    });

    return stats;
  }, [conflicts, resolutions]);

  const updateResolution = (filePath: string, resolution: Partial<ConflictResolution>) => {
    setResolutions((prev) => ({
      ...prev,
      [filePath]: {
        ...prev[filePath],
        ...resolution
      }
    }));
  };

  const generateAIMerge = async (conflict: FileConflict) => {
    setIsGeneratingMerge((prev) => ({ ...prev, [conflict.filePath]: true }));

    try {
      // Simulate AI merge generation
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // In a real implementation, this would call an AI service
      const mergedContent = `${conflict.existingContent}\n\n// AI-merged content\n${conflict.newContent}`;

      updateResolution(conflict.filePath, {
        action: 'merge',
        mergedContent
      });
    } catch (error) {
      console.error('AI merge failed:', error);
    } finally {
      setIsGeneratingMerge((prev) => ({ ...prev, [conflict.filePath]: false }));
    }
  };

  const applyBulkAction = (action: ConflictResolution['action']) => {
    const updates: Record<string, ConflictResolution> = {};

    conflicts.forEach((conflict) => {
      updates[conflict.filePath] = {
        action,
        ...(action === 'backup' && { backupPath: `${conflict.filePath}.backup` })
      };
    });

    setResolutions((prev) => ({ ...prev, ...updates }));
  };

  const downloadBackup = (conflict: FileConflict) => {
    const blob = new Blob([conflict.existingContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${conflict.filePath}.backup`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderDiff = (conflict: FileConflict) => {
    if (!showDiff) return null;

    const existingLines = conflict.existingContent.split('\n');
    const newLines = conflict.newContent.split('\n');

    return (
      <div className='space-y-4'>
        <div className='flex items-center justify-between'>
          <h4 className='text-sm font-medium'>Content Comparison</h4>
          <div className='flex items-center gap-2'>
            <Button
              size='sm'
              variant={previewMode === 'side' ? 'default' : 'outline'}
              onClick={() => setPreviewMode('side')}
            >
              Side by Side
            </Button>
            <Button
              size='sm'
              variant={previewMode === 'unified' ? 'default' : 'outline'}
              onClick={() => setPreviewMode('unified')}
            >
              Unified
            </Button>
          </div>
        </div>

        {previewMode === 'side' ? (
          <div className='grid grid-cols-2 gap-4'>
            <Card>
              <CardHeader className='pb-2'>
                <CardTitle className='text-sm text-red-600'>Existing File</CardTitle>
                <CardDescription>
                  {existingLines.length} lines • {conflict.fileSize.existing} bytes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className='h-64'>
                  <pre className='text-xs bg-red-50 p-2 rounded'>
                    {existingLines.map((line, index) => (
                      <div key={index} className='flex'>
                        <span className='w-8 text-gray-400 select-none'>{index + 1}</span>
                        <span>{line}</span>
                      </div>
                    ))}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className='pb-2'>
                <CardTitle className='text-sm text-green-600'>New Content</CardTitle>
                <CardDescription>
                  {newLines.length} lines • {conflict.fileSize.new} bytes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className='h-64'>
                  <pre className='text-xs bg-green-50 p-2 rounded'>
                    {newLines.map((line, index) => (
                      <div key={index} className='flex'>
                        <span className='w-8 text-gray-400 select-none'>{index + 1}</span>
                        <span>{line}</span>
                      </div>
                    ))}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm'>Unified Diff</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className='h-64'>
                <pre className='text-xs bg-gray-50 p-2 rounded'>
                  {/* Simplified diff view */}
                  <div className='text-gray-600'>--- {conflict.filePath} (existing)</div>
                  <div className='text-gray-600'>+++ {conflict.filePath} (new)</div>
                  {existingLines.map((line, index) => (
                    <div key={`existing-${index}`} className='text-red-600'>
                      -{line}
                    </div>
                  ))}
                  {newLines.map((line, index) => (
                    <div key={`new-${index}`} className='text-green-600'>
                      +{line}
                    </div>
                  ))}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderMergePreview = (conflict: FileConflict) => {
    const resolution = resolutions[conflict.filePath];

    if (resolution?.action !== 'merge' || !resolution.mergedContent) {
      return null;
    }

    return (
      <Card className='mt-4'>
        <CardHeader className='pb-2'>
          <CardTitle className='text-sm text-blue-600'>Merged Result</CardTitle>
          <CardDescription>Preview of the merged content</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className='h-48'>
            <pre className='text-xs bg-blue-50 p-2 rounded'>{resolution.mergedContent}</pre>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  };

  const renderConflictActions = (conflict: FileConflict) => {
    const resolution = resolutions[conflict.filePath];
    const isGenerating = isGeneratingMerge[conflict.filePath];

    return (
      <div className='space-y-4'>
        <div className='grid grid-cols-2 gap-3'>
          <Button
            variant={resolution?.action === 'overwrite' ? 'default' : 'outline'}
            onClick={() => updateResolution(conflict.filePath, { action: 'overwrite' })}
            className='flex items-center gap-2'
          >
            <FileX className='w-4 h-4' />
            Overwrite
          </Button>

          <Button
            variant={resolution?.action === 'merge' ? 'default' : 'outline'}
            onClick={() => updateResolution(conflict.filePath, { action: 'merge' })}
            disabled={!conflict.canAutoMerge && !enableAIMerging}
            className='flex items-center gap-2'
          >
            <GitMerge className='w-4 h-4' />
            Merge
          </Button>

          <Button
            variant={resolution?.action === 'skip' ? 'default' : 'outline'}
            onClick={() => updateResolution(conflict.filePath, { action: 'skip' })}
            className='flex items-center gap-2'
          >
            <SkipForward className='w-4 h-4' />
            Skip
          </Button>

          <Button
            variant={resolution?.action === 'backup' ? 'default' : 'outline'}
            onClick={() =>
              updateResolution(conflict.filePath, {
                action: 'backup',
                backupPath: `${conflict.filePath}.backup`
              })
            }
            className='flex items-center gap-2'
          >
            <Save className='w-4 h-4' />
            Backup
          </Button>
        </div>

        {enableAIMerging && resolution?.action === 'merge' && (
          <Button
            onClick={() => generateAIMerge(conflict)}
            disabled={isGenerating}
            className='w-full flex items-center gap-2'
            variant='outline'
          >
            {isGenerating ? (
              <>
                <div className='w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin' />
                Generating AI Merge...
              </>
            ) : (
              <>
                <GitMerge className='w-4 h-4' />
                Generate AI Merge
              </>
            )}
          </Button>
        )}

        <div className='flex gap-2'>
          <Button
            size='sm'
            variant='outline'
            onClick={() => downloadBackup(conflict)}
            className='flex items-center gap-1'
          >
            <Download className='w-3 h-3' />
            Download Backup
          </Button>

          <Button
            size='sm'
            variant='outline'
            onClick={() => {
              const newPath = prompt('Enter new file path:', `${conflict.filePath}.new`);
              if (newPath) {
                updateResolution(conflict.filePath, {
                  action: 'rename',
                  newPath
                });
              }
            }}
            className='flex items-center gap-1'
          >
            <Copy className='w-3 h-3' />
            Rename
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className={`max-w-6xl mx-auto p-6 ${className}`}>
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle className='flex items-center gap-2'>
                <AlertTriangle className='w-5 h-5 text-orange-500' />
                Resolve File Conflicts
              </CardTitle>
              <CardDescription>
                {conflicts.length} file{conflicts.length !== 1 ? 's' : ''} need
                {conflicts.length === 1 ? 's' : ''} your attention
              </CardDescription>
            </div>

            <div className='flex items-center gap-2'>
              <Badge variant='outline'>
                {conflictStats.resolved}/{conflictStats.total} resolved
              </Badge>
            </div>
          </div>

          {/* Bulk Actions */}
          <div className='flex gap-2 pt-4'>
            <Button size='sm' variant='outline' onClick={() => applyBulkAction('overwrite')}>
              Overwrite All
            </Button>
            <Button size='sm' variant='outline' onClick={() => applyBulkAction('merge')}>
              Merge All
            </Button>
            <Button size='sm' variant='outline' onClick={() => applyBulkAction('backup')}>
              Backup All
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <div className='grid grid-cols-4 gap-6'>
            {/* Conflict List */}
            <div className='space-y-2'>
              <h3 className='text-sm font-medium'>Files</h3>
              <ScrollArea className='h-96'>
                {conflicts.map((conflict) => {
                  const resolution = resolutions[conflict.filePath];
                  const isSelected = selectedConflict === conflict.filePath;

                  return (
                    <Card
                      key={conflict.filePath}
                      className={`cursor-pointer transition-colors mb-2 ${
                        isSelected ? 'ring-2 ring-blue-500' : ''
                      }`}
                      onClick={() => setSelectedConflict(conflict.filePath)}
                    >
                      <CardContent className='p-3'>
                        <div className='flex items-center justify-between mb-2'>
                          <Badge
                            variant={resolution?.action === 'skip' ? 'secondary' : 'default'}
                            className='text-xs'
                          >
                            {resolution?.action || 'pending'}
                          </Badge>
                          {resolution && <CheckCircle className='w-4 h-4 text-green-500' />}
                        </div>
                        <div className='text-sm font-medium truncate'>{conflict.filePath}</div>
                        <div className='text-xs text-gray-500'>{conflict.conflictType}</div>
                      </CardContent>
                    </Card>
                  );
                })}
              </ScrollArea>
            </div>

            {/* Main Content */}
            <div className='col-span-3'>
              {currentConflict ? (
                <Tabs defaultValue='preview' className='w-full'>
                  <TabsList>
                    <TabsTrigger value='preview'>Preview</TabsTrigger>
                    <TabsTrigger value='actions'>Actions</TabsTrigger>
                    <TabsTrigger value='details'>Details</TabsTrigger>
                  </TabsList>

                  <TabsContent value='preview' className='mt-4'>
                    {renderDiff(currentConflict)}
                    {renderMergePreview(currentConflict)}
                  </TabsContent>

                  <TabsContent value='actions' className='mt-4'>
                    <Card>
                      <CardHeader>
                        <CardTitle className='text-base'>Resolution Actions</CardTitle>
                        <CardDescription>Choose how to handle this conflict</CardDescription>
                      </CardHeader>
                      <CardContent>{renderConflictActions(currentConflict)}</CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value='details' className='mt-4'>
                    <Card>
                      <CardHeader>
                        <CardTitle className='text-base'>File Details</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className='space-y-3'>
                          <div className='flex justify-between'>
                            <span className='font-medium'>Path:</span>
                            <span className='text-sm text-gray-600'>
                              {currentConflict.filePath}
                            </span>
                          </div>
                          <div className='flex justify-between'>
                            <span className='font-medium'>Conflict Type:</span>
                            <Badge variant='outline'>{currentConflict.conflictType}</Badge>
                          </div>
                          <div className='flex justify-between'>
                            <span className='font-medium'>Can Auto-merge:</span>
                            <Badge variant={currentConflict.canAutoMerge ? 'default' : 'secondary'}>
                              {currentConflict.canAutoMerge ? 'Yes' : 'No'}
                            </Badge>
                          </div>
                          <div className='flex justify-between'>
                            <span className='font-medium'>File Sizes:</span>
                            <div className='text-sm text-gray-600'>
                              {currentConflict.fileSize.existing} → {currentConflict.fileSize.new}{' '}
                              bytes
                            </div>
                          </div>
                          {currentConflict.lastModified && (
                            <div className='flex justify-between'>
                              <span className='font-medium'>Last Modified:</span>
                              <span className='text-sm text-gray-600'>
                                {currentConflict.lastModified.toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              ) : (
                <div className='flex items-center justify-center h-96 text-gray-500'>
                  Select a file to view conflict details
                </div>
              )}
            </div>
          </div>
        </CardContent>

        <div className='flex items-center justify-between p-6 border-t'>
          <div className='flex items-center gap-4 text-sm text-gray-600'>
            <span>
              {conflictStats.resolved} of {conflictStats.total} conflicts resolved
            </span>
            {conflictStats.resolved === conflictStats.total && (
              <Badge variant='default' className='flex items-center gap-1'>
                <CheckCircle className='w-3 h-3' />
                All Resolved
              </Badge>
            )}
          </div>

          <div className='flex gap-2'>
            <Button variant='outline' onClick={onCancel}>
              Cancel
            </Button>
            <Button
              onClick={() => onResolve(resolutions)}
              disabled={conflictStats.resolved !== conflictStats.total}
            >
              Apply Resolutions
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
