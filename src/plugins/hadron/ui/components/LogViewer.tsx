import React, { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';

import { ParsedCrashData } from '../../src/interfaces';

import { Card } from '../../../../client/components/ui/card';
import { Button } from '../../../../client/components/ui/button';
import { Input } from '../../../../client/components/ui/input';
interface LogViewerProps {
  content: string;
  parsedData?: ParsedCrashData;
}

export const LogViewer: React.FC<LogViewerProps> = ({ content, parsedData }) => {
  const [filter, setFilter] = useState('');
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [wrapText, setWrapText] = useState(true);
  const [matches, setMatches] = useState<number[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const [isValidRegex, setIsValidRegex] = useState(true);
  const [filteredContent, setFilteredContent] = useState(content);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Find all matches and their line numbers when filter changes
  useEffect(() => {
    if (!filter.trim()) {
      setMatches([]);
      setCurrentMatchIndex(-1);
      setFilteredContent(content);
      setIsValidRegex(true);
      return;
    }

    try {
      const regex = new RegExp(filter, 'gi');
      setIsValidRegex(true);

      // Find line numbers with matches
      const lines = content.split('\n');
      const matchingLines: number[] = [];

      lines.forEach((line, index) => {
        if (regex.test(line)) {
          matchingLines.push(index);
        }
        // Reset regex lastIndex property
        regex.lastIndex = 0;
      });

      setMatches(matchingLines);
      setCurrentMatchIndex(matchingLines.length > 0 ? 0 : -1);

      // Apply filter to content
      if (matchingLines.length > 0) {
        // Instead of filtering, we'll just highlight the matches
        setFilteredContent(content);
      } else {
        setFilteredContent(content);
      }
    } catch (e) {
      // If the regex is invalid
      setIsValidRegex(false);
      setMatches([]);
      setCurrentMatchIndex(-1);
      setFilteredContent(content);
    }
  }, [filter, content]);

  // Scroll to current match
  useEffect(() => {
    if (currentMatchIndex >= 0 && matches.length > 0) {
      const lineNumber = matches[currentMatchIndex];
      const lineElement = document.getElementById(`log-line-${lineNumber}`);

      if (lineElement && logContainerRef.current) {
        lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Add highlight animation
        lineElement.classList.add('bg-yellow-100');
        setTimeout(() => {
          lineElement.classList.remove('bg-yellow-100');
        }, 2000);
      }
    }
  }, [currentMatchIndex, matches]);

  // Highlight matches in the content
  const highlightMatches = (text: string, lineIndex: number) => {
    if (!filter.trim() || !isValidRegex) {
      return text;
    }

    try {
      const regex = new RegExp(`(${filter})`, 'gi');
      const highlighted = text.replace(regex, '<span class="bg-yellow-200">$1</span>');

      // Add extra highlight for the current match
      if (matches[currentMatchIndex] === lineIndex) {
        return highlighted.replace(
          /<span class="bg-yellow-200">(.*?)<\/span>/,
          '<span class="bg-yellow-400 font-bold">$1</span>'
        );
      }

      return highlighted;
    } catch (e) {
      // If the regex is invalid, just return the text as is
      return text;
    }
  };

  // Navigate to next/previous match
  const navigateToMatch = (direction: 'next' | 'prev') => {
    if (matches.length === 0) return;

    if (direction === 'next') {
      setCurrentMatchIndex((prevIndex) => (prevIndex < matches.length - 1 ? prevIndex + 1 : 0));
    } else {
      setCurrentMatchIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : matches.length - 1));
    }
  };

  // Format the log with line numbers
  const formatLog = () => {
    const lines = filteredContent.split('\n');

    return lines.map((line, index) => {
      const isMatchingLine = matches.includes(index);
      const highlightedLine = highlightMatches(line, index);
      const isCurrentMatch = currentMatchIndex >= 0 && matches[currentMatchIndex] === index;

      return (
        <div
          id={`log-line-${index}`}
          key={index}
          className={`log-line flex transition-colors duration-300 ${isMatchingLine ? 'bg-yellow-50' : ''} ${isCurrentMatch ? 'bg-yellow-100' : ''}`}
        >
          {showLineNumbers && (
            <span className='log-line-number text-gray-400 text-xs mr-2 select-none w-12 text-right pr-2 flex-shrink-0'>
              {index + 1}
            </span>
          )}
          <span
            className='log-line-content'
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(highlightedLine) }}
          />
        </div>
      );
    });
  };

  // Count occurrences of the filter in the content
  const getMatchCount = () => {
    return matches.length;
  };

  // Clear filter
  const clearFilter = () => {
    setFilter('');
  };

  return (
    <div className='mt-4'>
      <Card className='mb-4'>
        <div className='flex flex-col sm:flex-row gap-4 items-center'>
          <div className='flex-grow relative'>
            <Input
              placeholder='Filter log (regex supported)'
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className={`w-full ${!isValidRegex ? 'border-red-500' : ''}`}
            />
            {!isValidRegex && (
              <div className='absolute text-xs text-red-500 mt-1'>Invalid regex pattern</div>
            )}
            {filter && (
              <button
                className='absolute right-2 top-2 text-gray-400 hover:text-gray-600'
                onClick={clearFilter}
                type='button'
              >
                ✕
              </button>
            )}
          </div>

          {filter.trim() && matches.length > 0 && (
            <div className='flex items-center space-x-2'>
              <Button variant='secondary' size='small' onClick={() => navigateToMatch('prev')}>
                ↑ Prev
              </Button>
              <Button variant='secondary' size='small' onClick={() => navigateToMatch('next')}>
                ↓ Next
              </Button>
              <span className='text-sm'>
                {currentMatchIndex + 1}/{matches.length} matches
              </span>
            </div>
          )}

          <div className='flex items-center gap-4'>
            <label className='flex items-center gap-2 text-sm'>
              <input
                type='checkbox'
                checked={showLineNumbers}
                onChange={() => setShowLineNumbers(!showLineNumbers)}
                className='form-checkbox'
              />
              Line Numbers
            </label>

            <label className='flex items-center gap-2 text-sm'>
              <input
                type='checkbox'
                checked={wrapText}
                onChange={() => setWrapText(!wrapText)}
                className='form-checkbox'
              />
              Wrap Text
            </label>

            {filter.trim() && isValidRegex && (
              <span className='text-sm text-gray-600'>{getMatchCount()} matches</span>
            )}
          </div>
        </div>
      </Card>

      <Card className='relative'>
        <div className='flex justify-between items-center mb-2'>
          <h2 className='text-lg font-medium'>Log Content</h2>
          <div className='flex gap-2'>
            <Button
              variant='secondary'
              size='small'
              onClick={() => {
                navigator.clipboard.writeText(content);
              }}
            >
              Copy to Clipboard
            </Button>
            <Button
              variant='secondary'
              size='small'
              onClick={() => {
                const blob = new Blob([content], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'crash-log.txt';
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download
            </Button>
          </div>
        </div>

        <div
          ref={logContainerRef}
          className={`bg-gray-900 text-gray-200 p-4 rounded font-mono text-xs overflow-x-auto overflow-y-auto ${
            wrapText ? 'whitespace-pre-wrap' : 'whitespace-pre'
          }`}
          style={{ maxHeight: '60vh' }}
        >
          {formatLog()}
        </div>
      </Card>
    </div>
  );
};
