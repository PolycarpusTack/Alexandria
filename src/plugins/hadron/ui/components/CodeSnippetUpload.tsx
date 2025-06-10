import React, { useState, useEffect, useRef } from 'react';


import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../client/components/ui/card';
import { Button } from '../../../../client/components/ui/button';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../client/components/ui/select';
import { Input } from '../../../../client/components/ui/input';
import { useToast } from '../../../../client/components/ui/use-toast'
/**
 * Interface for the crash analyzer service
 * Defines the methods available on the service for type safety
 */
interface CrashAnalyzerService {
  /**
   * Saves a code snippet to the system
   * @param code - The code snippet content
   * @param language - The programming language of the code
   * @param sessionId - The current session ID
   * @param description - Optional description of the snippet
   * @returns A promise that resolves to the saved snippet with an ID
   */
  saveCodeSnippet: (
    code: string, 
    language: string, 
    sessionId: string, 
    description?: string
  ) => Promise<{ id: string }>;

  /**
   * Analyzes a code snippet for issues
   * @param snippetId - The ID of the snippet to analyze
   * @param sessionId - The current session ID
   * @returns A promise that resolves when analysis is complete
   */
  analyzeCodeSnippet: (
    snippetId: string,
    sessionId: string
  ) => Promise<any>;
}

interface CodeSnippetUploadProps {
  crashAnalyzerService: CrashAnalyzerService;
  sessionId: string;
  onUploadComplete?: (snippetId: string) => void;
}

interface SyntaxHighlightingProps {
  code: string;
  language: string;
}

// List of supported programming languages
const SUPPORTED_LANGUAGES = [
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'java', label: 'Java' },
  { value: 'csharp', label: 'C#' },
  { value: 'cpp', label: 'C++' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'swift', label: 'Swift' },
  { value: 'php', label: 'PHP' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'scala', label: 'Scala' },
  { value: 'bash', label: 'Bash' },
  { value: 'powershell', label: 'PowerShell' },
  { value: 'sql', label: 'SQL' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'other', label: 'Other' }
];

/**
 * Component for uploading and analyzing code snippets
 */
/**
 * SecureSyntaxHighlighter Component
 * 
 * A secure implementation of syntax highlighting that doesn't rely on dangerouslySetInnerHTML
 * and properly escapes all content to prevent XSS attacks.
 */
const SecureSyntaxHighlighter: React.FC<SyntaxHighlightingProps> = ({ code, language }) => {
  // Split code into lines for rendering with line numbers
  const codeLines = code ? code.split('\n') : [];
  
  // Get language-specific styling information
  const getLanguageStyles = (lang: string) => {
    const supportedLanguages = [
      'python', 'javascript', 'typescript', 'java', 'csharp', 'cpp', 
      'go', 'rust', 'swift', 'php', 'ruby', 'kotlin', 'scala', 'bash', 
      'powershell', 'sql', 'html', 'css'
    ];
    
    return {
      className: supportedLanguages.includes(lang) ? `language-${lang}` : 'language-plaintext',
      displayName: lang.charAt(0).toUpperCase() + lang.slice(1)
    };
  };
  
  const langStyles = getLanguageStyles(language);
  
  /**
   * This is a basic syntax highlighting component that focuses on security.
   * In a production environment, this should be replaced with a proper React-based
   * syntax highlighting library like react-syntax-highlighter or prism-react-renderer
   * which provide secure, XSS-free syntax highlighting.
   */
  return (
    <div 
      className="bg-white border border-gray-200 rounded-md p-4 overflow-auto"
      style={{ maxHeight: '400px' }}
    >
      <div className="text-xs text-gray-500 mb-2">
        {langStyles.displayName}
      </div>
      
      <div className={`font-mono text-sm ${langStyles.className}`}>
        {codeLines.map((line, index) => (
          <div key={index} className="flex hover:bg-gray-50">
            <span className="text-gray-400 w-8 inline-block text-right pr-2 select-none">
              {index + 1}
            </span>
            <span className="flex-grow whitespace-pre">
              {/* Each character is explicitly rendered as text content, not HTML */}
              {line || ' '}
            </span>
          </div>
        ))}
      </div>
      
      <div className="mt-2 text-xs text-gray-500">
        {/* Add a note about production implementation */}
        <p>Note: For production use, this component should be replaced with a secure 
        React-based syntax highlighting library like react-syntax-highlighter.</p>
      </div>
    </div>
  );
};

