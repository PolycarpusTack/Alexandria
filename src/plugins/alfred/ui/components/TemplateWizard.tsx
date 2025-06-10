/**
 * Template Wizard Component
 * 
 * Interactive project scaffolding wizard based on original Alfred's template system
 */

import React, { useState, useEffect } from 'react';
import DialogCompound from '../../../../client/components/ui/dialog';
import { Button } from '../../../../client/components/ui/button';
import { Input } from '../../../../client/components/ui/input';
import { Label } from '../../../../client/components/ui/label';
import { Select } from '../../../../client/components/ui/select';
import { Textarea } from '../../../../client/components/ui/textarea';
import { Card } from '../../../../client/components/ui/card';
import { Progress } from '../../../../client/components/ui/progress';
import { Badge } from '../../../../client/components/ui/badge';
import {
  ChevronRight,
  ChevronLeft,
  Wand2,
  FileCode,
  Settings,
  Package,
  CheckCircle,
  Code,
  Globe,
  Server,
  Database,
  Layers,
  GitBranch,
  FolderOpen
} from '../../../../client/components/ui/icon-fallbacks';

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: 'web' | 'api' | 'microservice' | 'cli' | 'library' | 'fullstack';
  icon: React.ComponentType<{ className?: string }>;
  technologies: string[];
  variables: TemplateVariable[];
  files: TemplateFile[];
}

export interface TemplateVariable {
  name: string;
  label: string;
  type: 'text' | 'select' | 'boolean' | 'number';
  default?: any;
  required?: boolean;
  options?: { value: string; label: string }[];
  description?: string;
  validation?: (value: any) => string | null;
}

export interface TemplateFile {
  path: string;
  content: string;
  condition?: (vars: Record<string, any>) => boolean;
}

export interface WizardStep {
  id: string;
  title: string;
  description: string;
}

interface TemplateWizardProps {
  open: boolean;
  onClose: () => void;
  onComplete: (template: ProjectTemplate, variables: Record<string, any>) => void;
  templates?: ProjectTemplate[];
}

// Default project templates based on original Alfred
const defaultTemplates: ProjectTemplate[] = [
  {
    id: 'react-app',
    name: 'React Application',
    description: 'Modern React app with TypeScript, Vite, and Tailwind CSS',
    category: 'web',
    icon: Globe,
    technologies: ['React', 'TypeScript', 'Vite', 'Tailwind CSS'],
    variables: [
      {
        name: 'projectName',
        label: 'Project Name',
        type: 'text',
        required: true,
        validation: (value) => {
          if (!value) return 'Project name is required';
          if (!/^[a-z0-9-]+$/.test(value)) return 'Use lowercase letters, numbers, and hyphens only';
          return null;
        }
      },
      {
        name: 'description',
        label: 'Description',
        type: 'text',
        default: 'A React TypeScript application'
      },
      {
        name: 'features',
        label: 'Features',
        type: 'select',
        options: [
          { value: 'router', label: 'React Router' },
          { value: 'state', label: 'State Management (Zustand)' },
          { value: 'forms', label: 'Form Handling (React Hook Form)' },
          { value: 'testing', label: 'Testing (Vitest + RTL)' }
        ]
      },
      {
        name: 'authentication',
        label: 'Include Authentication?',
        type: 'boolean',
        default: false
      }
    ],
    files: []
  },
  {
    id: 'express-api',
    name: 'Express API',
    description: 'RESTful API with Express, TypeScript, and PostgreSQL',
    category: 'api',
    icon: Server,
    technologies: ['Express', 'TypeScript', 'PostgreSQL', 'JWT'],
    variables: [
      {
        name: 'projectName',
        label: 'Project Name',
        type: 'text',
        required: true
      },
      {
        name: 'database',
        label: 'Database',
        type: 'select',
        default: 'postgresql',
        options: [
          { value: 'postgresql', label: 'PostgreSQL' },
          { value: 'mysql', label: 'MySQL' },
          { value: 'mongodb', label: 'MongoDB' },
          { value: 'sqlite', label: 'SQLite' }
        ]
      },
      {
        name: 'authentication',
        label: 'Authentication Type',
        type: 'select',
        default: 'jwt',
        options: [
          { value: 'none', label: 'None' },
          { value: 'jwt', label: 'JWT' },
          { value: 'oauth', label: 'OAuth 2.0' },
          { value: 'apikey', label: 'API Key' }
        ]
      }
    ],
    files: []
  },
  {
    id: 'microservice',
    name: 'Microservice',
    description: 'Cloud-native microservice with Docker and Kubernetes support',
    category: 'microservice',
    icon: Layers,
    technologies: ['Node.js', 'Docker', 'Kubernetes', 'gRPC'],
    variables: [
      {
        name: 'serviceName',
        label: 'Service Name',
        type: 'text',
        required: true
      },
      {
        name: 'protocol',
        label: 'Communication Protocol',
        type: 'select',
        default: 'rest',
        options: [
          { value: 'rest', label: 'REST' },
          { value: 'grpc', label: 'gRPC' },
          { value: 'graphql', label: 'GraphQL' },
          { value: 'websocket', label: 'WebSocket' }
        ]
      },
      {
        name: 'monitoring',
        label: 'Include Monitoring?',
        type: 'boolean',
        default: true,
        description: 'Prometheus metrics and health checks'
      }
    ],
    files: []
  }
];

