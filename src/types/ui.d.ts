/**
 * Type declarations for UI components with deep relative paths
 */

// Handle deep relative imports for UI components
declare module '../../../../ui/components' {
  // Re-export the components from the actual UI components module
  export * from '@ui/components';
}

// Handle deep relative imports for UI context
declare module '../../../../ui/ui-context' {
  // Re-export from the actual UI context module
  export * from '@ui/ui-context';
}

// Handle different depth paths
declare module '../../../ui/components' {
  export * from '@ui/components';
}

declare module '../../../ui/ui-context' {
  export * from '@ui/ui-context';
}

// Handle imports for the ui/components/ui subdirectory from various depths
declare module '../../../../ui/components/ui/card' {
  export * from '@client/components/ui/card';
}

declare module '../../../ui/components/ui/card' {
  export * from '@client/components/ui/card';
}

declare module '../../../../ui/components/ui/table' {
  export * from '@client/components/ui/table';
}

declare module '../../../ui/components/ui/table' {
  export * from '@client/components/ui/table';
}

declare module '../../../../ui/components/ui/tooltip' {
  export * from '@client/components/ui/tooltip';
}

declare module '../../../ui/components/ui/tooltip' {
  export * from '@client/components/ui/tooltip';
}

declare module '../../../../ui/components/ui/badge' {
  export * from '@client/components/ui/badge';
}

declare module '../../../ui/components/ui/badge' {
  export * from '@client/components/ui/badge';
}

// Handle two-level paths
declare module '../../ui/components' {
  export * from '@ui/components';
}

declare module '../../ui/ui-context' {
  export * from '@ui/ui-context';
}

// Handle direct paths for ui components
declare module 'ui/components' {
  export * from '@ui/components';
}

// Handle absolute path with @ syntax
declare module '@ui/components' {
  // This will be exported from our ui-components-exports.d.ts file
}

// Handle absolute path for client components
declare module '@client/components/ui/card' {
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

declare module '@client/components/ui/table' {
  import * as React from 'react';

  export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {}
  export interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {}
  export interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {}
  export interface TableFooterProps extends React.HTMLAttributes<HTMLTableSectionElement> {}
  export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {}
  export interface TableHeadProps extends React.HTMLAttributes<HTMLTableCellElement> {}
  export interface TableCellProps extends React.HTMLAttributes<HTMLTableCellElement> {}

  export const Table: React.FC<TableProps>;
  export const TableHeader: React.FC<TableHeaderProps>;
  export const TableBody: React.FC<TableBodyProps>;
  export const TableFooter: React.FC<TableFooterProps>;
  export const TableRow: React.FC<TableRowProps>;
  export const TableHead: React.FC<TableHeadProps>;
  export const TableCell: React.FC<TableCellProps>;
}