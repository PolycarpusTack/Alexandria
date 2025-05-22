"use client"

import React, { useEffect, useState, useCallback } from 'react'
import { StatusIndicator } from '../../../../client/components/ui/status-indicator'
import { CrashAnalyzerService } from '../../src/services/crash-analyzer-service'
import { Button, toast } from '../../../../ui/components'

interface OllamaStatusIndicatorProps {
  crashAnalyzerService: CrashAnalyzerService
  pollingInterval?: number
  showDetails?: boolean
  onRetry?: () => void
}

/**
 * A status indicator that shows the current status of the Ollama service.
 * Uses traffic light colors to indicate status:
 * - Green: Online and ready
 * - Yellow: Degraded performance or initializing
 * - Red: Offline or error
 * - Blue: Loading/checking status
 */
export function OllamaStatusIndicator({ 
  crashAnalyzerService,
  pollingInterval = 30000, // Default to checking every 30 seconds
  showDetails = false,
  onRetry
}: OllamaStatusIndicatorProps) {
  const [status, setStatus] = useState<"online" | "offline" | "degraded" | "loading">("loading")
  const [statusMessage, setStatusMessage] = useState<string>("Checking Ollama status...")
  const [responseTime, setResponseTime] = useState<number | null>(null)
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [isExpanded, setIsExpanded] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)

  // Function to check Ollama status
  const checkStatus = useCallback(async () => {
    try {
      setStatus("loading")
      setIsRetrying(true)
      
      const startTime = Date.now()
      const llmService = crashAnalyzerService.getLlmService()
      const isAvailable = await llmService.checkAvailability()
      const endTime = Date.now()
      
      const latency = endTime - startTime
      setResponseTime(latency)
      
      if (isAvailable) {
        // If response time is over 1 second, consider it degraded
        if (latency > 1000) {
          setStatus("degraded")
          setStatusMessage(`Ollama is responding slowly (${latency}ms)`)
        } else {
          setStatus("online")
          setStatusMessage(`Ollama is online and ready (${latency}ms)`)
        }
        
        // Get available models if online
        try {
          const models = await llmService.getAvailableModels()
          setAvailableModels(models)
        } catch (modelError) {
          console.error('Error fetching available models:', modelError)
        }
      } else {
        setStatus("offline")
        setStatusMessage("Ollama is unavailable")
        setAvailableModels([])
      }
    } catch (error) {
      setStatus("offline")
      setStatusMessage(`Error connecting to Ollama: ${error instanceof Error ? error.message : String(error)}`)
      setAvailableModels([])
    } finally {
      setIsRetrying(false)
    }
  }, [crashAnalyzerService])
  
  // Handle manual retry
  const handleRetry = () => {
    checkStatus()
    if (onRetry) {
      onRetry()
    }
    
    toast?.({ 
      title: 'Checking Ollama Connection', 
      description: 'Attempting to connect to Ollama service...'
    })
  }

  // Check status on component mount and start polling
  useEffect(() => {
    // Initial check
    checkStatus()
    
    // Set up polling
    const intervalId = setInterval(checkStatus, pollingInterval)
    
    // Clean up on unmount
    return () => clearInterval(intervalId)
  }, [pollingInterval, checkStatus])

  // Toggle details panel
  const toggleDetails = () => {
    setIsExpanded(!isExpanded)
  }
  
  if (!showDetails) {
    // Simple indicator only
    return (
      <StatusIndicator 
        state={status} 
        tooltip={statusMessage}
        label="Ollama"
        size={10}
        className="mr-2 cursor-pointer"
        onClick={toggleDetails}
      />
    )
  }
  
  // Detailed indicator with expanded panel
  return (
    <div className="relative">
      <div 
        className="flex items-center cursor-pointer" 
        onClick={toggleDetails}
      >
        <StatusIndicator 
          state={status} 
          label="Ollama"
          size={12}
          className="mr-2"
        />
        <span className="text-sm font-medium">
          {status === "online" ? "Online" : 
           status === "degraded" ? "Degraded" : 
           status === "offline" ? "Offline" : "Checking..."}
        </span>
        {responseTime !== null && status !== "loading" && (
          <span className="text-xs ml-2 text-gray-500">
            {responseTime}ms
          </span>
        )}
        <span className="ml-1">{isExpanded ? "▼" : "▶"}</span>
      </div>
      
      {isExpanded && (
        <div className="mt-2 p-3 bg-white shadow-md rounded-md border text-sm absolute z-10 w-72">
          <div className="font-medium mb-1">Ollama Status</div>
          <div className="text-gray-700">{statusMessage}</div>
          
          {status === "online" && availableModels.length > 0 && (
            <div className="mt-2">
              <div className="font-medium mb-1">Available Models ({availableModels.length})</div>
              <div className="max-h-24 overflow-y-auto">
                <ul className="list-disc list-inside">
                  {availableModels.map((model, index) => (
                    <li key={index} className="text-xs">{model}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          
          {status === "offline" && (
            <div className="mt-2">
              <div className="font-medium mb-1 text-red-600">Troubleshooting</div>
              <ul className="list-disc list-inside text-xs">
                <li>Check if Ollama is running locally</li>
                <li>Verify network connectivity</li>
                <li>Check for firewall or permission issues</li>
                <li>Try restarting the Ollama service</li>
              </ul>
            </div>
          )}
          
          <div className="mt-3 flex justify-end">
            <Button
              variant="secondary"
              size="small"
              onClick={handleRetry}
              disabled={isRetrying}
            >
              {isRetrying ? "Checking..." : "Retry Connection"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}