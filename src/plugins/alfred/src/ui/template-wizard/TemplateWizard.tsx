/**
 * Template Wizard React Component
 *
 * Web-based template generation wizard with modern UI,
 * real-time validation, and AI assistance
 */

import React, { useState, useEffect } from 'react';
import {
  TemplateManifest,
  VariableSchema,
  VariableMap
} from '../../services/template-engine/interfaces';
import { Button } from '../../../../../client/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '../../../../../client/components/ui/card';
import { Input } from '../../../../../client/components/ui/input';
import { Progress } from '../../../../../client/components/ui/progress';
import { Badge } from '../../../../../client/components/ui/badge';
import { Alert, AlertDescription } from '../../../../../client/components/ui/alert';
import { ScrollArea } from '../../../../../client/components/ui/scroll-area';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Sparkles,
  FileText,
  Folder,
  CheckCircle,
  AlertTriangle,
  Loader2
} from 'lucide-react';

import { clientLogger } from '@/utils/client-logger';
export interface TemplateWizardProps {
  templates: TemplateManifest[];
  projectPath?: string;
  enableAI?: boolean;
  onComplete: (result: { templateId: string; variables: VariableMap }) => void;
  onCancel: () => void;
  className?: string;
}

interface WizardState {
  currentStep: 'selection' | 'configuration' | 'preview' | 'generation';
  selectedTemplate?: TemplateManifest;
  variables: VariableMap;
  aiSuggestions: Record<string, any>;
  validationErrors: Record<string, string[]>;
  isGenerating: boolean;
  searchQuery: string;
  currentVariableIndex: number;
}

