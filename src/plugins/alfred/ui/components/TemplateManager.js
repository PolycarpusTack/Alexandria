"use strict";
/**
 * Template Manager Component - Manages code generation templates
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
exports.TemplateManager = void 0;
const react_1 = __importStar(require("react"));
const card_1 = require("../../../../client/components/ui/card");
const button_1 = require("../../../../client/components/ui/button");
const input_1 = require("../../../../client/components/ui/input");
const badge_1 = require("../../../../client/components/ui/badge");
const tabs_1 = require("../../../../client/components/ui/tabs");
const use_toast_1 = require("../../../../client/components/ui/use-toast");
const lucide_react_1 = require("lucide-react");
// CSS imported at app level
const TemplateManager = () => {
    const { toast } = (0, use_toast_1.useToast)();
    const [templates, setTemplates] = (0, react_1.useState)([]);
    const [searchQuery, setSearchQuery] = (0, react_1.useState)('');
    const [selectedCategory, setSelectedCategory] = (0, react_1.useState)('all');
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    (0, react_1.useEffect)(() => {
        loadTemplates();
    }, []);
    const loadTemplates = async () => {
        setIsLoading(true);
        try {
            // This would call the template manager service
            // For now, using mock data
            const mockTemplates = [
                {
                    id: 'builtin-python-class',
                    name: 'Python Class',
                    description: 'Basic Python class with constructor',
                    language: 'python',
                    category: 'Basic',
                    variables: [],
                    template: 'class {{className}}:\n    pass',
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                {
                    id: 'builtin-react-component',
                    name: 'React Component',
                    description: 'React functional component',
                    language: 'typescript',
                    category: 'React',
                    variables: [],
                    template: 'const {{componentName}} = () => {\n  return <div></div>\n}',
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ];
            setTemplates(mockTemplates);
        }
        catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to load templates',
                variant: 'destructive'
            });
        }
        finally {
            setIsLoading(false);
        }
    };
    const filteredTemplates = templates.filter(template => {
        const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            template.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });
    const categories = ['all', ...Array.from(new Set(templates.map(t => t.category)))];
    const handleCreateTemplate = () => {
        // This would open a dialog to create a new template
        toast({
            title: 'Coming soon',
            description: 'Template creation dialog will be implemented'
        });
    };
    const handleEditTemplate = (template) => {
        // This would open a dialog to edit the template
        toast({
            title: 'Coming soon',
            description: 'Template editing will be implemented'
        });
    };
    const handleDeleteTemplate = async (templateId) => {
        // This would delete the template
        toast({
            title: 'Template deleted',
            description: 'The template has been removed'
        });
        loadTemplates();
    };
    const handleImportTemplate = () => {
        // This would open a file picker to import templates
        toast({
            title: 'Coming soon',
            description: 'Template import will be implemented'
        });
    };
    const handleExportTemplate = (template) => {
        // This would export the template as JSON
        const data = JSON.stringify(template, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${template.name.toLowerCase().replace(/\s+/g, '-')}-template.json`;
        a.click();
        URL.revokeObjectURL(url);
    };
    const getLanguageColor = (language) => {
        const colors = {
            python: 'bg-blue-500',
            javascript: 'bg-yellow-500',
            typescript: 'bg-blue-600',
            java: 'bg-red-500',
            csharp: 'bg-purple-500',
            go: 'bg-cyan-500',
            rust: 'bg-orange-500'
        };
        return colors[language.toLowerCase()] || 'bg-gray-500';
    };
    return (react_1.default.createElement("div", { className: "space-y-4" },
        react_1.default.createElement("div", { className: "flex items-center justify-between" },
            react_1.default.createElement("div", null,
                react_1.default.createElement("h3", { className: "text-lg font-medium" }, "Code Templates"),
                react_1.default.createElement("p", { className: "text-sm text-muted-foreground" }, "Manage your code generation templates")),
            react_1.default.createElement("div", { className: "flex items-center gap-2" },
                react_1.default.createElement(button_1.Button, { variant: "outline", size: "sm", onClick: handleImportTemplate },
                    react_1.default.createElement(lucide_react_1.Upload, { className: "h-4 w-4 mr-2" }),
                    "Import"),
                react_1.default.createElement(button_1.Button, { size: "sm", onClick: handleCreateTemplate },
                    react_1.default.createElement(lucide_react_1.Plus, { className: "h-4 w-4 mr-2" }),
                    "New Template"))),
        react_1.default.createElement("div", { className: "flex items-center gap-4" },
            react_1.default.createElement("div", { className: "relative flex-1" },
                react_1.default.createElement(lucide_react_1.Search, { className: "absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" }),
                react_1.default.createElement(input_1.Input, { placeholder: "Search templates...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), className: "pl-8" }))),
        react_1.default.createElement(tabs_1.Tabs, { value: selectedCategory, onValueChange: setSelectedCategory },
            react_1.default.createElement(tabs_1.TabsList, null, categories.map(category => (react_1.default.createElement(tabs_1.TabsTrigger, { key: category, value: category }, category === 'all' ? 'All Templates' : category)))),
            react_1.default.createElement(tabs_1.TabsContent, { value: selectedCategory, className: "mt-4" }, isLoading ? (react_1.default.createElement("div", { className: "text-center py-8" },
                react_1.default.createElement("p", { className: "text-muted-foreground" }, "Loading templates..."))) : filteredTemplates.length === 0 ? (react_1.default.createElement(card_1.Card, null,
                react_1.default.createElement(card_1.CardContent, { className: "text-center py-8" },
                    react_1.default.createElement(lucide_react_1.FileCode, { className: "h-12 w-12 mx-auto mb-4 text-muted-foreground" }),
                    react_1.default.createElement("p", { className: "text-muted-foreground" }, searchQuery ? 'No templates found' : 'No templates in this category')))) : (react_1.default.createElement("div", { className: "grid gap-4 md:grid-cols-2" }, filteredTemplates.map((template) => (react_1.default.createElement(card_1.Card, { key: template.id, className: "relative" },
                template.id.startsWith('builtin-') && (react_1.default.createElement("div", { className: "absolute top-2 right-2" },
                    react_1.default.createElement(badge_1.Badge, { variant: "secondary", className: "text-xs" },
                        react_1.default.createElement(lucide_react_1.Star, { className: "h-3 w-3 mr-1" }),
                        "Built-in"))),
                react_1.default.createElement(card_1.CardHeader, null,
                    react_1.default.createElement("div", { className: "flex items-start gap-3" },
                        react_1.default.createElement("div", { className: `w-10 h-10 rounded-md ${getLanguageColor(template.language)} flex items-center justify-center` },
                            react_1.default.createElement(lucide_react_1.Code, { className: "h-5 w-5 text-white" })),
                        react_1.default.createElement("div", { className: "flex-1" },
                            react_1.default.createElement(card_1.CardTitle, { className: "text-base" }, template.name),
                            react_1.default.createElement(card_1.CardDescription, { className: "mt-1" }, template.description)))),
                react_1.default.createElement(card_1.CardContent, null,
                    react_1.default.createElement("div", { className: "flex items-center justify-between" },
                        react_1.default.createElement("div", { className: "flex items-center gap-2" },
                            react_1.default.createElement(badge_1.Badge, { variant: "outline" }, template.language),
                            react_1.default.createElement(badge_1.Badge, { variant: "outline" }, template.category)),
                        react_1.default.createElement("div", { className: "flex items-center gap-1" },
                            !template.id.startsWith('builtin-') && (react_1.default.createElement(react_1.default.Fragment, null,
                                react_1.default.createElement(button_1.Button, { variant: "ghost", size: "sm", onClick: () => handleEditTemplate(template) },
                                    react_1.default.createElement(lucide_react_1.Edit, { className: "h-4 w-4" })),
                                react_1.default.createElement(button_1.Button, { variant: "ghost", size: "sm", onClick: () => handleDeleteTemplate(template.id) },
                                    react_1.default.createElement(lucide_react_1.Trash2, { className: "h-4 w-4" })))),
                            react_1.default.createElement(button_1.Button, { variant: "ghost", size: "sm", onClick: () => handleExportTemplate(template) },
                                react_1.default.createElement(lucide_react_1.Download, { className: "h-4 w-4" })))),
                    template.variables && template.variables.length > 0 && (react_1.default.createElement("div", { className: "mt-3 pt-3 border-t" },
                        react_1.default.createElement("p", { className: "text-xs text-muted-foreground" },
                            "Variables: ",
                            template.variables.map(v => v.name).join(', '))))))))))))));
};
exports.TemplateManager = TemplateManager;
