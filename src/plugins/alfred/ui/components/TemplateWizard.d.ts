/**
 * Template Wizard Component
 *
 * Interactive project scaffolding wizard based on original Alfred's template system
 */
import React from 'react';
export interface ProjectTemplate {
    id: string;
    name: string;
    description: string;
    category: 'web' | 'api' | 'microservice' | 'cli' | 'library' | 'fullstack';
    icon: React.ComponentType<{
        className?: string;
    }>;
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
    options?: {
        value: string;
        label: string;
    }[];
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
export declare const TemplateWizard: React.FC<TemplateWizardProps>;
export {};