export const TemplateWizard: React.FC<TemplateWizardProps> = ({
  templates,
  projectPath,
  enableAI = true,
  onComplete,
  onCancel,
  className = ''
}) => {
  const [state, setState] = useState<WizardState>({
    currentStep: 'selection',
    variables: {},
    aiSuggestions: {},
    validationErrors: {},
    isGenerating: false,
    searchQuery: '',
    currentVariableIndex: 0
  });

  // Filter templates based on search query
  const filteredTemplates = templates.filter(
    (template) =>
      template.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
      template.tags?.some((tag) => tag.toLowerCase().includes(state.searchQuery.toLowerCase()))
  );

  // Calculate progress
  const totalVariables = state.selectedTemplate?.variables?.length || 0;
  const completedVariables = Object.keys(state.variables).length;
  const progress = totalVariables > 0 ? (completedVariables / totalVariables) * 100 : 0;

  // Load AI suggestions when template is selected
  useEffect(() => {
    if (state.selectedTemplate && enableAI && projectPath) {
      loadAISuggestions(state.selectedTemplate);
    }
  }, [state.selectedTemplate, enableAI, projectPath]);

  const loadAISuggestions = async (template: TemplateManifest) => {
    try {
      // This would call the variable resolver service
      // For now, mock some suggestions
      const mockSuggestions: Record<string, any> = {};

      template.variables?.forEach((variable) => {
        if (variable.name.includes('name')) {
          mockSuggestions[variable.name] = projectPath
            ? require('path').basename(projectPath)
            : 'MyComponent';
        }
        if (variable.name.includes('author')) {
          mockSuggestions[variable.name] = 'Your Name';
        }
      });

      setState((prev) => ({
        ...prev,
        aiSuggestions: mockSuggestions
      }));
    } catch (error) {
      clientLogger.warn('Failed to load AI suggestions:', error);
    }
  };

  const selectTemplate = (template: TemplateManifest) => {
    setState((prev) => ({
      ...prev,
      selectedTemplate: template,
      currentStep: 'configuration',
      variables: {},
      currentVariableIndex: 0
    }));
  };

  const updateVariable = (name: string, value: any) => {
    setState((prev) => ({
      ...prev,
      variables: {
        ...prev.variables,
        [name]: value
      }
    }));
  };

  const validateVariable = (variable: VariableSchema, value: any): string[] => {
    const errors: string[] = [];

    if (variable.required && (value == null || value === '')) {
      errors.push('This field is required');
    }

    if (variable.validation && value != null && value !== '') {
      const validation = variable.validation;

      if (validation.pattern && typeof value === 'string') {
        if (!new RegExp(validation.pattern).test(value)) {
          errors.push('Value does not match required pattern');
        }
      }

      if (validation.minLength && typeof value === 'string') {
        if (value.length < validation.minLength) {
          errors.push(`Must be at least ${validation.minLength} characters`);
        }
      }

      if (validation.maxLength && typeof value === 'string') {
        if (value.length > validation.maxLength) {
          errors.push(`Must be at most ${validation.maxLength} characters`);
        }
      }
    }

    return errors;
  };

  const canProceedToPreview = () => {
    if (!state.selectedTemplate) return false;

    const requiredVariables = state.selectedTemplate.variables?.filter((v) => v.required) || [];
    return requiredVariables.every(
      (variable) => state.variables[variable.name] != null && state.variables[variable.name] !== ''
    );
  };

  const generateTemplate = async () => {
    if (!state.selectedTemplate) return;

    setState((prev) => ({ ...prev, isGenerating: true, currentStep: 'generation' }));

    try {
      // Get wizard service from context or props
      const wizardService = getWizardService(); // This would come from React context

      const result = await wizardService.generateTemplate({
        templateId: state.selectedTemplate.id,
        variables: state.variables,
        targetPath: projectPath || '.',
        projectPath: projectPath,
        enableAI: enableAI,
        handleConflicts: 'prompt',
        onProgress: (progress) => {
          // Update UI with real progress
          setState((prev) => ({
            ...prev,
            generationProgress: progress
          }));
        }
      });

      if (result.success) {
        onComplete({
          templateId: state.selectedTemplate.id,
          variables: state.variables,
          result
        });
      } else {
        // Show errors in UI
        setState((prev) => ({
          ...prev,
          generationErrors: result.errors,
          currentStep: 'preview'
        }));
      }
    } catch (error) {
      clientLogger.error('Template generation failed:', error);
      setState((prev) => ({
        ...prev,
        generationError: error as Error,
        currentStep: 'preview'
      }));
    } finally {
      setState((prev) => ({ ...prev, isGenerating: false }));
    }
  };

  const renderTemplateCard = (template: TemplateManifest) => (
    <Card
      key={template.id}
      className='cursor-pointer hover:shadow-md transition-shadow'
      onClick={() => selectTemplate(template)}
    >
      <CardHeader>
        <div className='flex items-start justify-between'>
          <div>
            <CardTitle className='text-lg'>{template.name}</CardTitle>
            <CardDescription className='mt-1'>{template.description}</CardDescription>
          </div>
          <Badge variant='secondary'>{template.category}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className='flex flex-wrap gap-1 mb-3'>
          {template.tags?.map((tag) => (
            <Badge key={tag} variant='outline' className='text-xs'>
              {tag}
            </Badge>
          ))}
        </div>
        <div className='flex items-center justify-between text-sm text-gray-600'>
          <span>{template.files?.length || 0} files</span>
          <span>v{template.version}</span>
        </div>
      </CardContent>
    </Card>
  );

  const renderVariableInput = (variable: VariableSchema, index: number) => {
    const value = state.variables[variable.name] || '';
    const aiSuggestion = state.aiSuggestions[variable.name];
    const errors = validateVariable(variable, value);
    const hasErrors = errors.length > 0;

    return (
      <Card key={variable.name} className='mb-4'>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <CardTitle className='text-base'>
              {variable.description || variable.name}
              {variable.required && <span className='text-red-500 ml-1'>*</span>}
            </CardTitle>
            {aiSuggestion && enableAI && (
              <Button
                variant='outline'
                size='sm'
                onClick={() => updateVariable(variable.name, aiSuggestion)}
                className='flex items-center gap-1'
              >
                <Sparkles className='w-3 h-3' />
                Use AI
              </Button>
            )}
          </div>
          {aiSuggestion && enableAI && (
            <CardDescription className='flex items-center gap-1'>
              <Sparkles className='w-3 h-3' />
              AI suggests: {String(aiSuggestion)}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {variable.type === 'boolean' ? (
            <div className='flex items-center space-x-2'>
              <input
                type='checkbox'
                id={variable.name}
                checked={Boolean(value)}
                onChange={(e) => updateVariable(variable.name, e.target.checked)}
                className='w-4 h-4'
              />
              <label htmlFor={variable.name} className='text-sm'>
                {variable.description || variable.name}
              </label>
            </div>
          ) : variable.type === 'select' && variable.validation?.options ? (
            <select
              value={value}
              onChange={(e) => updateVariable(variable.name, e.target.value)}
              className='w-full p-2 border border-gray-300 rounded-md'
            >
              <option value=''>Select an option...</option>
              {variable.validation.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <Input
              type={variable.type === 'number' ? 'number' : 'text'}
              value={value}
              onChange={(e) => updateVariable(variable.name, e.target.value)}
              placeholder={variable.default ? `Default: ${variable.default}` : ''}
              className={hasErrors ? 'border-red-500' : ''}
            />
          )}

          {hasErrors && (
            <Alert className='mt-2' variant='destructive'>
              <AlertTriangle className='h-4 w-4' />
              <AlertDescription>{errors.join(', ')}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderStepContent = () => {
    switch (state.currentStep) {
      case 'selection':
        return (
          <div className='space-y-6'>
            <div className='text-center'>
              <h2 className='text-2xl font-bold mb-2'>Choose a Template</h2>
              <p className='text-gray-600'>Select a template to generate code for your project</p>
            </div>

            <div className='relative'>
              <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4' />
              <Input
                placeholder='Search templates...'
                value={state.searchQuery}
                onChange={(e) => setState((prev) => ({ ...prev, searchQuery: e.target.value }))}
                className='pl-10'
              />
            </div>

            <ScrollArea className='h-96'>
              <div className='grid gap-4 md:grid-cols-2'>
                {filteredTemplates.map(renderTemplateCard)}
              </div>
            </ScrollArea>

            {filteredTemplates.length === 0 && (
              <div className='text-center py-8 text-gray-500'>
                No templates found matching your search
              </div>
            )}
          </div>
        );

      case 'configuration':
        const variables = state.selectedTemplate?.variables || [];
        return (
          <div className='space-y-6'>
            <div className='flex items-center justify-between'>
              <div>
                <h2 className='text-2xl font-bold'>Configure Variables</h2>
                <p className='text-gray-600'>Set up your template configuration</p>
              </div>
              <Badge variant='outline'>
                {completedVariables}/{totalVariables} completed
              </Badge>
            </div>

            {totalVariables > 0 && (
              <div className='space-y-2'>
                <div className='flex justify-between text-sm text-gray-600'>
                  <span>Progress</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className='w-full' />
              </div>
            )}

            <ScrollArea className='h-96'>
              <div className='space-y-4'>
                {variables.map((variable, index) => renderVariableInput(variable, index))}
              </div>
            </ScrollArea>

            {variables.length === 0 && (
              <div className='text-center py-8 text-gray-500'>
                This template has no configurable variables
              </div>
            )}
          </div>
        );

      case 'preview':
        return (
          <div className='space-y-6'>
            <div className='text-center'>
              <h2 className='text-2xl font-bold mb-2'>Preview Generation</h2>
              <p className='text-gray-600'>Review your configuration before generating</p>
            </div>

            <div className='grid gap-6 md:grid-cols-2'>
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <FileText className='w-4 h-4' />
                    Template
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='space-y-2'>
                    <div className='flex justify-between'>
                      <span className='font-medium'>Name:</span>
                      <span>{state.selectedTemplate?.name}</span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='font-medium'>Version:</span>
                      <span>{state.selectedTemplate?.version}</span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='font-medium'>Files:</span>
                      <span>{state.selectedTemplate?.files?.length || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Folder className='w-4 h-4' />
                    Project
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='space-y-2'>
                    <div className='flex justify-between'>
                      <span className='font-medium'>Path:</span>
                      <span className='text-sm text-gray-600 truncate'>
                        {projectPath || 'Current directory'}
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='font-medium'>Variables:</span>
                      <span>{Object.keys(state.variables).length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className='h-48'>
                  <div className='space-y-3'>
                    {Object.entries(state.variables).map(([key, value]) => (
                      <div key={key} className='flex justify-between items-center'>
                        <span className='font-medium'>{key}:</span>
                        <span className='text-sm text-gray-600 max-w-xs truncate'>
                          {String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`max-w-4xl mx-auto p-6 ${className}`}>
      <Card className='min-h-[600px]'>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <Sparkles className='w-5 h-5 text-blue-500' />
              <CardTitle>Template Wizard</CardTitle>
            </div>
            <div className='flex items-center gap-2'>
              {state.currentStep === 'configuration' && (
                <Button
                  variant='outline'
                  onClick={() => setState((prev) => ({ ...prev, currentStep: 'selection' }))}
                >
                  <ChevronLeft className='w-4 h-4 mr-1' />
                  Back
                </Button>
              )}
              {state.currentStep === 'preview' && (
                <Button
                  variant='outline'
                  onClick={() => setState((prev) => ({ ...prev, currentStep: 'configuration' }))}
                >
                  <ChevronLeft className='w-4 h-4 mr-1' />
                  Back
                </Button>
              )}
              <Button variant='outline' onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className='flex-1'>{renderStepContent()}</CardContent>

        <CardFooter className='flex justify-between'>
          <div className='flex items-center gap-2 text-sm text-gray-600'>
            {state.currentStep === 'configuration' && enableAI && (
              <>
                <Sparkles className='w-3 h-3' />
                AI assistance enabled
              </>
            )}
          </div>

          <div className='flex gap-2'>
            {state.currentStep === 'configuration' && (
              <Button
                onClick={() => setState((prev) => ({ ...prev, currentStep: 'preview' }))}
                disabled={!canProceedToPreview()}
              >
                Preview
                <ChevronRight className='w-4 h-4 ml-1' />
              </Button>
            )}

            {state.currentStep === 'preview' && (
              <Button
                onClick={generateTemplate}
                disabled={state.isGenerating}
                className='flex items-center gap-2'
              >
                {state.isGenerating ? (
                  <>
                    <Loader2 className='w-4 h-4 animate-spin' />
                    Generating...
                  </>
                ) : (
                  <>
                    <CheckCircle className='w-4 h-4' />
                    Generate
                  </>
                )}
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};
