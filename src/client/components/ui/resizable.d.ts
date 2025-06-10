/**
 * Resizable Component
 *
 * Based on react-resizable-panels for split pane functionality
 */
import * as React from "react";
interface ResizablePanelGroupProps {
    direction: "horizontal" | "vertical";
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
export declare function ResizablePanelGroup({ direction, className, children }: ResizablePanelGroupProps): React.JSX.Element;
export declare function ResizablePanel({ defaultSize, minSize, maxSize, className, children }: ResizablePanelProps): React.JSX.Element;
export declare function ResizableHandle({ className }: ResizableHandleProps): React.JSX.Element;
export {};
