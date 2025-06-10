/**
 * Template Manager Component - Manages code generation templates
 */

import React, { useState, useEffect } from 'react';
import { 
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle 
} from '../../../../client/components/ui/card';
import { Button } from '../../../../client/components/ui/button';
import { Input } from '../../../../client/components/ui/input';
import { Badge } from '../../../../client/components/ui/badge';
import { ScrollArea } from '../../../../client/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../client/components/ui/tabs';
import { useToast } from '../../../../client/components/ui/use-toast';
import {   
  Plus,
  Search,
  Code,
  Edit,
  Trash2,
  Download,
  Upload,
  FileCode,
  Star
  } from 'lucide-react';
import { CodeTemplate } from '../../src/interfaces';
import { useAlfredContext } from '../hooks/useAlfredContext';
// CSS imported at app level

export const TemplateManager: React.FC = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<CodeTemplate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      // This would call the template manager service
      // For now, using mock data
      const mockTemplates: CodeTemplate[] = [
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
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load templates',
        variant: 'destructive'
      });
    } finally {
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

  const handleEditTemplate = (template: CodeTemplate) => {
    // This would open a dialog to edit the template
    toast({
      title: 'Coming soon',
      description: 'Template editing will be implemented'
    });
  };

  const handleDeleteTemplate = async (templateId: string) => {
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

  const handleExportTemplate = (template: CodeTemplate) => {
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

  const getLanguageColor = (language: string): string => {
    const colors: Record<string, string> = {
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Code Templates</h3>
          <p className="text-sm text-muted-foreground">
            Manage your code generation templates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleImportTemplate}
          >
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button
            size="sm"
            onClick={handleCreateTemplate}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList>
          {categories.map(category => (
            <TabsTrigger key={category} value={category}>
              {category === 'all' ? 'All Templates' : category}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={selectedCategory} className="mt-4">
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading templates...</p>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <FileCode className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  {searchQuery ? 'No templates found' : 'No templates in this category'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredTemplates.map((template) => (
                <Card key={template.id} className="relative">
                  {template.id.startsWith('builtin-') && (
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="text-xs">
                        <Star className="h-3 w-3 mr-1" />
                        Built-in
                      </Badge>
                    </div>
                  )}
                  
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-md ${getLanguageColor(template.language)} flex items-center justify-center`}>
                        <Code className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {template.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{template.language}</Badge>
                        <Badge variant="outline">{template.category}</Badge>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {!template.id.startsWith('builtin-') && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditTemplate(template)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteTemplate(template.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExportTemplate(template)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {template.variables && template.variables.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-muted-foreground">
                          Variables: {template.variables.map(v => v.name).join(', ')}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};