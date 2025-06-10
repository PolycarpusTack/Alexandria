import React, { useState, useEffect } from 'react';
import { 
  useMnemosyne, 
  useAlexandria 
} from '@alexandria/mnemosyne-sdk';
import { ImportEngine, ImportConfig, ImportSource } from '../core/ImportEngine';
import { ImportAnalysis } from '../adapters/base/ImportAdapter';

type ImportStep = 'source' | 'analyze' | 'preview' | 'map' | 'enhance' | 'import' | 'complete';

interface ImportWizardProps {
  onClose: () => void;
  onComplete: (result: any) => void;
}

export const ImportWizard: React.FC<ImportWizardProps> = ({ onClose, onComplete }) => {
  const mnemosyne = useMnemosyne();
  const alexandria = useAlexandria();
  
  const [currentStep, setCurrentStep] = useState<ImportStep>('source');
  const [source, setSource] = useState<ImportSource>();
  const [analysis, setAnalysis] = useState<ImportAnalysis>();
  const [config, setConfig] = useState<ImportConfig>({
    source: {} as ImportSource,
    options: {
      preserveStructure: true,
      convertLinks: true,
      importAttachments: true,
      trackProvenance: true
    }
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>();
  
  const importEngine = new ImportEngine(mnemosyne);

  const steps: ImportStep[] = [
    'source',
    'analyze', 
    'preview',
    'map',
    'enhance',
    'import',
    'complete'
  ];

  const handleSourceSelect = (sourceType: string) => {
    setSource({
      type: sourceType as any,
      path: ''
    });
    setConfig({
      ...config,
      source: {
        type: sourceType as any,
        path: ''
      }
    });
  };

  const handleAnalyze = async () => {
    if (!source) return;
    
    setIsProcessing(true);
    try {
      const result = await importEngine.analyze(source);
      setAnalysis(result);
      setCurrentStep('preview');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    setIsProcessing(true);
    try {
      const result = await importEngine.import(config);
      onComplete(result);
      setCurrentStep('complete');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="import-wizard">
      <div className="wizard-header">
        <h2>Import to Mnemosyne</h2>
        <button className="close-button" onClick={onClose}>
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div className="wizard-progress">
        {steps.map((step, index) => (
          <div 
            key={step}
            className={`progress-step ${
              currentStep === step ? 'active' : 
              steps.indexOf(currentStep) > index ? 'completed' : ''
            }`}
          >
            <div className="progress-dot">
              {steps.indexOf(currentStep) > index ? 
                <i className="fa-solid fa-check"></i> : 
                index + 1
              }
            </div>
            <span className="progress-label">{step}</span>
          </div>
        ))}
      </div>

      <div className="wizard-content">
        {currentStep === 'source' && (
          <SourceSelection onSelect={handleSourceSelect} />
        )}

        {currentStep === 'analyze' && source && (
          <AnalysisStep 
            source={source}
            onAnalyze={handleAnalyze}
            isProcessing={isProcessing}
          />
        )}

        {currentStep === 'preview' && analysis && (
          <PreviewStep 
            analysis={analysis}
            onNext={() => setCurrentStep('map')}
          />
        )}

        {currentStep === 'map' && analysis && (
          <RelationshipMapping 
            analysis={analysis}
            onNext={() => setCurrentStep('enhance')}
          />
        )}

        {currentStep === 'enhance' && (
          <EnhancementOptions 
            config={config}
            onChange={setConfig}
            onNext={() => setCurrentStep('import')}
          />
        )}

        {currentStep === 'import' && (
          <ImportConfirmation 
            config={config}
            analysis={analysis}
            onImport={handleImport}
            isProcessing={isProcessing}
          />
        )}

        {currentStep === 'complete' && (
          <ImportComplete onClose={onClose} />
        )}

        {error && (
          <div className="error-message">
            <i className="fa-solid fa-exclamation-circle"></i>
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

// Sub-components for each step

const SourceSelection: React.FC<{ onSelect: (type: string) => void }> = ({ onSelect }) => {
  const sources = [
    {
      id: 'obsidian',
      name: 'Obsidian Vault',
      icon: 'fa-solid fa-vault',
      description: 'Import your Obsidian vault with full graph preservation',
      color: '#7c3aed'
    },
    {
      id: 'notion',
      name: 'Notion Workspace',
      icon: 'fa-solid fa-n',
      description: 'Import Notion pages and databases',
      color: '#000000'
    },
    {
      id: 'roam',
      name: 'Roam Research',
      icon: 'fa-solid fa-diagram-project',
      description: 'Import Roam graph with block references',
      color: '#0066cc'
    },
    {
      id: 'logseq',
      name: 'Logseq',
      icon: 'fa-solid fa-code-branch',
      description: 'Import Logseq graph and journals',
      color: '#00b894'
    },
    {
      id: 'markdown',
      name: 'Markdown Files',
      icon: 'fa-solid fa-file-lines',
      description: 'Import standard markdown files and folders',
      color: '#6b7280'
    }
  ];

  return (
    <div className="source-selection">
      <h3>Choose Your Import Source</h3>
      <p className="help-text">
        Select the knowledge management system you want to import from
      </p>

      <div className="source-grid">
        {sources.map(source => (
          <div 
            key={source.id}
            className="source-card"
            onClick={() => onSelect(source.id)}
            style={{ borderColor: source.color }}
          >
            <div className="source-icon" style={{ color: source.color }}>
              <i className={source.icon}></i>
            </div>
            <h4>{source.name}</h4>
            <p>{source.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const PreviewStep: React.FC<{ 
  analysis: ImportAnalysis; 
  onNext: () => void;
}> = ({ analysis, onNext }) => {
  return (
    <div className="preview-step">
      <h3>Import Preview</h3>
      
      <div className="analysis-summary">
        <div className="summary-stat">
          <div className="stat-value">{analysis.documentCount}</div>
          <div className="stat-label">Documents</div>
        </div>
        <div className="summary-stat">
          <div className="stat-value">{analysis.linkCount}</div>
          <div className="stat-label">Links</div>
        </div>
        <div className="summary-stat">
          <div className="stat-value">{analysis.attachmentCount}</div>
          <div className="stat-label">Attachments</div>
        </div>
        <div className="summary-stat">
          <div className="stat-value">{analysis.tagCount}</div>
          <div className="stat-label">Tags</div>
        </div>
      </div>

      {analysis.warnings.length > 0 && (
        <div className="warnings-section">
          <h4>Warnings</h4>
          {analysis.warnings.map((warning, index) => (
            <div key={index} className={`warning warning-${warning.severity}`}>
              <i className="fa-solid fa-triangle-exclamation"></i>
              {warning.message}
            </div>
          ))}
        </div>
      )}

      <div className="transformation-preview">
        <h4>Transformation Preview</h4>
        {analysis.preview.sampleDocuments.map((preview, index) => (
          <div key={index} className="preview-comparison">
            <div className="preview-before">
              <h5>Original</h5>
              <pre>{preview.original}</pre>
            </div>
            <div className="preview-arrow">
              <i className="fa-solid fa-arrow-right"></i>
            </div>
            <div className="preview-after">
              <h5>Converted</h5>
              <pre>{preview.converted}</pre>
            </div>
          </div>
        ))}
      </div>

      <div className="wizard-actions">
        <button className="btn btn-secondary">Back</button>
        <button className="btn btn-primary" onClick={onNext}>
          Continue
        </button>
      </div>
    </div>
  );
};