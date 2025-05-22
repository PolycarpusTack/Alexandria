/**
 * UI Components for the client application
 * 
 * This file exports all UI components for use in the client application
 */

// Export UI components
export { Button } from './button';
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from './card';
export { Input } from './input';
export { default as Modal } from './modal';
export { default as UIShell } from './ui-shell';
export { default as Table } from './table';
export { default as Tabs } from './tabs';
export { default as Badge } from './badge';
export { default as Avatar } from './avatar';
export { default as Collapsible } from './collapsible';

// Export Dropdown Menu components
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from './dropdown-menu';

// Context
export { UIContext, UIContextProvider, useUI, UIRegistryImpl } from '../../context/ui-context';