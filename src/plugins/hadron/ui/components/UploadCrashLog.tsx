import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from '../../../../client/components/ui/use-toast';

import { OllamaStatusIndicator } from './OllamaStatusIndicator';

interface UploadCrashLogProps {
  crashAnalyzerService: any;
  onLogUploaded: (logId: string) => void;
  modalId?: string;
}

export const UploadCrashLog: React.FC<UploadCrashLogProps> = ({
  crashAnalyzerService,
  onLogUploaded,
  modalId = 'upload-crash-log'
}) => {
  const { toast } = useToast();
  const [logContent, setLogContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState({
    platform: '',
    appVersion: '',
    device: ''
  });
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [loadingModels, setLoadingModels] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analyzingProgress, setAnalyzingProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [uploadStage, setUploadStage] = useState<'idle' | 'uploading' | 'analyzing' | 'complete'>('idle');
  const [fileSize, setFileSize] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    // Load available Ollama models when component mounts
    const loadModels = async () => {
      try {
        setLoadingModels(true);
        // Call the LLM service to get available models
        if (crashAnalyzerService.getLlmService) {
          const llmService = crashAnalyzerService.getLlmService();
          const models = await llmService.getAvailableModels();
          setAvailableModels(models);
          
          // Set default selected model
          if (models.length > 0) {
            setSelectedModel(models[0]);
          }
        }
      } catch (err) {
        console.error('Error loading Ollama models:', err);
        setError('Failed to load available Ollama models. Please check if Ollama is running.');
      } finally {
        setLoadingModels(false);
      }
    };
    
    loadModels();
  }, [crashAnalyzerService]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'logContent') {
      setLogContent(value);
    } else if (name === 'selectedModel') {
      setSelectedModel(value);
    } else {
      setMetadata(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      setError(`File is too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 10MB.`);
      return;
    }
    
    setFileSize(file.size);
    
    try {
      // Show upload progress simulation
      setUploadStage('uploading');
      setUploadProgress(0);
      
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 95) {
            clearInterval(progressInterval);
            return 95;
          }
          return prev + (Math.random() * 10);
        });
      }, 100);
      
      const text = await file.text();
      
      // Set upload to complete
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      setTimeout(() => {
        setLogContent(text);
        setFileName(file.name);
        setUploadStage('idle');
        
        // Try to extract platform info from the file name
        if (file.name.toLowerCase().includes('android')) {
          setMetadata(prev => ({ ...prev, platform: 'Android' }));
        } else if (file.name.toLowerCase().includes('ios')) {
          setMetadata(prev => ({ ...prev, platform: 'iOS' }));
        } else if (file.name.toLowerCase().includes('windows')) {
          setMetadata(prev => ({ ...prev, platform: 'Windows' }));
        } else if (file.name.toLowerCase().includes('mac')) {
          setMetadata(prev => ({ ...prev, platform: 'macOS' }));
        }

        // Show success message
        toast({ 
          title: 'File Uploaded', 
          description: `${file.name} (${(file.size / 1024).toFixed(1)}KB) has been loaded` 
        });
      }, 500);
    } catch (err) {
      console.error('Error reading file:', err);
      setError('Failed to read file. Please try again.');
      setUploadStage('idle');
      toast({ 
        title: 'Upload Failed', 
        description: 'Failed to read file. Please try again.',
        variant: 'destructive'
      });
    }
  };
  
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    
    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      setError(`File is too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 10MB.`);
      return;
    }
    
    setFileSize(file.size);
    
    // Show upload progress simulation
    setUploadStage('uploading');
    setUploadProgress(0);
    
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 95) {
          clearInterval(progressInterval);
          return 95;
        }
        return prev + (Math.random() * 10);
      });
    }, 100);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        // Set upload to complete
        clearInterval(progressInterval);
        setUploadProgress(100);
        
        setTimeout(() => {
          if (event.target && event.target.result) {
            setLogContent(event.target.result as string);
          }
          setFileName(file.name);
          setUploadStage('idle');
          
          // Try to extract platform info from the file name
          if (file.name.toLowerCase().includes('android')) {
            setMetadata(prev => ({ ...prev, platform: 'Android' }));
          } else if (file.name.toLowerCase().includes('ios')) {
            setMetadata(prev => ({ ...prev, platform: 'iOS' }));
          } else if (file.name.toLowerCase().includes('windows')) {
            setMetadata(prev => ({ ...prev, platform: 'Windows' }));
          } else if (file.name.toLowerCase().includes('mac')) {
            setMetadata(prev => ({ ...prev, platform: 'macOS' }));
          }
          
          // Show success message
          toast({ 
            title: 'File Uploaded', 
            description: `${file.name} (${(file.size / 1024).toFixed(1)}KB) has been loaded` 
          });
        }, 500);
      }
    };
    
    reader.onerror = () => {
      clearInterval(progressInterval);
      setUploadStage('idle');
      setError('Failed to read file. Please try again.');
      toast({ 
        title: 'Upload Failed', 
        description: 'Failed to read file. Please try again.',
        variant: 'destructive'
      });
    };
    
    reader.readAsText(file);
  }, []);
  
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(true);
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
  }, []);
  
  const handleUpload = async () => {
    if (!logContent.trim()) {
      setError('Please enter or upload crash log content.');
      toast({ 
        title: 'Error', 
        description: 'Please enter or upload crash log content.',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setUploadStage('analyzing');
      setAnalyzingProgress(0);
      
      // Start progress simulation for analysis
      const progressInterval = setInterval(() => {
        setAnalyzingProgress(prev => {
          if (prev >= 90) {
            return 90; // Cap at 90% until actual completion
          }
          return prev + (Math.random() * 5);
        });
      }, 300);
      
      // Create combined metadata
      const combinedMetadata = {
        ...metadata,
        source: fileName ? 'file-upload' : 'manual-entry',
        fileName: fileName || undefined,
        uploadedBy: 'current-user', // This would be replaced with actual user info
        uploadedAt: new Date().toISOString(),
        // Add selected model to metadata
        llmModel: selectedModel || undefined,
        fileSize: fileSize || undefined
      };
      
      // Generate a unique ID for the log
      const logId = `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      // Analyze the log - passing the selected model if available
      await crashAnalyzerService.analyzeLog(logId, logContent, combinedMetadata);
      
      // Set to 100% when done
      clearInterval(progressInterval);
      setAnalyzingProgress(100);
      setUploadStage('complete');
      
      // Show success message
      toast({ 
        title: 'Analysis Complete', 
        description: 'Crash log has been uploaded and analyzed successfully'
      });
      
      // Close the modal and notify parent after a short delay
      setTimeout(() => {
        // Modal will be closed by parent component
        onLogUploaded(logId);
      }, 500);
    } catch (err) {
      console.error('Error uploading crash log:', err);
      const errorMsg = 'Failed to upload and analyze crash log. Please try again.';
      setError(errorMsg);
      setUploadStage('idle');
      toast({ 
        title: 'Analysis Failed', 
        description: errorMsg,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Upload Crash Log</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}
      
      <div
        className={`mb-4 border-2 border-dashed ${dragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300'} rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50 transition-colors relative`}
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".txt,.log,.json,.crash"
          className="hidden"
        />
        
        {uploadStage === 'uploading' ? (
          <div className="py-4">
            <h3 className="text-blue-600 font-medium mb-2">Uploading file...</h3>
            <Progress value={uploadProgress} className="mb-2" />
            <p className="text-sm text-gray-500">{Math.round(uploadProgress)}% complete</p>
          </div>
        ) : fileName ? (
          <div className="py-4">
            <div className="flex items-center justify-center mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-green-600 font-medium">File uploaded successfully</span>
            </div>
            <div className="mt-2 p-2 bg-blue-50 rounded-lg text-blue-700 text-sm flex items-center justify-center">
              <span className="font-medium mr-2">Selected file:</span> {fileName}
              {fileSize && <span className="ml-2 text-xs">({(fileSize / 1024).toFixed(1)} KB)</span>}
            </div>
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setFileName('');
                setLogContent('');
                setFileSize(null);
              }}
              className="mt-2 text-xs text-red-600 hover:text-red-800"
            >
              Remove file
            </button>
          </div>
        ) : (
          <div className="text-gray-500 mb-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 mx-auto mb-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-sm font-medium">
              Drag and drop your crash log file here, or click to select a file
            </p>
            <p className="text-xs mt-1">
              Supported formats: .txt, .log, .json, .crash
            </p>
            <p className="text-xs mt-1 text-gray-400">
              Maximum file size: 10MB
            </p>
          </div>
        )}
      </div>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Or paste crash log content:
        </label>
        <textarea
          name="logContent"
          value={logContent}
          onChange={handleInputChange}
          className="w-full h-40 p-2 border border-gray-300 rounded-lg font-mono text-sm"
          placeholder="Paste your crash log here..."
        />
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Platform
          </label>
          <Input
            name="platform"
            value={metadata.platform}
            onChange={handleInputChange}
            placeholder="e.g., Android, iOS, Windows"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            App Version
          </label>
          <Input
            name="appVersion"
            value={metadata.appVersion}
            onChange={handleInputChange}
            placeholder="e.g., 1.2.3"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Device
          </label>
          <Input
            name="device"
            value={metadata.device}
            onChange={handleInputChange}
            placeholder="e.g., iPhone 13, Pixel 6"
          />
        </div>
      </div>
      
      <div className="mb-6">
        <div className="flex justify-between items-center mb-1">
          <label className="block text-sm font-medium text-gray-700">
            Ollama Model for Analysis
          </label>
          <OllamaStatusIndicator crashAnalyzerService={crashAnalyzerService} />
        </div>
        {loadingModels ? (
          <div className="flex items-center text-sm text-gray-500">
            <Loader2 className="animate-spin" size="small" className="mr-2" />
            Loading available models...
          </div>
        ) : availableModels.length > 0 ? (
          <select
            name="selectedModel"
            value={selectedModel}
            onChange={handleInputChange}
            className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {availableModels.map(model => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        ) : (
          <div className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded-lg border border-yellow-200">
            No Ollama models available. Default model will be used. Please ensure Ollama is running.
          </div>
        )}
        <p className="text-xs text-gray-500 mt-1">
          Select the Ollama model to use for crash analysis. Different models may provide different levels of insight.
        </p>
      </div>
      
      {uploadStage === 'analyzing' && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="text-blue-700 font-medium mb-2">Analyzing your crash log...</h3>
          <Progress value={analyzingProgress} className="mb-2" />
          <p className="text-sm text-gray-600">{Math.round(analyzingProgress)}% complete</p>
          <p className="text-xs text-gray-500 mt-1">
            Using AI to identify issues, extract important details, and provide troubleshooting steps.
          </p>
        </div>
      )}
      
      <div className="flex justify-end space-x-3">
        <Button variant="secondary" onClick={() => {}} disabled={loading || uploadStage === 'analyzing'}>
          Cancel
        </Button>
        <Button 
          variant="primary" 
          onClick={handleUpload} 
          disabled={loading || uploadStage === 'analyzing' || !logContent.trim()}
        >
          {loading ? <Loader2 className="animate-spin" size="small" className="mr-2" /> : null}
          {uploadStage === 'analyzing' ? 'Analyzing...' : 'Upload & Analyze'}
        </Button>
      </div>
      
      {/* Ollama status with more details */}
      <div className="mt-4 flex justify-end">
        <OllamaStatusIndicator 
          crashAnalyzerService={crashAnalyzerService} 
          showDetails={true}
          pollingInterval={10000}
        />
      </div>
    </div>
  );
import { Button } from '../../../../client/components/ui/button';
import { Input } from '../../../../client/components/ui/input';
import { Loader2 } from 'lucide-react';
import { useToast } from '../../../../client/components/ui/use-toast';
import { Progress } from '../../../../client/components/ui/progress'
};