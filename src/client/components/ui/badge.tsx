import * as React from 'react';
import { cva } from 'class-variance-authority';

import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground'
      },
      color: {
        default: '',
        green: 'border-transparent bg-green-100 text-green-800 hover:bg-green-200',
        red: 'border-transparent bg-red-100 text-red-800 hover:bg-red-200',
        yellow: 'border-transparent bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
        blue: 'border-transparent bg-blue-100 text-blue-800 hover:bg-blue-200',
        purple: 'border-transparent bg-purple-100 text-purple-800 hover:bg-purple-200',
        indigo: 'border-transparent bg-indigo-100 text-indigo-800 hover:bg-indigo-200',
        pink: 'border-transparent bg-pink-100 text-pink-800 hover:bg-pink-200',
        orange: 'border-transparent bg-orange-100 text-orange-800 hover:bg-orange-200',
        teal: 'border-transparent bg-teal-100 text-teal-800 hover:bg-teal-200',
        cyan: 'border-transparent bg-cyan-100 text-cyan-800 hover:bg-cyan-200',
        gray: 'border-transparent bg-gray-100 text-gray-800 hover:bg-gray-200'
      }
    },
    defaultVariants: {
      variant: 'default',
      color: 'default'
    }
  }
);

export interface BadgeProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'color'>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, color, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, color }), className)} {...props} />;
}

export { Badge, badgeVariants };
