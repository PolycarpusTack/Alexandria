import React, { useState, useEffect } from 'react';
import { AlexandriaComponent, useWorkspace, useTheme } from '@alexandria/ui';
import { Template, TemplateCategory } from '../types';
import { TemplateService } from '../services/TemplateService';

export const TemplateExplorer: React.FC = () => {
  const [templates, setTemplates] = useState<TemplateCategory[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const workspace = useWorkspace();
  const theme = useTheme();
  
  useEffect(() => {
    loadTemplates();
  }, [workspace]);
  
  const loadTemplates = async () => {
    const service = new TemplateService(workspace);
    const categories = await service.getTemplatesByCategory();
    setTemplates(categories);
  };
  
  const filteredTemplates = templates.map(category => ({
    ...category,
    templates: category.templates.filter(t => 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.templates.length > 0);
  
  return (
    <AlexandriaComponent className="template-explorer">
      {/* Component content continues... */}
    </AlexandriaComponent>
  );
};