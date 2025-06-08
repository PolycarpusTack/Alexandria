import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Upload, ArrowLeft } from 'lucide-react';
import { crashAnalyzerAPI } from '../../services/crash-analyzer-api';
import { createClientLogger } from '../../utils/client-logger';

const logger = createClientLogger({ serviceName: 'crash-log-upload' });

export const CrashLogUpload: React.FC = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await crashAnalyzerAPI.uploadCrashLog(formData);
      
      // Navigate to the detail page for the uploaded log
      navigate(`/crash-analyzer/logs/${response.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to upload crash log');
      logger.error('Upload error', { error: err, fileName: file?.name });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/crash-analyzer')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Crash Log</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Select crash log file
            </label>
            <Input
              type="file"
              onChange={handleFileChange}
              accept=".log,.txt,.json,.dump"
              className="w-full"
            />
            <p className="text-sm text-gray-500 mt-1">
              Supported formats: .log, .txt, .json, .dump
            </p>
          </div>

          {file && (
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
              <p className="text-sm">
                <span className="font-medium">Selected file:</span> {file.name}
              </p>
              <p className="text-sm text-gray-500">
                Size: {(file.size / 1024).toFixed(2)} KB
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-md">
              {error}
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full gap-2"
          >
            <Upload className={`h-4 w-4 ${uploading ? 'animate-bounce' : ''}`} />
            {uploading ? 'Uploading...' : 'Upload Crash Log'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CrashLogUpload;