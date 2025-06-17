import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Save, 
  X, 
  Tag, 
  Link, 
  FileText,
  Bold,
  Italic,
  List,
  Link2,
  Code,
  Quote,
  AlertCircle,
  Loader2,
  Users
} from 'lucide-react';
import { useNode, useNodes } from '../hooks/useNodes';
import { mnemosyneAPI } from '../api/client';
import { useMnemosyneStore } from '../store';
import { useCollaborativeEditing } from '../hooks/useWebSocket';

interface NodeEditorProps {
  editMode?: boolean;
}

const NodeEditor: React.FC<NodeEditorProps> = ({ editMode = false }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { node, loading, error, updateNode } = useNode(id || '');
  const { createNode } = useNodes();
  const { updateNodeInCache } = useMnemosyneStore();
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [nodeType, setNodeType] = useState<'document' | 'note'>('document');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Collaborative editing
  const { activeUsers, collaborativeCursors, handleCursorChange } = useCollaborativeEditing(
    id || '',
    content
  );

  useEffect(() => {
    if (node) {
      setTitle(node.title);
      setContent(node.content);
      setTags(node.metadata.tags || []);
      setNodeType(node.type as 'document' | 'note');
    } else if (id === 'new') {
      // Reset for new node
      setTitle('');
      setContent('');
      setTags([]);
      setNodeType('document');
    }
  }, [node, id]);

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Please enter a title');
      return;
    }
    
    setIsSaving(true);
    
    try {
      if (id === 'new') {
        // Create new node
        const newNode = await createNode({
          title,
          content,
          type: nodeType,
          parentId: undefined
        });
        
        // Update with tags
        if (tags.length > 0) {
          await mnemosyneAPI.updateNode(newNode.id, {
            metadata: { ...newNode.metadata, tags }
          });
        }
        
        navigate(`/mnemosyne/nodes/${newNode.id}`);
      } else if (node) {
        // Update existing node
        const updated = await updateNode({
          title,
          content,
          type: nodeType,
          metadata: { ...node.metadata, tags }
        });
        
        updateNodeInCache(updated);
        setHasChanges(false);
      }
    } catch (error) {
      console.error('Failed to save node:', error);
      alert('Failed to save node. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const addTag = () => {
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag]);
      setNewTag('');
      setHasChanges(true);
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
    setHasChanges(true);
  };

  // Track changes
  useEffect(() => {
    if (node) {
      const changed = 
        title !== node.title ||
        content !== node.content ||
        nodeType !== node.type ||
        JSON.stringify(tags) !== JSON.stringify(node.metadata.tags || []);
      setHasChanges(changed);
    }
  }, [title, content, nodeType, tags, node]);

  const insertFormatting = (format: string) => {
    const textarea = document.getElementById('content-editor') as HTMLTextAreaElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    
    let newText = '';
    switch (format) {
      case 'bold':
        newText = `**${selectedText}**`;
        break;
      case 'italic':
        newText = `*${selectedText}*`;
        break;
      case 'link':
        newText = `[${selectedText}](url)`;
        break;
      case 'code':
        newText = `\`${selectedText}\``;
        break;
      case 'quote':
        newText = `> ${selectedText}`;
        break;
      case 'list':
        newText = `- ${selectedText}`;
        break;
      default:
        newText = selectedText;
    }
    
    const newContent = content.substring(0, start) + newText + content.substring(end);
    setContent(newContent);
    setHasChanges(true);
  };

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-900 dark:text-gray-100 font-semibold mb-2">Failed to load node</p>
          <p className="text-gray-600 dark:text-gray-400 text-sm">{error.message}</p>
          <button
            onClick={() => navigate('/mnemosyne/nodes')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Explorer
          </button>
        </div>
      </div>
    );
  }

  if (loading && id !== 'new') {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-gray-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading node...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {id === 'new' ? 'Create New Node' : editMode ? 'Edit Node' : 'View Node'}
          </h1>
          {activeUsers.length > 0 && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-500" />
              <div className="flex -space-x-2">
                {activeUsers.slice(0, 3).map((user, i) => (
                  <div
                    key={user.userId}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                    style={{ backgroundColor: user.color }}
                    title={user.userName}
                  >
                    {user.userName.charAt(0).toUpperCase()}
                  </div>
                ))}
                {activeUsers.length > 3 && (
                  <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-sm font-medium">
                    +{activeUsers.length - 3}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={isSaving || (!hasChanges && id !== 'new')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {id === 'new' ? 'Create' : 'Save'}
              </>
            )}
          </button>
          <button
            onClick={() => navigate('/mnemosyne/nodes')}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-6">
          {/* Title */}
          <div className="mb-6">
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setHasChanges(true);
              }}
              placeholder="Node title..."
              className="w-full text-3xl font-bold border-0 border-b-2 border-transparent hover:border-gray-200 dark:hover:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none pb-2"
            />
          </div>

          {/* Node Type */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Node Type
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="nodeType"
                  value="document"
                  checked={nodeType === 'document'}
                  onChange={() => setNodeType('document')}
                  className="mr-2"
                />
                <FileText className="h-4 w-4 mr-1" />
                Document
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="nodeType"
                  value="note"
                  checked={nodeType === 'note'}
                  onChange={() => setNodeType('note')}
                  className="mr-2"
                />
                <FileText className="h-4 w-4 mr-1" />
                Note
              </label>
            </div>
          </div>

          {/* Formatting Toolbar */}
          <div className="mb-4 flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded-lg">
            <button
              onClick={() => insertFormatting('bold')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              title="Bold"
            >
              <Bold className="h-4 w-4" />
            </button>
            <button
              onClick={() => insertFormatting('italic')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              title="Italic"
            >
              <Italic className="h-4 w-4" />
            </button>
            <button
              onClick={() => insertFormatting('link')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              title="Link"
            >
              <Link2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => insertFormatting('code')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              title="Code"
            >
              <Code className="h-4 w-4" />
            </button>
            <button
              onClick={() => insertFormatting('quote')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              title="Quote"
            >
              <Quote className="h-4 w-4" />
            </button>
            <button
              onClick={() => insertFormatting('list')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              title="List"
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          {/* Content Editor */}
          <div className="mb-6 relative">
            <textarea
              id="content-editor"
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setHasChanges(true);
              }}
              onSelect={(e) => {
                const target = e.target as HTMLTextAreaElement;
                const lines = content.substring(0, target.selectionStart).split('\n');
                const line = lines.length;
                const column = lines[lines.length - 1].length;
                handleCursorChange(line, column);
              }}
              placeholder="Start writing..."
              className="w-full h-96 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 resize-none font-mono text-sm"
            />
            {/* Collaborative cursors overlay */}
            {collaborativeCursors.size > 0 && (
              <div className="absolute top-0 left-0 w-full h-full pointer-events-none p-4">
                {Array.from(collaborativeCursors.entries()).map(([userId, cursor]) => (
                  <div
                    key={userId}
                    className="absolute text-xs font-medium px-1 py-0.5 rounded"
                    style={{
                      backgroundColor: cursor.color,
                      color: 'white',
                      // Calculate position based on line/column
                      // This is simplified - in production you'd need proper text measurement
                      top: `${cursor.line * 1.5}rem`,
                      left: `${cursor.column * 0.6}rem`
                    }}
                  >
                    {cursor.userName}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Tag className="inline h-4 w-4 mr-1" />
              Tags
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {tags.map(tag => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-sm flex items-center gap-1"
                >
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="hover:text-blue-900 dark:hover:text-blue-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addTag()}
                placeholder="Add a tag..."
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
              <button
                onClick={addTag}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
              >
                Add
              </button>
            </div>
          </div>

          {/* Connections */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Link className="inline h-4 w-4 mr-1" />
              Connections
            </label>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No connections yet. Start typing [[ to link to other nodes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NodeEditor;