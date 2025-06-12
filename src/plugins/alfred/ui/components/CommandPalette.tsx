/**
 * Command Palette Component
 *
 * Provides quick access to Alfred commands via Ctrl+Shift+P
 * Based on the original Alfred's command palette functionality
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Command } from '../../../../client/components/ui/command';
import { Dialog } from '../../../../client/components/ui/dialog';
import {
  Code,
  FileText,
  FolderOpen,
  MessageSquare,
  RefreshCw,
  Save,
  Search,
  Settings,
  Template,
  Wand2,
  FileCode,
  GitBranch,
  Database,
  Sparkles,
  BookOpen,
  History,
  Trash2,
  Copy,
  Download,
  Upload
} from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  category: 'code' | 'project' | 'session' | 'template' | 'ai' | 'file';
  shortcut?: string;
  action: () => void | Promise<void>;
}

interface CommandPaletteProps {
  onGenerateCode?: (prompt: string) => void;
  onAnalyzeProject?: () => void;
  onNewSession?: () => void;
  onSaveSession?: () => void;
  onLoadSession?: (sessionId: string) => void;
  onOpenTemplates?: () => void;
  onCreateTemplate?: () => void;
  onRefreshContext?: () => void;
  onExportSession?: () => void;
  onImportSession?: () => void;
  onClearChat?: () => void;
  currentSessionId?: string;
  hasUnsavedChanges?: boolean;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  onGenerateCode,
  onAnalyzeProject,
  onNewSession,
  onSaveSession,
  onLoadSession,
  onOpenTemplates,
  onCreateTemplate,
  onRefreshContext,
  onExportSession,
  onImportSession,
  onClearChat,
  currentSessionId,
  hasUnsavedChanges = false
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Command definitions
  const commands: CommandItem[] = useMemo(
    () => [
      // Code Generation Commands
      {
        id: 'generate-function',
        label: 'Generate Function',
        description: 'Create a new function from description',
        icon: Code,
        category: 'code',
        shortcut: 'Ctrl+G F',
        action: () => {
          setOpen(false);
          onGenerateCode?.('Generate a function that ');
        }
      },
      {
        id: 'generate-class',
        label: 'Generate Class',
        description: 'Create a new class from description',
        icon: FileCode,
        category: 'code',
        shortcut: 'Ctrl+G C',
        action: () => {
          setOpen(false);
          onGenerateCode?.('Generate a class that ');
        }
      },
      {
        id: 'generate-component',
        label: 'Generate Component',
        description: 'Create a React/Vue/Angular component',
        icon: FileCode,
        category: 'code',
        shortcut: 'Ctrl+G O',
        action: () => {
          setOpen(false);
          onGenerateCode?.('Generate a component that ');
        }
      },
      {
        id: 'generate-tests',
        label: 'Generate Tests',
        description: 'Create unit tests for selected code',
        icon: FileText,
        category: 'code',
        shortcut: 'Ctrl+G T',
        action: () => {
          setOpen(false);
          onGenerateCode?.('Generate unit tests for ');
        }
      },

      // Project Commands
      {
        id: 'analyze-project',
        label: 'Analyze Project',
        description: 'Analyze current project structure',
        icon: Search,
        category: 'project',
        shortcut: 'Ctrl+Shift+A',
        action: () => {
          setOpen(false);
          onAnalyzeProject?.();
        }
      },
      {
        id: 'refresh-context',
        label: 'Refresh Project Context',
        description: 'Update project analysis and context',
        icon: RefreshCw,
        category: 'project',
        shortcut: 'F5',
        action: () => {
          setOpen(false);
          onRefreshContext?.();
        }
      },
      {
        id: 'open-project-folder',
        label: 'Open Project Folder',
        description: 'Browse and select a project folder',
        icon: FolderOpen,
        category: 'project',
        action: () => {
          setOpen(false);
          // This would trigger file dialog in desktop version
        }
      },

      // Session Commands
      {
        id: 'new-session',
        label: 'New Session',
        description: 'Start a new chat session',
        icon: MessageSquare,
        category: 'session',
        shortcut: 'Ctrl+N',
        action: () => {
          setOpen(false);
          onNewSession?.();
        }
      },
      {
        id: 'save-session',
        label: hasUnsavedChanges ? 'Save Session*' : 'Save Session',
        description: 'Save current session',
        icon: Save,
        category: 'session',
        shortcut: 'Ctrl+S',
        action: () => {
          setOpen(false);
          onSaveSession?.();
        }
      },
      {
        id: 'export-session',
        label: 'Export Session',
        description: 'Export session to file',
        icon: Download,
        category: 'session',
        action: () => {
          setOpen(false);
          onExportSession?.();
        }
      },
      {
        id: 'import-session',
        label: 'Import Session',
        description: 'Import session from file',
        icon: Upload,
        category: 'session',
        action: () => {
          setOpen(false);
          onImportSession?.();
        }
      },
      {
        id: 'clear-chat',
        label: 'Clear Chat',
        description: 'Clear current chat history',
        icon: Trash2,
        category: 'session',
        action: () => {
          setOpen(false);
          onClearChat?.();
        }
      },
      {
        id: 'session-history',
        label: 'Session History',
        description: 'View previous sessions',
        icon: History,
        category: 'session',
        shortcut: 'Ctrl+H',
        action: () => {
          setOpen(false);
          // Would open session history dialog
        }
      },

      // Template Commands
      {
        id: 'open-templates',
        label: 'Browse Templates',
        description: 'View and use code templates',
        icon: Template,
        category: 'template',
        shortcut: 'Ctrl+T',
        action: () => {
          setOpen(false);
          onOpenTemplates?.();
        }
      },
      {
        id: 'create-template',
        label: 'Create Template',
        description: 'Create a new code template',
        icon: Wand2,
        category: 'template',
        shortcut: 'Ctrl+Shift+T',
        action: () => {
          setOpen(false);
          onCreateTemplate?.();
        }
      },
      {
        id: 'template-wizard',
        label: 'Template Wizard',
        description: 'Interactive project scaffolding',
        icon: Sparkles,
        category: 'template',
        action: () => {
          setOpen(false);
          // Would open template wizard
        }
      },

      // AI Commands
      {
        id: 'explain-code',
        label: 'Explain Code',
        description: 'Get explanation for selected code',
        icon: BookOpen,
        category: 'ai',
        shortcut: 'Ctrl+E',
        action: () => {
          setOpen(false);
          onGenerateCode?.('Explain this code: ');
        }
      },
      {
        id: 'improve-code',
        label: 'Improve Code',
        description: 'Get suggestions to improve code',
        icon: Sparkles,
        category: 'ai',
        shortcut: 'Ctrl+I',
        action: () => {
          setOpen(false);
          onGenerateCode?.('Improve this code: ');
        }
      },
      {
        id: 'fix-errors',
        label: 'Fix Errors',
        description: 'Get help fixing code errors',
        icon: Settings,
        category: 'ai',
        shortcut: 'Ctrl+F',
        action: () => {
          setOpen(false);
          onGenerateCode?.('Fix the errors in this code: ');
        }
      },
      {
        id: 'convert-code',
        label: 'Convert Code',
        description: 'Convert code to another language',
        icon: RefreshCw,
        category: 'ai',
        action: () => {
          setOpen(false);
          onGenerateCode?.('Convert this code to ');
        }
      }
    ],
    [
      hasUnsavedChanges,
      onGenerateCode,
      onAnalyzeProject,
      onNewSession,
      onSaveSession,
      onOpenTemplates,
      onCreateTemplate,
      onRefreshContext,
      onExportSession,
      onImportSession,
      onClearChat
    ]
  );

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    let filtered = commands;

    if (selectedCategory) {
      filtered = filtered.filter((cmd) => cmd.category === selectedCategory);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (cmd) =>
          cmd.label.toLowerCase().includes(searchLower) ||
          cmd.description?.toLowerCase().includes(searchLower) ||
          cmd.shortcut?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [commands, search, selectedCategory]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    filteredCommands.forEach((cmd) => {
      if (!groups[cmd.category]) {
        groups[cmd.category] = [];
      }
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open command palette with Ctrl+Shift+P
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setOpen(true);
      }

      // Close with Escape
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const handleSelect = useCallback((command: CommandItem) => {
    command.action();
  }, []);

  const categoryLabels: Record<string, string> = {
    code: 'Code Generation',
    project: 'Project',
    session: 'Session',
    template: 'Templates',
    ai: 'AI Assistance',
    file: 'File Operations'
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className='alfred-command-palette'>
        <Command>
          <Command.Input
            placeholder='Type a command or search...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <Command.List>
            {search === '' && (
              <Command.Group heading='Categories'>
                {Object.keys(categoryLabels).map((category) => (
                  <Command.Item
                    key={category}
                    onSelect={() =>
                      setSelectedCategory(selectedCategory === category ? null : category)
                    }
                  >
                    <span className={`category-${category}`}>{categoryLabels[category]}</span>
                    {selectedCategory === category && ' ✓'}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {Object.entries(groupedCommands).map(([category, cmds]) => (
              <Command.Group key={category} heading={categoryLabels[category]}>
                {cmds.map((cmd) => (
                  <Command.Item key={cmd.id} value={cmd.label} onSelect={() => handleSelect(cmd)}>
                    <cmd.icon className='h-4 w-4 mr-2' />
                    <span className='flex-1'>{cmd.label}</span>
                    {cmd.shortcut && (
                      <span className='text-xs text-muted-foreground ml-2'>{cmd.shortcut}</span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}

            {filteredCommands.length === 0 && <Command.Empty>No commands found.</Command.Empty>}
          </Command.List>
        </Command>
      </div>
    </Dialog>
  );
};
