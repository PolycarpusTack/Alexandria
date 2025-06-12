import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@client/components/ui/button';
import { toast } from '@client/components/ui/use-toast';
import { Check, Copy, Download, Eye, EyeOff } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language: string;
  filename?: string;
  showLineNumbers?: boolean;
  maxHeight?: string;
  editable?: boolean;
  onCodeChange?: (code: string) => void;
  theme?: 'light' | 'dark';
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language,
  filename,
  showLineNumbers = true,
  maxHeight = '400px',
  editable = false,
  onCodeChange,
  theme = 'dark'
}) => {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [highlightedCode, setHighlightedCode] = useState(code);
  const codeRef = useRef<HTMLPreElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Simple syntax highlighting (would use a proper library in production)
  useEffect(() => {
    const highlighted = applySyntaxHighlighting(code, language);
    setHighlightedCode(highlighted);
  }, [code, language]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Code copied to clipboard",
        duration: 2000,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Failed to copy code to clipboard",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `code.${getFileExtension(language)}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Downloaded",
      description: `Code saved as ${a.download}`,
      duration: 2000,
    });
  };

  const handleCodeEdit = (newCode: string) => {
    if (onCodeChange) {
      onCodeChange(newCode);
    }
  };

  const toggleCollapse = () => {
    setCollapsed(!collapsed);
  };

  const lines = code.split('\n');
  const shouldShowCollapse = lines.length > 20;

  return (
    <div className={`code-block-container ${theme === 'dark' ? 'dark' : 'light'}`}>
      {/* Header */}
      <div className="code-block-header flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 border-b">
        <div className="flex items-center gap-2">
          {filename && (
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {filename}
            </span>
          )}
          <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
            {language}
          </span>
          {lines.length > 1 && (
            <span className="text-xs text-gray-500">
              {lines.length} lines
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {shouldShowCollapse && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleCollapse}
              className="h-8 w-8 p-0"
              title={collapsed ? "Expand" : "Collapse"}
            >
              {collapsed ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-8 w-8 p-0"
            title="Copy to clipboard"
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="h-8 w-8 p-0"
            title="Download file"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Code Content */}
      {!collapsed && (
        <div 
          className="code-block-content relative"
          style={{ maxHeight }}
        >
          {editable ? (
            <textarea
              ref={textareaRef}
              value={code}
              onChange={(e) => handleCodeEdit(e.target.value)}
              className="w-full h-full p-4 font-mono text-sm bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 border-0 resize-none focus:outline-none"
              style={{ minHeight: '100px' }}
              spellCheck={false}
            />
          ) : (
            <div className="relative overflow-auto">
              <pre
                ref={codeRef}
                className="p-4 font-mono text-sm bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 overflow-auto"
                style={{ margin: 0 }}
              >
                {showLineNumbers ? (
                  <table className="w-full">
                    <tbody>
                      {lines.map((line, index) => (
                        <tr key={index}>
                          <td className="select-none pr-4 text-gray-400 dark:text-gray-600 text-right align-top" style={{ width: '1%' }}>
                            {index + 1}
                          </td>
                          <td className="pl-2">
                            <code 
                              dangerouslySetInnerHTML={{ 
                                __html: applySyntaxHighlighting(line, language) 
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <code 
                    dangerouslySetInnerHTML={{ 
                      __html: highlightedCode 
                    }}
                  />
                )}
              </pre>
            </div>
          )}
        </div>
      )}

      {collapsed && (
        <div className="p-4 text-center text-gray-500 dark:text-gray-400">
          <span className="text-sm">Code collapsed ({lines.length} lines)</span>
        </div>
      )}
    </div>
  );
};

// Simple syntax highlighting function (would use Prism.js or similar in production)
function applySyntaxHighlighting(code: string, language: string): string {
  if (!code) return '';

  let highlighted = code;

  switch (language.toLowerCase()) {
    case 'javascript':
    case 'typescript':
      highlighted = highlighted
        // Keywords
        .replace(/\b(const|let|var|function|return|if|else|for|while|class|interface|type|import|export|from|async|await|try|catch|finally)\b/g, '<span class="keyword">$1</span>')
        // Strings
        .replace(/(["'])((?:\\.|(?!\1)[^\\])*?)\1/g, '<span class="string">$1$2$1</span>')
        // Comments
        .replace(/(\/\/.*$)/gm, '<span class="comment">$1</span>')
        .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="comment">$1</span>')
        // Numbers
        .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="number">$1</span>');
      break;

    case 'python':
      highlighted = highlighted
        // Keywords
        .replace(/\b(def|class|import|from|if|elif|else|for|while|return|try|except|finally|with|as|pass|break|continue|and|or|not|in|is|None|True|False)\b/g, '<span class="keyword">$1</span>')
        // Strings
        .replace(/(["'])((?:\\.|(?!\1)[^\\])*?)\1/g, '<span class="string">$1$2$1</span>')
        // Comments
        .replace(/(#.*$)/gm, '<span class="comment">$1</span>')
        // Numbers
        .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="number">$1</span>');
      break;

    case 'json':
      highlighted = highlighted
        // Keys
        .replace(/"([^"]+)"(\s*:)/g, '<span class="key">"$1"</span>$2')
        // Strings
        .replace(/:\s*"([^"]*)"/g, ': <span class="string">"$1"</span>')
        // Numbers
        .replace(/:\s*(\d+(?:\.\d+)?)/g, ': <span class="number">$1</span>')
        // Booleans
        .replace(/:\s*(true|false)/g, ': <span class="boolean">$1</span>');
      break;

    default:
      // Basic highlighting for unknown languages
      highlighted = highlighted
        .replace(/(["'])((?:\\.|(?!\1)[^\\])*?)\1/g, '<span class="string">$1$2$1</span>')
        .replace(/(\/\/.*$|#.*$)/gm, '<span class="comment">$1</span>');
  }

  return highlighted;
}

function getFileExtension(language: string): string {
  const extensions: Record<string, string> = {
    'javascript': 'js',
    'typescript': 'ts',
    'python': 'py',
    'java': 'java',
    'go': 'go',
    'rust': 'rs',
    'html': 'html',
    'css': 'css',
    'json': 'json',
    'yaml': 'yml',
    'markdown': 'md',
    'sql': 'sql',
    'bash': 'sh',
    'shell': 'sh'
  };
  
  return extensions[language.toLowerCase()] || 'txt';
}