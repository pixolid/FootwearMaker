import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'
import type { Toast as ToastType } from '@/hooks/useToast'
import { useTheme } from '@/hooks/useTheme'

interface ToastContainerProps {
  toasts: ToastType[]
  onDismiss: (id: string) => void
}

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
}

const iconColors = {
  success: 'text-emerald-400',
  error: 'text-red-400',
  info: 'text-indigo-400',
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  const { isDark } = useTheme()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 max-w-sm">
      {toasts.map((toast) => {
        const Icon = icons[toast.type]
        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 p-4 rounded-2xl border backdrop-blur-xl shadow-xl
              animate-[slideIn_0.3s_ease-out]
              ${
                isDark
                  ? 'bg-slate-900/90 border-white/10'
                  : 'bg-white/90 border-slate-200'
              }`}
          >
            <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${iconColors[toast.type]}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{toast.title}</p>
              {toast.description && (
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {toast.description}
                </p>
              )}
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className={`shrink-0 p-1 rounded-lg transition-colors ${
                isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
