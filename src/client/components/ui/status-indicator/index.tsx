"use client"

import * as React from "react"
import { cn } from "../../../lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../tooltip"

export type StatusState = "online" | "offline" | "degraded" | "loading"

export interface StatusIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The current status state
   */
  state: StatusState
  
  /**
   * Size of the indicator in pixels
   */
  size?: number
  
  /**
   * Whether to pulse when in loading state
   */
  pulse?: boolean
  
  /**
   * Custom tooltip content
   */
  tooltip?: React.ReactNode
  
  /**
   * Text label to display next to the indicator
   */
  label?: string
}

/**
 * A traffic light style status indicator component
 */
export function StatusIndicator({
  state = "loading",
  size = 12,
  pulse = true,
  tooltip,
  label,
  className,
  ...props
}: StatusIndicatorProps) {
  // Default tooltips based on state
  const defaultTooltip = React.useMemo(() => {
    switch (state) {
      case "online":
        return "System is online and operational"
      case "offline":
        return "System is offline or unreachable"
      case "degraded":
        return "System is experiencing issues"
      case "loading":
        return "Checking system status..."
      default:
        return ""
    }
  }, [state])

  // Colors based on state
  const stateStyles = React.useMemo(() => {
    switch (state) {
      case "online":
        return "bg-green-500"
      case "offline":
        return "bg-red-500"
      case "degraded":
        return "bg-yellow-500"
      case "loading":
        return "bg-blue-500"
      default:
        return "bg-gray-300"
    }
  }, [state])
  
  const indicator = (
    <div className="inline-flex items-center gap-2">
      <div 
        className={cn(
          "rounded-full shadow-sm",
          stateStyles,
          pulse && state === "loading" && "animate-pulse",
          className
        )}
        style={{ width: size, height: size }}
        {...props}
      />
      {label && (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {label}
        </span>
      )}
    </div>
  )

  // If tooltip is disabled (explicitly set to null)
  if (tooltip === null) {
    return indicator
  }

  // With tooltip
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          {indicator}
        </TooltipTrigger>
        <TooltipContent>
          {tooltip || defaultTooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}