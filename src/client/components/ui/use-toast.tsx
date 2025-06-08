import * as React from "react"

interface Toast {
  id: string
  title?: string
  description?: string
  action?: React.ReactNode
  variant?: "default" | "destructive"
}

interface ToastContextType {
  toasts: Toast[]
  toast: (toast: Omit<Toast, "id">) => void
  dismiss: (toastId?: string) => void
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const toast = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast = { ...toast, id }
    
    setToasts((prevToasts) => [...prevToasts, newToast])
    
    // Auto dismiss after 5 seconds
    setTimeout(() => {
      setToasts((prevToasts) => prevToasts.filter((t) => t.id !== id))
    }, 5000)
  }, [])

  const dismiss = React.useCallback((toastId?: string) => {
    setToasts((prevToasts) =>
      toastId
        ? prevToasts.filter((t) => t.id !== toastId)
        : []
    )
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    // Return a mock implementation when not in provider
    return {
      toast: (toast: Omit<Toast, "id">) => {

      },
      toasts: [],
      dismiss: () => {}
    }
  }
  return context
}