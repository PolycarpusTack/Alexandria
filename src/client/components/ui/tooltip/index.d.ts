import * as React from "react";
declare const TooltipProvider: React.FC<{
    children: React.ReactNode;
    skipDelayDuration?: number;
    container?: HTMLElement;
}>;
declare const Tooltip: React.FC<{
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    delayDuration?: number;
    disableHoverableContent?: boolean;
    children: React.ReactNode;
}>;
declare const TooltipTrigger: React.ForwardRefExoticComponent<Omit<Omit<React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>, "ref"> & React.RefAttributes<HTMLButtonElement>, "ref"> & React.RefAttributes<HTMLButtonElement>>;
declare const TooltipContent: React.ForwardRefExoticComponent<Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
    side?: "top" | "right" | "bottom" | "left";
    sideOffset?: number;
    align?: "start" | "center" | "end";
    alignOffset?: number;
    avoidCollisions?: boolean;
    sticky?: "partial" | "always";
    hideWhenDetached?: boolean;
} & React.RefAttributes<HTMLDivElement>, "ref"> & React.RefAttributes<HTMLDivElement>>;
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
