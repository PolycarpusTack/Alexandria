import React, { useState } from 'react';
import { 
  FileText, 
  Plus, 
  Edit, 
  Trash2, 
  Copy,
  Save,
  X,
  Code,
  BookOpen,
  Briefcase,
  Calendar,
  Target,
  Users
} from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  content: string;
  fields: string[];
  usageCount: number;
}

const TemplateManager: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([
    {
      id: '1',
      name: 'Meeting Notes',
      description: 'Capture meeting discussions and action items',
      icon: 'users',
      category: 'Business',
      content: '# Meeting: {{title}}\n\n**Date:** {{date}}\n**Attendees:** {{attendees}}\n\n## Agenda\n{{agenda}}\n\n## Discussion\n{{discussion}}\n\n## Action Items\n- [ ] {{action1}}\n- [ ] {{action2}}\n\n## Next Steps\n{{nextSteps}}',
      fields: ['title', 'date', 'attendees', 'agenda', 'discussion', 'action1', 'action2', 'nextSteps'],
      usageCount: 142
    },
    {
      id: '2',
      name: 'Project Overview',
      description: 'Document project goals, scope, and milestones',
      icon: 'briefcase',
      category: 'Project Management',
      content: '# Project: {{projectName}}\n\n## Overview\n{{overview}}\n\n## Goals\n{{goals}}\n\n## Scope\n{{scope}}\n\n## Timeline\n{{timeline}}\n\n## Resources\n{{resources}}',
      fields: ['projectName', 'overview', 'goals', 'scope', 'timeline', 'resources'],
      usageCount: 89
    },
    {
      id: '3',
      name: 'Code Snippet',
      description: 'Save and document code snippets',
      icon: 'code',
      category: 'Development',
      content: '# {{title}}\n\n**Language:** {{language}}\n**Purpose:** {{purpose}}\n\n```{{language}}\n{{code}}\n```\n\n## Usage\n{{usage}}\n\n## Notes\n{{notes}}',
      fields: ['title', 'language', 'purpose', 'code', 'usage', 'notes'],
      usageCount: 234
    }
  ]);

  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', 'Business', 'Project Management', 'Development', 'Personal', 'Research'];

  const iconMap: Record<string, React.ReactNode> = {
    users: <Users className="h-5 w-5" />,
    briefcase: <Briefcase className="h-5 w-5" />,
    code: <Code className="h-5 w-5" />,
    calendar: <Calendar className="h-5 w-5" />,
    target: <Target className="h-5 w-5" />,
    bookopen: <BookOpen className="h-5 w-5" />
  };

  const handleCreateNew = () => {
    const newTemplate: Template = {
      id: Date.now().toString(),
      name: 'New Template',
      description: 'Template description',
      icon: 'filetext',
      category: 'Personal',
      content: '# {{title}}\n\n{{content}}',
      fields: ['title', 'content'],
      usageCount: 0
    };
    setEditingTemplate(newTemplate);
    setIsEditing(true);
  };

  const handleSaveTemplate = () => {
    if (!editingTemplate) return;

    if (templates.find(t => t.id === editingTemplate.id)) {
      setTemplates(templates.map(t => t.id === editingTemplate.id ? editingTemplate : t));
    } else {
      setTemplates([...templates, editingTemplate]);
    }
    
    setIsEditing(false);
    setEditingTemplate(null);
  };

  const handleDeleteTemplate = (id: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      setTemplates(templates.filter(t => t.id !== id));
    }
  };

  const handleUseTemplate = (template: Template) => {
    // Navigate to create new node with this template
    window.location.href = `/mnemosyne/nodes/new?template=${template.id}`;
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="h-full flex">
      {/* Template List */}
      <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Templates
            </h1>
            <button
              onClick={handleCreateNew}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1 text-sm"
            >
              <Plus className="h-4 w-4" />
              New
            </button>
          </div>
          
          {/* Search */}
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
          />
        </div>

        {/* Category Tabs */}
        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-2 overflow-x-auto">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 text-sm rounded-full whitespace-nowrap ${
                  selectedCategory === category
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Template List */}
        <div className="flex-1 overflow-auto">
          {filteredTemplates.map(template => (
            <div
              key={template.id}
              onClick={() => setSelectedTemplate(template)}
              className={`p-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${
                selectedTemplate?.id === template.id ? 'bg-gray-50 dark:bg-gray-800' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  {iconMap[template.icon] || <FileText className="h-5 w-5" />}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">
                    {template.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {template.description}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>{template.category}</span>
                    <span>Used {template.usageCount} times</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Template Details/Editor */}
      <div className="flex-1 flex flex-col">
        {isEditing && editingTemplate ? (
          /* Edit Mode */
          <div className="flex-1 p-6">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {editingTemplate.id ? 'Edit Template' : 'Create Template'}
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveTemplate}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditingTemplate(null);
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Template Form */}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={editingTemplate.name}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={editingTemplate.description}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Category
                  </label>
                  <select
                    value={editingTemplate.category}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                  >
                    {categories.filter(c => c !== 'all').map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Template Content
                  </label>
                  <textarea
                    value={editingTemplate.content}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, content: e.target.value })}
                    className="w-full h-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 font-mono text-sm"
                    placeholder="Use {{fieldName}} for template variables"
                  />
                </div>
              </div>
            </div>
          </div>
        ) : selectedTemplate ? (
          /* View Mode */
          <div className="flex-1 p-6">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                    {selectedTemplate.name}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    {selectedTemplate.description}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleUseTemplate(selectedTemplate)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Use Template
                  </button>
                  <button
                    onClick={() => {
                      setEditingTemplate(selectedTemplate);
                      setIsEditing(true);
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(selectedTemplate.id)}
                    className="px-4 py-2 border border-red-300 dark:border-red-600 text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mb-6">
                <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-sm">
                  {selectedTemplate.category}
                </span>
                <span className="ml-4 text-sm text-gray-500">
                  Used {selectedTemplate.usageCount} times
                </span>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  Template Variables
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selectedTemplate.fields.map(field => (
                    <span
                      key={field}
                      className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-sm"
                    >
                      {`{{${field}}}`}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  Preview
                </h3>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <pre className="whitespace-pre-wrap font-mono text-sm text-gray-700 dark:text-gray-300">
                    {selectedTemplate.content}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                Select a template to view details
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplateManager;