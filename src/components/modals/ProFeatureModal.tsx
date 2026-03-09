import { Crown, X } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { UPGRADE_URL } from '@/types/subscription'

interface ProFeatureModalProps {
  open: boolean
  onClose: () => void
  /** The feature name shown in the modal message */
  featureName: string
}

export function ProFeatureModal({ open, onClose, featureName }: ProFeatureModalProps) {
  const { isDark } = useTheme()

  if (!open) return null

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className={`relative z-10 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden
          ${isDark ? 'bg-slate-900' : 'bg-white'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center transition-colors
            ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="px-6 pt-8 pb-6 flex flex-col items-center text-center">
          {/* Crown icon */}
          <div className="w-14 h-14 rounded-2xl bg-amber-400/20 flex items-center justify-center mb-4">
            <Crown className="w-7 h-7 text-amber-400" />
          </div>

          <h2 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            Pro Feature
          </h2>

          <p className={`text-sm leading-relaxed mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <span className={`font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
              "{featureName}"
            </span>{' '}
            requires a Pro subscription. Upgrade your plan to unlock Save/Load states and more.
          </p>

          <div className="flex flex-col gap-2 w-full">
            <a
              href={UPGRADE_URL}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-center
                bg-amber-400 hover:bg-amber-300 text-amber-900 transition-colors active:scale-[0.98]"
            >
              Upgrade Plan
            </a>
            <button
              onClick={onClose}
              className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors
                ${isDark
                  ? 'hover:bg-white/10 text-slate-400'
                  : 'hover:bg-slate-100 text-slate-500'
                }`}
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
