/**
 * Resizable Component
 *
 * Based on react-resizable-panels for split pane functionality
 */

import * as React from 'react';
import { cn } from '../../lib/utils';

interface ResizablePanelGroupProps {
  direction: 'horizontal' | 'vertical';
  className?: string;
  children: React.ReactNode;
}

interface ResizablePanelProps {
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  className?: string;
  children: React.ReactNode;
}

interface ResizableHandleProps {
  className?: string;
}

const ResizablePanelGroupContext = React.createContext<{
  direction: 'horizontal' | 'vertical';
} | null>(null);

export function ResizablePanelGroup({ direction, className, children }: ResizablePanelGroupProps) {
  return (
    <ResizablePanelGroupContext.Provider value={{ direction }}>
      <div
        className={cn(
          'flex h-full w-full',
          direction === 'horizontal' ? 'flex-row' : 'flex-col',
          className
        )}
      >
        {children}
      </div>
    </ResizablePanelGroupContext.Provider>
  );
}

export function ResizablePanel({
  defaultSize = 50,
  minSize = 10,
  maxSize = 90,
  className,
  children
}: ResizablePanelProps) {
  const context = React.useContext(ResizablePanelGroupContext);
  const [size, setSize] = React.useState(defaultSize);

  return (
    <div
      className={cn('relative overflow-hidden', className)}
      style={{
        [context?.direction === 'horizontal' ? 'width' : 'height']: `${size}%`
      }}
    >
      {children}
    </div>
  );
}

export function ResizableHandle({ className }: ResizableHandleProps) {
  const context = React.useContext(ResizablePanelGroupContext);
  const [isDragging, setIsDragging] = React.useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Handle resize logic here
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div
      className={cn(
        'relative z-10 flex items-center justify-center',
        context?.direction === 'horizontal' ? 'w-px cursor-col-resize' : 'h-px cursor-row-resize',
        className
      )}
      onMouseDown={handleMouseDown}
    >
      <div
        className={cn(
          'bg-border',
          context?.direction === 'horizontal' ? 'h-full w-px hover:w-1' : 'w-full h-px hover:h-1',
          isDragging && 'bg-primary'
        )}
      />
    </div>
  );
}
