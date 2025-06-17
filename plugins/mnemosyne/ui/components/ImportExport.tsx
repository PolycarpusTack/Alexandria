import React, { useState } from 'react';
import { 
  Upload, 
  Download, 
  FileText, 
  FolderOpen,
  CheckCircle,
  XCircle,
  AlertCircle,
  Package,
  ArrowRight
} from 'lucide-react';

const ImportExport: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [selectedFormat, setSelectedFormat] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResults, setImportResults] = useState<any>(null);

  const importFormats = [
    { id: 'obsidian', name: 'Obsidian Vault', icon: '🗂️', description: 'Import from Obsidian markdown files' },
    { id: 'notion', name: 'Notion Export', icon: '📝', description: 'Import from Notion HTML export' },
    { id: 'roam', name: 'Roam Research', icon: '🔗', description: 'Import from Roam JSON export' },
    { id: 'markdown', name: 'Markdown Files', icon: '📄', description: 'Import plain markdown files' },
    { id: 'json', name: 'JSON Export', icon: '📊', description: 'Import from Mnemosyne JSON format' }
  ];

  const exportFormats = [
    { id: 'markdown', name: 'Markdown Files', icon: '📄', description: 'Export as markdown files' },
    { id: 'json', name: 'JSON Archive', icon: '📊', description: 'Export as Mnemosyne JSON format' },
    { id: 'pdf', name: 'PDF Document', icon: '📑', description: 'Export as PDF document' },
    { id: 'html', name: 'Static Website', icon: '🌐', description: 'Generate static HTML site' },
    { id: 'obsidian', name: 'Obsidian Vault', icon: '🗂️', description: 'Export for Obsidian' }
  ];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImportFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!importFile || !selectedFormat) return;
    
    setIsProcessing(true);
    // Simulate import process
    setTimeout(() => {
      setImportResults({
        success: true,
        imported: 42,
        skipped: 3,
        errors: 1,
        details: [
          { status: 'success', message: 'Imported 42 nodes successfully' },
          { status: 'warning', message: 'Skipped 3 duplicate nodes' },
          { status: 'error', message: '1 file could not be parsed' }
        ]
      });
      setIsProcessing(false);
    }, 2000);
  };

  const handleExport = async () => {
    if (!selectedFormat) return;
    
    setIsProcessing(true);
    // Simulate export process
    setTimeout(() => {
      setIsProcessing(false);
      // Trigger download
      const link = document.createElement('a');
      link.href = '#';
      link.download = `mnemosyne-export-${new Date().toISOString().split('T')[0]}.${selectedFormat}`;
      link.click();
    }, 2000);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Import & Export
        </h1>
        
        {/* Tab Switcher */}
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <button
            onClick={() => setActiveTab('import')}
            className={`flex-1 px-4 py-2 rounded-md transition-colors ${
              activeTab === 'import' 
                ? 'bg-white dark:bg-gray-700 shadow-sm' 
                : 'hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Upload className="inline h-4 w-4 mr-2" />
            Import
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`flex-1 px-4 py-2 rounded-md transition-colors ${
              activeTab === 'export' 
                ? 'bg-white dark:bg-gray-700 shadow-sm' 
                : 'hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Download className="inline h-4 w-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'import' ? (
          <div className="max-w-4xl mx-auto">
            {/* Format Selection */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Select Import Format
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {importFormats.map(format => (
                  <label
                    key={format.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedFormat === format.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="format"
                      value={format.id}
                      checked={selectedFormat === format.id}
                      onChange={(e) => setSelectedFormat(e.target.value)}
                      className="sr-only"
                    />
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{format.icon}</span>
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-gray-100">
                          {format.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {format.description}
                        </p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* File Upload */}
            {selectedFormat && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Select File
                </h2>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8">
                  <input
                    type="file"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                    accept={selectedFormat === 'json' ? '.json' : selectedFormat === 'markdown' ? '.md,.markdown' : '*'}
                  />
                  <label
                    htmlFor="file-upload"
                    className="flex flex-col items-center cursor-pointer"
                  >
                    <FolderOpen className="h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-600 dark:text-gray-400 mb-2">
                      {importFile ? importFile.name : 'Click to select file or drag and drop'}
                    </p>
                    <p className="text-sm text-gray-500">
                      Supported formats: {selectedFormat.toUpperCase()}
                    </p>
                  </label>
                </div>
              </div>
            )}

            {/* Import Results */}
            {importResults && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Import Results
                </h2>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      {importResults.success ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <span className="font-medium">
                        Import {importResults.success ? 'Completed' : 'Failed'}
                      </span>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <span className="text-green-600">
                        {importResults.imported} imported
                      </span>
                      <span className="text-yellow-600">
                        {importResults.skipped} skipped
                      </span>
                      <span className="text-red-600">
                        {importResults.errors} errors
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {importResults.details.map((detail: any, index: number) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        {detail.status === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                        {detail.status === 'warning' && <AlertCircle className="h-4 w-4 text-yellow-500" />}
                        {detail.status === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
                        <span className="text-gray-600 dark:text-gray-400">{detail.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Action Button */}
            {selectedFormat && importFile && !importResults && (
              <button
                onClick={handleImport}
                disabled={isProcessing}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>Processing...</>
                ) : (
                  <>
                    <Upload className="h-5 w-5" />
                    Import {importFile.name}
                  </>
                )}
              </button>
            )}
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            {/* Export Format Selection */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Select Export Format
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {exportFormats.map(format => (
                  <label
                    key={format.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedFormat === format.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="format"
                      value={format.id}
                      checked={selectedFormat === format.id}
                      onChange={(e) => setSelectedFormat(e.target.value)}
                      className="sr-only"
                    />
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{format.icon}</span>
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-gray-100">
                          {format.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {format.description}
                        </p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Export Options */}
            {selectedFormat && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Export Options
                </h2>
                <div className="space-y-4">
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3" defaultChecked />
                    <span className="text-gray-700 dark:text-gray-300">Include all nodes</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3" defaultChecked />
                    <span className="text-gray-700 dark:text-gray-300">Include attachments</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3" />
                    <span className="text-gray-700 dark:text-gray-300">Include version history</span>
                  </label>
                </div>
              </div>
            )}

            {/* Export Button */}
            {selectedFormat && (
              <button
                onClick={handleExport}
                disabled={isProcessing}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>Preparing Export...</>
                ) : (
                  <>
                    <Download className="h-5 w-5" />
                    Export as {exportFormats.find(f => f.id === selectedFormat)?.name}
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportExport;