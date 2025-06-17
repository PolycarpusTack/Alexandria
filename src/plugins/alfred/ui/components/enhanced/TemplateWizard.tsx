import React, { useState, useEffect } from 'react';
import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import { Textarea } from '@client/components/ui/textarea';
import { Label } from '@client/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/components/ui/select';
import { Badge } from '@client/components/ui/badge';
import { Progress } from '@client/components/ui/progress';
import { toast } from '@client/components/ui/use-toast';
import { 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  Code, 
  Settings, 
  Wand2,
  CheckCircle,
  AlertCircle,
  Eye,
  Download,
  Save
} from 'lucide-react';
import { CodeBlock } from './CodeBlock';
import { CodeTemplate, TemplateVariable, ProjectContext } from '../../../src/interfaces';

interface TemplateWizardProps {
  templates: CodeTemplate[];
  projectContext?: ProjectContext;
  onTemplateProcess: (template: CodeTemplate, variables: Record<string, any>) => Promise<any>;
  onSave?: (template: CodeTemplate) => Promise<void>;
  theme?: 'light' | 'dark';
}

interface WizardStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  component: React.ComponentType<any>;
  isValid: boolean;
}

export const TemplateWizard: React.FC<TemplateWizardProps> = ({
  templates,
  projectContext,
  onTemplateProcess,
  onSave,
  theme = 'dark'
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<CodeTemplate | null>(null);
  const [variables, setVariables] = useState<Record<string, any>>({});
  const [previewContent, setPreviewContent] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const steps: WizardStep[] = [
    {
      id: 'select',
      title: 'Select Template',
      description: 'Choose a template that fits your needs',
      icon: <FileText className="w-5 h-5" />,
      component: TemplateSelection,
      isValid: !!selectedTemplate
    },
    {
      id: 'configure',
      title: 'Configure Variables',
      description: 'Set up template variables and options',
      icon: <Settings className="w-5 h-5" />,
      component: VariableConfiguration,
      isValid: selectedTemplate ? validateVariables(selectedTemplate, variables) : false
    },
    {
      id: 'preview',
      title: 'Preview & Generate',
      description: 'Review the generated code and make final adjustments',
      icon: <Eye className="w-5 h-5" />,
      component: PreviewAndGenerate,
      isValid: true
    }
  ];

  useEffect(() => {
    if (selectedTemplate && projectContext) {
      // Auto-fill variables from project context
      const autoFilledVars: Record<string, any> = {};
      
      selectedTemplate.variables.forEach(variable => {
        switch (variable.name) {
          case 'projectName':
            autoFilledVars[variable.name] = projectContext.projectName;
            break;
          case 'language':
            autoFilledVars[variable.name] = projectContext.languages?.[0] || 'typescript';
            break;
          case 'framework':
            autoFilledVars[variable.name] = projectContext.frameworks?.[0];
            break;
          case 'author':
            autoFilledVars[variable.name] = 'Developer'; // Would come from user profile
            break;
        }
      });
      
      setVariables(prev => ({ ...autoFilledVars, ...prev }));
    }
  }, [selectedTemplate, projectContext]);

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const generatePreview = async () => {
    if (!selectedTemplate) return;

    setIsProcessing(true);
    try {
      const result = await onTemplateProcess(selectedTemplate, variables);
      setPreviewContent(result.content);
    } catch (error) {
      toast({
        title: "Preview Error",
        description: "Failed to generate preview. Please check your variables.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinish = async () => {
    if (!selectedTemplate) return;

    setIsProcessing(true);
    try {
      const result = await onTemplateProcess(selectedTemplate, variables);
      
      toast({
        title: "Template Generated!",
        description: `Successfully generated ${result.files?.length || 1} files.`,
      });

      // Reset wizard
      setCurrentStep(0);
      setSelectedTemplate(null);
      setVariables({});
      setPreviewContent('');
    } catch (error) {
      toast({
        title: "Generation Error",
        description: "Failed to generate template. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const progress = ((currentStep + 1) / steps.length) * 100;
  const currentStepData = steps[currentStep];

  return (
    <div className={`template-wizard ${theme} h-full flex flex-col`}>
      {/* Header */}
      <div className="wizard-header p-6 border-b bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wand2 className="w-6 h-6 text-purple-500" />
            <h1 className="text-2xl font-bold">Template Wizard</h1>
          </div>
          <Badge variant="outline">
            Step {currentStep + 1} of {steps.length}
          </Badge>
        </div>
        
        <Progress value={progress} className="mb-4" />
        
        <div className="flex items-center gap-4">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`flex items-center gap-2 ${
                index === currentStep 
                  ? 'text-blue-600 dark:text-blue-400' 
                  : index < currentStep 
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-400'
              }`}
            >
              <div className={`p-2 rounded-full ${
                index === currentStep 
                  ? 'bg-blue-100 dark:bg-blue-900' 
                  : index < currentStep 
                    ? 'bg-green-100 dark:bg-green-900'
                    : 'bg-gray-100 dark:bg-gray-800'
              }`}>
                {index < currentStep ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  step.icon
                )}
              </div>
              <div className="hidden md:block">
                <div className="font-medium text-sm">{step.title}</div>
                <div className="text-xs opacity-70">{step.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="wizard-content flex-1 p-6 overflow-auto">
        <currentStepData.component
          templates={templates}
          selectedTemplate={selectedTemplate}
          setSelectedTemplate={setSelectedTemplate}
          variables={variables}
          setVariables={setVariables}
          validationErrors={validationErrors}
          setValidationErrors={setValidationErrors}
          previewContent={previewContent}
          generatePreview={generatePreview}
          isProcessing={isProcessing}
          projectContext={projectContext}
          // theme prop removed for compatibility
        />
      </div>

      {/* Footer */}
      <div className="wizard-footer p-6 border-t bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>
          
          <div className="flex items-center gap-2">
            {currentStep === steps.length - 1 ? (
              <Button
                onClick={handleFinish}
                disabled={!currentStepData.isValid || isProcessing}
                className="bg-green-600 hover:bg-green-700"
              >
                {isProcessing ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Generate Template
              </Button>
            ) : (
              <Button
                onClick={nextStep}
                disabled={!currentStepData.isValid}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Step Components

const TemplateSelection: React.FC<any> = ({
  templates,
  selectedTemplate,
  setSelectedTemplate,
  theme
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const categories = Array.from(new Set(templates.map(t => t.category).filter(Boolean)));
  
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || template.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="template-selection">
      <h2 className="text-xl font-semibold mb-4">Choose a Template</h2>
      
      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <Input
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(category => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map(template => (
          <div
            key={template.id}
            onClick={() => setSelectedTemplate(template)}
            className={`template-card p-4 rounded-lg border-2 cursor-pointer transition-all ${
              selectedTemplate?.id === template.id
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-medium">{template.name}</h3>
              <Badge variant="secondary" className="text-xs">
                {template.language}
              </Badge>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              {template.description}
            </p>
            
            <div className="flex flex-wrap gap-1">
              {template.tags?.map(tag => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
            
            <div className="mt-3 text-xs text-gray-500">
              {template.variables.length} variables
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const VariableConfiguration: React.FC<any> = ({
  selectedTemplate,
  variables,
  setVariables,
  validationErrors,
  setValidationErrors,
  projectContext
}) => {
  const updateVariable = (name: string, value: any) => {
    setVariables(prev => ({ ...prev, [name]: value }));
    
    // Clear validation error
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const renderVariableInput = (variable: TemplateVariable) => {
    const value = variables[variable.name] || variable.defaultValue || '';
    const error = validationErrors[variable.name];

    switch (variable.type) {
      case 'select':
        return (
          <Select value={value} onValueChange={(val) => updateVariable(variable.name, val)}>
            <SelectTrigger>
              <SelectValue placeholder={`Select ${variable.name}`} />
            </SelectTrigger>
            <SelectContent>
              {variable.options?.map(option => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={value}
              onChange={(e) => updateVariable(variable.name, e.target.checked)}
              className="rounded"
            />
            <Label>{variable.description}</Label>
          </div>
        );

      case 'text':
        return variable.multiline ? (
          <Textarea
            value={value}
            onChange={(e) => updateVariable(variable.name, e.target.value)}
            placeholder={variable.description}
            rows={3}
          />
        ) : (
          <Input
            value={value}
            onChange={(e) => updateVariable(variable.name, e.target.value)}
            placeholder={variable.description}
          />
        );

      default:
        return (
          <Input
            value={value}
            onChange={(e) => updateVariable(variable.name, e.target.value)}
            placeholder={variable.description}
          />
        );
    }
  };

  return (
    <div className="variable-configuration">
      <h2 className="text-xl font-semibold mb-4">Configure Template Variables</h2>
      
      {selectedTemplate && (
        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
              {selectedTemplate.name}
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {selectedTemplate.description}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {selectedTemplate.variables.map(variable => (
              <div key={variable.name} className="space-y-2">
                <Label className="flex items-center gap-2">
                  {variable.name}
                  {variable.required && (
                    <span className="text-red-500">*</span>
                  )}
                </Label>
                
                {renderVariableInput(variable)}
                
                {validationErrors[variable.name] && (
                  <div className="flex items-center gap-1 text-red-500 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {validationErrors[variable.name]}
                  </div>
                )}
                
                {variable.description && !validationErrors[variable.name] && (
                  <p className="text-sm text-gray-500">{variable.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const PreviewAndGenerate: React.FC<any> = ({
  selectedTemplate,
  variables,
  previewContent,
  generatePreview,
  isProcessing,
  theme
}) => {
  useEffect(() => {
    if (selectedTemplate && Object.keys(variables).length > 0) {
      generatePreview();
    }
  }, [selectedTemplate, variables]);

  return (
    <div className="preview-generate">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Preview & Generate</h2>
        <Button
          onClick={generatePreview}
          disabled={isProcessing}
          variant="outline"
        >
          {isProcessing ? (
            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mr-2" />
          ) : (
            <Eye className="w-4 h-4 mr-2" />
          )}
          Refresh Preview
        </Button>
      </div>

      {selectedTemplate && (
        <div className="space-y-6">
          {/* Variables Summary */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Configuration Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              {Object.entries(variables).map(([key, value]) => (
                <div key={key}>
                  <span className="font-medium">{key}:</span>{' '}
                  <span className="text-gray-600 dark:text-gray-400">
                    {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          {previewContent ? (
            <div>
              <h3 className="font-medium mb-2">Generated Code Preview</h3>
              <CodeBlock
                code={previewContent}
                language={selectedTemplate.language}
                filename={`preview.${getFileExtension(selectedTemplate.language)}`}
              />
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Code className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Preview will appear here once variables are configured</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Helper functions
function validateVariables(template: CodeTemplate, variables: Record<string, any>): boolean {
  return template.variables.every(variable => {
    if (variable.required) {
      const value = variables[variable.name];
      return value !== undefined && value !== null && value !== '';
    }
    return true;
  });
}

function getFileExtension(language: string): string {
  const extensions: Record<string, string> = {
    'javascript': 'js',
    'typescript': 'ts',
    'python': 'py',
    'java': 'java',
    'go': 'go',
    'rust': 'rs'
  };
  return extensions[language.toLowerCase()] || 'txt';
}

export default TemplateWizard;