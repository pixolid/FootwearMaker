import { useState } from 'react'
import { X, LogOut, ChevronLeft, ChevronRight, Box, ExternalLink, Zap, ChevronDown, BookMarked } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { useAuth } from '@/hooks/useAuth'
import { doSignOut } from '@/firebase/auth'
import { AddCreditsModal } from '@/components/modals/AddCreditsModal'
import { ProBadge } from '@/components/ui/ProBadge'
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
  onOpenSavedStates: () => void
  /** Whether the current user has Pro access */
  isPro: boolean
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
  onOpenSavedStates,
  isPro,
}: SidebarProps) {
  const { isDark } = useTheme()
  const { user } = useAuth()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [creditsModalOpen, setCreditsModalOpen] = useState(false)

  return (<>
    <div
      className={`absolute top-0 left-0 h-full z-40 transition-transform duration-300 ease-out ${open ? 'translate-x-0' : '-translate-x-full'
        }`}
      style={{ width: '340px' }}
    >
      <div
        className={`w-full h-full flex flex-col backdrop-blur-xl shadow-2xl ${isDark
          ? 'bg-slate-900/95'
          : 'bg-slate-50/95'
          }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-200'
            }`}
        >
          <div className="flex items-center gap-3">
            <img
              src="/FootwearMaker/logo_webseite_white.png"
              alt="Pixogen"
              className={`w-[200px] h-[80px] object-contain ${isDark ? '' : 'invert'}`}
            />
          </div>
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
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
                      className={`w-full py-1.5 px-2 rounded-lg text-xs font-medium transition-all truncate ${isCurrent
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
                        className={`w-2 h-px mx-1 shrink-0 ${isPast ? 'bg-indigo-500' : isDark ? 'bg-white/10' : 'bg-slate-200'
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
            className={`flex items-center gap-3 p-4 border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-200'
              }`}
          >
            <button
              onClick={() => onStepChange(currentStep - 1)}
              disabled={!canGoPrev}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all
                disabled:opacity-30 disabled:cursor-not-allowed
                ${isDark
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

        {/* 3D Gallery + Saved States buttons */}
        {(currentStep >= 3) && (
          <div
            className={`px-4 py-3 border-t flex gap-2 ${isDark ? 'border-white/[0.06]' : 'border-slate-200'
              }`}
          >
            {/* 3D Gallery — only in Result tab (step 4) */}
            {currentStep === 4 && (
              <button
                onClick={onOpenGallery}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium transition-all ${isDark
                  ? 'bg-white/5 hover:bg-white/10 text-slate-300'
                  : 'bg-slate-200 hover:bg-slate-100 text-slate-600'
                  }`}
              >
                <Box className="w-4 h-4" />
                3D Gallery
              </button>
            )}
            {/* Saved States — visible from step 3 (Modify) onwards */}
            <button
              onClick={onOpenSavedStates}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium transition-all ${isDark
                ? 'bg-white/5 hover:bg-white/10 text-slate-300'
                : 'bg-slate-200 hover:bg-slate-100 text-slate-600'
                }`}
            >
              <BookMarked className="w-4 h-4" />
              Saved States
              {!isPro && <ProBadge size="sm" />}
            </button>
          </div>
        )}

        {/* User info + menu */}
        <div className="relative">
          {/* Clickable user row */}
          <button
            onClick={() => setUserMenuOpen((p) => !p)}
            className={`w-full flex items-center gap-2 px-4 py-3 border-t transition-colors ${isDark
              ? 'border-white/[0.06] hover:bg-white/5'
              : 'border-slate-200 hover:bg-slate-100/60'
              }`}
          >
            {user?.photoURL && (
              <img src={user.photoURL} alt="" className="w-6 h-6 rounded-full shrink-0" />
            )}
            <span className={`text-xs truncate flex-1 text-left ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {user?.displayName || user?.email}
            </span>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'
              }`}>
              {credits} credits
            </span>
            <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${userMenuOpen ? 'rotate-180' : ''
              } ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          </button>

          {/* Dropdown menu — opens upward */}
          {userMenuOpen && (
            <>
              {/* click-outside overlay */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setUserMenuOpen(false)}
              />
              <div
                className={`absolute bottom-full left-0 right-0 z-50 mx-2 mb-1 rounded-xl shadow-2xl overflow-hidden
                  border ${isDark
                    ? 'bg-slate-800 border-white/[0.08]'
                    : 'bg-white border-slate-200'
                  }`}
              >
                {/* Open Pixogen */}
                <a
                  href="https://www.pixolid.de"
                  onClick={() => setUserMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${isDark
                    ? 'text-slate-200 hover:bg-white/10'
                    : 'text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  <ExternalLink className="w-4 h-4 shrink-0" />
                  Open Pixogen
                </a>

                <div className={`h-px mx-3 ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`} />

                {/* Add Credits */}
                <button
                  onClick={() => { setUserMenuOpen(false); setCreditsModalOpen(true) }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${isDark
                    ? 'text-slate-200 hover:bg-white/10'
                    : 'text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  <Zap className="w-4 h-4 shrink-0 text-indigo-400" />
                  Get Credits
                </button>

                <div className={`h-px mx-3 ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`} />

                {/* Logout */}
                <button
                  onClick={() => { setUserMenuOpen(false); doSignOut() }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${isDark
                    ? 'text-red-400 hover:bg-red-500/10'
                    : 'text-red-500 hover:bg-red-50'
                    }`}
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>

    {/* Add Credits modal — rendered outside the sidebar so it covers the full screen */}
    <AddCreditsModal
      open={creditsModalOpen}
      onClose={() => setCreditsModalOpen(false)}
    />
  </>)
}
