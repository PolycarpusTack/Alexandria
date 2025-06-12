import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@client/components/ui/input';
import { Badge } from '@client/components/ui/badge';
import { ScrollArea } from '@client/components/ui/scroll-area';
import {
  Search,
  Code,
  FileText,
  MessageSquare,
  Settings,
  Download,
  Upload,
  Zap,
  Keyboard,
  Clock,
  Star,
  ChevronRight,
  Command
} from 'lucide-react';

interface Command {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  keywords: string[];
  shortcut?: string;
  action: () => void | Promise<void>;
  disabled?: boolean;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
  recentCommands?: string[];
  onCommandExecute?: (commandId: string) => void;
  theme?: 'light' | 'dark';
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  commands,
  recentCommands = [],
  onCommandExecute,
  theme = 'dark'
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filteredCommands, setFilteredCommands] = useState<Command[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter commands based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      // Show recent commands first, then all commands
      const recentCommandsArray = commands.filter(cmd => recentCommands.includes(cmd.id));
      const otherCommands = commands.filter(cmd => !recentCommands.includes(cmd.id));
      setFilteredCommands([...recentCommandsArray, ...otherCommands]);
    } else {
      const filtered = commands.filter(command => {
        const searchLower = searchTerm.toLowerCase();
        return (
          command.title.toLowerCase().includes(searchLower) ||
          command.description.toLowerCase().includes(searchLower) ||
          command.keywords.some(keyword => keyword.toLowerCase().includes(searchLower)) ||
          command.category.toLowerCase().includes(searchLower)
        );
      });
      setFilteredCommands(filtered);
    }
    setSelectedIndex(0);
  }, [searchTerm, commands, recentCommands]);

  // Focus input when palette opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          executeCommand(filteredCommands[selectedIndex]);
        }
        break;
    }
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        });
      }
    }
  }, [selectedIndex]);

  const executeCommand = async (command: Command) => {
    if (command.disabled) return;

    try {
      await command.action();
      if (onCommandExecute) {
        onCommandExecute(command.id);
      }
      onClose();
      setSearchTerm('');
    } catch (error) {
      console.error('Command execution failed:', error);
    }
  };

  const groupedCommands = groupCommandsByCategory(filteredCommands);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-start justify-center pt-[10vh]">
      <div className={`command-palette w-full max-w-2xl mx-4 bg-white dark:bg-gray-900 rounded-lg shadow-2xl border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              ref={inputRef}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search commands... (type to search)"
              className="pl-10 pr-4 border-0 bg-transparent text-lg focus:ring-0"
            />
          </div>
        </div>

        {/* Results */}
        <ScrollArea className="max-h-96">
          <div ref={listRef} className="p-2">
            {filteredCommands.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No commands found</p>
                <p className="text-sm">Try a different search term</p>
              </div>
            ) : (
              Object.entries(groupedCommands).map(([category, categoryCommands]) => (
                <div key={category} className="mb-4">
                  {!searchTerm.trim() && (
                    <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {category === 'recent' ? 'Recent' : category}
                    </div>
                  )}
                  
                  {categoryCommands.map((command, index) => {
                    const globalIndex = filteredCommands.indexOf(command);
                    const isSelected = globalIndex === selectedIndex;
                    const isRecent = recentCommands.includes(command.id);

                    return (
                      <div
                        key={command.id}
                        onClick={() => executeCommand(command)}
                        className={`command-item flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700' 
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                        } ${command.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {/* Icon */}
                        <div className={`p-2 rounded-md ${
                          isSelected 
                            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' 
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                        }`}>
                          {command.icon}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                              {command.title}
                            </h3>
                            {isRecent && !searchTerm.trim() && (
                              <Badge variant="secondary" className="text-xs">
                                <Clock className="w-3 h-3 mr-1" />
                                Recent
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                            {command.description}
                          </p>
                        </div>

                        {/* Shortcut or Arrow */}
                        <div className="flex items-center gap-2">
                          {command.shortcut && (
                            <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">
                              {command.shortcut}
                            </kbd>
                          )}
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">↑↓</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">↵</kbd>
                Execute
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Esc</kbd>
                Close
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Command className="w-3 h-3" />
              <span>Command Palette</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Default commands that would be used in Alfred
export const createDefaultCommands = (callbacks: {
  onNewChat: () => void;
  onOpenTemplateWizard: () => void;
  onGenerateCode: () => void;
  onAnalyzeProject: () => void;
  onDownloadChat: () => void;
  onShowSettings: () => void;
  onShowKeyboardShortcuts: () => void;
}): Command[] => [
  {
    id: 'new-chat',
    title: 'New Chat Session',
    description: 'Start a new conversation with Alfred',
    icon: <MessageSquare className="w-4 h-4" />,
    category: 'Chat',
    keywords: ['new', 'chat', 'conversation', 'session'],
    shortcut: 'Ctrl+N',
    action: callbacks.onNewChat
  },
  {
    id: 'template-wizard',
    title: 'Open Template Wizard',
    description: 'Create code from templates',
    icon: <FileText className="w-4 h-4" />,
    category: 'Templates',
    keywords: ['template', 'wizard', 'generate', 'scaffold'],
    shortcut: 'Ctrl+T',
    action: callbacks.onOpenTemplateWizard
  },
  {
    id: 'generate-code',
    title: 'Generate Code',
    description: 'AI-powered code generation',
    icon: <Code className="w-4 h-4" />,
    category: 'Code',
    keywords: ['generate', 'code', 'ai', 'create'],
    shortcut: 'Ctrl+G',
    action: callbacks.onGenerateCode
  },
  {
    id: 'analyze-project',
    title: 'Analyze Project',
    description: 'Analyze current project structure and patterns',
    icon: <Zap className="w-4 h-4" />,
    category: 'Analysis',
    keywords: ['analyze', 'project', 'structure', 'patterns'],
    shortcut: 'Ctrl+A',
    action: callbacks.onAnalyzeProject
  },
  {
    id: 'download-chat',
    title: 'Download Chat History',
    description: 'Export current chat session',
    icon: <Download className="w-4 h-4" />,
    category: 'Export',
    keywords: ['download', 'export', 'save', 'chat'],
    shortcut: 'Ctrl+D',
    action: callbacks.onDownloadChat
  },
  {
    id: 'settings',
    title: 'Open Settings',
    description: 'Configure Alfred preferences',
    icon: <Settings className="w-4 h-4" />,
    category: 'Settings',
    keywords: ['settings', 'preferences', 'config'],
    shortcut: 'Ctrl+,',
    action: callbacks.onShowSettings
  },
  {
    id: 'keyboard-shortcuts',
    title: 'Keyboard Shortcuts',
    description: 'View available keyboard shortcuts',
    icon: <Keyboard className="w-4 h-4" />,
    category: 'Help',
    keywords: ['keyboard', 'shortcuts', 'help', 'hotkeys'],
    shortcut: 'Ctrl+/',
    action: callbacks.onShowKeyboardShortcuts
  }
];

// Helper function to group commands by category
function groupCommandsByCategory(commands: Command[]): Record<string, Command[]> {
  return commands.reduce((groups, command) => {
    const category = command.category.toLowerCase();
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(command);
    return groups;
  }, {} as Record<string, Command[]>);
}

// Hook for command palette state management
export const useCommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [recentCommands, setRecentCommands] = useState<string[]>([]);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);
  const toggle = () => setIsOpen(!isOpen);

  const addRecentCommand = (commandId: string) => {
    setRecentCommands(prev => {
      const filtered = prev.filter(id => id !== commandId);
      return [commandId, ...filtered].slice(0, 5); // Keep only 5 recent commands
    });
  };

  // Global keyboard shortcut to open palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        toggle();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    open,
    close,
    toggle,
    recentCommands,
    addRecentCommand
  };
};