export const CodeSnippetUpload: React.FC<CodeSnippetUploadProps> = ({ 
  crashAnalyzerService, 
  sessionId,
  onUploadComplete 
}) => {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [codeLength, setCodeLength] = useState(0);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  
  // Update cursor position when the user types or moves cursor
  const updateCursorPosition = () => {
    const textarea = textAreaRef.current;
    if (!textarea) return;
    
    const value = textarea.value;
    const selectionStart = textarea.selectionStart;
    
    // Count lines and columns up to the cursor position
    let line = 1;
    let column = 1;
    
    for (let i = 0; i < selectionStart; i++) {
      if (value[i] === '\n') {
        line++;
        column = 1;
      } else {
        column++;
      }
    }
    
    setCursorPosition({ line, column });
  };
  
  // Track code length for UI feedback
  useEffect(() => {
    setCodeLength(code.length);
  }, [code]);
  
  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Check for Ctrl+Enter or Cmd+Enter to submit
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };
  
  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    if (!code.trim()) {
      setError('Please enter some code');
      return;
    }
    
    if (!language) {
      setError('Please select a programming language');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Save the code snippet
      const snippet = await crashAnalyzerService.saveCodeSnippet(
        code,
        language,
        sessionId,
        description || undefined
      );
      
      // Perform analysis
      await crashAnalyzerService.analyzeCodeSnippet(
        snippet.id,
        sessionId
      );
      
      const successMsg = 'Code snippet uploaded and analyzed successfully';
      setSuccess(successMsg);
      
      // Use toast if available, otherwise log to console
      if (toast) {
        toast({ title: 'Success', description: successMsg });
      }
      
      // Call the callback if provided
      if (onUploadComplete) {
        onUploadComplete(snippet.id);
      }
      
      // Reset form
      setCode('');
      setDescription('');
    } catch (err) {
      // TODO: Replace with proper error logging
      console.error('Error uploading code snippet:', err);
      const errorMsg = 'Failed to analyze code snippet. Please try again.';
      setError(errorMsg);
      
      // Use toast if available, otherwise log to console
      toast ? 
        toast({ title: 'Error', description: errorMsg, variant: 'destructive' }) : 
        // TODO: Replace with proper error logging
      console.error('Error:', errorMsg);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Card>
      <h2 className="text-xl font-semibold mb-4">Code Snippet Analysis</h2>
      
      <p className="text-gray-600 mb-4">
        Submit a code snippet for AI analysis to identify potential issues, bugs, or improvements.
      </p>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded mb-4">
          {success}
        </div>
      )}
      
      {code && (
        <Card className="mb-4 overflow-hidden">
          <h3 className="text-sm font-medium mb-2">Preview</h3>
          <SecureSyntaxHighlighter code={code} language={language} />
        </Card>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Programming Language</label>
          <Select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={loading}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </Select>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Description (Optional)</label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of the code or the issue you're facing"
            disabled={loading}
          />
        </div>
        
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-medium">Code Snippet</label>
            <div className="text-xs text-gray-500">
              Line: {cursorPosition.line}, Column: {cursorPosition.column} | Length: {codeLength} chars
              {codeLength > 10000 && (
                <span className="ml-2 text-amber-600 font-medium">
                  Large file may affect performance
                </span>
              )}
            </div>
          </div>
          
          <div className="relative border border-gray-300 rounded-md overflow-hidden">
            <TextArea
              ref={textAreaRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={handleKeyDown}
              onClick={updateCursorPosition}
              onKeyUp={updateCursorPosition}
              placeholder="Paste your code here..."
              rows={15}
              disabled={loading}
              className="font-mono text-sm w-full p-4 bg-gray-50 resize-y"
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-500">
              Cmd/Ctrl+Enter to submit
            </div>
          </div>
          
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <div>
              <span className="font-medium">Tip:</span> For large files, consider uploading a crash log instead.
            </div>
            <button 
              type="button" 
              className="text-blue-600 hover:text-blue-800"
              onClick={() => setCode('')}
              disabled={loading || !code.length}
            >
              Clear
            </button>
          </div>
        </div>
        
        <div className="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size="small" className="mr-2" />
                Analyzing...
              </>
            ) : (
              'Analyze Code'
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
};