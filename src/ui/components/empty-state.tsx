import React from 'react';

export interface EmptyStateProps {
  /**
   * Title of the empty state
   */
  title: string;

  /**
   * Description text
   */
  description?: string;

  /**
   * Icon or image component to display
   */
  icon?: React.ReactNode;

  /**
   * Actions to display (typically buttons)
   */
  actions?: React.ReactNode;

  /**
   * Additional CSS class names
   */
  className?: string;
}

/**
 * EmptyState component for displaying when there is no content to show.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  actions,
  className = ''
}) => {
  return (
    <div className={`alexandria-empty-state ${className}`}>
      {icon && <div className='alexandria-empty-state-icon'>{icon}</div>}

      <h3 className='alexandria-empty-state-title'>{title}</h3>

      {description && <p className='alexandria-empty-state-description'>{description}</p>}

      {actions && <div className='alexandria-empty-state-actions'>{actions}</div>}
    </div>
  );
};
