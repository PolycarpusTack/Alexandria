import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Save, 
  FileText, 
  Tag, 
  Link, 
  Eye, 
  Edit3, 
  Plus, 
  X,
  Bold,
  Italic,
  List,
  Link2,
  Quote,
  Code
} from 'lucide-react';

interface Document {
  id?: string;
  title: string;
  content: string;
  tags: string[];
  type: 'document' | 'concept' | 'template' | 'note';
  connections: string[];
  metadata: {
    author: string;
    created: Date;
    updated: Date;
    version: number;
  };
}

interface DocumentEditorProps {
  document?: Document;
  onSave: (document: Document) => Promise<void>;
  onCancel: () => void;
  isNew?: boolean;
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({
  document,
  onSave,
  onCancel,
  isNew = false
}) => {
  const [formData, setFormData] = useState<Document>({
    title: '',
    content: '',
    tags: [],
    type: 'document',
    connections: [],
    metadata: {
      author: 'Current User',
      created: new Date(),
      updated: new Date(),
      version: 1
    }
  });
  const [newTag, setNewTag] = useState('');
  const [newConnection, setNewConnection] = useState('');
  const [isPreview, setIsPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showConnectionSuggestions, setShowConnectionSuggestions] = useState(false);
  const [connectionSuggestions, setConnectionSuggestions] = useState<string[]>([]);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (document) {
      setFormData({ ...document });
    }
  }, [document]);

  useEffect(() => {
    // Load connection suggestions when user types
    if (newConnection.length > 2) {
      loadConnectionSuggestions(newConnection);
    } else {
      setShowConnectionSuggestions(false);
    }
  }, [newConnection]);

  const loadConnectionSuggestions = async (query: string) => {
    try {
      const response = await fetch(`/api/mnemosyne/nodes/search?q=${encodeURIComponent(query)}&limit=5`);
      const suggestions = await response.json();
      setConnectionSuggestions(suggestions.map((s: any) => s.title));
      setShowConnectionSuggestions(true);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    }
  };

  const handleInputChange = (field: keyof Document, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
      metadata: {
        ...prev.metadata,
        updated: new Date()
      }
    }));
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      handleInputChange('tags', [...formData.tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    handleInputChange('tags', formData.tags.filter(tag => tag !== tagToRemove));
  };

  const handleAddConnection = (connection: string) => {
    if (connection.trim() && !formData.connections.includes(connection.trim())) {
      handleInputChange('connections', [...formData.connections, connection.trim()]);
      setNewConnection('');
      setShowConnectionSuggestions(false);
    }
  };

  const handleRemoveConnection = (connectionToRemove: string) => {
    handleInputChange('connections', formData.connections.filter(conn => conn !== connectionToRemove));
  };

  const insertFormattingTag = (tag: string, hasClosingTag: boolean = true) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    
    let replacement = '';
    if (hasClosingTag) {
      replacement = `${tag}${selectedText}${tag}`;
    } else {
      replacement = `${tag}${selectedText}`;
    }

    const newContent = 
      textarea.value.substring(0, start) + 
      replacement + 
      textarea.value.substring(end);

    handleInputChange('content', newContent);

    // Set cursor position after formatting
    setTimeout(() => {
      const newPosition = start + tag.length + selectedText.length + (hasClosingTag ? tag.length : 0);
      textarea.setSelectionRange(newPosition, newPosition);
      textarea.focus();
    }, 0);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      alert('Please enter a title');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(formData);
    } catch (error) {
      console.error('Failed to save document:', error);
      alert('Failed to save document');
    } finally {
      setIsSaving(false);
    }
  };

  const renderPreview = () => {
    return (
      <div className="prose max-w-none">
        <h1>{formData.title}</h1>
        <div className="whitespace-pre-wrap">{formData.content}</div>
        
        {formData.tags.length > 0 && (
          <div className="mt-4">
            <h3>Tags</h3>
            <div className="flex flex-wrap gap-2">
              {formData.tags.map(tag => (
                <Badge key={tag} variant="outline">#{tag}</Badge>
              ))}
            </div>
          </div>
        )}

        {formData.connections.length > 0 && (
          <div className="mt-4">
            <h3>Connected Knowledge</h3>
            <ul>
              {formData.connections.map(conn => (
                <li key={conn}>
                  <Link2 className="inline h-4 w-4 mr-1" />
                  {conn}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="document-editor max-w-6xl mx-auto p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>{isNew ? 'New Document' : 'Edit Document'}</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                onClick={() => setIsPreview(!isPreview)}
                className="flex items-center space-x-1"
              >
                {isPreview ? <Edit3 className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span>{isPreview ? 'Edit' : 'Preview'}</span>
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="h-4 w-4 mr-1" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {!isPreview ? (
            <>
              {/* Title and Type */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="Enter document title..."
                    className="text-lg font-medium"
                  />
                </div>
                <div>
                  <Label htmlFor="type">Type</Label>
                  <select
                    id="type"
                    value={formData.type}
                    onChange={(e) => handleInputChange('type', e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="document">Document</option>
                    <option value="concept">Concept</option>
                    <option value="template">Template</option>
                    <option value="note">Note</option>
                  </select>
                </div>
              </div>

              {/* Content Editor */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="content">Content</Label>
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => insertFormattingTag('**')}
                      title="Bold"
                    >
                      <Bold className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => insertFormattingTag('*')}
                      title="Italic"
                    >
                      <Italic className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => insertFormattingTag('`')}
                      title="Code"
                    >
                      <Code className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => insertFormattingTag('> ', false)}
                      title="Quote"
                    >
                      <Quote className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => insertFormattingTag('- ', false)}
                      title="List"
                    >
                      <List className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <Textarea
                  ref={textareaRef}
                  id="content"
                  value={formData.content}
                  onChange={(e) => handleInputChange('content', e.target.value)}
                  placeholder="Write your content here... Use Markdown formatting."
                  className="min-h-[400px] font-mono"
                />
              </div>

              {/* Tags */}
              <div>
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="flex items-center space-x-1">
                      <Tag className="h-3 w-3" />
                      <span>#{tag}</span>
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center space-x-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                    placeholder="Add a tag..."
                    className="flex-1"
                  />
                  <Button onClick={handleAddTag} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Connections */}
              <div>
                <Label>Knowledge Connections</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.connections.map(connection => (
                    <Badge key={connection} variant="outline" className="flex items-center space-x-1">
                      <Link className="h-3 w-3" />
                      <span>{connection}</span>
                      <button
                        onClick={() => handleRemoveConnection(connection)}
                        className="ml-1 hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="relative">
                  <div className="flex items-center space-x-2">
                    <Input
                      value={newConnection}
                      onChange={(e) => setNewConnection(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddConnection(newConnection)}
                      placeholder="Connect to another document..."
                      className="flex-1"
                    />
                    <Button onClick={() => handleAddConnection(newConnection)} size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {showConnectionSuggestions && connectionSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border rounded-md shadow-lg z-10 mt-1">
                      {connectionSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => handleAddConnection(suggestion)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center space-x-2"
                        >
                          <Link2 className="h-4 w-4 text-gray-400" />
                          <span>{suggestion}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Metadata */}
              <div className="pt-4 border-t">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                  <div>
                    <strong>Author:</strong> {formData.metadata.author}
                  </div>
                  <div>
                    <strong>Created:</strong> {formData.metadata.created.toLocaleDateString()}
                  </div>
                  <div>
                    <strong>Updated:</strong> {formData.metadata.updated.toLocaleDateString()}
                  </div>
                  <div>
                    <strong>Version:</strong> {formData.metadata.version}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="preview-content">
              {renderPreview()}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};