import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from './ui/command';
import { createClientLogger } from '../utils/client-logger';

const logger = createClientLogger({ serviceName: 'command-palette' });

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  const runCommand = React.useCallback(
    (command: () => void) => {
      onOpenChange(false);
      command();
    },
    [onOpenChange]
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder='Type a command or search...' />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading='Navigation'>
          <CommandItem onSelect={() => runCommand(() => navigate('/'))}>
            <i className='fa-solid fa-home mr-2' />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/crash-analyzer'))}>
            <i className='fa-solid fa-microchip mr-2' />
            <span>Crash Analyzer</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/log-visualization'))}>
            <i className='fa-solid fa-chart-line mr-2' />
            <span>Log Visualization</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/ticket-analysis'))}>
            <i className='fa-solid fa-ticket mr-2' />
            <span>Ticket Analysis</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading='System'>
          <CommandItem onSelect={() => runCommand(() => navigate('/configuration'))}>
            <i className='fa-solid fa-cog mr-2' />
            <span>Configuration</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/user-settings'))}>
            <i className='fa-solid fa-user-cog mr-2' />
            <span>User Settings</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                document.documentElement.classList.toggle('dark');
              })
            }
          >
            <i className='fa-solid fa-moon mr-2' />
            <span>Toggle Theme</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading='LLM Models'>
          <CommandItem onSelect={() => runCommand(() => logger.info('Starting Vicuna'))}>
            <i className='fa-solid fa-play mr-2' />
            <span>Start Vicuna</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => logger.info('Stopping LLama2'))}>
            <i className='fa-solid fa-stop mr-2' />
            <span>Stop Llama2</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
