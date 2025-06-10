import React, { useState, useEffect } from 'react';
import { 
  useMnemosyne, 
  useAlfred, 
  useKnowledgeGraph 
} from '@alexandria/mnemosyne-sdk';
import { Template, TemplateCategory } from '../types';
import { TemplateEngine } from '../TemplateEngine';
import { SnippetManager } from '../SnippetManager';

export const MnemosyneTemplatePanel: React.FC = () => {
  const mnemosyne = useMnemosyne();
  const alfred = useAlfred();
  const knowledgeGraph = useKnowledgeGraph();
  
  const [activeTab, setActiveTab] = useState<'templates' | 'snippets' | 'generate'>('templates');
  const [templates, setTemplates] = useState<TemplateCategory[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  const engine = new TemplateEngine(mnemosyne);
  const snippetManager = new SnippetManager(mnemosyne);

  useEffect(() => {
    loadTemplatesWithContext();
  }, [mnemosyne.activeDocument]);

  const loadTemplatesWithContext = async () => {
    const context = {
      document: mnemosyne.activeDocument,
      user: mnemosyne.currentUser,
      knowledgeBase: mnemosyne.knowledgeBase
    };
    
    // Get suggested templates based on context
    const suggestions = await engine.suggestTemplates(context);
    const categories = organizeByCategory(suggestions);
    setTemplates(categories);
  };

  const handleGenerateWithAlfred = async () => {
    if (!alfred.isAvailable) {
      mnemosyne.showNotification('ALFRED is not available', 'warning');
      return;
    }

    setIsGenerating(true);
    try {
      const prompt = `Generate a ${selectedCategory} template for ${mnemosyne.activeDocument?.type || 'documentation'}`;
      const template = await engine.generateTemplate(prompt, {
        document: mnemosyne.activeDocument,
        user: mnemosyne.currentUser
      });
      
      // Add to knowledge graph
      await knowledgeGraph.addNode({
        type: 'template',
        id: template.id,
        title: template.name,
        content: template.content,
        metadata: {
          generatedBy: 'ALFRED',
          timestamp: new Date()
        }
      });
      
      mnemosyne.showNotification('Template generated successfully!', 'success');
      setSelectedTemplate(template);
    } catch (error) {
      mnemosyne.showNotification('Failed to generate template', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="mnemosyne-template-panel">
      <div className="template-panel-header">
        <h3>Templates & Snippets</h3>
        <div className="tab-buttons">
          <button 
            className={activeTab === 'templates' ? 'active' : ''}
            onClick={() => setActiveTab('templates')}
          >
            <i className="fa-solid fa-file-code"></i> Templates
          </button>
          <button 
            className={activeTab === 'snippets' ? 'active' : ''}
            onClick={() => setActiveTab('snippets')}
          >
            <i className="fa-solid fa-code"></i> Snippets
          </button>
          <button 
            className={activeTab === 'generate' ? 'active' : ''}
            onClick={() => setActiveTab('generate')}
          >
            <i className="fa-solid fa-brain"></i> Generate
          </button>
        </div>
      </div>

      <div className="template-panel-content">
        {activeTab === 'templates' && (
          <TemplateExplorer 
            templates={templates}
            selectedTemplate={selectedTemplate}
            onSelectTemplate={setSelectedTemplate}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        )}
        
        {activeTab === 'snippets' && (
          <SnippetBrowser 
            snippetManager={snippetManager}
            onInsertSnippet={(snippet) => {
              mnemosyne.insertAtCursor(snippet.body);
            }}
          />
        )}
        
        {activeTab === 'generate' && (
          <AIGenerationPanel
            onGenerate={handleGenerateWithAlfred}
            isGenerating={isGenerating}
            knowledgeContext={mnemosyne.activeDocument}
          />
        )}
      </div>

      {selectedTemplate && (
        <TemplatePreview
          template={selectedTemplate}
          onUse={async () => {
            const rendered = await engine.render(selectedTemplate.id);
            mnemosyne.createDocument({
              title: `New ${selectedTemplate.name}`,
              content: rendered,
              templateId: selectedTemplate.id
            });
          }}
          onEdit={() => {
            mnemosyne.openInEditor(selectedTemplate);
          }}
        />
      )}
    </div>
  );
};