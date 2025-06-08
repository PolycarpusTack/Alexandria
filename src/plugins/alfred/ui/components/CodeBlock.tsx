/**
 * Code Block Component - Renders code with syntax highlighting
 */

import React, { useState } from 'react';
import { Button } from '../../../../client/components/ui/button';
import { useToast } from '../../../../client/components/ui/use-toast';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
  content: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ content }) => {
  const { toast } = useToast();
  const [copiedBlocks, setCopiedBlocks] = useState<Set<number>>(new Set());

  // Parse content for code blocks
  const parseContent = (text: string) => {
    const parts = [];
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;
    let blockIndex = 0;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: text.slice(lastIndex, match.index)
        });
      }

      // Add code block
      parts.push({
        type: 'code',
        language: match[1] || 'plaintext',
        content: match[2].trim(),
        index: blockIndex++
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex)
      });
    }

    return parts;
  };

  const copyCode = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedBlocks(new Set([...copiedBlocks, index]));
    
    toast({
      title: 'Copied',
      description: 'Code copied to clipboard'
    });

    // Reset copied state after 2 seconds
    setTimeout(() => {
      setCopiedBlocks(prev => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }, 2000);
  };

  const renderPart = (part: any, index: number) => {
    if (part.type === 'text') {
      return (
        <div key={index} className="whitespace-pre-wrap">
          {part.content.split('\n').map((line, i) => (
            <React.Fragment key={i}>
              {line}
              {i < part.content.split('\n').length - 1 && <br />}
            </React.Fragment>
          ))}
        </div>
      );
    }

    if (part.type === 'code') {
      const isCopied = copiedBlocks.has(part.index);
      
      return (
        <div key={index} className="my-3">
          <div className="relative group">
            <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => copyCode(part.content, part.index)}
              >
                {isCopied ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            
            <div className="bg-muted rounded-md p-4 overflow-x-auto">
              <pre className="text-sm">
                <code className={`language-${part.language}`}>
                  {part.content}
                </code>
              </pre>
            </div>
            
            {part.language && part.language !== 'plaintext' && (
              <div className="text-xs text-muted-foreground mt-1">
                {part.language}
              </div>
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  const parts = parseContent(content);

  return (
    <div className="space-y-2">
      {parts.map((part, index) => renderPart(part, index))}
    </div>
  );
};