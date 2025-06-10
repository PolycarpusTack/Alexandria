import * as React from "react";
import { type VariantProps } from "class-variance-authority";
declare const badgeVariants: (props?: ({
    variant?: "default" | "destructive" | "outline" | "secondary" | null | undefined;
    color?: "default" | "green" | "red" | "yellow" | "blue" | "purple" | "indigo" | "pink" | "orange" | "teal" | "cyan" | "gray" | null | undefined;
} & import("class-variance-authority/dist/types").ClassProp) | undefined) => string;
export interface BadgeProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'color'>, VariantProps<typeof badgeVariants> {
}
declare function Badge({ className, variant, color, ...props }: BadgeProps): React.JSX.Element;
export { Badge, badgeVariants };
