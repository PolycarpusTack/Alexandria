import React, { useState, useEffect, ReactNode } from 'react';

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}

export interface DialogTriggerProps {
  asChild?: boolean;
  children: ReactNode;
  className?: string;
}

export interface DialogContentProps {
  children: ReactNode;
  className?: string;
  onInteractOutside?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onEscapeKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
}

export interface DialogHeaderProps {
  className?: string;
  children: ReactNode;
}

export interface DialogTitleProps {
  className?: string;
  children: ReactNode;
}

export interface DialogDescriptionProps {
  className?: string;
  children: ReactNode;
}

export interface DialogFooterProps {
  className?: string;
  children: ReactNode;
}

export interface DialogCloseProps {
  asChild?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Dialog root component
 */
export const Dialog: React.FC<DialogProps> = ({
  children,
  open,
  defaultOpen = false,
  onOpenChange,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(open ?? defaultOpen);

  // Update internal state when open prop changes
  useEffect(() => {
    if (open !== undefined) {
      setIsOpen(open);
    }
  }, [open]);

  // Notify parent when internal state changes
  useEffect(() => {
    if (onOpenChange && open !== isOpen) {
      onOpenChange(isOpen);
    }
  }, [isOpen, onOpenChange, open]);

  return (
    <div className={`alexandria-dialog ${className}`} data-state={isOpen ? 'open' : 'closed'}>
      {children}
    </div>
  );
};

/**
 * Dialog trigger component
 */
export const DialogTrigger: React.FC<DialogTriggerProps> = ({
  children,
  asChild = false,
  className = ''
}) => {
  return <div className={`alexandria-dialog-trigger ${className}`}>{children}</div>;
};

/**
 * Dialog content component
 */
export const DialogContent: React.FC<DialogContentProps> = ({
  children,
  className = '',
  onInteractOutside,
  onEscapeKeyDown
}) => {
  return (
    <div
      className={`alexandria-dialog-content ${className}`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && onEscapeKeyDown) {
          onEscapeKeyDown(e);
        }
      }}
    >
      {children}
    </div>
  );
};

/**
 * Dialog header component
 */
export const DialogHeader: React.FC<DialogHeaderProps> = ({ children, className = '' }) => {
  return <div className={`alexandria-dialog-header ${className}`}>{children}</div>;
};

/**
 * Dialog title component
 */
export const DialogTitle: React.FC<DialogTitleProps> = ({ children, className = '' }) => {
  return <h2 className={`alexandria-dialog-title ${className}`}>{children}</h2>;
};

/**
 * Dialog description component
 */
export const DialogDescription: React.FC<DialogDescriptionProps> = ({
  children,
  className = ''
}) => {
  return <div className={`alexandria-dialog-description ${className}`}>{children}</div>;
};

/**
 * Dialog footer component
 */
export const DialogFooter: React.FC<DialogFooterProps> = ({ children, className = '' }) => {
  return <div className={`alexandria-dialog-footer ${className}`}>{children}</div>;
};

/**
 * Dialog close component
 */
export const DialogClose: React.FC<DialogCloseProps> = ({
  children,
  asChild = false,
  className = ''
}) => {
  return <div className={`alexandria-dialog-close ${className}`}>{children}</div>;
};
