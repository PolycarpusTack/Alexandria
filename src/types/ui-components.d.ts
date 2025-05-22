/**
 * Type declarations for specific UI components with deep relative paths
 */

// Handle deep relative imports for LoadingSpinner
declare module '../../../../ui/components/LoadingSpinner' {
  export interface LoadingSpinnerProps {
    size?: 'small' | 'medium' | 'large';
    color?: string;
    className?: string;
  }
  
  export const LoadingSpinner: React.FC<LoadingSpinnerProps>;
}

// Handle different import depth for LoadingSpinner
declare module '../../../ui/components/LoadingSpinner' {
  export * from '../../../../ui/components/LoadingSpinner';
}

// Handle even different import depth for LoadingSpinner
declare module '../ui/components/LoadingSpinner' {
  export * from '../../../../ui/components/LoadingSpinner';
}

// Handle Card component imports
declare module '../../../ui/components/ui/card' {
  import * as React from 'react';

  export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}
  export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}
  export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}
  export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}
  export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}
  export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

  export const Card: React.FC<CardProps>;
  export const CardHeader: React.FC<CardHeaderProps>;
  export const CardTitle: React.FC<CardTitleProps>;
  export const CardDescription: React.FC<CardDescriptionProps>;
  export const CardContent: React.FC<CardContentProps>;
  export const CardFooter: React.FC<CardFooterProps>;
}