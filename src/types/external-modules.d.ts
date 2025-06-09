/**
 * Type declarations for external modules
 * 
 * This file provides type declarations for external modules that may not have
 * their own TypeScript definitions or where we need to augment existing definitions.
 */

// Radix UI Tooltip
declare module '@radix-ui/react-tooltip' {
  import * as React from 'react';

  export interface TooltipProps {
    children: React.ReactNode;
    content: React.ReactNode;
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    delayDuration?: number;
    disableHoverableContent?: boolean;
  }

  export const Root: React.FC<{
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    delayDuration?: number;
    disableHoverableContent?: boolean;
    children: React.ReactNode;
  }>;

  export const Trigger: React.ForwardRefExoticComponent<
    React.ComponentPropsWithoutRef<'button'> & React.RefAttributes<HTMLButtonElement>
  >;

  export const Content: React.ForwardRefExoticComponent<
    React.ComponentPropsWithoutRef<'div'> & 
    {
      side?: 'top' | 'right' | 'bottom' | 'left';
      sideOffset?: number;
      align?: 'start' | 'center' | 'end';
      alignOffset?: number;
      avoidCollisions?: boolean;
      sticky?: 'partial' | 'always';
      hideWhenDetached?: boolean;
    } & 
    React.RefAttributes<HTMLDivElement>
  >;

  export const Arrow: React.ForwardRefExoticComponent<
    React.ComponentPropsWithoutRef<'svg'> & 
    {
      width?: number;
      height?: number;
    } & 
    React.RefAttributes<SVGSVGElement>
  >;

  export const Portal: React.FC<{
    container?: HTMLElement;
    children: React.ReactNode;
  }>;

  export const Provider: React.FC<{
    children: React.ReactNode;
    skipDelayDuration?: number;
    container?: HTMLElement;
  }>;
}

// Multer
declare module 'multer' {
  import { Request, Response } from 'express';
  import { Options } from 'busboy';

  export interface File {
    /** Field name specified in the form */
    fieldname: string;
    /** Name of the file on the user's computer */
    originalname: string;
    /** Encoding type of the file */
    encoding: string;
    /** Mime type of the file */
    mimetype: string;
    /** Size of the file in bytes */
    size: number;
    /** The folder to which the file has been saved (DiskStorage) */
    destination?: string;
    /** The name of the file within the destination (DiskStorage) */
    filename?: string;
    /** Location of the uploaded file (DiskStorage) */
    path?: string;
    /** A Buffer of the entire file (MemoryStorage) */
    buffer?: Buffer;
  }

  export interface FileFilterCallback {
    (error: Error | null, acceptFile: boolean): void;
  }

  export type StorageEngine = any;

  export interface StorageOptions {
    destination?: string | ((req: Request, file: Express.Multer.File, callback: (error: Error | null, destination: string) => void) => void);
    filename?: (req: Request, file: Express.Multer.File, callback: (error: Error | null, filename: string) => void) => void;
  }

  export type DiskStorageOptions = StorageOptions;

  export interface MulterOptions {
    dest?: string;
    storage?: StorageEngine;
    limits?: {
      fieldNameSize?: number;
      fieldSize?: number;
      fields?: number;
      fileSize?: number;
      files?: number;
      parts?: number;
      headerPairs?: number;
    };
    preservePath?: boolean;
    fileFilter?: (req: Request, file: Express.Multer.File, callback: FileFilterCallback) => void;
  }

  export function diskStorage(options: DiskStorageOptions): StorageEngine;
  export function memoryStorage(): StorageEngine;

  function multer(options?: MulterOptions): Multer;
  namespace multer { }
  export default multer;

  export interface Multer {
    single(fieldName: string): any;
    array(fieldName: string, maxCount?: number): any;
    fields(fields: Array<{ name: string; maxCount?: number }>): any;
    none(): any;
    any(): any;
  }
}

// Axios - removed empty module declaration as axios includes its own type definitions

// Lucide React icons
declare module 'lucide-react' {
  import * as React from 'react';

  export interface IconProps extends React.SVGProps<SVGSVGElement> {
    size?: string | number;
    strokeWidth?: string | number;
    absoluteStrokeWidth?: boolean;
  }

  export const SecurityScanIcon: React.FC<IconProps>;
  export const ShieldCheckIcon: React.FC<IconProps>;
  export const ShieldAlertIcon: React.FC<IconProps>;
  export const ShieldXIcon: React.FC<IconProps>;
  
  // Add other Lucide icons as needed
}