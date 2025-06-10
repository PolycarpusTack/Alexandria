"use strict";
/**
 * Template Wizard Component
 *
 * Interactive project scaffolding wizard based on original Alfred's template system
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateWizard = void 0;
const react_1 = __importStar(require("react"));
const dialog_1 = require("../../../../client/components/ui/dialog");
const button_1 = require("../../../../client/components/ui/button");
const input_1 = require("../../../../client/components/ui/input");
const label_1 = require("../../../../client/components/ui/label");
const select_1 = require("../../../../client/components/ui/select");
const card_1 = require("../../../../client/components/ui/card");
const progress_1 = require("../../../../client/components/ui/progress");
const badge_1 = require("../../../../client/components/ui/badge");
const lucide_react_1 = require("lucide-react");
// Default project templates based on original Alfred
const defaultTemplates = [
    {
        id: 'react-app',
        name: 'React Application',
        description: 'Modern React app with TypeScript, Vite, and Tailwind CSS',
        category: 'web',
        icon: lucide_react_1.Globe,
        technologies: ['React', 'TypeScript', 'Vite', 'Tailwind CSS'],
        variables: [
            {
                name: 'projectName',
                label: 'Project Name',
                type: 'text',
                required: true,
                validation: (value) => {
                    if (!value)
                        return 'Project name is required';
                    if (!/^[a-z0-9-]+$/.test(value))
                        return 'Use lowercase letters, numbers, and hyphens only';
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
        icon: lucide_react_1.Server,
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
        icon: lucide_react_1.Layers,
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
const wizardSteps = [
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
const TemplateWizard = ({ open, onClose, onComplete, templates = defaultTemplates }) => {
    const [currentStep, setCurrentStep] = (0, react_1.useState)(0);
    const [selectedTemplate, setSelectedTemplate] = (0, react_1.useState)(null);
    const [variables, setVariables] = (0, react_1.useState)({});
    const [errors, setErrors] = (0, react_1.useState)({});
    // Reset wizard when opened
    (0, react_1.useEffect)(() => {
        if (open) {
            setCurrentStep(0);
            setSelectedTemplate(null);
            setVariables({});
            setErrors({});
        }
    }, [open]);
    // Initialize variables when template is selected
    (0, react_1.useEffect)(() => {
        if (selectedTemplate) {
            const initialVars = {};
            selectedTemplate.variables.forEach(v => {
                if (v.default !== undefined) {
                    initialVars[v.name] = v.default;
                }
            });
            setVariables(initialVars);
        }
    }, [selectedTemplate]);
    const validateStep = () => {
        if (currentStep === 0) {
            return selectedTemplate !== null;
        }
        if (currentStep === 1 && selectedTemplate) {
            const newErrors = {};
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
            }
            else {
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
            web: lucide_react_1.Globe,
            api: lucide_react_1.Server,
            microservice: lucide_react_1.Layers,
            cli: lucide_react_1.Code,
            library: lucide_react_1.Package,
            fullstack: lucide_react_1.Database
        };
        return (react_1.default.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4" }, templates.map(template => {
            const Icon = template.icon || categoryIcons[template.category];
            return (react_1.default.createElement(card_1.Card, { key: template.id, className: `cursor-pointer transition-all ${selectedTemplate?.id === template.id
                    ? 'ring-2 ring-primary'
                    : 'hover:shadow-lg'}`, onClick: () => setSelectedTemplate(template) },
                react_1.default.createElement("div", { className: "p-6" },
                    react_1.default.createElement("div", { className: "flex items-start gap-4" },
                        react_1.default.createElement("div", { className: "p-3 bg-primary/10 rounded-lg" },
                            react_1.default.createElement(Icon, { className: "h-6 w-6 text-primary" })),
                        react_1.default.createElement("div", { className: "flex-1" },
                            react_1.default.createElement("h3", { className: "font-semibold text-lg" }, template.name),
                            react_1.default.createElement("p", { className: "text-sm text-muted-foreground mt-1" }, template.description),
                            react_1.default.createElement("div", { className: "flex flex-wrap gap-2 mt-3" }, template.technologies.map(tech => (react_1.default.createElement(badge_1.Badge, { key: tech, variant: "secondary", className: "text-xs" }, tech))))),
                        selectedTemplate?.id === template.id && (react_1.default.createElement(lucide_react_1.CheckCircle, { className: "h-5 w-5 text-primary" }))))));
        })));
    };
    const renderConfiguration = () => {
        if (!selectedTemplate)
            return null;
        return (react_1.default.createElement("div", { className: "space-y-6" }, selectedTemplate.variables.map(variable => (react_1.default.createElement("div", { key: variable.name, className: "space-y-2" },
            react_1.default.createElement(label_1.Label, { htmlFor: variable.name },
                variable.label,
                variable.required && react_1.default.createElement("span", { className: "text-red-500 ml-1" }, "*")),
            variable.description && (react_1.default.createElement("p", { className: "text-sm text-muted-foreground" }, variable.description)),
            variable.type === 'text' && (react_1.default.createElement(input_1.Input, { id: variable.name, value: variables[variable.name] || '', onChange: (e) => setVariables({
                    ...variables,
                    [variable.name]: e.target.value
                }), className: errors[variable.name] ? 'border-red-500' : '' })),
            variable.type === 'select' && (react_1.default.createElement(select_1.Select, { value: variables[variable.name] || '', onValueChange: (value) => setVariables({
                    ...variables,
                    [variable.name]: value
                }) },
                react_1.default.createElement(select_1.Select.Trigger, { className: errors[variable.name] ? 'border-red-500' : '' },
                    react_1.default.createElement(select_1.Select.Value, { placeholder: "Select an option" })),
                react_1.default.createElement(select_1.Select.Content, null, variable.options?.map(option => (react_1.default.createElement(select_1.Select.Item, { key: option.value, value: option.value }, option.label)))))),
            variable.type === 'boolean' && (react_1.default.createElement("div", { className: "flex items-center space-x-2" },
                react_1.default.createElement("input", { type: "checkbox", id: variable.name, checked: variables[variable.name] || false, onChange: (e) => setVariables({
                        ...variables,
                        [variable.name]: e.target.checked
                    }), className: "h-4 w-4" }),
                react_1.default.createElement(label_1.Label, { htmlFor: variable.name, className: "cursor-pointer" },
                    "Enable ",
                    variable.label))),
            errors[variable.name] && (react_1.default.createElement("p", { className: "text-sm text-red-500" }, errors[variable.name])))))));
    };
    const renderReview = () => {
        if (!selectedTemplate)
            return null;
        return (react_1.default.createElement("div", { className: "space-y-6" },
            react_1.default.createElement("div", null,
                react_1.default.createElement("h3", { className: "font-semibold mb-2" }, "Selected Template"),
                react_1.default.createElement(card_1.Card, { className: "p-4" },
                    react_1.default.createElement("div", { className: "flex items-center gap-3" },
                        react_1.default.createElement(selectedTemplate.icon, { className: "h-5 w-5 text-primary" }),
                        react_1.default.createElement("div", null,
                            react_1.default.createElement("p", { className: "font-medium" }, selectedTemplate.name),
                            react_1.default.createElement("p", { className: "text-sm text-muted-foreground" }, selectedTemplate.description))))),
            react_1.default.createElement("div", null,
                react_1.default.createElement("h3", { className: "font-semibold mb-2" }, "Configuration"),
                react_1.default.createElement(card_1.Card, { className: "p-4 space-y-2" }, selectedTemplate.variables.map(variable => {
                    const value = variables[variable.name];
                    if (value === undefined || value === '')
                        return null;
                    return (react_1.default.createElement("div", { key: variable.name, className: "flex justify-between" },
                        react_1.default.createElement("span", { className: "text-muted-foreground" },
                            variable.label,
                            ":"),
                        react_1.default.createElement("span", { className: "font-medium" }, typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value)));
                }))),
            react_1.default.createElement("div", { className: "flex items-center gap-2 p-4 bg-primary/10 rounded-lg" },
                react_1.default.createElement(lucide_react_1.Wand2, { className: "h-5 w-5 text-primary" }),
                react_1.default.createElement("p", { className: "text-sm" }, "Ready to create your project! Click \"Create Project\" to generate the files."))));
    };
    const currentStepData = wizardSteps[currentStep];
    const progress = ((currentStep + 1) / wizardSteps.length) * 100;
    return (react_1.default.createElement(dialog_1.Dialog, { open: open, onOpenChange: onClose },
        react_1.default.createElement(dialog_1.Dialog.Content, { className: "max-w-4xl max-h-[80vh] overflow-hidden flex flex-col" },
            react_1.default.createElement(dialog_1.Dialog.Header, null,
                react_1.default.createElement(dialog_1.Dialog.Title, { className: "flex items-center gap-2" },
                    react_1.default.createElement(lucide_react_1.Wand2, { className: "h-5 w-5" }),
                    "Project Template Wizard")),
            react_1.default.createElement("div", { className: "px-6 py-2" },
                react_1.default.createElement(progress_1.Progress, { value: progress, className: "h-2" }),
                react_1.default.createElement("div", { className: "flex justify-between mt-2" }, wizardSteps.map((step, index) => (react_1.default.createElement("div", { key: step.id, className: `text-sm ${index <= currentStep ? 'text-primary' : 'text-muted-foreground'}` }, step.title))))),
            react_1.default.createElement("div", { className: "flex-1 overflow-y-auto px-6 py-4" },
                react_1.default.createElement("div", { className: "mb-6" },
                    react_1.default.createElement("h2", { className: "text-xl font-semibold" }, currentStepData.title),
                    react_1.default.createElement("p", { className: "text-muted-foreground" }, currentStepData.description)),
                currentStep === 0 && renderTemplateSelection(),
                currentStep === 1 && renderConfiguration(),
                currentStep === 2 && renderReview()),
            react_1.default.createElement(dialog_1.Dialog.Footer, { className: "px-6 py-4 border-t" },
                react_1.default.createElement("div", { className: "flex justify-between w-full" },
                    react_1.default.createElement(button_1.Button, { variant: "outline", onClick: handleBack, disabled: currentStep === 0 },
                        react_1.default.createElement(lucide_react_1.ChevronLeft, { className: "h-4 w-4 mr-2" }),
                        "Back"),
                    react_1.default.createElement("div", { className: "flex gap-2" },
                        react_1.default.createElement(button_1.Button, { variant: "outline", onClick: onClose }, "Cancel"),
                        react_1.default.createElement(button_1.Button, { onClick: handleNext }, currentStep === wizardSteps.length - 1 ? (react_1.default.createElement(react_1.default.Fragment, null,
                            "Create Project",
                            react_1.default.createElement(lucide_react_1.CheckCircle, { className: "h-4 w-4 ml-2" }))) : (react_1.default.createElement(react_1.default.Fragment, null,
                            "Next",
                            react_1.default.createElement(lucide_react_1.ChevronRight, { className: "h-4 w-4 ml-2" }))))))))));
};
exports.TemplateWizard = TemplateWizard;
