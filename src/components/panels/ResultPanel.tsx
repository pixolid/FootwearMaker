import type * as THREE from 'three'
import { Save, Loader2, Sparkles } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

interface ResultPanelProps {
  onSaveToLibrary: () => void
  onStartNew: () => void
  resultMesh: THREE.Mesh | null
  isComputing: boolean
  credits: number
  costPerSave: number
  onApplySmoothing: () => void
  isSmoothing: boolean
  isSaving: boolean
  smoothRadius: number
  onSmoothRadiusChange: (v: number) => void
  smoothStrength: number
  onSmoothStrengthChange: (v: number) => void
}

export function ResultPanel({
  onSaveToLibrary,
  onStartNew,
  resultMesh,
  isComputing,
  credits,
  costPerSave,
  onApplySmoothing,
  isSmoothing,
  isSaving,
  smoothRadius,
  onSmoothRadiusChange,
  smoothStrength,
  onSmoothStrengthChange,
}: ResultPanelProps) {
  const { isDark } = useTheme()

  const sliderClass = `w-full h-1.5 rounded-full appearance-none cursor-pointer
    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5
    [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full
    [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:shadow-md
    bg-slate-600/30`

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-1">Step 4: Result</h3>
        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Review your result, then save or export
        </p>
      </div>

      {/* Computing spinner */}
      {isComputing && (
        <div className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium
          bg-indigo-500/20 text-indigo-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Computing result…
        </div>
      )}

      {/* Edge Smoothing */}
      {resultMesh && !isComputing && (
        <div className="space-y-3">
          <label className={`text-xs font-medium block ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Collar Smoothing
          </label>

          {/* Radius slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Radius
              </span>
              <span className={`text-xs tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {smoothRadius.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0.2}
              max={1.0}
              step={0.05}
              value={smoothRadius}
              onChange={(e) => onSmoothRadiusChange(parseFloat(e.target.value))}
              className={sliderClass}
            />
          </div>

          {/* Strength slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Strength
              </span>
              <span className={`text-xs tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {smoothStrength.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.1}
              value={smoothStrength}
              onChange={(e) => onSmoothStrengthChange(parseFloat(e.target.value))}
              className={sliderClass}
            />
          </div>

          {/* Apply button */}
          <button
            onClick={onApplySmoothing}
            disabled={isSmoothing}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all
              ${isSmoothing
                ? 'bg-indigo-500/20 text-indigo-400 cursor-wait'
                : isDark
                  ? 'bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 active:scale-[0.98]'
                  : 'bg-indigo-100 hover:bg-indigo-200 text-indigo-600 active:scale-[0.98]'
              }`}
          >
            {isSmoothing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Applying smoothing…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Apply Collar Smoothing
              </>
            )}
          </button>
        </div>
      )}

      {/* Save to Gallery */}
      {resultMesh && (
        <button
          onClick={onSaveToLibrary}
          disabled={isSaving || credits < costPerSave}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all
            ${isSaving
              ? 'bg-emerald-500/70 text-white cursor-wait'
              : credits >= costPerSave
                ? 'bg-emerald-500 text-white hover:bg-emerald-600 active:scale-[0.98]'
                : 'bg-slate-600 text-slate-400 cursor-not-allowed'
            }`}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save to Gallery ({costPerSave} credits)
            </>
          )}
        </button>
      )}

      {/* Start New */}
      <button
        onClick={onStartNew}
        className={`w-full py-2.5 rounded-xl text-xs font-medium transition-all ${isDark
          ? 'bg-white/5 hover:bg-white/10 text-slate-300'
          : 'bg-slate-200 hover:bg-slate-100 text-slate-600'
          }`}
      >
        Start New Project
      </button>
    </div>
  )
}
