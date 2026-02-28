import { useState, useCallback } from 'react'

export interface Toast {
  id: string
  title: string
  description?: string
  type: 'success' | 'error' | 'info'
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback(
    ({
      title,
      description,
      type = 'info',
    }: {
      title: string
      description?: string
      type?: Toast['type']
    }) => {
      const id = Math.random().toString(36).substring(2, 9)
      const newToast: Toast = { id, title, description, type }
      setToasts((prev) => [...prev, newToast])

      // Auto-remove after 4s
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 4000)
    },
    [],
  )

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { toasts, toast, dismiss }
}