const wizardSteps: WizardStep[] = [
  {
    id: 'template',
    title: 'Choose Template',
    description: 'Select a project template to start with'
  },
  {
    id: 'configure',
    title: 'Configure Project',
    description: 'Customize your project settings'
  },
  {
    id: 'review',
    title: 'Review & Create',
    description: 'Review your configuration'
  }
];

export const TemplateWizard: React.FC<TemplateWizardProps> = ({
  open,
  onClose,
  onComplete,
  templates = defaultTemplates
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  const [variables, setVariables] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset wizard when opened
  useEffect(() => {
    if (open) {
      setCurrentStep(0);
      setSelectedTemplate(null);
      setVariables({});
      setErrors({});
    }
  }, [open]);

  // Initialize variables when template is selected
  useEffect(() => {
    if (selectedTemplate) {
      const initialVars: Record<string, any> = {};
      selectedTemplate.variables.forEach(v => {
        if (v.default !== undefined) {
          initialVars[v.name] = v.default;
        }
      });
      setVariables(initialVars);
    }
  }, [selectedTemplate]);

  const validateStep = (): boolean => {
    if (currentStep === 0) {
      return selectedTemplate !== null;
    }
    
    if (currentStep === 1 && selectedTemplate) {
      const newErrors: Record<string, string> = {};
      let isValid = true;
      
      selectedTemplate.variables.forEach(variable => {
        if (variable.required && !variables[variable.name]) {
          newErrors[variable.name] = `${variable.label} is required`;
          isValid = false;
        }
        
        if (variable.validation && variables[variable.name]) {
          const error = variable.validation(variables[variable.name]);
          if (error) {
            newErrors[variable.name] = error;
            isValid = false;
          }
        }
      });
      
      setErrors(newErrors);
      return isValid;
    }
    
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      if (currentStep < wizardSteps.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        // Complete wizard
        if (selectedTemplate) {
          onComplete(selectedTemplate, variables);
        }
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderTemplateSelection = () => {
    const categoryIcons = {
      web: Globe,
      api: Server,
      microservice: Layers,
      cli: Code,
      library: Package,
      fullstack: Database
    };

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map(template => {
          const Icon = template.icon || categoryIcons[template.category];
          return (
            <Card
              key={template.id}
              className={`cursor-pointer transition-all ${
                selectedTemplate?.id === template.id 
                  ? 'ring-2 ring-primary' 
                  : 'hover:shadow-lg'
              }`}
              onClick={() => setSelectedTemplate(template)}
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{template.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {template.description}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {template.technologies.map(tech => (
                        <Badge key={tech} variant="secondary" className="text-xs">
                          {tech}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {selectedTemplate?.id === template.id && (
                    <CheckCircle className="h-5 w-5 text-primary" />
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderConfiguration = () => {
    if (!selectedTemplate) return null;

    return (
      <div className="space-y-6">
        {selectedTemplate.variables.map(variable => (
          <div key={variable.name} className="space-y-2">
            <Label htmlFor={variable.name}>
              {variable.label}
              {variable.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            
            {variable.description && (
              <p className="text-sm text-muted-foreground">{variable.description}</p>
            )}
            
            {variable.type === 'text' && (
              <Input
                id={variable.name}
                value={variables[variable.name] || ''}
                onChange={(e) => setVariables({
                  ...variables,
                  [variable.name]: e.target.value
                })}
                className={errors[variable.name] ? 'border-red-500' : ''}
              />
            )}
            
            {variable.type === 'select' && (
              <Select
                value={variables[variable.name] || ''}
                onValueChange={(value) => setVariables({
                  ...variables,
                  [variable.name]: value
                })}
              >
                <Select.Trigger className={errors[variable.name] ? 'border-red-500' : ''}>
                  <Select.Value placeholder="Select an option" />
                </Select.Trigger>
                <Select.Content>
                  {variable.options?.map(option => (
                    <Select.Item key={option.value} value={option.value}>
                      {option.label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            )}
            
            {variable.type === 'boolean' && (
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={variable.name}
                  checked={variables[variable.name] || false}
                  onChange={(e) => setVariables({
                    ...variables,
                    [variable.name]: e.target.checked
                  })}
                  className="h-4 w-4"
                />
                <Label htmlFor={variable.name} className="cursor-pointer">
                  Enable {variable.label}
                </Label>
              </div>
            )}
            
            {errors[variable.name] && (
              <p className="text-sm text-red-500">{errors[variable.name]}</p>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderReview = () => {
    if (!selectedTemplate) return null;

    return (
      <div className="space-y-6">
        <div>
          <h3 className="font-semibold mb-2">Selected Template</h3>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <selectedTemplate.icon className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">{selectedTemplate.name}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedTemplate.description}
                </p>
              </div>
            </div>
          </Card>
        </div>
        
        <div>
          <h3 className="font-semibold mb-2">Configuration</h3>
          <Card className="p-4 space-y-2">
            {selectedTemplate.variables.map(variable => {
              const value = variables[variable.name];
              if (value === undefined || value === '') return null;
              
              return (
                <div key={variable.name} className="flex justify-between">
                  <span className="text-muted-foreground">{variable.label}:</span>
                  <span className="font-medium">
                    {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}
                  </span>
                </div>
              );
            })}
          </Card>
        </div>
        
        <div className="flex items-center gap-2 p-4 bg-primary/10 rounded-lg">
          <Wand2 className="h-5 w-5 text-primary" />
          <p className="text-sm">
            Ready to create your project! Click "Create Project" to generate the files.
          </p>
        </div>
      </div>
    );
  };

  const currentStepData = wizardSteps[currentStep];
  const progress = ((currentStep + 1) / wizardSteps.length) * 100;

  return (
    <DialogCompound open={open} onOpenChange={onClose}>
      <DialogCompound.Content className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogCompound.Header>
          <DialogCompound.Title className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Project Template Wizard
          </DialogCompound.Title>
        </DialogCompound.Header>
        
        <div className="px-6 py-2">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between mt-2">
            {wizardSteps.map((step, index) => (
              <div
                key={step.id}
                className={`text-sm ${
                  index <= currentStep ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {step.title}
              </div>
            ))}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-6">
            <h2 className="text-xl font-semibold">{currentStepData.title}</h2>
            <p className="text-muted-foreground">{currentStepData.description}</p>
          </div>
          
          {currentStep === 0 && renderTemplateSelection()}
          {currentStep === 1 && renderConfiguration()}
          {currentStep === 2 && renderReview()}
        </div>
        
        <DialogCompound.Footer className="px-6 py-4 border-t">
          <div className="flex justify-between w-full">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleNext}>
                {currentStep === wizardSteps.length - 1 ? (
                  <>
                    Create Project
                    <CheckCircle className="h-4 w-4 ml-2" />
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogCompound.Footer>
      </DialogCompound.Content>
    </DialogCompound>
  );
};