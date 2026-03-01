import { X, LogOut, ChevronLeft, ChevronRight, Box } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { useAuth } from '@/hooks/useAuth'
import { doSignOut } from '@/firebase/auth'
import type { ReactNode } from 'react'

interface SidebarProps {
  open: boolean
  onClose: () => void
  currentStep: number
  maxReachedStep: number
  onStepChange: (step: number) => void
  children: ReactNode
  canGoNext: boolean
  canGoPrev: boolean
  credits: number
  onOpenGallery: () => void
}

const STEPS = [
  { label: 'Shoe' },
  { label: 'Last' },
  { label: 'Modify' },
  { label: 'Result' },
]

export function Sidebar({
  open,
  onClose,
  currentStep,
  maxReachedStep,
  onStepChange,
  children,
  canGoNext,
  canGoPrev,
  credits,
  onOpenGallery,
}: SidebarProps) {
  const { isDark } = useTheme()
  const { user } = useAuth()

  return (
    <div
      className={`absolute top-0 left-0 h-full z-40 transition-transform duration-300 ease-out ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
      style={{ width: '340px' }}
    >
      <div
        className={`w-full h-full flex flex-col backdrop-blur-xl shadow-2xl ${
          isDark
            ? 'bg-slate-900/95'
            : 'bg-slate-50/95'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between p-4 border-b ${
            isDark ? 'border-white/[0.06]' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <img
              src="/FootwearMaker/pixogen_logo2.png"
              alt="Pixogen"
              className={`w-[200px] h-[80px] object-contain ${isDark ? 'invert' : ''}`}
            />
          </div>
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Indicator — tabs only visible once that step has been reached */}
        {currentStep > 0 && (
          <div className={`px-4 py-3 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
            <div className="flex items-center gap-1">
              {STEPS.map((step, index) => {
                const stepNum = index + 1
                const isReached = stepNum <= maxReachedStep
                const isCurrent = stepNum === currentStep
                const isPast = stepNum < currentStep

                // Hide tabs not yet reached
                if (!isReached) return null

                return (
                  <div key={index} className="flex items-center flex-1 min-w-0">
                    <button
                      onClick={() => onStepChange(stepNum)}
                      className={`w-full py-1.5 px-2 rounded-lg text-xs font-medium transition-all truncate ${
                        isCurrent
                          ? 'bg-indigo-500 text-white'
                          : isPast
                            ? isDark
                              ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30'
                              : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
                            : isDark
                              ? 'bg-white/5 text-slate-500 cursor-default'
                              : 'bg-slate-200 text-slate-400 cursor-default'
                      }`}
                    >
                      {step.label}
                    </button>
                    {/* Connector — only show between visible steps */}
                    {index < STEPS.length - 1 && stepNum + 1 <= maxReachedStep && (
                      <div
                        className={`w-2 h-px mx-1 shrink-0 ${
                          isPast ? 'bg-indigo-500' : isDark ? 'bg-white/10' : 'bg-slate-200'
                        }`}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">{children}</div>

        {/* Navigation — hidden on Welcome (step 0) */}
        {currentStep > 0 && (
          <div
            className={`flex items-center gap-3 p-4 border-t ${
              isDark ? 'border-white/[0.06]' : 'border-slate-200'
            }`}
          >
            <button
              onClick={() => onStepChange(currentStep - 1)}
              disabled={!canGoPrev}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all
                disabled:opacity-30 disabled:cursor-not-allowed
                ${
                  isDark
                    ? 'bg-white/5 hover:bg-white/10 text-slate-300'
                    : 'bg-slate-200 hover:bg-slate-100 text-slate-600'
                }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            {currentStep < 4 && (
              <button
                onClick={() => onStepChange(currentStep + 1)}
                disabled={!canGoNext}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium
                  bg-indigo-500 text-white hover:bg-indigo-600 active:scale-[0.98] transition-all
                  disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {currentStep === 3 ? 'Result' : 'Next'}
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* 3D Gallery button */}
        <div
          className={`px-4 py-3 border-t ${
            isDark ? 'border-white/[0.06]' : 'border-slate-200'
          }`}
        >
          <button
            onClick={onOpenGallery}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-all ${
              isDark
                ? 'bg-white/5 hover:bg-white/10 text-slate-300'
                : 'bg-slate-200 hover:bg-slate-100 text-slate-600'
            }`}
          >
            <Box className="w-4 h-4" />
            3D Gallery
          </button>
        </div>

        {/* User info */}
        <div
          className={`flex items-center justify-between px-4 py-3 border-t ${
            isDark ? 'border-white/[0.06]' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {user?.photoURL && (
              <img src={user.photoURL} alt="" className="w-6 h-6 rounded-full shrink-0" />
            )}
            <span className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {user?.displayName || user?.email}
            </span>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ml-auto shrink-0 ${
              isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'
            }`}>
              {credits} credits
            </span>
          </div>
          <button
            onClick={doSignOut}
            title="Sign out"
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
