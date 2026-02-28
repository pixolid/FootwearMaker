import { Footprints, ArrowRight } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

interface WelcomePanelProps {
  onStart: () => void
}

export function WelcomePanel({ onStart }: WelcomePanelProps) {
  const { isDark } = useTheme()

  return (
    <div className="space-y-6 text-center py-4">
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
          <Footprints className="w-8 h-8 text-indigo-400" />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold mb-2">Welcome to FootwearMaker</h3>
        <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Create custom footwear designs by combining shoe and last models.
          Use Free-Form Deformation to craft the perfect fit.
        </p>
      </div>

      <div className={`text-left space-y-3 p-4 rounded-xl ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
        <p className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          Workflow
        </p>
        {[
          'Load a shoe model (OBJ, GLB, STL)',
          'Load a shoe last model',
          'Transform and deform using FFD',
          'Compute result & export',
        ].map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                isDark
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'bg-indigo-100 text-indigo-600'
              }`}
            >
              {i + 1}
            </div>
            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {step}
            </span>
          </div>
        ))}
      </div>

      <button
        onClick={onStart}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium
          bg-indigo-500 text-white hover:bg-indigo-600 active:scale-[0.98] transition-all"
      >
        Start New Project
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}
