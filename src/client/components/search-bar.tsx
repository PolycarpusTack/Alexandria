import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

export function SearchBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim()) return;

    setIsSearching(true);

    // Simulate a search request
    setTimeout(() => {
      // Mock search results
      setResults([
        { id: 1, type: 'plugin', title: 'Crash Analyzer', path: '/crash-analyzer' },
        { id: 2, type: 'document', title: 'System Configuration', path: '/configuration' },
        { id: 3, type: 'model', title: 'Vicuna 13B', path: '/models/vicuna' }
      ]);
      setIsSearching(false);
    }, 500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <>
      <div className='relative w-full max-w-sm lg:max-w-lg'>
        <Button
          variant='outline'
          className='w-full justify-start text-muted-foreground'
          onClick={() => setOpen(true)}
        >
          <i className='fa-solid fa-search mr-2'></i>
          <span>Search everything...</span>
          <kbd className='ml-auto inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100'>
            <span className='text-xs'>⌘</span>K
          </kbd>
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='sm:max-w-[600px]'>
          <DialogHeader>
            <DialogTitle>Search Alexandria Platform</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSearch} className='grid gap-4 py-4'>
            <div className='relative'>
              <Input
                placeholder='Search for plugins, documentation, models...'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className='pr-10'
                autoFocus
              />
              <Button
                type='submit'
                size='sm'
                variant='ghost'
                className='absolute right-0 top-0 h-full px-3'
                disabled={isSearching}
              >
                {isSearching ? (
                  <i className='fa-solid fa-spinner fa-spin'></i>
                ) : (
                  <i className='fa-solid fa-search'></i>
                )}
              </Button>
            </div>

            {results.length > 0 && (
              <div className='max-h-60 overflow-y-auto rounded-md border p-2'>
                {results.map((result) => (
                  <div
                    key={result.id}
                    className='flex items-center gap-2 rounded-md p-2 hover:bg-muted cursor-pointer'
                    onClick={() => {
                      setOpen(false);
                      // In a real app, navigate to the result path
                    }}
                  >
                    <div className='flex h-8 w-8 items-center justify-center rounded-md bg-primary/10'>
                      {result.type === 'plugin' && (
                        <i className='fa-solid fa-puzzle-piece text-primary'></i>
                      )}
                      {result.type === 'document' && (
                        <i className='fa-solid fa-file-alt text-primary'></i>
                      )}
                      {result.type === 'model' && (
                        <i className='fa-solid fa-robot text-primary'></i>
                      )}
                    </div>
                    <div className='flex flex-col'>
                      <span className='text-sm font-medium'>{result.title}</span>
                      <span className='text-xs text-muted-foreground'>{result.type}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
