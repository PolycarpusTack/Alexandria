/**
 * UI Components for the client application
 * 
 * This file exports all UI components for use in the client application
 */

// Export UI components
export { Button } from './button';
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from './card';
export { Input } from './input';
export { Textarea } from './textarea';
export { default as Modal } from './modal';
export { default as UIShell } from './ui-shell';
export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption } from './table';
export { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs';
export { Badge, badgeVariants } from './badge';
export { Avatar, AvatarImage, AvatarFallback } from './avatar';
export { Collapsible, CollapsibleTrigger, CollapsibleContent } from './collapsible';
export { Alert, AlertTitle, AlertDescription } from './alert';

// Export Dropdown Menu components
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from './dropdown-menu';

// Toast components
export { useToast, ToastProvider } from './use-toast';
export { Toaster } from './toaster';

// Progress and Scroll Area components  
export { Progress } from './progress';
export { ScrollArea, ScrollBar } from './scroll-area';

// Alert Dialog components
export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from './alert-dialog';

// Context
export { UIContext, UIContextProvider, useUI, UIRegistryImpl } from '../../context/ui-context';